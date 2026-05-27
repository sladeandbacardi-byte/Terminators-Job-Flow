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
  AlertTriangle, TrendingUp, CalendarDays, LayoutList,
} from "lucide-react";
import { format, differenceInDays, parseISO, addDays } from "date-fns";
import type { ServiceContract, Department, Client, Worker, Team } from "@shared/schema";

// ── Constants ────────────────────────────────────────────────────────────────

const FREQS = [
  "Daily","2 x a week","Weekly","Twice a month","Monthly",
  "Every 2 months","Quarterly","Every 6 months","Annually","Once-off",
] as const;
const INVOICE_FREQS = ["Per Service","Weekly","Monthly","Quarterly","Every 6 months","Annually"] as const;
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

type ContractForm = Partial<ServiceContract> & {
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  contractPrice?: string;
  isServiceContract?: boolean;
  isRentalContract?: boolean;
  increaseDate?: string;
  increasePercentage?: string;
  routeOrder?: number | null;
};

type TabId = "list" | "schedule" | "ending" | "increases";

// ── Helpers ──────────────────────────────────────────────────────────────────

function weekLabel(n: number | null | undefined): string {
  if (!n) return "Every Week";
  return { 1:"Week 1", 2:"Week 2", 3:"Week 3", 4:"Week 4", 5:"Last Week" }[n] ?? "Every Week";
}

