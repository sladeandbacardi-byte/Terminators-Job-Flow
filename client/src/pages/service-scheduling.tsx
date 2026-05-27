import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import MobileNavigation from "@/components/layout/mobile-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  MapPin, Plus, Pencil, ArrowUp, ArrowDown, EyeOff, Eye,
  ChevronDown, ChevronRight, ClipboardList, Search, CheckCircle2, XCircle,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  SERVICE_SCHEDULE_SERVICE_TYPES,
  SERVICE_SCHEDULE_DAYS,
  type ServiceScheduleEntry,
  type InsertServiceScheduleEntry,
  type Client,
} from "@shared/schema";

// ── Constants ────────────────────────────────────────────────────────────────

const SERVICE_TYPE_MAP = Object.fromEntries(
  SERVICE_SCHEDULE_SERVICE_TYPES.map(t => [t.value, t.label])
);

const SERVICE_TYPE_COLORS: Record<string, string> = {
  sanitary_bins:     "bg-purple-100 text-purple-800 border-purple-200",
  washroom_contract: "bg-blue-100 text-blue-800 border-blue-200",
  washroom_adhoc:    "bg-sky-100 text-sky-800 border-sky-200",
  dustmats:          "bg-amber-100 text-amber-800 border-amber-200",
  pest_control:      "bg-green-100 text-green-800 border-green-200",
  deep_cleaning:     "bg-orange-100 text-orange-800 border-orange-200",
  other:             "bg-gray-100 text-gray-700 border-gray-200",
};

const CONTRACT_STATUS_COLORS: Record<string, string> = {
  active:    "bg-emerald-100 text-emerald-800",
  inactive:  "bg-gray-100 text-gray-600",
  suspended: "bg-red-100 text-red-700",
  pending:   "bg-amber-100 text-amber-700",
};

const FREQUENCY_OPTIONS = [
  "Daily", "2 x a week", "Weekly", "Twice a month", "Monthly",
  "Every 2 months", "Quarterly", "Every 6 months", "Annually", "Once-off",
];

const DURATION_OPTIONS = [
  { label: "15 min",  value: 15 },
  { label: "30 min",  value: 30 },
  { label: "45 min",  value: 45 },
  { label: "1 hour",  value: 60 },
  { label: "1.5 hrs", value: 90 },
  { label: "2 hrs",   value: 120 },
  { label: "3 hrs",   value: 180 },
  { label: "4 hrs",   value: 240 },
  { label: "Full day",value: 480 },
];

const makeEmpty = (): InsertServiceScheduleEntry => ({
  clientId: undefined,
  clientName: "",
  contractId: undefined,
  contractRef: "",
  address: "",
  suburb: "",
  serviceType: "sanitary_bins",
  frequency: "Monthly",
  assignedTeam: "",
  serviceTime: "",
  estimatedDuration: undefined,
  dayOfWeek: "Monday",
  routeOrder: undefined as any,
  contractStatus: "active",
  jobStatus: "",
  googleMapsLink: "",
  notes: "",
  isActive: true,
});

// ── ServiceContract minimal type ─────────────────────────────────────────────
interface ServiceContract {
  id: string;
  customerId: string;
  customerName: string;
  serviceType: string;
  frequency: string;
  activeStatus: boolean;
}

