import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import MobileNavigation from "@/components/layout/mobile-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  MapPin, Plus, Pencil, ArrowUp, ArrowDown, EyeOff, Eye,
  ChevronDown, ChevronRight, ExternalLink, ClipboardList, Search,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  SERVICE_SCHEDULE_SERVICE_TYPES,
  SERVICE_SCHEDULE_DAYS,
  type ServiceScheduleEntry,
  type InsertServiceScheduleEntry,
} from "@shared/schema";

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
  "Weekly", "Fortnightly", "Monthly", "Twice a month",
  "Every 2 months", "Quarterly", "Every 6 months", "Annually", "Once-off", "Daily",
];

const empty: InsertServiceScheduleEntry = {
  clientName: "",
  address: "",
  suburb: "",
  serviceType: "sanitary_bins",
  frequency: "Monthly",
  assignedTeam: "",
  serviceTime: "",
  dayOfWeek: "Monday",
  routeOrder: 1,
  contractStatus: "active",
  jobStatus: "",
  googleMapsLink: "",
  notes: "",
  isActive: true,
};

export default function ServiceScheduling() {
  const { toast } = useToast();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");
  const [searchQ, setSearchQ] = useState("");
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set());

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceScheduleEntry | null>(null);
  const [form, setForm] = useState<InsertServiceScheduleEntry>(empty);

  const [deactivateTarget, setDeactivateTarget] = useState<ServiceScheduleEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ServiceScheduleEntry | null>(null);

  const { data: entries = [], isLoading } = useQuery<ServiceScheduleEntry[]>({
    queryKey: ["/api/service-schedule"],
  });

  const saveMutation = useMutation({
    mutationFn: (data: { id?: string; body: InsertServiceScheduleEntry }) =>
      data.id
        ? apiRequest("PUT", `/api/service-schedule/${data.id}`, data.body)
        : apiRequest("POST", "/api/service-schedule", data.body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-schedule"] });
      setDialogOpen(false);
      toast({ title: editing ? "Entry updated" : "Entry added" });
    },
    onError: () => toast({ title: "Error", description: "Failed to save entry.", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/service-schedule/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-schedule"] });
      setDeleteTarget(null);
      toast({ title: "Entry removed" });
    },
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, routeOrder }: { id: string; routeOrder: number }) =>
      apiRequest("PUT", `/api/service-schedule/${id}`, { routeOrder }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/service-schedule"] }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiRequest("PUT", `/api/service-schedule/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-schedule"] });
      setDeactivateTarget(null);
      toast({ title: deactivateTarget?.isActive ? "Entry deactivated" : "Entry activated" });
    },
  });

  function openAdd() {
    setEditing(null);
    setForm({ ...empty });
    setDialogOpen(true);
  }

  function openEdit(e: ServiceScheduleEntry) {
    setEditing(e);
    setForm({
      clientId: e.clientId ?? undefined,
      clientName: e.clientName,
      address: e.address ?? "",
      suburb: e.suburb ?? "",
      serviceType: e.serviceType,
      frequency: e.frequency ?? "",
      assignedTeam: e.assignedTeam ?? "",
      serviceTime: e.serviceTime ?? "",
      dayOfWeek: e.dayOfWeek,
      routeOrder: e.routeOrder,
      contractStatus: e.contractStatus ?? "active",
      jobStatus: e.jobStatus ?? "",
      googleMapsLink: e.googleMapsLink ?? "",
      notes: e.notes ?? "",
      isActive: e.isActive,
    });
    setDialogOpen(true);
  }

  function handleSave() {
    if (!form.clientName.trim() || !form.dayOfWeek) {
      toast({ title: "Client name and day are required.", variant: "destructive" });
      return;
    }
    saveMutation.mutate({ id: editing?.id, body: form });
  }

  function handleMove(entry: ServiceScheduleEntry, direction: "up" | "down") {
    const sameDay = entries
      .filter(e => e.dayOfWeek === entry.dayOfWeek && e.isActive)
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

  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      const typeOk = filterType === "all" || e.serviceType === filterType;
      const q = searchQ.toLowerCase();
      const searchOk = !q
        || e.clientName.toLowerCase().includes(q)
        || (e.address ?? "").toLowerCase().includes(q)
        || (e.suburb ?? "").toLowerCase().includes(q)
        || (e.assignedTeam ?? "").toLowerCase().includes(q);
      return typeOk && searchOk;
    });
  }, [entries, filterType, searchQ]);

  const grouped = useMemo(() => {
    const map: Record<string, ServiceScheduleEntry[]> = {};
    SERVICE_SCHEDULE_DAYS.forEach(d => { map[d] = []; });
    filteredEntries.forEach(e => {
      if (map[e.dayOfWeek]) map[e.dayOfWeek].push(e);
    });
    Object.values(map).forEach(arr => arr.sort((a, b) => a.routeOrder - b.routeOrder));
    return map;
  }, [filteredEntries]);

  const totalActive = entries.filter(e => e.isActive).length;
  const totalInactive = entries.filter(e => !e.isActive).length;

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

            {/* Top bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-blue-600" />
                  Service Scheduling
                </h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  {totalActive} active · {totalInactive} inactive · grouped by day, ordered by route
                </p>
              </div>
              <Button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700 text-white gap-2 self-start sm:self-auto">
                <Plus className="h-4 w-4" /> Add Entry
              </Button>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl border border-gray-200 p-3 flex flex-col sm:flex-row gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search client, address, suburb, team…"
                  value={searchQ}
                  onChange={e => setSearchQ(e.target.value)}
                  className="pl-9 text-sm"
                />
              </div>

              {/* Service type filter pills */}
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
                </button>
                {SERVICE_SCHEDULE_SERVICE_TYPES.map(t => (
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
                  </button>
                ))}
              </div>
            </div>

            {/* Day groups */}
            {isLoading ? (
              <div className="text-center py-12 text-gray-400">Loading schedule…</div>
            ) : (
              SERVICE_SCHEDULE_DAYS.map(day => {
                const dayEntries = grouped[day] ?? [];
                const collapsed = collapsedDays.has(day);
                const activeCount  = dayEntries.filter(e => e.isActive).length;
                const inactiveCount = dayEntries.filter(e => !e.isActive).length;

                return (
                  <div key={day} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    {/* Day header */}
                    <button
                      onClick={() => toggleDay(day)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200 hover:bg-gray-100 transition"
                    >
                      <div className="flex items-center gap-3">
                        {collapsed ? <ChevronRight className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                        <span className="font-bold text-gray-900 text-sm">{day}</span>
                        <span className="text-xs text-gray-500">
                          {activeCount} active{inactiveCount > 0 ? ` · ${inactiveCount} inactive` : ""}
                        </span>
                      </div>
                      {dayEntries.length === 0 && (
                        <span className="text-xs text-gray-400 italic">No entries</span>
                      )}
                    </button>

                    {/* Entries table */}
                    {!collapsed && dayEntries.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-100 bg-white">
                              <th className="text-left px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide w-10">#</th>
                              <th className="text-left px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Client</th>
                              <th className="text-left px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide hidden md:table-cell">Address / Suburb</th>
                              <th className="text-left px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Service Type</th>
                              <th className="text-left px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide hidden lg:table-cell">Frequency</th>
                              <th className="text-left px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide hidden lg:table-cell">Team</th>
                              <th className="text-left px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide hidden sm:table-cell">Time</th>
                              <th className="text-left px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide hidden md:table-cell">Contract</th>
                              <th className="text-left px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide hidden md:table-cell">Job Status</th>
                              <th className="text-right px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dayEntries.map((entry, idx) => (
                              <tr
                                key={entry.id}
                                className={`border-b border-gray-50 hover:bg-blue-50/30 transition ${!entry.isActive ? "opacity-50" : ""}`}
                              >
                                {/* Route order */}
                                <td className="px-3 py-2.5 font-bold text-gray-500 text-sm w-10">
                                  {entry.routeOrder}
                                </td>

                                {/* Client name */}
                                <td className="px-3 py-2.5">
                                  <div className="font-semibold text-gray-900 leading-tight">{entry.clientName}</div>
                                  {entry.notes && (
                                    <div className="text-[11px] text-gray-400 mt-0.5 truncate max-w-[160px]">{entry.notes}</div>
                                  )}
                                </td>

                                {/* Address */}
                                <td className="px-3 py-2.5 hidden md:table-cell text-gray-600 text-xs">
                                  <div>{entry.address ?? "—"}</div>
                                  {entry.suburb && <div className="text-gray-400">{entry.suburb}</div>}
                                </td>

                                {/* Service type */}
                                <td className="px-3 py-2.5">
                                  <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full border ${SERVICE_TYPE_COLORS[entry.serviceType] ?? SERVICE_TYPE_COLORS.other}`}>
                                    {SERVICE_TYPE_MAP[entry.serviceType] ?? entry.serviceType}
                                  </span>
                                </td>

                                {/* Frequency */}
                                <td className="px-3 py-2.5 hidden lg:table-cell text-xs text-gray-600">
                                  {entry.frequency ?? "—"}
                                </td>

                                {/* Team */}
                                <td className="px-3 py-2.5 hidden lg:table-cell text-xs text-gray-600">
                                  {entry.assignedTeam ?? "—"}
                                </td>

                                {/* Time */}
                                <td className="px-3 py-2.5 hidden sm:table-cell text-xs text-gray-600 font-mono">
                                  {entry.serviceTime ?? "—"}
                                </td>

                                {/* Contract status */}
                                <td className="px-3 py-2.5 hidden md:table-cell">
                                  {entry.contractStatus ? (
                                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${CONTRACT_STATUS_COLORS[entry.contractStatus] ?? "bg-gray-100 text-gray-600"}`}>
                                      {entry.contractStatus}
                                    </span>
                                  ) : "—"}
                                </td>

                                {/* Job status */}
                                <td className="px-3 py-2.5 hidden md:table-cell text-xs text-gray-500">
                                  {entry.jobStatus ?? "—"}
                                </td>

                                {/* Actions */}
                                <td className="px-3 py-2.5">
                                  <div className="flex items-center justify-end gap-1">
                                    {/* Move up */}
                                    <button
                                      onClick={() => handleMove(entry, "up")}
                                      disabled={idx === 0 || moveMutation.isPending}
                                      className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 disabled:opacity-30 transition"
                                      title="Move up"
                                    >
                                      <ArrowUp className="h-3.5 w-3.5" />
                                    </button>
                                    {/* Move down */}
                                    <button
                                      onClick={() => handleMove(entry, "down")}
                                      disabled={idx === dayEntries.filter(e => e.isActive).length - 1 || moveMutation.isPending}
                                      className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 disabled:opacity-30 transition"
                                      title="Move down"
                                    >
                                      <ArrowDown className="h-3.5 w-3.5" />
                                    </button>
                                    {/* Edit */}
                                    <button
                                      onClick={() => openEdit(entry)}
                                      className="p-1 rounded hover:bg-blue-100 text-blue-500 hover:text-blue-700 transition"
                                      title="Edit"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    {/* Google Maps */}
                                    {entry.googleMapsLink && (
                                      <a
                                        href={entry.googleMapsLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-1 rounded hover:bg-emerald-100 text-emerald-500 hover:text-emerald-700 transition"
                                        title="Open in Google Maps"
                                      >
                                        <MapPin className="h-3.5 w-3.5" />
                                      </a>
                                    )}
                                    {/* Activate / Deactivate */}
                                    <button
                                      onClick={() => entry.isActive ? setDeactivateTarget(entry) : toggleActiveMutation.mutate({ id: entry.id, isActive: true })}
                                      className={`p-1 rounded transition ${entry.isActive ? "hover:bg-red-100 text-gray-400 hover:text-red-600" : "hover:bg-emerald-100 text-emerald-500 hover:text-emerald-700"}`}
                                      title={entry.isActive ? "Deactivate" : "Activate"}
                                    >
                                      {entry.isActive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Empty day (not collapsed) */}
                    {!collapsed && dayEntries.length === 0 && (
                      <div className="px-4 py-6 text-center text-sm text-gray-400 italic">
                        No entries for {day}
                        {filterType !== "all" && " with this service type"}.
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

      {/* ── Add / Edit Dialog ─────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Schedule Entry" : "Add Schedule Entry"}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            {/* Client name */}
            <div className="sm:col-span-2">
              <Label htmlFor="ss-clientName">Client Name *</Label>
              <Input
                id="ss-clientName"
                value={form.clientName}
                onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))}
                placeholder="e.g. Acme Corporation"
              />
            </div>

            {/* Address */}
            <div>
              <Label htmlFor="ss-address">Address</Label>
              <Input
                id="ss-address"
                value={form.address ?? ""}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                placeholder="Street address"
              />
            </div>

            {/* Suburb */}
            <div>
              <Label htmlFor="ss-suburb">Suburb</Label>
              <Input
                id="ss-suburb"
                value={form.suburb ?? ""}
                onChange={e => setForm(f => ({ ...f, suburb: e.target.value }))}
                placeholder="Suburb"
              />
            </div>

            {/* Service type */}
            <div>
              <Label>Service Type *</Label>
              <Select value={form.serviceType} onValueChange={v => setForm(f => ({ ...f, serviceType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SERVICE_SCHEDULE_SERVICE_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Frequency */}
            <div>
              <Label>Frequency</Label>
              <Select value={form.frequency ?? ""} onValueChange={v => setForm(f => ({ ...f, frequency: v }))}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {FREQUENCY_OPTIONS.map(o => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Day of week */}
            <div>
              <Label>Service Day *</Label>
              <Select value={form.dayOfWeek} onValueChange={v => setForm(f => ({ ...f, dayOfWeek: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SERVICE_SCHEDULE_DAYS.map(d => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Service time */}
            <div>
              <Label htmlFor="ss-time">Service Time</Label>
              <Input
                id="ss-time"
                type="time"
                value={form.serviceTime ?? ""}
                onChange={e => setForm(f => ({ ...f, serviceTime: e.target.value }))}
              />
            </div>

            {/* Assigned team */}
            <div>
              <Label htmlFor="ss-team">Assigned Team</Label>
              <Input
                id="ss-team"
                value={form.assignedTeam ?? ""}
                onChange={e => setForm(f => ({ ...f, assignedTeam: e.target.value }))}
                placeholder="e.g. Team A"
              />
            </div>

            {/* Route order */}
            <div>
              <Label htmlFor="ss-order">Route Order</Label>
              <Input
                id="ss-order"
                type="number"
                min={1}
                value={form.routeOrder ?? 1}
                onChange={e => setForm(f => ({ ...f, routeOrder: parseInt(e.target.value) || 1 }))}
              />
            </div>

            {/* Contract status */}
            <div>
              <Label>Contract Status</Label>
              <Select value={form.contractStatus ?? "active"} onValueChange={v => setForm(f => ({ ...f, contractStatus: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Job status */}
            <div>
              <Label htmlFor="ss-jobstatus">Job Status</Label>
              <Input
                id="ss-jobstatus"
                value={form.jobStatus ?? ""}
                onChange={e => setForm(f => ({ ...f, jobStatus: e.target.value }))}
                placeholder="e.g. Scheduled"
              />
            </div>

            {/* Google Maps link */}
            <div className="sm:col-span-2">
              <Label htmlFor="ss-maps">Google Maps Link</Label>
              <Input
                id="ss-maps"
                value={form.googleMapsLink ?? ""}
                onChange={e => setForm(f => ({ ...f, googleMapsLink: e.target.value }))}
                placeholder="https://maps.google.com/…"
              />
            </div>

            {/* Notes */}
            <div className="sm:col-span-2">
              <Label htmlFor="ss-notes">Notes</Label>
              <Input
                id="ss-notes"
                value={form.notes ?? ""}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Internal notes…"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {saveMutation.isPending ? "Saving…" : editing ? "Save Changes" : "Add Entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Deactivate Confirm ─────────────────────────────────────────── */}
      <AlertDialog open={!!deactivateTarget} onOpenChange={o => { if (!o) setDeactivateTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Deactivate <strong>{deactivateTarget?.clientName}</strong> from the schedule?
              The entry will be hidden from the active route but can be reactivated at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => deactivateTarget && toggleActiveMutation.mutate({ id: deactivateTarget.id, isActive: false })}
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