function ordinal(n: number) {
  if (n === 5) return "Last";
  return n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`;
}

function scheduleSummary(c: ServiceContract): string {
  const t = c.startTime ? ` at ${c.startTime}` : "";
  switch (c.frequency) {
    case "Daily":       return `Daily${t}`;
    case "2 x a week":  return `${c.dayOfWeek ?? "?"} & ${c.secondDayOfWeek ?? "?"}${t}`;
    case "Weekly":      return `Every ${c.dayOfWeek ?? "?"}${t}`;
    case "Twice a month": {
      const a = `${ordinal(c.weekOfMonth ?? 1)} ${c.dayOfWeek ?? ""}${c.startTime ? " at "+c.startTime : ""}`;
      const b = `${ordinal(c.secondWeekOfMonth ?? 3)} ${c.secondDayOfWeek ?? ""}${c.secondStartTime ? " at "+c.secondStartTime : ""}`;
      return `${a} and ${b}`;
    }
    case "Monthly": case "Every 2 months": case "Quarterly": case "Every 6 months": {
      const tag = c.frequency === "Monthly" ? "" :
        c.frequency === "Every 2 months" ? " (2-monthly)" :
        c.frequency === "Quarterly" ? " (quarterly)" : " (6-monthly)";
      return `${ordinal(c.weekOfMonth ?? 1)} ${c.dayOfWeek ?? ""}${t}${tag}`;
    }
    case "Annually":
      return `${MONTHS[(c.annualMonth ?? 1)-1]} — ${ordinal(c.weekOfMonth ?? 1)} ${c.dayOfWeek ?? ""}${t}`;
    case "Once-off":
      return c.startDate ? `${format(new Date(c.startDate), "d MMM yyyy")}${t}` : "Once-off";
  }
  return c.frequency;
}

// ── Tab button ────────────────────────────────────────────────────────────────
function Tab({ id, active, icon: Icon, label, count, onClick }: {
  id: TabId; active: boolean; icon: any; label: string; count?: number; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap ${
        active
          ? "border-blue-600 text-blue-700"
          : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
      {count !== undefined && count > 0 && (
        <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${active ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
          {count}
        </span>
      )}
    </button>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Main component
// ════════════════════════════════════════════════════════════════════════════
export default function ServiceContractsPage() {
  const { toast } = useToast();
  const [location, navigate] = useLocation();
  const [tab, setTab] = useState<TabId>("list");
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceContract | null>(null);
  const [form, setForm] = useState<ContractForm>({});
  const [collapsedWeeks, setCollapsedWeeks] = useState<Set<string>>(new Set());
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set());

  // ── Queries ─────────────────────────────────────────────────────────────
  const { data: contracts = [], isLoading } = useQuery<ServiceContract[]>({ queryKey: ["/api/service-contracts"] });
  const { data: departments = [] } = useQuery<Department[]>({ queryKey: ["/api/departments"] });
  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: workers = [] } = useQuery<Worker[]>({ queryKey: ["/api/workers"] });
  const { data: teams = [] } = useQuery<Team[]>({ queryKey: ["/api/teams"] });

  // ── Convert to Contract: read URL params pre-fill ────────────────────────
  useEffect(() => {
    const qs = window.location.search;
    if (!qs) return;
    const p = new URLSearchParams(qs);
    if (!p.get("newContract")) return;

    const prefill: ContractForm = {
      activeStatus: true,
      frequency: "Monthly",
      weekOfMonth: 1,
      dayOfWeek: "Monday",
      startTime: "08:00",
      estimatedDuration: 60,
      isServiceContract: true,
      isRentalContract: false,
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

    setForm(prefill);
    setEditing(null);
    setOpen(true);
    // Remove query params from URL without reload
    window.history.replaceState({}, "", window.location.pathname);
  }, [location]);

  const activeContracts = useMemo(() => contracts.filter(c => c.activeStatus), [contracts]);

  // ── Filtered list ────────────────────────────────────────────────────────
  const filtered = useMemo(() => contracts.filter(c => {
    if (deptFilter !== "all" && c.departmentId !== deptFilter) return false;
    if (statusFilter === "active" && !c.activeStatus) return false;
    if (statusFilter === "inactive" && c.activeStatus) return false;
    if (search && !c.customerName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [contracts, deptFilter, statusFilter, search]);

  // ── Contracts ending soon ────────────────────────────────────────────────
  const endingSoon = useMemo(() => {
    const threshold = 90;
    const today = new Date();
    return activeContracts
      .filter(c => c.endDate)
      .map(c => ({ ...c, daysLeft: differenceInDays(new Date(c.endDate!), today) }))
      .filter(c => c.daysLeft <= threshold)
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [activeContracts]);

  // ── Contracts with upcoming increases ────────────────────────────────────
  const upcomingIncreases = useMemo(() => {
    const today = new Date();
    const soon = addDays(today, 90);
    return activeContracts
      .filter(c => (c as any).increaseDate)
      .map(c => ({ ...c, increaseDate: (c as any).increaseDate as string, increasePercentage: (c as any).increasePercentage as string }))
      .filter(c => {
        try { const d = parseISO(c.increaseDate); return d >= today && d <= soon; } catch { return false; }
      })
      .sort((a, b) => a.increaseDate.localeCompare(b.increaseDate));
  }, [activeContracts]);

  // ── Schedule View grouping ───────────────────────────────────────────────
  const scheduleGrouped = useMemo(() => {
    const map: Record<string, Record<string, ServiceContract[]>> = {};
    WEEK_ORDER_DISPLAY.forEach(w => {
      map[w] = {};
      DAYS.forEach(d => { map[w][d] = []; });
    });

    activeContracts.forEach(c => {
      const freq = c.frequency;
      const isEveryWeek = !c.weekOfMonth || freq === "Daily" || freq === "Weekly" || freq === "2 x a week";
      const week = isEveryWeek ? "Every Week" : weekLabel(c.weekOfMonth);
      const day = c.dayOfWeek ?? "Monday";
      map[week]?.[day]?.push(c);

      // "Twice a month" — also add second occurrence
      if (freq === "Twice a month" && c.secondWeekOfMonth && c.secondDayOfWeek) {
        const w2 = weekLabel(c.secondWeekOfMonth);
        const d2 = c.secondDayOfWeek;
        map[w2]?.[d2]?.push(c);
      }
      // "2 x a week" — also add second day
      if (freq === "2 x a week" && c.secondDayOfWeek) {
        map["Every Week"]?.[c.secondDayOfWeek]?.push(c);
      }
    });

    // Sort within each day slot by startTime then routeOrder
    Object.values(map).forEach(days =>
      Object.values(days).forEach(arr =>
        arr.sort((a, b) => {
          const ta = a.startTime ?? "99:99";
          const tb = b.startTime ?? "99:99";
          if (ta !== tb) return ta.localeCompare(tb);
          return ((a as any).routeOrder ?? 999) - ((b as any).routeOrder ?? 999);
        })
      )
    );
    return map;
  }, [activeContracts]);

  const scheduleWeeks = useMemo(() =>
    WEEK_ORDER_DISPLAY.filter(w =>
      Object.values(scheduleGrouped[w] ?? {}).some(arr => arr.length > 0)
    ), [scheduleGrouped]
  );

  // ── Mutations ────────────────────────────────────────────────────────────
  const save = useMutation({
    mutationFn: async () => {
      const payload: any = { ...form };
      if (payload.startDate instanceof Date) payload.startDate = payload.startDate.toISOString();
      if (payload.endDate instanceof Date) payload.endDate = payload.endDate.toISOString();
      if (payload.startDate === "") payload.startDate = null;
      if (payload.endDate === "") payload.endDate = null;
      const url = editing ? `/api/service-contracts/${editing.id}` : "/api/service-contracts";
      const r = await apiRequest(editing ? "PUT" : "POST", url, payload);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-contracts"] });
      setOpen(false); setEditing(null); setForm({});
      toast({ title: editing ? "Contract updated" : "Contract created" });
    },
    onError: (err: any) => toast({ title: "Save failed", description: err?.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/service-contracts/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/service-contracts"] }); toast({ title: "Contract deleted" }); },
  });

  const toggleActive = useMutation({
    mutationFn: async (c: ServiceContract) => apiRequest("PUT", `/api/service-contracts/${c.id}`, { activeStatus: !c.activeStatus }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/service-contracts"] }),
  });

  // ── Form helpers ──────────────────────────────────────────────────────────
  const openNew = (init: Partial<ContractForm> = {}) => {
    setEditing(null);
    setForm({ activeStatus: true, frequency: "Monthly", weekOfMonth: 1, dayOfWeek: "Monday", startTime: "08:00", estimatedDuration: 60, isServiceContract: true, isRentalContract: false, ...init });
    setOpen(true);
  };

  const openEdit = (c: ServiceContract) => {
    setEditing(c);
    setForm({
      ...c,
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
  const show = {
    endDate:        freq !== "Once-off",
    weekOfMonth:    ["Monthly","Twice a month","Every 2 months","Quarterly","Every 6 months","Annually"].includes(freq),
    dayOfWeek:      !["Daily","Once-off"].includes(freq),
    secondDayOfWeek: freq === "2 x a week",
    twiceMonth:     freq === "Twice a month",
    annualMonth:    freq === "Annually",
  };
  const startRequired = ["Once-off","Every 2 months","Quarterly","Every 6 months","Annually"].includes(freq);
  const startLabel = freq === "Once-off" ? "Date *" : startRequired ? "Start Date *" : "Start Date";

  function toggleWeek(k: string) { setCollapsedWeeks(p => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; }); }
  function toggleDay(k: string)  { setCollapsedDays(p => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; }); }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Contracts" />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-20 lg:pb-6 space-y-4">

          {/* ── Tabs ── */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex overflow-x-auto border-b border-gray-200 px-2">
              <Tab id="list"     active={tab==="list"}     icon={LayoutList}   label="Contract List"     count={filtered.length}    onClick={() => setTab("list")} />
              <Tab id="schedule" active={tab==="schedule"} icon={CalendarDays} label="Schedule View"     count={activeContracts.length} onClick={() => setTab("schedule")} />
              <Tab id="ending"   active={tab==="ending"}   icon={AlertTriangle} label="Contracts Ending" count={endingSoon.length}   onClick={() => setTab("ending")} />
              <Tab id="increases" active={tab==="increases"} icon={TrendingUp}  label="Increase Dates"  count={upcomingIncreases.length} onClick={() => setTab("increases")} />
            </div>

            {/* ══ CONTRACT LIST TAB ══════════════════════════════════════════ */}
            {tab === "list" && (
              <div className="p-4 space-y-3">
                {/* Filters + Add button */}
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                  <div className="flex flex-wrap gap-2 items-center">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                      <Input placeholder="Search client…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 w-52 text-sm" />
                    </div>
                    <Select value={deptFilter} onValueChange={setDeptFilter}>
                      <SelectTrigger className="h-9 w-40 text-sm"><SelectValue placeholder="Department" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All departments</SelectItem>
                        {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="h-9 w-32 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="active">Active only</SelectItem>
                        <SelectItem value="inactive">Inactive only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={() => openNew()} className="h-9 gap-1 text-sm self-start sm:self-auto">
                    <Plus className="h-4 w-4" />New Contract
                  </Button>
                </div>

                {/* Table */}
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-left">
                      <tr className="border-b">
                        <th className="px-3 py-2 font-semibold text-xs uppercase tracking-wide text-gray-500">Client</th>
                        <th className="px-3 py-2 font-semibold text-xs uppercase tracking-wide text-gray-500">Service</th>
                        <th className="px-3 py-2 font-semibold text-xs uppercase tracking-wide text-gray-500 hidden sm:table-cell">Frequency</th>
                        <th className="px-3 py-2 font-semibold text-xs uppercase tracking-wide text-gray-500 hidden md:table-cell">Schedule</th>
                        <th className="px-3 py-2 font-semibold text-xs uppercase tracking-wide text-gray-500 hidden lg:table-cell">Team / Tech</th>
                        <th className="px-3 py-2 font-semibold text-xs uppercase tracking-wide text-gray-500 hidden md:table-cell">Price</th>
                        <th className="px-3 py-2 font-semibold text-xs uppercase tracking-wide text-gray-500">Active</th>
                        <th className="px-3 py-2 font-semibold text-xs uppercase tracking-wide text-gray-500 text-right">Actions</th>
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
                            <td className="px-3 py-2.5 text-gray-700">{c.serviceType}</td>
                            <td className="px-3 py-2.5 hidden sm:table-cell">
                              <Badge variant="outline" className="text-xs">{c.frequency}</Badge>
                            </td>
                            <td className="px-3 py-2.5 hidden md:table-cell text-gray-600 text-xs">{scheduleSummary(c)}</td>
                            <td className="px-3 py-2.5 hidden lg:table-cell text-gray-600 text-xs">{assigned}</td>
                            <td className="px-3 py-2.5 hidden md:table-cell text-gray-700 text-xs">
                              {(c as any).contractPrice ? `R ${(c as any).contractPrice}` : "—"}
                            </td>
                            <td className="px-3 py-2.5">
                              <Switch checked={!!c.activeStatus} onCheckedChange={() => toggleActive.mutate(c)} />
                            </td>
                            <td className="px-3 py-2.5 text-right whitespace-nowrap">
                              <Button size="sm" variant="ghost" onClick={() => openEdit(c)} title="Edit contract">
                                <Pencil className="h-4 w-4" />
                              </Button>
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

            {/* ══ SCHEDULE VIEW TAB ══════════════════════════════════════════ */}
            {tab === "schedule" && (
              <div className="p-4 space-y-3">
                <p className="text-sm text-gray-500">
                  Active contracts grouped by week, day, time, and route order. Click <strong>Edit</strong> to open the contract.
                </p>

                {scheduleWeeks.length === 0 && (
                  <div className="text-center py-12 text-gray-400">
                    No active contracts to display. Create a contract to see it here.
                  </div>
                )}

                {scheduleWeeks.map(week => {
                  const wKey = `w:${week}`;
                  const wCollapsed = collapsedWeeks.has(wKey);
                  const weekDays = DAYS.filter(d => (scheduleGrouped[week]?.[d]?.length ?? 0) > 0);
                  const weekTotal = weekDays.reduce((s, d) => s + (scheduleGrouped[week]?.[d]?.length ?? 0), 0);

                  return (
                    <div key={week} className="border border-gray-200 rounded-xl overflow-hidden">
                      <button
                        onClick={() => toggleWeek(wKey)}
                        className="w-full flex items-center gap-3 px-4 py-3 bg-blue-50 hover:bg-blue-100 transition text-left"
                      >
                        {wCollapsed ? <ChevronRight className="h-4 w-4 text-blue-400" /> : <ChevronDown className="h-4 w-4 text-blue-400" />}
                        <span className="font-bold text-blue-900">{week}</span>
                        <span className="text-xs text-blue-600">{weekTotal} contract{weekTotal !== 1 ? "s" : ""}</span>
                      </button>

                      {!wCollapsed && weekDays.map(day => {
                        const dKey = `d:${week}:${day}`;
                        const dCollapsed = collapsedDays.has(dKey);
                        const dayContracts = scheduleGrouped[week]?.[day] ?? [];

                        return (
                          <div key={day} className="border-t border-gray-100">
                            <button
                              onClick={() => toggleDay(dKey)}
                              className="w-full flex items-center gap-3 px-6 py-2.5 bg-gray-50 hover:bg-gray-100 transition text-left"
                            >
                              {dCollapsed ? <ChevronRight className="h-3.5 w-3.5 text-gray-400" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-400" />}
                              <span className="font-semibold text-gray-700 text-sm">{day}</span>
                              <span className="text-xs text-gray-400">{dayContracts.length}</span>
                            </button>

                            {!dCollapsed && (
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <tbody>
                                    {dayContracts.map((c, idx) => (
                                      <tr key={`${c.id}-${idx}`} className="border-t border-gray-50 hover:bg-blue-50/30 transition">
                                        <td className="px-4 pl-10 py-2.5 font-bold text-gray-400 tabular-nums w-10 text-sm">
                                          {(c as any).routeOrder ?? idx + 1}
                                        </td>
                                        <td className="px-3 py-2.5 font-mono text-xs text-gray-500 whitespace-nowrap w-16">
                                          {c.startTime ?? "—"}
                                        </td>
                                        <td className="px-3 py-2.5">
                                          <div className="font-semibold text-gray-900">{c.customerName}</div>
                                          {c.address && <div className="text-xs text-gray-400 truncate max-w-[200px]">{c.address}</div>}
                                        </td>
                                        <td className="px-3 py-2.5 hidden sm:table-cell">
                                          <Badge variant="outline" className="text-[11px]">{c.serviceType}</Badge>
                                        </td>
                                        <td className="px-3 py-2.5 hidden lg:table-cell text-xs text-gray-600 whitespace-nowrap">
                                          {c.frequency}
                                        </td>
                                        <td className="px-3 py-2.5 hidden lg:table-cell text-xs text-gray-600">
                                          {c.assignedTeamName ?? c.assignedTechnicianName ?? "—"}
                                        </td>
                                        <td className="px-3 py-2.5 text-right">
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

            {/* ══ CONTRACTS ENDING TAB ══════════════════════════════════════ */}
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
                            <td className="px-3 py-2.5 font-medium text-gray-900">{c.customerName}</td>
                            <td className="px-3 py-2.5 text-gray-600">{c.serviceType}</td>
                            <td className="px-3 py-2.5 text-gray-600">{format(new Date(c.endDate!), "d MMM yyyy")}</td>
                            <td className="px-3 py-2.5">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                c.daysLeft <= 14 ? "bg-red-100 text-red-700" :
                                c.daysLeft <= 30 ? "bg-amber-100 text-amber-700" :
                                "bg-yellow-50 text-yellow-700"
                              }`}>
                                {c.daysLeft <= 0 ? "Expired" : `${c.daysLeft} days`}
                              </span>
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

            {/* ══ INCREASE DATES TAB ════════════════════════════════════════ */}
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
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Client</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Service</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Current Price</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Increase %</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Increase Date</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {upcomingIncreases.map(c => (
                          <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="px-3 py-2.5 font-medium text-gray-900">{c.customerName}</td>
                            <td className="px-3 py-2.5 text-gray-600">{c.serviceType}</td>
                            <td className="px-3 py-2.5 text-gray-600">
                              {c.contractPrice ? `R ${c.contractPrice}` : "—"}
                            </td>
                            <td className="px-3 py-2.5">
                              {c.increasePercentage ? (
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                                  +{c.increasePercentage}%
                                </span>
                              ) : "—"}
                            </td>
                            <td className="px-3 py-2.5 text-gray-600">
                              {(() => { try { return format(parseISO(c.increaseDate), "d MMM yyyy"); } catch { return c.increaseDate; } })()}
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
          </div>
        </main>
      </div>

      <MobileNavigation />

      {/* ════════════════════════════════════════════════════════════════════
          Contract Form Dialog
      ════════════════════════════════════════════════════════════════════ */}
      <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) { setEditing(null); setForm({}); } }}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Contract" : "New Contract"}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 py-2">

            {/* ── Service Frequency ── */}
            <div>
              <Label>Frequency *</Label>
              <Select value={freq} onValueChange={v => setForm(f => ({ ...f, frequency: v }))}>
                <SelectTrigger><SelectValue placeholder="How often" /></SelectTrigger>
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

            <div className="col-span-2 border-t pt-1" />

            {/* ── Client / Service / Dept ── */}
            <div>
              <Label>Client *</Label>
              <Select value={form.customerId || ""} onValueChange={setCustomer}>
                <SelectTrigger><SelectValue placeholder="Choose client" /></SelectTrigger>
                <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
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

            {/* ── Dates ── */}
            <div>
              <Label>{startLabel}</Label>
              <Input type="date" value={(form.startDate as string) ?? ""} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
            </div>
            {show.endDate && (
              <div>
                <Label>End Date</Label>
                <Input type="date" value={(form.endDate as string) ?? ""} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
              </div>
            )}

            {/* ── Scheduling fields ── */}
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

            {show.secondDayOfWeek && !show.twiceMonth && (
              <div>
                <Label>Second Day *</Label>
                <Select value={form.secondDayOfWeek ?? ""} onValueChange={v => setForm(f => ({ ...f, secondDayOfWeek: v }))}>
                  <SelectTrigger><SelectValue placeholder="Choose day" /></SelectTrigger>
                  <SelectContent>{DAYS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}

            {/* Twice a month — first + second occurrence */}
            {show.twiceMonth && (
              <>
                <div className="col-span-2">
                  <p className="text-xs font-semibold text-gray-500 mb-2">First visit</p>
                  <div className="grid grid-cols-3 gap-2">
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
                </div>
                <div className="col-span-2">
                  <p className="text-xs font-semibold text-gray-500 mb-2">Second visit</p>
                  <div className="grid grid-cols-3 gap-2">
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
                </div>
              </>
            )}

            {/* Time + Duration (not shown for Twice a month — handled inline above) */}
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

            {/* Route order */}
            <div>
              <Label>Route Order</Label>
              <Input type="number" min={1} value={(form as any).routeOrder ?? ""} onChange={e => setForm(f => ({ ...f, routeOrder: e.target.value ? parseInt(e.target.value) : null } as any))} placeholder="Auto" />
            </div>

            {/* ── Pricing ── */}
            <div className="col-span-2 border-t pt-2" />

            <div>
              <Label>Contract Price (R)</Label>
              <Input value={(form as any).contractPrice ?? ""} onChange={e => setForm(f => ({ ...f, contractPrice: e.target.value } as any))} placeholder="e.g. 850.00" />
            </div>
            <div>
              <Label>Increase Date</Label>
              <Input type="date" value={(form as any).increaseDate ?? ""} onChange={e => setForm(f => ({ ...f, increaseDate: e.target.value } as any))} />
            </div>
            <div>
              <Label>Increase %</Label>
              <Input value={(form as any).increasePercentage ?? ""} onChange={e => setForm(f => ({ ...f, increasePercentage: e.target.value } as any))} placeholder="e.g. 10" />
            </div>
            <div className="flex flex-col gap-2 justify-end pb-1">
              <div className="flex items-center gap-2">
                <Switch checked={(form as any).isServiceContract !== false} onCheckedChange={v => setForm(f => ({ ...f, isServiceContract: v } as any))} />
                <Label className="font-normal cursor-pointer">Service Contract</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={!!(form as any).isRentalContract} onCheckedChange={v => setForm(f => ({ ...f, isRentalContract: v } as any))} />
                <Label className="font-normal cursor-pointer">Rental Contract</Label>
              </div>
            </div>

            {/* ── Other ── */}
            <div className="col-span-2">
              <Label>Google Maps Link</Label>
              <Input value={form.googleMapsLink ?? ""} onChange={e => setForm(f => ({ ...f, googleMapsLink: e.target.value }))} placeholder="https://maps.google.com/…" />
            </div>
            <div className="col-span-2">
              <Label>Notes</Label>
              <Textarea rows={2} value={form.notes ?? ""} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>

            <div className="col-span-2 flex items-center gap-2">
              <Switch checked={form.activeStatus !== false} onCheckedChange={v => setForm(f => ({ ...f, activeStatus: v }))} />
              <span className="text-sm">Active</span>
              <span className="text-xs text-gray-400">(inactive contracts don't appear on the calendar)</span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={() => save.mutate()}
              disabled={save.isPending || !form.customerId || !form.serviceType || !form.departmentId || !form.frequency || (startRequired && !form.startDate)}
            >
              {save.isPending ? "Saving…" : (editing ? "Save Changes" : "Create Contract")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