// ── Client search combobox ───────────────────────────────────────────────────
function ClientSearchInput({
  clients,
  value,
  onChange,
}: {
  clients: Client[];
  value: string;
  onChange: (client: Client | null) => void;
}) {
  const [q, setQ] = useState(value);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setQ(value); }, [value]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = useMemo(() => {
    if (!q.trim()) return clients.slice(0, 30);
    const lo = q.toLowerCase();
    return clients.filter(c => c.name.toLowerCase().includes(lo)).slice(0, 30);
  }, [clients, q]);

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
        <Input
          className="pl-8 text-sm"
          placeholder="Search clients…"
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true); onChange(null); }}
          onFocus={() => setOpen(true)}
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
          {filtered.map(c => (
            <button
              key={c.id}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition"
              onMouseDown={() => {
                setQ(c.name);
                setOpen(false);
                onChange(c);
              }}
            >
              <div className="font-medium text-gray-900">{c.name}</div>
              {(c.suburb || c.address) && (
                <div className="text-xs text-gray-400">{c.suburb ?? c.address}</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function ServiceScheduling() {
  const { toast } = useToast();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");
  const [searchQ, setSearchQ] = useState("");
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set());

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceScheduleEntry | null>(null);
  const [form, setForm] = useState<InsertServiceScheduleEntry>(makeEmpty());

  const [deactivateTarget, setDeactivateTarget] = useState<ServiceScheduleEntry | null>(null);

  // ── Data queries ─────────────────────────────────────────────────────────
  const { data: scheduled = [], isLoading } = useQuery<ServiceScheduleEntry[]>({
    queryKey: ["/api/service-schedule"],
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: allContracts = [] } = useQuery<ServiceContract[]>({
    queryKey: ["/api/service-contracts"],
  });

  // Contracts filtered to the selected client
  const clientContracts = useMemo(() => {
    if (!form.clientId) return [];
    return allContracts.filter(c => c.customerId === form.clientId && c.activeStatus !== false);
  }, [allContracts, form.clientId]);

  // ── Auto route order ──────────────────────────────────────────────────────
  function nextRouteOrder(day: string): number {
    const sameDay = scheduled.filter(e => e.dayOfWeek === day);
    if (!sameDay.length) return 1;
    return Math.max(...sameDay.map(e => e.routeOrder)) + 1;
  }

  // ── Mutations ─────────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: (data: { id?: string; body: InsertServiceScheduleEntry }) =>
      data.id
        ? apiRequest("PUT", `/api/service-schedule/${data.id}`, data.body)
        : apiRequest("POST", "/api/service-schedule", data.body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-schedule"] });
      setDialogOpen(false);
      toast({ title: editing ? "Service updated" : "Service added to schedule" });
    },
    onError: () => toast({ title: "Error", description: "Could not save service.", variant: "destructive" }),
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, routeOrder }: { id: string; routeOrder: number }) =>
      apiRequest("PUT", `/api/service-schedule/${id}`, { routeOrder }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/service-schedule"] }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiRequest("PUT", `/api/service-schedule/${id}`, { isActive }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-schedule"] });
      setDeactivateTarget(null);
      toast({ title: vars.isActive ? "Service activated" : "Service deactivated" });
    },
  });

  // ── Dialog helpers ────────────────────────────────────────────────────────
  function openAdd() {
    setEditing(null);
    setForm(makeEmpty());
    setDialogOpen(true);
  }

  function openEdit(e: ServiceScheduleEntry) {
    setEditing(e);
    setForm({
      clientId:          e.clientId ?? undefined,
      clientName:        e.clientName,
      contractId:        e.contractId ?? undefined,
      contractRef:       e.contractRef ?? "",
      address:           e.address ?? "",
      suburb:            e.suburb ?? "",
      serviceType:       e.serviceType,
      frequency:         e.frequency ?? "Monthly",
      assignedTeam:      e.assignedTeam ?? "",
      serviceTime:       e.serviceTime ?? "",
      estimatedDuration: e.estimatedDuration ?? undefined,
      dayOfWeek:         e.dayOfWeek,
      routeOrder:        e.routeOrder,
      contractStatus:    e.contractStatus ?? "active",
      jobStatus:         e.jobStatus ?? "",
      googleMapsLink:    e.googleMapsLink ?? "",
      notes:             e.notes ?? "",
      isActive:          e.isActive,
    });
    setDialogOpen(true);
  }

  function handleClientSelect(client: Client | null) {
    if (client) {
      setForm(f => ({
        ...f,
        clientId:    client.id,
        clientName:  client.name,
        address:     client.address ?? f.address,
        suburb:      client.suburb ?? f.suburb,
        googleMapsLink: client.googleMapsLink ?? f.googleMapsLink,
        contractId:  undefined,
        contractRef: "",
      }));
    } else {
      setForm(f => ({ ...f, clientId: undefined, contractId: undefined, contractRef: "" }));
    }
  }

  function handleContractSelect(contractId: string) {
    const c = allContracts.find(x => x.id === contractId);
    if (c) {
      setForm(f => ({
        ...f,
        contractId:     c.id,
        contractRef:    `${c.serviceType} — ${c.frequency}`,
        serviceType:    c.serviceType ?? f.serviceType,
        frequency:      c.frequency ?? f.frequency,
        contractStatus: c.activeStatus ? "active" : "inactive",
      }));
    }
  }

  function handleSave() {
    if (!form.clientName.trim()) {
      toast({ title: "Please select a client.", variant: "destructive" });
      return;
    }
    if (!form.dayOfWeek) {
      toast({ title: "Please select a day.", variant: "destructive" });
      return;
    }
    const body = {
      ...form,
      routeOrder: form.routeOrder || nextRouteOrder(form.dayOfWeek),
    };
    saveMutation.mutate({ id: editing?.id, body });
  }

  // ── Move up/down ──────────────────────────────────────────────────────────
  function handleMove(entry: ServiceScheduleEntry, direction: "up" | "down") {
    const sameDay = scheduled
      .filter(e => e.dayOfWeek === entry.dayOfWeek)
      .sort((a, b) => a.routeOrder - b.routeOrder);
    const idx = sameDay.findIndex(e => e.id === entry.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sameDay.length) return;
    const swap = sameDay[swapIdx];
    moveMutation.mutate({ id: entry.id, routeOrder: swap.routeOrder });
    moveMutation.mutate({ id: swap.id, routeOrder: entry.routeOrder });
  }

  function toggleDay(day: string) {
    setCollapsedDays(prev => {
      const next = new Set(prev);
      next.has(day) ? next.delete(day) : next.add(day);
      return next;
    });
  }

  // ── Filtering ─────────────────────────────────────────────────────────────
  const filteredScheduled = useMemo(() => {
    return scheduled.filter(e => {
      const typeOk = filterType === "all" || e.serviceType === filterType;
      const q = searchQ.toLowerCase();
      const searchOk = !q
        || e.clientName.toLowerCase().includes(q)
        || (e.assignedTeam ?? "").toLowerCase().includes(q)
        || (e.address ?? "").toLowerCase().includes(q);
      return typeOk && searchOk;
    });
  }, [scheduled, filterType, searchQ]);

  const grouped = useMemo(() => {
    const map: Record<string, ServiceScheduleEntry[]> = {};
    SERVICE_SCHEDULE_DAYS.forEach(d => { map[d] = []; });
    filteredScheduled.forEach(e => { map[e.dayOfWeek]?.push(e); });
    Object.values(map).forEach(arr => arr.sort((a, b) => a.routeOrder - b.routeOrder));
    return map;
  }, [filteredScheduled]);

  const totalActive = scheduled.filter(e => e.isActive).length;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar />

      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative bg-white w-64 shadow-lg"><Sidebar /></div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Service Scheduling" onMobileMenuToggle={() => setMobileMenuOpen(true)} />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-20 lg:pb-6">
          <div className="max-w-screen-xl mx-auto space-y-4">

            {/* ── Top bar ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-blue-600" />
                  Service Scheduling
                </h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  Schedule recurring contract services by day and route order.
                </p>
              </div>
              <Button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700 text-white gap-2 self-start sm:self-auto">
                <Plus className="h-4 w-4" /> Add Service
              </Button>
            </div>

            {/* ── Filter bar ── */}
            <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by client, team, or address…"
                  value={searchQ}
                  onChange={e => setSearchQ(e.target.value)}
                  className="pl-9 text-sm"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setFilterType("all")}
                  className={`text-xs font-medium px-3 py-1.5 rounded-full border transition ${
                    filterType === "all"
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
                  }`}
                >
                  All Services
                  {totalActive > 0 && (
                    <span className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${filterType === "all" ? "bg-white/25" : "bg-gray-100"}`}>
                      {totalActive}
                    </span>
                  )}
                </button>
                {SERVICE_SCHEDULE_SERVICE_TYPES.map(t => {
                  const count = scheduled.filter(e => e.serviceType === t.value && e.isActive).length;
                  return (
                    <button
                      key={t.value}
                      onClick={() => setFilterType(t.value)}
                      className={`text-xs font-medium px-3 py-1.5 rounded-full border transition ${
                        filterType === t.value
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
                      }`}
                    >
                      {t.label}
                      {count > 0 && (
                        <span className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${filterType === t.value ? "bg-white/25" : "bg-gray-100"}`}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Day groups ── */}
            {isLoading ? (
              <div className="text-center py-16 text-gray-400">Loading schedule…</div>
            ) : (
              SERVICE_SCHEDULE_DAYS.map(day => {
                const dayServices = grouped[day] ?? [];
                const collapsed = collapsedDays.has(day);
                const activeCount = dayServices.filter(e => e.isActive).length;
                const inactiveCount = dayServices.filter(e => !e.isActive).length;

                return (
                  <div key={day} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    {/* Day header */}
                    <button
                      onClick={() => toggleDay(day)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200 hover:bg-gray-100 transition"
                    >
                      <div className="flex items-center gap-3">
                        {collapsed
                          ? <ChevronRight className="h-4 w-4 text-gray-400" />
                          : <ChevronDown className="h-4 w-4 text-gray-400" />}
                        <span className="font-bold text-gray-900">{day}</span>
                        {dayServices.length > 0 && (
                          <span className="text-xs text-gray-500">
                            {activeCount} active
                            {inactiveCount > 0 && ` · ${inactiveCount} inactive`}
                          </span>
                        )}
                      </div>
                      {dayServices.length === 0 && (
                        <span className="text-xs text-gray-400 italic">Nothing scheduled</span>
                      )}
                    </button>

                    {/* Services table */}
                    {!collapsed && dayServices.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-100">
                              <th className="text-left px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide w-10">#</th>
                              <th className="text-left px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Client</th>
                              <th className="text-left px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Service Type</th>
                              <th className="text-left px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide hidden lg:table-cell">Frequency</th>
                              <th className="text-left px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide hidden sm:table-cell">Time</th>
                              <th className="text-left px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide hidden lg:table-cell">Team</th>
                              <th className="text-left px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide hidden md:table-cell">Contract</th>
                              <th className="text-center px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide hidden md:table-cell">Status</th>
                              <th className="text-right px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dayServices.map((svc, idx) => (
                              <tr
                                key={svc.id}
                                className={`border-b border-gray-50 hover:bg-blue-50/30 transition ${!svc.isActive ? "opacity-50" : ""}`}
                              >
                                {/* Route # */}
                                <td className="px-3 py-2.5 font-bold text-gray-500 tabular-nums w-10">
                                  {svc.routeOrder}
                                </td>

                                {/* Client */}
                                <td className="px-3 py-2.5 max-w-[180px]">
                                  <div className="font-semibold text-gray-900 truncate">{svc.clientName}</div>
                                  {svc.suburb && (
                                    <div className="text-[11px] text-gray-400 truncate">{svc.suburb}</div>
                                  )}
                                </td>

                                {/* Service type badge */}
                                <td className="px-3 py-2.5">
                                  <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${SERVICE_TYPE_COLORS[svc.serviceType] ?? SERVICE_TYPE_COLORS.other}`}>
                                    {SERVICE_TYPE_MAP[svc.serviceType] ?? svc.serviceType}
                                  </span>
                                </td>

                                {/* Frequency */}
                                <td className="px-3 py-2.5 hidden lg:table-cell text-xs text-gray-600 whitespace-nowrap">
                                  {svc.frequency ?? "—"}
                                </td>

                                {/* Time */}
                                <td className="px-3 py-2.5 hidden sm:table-cell text-xs text-gray-600 font-mono whitespace-nowrap">
                                  {svc.serviceTime ?? "—"}
                                </td>

                                {/* Team */}
                                <td className="px-3 py-2.5 hidden lg:table-cell text-xs text-gray-600">
                                  {svc.assignedTeam ?? "—"}
                                </td>

                                {/* Contract status */}
                                <td className="px-3 py-2.5 hidden md:table-cell">
                                  {svc.contractStatus ? (
                                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${CONTRACT_STATUS_COLORS[svc.contractStatus] ?? "bg-gray-100 text-gray-600"}`}>
                                      {svc.contractStatus}
                                    </span>
                                  ) : "—"}
                                </td>

                                {/* Active/Inactive */}
                                <td className="px-3 py-2.5 hidden md:table-cell text-center">
                                  {svc.isActive
                                    ? <CheckCircle2 className="h-4 w-4 text-emerald-500 inline" />
                                    : <XCircle className="h-4 w-4 text-gray-400 inline" />}
                                </td>

                                {/* Actions */}
                                <td className="px-3 py-2.5">
                                  <div className="flex items-center justify-end gap-0.5">
                                    <button
                                      onClick={() => handleMove(svc, "up")}
                                      disabled={idx === 0 || moveMutation.isPending}
                                      className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 disabled:opacity-25 transition"
                                      title="Move up"
                                    >
                                      <ArrowUp className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleMove(svc, "down")}
                                      disabled={idx === dayServices.length - 1 || moveMutation.isPending}
                                      className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 disabled:opacity-25 transition"
                                      title="Move down"
                                    >
                                      <ArrowDown className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      onClick={() => openEdit(svc)}
                                      className="p-1.5 rounded hover:bg-blue-100 text-blue-500 hover:text-blue-700 transition"
                                      title="Edit"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    {svc.googleMapsLink && (
                                      <a
                                        href={svc.googleMapsLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-1.5 rounded hover:bg-emerald-100 text-emerald-500 hover:text-emerald-700 transition"
                                        title="Open in Google Maps"
                                      >
                                        <MapPin className="h-3.5 w-3.5" />
                                      </a>
                                    )}
                                    <button
                                      onClick={() =>
                                        svc.isActive
                                          ? setDeactivateTarget(svc)
                                          : toggleActiveMutation.mutate({ id: svc.id, isActive: true })
                                      }
                                      className={`p-1.5 rounded transition ${svc.isActive ? "hover:bg-red-100 text-gray-400 hover:text-red-600" : "hover:bg-emerald-100 text-emerald-500 hover:text-emerald-700"}`}
                                      title={svc.isActive ? "Deactivate" : "Activate"}
                                    >
                                      {svc.isActive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {!collapsed && dayServices.length === 0 && (
                      <div className="px-4 py-8 text-center text-sm text-gray-400">
                        Nothing scheduled for {day}
                        {filterType !== "all" && " with this service type"}.
                        <button
                          onClick={openAdd}
                          className="ml-2 text-blue-500 hover:underline"
                        >
                          Add a service
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}

          </div>
        </main>
      </div>

      <MobileNavigation />

      {/* ══════════════════════════════════════════════════════════════════════
          Add / Edit Dialog
      ══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Scheduled Service" : "Add Service to Schedule"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">

            {/* ── Client ── */}
            <div className="sm:col-span-2">
              <Label>Client *</Label>
              <ClientSearchInput
                clients={clients}
                value={form.clientName}
                onChange={handleClientSelect}
              />
            </div>

            {/* ── Contract ── */}
            <div className="sm:col-span-2">
              <Label>Contract</Label>
              <Select
                value={form.contractId ?? ""}
                onValueChange={handleContractSelect}
                disabled={!form.clientId}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder={form.clientId ? "Select contract…" : "Select a client first"} />
                </SelectTrigger>
                <SelectContent>
                  {clientContracts.length === 0
                    ? <SelectItem value="none" disabled>No contracts found</SelectItem>
                    : clientContracts.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.serviceType} — {c.frequency}
                      </SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
              {form.clientId && clientContracts.length === 0 && (
                <p className="text-[11px] text-amber-600 mt-1">No active contracts found for this client.</p>
              )}
            </div>

            {/* ── Service Type ── */}
            <div>
              <Label>Service Type</Label>
              <Select value={form.serviceType} onValueChange={v => setForm(f => ({ ...f, serviceType: v }))}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SERVICE_SCHEDULE_SERVICE_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ── Frequency ── */}
            <div>
              <Label>Frequency</Label>
              <Select value={form.frequency ?? ""} onValueChange={v => setForm(f => ({ ...f, frequency: v }))}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {FREQUENCY_OPTIONS.map(o => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ── Day ── */}
            <div>
              <Label>Day *</Label>
              <Select value={form.dayOfWeek} onValueChange={v => setForm(f => ({ ...f, dayOfWeek: v }))}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SERVICE_SCHEDULE_DAYS.map(d => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ── Time ── */}
            <div>
              <Label>Time</Label>
              <Input
                type="time"
                value={form.serviceTime ?? ""}
                onChange={e => setForm(f => ({ ...f, serviceTime: e.target.value }))}
                className="text-sm"
              />
            </div>

            {/* ── Estimated Duration ── */}
            <div>
              <Label>Estimated Duration</Label>
              <Select
                value={form.estimatedDuration ? String(form.estimatedDuration) : ""}
                onValueChange={v => setForm(f => ({ ...f, estimatedDuration: v ? parseInt(v) : undefined }))}
              >
                <SelectTrigger className="text-sm"><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map(d => (
                    <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ── Route Order ── */}
            <div>
              <Label>Route Order</Label>
              <Input
                type="number"
                min={1}
                placeholder={`Auto (next: ${nextRouteOrder(form.dayOfWeek)})`}
                value={form.routeOrder || ""}
                onChange={e => setForm(f => ({ ...f, routeOrder: e.target.value ? parseInt(e.target.value) : (undefined as any) }))}
                className="text-sm"
              />
              <p className="text-[11px] text-gray-400 mt-0.5">Leave blank to auto-assign.</p>
            </div>

            {/* ── Assigned Team ── */}
            <div>
              <Label>Assigned Team</Label>
              <Input
                value={form.assignedTeam ?? ""}
                onChange={e => setForm(f => ({ ...f, assignedTeam: e.target.value }))}
                placeholder="e.g. Team A"
                className="text-sm"
              />
            </div>

            {/* ── Notes ── */}
            <div className="sm:col-span-2">
              <Label>Notes</Label>
              <Input
                value={form.notes ?? ""}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Any notes or special instructions…"
                className="text-sm"
              />
            </div>

            {/* ── Active ── */}
            <div className="sm:col-span-2 flex items-center gap-3 pt-1">
              <Switch
                checked={form.isActive ?? true}
                onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))}
              />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {form.isActive ? "Active" : "Inactive"}
                </p>
                <p className="text-xs text-gray-500">
                  {form.isActive ? "This service will appear in the route." : "This service is hidden from the route."}
                </p>
              </div>
            </div>

          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {saveMutation.isPending ? "Saving…" : editing ? "Save Changes" : "Add to Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════════════════════
          Deactivate confirm
      ══════════════════════════════════════════════════════════════════════ */}
      <AlertDialog open={!!deactivateTarget} onOpenChange={o => { if (!o) setDeactivateTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Service</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <strong>{deactivateTarget?.clientName}</strong> ({deactivateTarget?.dayOfWeek}) from the active route?
              You can reactivate it at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() =>
                deactivateTarget &&
                toggleActiveMutation.mutate({ id: deactivateTarget.id, isActive: false })
              }
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
