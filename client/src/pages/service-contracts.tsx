import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import MobileNavigation from "@/components/layout/mobile-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Search, Pencil, Trash2, ChevronDown, ChevronRight,
  AlertTriangle, TrendingUp, CalendarDays, LayoutList, FileText,
  ArrowUp, ArrowDown, User, DollarSign, Package, Clock, Hash,
} from "lucide-react";
import { format, differenceInDays, parseISO, addDays } from "date-fns";
import type { ServiceContract, Department, Client, Worker, Team } from "@shared/schema";

// ── Constants ─────────────────────────────────────────────────────────────────

const FREQS = [
  "Daily","2 x a week","Weekly","Twice a month","Monthly",
  "Every 2 months","Quarterly","Every 6 months","Annually","Once-off","On Demand",
] as const;

const INVOICE_FREQS = ["Per Service","Weekly","Monthly","Quarterly","Every 6 months","Annually"] as const;

const INVOICE_RULES = [
  "Invoice per completed job",
  "Invoice monthly contract",
  "Invoice on demand",
  "Do not invoice automatically",
] as const;

const REFILL_RULES = [
  "Refills Included",
  "Refills Excluded",
  "On Demand Refills",
  "Not Applicable",
] as const;

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"] as const;

const WEEKS_OPTS = [
  { val: 1, label: "Week 1" },
  { val: 2, label: "Week 2" },
  { val: 3, label: "Week 3" },
  { val: 4, label: "Week 4" },
  { val: 5, label: "Last Week" },
];

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const WEEK_ORDER_DISPLAY = ["Week 1","Week 2","Week 3","Week 4","Last Week","Every Week"];

const DOC_TYPES = [
  { label: "Treatment Report",     icon: "📋" },
  { label: "Installation Checklist", icon: "✅" },
  { label: "Survey Sheet",         icon: "📐" },
  { label: "Photo / Picture",      icon: "📷" },
  { label: "Proof of Delivery",    icon: "📦" },
  { label: "Signed Worksheet",     icon: "✍️" },
  { label: "Other Document",       icon: "📎" },
];

// ── Types ─────────────────────────────────────────────────────────────────────

type CF = Partial<ServiceContract> & {
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  contractNumber?: string;
  contractPrice?: string;
  ppu?: string;
  isServiceContract?: boolean;
  isRentalContract?: boolean;
  increaseDate?: string;
  increasePercentage?: string;
  routeOrder?: number | null;
  fixedTime?: boolean;
  invoiceRule?: string;
  mustBeInvoiced?: boolean;
  financeNotes?: string;
  stockTrackingRequired?: boolean;
  refillRule?: string;
  stockNotes?: string;
};

type SC = ServiceContract & {
  contractNumber?: string | null;
  contractPrice?: string | null;
  ppu?: string | null;
  isServiceContract?: boolean | null;
  isRentalContract?: boolean | null;
  increaseDate?: string | null;
  increasePercentage?: string | null;
  routeOrder?: number | null;
  fixedTime?: boolean | null;
  invoiceRule?: string | null;
  mustBeInvoiced?: boolean | null;
  financeNotes?: string | null;
  stockTrackingRequired?: boolean | null;
  refillRule?: string | null;
  stockNotes?: string | null;
};

type TabId = "list" | "schedule" | "ending" | "increases" | "documents";

// ── Helpers ───────────────────────────────────────────────────────────────────

function weekLabel(n: number | null | undefined): string {
  if (!n) return "Every Week";
  return { 1:"Week 1", 2:"Week 2", 3:"Week 3", 4:"Week 4", 5:"Last Week" }[n] ?? "Every Week";
}

