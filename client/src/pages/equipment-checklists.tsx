import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import MobileNavigation from "@/components/layout/mobile-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CheckCircle, AlertTriangle, Clock, ClipboardList,
  Package, Shield, Search, ChevronDown, ChevronRight,
  User, Truck, Users, Calendar,
} from "lucide-react";
import type { EquipmentChecklist, EquipmentChecklistItem } from "@shared/schema";

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  passed: { label: "Passed", color: "bg-green-100 text-green-800 border-green-200", icon: CheckCircle },
  passed_with_notes: { label: "Passed with Notes", color: "bg-orange-100 text-orange-800 border-orange-200", icon: AlertTriangle },
  failed: { label: "Failed", color: "bg-red-100 text-red-800 border-red-200", icon: AlertTriangle },
  pending: { label: "Not Submitted", color: "bg-gray-100 text-gray-600 border-gray-200", icon: Clock },
};

const CATEGORY_LABELS: Record<string, string> = {
  general: "General Equipment",
  chemicals: "Chemicals / Consumables",
  ppe: "PPE / Safety",
  job_specific: "Job-Specific",
};

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, color, icon: Icon }: { label: string; value: number; color: string; icon: any }) {
  return (
    <div className={`rounded-xl border p-4 flex items-center gap-4 ${color}`}>
      <div className="p-2 rounded-lg bg-white/50">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs font-medium opacity-80">{label}</p>
      </div>
    </div>
  );
}

// ── Item detail panel ─────────────────────────────────────────────────────────