function ordinal(n: number) {
  if (n === 5) return "Last";
  return n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`;
}

function scheduleSummary(c: SC): string {
  const t = c.startTime ? ` at ${c.startTime}` : "";
  const ro = c.routeOrder ? ` · Route ${c.routeOrder}` : "";
  switch (c.frequency) {
    case "On Demand":   return "On Demand — create job when requested";
    case "Daily":       return `Daily${t}`;
    case "2 x a week":  return `${c.dayOfWeek ?? "?"} & ${c.secondDayOfWeek ?? "?"}${t}`;
    case "Weekly":      return `Every ${c.dayOfWeek ?? "?"}${t}`;
    case "Twice a month": {
      const a = `${ordinal(c.weekOfMonth ?? 1)} ${c.dayOfWeek ?? ""}${c.startTime ? " at "+c.startTime : ""}`;
      const b = `${ordinal(c.secondWeekOfMonth ?? 3)} ${c.secondDayOfWeek ?? ""}${c.secondStartTime ? " at "+c.secondStartTime : ""}`;
      return `${a} and ${b}`;
    }
    case "Monthly":        return `Week ${c.weekOfMonth ?? 1} ${c.dayOfWeek ?? ""}${t}${ro}`;
    case "Every 2 months": return `Week ${c.weekOfMonth ?? 1} ${c.dayOfWeek ?? ""}${t} (every 2 months)${ro}`;
    case "Quarterly":      return `Week ${c.weekOfMonth ?? 1} ${c.dayOfWeek ?? ""}${t} (quarterly)${ro}`;
    case "Every 6 months": return `Week ${c.weekOfMonth ?? 1} ${c.dayOfWeek ?? ""}${t} (6-monthly)${ro}`;
    case "Annually":
      return `${MONTHS[(c.annualMonth ?? 1)-1]} — ${ordinal(c.weekOfMonth ?? 1)} ${c.dayOfWeek ?? ""}${t}${ro}`;
    case "Once-off":
      return c.startDate ? `${format(new Date(c.startDate), "d MMM yyyy")}${t}` : "Once-off";
  }
  return c.frequency;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHead({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="col-span-2 flex items-center gap-2 mt-4 mb-1">
      <div className="h-px flex-1 bg-gray-100" />
      <span className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2">
        <Icon className="h-3 w-3" /> {label}
      </span>
      <div className="h-px flex-1 bg-gray-100" />
    </div>
  );
}

function TabBtn({ active, icon: Icon, label, count, onClick }: {
  active: boolean; icon: any; label: string; count?: number; onClick: () => void;
}) {
  return (
    <button onClick={onClick} className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap ${
      active ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
    }`}>
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">{label.split(" ")[0]}</span>
      {count !== undefined && count > 0 && (
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>{count}</span>
      )}
    </button>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Main Page
// ══════════════════════════════════════════════════════════════════════════════

export default function ServiceContractsPage() {
  const { toast } = useToast();
  const [location] = useLocation();
  const [tab, setTab] = useState<TabId>("list");
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SC | null>(null);
  const [form, setForm] = useState<CF>({});
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: contracts = [], isLoading } = useQuery<SC[]>({ queryKey: ["/api/service-contracts"] });
  const { data: departments = [] } = useQuery<Department[]>({ queryKey: ["/api/departments"] });
  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: workers = [] } = useQuery<Worker[]>({ queryKey: ["/api/workers"] });
  const { data: teams = [] } = useQuery<Team[]>({ queryKey: ["/api/teams"] });

  // ── Convert-to-contract URL prefill ───────────────────────────────────────
  useEffect(() => {
    const qs = window.location.search;
    if (!qs) return;
    const p = new URLSearchParams(qs);
    if (!p.get("newContract")) return;
    const prefill: CF = {
      activeStatus: true, frequency: "Monthly", weekOfMonth: 1, dayOfWeek: "Monday",
      startTime: "08:00", estimatedDuration: 60, isServiceContract: true, isRentalContract: false,
      mustBeInvoiced: true, fixedTime: false, stockTrackingRequired: false,
    };
    if (p.get("clientId"))     prefill.customerId = p.get("clientId")!;
    if (p.get("clientName"))   prefill.customerName = p.get("clientName")!;
    if (p.get("serviceType"))  prefill.serviceType = p.get("serviceType")!;
    if (p.get("departmentId")) prefill.departmentId = p.get("departmentId")!;
    if (p.get("address"))      prefill.address = p.get("address")!;
    if (p.get("googleMapsLink")) prefill.googleMapsLink = p.get("googleMapsLink")!;
    if (p.get("notes"))        prefill.notes = p.get("notes")!;
    if (p.get("workerId"))     prefill.assignedTechnicianId = p.get("workerId")!;
    if (p.get("workerName"))   prefill.assignedTechnicianName = p.get("workerName")!;
    setForm(prefill); setEditing(null); setOpen(true);
    window.history.replaceState({}, "", window.location.pathname);
  }, [location]);

  // ── Computed ───────────────────────────────────────────────────────────────
  const active = useMemo(() => contracts.filter(c => c.activeStatus), [contracts]);

  const filtered = useMemo(() => contracts.filter(c => {
    if (deptFilter !== "all" && c.departmentId !== deptFilter) return false;
    if (statusFilter === "active" && !c.activeStatus) return false;
    if (statusFilter === "inactive" && c.activeStatus) return false;
    if (search && !c.customerName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [contracts, deptFilter, statusFilter, search]);

  const endingSoon = useMemo(() => {
    const today = new Date();
    return active
      .filter(c => c.endDate)
      .map(c => ({ ...c, daysLeft: differenceInDays(new Date(c.endDate!), today) }))
      .filter(c => c.daysLeft <= 90)
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [active]);

  const upcomingIncreases = useMemo(() => {
    const today = new Date();
    const soon = addDays(today, 90);
    return active
      .filter(c => c.increaseDate)
      .filter(c => { try { const d = parseISO(c.increaseDate!); return d >= today && d <= soon; } catch { return false; } })
      .sort((a, b) => (a.increaseDate ?? "").localeCompare(b.increaseDate ?? ""));
  }, [active]);

  const scheduleGrouped = useMemo(() => {
    const map: Record<string, Record<string, SC[]>> = {};
    WEEK_ORDER_DISPLAY.forEach(w => { map[w] = {}; DAYS.forEach(d => { map[w][d] = []; }); });
    active.forEach(c => {
      const isEvery = !c.weekOfMonth || c.frequency === "Daily" || c.frequency === "Weekly" || c.frequency === "2 x a week";
      const week = isEvery ? "Every Week" : weekLabel(c.weekOfMonth);
      const day = c.dayOfWeek ?? "Monday";
      map[week]?.[day]?.push(c);
      if (c.frequency === "Twice a month" && c.secondWeekOfMonth && c.secondDayOfWeek) {
        map[weekLabel(c.secondWeekOfMonth)]?.[c.secondDayOfWeek]?.push(c);
      }
      if (c.frequency === "2 x a week" && c.secondDayOfWeek) {
        map["Every Week"]?.[c.secondDayOfWeek]?.push(c);
      }
    });
    Object.values(map).forEach(days => Object.values(days).forEach(arr =>
      arr.sort((a, b) => {
        const ra = a.routeOrder ?? 9999, rb = b.routeOrder ?? 9999;
        if (ra !== rb) return ra - rb;
        return (a.startTime ?? "99:99").localeCompare(b.startTime ?? "99:99");
      })
    ));
    return map;
  }, [active]);

  const scheduleWeeks = useMemo(() =>
    WEEK_ORDER_DISPLAY.filter(w => Object.values(scheduleGrouped[w] ?? {}).some(a => a.length > 0)),
  [scheduleGrouped]);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const save = useMutation({
    mutationFn: async () => {
      const payload: any = { ...form };
      if (payload.startDate instanceof Date) payload.startDate = payload.startDate.toISOString();
      if (payload.endDate instanceof Date) payload.endDate = payload.endDate.toISOString();
      if (payload.startDate === "") payload.startDate = null;
      if (payload.endDate === "") payload.endDate = null;
      const url = editing ? `/api/service-contracts/${editing.id}` : "/api/service-contracts";
      return (await apiRequest(editing ? "PUT" : "POST", url, payload)).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-contracts"] });
      setOpen(false); setEditing(null); setForm({});
      toast({ title: editing ? "Contract updated" : "Contract created" });
    },
    onError: (e: any) => toast({ title: "Save failed", description: e?.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/service-contracts/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/service-contracts"] }); toast({ title: "Contract deleted" }); },
  });

  const toggleActive = useMutation({
    mutationFn: (c: SC) => apiRequest("PUT", `/api/service-contracts/${c.id}`, { activeStatus: !c.activeStatus }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/service-contracts"] }),
  });

  const reorderMut = useMutation({
    mutationFn: ({ id, routeOrder }: { id: string; routeOrder: number | null }) =>
      apiRequest("PUT", `/api/service-contracts/${id}`, { routeOrder }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/service-contracts"] }),
  });

  function handleReorder(week: string, day: string, id: string, dir: "up" | "down") {
    const slot = scheduleGrouped[week]?.[day] ?? [];
    const idx = slot.findIndex(c => c.id === id);
    if (idx === -1) return;
    if (dir === "up" && idx > 0) {
      const above = slot[idx - 1], cur = slot[idx];
      const ao = above.routeOrder ?? idx, co = cur.routeOrder ?? idx + 1;
      reorderMut.mutate({ id: above.id, routeOrder: co });
      reorderMut.mutate({ id: cur.id, routeOrder: ao });
    } else if (dir === "down" && idx < slot.length - 1) {
      const below = slot[idx + 1], cur = slot[idx];
      const bo = below.routeOrder ?? idx + 2, co = cur.routeOrder ?? idx + 1;
      reorderMut.mutate({ id: below.id, routeOrder: co });
      reorderMut.mutate({ id: cur.id, routeOrder: bo });
    }
  }

  // ── Form helpers ───────────────────────────────────────────────────────────
  const openNew = (init: CF = {}) => {
    setEditing(null);
    setForm({ activeStatus: true, frequency: "Monthly", weekOfMonth: 1, dayOfWeek: "Monday",
      startTime: "08:00", estimatedDuration: 60, isServiceContract: true, isRentalContract: false,
      mustBeInvoiced: true, fixedTime: false, stockTrackingRequired: false, ...init });
    setOpen(true);
  };

  const openEdit = (c: SC) => {
    setEditing(c);
    setForm({ ...c,
      startDate: c.startDate ? format(new Date(c.startDate), "yyyy-MM-dd") : "",
      endDate: c.endDate ? format(new Date(c.endDate), "yyyy-MM-dd") : "",
    });
    setOpen(true);
  };

  const setCustomer = (id: string) => {
    const cl = clients.find(c => c.id === id);
    setForm(f => ({ ...f, customerId: id, customerName: cl?.name ?? f.customerName ?? "" }));
  };

  const setTech = (id: string) => {
    if (id === "_none") { setForm(f => ({ ...f, assignedTechnicianId: null, assignedTechnicianName: null, assignedTeamId: null, assignedTeamName: null })); return; }
    if (id.startsWith("team:")) {
      const t = teams.find(x => x.id === id.slice(5));
      setForm(f => ({ ...f, assignedTeamId: id.slice(5), assignedTeamName: t?.name ?? null, assignedTechnicianId: null, assignedTechnicianName: null }));
    } else {
      const w = workers.find(x => x.id === id);
      setForm(f => ({ ...f, assignedTechnicianId: id, assignedTechnicianName: w?.name ?? null, assignedTeamId: null, assignedTeamName: null }));
    }
  };

  const techValue = form.assignedTeamId ? `team:${form.assignedTeamId}` : form.assignedTechnicianId || "_none";
  const freq = form.frequency || "Monthly";
  const isOnDemand = freq === "On Demand";
  const show = {
    onDemand:       isOnDemand,
    endDate:        !["Once-off","On Demand"].includes(freq),
    weekOfMonth:    ["Monthly","Twice a month","Every 2 months","Quarterly","Every 6 months","Annually"].includes(freq),
    dayOfWeek:      !["Daily","Once-off","On Demand"].includes(freq),
    secondDay:      freq === "2 x a week",
    twiceMonth:     freq === "Twice a month",
    annualMonth:    freq === "Annually",
    routeSeq:       !["Daily","Once-off","On Demand"].includes(freq),
    startDate:      freq !== "On Demand",
  };
  const startRequired = ["Once-off","Every 2 months","Quarterly","Every 6 months","Annually"].includes(freq);
  const startLabel = freq === "Once-off" ? "Date *" : startRequired ? "Start Date *" : "Start Date";

  function toggleCollapse(k: string) {
    setCollapsed(p => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Contracts" />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-20 lg:pb-6">

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">

            {/* ── Tab bar ── */}
            <div className="flex overflow-x-auto border-b border-gray-200 px-1">
              <TabBtn id="list"      active={tab==="list"}      icon={LayoutList}    label="Contract List"     count={filtered.length}         onClick={() => setTab("list")} />
              <TabBtn id="schedule"  active={tab==="schedule"}  icon={CalendarDays}  label="Schedule View"     count={active.length}           onClick={() => setTab("schedule")} />
              <TabBtn id="ending"    active={tab==="ending"}    icon={AlertTriangle} label="Contracts Ending"  count={endingSoon.length}       onClick={() => setTab("ending")} />
              <TabBtn id="increases" active={tab==="increases"} icon={TrendingUp}    label="Increase Dates"    count={upcomingIncreases.length} onClick={() => setTab("increases")} />
              <TabBtn id="documents" active={tab==="documents"} icon={FileText}      label="Documents"                                         onClick={() => setTab("documents")} />
            </div>

            {/* ══ CONTRACT LIST ══════════════════════════════════════════════ */}
            {tab === "list" && (
              <div className="p-4 space-y-3">
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                  <div className="flex flex-wrap gap-2 items-center">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                      <Input placeholder="Search client…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 w-48 text-sm" />
                    </div>
                    <Select value={deptFilter} onValueChange={setDeptFilter}>
                      <SelectTrigger className="h-9 w-36 text-sm"><SelectValue placeholder="Department" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All departments</SelectItem>
                        {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="h-9 w-28 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={() => openNew()} className="h-9 gap-1 text-sm self-start sm:self-auto">
                    <Plus className="h-4 w-4" />New Contract
                  </Button>
                </div>

                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b text-left">
                      <tr>
                        <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Client</th>
                        <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Contract #</th>
                        <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Service</th>
                        <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Schedule</th>
                        <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Team / Tech</th>
                        <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Price</th>
                        <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Active</th>
                        <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading && <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-400">Loading…</td></tr>}
                      {!isLoading && filtered.length === 0 && (
                        <tr><td colSpan={8} className="px-3 py-10 text-center text-gray-400">
                          No contracts found. Click <strong>New Contract</strong> to add one.
                        </td></tr>
                      )}
                      {filtered.map(c => {
                        const dept = departments.find(d => d.id === c.departmentId);
                        const assigned = c.assignedTeamName ? `${c.assignedTeamName} (team)` : c.assignedTechnicianName ?? "—";
                        return (
                          <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="px-3 py-2.5">
                              <div className="font-medium text-gray-900">{c.customerName}</div>
                              {dept && <div className="text-xs text-gray-400">{dept.name}</div>}
                            </td>
                            <td className="px-3 py-2.5 hidden sm:table-cell text-xs text-gray-500 font-mono">{c.contractNumber ?? "—"}</td>
                            <td className="px-3 py-2.5">
                              <Badge variant="outline" className="text-xs">{c.serviceType}</Badge>
                              <div className="text-xs text-gray-400 mt-0.5">{c.frequency}</div>
                            </td>
                            <td className="px-3 py-2.5 hidden md:table-cell text-xs text-gray-600">{scheduleSummary(c)}</td>
                            <td className="px-3 py-2.5 hidden lg:table-cell text-xs text-gray-600">{assigned}</td>
                            <td className="px-3 py-2.5 hidden md:table-cell text-xs text-gray-700">
                              {c.contractPrice ? `R ${c.contractPrice}` : "—"}
                            </td>
                            <td className="px-3 py-2.5"><Switch checked={!!c.activeStatus} onCheckedChange={() => toggleActive.mutate(c)} /></td>
                            <td className="px-3 py-2.5 text-right whitespace-nowrap">
                              <Button size="sm" variant="ghost" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                              <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Delete contract for ${c.customerName}?`)) remove.mutate(c.id); }}>
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ══ SCHEDULE VIEW ═════════════════════════════════════════════ */}
            {tab === "schedule" && (
              <div className="p-4 space-y-3">
                <p className="text-sm text-gray-500">Active contracts grouped by week, day, time, and route order. Use ↑↓ to reorder within a day.</p>

                {scheduleWeeks.length === 0 && (
                  <div className="text-center py-12 text-gray-400">No active contracts to display.</div>
                )}

                {scheduleWeeks.map(week => {
                  const wKey = `w:${week}`;
                  const wCollapsed = collapsed.has(wKey);
                  const weekDays = DAYS.filter(d => (scheduleGrouped[week]?.[d]?.length ?? 0) > 0);
                  const total = weekDays.reduce((s, d) => s + (scheduleGrouped[week]?.[d]?.length ?? 0), 0);

                  return (
                    <div key={week} className="border border-gray-200 rounded-xl overflow-hidden">
                      <button onClick={() => toggleCollapse(wKey)}
                        className="w-full flex items-center gap-3 px-4 py-3 bg-blue-50 hover:bg-blue-100 transition text-left">
                        {wCollapsed ? <ChevronRight className="h-4 w-4 text-blue-400" /> : <ChevronDown className="h-4 w-4 text-blue-400" />}
                        <span className="font-bold text-blue-900">{week}</span>
                        <span className="text-xs text-blue-600">{total} contract{total !== 1 ? "s" : ""}</span>
                      </button>

                      {!wCollapsed && weekDays.map(day => {
                        const dKey = `d:${week}:${day}`;
                        const dCollapsed = collapsed.has(dKey);
                        const slot = scheduleGrouped[week]?.[day] ?? [];

                        return (
                          <div key={day} className="border-t border-gray-100">
                            <button onClick={() => toggleCollapse(dKey)}
                              className="w-full flex items-center gap-3 px-6 py-2 bg-gray-50 hover:bg-gray-100 transition text-left">
                              {dCollapsed ? <ChevronRight className="h-3.5 w-3.5 text-gray-400" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-400" />}
                              <span className="font-semibold text-gray-700 text-sm">{day}</span>
                              <span className="text-xs text-gray-400">{slot.length}</span>
                            </button>

                            {!dCollapsed && (
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <tbody>
                                    {slot.map((c, idx) => (
                                      <tr key={`${c.id}-${idx}`} className="border-t border-gray-50 hover:bg-blue-50/30">
                                        <td className="px-3 pl-8 py-2 w-8">
                                          <div className="flex flex-col gap-0.5">
                                            <button disabled={idx === 0} onClick={() => handleReorder(week, day, c.id, "up")}
                                              className="text-gray-300 hover:text-blue-500 disabled:opacity-20 disabled:cursor-not-allowed transition">
                                              <ArrowUp className="h-3 w-3" />
                                            </button>
                                            <button disabled={idx === slot.length - 1} onClick={() => handleReorder(week, day, c.id, "down")}
                                              className="text-gray-300 hover:text-blue-500 disabled:opacity-20 disabled:cursor-not-allowed transition">
                                              <ArrowDown className="h-3 w-3" />
                                            </button>
                                          </div>
                                        </td>
                                        <td className="px-2 py-2 font-bold text-gray-400 tabular-nums w-8 text-sm">{c.routeOrder ?? idx + 1}</td>
                                        <td className="px-2 py-2 font-mono text-xs text-gray-500 w-14">{c.startTime ?? "—"}</td>
                                        <td className="px-3 py-2">
                                          <div className="font-semibold text-gray-900">{c.customerName}</div>
                                          {c.address && <div className="text-xs text-gray-400 truncate max-w-[180px]">{c.address}</div>}
                                        </td>
                                        <td className="px-3 py-2 hidden sm:table-cell">
                                          <Badge variant="outline" className="text-[11px]">{c.serviceType}</Badge>
                                        </td>
                                        <td className="px-3 py-2 hidden lg:table-cell text-xs text-gray-500">{c.frequency}</td>
                                        <td className="px-3 py-2 hidden lg:table-cell text-xs text-gray-600">{c.assignedTeamName ?? c.assignedTechnicianName ?? "—"}</td>
                                        <td className="px-3 py-2 text-right">
                                          <Button size="sm" variant="outline" onClick={() => { openEdit(c); setTab("list"); }} className="h-7 text-xs gap-1">
                                            <Pencil className="h-3 w-3" /> Edit
                                          </Button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ══ CONTRACTS ENDING ══════════════════════════════════════════ */}
            {tab === "ending" && (
              <div className="p-4 space-y-3">
                <p className="text-sm text-gray-500">Active contracts ending within the next 90 days.</p>
                {endingSoon.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">No contracts ending soon.</div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Client</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Service</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">End Date</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Days Left</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {endingSoon.map(c => (
                          <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="px-3 py-2.5 font-medium">{c.customerName}</td>
                            <td className="px-3 py-2.5 text-gray-600">{c.serviceType}</td>
                            <td className="px-3 py-2.5 text-gray-600">{format(new Date(c.endDate!), "d MMM yyyy")}</td>
                            <td className="px-3 py-2.5">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                (c as any).daysLeft <= 14 ? "bg-red-100 text-red-700" :
                                (c as any).daysLeft <= 30 ? "bg-amber-100 text-amber-700" : "bg-yellow-50 text-yellow-700"
                              }`}>{(c as any).daysLeft <= 0 ? "Expired" : `${(c as any).daysLeft} days`}</span>
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <Button size="sm" variant="outline" onClick={() => openEdit(c)} className="h-7 text-xs gap-1">
                                <Pencil className="h-3 w-3" /> Edit
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ══ INCREASE DATES ════════════════════════════════════════════ */}
            {tab === "increases" && (
              <div className="p-4 space-y-3">
                <p className="text-sm text-gray-500">Active contracts with a price increase scheduled in the next 90 days.</p>
                {upcomingIncreases.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">No upcoming price increases.</div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Client</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Service</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Current Price</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Increase %</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Increase Date</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {upcomingIncreases.map(c => (
                          <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="px-3 py-2.5 font-medium">{c.customerName}</td>
                            <td className="px-3 py-2.5 text-gray-600">{c.serviceType}</td>
                            <td className="px-3 py-2.5 text-gray-600">{c.contractPrice ? `R ${c.contractPrice}` : "—"}</td>
                            <td className="px-3 py-2.5">
                              {c.increasePercentage ? (
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">+{c.increasePercentage}%</span>
                              ) : "—"}
                            </td>
                            <td className="px-3 py-2.5 text-gray-600">
                              {(() => { try { return format(parseISO(c.increaseDate!), "d MMM yyyy"); } catch { return c.increaseDate; } })()}
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <Button size="sm" variant="outline" onClick={() => openEdit(c)} className="h-7 text-xs gap-1">
                                <Pencil className="h-3 w-3" /> Edit
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ══ CONTRACT DOCUMENTS ════════════════════════════════════════ */}
            {tab === "documents" && (
              <div className="p-4 space-y-4">
                <p className="text-sm text-gray-500">
                  Document types that can be linked to clients, contracts, and jobs. Select a contract from the <strong>Contract List</strong> to attach documents.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {DOC_TYPES.map(dt => (
                    <div key={dt.label} className="border border-gray-200 rounded-xl p-4 text-center hover:border-blue-300 hover:bg-blue-50/30 transition cursor-default">
                      <div className="text-3xl mb-2">{dt.icon}</div>
                      <div className="text-sm font-medium text-gray-800">{dt.label}</div>
                    </div>
                  ))}
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                  <strong>Coming soon:</strong> File uploads (Treatment Reports, Signed Worksheets, Photos, etc.) will be available here. For now, add document links in the contract's <strong>Notes</strong> field.
                </div>
              </div>
            )}

          </div>
        </main>
      </div>

      <MobileNavigation />

      {/* ════════════════════════════════════════════════════════════════════
          Contract Form Dialog
      ════════════════════════════════════════════════════════════════════ */}
      <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) { setEditing(null); setForm({}); } }}>
        <DialogContent className="max-w-2xl max-h-[93vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Contract" : "New Contract"}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-x-3 gap-y-3 py-1">

            {/* ─── SECTION 1: Client & Contract Details ─────────────────── */}
            <SectionHead icon={User} label="Client & Contract Details" />

            <div>
              <Label>Client *</Label>
              <Select value={form.customerId || ""} onValueChange={setCustomer}>
                <SelectTrigger><SelectValue placeholder="Choose client" /></SelectTrigger>
                <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Contract Number</Label>
              <Input value={form.contractNumber ?? ""} onChange={e => setForm(f => ({ ...f, contractNumber: e.target.value }))} placeholder="e.g. CTR-2026-001" />
            </div>
            <div>
              <Label>Service Type *</Label>
              <Input value={form.serviceType ?? ""} onChange={e => setForm(f => ({ ...f, serviceType: e.target.value }))} placeholder="e.g. Sanitary Bins" />
            </div>
            <div>
              <Label>Department *</Label>
              <Select value={form.departmentId || ""} onValueChange={v => setForm(f => ({ ...f, departmentId: v }))}>
                <SelectTrigger><SelectValue placeholder="Choose department" /></SelectTrigger>
                <SelectContent>{departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Contract Price (R)</Label>
              <Input value={form.contractPrice ?? ""} onChange={e => setForm(f => ({ ...f, contractPrice: e.target.value }))} placeholder="e.g. 850.00" />
            </div>
            <div>
              <Label>PPU (price per unit)</Label>
              <Input value={form.ppu ?? ""} onChange={e => setForm(f => ({ ...f, ppu: e.target.value }))} placeholder="e.g. 45.00" />
            </div>
            <div>
              <Label>Contract Start Date</Label>
              <Input type="date" value={(form.startDate as string) ?? ""} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div>
              <Label>Contract End Date</Label>
              <Input type="date" value={(form.endDate as string) ?? ""} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
            </div>
            <div>
              <Label>Increase Date</Label>
              <Input type="date" value={form.increaseDate ?? ""} onChange={e => setForm(f => ({ ...f, increaseDate: e.target.value }))} />
            </div>
            <div>
              <Label>Increase %</Label>
              <Input value={form.increasePercentage ?? ""} onChange={e => setForm(f => ({ ...f, increasePercentage: e.target.value }))} placeholder="e.g. 10" />
            </div>
            <div className="col-span-2">
              <Label>Address</Label>
              <Input value={form.address ?? ""} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Service address" />
            </div>
            <div className="col-span-2">
              <Label>Google Maps Link</Label>
              <Input value={form.googleMapsLink ?? ""} onChange={e => setForm(f => ({ ...f, googleMapsLink: e.target.value }))} placeholder="https://maps.google.com/…" />
            </div>
            <div className="col-span-2 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={form.isServiceContract !== false} onCheckedChange={v => setForm(f => ({ ...f, isServiceContract: v }))} />
                <Label className="font-normal">Service Contract</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={!!form.isRentalContract} onCheckedChange={v => setForm(f => ({ ...f, isRentalContract: v }))} />
                <Label className="font-normal">Rental Contract</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.activeStatus !== false} onCheckedChange={v => setForm(f => ({ ...f, activeStatus: v }))} />
                <Label className="font-normal">Active</Label>
              </div>
            </div>
            <div className="col-span-2">
              <Label>Notes</Label>
              <Textarea rows={2} value={form.notes ?? ""} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>

            {/* ─── SECTION 2: Scheduling ─────────────────────────────────── */}
            <SectionHead icon={Clock} label="Scheduling" />

            <div>
              <Label>Frequency *</Label>
              <Select value={freq} onValueChange={v => setForm(f => ({ ...f, frequency: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FREQS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Invoicing Frequency</Label>
              <Select value={form.invoicingFrequency || ""} onValueChange={v => setForm(f => ({ ...f, invoicingFrequency: v }))}>
                <SelectTrigger><SelectValue placeholder="How often invoiced" /></SelectTrigger>
                <SelectContent>{INVOICE_FREQS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            {show.onDemand && (
              <div className="col-span-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                <strong>On Demand:</strong> This contract will NOT be placed on the calendar automatically. A job must be created manually when the client requests the service.
              </div>
            )}

            {!show.onDemand && (
              <>
                {/* Assigned team/tech always shown */}
                <div className="col-span-2">
                  <Label>Assigned Team / Technician</Label>
                  <Select value={techValue} onValueChange={setTech}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">— Unassigned —</SelectItem>
                      {workers.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                      {teams.map(t => <SelectItem key={t.id} value={`team:${t.id}`}>{t.name} (team)</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {show.annualMonth && (
                  <div>
                    <Label>Month *</Label>
                    <Select value={String(form.annualMonth ?? 1)} onValueChange={v => setForm(f => ({ ...f, annualMonth: Number(v) }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{MONTHS.map((m, i) => <SelectItem key={m} value={String(i+1)}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}

                {show.weekOfMonth && !show.twiceMonth && (
                  <div>
                    <Label>Week of Month *</Label>
                    <Select value={String(form.weekOfMonth ?? 1)} onValueChange={v => setForm(f => ({ ...f, weekOfMonth: Number(v) }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{WEEKS_OPTS.map(w => <SelectItem key={w.val} value={String(w.val)}>{w.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}

                {show.dayOfWeek && !show.twiceMonth && (
                  <div>
                    <Label>{freq === "2 x a week" ? "First Day *" : "Day of Week *"}</Label>
                    <Select value={form.dayOfWeek ?? ""} onValueChange={v => setForm(f => ({ ...f, dayOfWeek: v }))}>
                      <SelectTrigger><SelectValue placeholder="Choose day" /></SelectTrigger>
                      <SelectContent>{DAYS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}

                {show.secondDay && !show.twiceMonth && (
                  <div>
                    <Label>Second Day *</Label>
                    <Select value={form.secondDayOfWeek ?? ""} onValueChange={v => setForm(f => ({ ...f, secondDayOfWeek: v }))}>
                      <SelectTrigger><SelectValue placeholder="Choose day" /></SelectTrigger>
                      <SelectContent>{DAYS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}

                {/* Twice a month — two visit blocks */}
                {show.twiceMonth && (
                  <>
                    <div className="col-span-2 text-xs font-semibold text-gray-500 -mb-1">First visit</div>
                    <div className="grid col-span-2 grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs">Week</Label>
                        <Select value={String(form.weekOfMonth ?? 1)} onValueChange={v => setForm(f => ({ ...f, weekOfMonth: Number(v) }))}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>{WEEKS_OPTS.map(w => <SelectItem key={w.val} value={String(w.val)}>{w.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Day</Label>
                        <Select value={form.dayOfWeek ?? ""} onValueChange={v => setForm(f => ({ ...f, dayOfWeek: v }))}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="Day" /></SelectTrigger>
                          <SelectContent>{DAYS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Time</Label>
                        <Input type="time" value={form.startTime ?? ""} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} className="h-9" />
                      </div>
                    </div>
                    <div className="col-span-2 text-xs font-semibold text-gray-500 -mb-1">Second visit</div>
                    <div className="grid col-span-2 grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs">Week</Label>
                        <Select value={String(form.secondWeekOfMonth ?? 3)} onValueChange={v => setForm(f => ({ ...f, secondWeekOfMonth: Number(v) }))}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>{WEEKS_OPTS.map(w => <SelectItem key={w.val} value={String(w.val)}>{w.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Day</Label>
                        <Select value={form.secondDayOfWeek ?? ""} onValueChange={v => setForm(f => ({ ...f, secondDayOfWeek: v }))}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="Day" /></SelectTrigger>
                          <SelectContent>{DAYS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Time</Label>
                        <Input type="time" value={form.secondStartTime ?? ""} onChange={e => setForm(f => ({ ...f, secondStartTime: e.target.value }))} className="h-9" />
                      </div>
                    </div>
                  </>
                )}

                {/* Time + duration (not shown for Twice a month — handled inline above) */}
                {!show.twiceMonth && (
                  <>
                    <div>
                      <Label>Start Time</Label>
                      <Input type="time" value={form.startTime ?? ""} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Duration (min)</Label>
                      <Input type="number" min={15} step={15} value={form.estimatedDuration ?? 60} onChange={e => setForm(f => ({ ...f, estimatedDuration: Number(e.target.value) || null }))} />
                    </div>
                  </>
                )}

                <div>
                  <Label>Route Sequence</Label>
                  <Input type="number" min={1} value={form.routeOrder ?? ""} onChange={e => setForm(f => ({ ...f, routeOrder: e.target.value ? parseInt(e.target.value) : null }))} placeholder="Auto" />
                </div>

                <div className="flex items-center gap-2 pt-5">
                  <Switch checked={!!form.fixedTime} onCheckedChange={v => setForm(f => ({ ...f, fixedTime: v }))} />
                  <div>
                    <Label className="font-normal">Fixed Time</Label>
                    <p className="text-xs text-gray-400">Job must run at exact start time</p>
                  </div>
                </div>
              </>
            )}

            {/* ─── SECTION 3: Invoicing ──────────────────────────────────── */}
            <SectionHead icon={DollarSign} label="Invoicing" />

            <div>
              <Label>Invoice Rule</Label>
              <Select value={form.invoiceRule ?? ""} onValueChange={v => setForm(f => ({ ...f, invoiceRule: v }))}>
                <SelectTrigger><SelectValue placeholder="Choose rule" /></SelectTrigger>
                <SelectContent>{INVOICE_RULES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pt-5">
              <Switch checked={form.mustBeInvoiced !== false} onCheckedChange={v => setForm(f => ({ ...f, mustBeInvoiced: v }))} />
              <Label className="font-normal">Must Be Invoiced</Label>
            </div>
            <div className="col-span-2">
              <Label>Finance Notes</Label>
              <Input value={form.financeNotes ?? ""} onChange={e => setForm(f => ({ ...f, financeNotes: e.target.value }))} placeholder="Invoice notes for finance team" />
            </div>

            {/* ─── SECTION 4: Stock / Refill Tracking ───────────────────── */}
            <SectionHead icon={Package} label="Stock / Refill Tracking" />

            <div className="flex items-center gap-2 pt-3">
              <Switch checked={!!form.stockTrackingRequired} onCheckedChange={v => setForm(f => ({ ...f, stockTrackingRequired: v }))} />
              <Label className="font-normal">Stock Tracking Required</Label>
            </div>
            <div>
              <Label>Refill Rule</Label>
              <Select value={form.refillRule ?? ""} onValueChange={v => setForm(f => ({ ...f, refillRule: v }))}>
                <SelectTrigger><SelectValue placeholder="Choose rule" /></SelectTrigger>
                <SelectContent>{REFILL_RULES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Stock Notes</Label>
              <Input value={form.stockNotes ?? ""} onChange={e => setForm(f => ({ ...f, stockNotes: e.target.value }))} placeholder="e.g. 2x soap, 1x paper roll per visit" />
            </div>

          </div>

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={() => save.mutate()}
              disabled={save.isPending || !form.customerId || !form.serviceType || !form.departmentId || !form.frequency || (startRequired && !form.startDate)}
            >
              {save.isPending ? "Saving…" : editing ? "Save Changes" : "Create Contract"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