function ChecklistDetail({ checklist }: { checklist: EquipmentChecklist }) {
  const { data: items = [] } = useQuery<EquipmentChecklistItem[]>({
    queryKey: [`/api/equipment-checklists/${checklist.id}/items`],
  });

  const categories = ["general", "chemicals", "ppe", "job_specific"];
  const byCategory = categories.reduce((acc, cat) => {
    const catItems = items.filter(i => i.category === cat);
    if (catItems.length) acc[cat] = catItems;
    return acc;
  }, {} as Record<string, EquipmentChecklistItem[]>);

  const damaged = items.filter(i => i.condition === "damaged" || i.condition === "needs_replacement");
  const missing = items.filter(i => i.present === "no");
  const criticalMissing = items.filter(i => i.isCritical && i.present === "no");

  return (
    <div className="mt-4 border-t pt-4 space-y-4">
      {/* Summary badges */}
      {(damaged.length > 0 || missing.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {criticalMissing.length > 0 && (
            <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full font-medium">
              <AlertTriangle className="h-3 w-3" />
              {criticalMissing.length} critical missing
            </span>
          )}
          {missing.filter(i => !i.isCritical).length > 0 && (
            <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 text-xs px-2 py-1 rounded-full font-medium">
              {missing.filter(i => !i.isCritical).length} not present
            </span>
          )}
          {damaged.length > 0 && (
            <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 text-xs px-2 py-1 rounded-full font-medium">
              {damaged.length} damaged / needs replacement
            </span>
          )}
        </div>
      )}

      {/* Items by category */}
      {Object.entries(byCategory).map(([cat, catItems]) => (
        <div key={cat}>
          <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{CATEGORY_LABELS[cat]}</h5>
          <div className="space-y-1">
            {catItems.map(item => {
              const isIssue = item.present === "no" || item.condition !== "good";
              const isCritIssue = item.isCritical && item.present === "no";
              return (
                <div
                  key={item.id}
                  className={`flex items-start gap-3 rounded-lg px-3 py-2 text-sm ${
                    isCritIssue ? "bg-red-50 border border-red-200"
                    : isIssue ? "bg-amber-50 border border-amber-200"
                    : "bg-gray-50"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {item.isCritical && <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />}
                      <span className={`font-medium ${isCritIssue ? "text-red-700" : "text-gray-800"}`}>{item.itemName}</span>
                    </div>
                    {item.notes && <p className="text-xs text-gray-500 mt-0.5 italic">{item.notes}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                      item.present === "yes" ? "bg-green-100 text-green-700"
                      : item.present === "no" ? "bg-red-100 text-red-700"
                      : "bg-gray-100 text-gray-600"
                    }`}>
                      {item.present === "na" ? "N/A" : item.present}
                    </span>
                    {item.present === "yes" && (
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        item.condition === "good" ? "bg-green-100 text-green-700"
                        : item.condition === "damaged" ? "bg-amber-100 text-amber-700"
                        : item.condition === "needs_replacement" ? "bg-orange-100 text-orange-700"
                        : "bg-red-100 text-red-700"
                      }`}>
                        {item.condition === "needs_replacement" ? "Needs Repl." : item.condition}
                      </span>
                    )}
                    {item.quantityTaken != null && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">x{item.quantityTaken}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {checklist.supervisorOverride && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-800">
          <strong>Supervisor override</strong> by {checklist.supervisorName}
        </div>
      )}
    </div>
  );
}

// ── Checklist row ─────────────────────────────────────────────────────────────

function ChecklistRow({ checklist }: { checklist: EquipmentChecklist }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[checklist.status] ?? STATUS_CONFIG.pending;
  const Icon = cfg.icon;

  return (
    <div className={`border rounded-xl mb-3 overflow-hidden ${checklist.hasCriticalMissing ? "border-red-300" : "border-gray-200"}`}>
      <button
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className={`p-2 rounded-lg border shrink-0 ${cfg.color}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 text-sm">{checklist.technicianName}</span>
            <Badge className={cfg.color + " text-xs"}>{cfg.label}</Badge>
            {checklist.hasCriticalMissing && (
              <Badge className="bg-red-100 text-red-700 text-xs">⚠ Critical Missing</Badge>
            )}
            <Badge variant="outline" className="text-xs capitalize">
              {checklist.checklistType.replace("_", " ")}
            </Badge>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
            {checklist.teamName && (
              <span className="flex items-center gap-1"><Users className="h-3 w-3" />{checklist.teamName}</span>
            )}
            {checklist.vehicleRegistration && (
              <span className="flex items-center gap-1"><Truck className="h-3 w-3" />{checklist.vehicleRegistration}</span>
            )}
            {checklist.submittedAt && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(checklist.submittedAt).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>
          {checklist.notes && <p className="text-xs text-gray-500 italic mt-0.5 truncate">{checklist.notes}</p>}
        </div>
        {expanded ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />}
      </button>
      {expanded && (
        <div className="px-4 pb-4">
          <ChecklistDetail checklist={checklist} />
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function EquipmentChecklistsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().slice(0, 10));
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const { data: checklists = [], isLoading } = useQuery<EquipmentChecklist[]>({
    queryKey: [`/api/equipment-checklists`, dateFilter],
    queryFn: () => fetch(`/api/equipment-checklists?date=${dateFilter}`).then(r => r.json()),
  });

  const { data: todayStats } = useQuery<any>({
    queryKey: ["/api/equipment-checklists/stats/today"],
  });

  const filtered = checklists.filter(c => {
    const matchesSearch = !search ||
      c.technicianName.toLowerCase().includes(search.toLowerCase()) ||
      (c.teamName ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (c.vehicleRegistration ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const damaged = checklists.flatMap(() => []).length; // computed from items (shown in detail)
  const critical = checklists.filter(c => c.hasCriticalMissing).length;

  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Equipment Checklists" />
        <main className="flex-1 overflow-y-auto p-6 pb-20 lg:pb-6">
          {/* Stat cards */}
          {todayStats && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
              <StatCard label="Submitted Today" value={todayStats.total - todayStats.pending} color="bg-blue-50 text-blue-800 border-blue-200" icon={ClipboardList} />
              <StatCard label="Passed" value={todayStats.passed} color="bg-green-50 text-green-800 border-green-200" icon={CheckCircle} />
              <StatCard label="Passed w/ Notes" value={todayStats.passedWithNotes} color="bg-orange-50 text-orange-800 border-orange-200" icon={AlertTriangle} />
              <StatCard label="Failed" value={todayStats.failed} color="bg-red-50 text-red-800 border-red-200" icon={AlertTriangle} />
              <StatCard label="Not Submitted" value={todayStats.pending} color="bg-gray-100 text-gray-700 border-gray-300" icon={Clock} />
              <StatCard label="Critical Missing" value={todayStats.criticalMissing} color="bg-red-100 text-red-800 border-red-300" icon={Shield} />
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by technician, team or vehicle..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <input
              type="date"
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="all">All Statuses</option>
              <option value="passed">Passed</option>
              <option value="passed_with_notes">Passed with Notes</option>
              <option value="failed">Failed</option>
              <option value="pending">Not Submitted</option>
            </select>
          </div>

          {/* Content */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-5 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900">Equipment Checklists</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {filtered.length} checklist{filtered.length !== 1 ? "s" : ""} for {new Date(dateFilter + "T00:00:00").toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
            <div className="p-5">
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="border border-gray-200 rounded-xl p-4 animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-12 text-center">
                  <ClipboardList className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500 font-medium">No checklists found</p>
                  <p className="text-gray-400 text-sm mt-1">Technicians submit checklists from the JobFlow Mobile app.</p>
                </div>
              ) : (
                filtered.map(c => <ChecklistRow key={c.id} checklist={c} />)
              )}
            </div>
          </div>
        </main>
      </div>
      <MobileNavigation />
    </div>
  );
}
