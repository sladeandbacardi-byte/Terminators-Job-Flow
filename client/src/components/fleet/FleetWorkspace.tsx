import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getDashboardRole } from "@/lib/dashboardRole";
import { useAuth } from "@/hooks/useAuth";
import { useFleetActivity, useFleetData } from "./useFleetData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertTriangle, ChevronDown, ChevronRight, Download, Gauge,
  History as HistoryIcon, Mail, Pencil, Plus, RotateCcw, Settings2, ShieldCheck,
  SlidersHorizontal, Trash2, Truck,
} from "lucide-react";

type Filters = { workerId: string; vehicleId: string; from: string; to: string; includeDeleted?: boolean };
const emptyFilters: Filters = { workerId: "", vehicleId: "", from: "", to: "" };
const historyTabs = [
  ["daily", "Daily Inspections"], ["monthly", "Monthly Inspections"], ["km", "KM Logs"],
  ["fuel", "Fuel Fill-ups"], ["issues", "Issues"], ["maintenance", "Maintenance / Workshop"], ["service", "Service"],
] as const;
const pretty = (value: unknown) => value == null || value === "" ? "—" : String(value).replaceAll("_", " ");
const date = (value: unknown) => value ? new Date(String(value)).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const dateTime = (value: unknown) => value ? new Date(String(value)).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" }) : "—";
const money = (value: unknown) => `R ${Number(value || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const errorText = (error: unknown) => error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : "The request could not be completed.";
const rowDate = (row: any) => row.logDate || row.fillDate || row.inspectionDate || row.reportedAt || row.serviceDate || row.scheduledDate || row.completedAt || row.createdAt;

function FilterBar({ vehicles, workers, filters, setFilters, manager = false }: any) {
  return <div className="flex flex-wrap gap-2 rounded-xl border border-[#d8d2c7] bg-[#fbfaf7] p-3" aria-label="Fleet activity filters">
    <label className="sr-only" htmlFor="fleet-driver">Driver</label>
    <select id="fleet-driver" className="h-9 min-w-36 rounded-md border bg-white px-3 text-sm" value={filters.workerId} onChange={e => setFilters((old: Filters) => ({ ...old, workerId: e.target.value }))}>
      <option value="">All drivers</option>{workers.map((worker: any) => <option key={worker.id} value={worker.id}>{worker.name}</option>)}
    </select>
    <label className="sr-only" htmlFor="fleet-vehicle">Vehicle</label>
    <select id="fleet-vehicle" className="h-9 min-w-36 rounded-md border bg-white px-3 text-sm" value={filters.vehicleId} onChange={e => setFilters((old: Filters) => ({ ...old, vehicleId: e.target.value }))}>
      <option value="">All vehicles</option>{vehicles.map((vehicle: any) => <option key={vehicle.id} value={vehicle.id}>{vehicle.name}</option>)}
    </select>
    <Input aria-label="From date" type="date" className="h-9 w-auto bg-white text-sm" value={filters.from} onChange={e => setFilters((old: Filters) => ({ ...old, from: e.target.value }))} />
    <Input aria-label="To date" type="date" className="h-9 w-auto bg-white text-sm" value={filters.to} onChange={e => setFilters((old: Filters) => ({ ...old, to: e.target.value }))} />
    {manager && <label className="flex items-center gap-2 px-2 text-xs font-semibold"><input type="checkbox" checked={Boolean(filters.includeDeleted)} onChange={e => setFilters((old: Filters) => ({ ...old, includeDeleted: e.target.checked }))} />Show removed</label>}
    <button className="ml-auto px-2 text-xs font-semibold uppercase tracking-wider text-[#6e756d] hover:text-[#171b1a]" onClick={() => setFilters({ ...emptyFilters })}>Clear filters</button>
  </div>;
}

function routeState(location: string) {
  if (location.includes("/vehicles")) return { page: "vehicles", tab: "daily" };
  if (location.includes("/settings")) return { page: "settings", tab: "daily" };
  if (location.includes("/history")) return { page: "history", tab: "daily" };
  if (location.includes("/inspections")) return { page: "history", tab: "daily" };
  if (location.includes("/faults") || location.includes("/issues")) return { page: "history", tab: "issues" };
  if (location.includes("/service-history")) return { page: "history", tab: "service" };
  if (location.includes("/reports") || location.includes("/maintenance")) return { page: "history", tab: "maintenance" };
  return { page: "dashboard", tab: "daily" };
}

export default function FleetWorkspace() {
  const { user } = useAuth();
  const role = getDashboardRole(user ?? {});
  const manager = role === "admin" || role === "manager";
  const { vehicles: vehicleQuery, assignments: assignmentQuery, workers: workerQuery, settings, templates, loading, error } = useFleetData(manager);
  const vehicles = vehicleQuery.data ?? [];
  const assignments = assignmentQuery.data ?? [];
  const workers = workerQuery.data ?? [];
  const [location, navigate] = useLocation();
  const initial = routeState(location);
  const [historyTab, setHistoryTab] = useState(initial.tab);
  const [dashboardFilters, setDashboardFilters] = useState<Filters>({ ...emptyFilters });
  const [historyFilters, setHistoryFilters] = useState<Filters>({ ...emptyFilters });
  const dashboardActivity = useFleetActivity(dashboardFilters);
  const historyActivity = useFleetActivity(historyFilters);
  const [vehicleDialog, setVehicleDialog] = useState(false);
  const [vehicleForm, setVehicleForm] = useState({ name: "", registration: "", make: "", model: "", year: "" });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const state = routeState(location);

  useEffect(() => {
    const routed = routeState(location);
    if (routed.page === "history" && !location.endsWith("/history")) setHistoryTab(routed.tab);
  }, [location]);

  const createVehicle = useMutation({
    mutationFn: () => apiRequest("POST", "/api/fleet/vehicles", { ...vehicleForm, year: Number(vehicleForm.year) || undefined, vehicleStatus: "active", isActive: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fleet/vehicles"] });
      setVehicleDialog(false);
      setVehicleForm({ name: "", registration: "", make: "", model: "", year: "" });
      toast({ title: "Vehicle added" });
    },
    onError: error => toast({ title: "Could not add vehicle", description: errorText(error), variant: "destructive" }),
  });
  const weeklySummary = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/fleet/send-weekly-summary")).json(),
    onSuccess: data => toast({ title: data.message || "Weekly fleet summary queued" }),
    onError: error => toast({ title: "Summary was not queued", description: errorText(error), variant: "destructive" }),
  });

  const names = useMemo(() => ({
    vehicle: (id: string) => vehicles.find((item: any) => item.id === id)?.name ?? id ?? "—",
    worker: (id: string) => workers.find((item: any) => item.id === id)?.name ?? id ?? "—",
  }), [vehicles, workers]);
  const go = (path: string) => navigate(`/fleet${path}`);
  const exportUrl = `/api/fleet/activity.xlsx?${new URLSearchParams(Object.entries(historyFilters).filter(([, value]) => value !== "" && value !== false).map(([key, value]) => [key, String(value)])).toString()}`;

  if (loading) return <div className="min-h-[70vh] p-8"><div className="mx-auto max-w-7xl animate-pulse space-y-4"><div className="h-10 w-72 rounded bg-[#ded9cf]" /><div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[1, 2, 3, 4].map(item => <div key={item} className="h-28 rounded-xl bg-[#e9e5dc]" />)}</div></div></div>;
  if (error) return <div className="m-8 rounded-xl border border-[#e0aaa0] bg-[#fff5f2] p-8 text-center"><AlertTriangle className="mx-auto mb-3 text-[#a33227]" /><h2 className="font-bold">Fleet data unavailable</h2><p className="mb-4 text-sm text-[#6e756d]">{errorText(error)}</p><Button onClick={() => { vehicleQuery.refetch(); assignmentQuery.refetch(); workerQuery.refetch(); }}>Retry</Button></div>;

  const title = state.page === "dashboard" ? "Fleet Dashboard" : state.page === "history" ? "Fleet History" : state.page === "vehicles" ? "Vehicles" : "Fleet Settings";
  return <div className="min-h-[calc(100dvh-4rem)] bg-[#f2efe9] text-[#171b1a]">
    <header className="border-b border-[#d8d2c7] bg-[#f8f6f1] px-4 py-5 md:px-8"><div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-4">
      <div><div className="mb-1 text-[11px] font-bold uppercase tracking-[.22em] text-[#a33227]">Terminators / Fleet</div><h1 className="font-mono text-2xl font-bold tracking-tight">{title}</h1><p className="mt-1 text-sm text-[#6e756d]">{manager ? "Operational overview across every vehicle and driver" : "Assigned fleet activity and safety records"}</p></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => go("/km-log")}><Gauge className="mr-2 h-4 w-4" />Log KM</Button><Button onClick={() => go("/report-issue")} className="bg-[#a33227] hover:bg-[#81251d]"><AlertTriangle className="mr-2 h-4 w-4" />Report Issue</Button></div>
    </div></header>
    <div className="mx-auto flex max-w-7xl flex-wrap gap-6 px-4 py-5 md:flex-nowrap md:px-8">
      <FleetNavigation page={state.page} manager={manager} go={go} />
      <main className="min-w-0 flex-1">
        {state.page === "dashboard" && <Dashboard filters={dashboardFilters} setFilters={setDashboardFilters} activity={dashboardActivity} vehicles={vehicles} workers={workers} assignments={assignments} names={names} navigate={navigate} />}
        {state.page === "history" && <History tab={historyTab} setTab={setHistoryTab} filters={historyFilters} setFilters={setHistoryFilters} vehicles={vehicles} workers={workers} activity={historyActivity} names={names} manager={manager} exportUrl={exportUrl} weeklySummary={weeklySummary} />}
        {state.page === "vehicles" && <Vehicles vehicles={vehicles} manager={manager} onAdd={() => setVehicleDialog(true)} navigate={navigate} />}
        {state.page === "settings" && (manager ? <Settings settingsQuery={settings} templatesQuery={templates} /> : <AccessDenied />)}
      </main>
    </div>
    <Dialog open={vehicleDialog} onOpenChange={setVehicleDialog}><DialogContent><DialogHeader><DialogTitle>Add Vehicle</DialogTitle></DialogHeader><div className="grid gap-3">
      {[["name", "Vehicle name"], ["registration", "Registration"], ["make", "Make"], ["model", "Model"], ["year", "Year"]].map(([key, label]) => <Input key={key} placeholder={label} value={(vehicleForm as any)[key]} onChange={event => setVehicleForm(old => ({ ...old, [key]: event.target.value }))} />)}
      <Button disabled={!vehicleForm.name.trim() || createVehicle.isPending} onClick={() => createVehicle.mutate()} className="bg-[#a33227]">{createVehicle.isPending ? "Saving…" : "Save Vehicle"}</Button>
    </div></DialogContent></Dialog>
  </div>;
}

function FleetNavigation({ page, manager, go }: any) {
  const items = [
    ["", "Dashboard", Gauge], ["/history", "Fleet History", HistoryIcon], ["/vehicles", "Vehicles", Truck],
    ["/report-issue", "Report Issue", AlertTriangle], ...(manager ? [["/settings", "Fleet Settings", Settings2]] : []),
  ] as any[];
  return <><aside className="hidden w-52 shrink-0 space-y-1 md:block">{items.map(([id, label, Icon]) => <button key={label} onClick={() => go(id)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold ${page === (id === "" ? "dashboard" : id.slice(1)) ? "bg-[#171b1a] text-white" : "text-[#59615b] hover:bg-[#e5e1d8]"}`}><Icon className="h-4 w-4" />{label}</button>)}
    <div className="px-3 pt-4 text-[10px] font-bold uppercase tracking-widest text-[#8a8f89]">More</div>{manager && <button onClick={() => go("/settings")} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-[#59615b]"><SlidersHorizontal className="h-4 w-4" />Fleet Settings</button>}
  </aside><nav className="flex w-full gap-1 overflow-x-auto md:hidden">{items.map(([id, label]) => <button key={label} onClick={() => go(id)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold ${page === (id ? id.slice(1) : "dashboard") ? "bg-[#171b1a] text-white" : "bg-[#e5e1d8] text-[#59615b]"}`}>{label}</button>)}</nav></>;
}

function Dashboard({ filters, setFilters, activity, vehicles, workers, assignments, names, navigate }: any) {
  if (activity.isLoading) return <PanelState label="Loading Fleet Dashboard…" />;
  if (activity.error) return <PanelState error={errorText(activity.error)} action={() => activity.refetch()} />;
  const data = activity.data ?? {};
  const km = data.kmLogs ?? [], fuel = data.fuelFillups ?? [], inspections = data.dailyInspections ?? [], issues = data.issues ?? [];
  const businessKm = km.reduce((sum: number, row: any) => sum + Number(row.businessKm || 0), 0);
  const privateKm = km.reduce((sum: number, row: any) => sum + Number(row.privateKm || 0), 0);
  const litres = fuel.reduce((sum: number, row: any) => sum + Number(row.litres || 0), 0);
  const spend = fuel.reduce((sum: number, row: any) => sum + Number(row.cost || 0), 0);
  const openIssues = issues.filter((row: any) => !["completed", "not_required", "closed", "resolved"].includes(row.status));
  return <><FilterBar vehicles={vehicles} workers={workers} filters={filters} setFilters={setFilters} /><div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
    <Metric label="Business KM" value={businessKm.toLocaleString()} tone="green" /><Metric label="Private KM" value={privateKm.toLocaleString()} /><Metric label="Fuel / Spend" value={`${litres.toFixed(1)} L`} detail={money(spend)} tone="amber" /><Metric label="Open Issues" value={openIssues.length} tone="red" />
  </div><div className="mt-4 grid gap-4 lg:grid-cols-[1.35fr_1fr]"><section className="overflow-hidden rounded-xl border border-[#d8d2c7] bg-[#fbfaf7]"><div className="border-b p-4"><h2 className="font-bold">Vehicle Pulse</h2><p className="text-xs text-[#6e756d]">Current operational state from filtered activity</p></div>
    <div className="divide-y">{vehicles.map((vehicle: any) => { const issueCount = openIssues.filter((item: any) => item.vehicleId === vehicle.id).length; const assignment = assignments.find((item: any) => item.vehicleId === vehicle.id && item.isActive); return <button key={vehicle.id} onClick={() => navigate(`/fleet/vehicles/${vehicle.id}`)} className="flex w-full items-center justify-between p-4 text-left hover:bg-[#f2efe9]"><div><p className="text-sm font-bold">{vehicle.name}</p><p className="text-xs text-[#6e756d]">{vehicle.registration} · {assignment ? names.worker(assignment.workerId) : "Unassigned"}</p></div><span className={`text-xs font-bold ${issueCount ? "text-[#a33227]" : "text-[#246a54]"}`}>{issueCount ? `${issueCount} open` : "Clear"} <ChevronRight className="inline h-3 w-3" /></span></button>; })}{!vehicles.length && <Empty label="No vehicles have been added." />}</div>
  </section><section className="rounded-xl bg-[#171b1a] p-5 text-white"><div className="flex items-center gap-2 text-[#e8ad72]"><ShieldCheck className="h-5 w-5" /><span className="text-xs font-bold uppercase tracking-widest">Achievements</span></div><h2 className="mt-4 text-xl font-bold">Positive Driver Highlights</h2><div className="mt-5 space-y-3">{(data.achievements ?? []).map((achievement: any) => <div key={achievement.code} className="border-b border-[#39403b] pb-3"><p className="text-sm">{achievement.label}</p><p className="mt-1 font-mono text-xs text-[#e8ad72]">{date(achievement.earnedAt)}</p></div>)}{!(data.achievements ?? []).length && <p className="text-sm text-[#b8c0b8]">Achievements appear as qualifying activity is logged.</p>}</div></section></div>
  <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4"><Metric label="Daily Inspections" value={inspections.length} /><Metric label="Failed Checks" value={inspections.filter((item: any) => item.overallResult === "fail").length} tone="red" /><Metric label="Average L/100 KM" value={data.consumption?.averageLPer100Km == null ? "—" : Number(data.consumption.averageLPer100Km).toFixed(2)} /><Metric label="Workshop Jobs" value={(data.workshopJobs ?? []).length} /></div></>;
}

function Metric({ label, value, detail, tone }: any) {
  const color = tone === "red" ? "text-[#a33227]" : tone === "green" ? "text-[#246a54]" : tone === "amber" ? "text-[#a05a25]" : "text-[#171b1a]";
  return <div className="rounded-xl border border-[#d8d2c7] bg-[#fbfaf7] p-4"><p className="text-xs font-bold uppercase tracking-wider text-[#6e756d]">{label}</p><p className={`mt-2 font-mono text-2xl font-bold ${color}`}>{value}</p>{detail && <p className="mt-1 text-xs text-[#6e756d]">{detail}</p>}</div>;
}

function History({ tab, setTab, filters, setFilters, vehicles, workers, activity, names, manager, exportUrl, weeklySummary }: any) {
  const [selected, setSelected] = useState<any>(null);
  const [adminAction, setAdminAction] = useState<any>(null);
  const [issueAction, setIssueAction] = useState<any>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const data = activity.data ?? {};
  const sources: Record<string, any[]> = {
    daily: data.dailyInspections ?? [], monthly: data.monthlyInspections ?? [], km: data.kmLogs ?? [],
    fuel: data.fuelFillups ?? [], issues: data.issues ?? [], maintenance: data.maintenance ?? data.workshopJobs ?? [], service: data.serviceRecords ?? [],
  };
  const rows = sources[tab] ?? [];
  const issueUpdate = useMutation({
    mutationFn: ({ id, status }: any) => apiRequest("PATCH", `/api/fleet/issues/${id}`, { status }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/fleet/activity"] }); activity.refetch(); setIssueAction(null); toast({ title: "Issue updated" }); },
    onError: error => toast({ title: "Issue was not updated", description: errorText(error), variant: "destructive" }),
  });
  return <div><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-bold">Every Record, One Timeline</h2><p className="text-sm text-[#6e756d]">Consolidated fleet activity filtered by driver, vehicle and date.</p></div><div className="flex flex-wrap gap-2">
    {manager && <><a href={exportUrl}><Button variant="outline"><Download className="mr-2 h-4 w-4" />Export Fleet Activity XLSX</Button></a><Button variant="outline" disabled={weeklySummary.isPending} onClick={() => weeklySummary.mutate()}><Mail className="mr-2 h-4 w-4" />{weeklySummary.isPending ? "Queueing…" : "Queue Weekly Summary"}</Button></>}
    <Button variant="outline" onClick={() => activity.refetch()}><RotateCcw className="mr-2 h-4 w-4" />Refresh</Button>
  </div></div><div className="mb-3 flex gap-1 overflow-x-auto border-b border-[#d8d2c7]">{historyTabs.map(([id, label]) => <button key={id} onClick={() => setTab(id)} className={`whitespace-nowrap border-b-2 px-3 py-2 text-xs font-bold ${tab === id ? "border-[#a33227] text-[#a33227]" : "border-transparent text-[#6e756d]"}`}>{label}</button>)}</div>
  <FilterBar vehicles={vehicles} workers={workers} filters={filters} setFilters={setFilters} manager={manager} />
  <div className="mt-4 overflow-x-auto rounded-xl border border-[#d8d2c7] bg-[#fbfaf7]">{activity.isLoading ? <PanelState label="Loading Fleet History…" /> : activity.error ? <PanelState error={errorText(activity.error)} action={() => activity.refetch()} /> : <table className="w-full min-w-[760px] text-sm"><thead className="bg-[#e9e5dc] text-left text-xs uppercase tracking-wider text-[#59615b]"><tr><th className="p-3">Date</th><th className="p-3">Vehicle</th><th className="p-3">Driver</th><th className="p-3">Record</th><th className="p-3">Status</th>{manager && <th className="p-3 text-right">Actions</th>}</tr></thead><tbody className="divide-y divide-[#e7e2d9]">{rows.map((row: any, index: number) => {
    const kind = tab === "km" ? "km-logs" : tab === "fuel" ? "fuel-fillups" : tab === "daily" ? "inspections" : null;
    const driverId = row.workerId || row.createdByWorkerId || row.assignedDriverId || row.reportedByWorkerId;
    return <tr key={row.id || `${row.vehicleId}-${row.month}-${index}`} onClick={() => setSelected({ row, tab })} className={`cursor-pointer ${row.deletedAt ? "bg-[#f5ebe8] text-[#8c766f]" : "hover:bg-[#f2efe9]"}`}><td className="p-3">{tab === "monthly" ? row.month : date(rowDate(row))}</td><td className="p-3 font-semibold">{names.vehicle(row.vehicleId)}</td><td className="p-3">{names.worker(driverId)}</td><td className="p-3">{recordSummary(tab, row)}</td><td className="p-3">{pretty(row.deletedAt ? "removed" : row.status || row.overallResult || (row.due ? "due" : "complete"))}</td>{manager && <td className="p-3 text-right" onClick={event => event.stopPropagation()}>{kind ? <div className="flex justify-end gap-3"><button className="text-xs font-bold" onClick={() => setAdminAction({ type: "correct", kind, row })}><Pencil className="mr-1 inline h-3 w-3" />Correct</button><button className={row.deletedAt ? "text-xs font-bold text-[#246a54]" : "text-xs font-bold text-[#a33227]"} onClick={() => setAdminAction({ type: row.deletedAt ? "restore" : "soft-delete", kind, row })}>{row.deletedAt ? <RotateCcw className="mr-1 inline h-3 w-3" /> : <Trash2 className="mr-1 inline h-3 w-3" />}{row.deletedAt ? "Restore" : "Remove"}</button></div> : tab === "issues" ? <button className="text-xs font-bold text-[#a33227]" onClick={() => setIssueAction(row)}>Update Issue</button> : <span className="text-xs text-[#6e756d]">View record</span>}</td>}</tr>;
  })}{!rows.length && <tr><td colSpan={6}><Empty label="No records match these filters." /></td></tr>}</tbody></table>}</div>
  <RecordDialog selected={selected} onClose={() => setSelected(null)} names={names} audit={data.auditEntries ?? data.audit ?? []} />
  <CorrectionDialog action={adminAction} onClose={() => setAdminAction(null)} activity={activity} />
  <Dialog open={Boolean(issueAction)} onOpenChange={open => !open && setIssueAction(null)}><DialogContent><DialogHeader><DialogTitle>Update Issue</DialogTitle></DialogHeader><p className="text-sm text-[#6e756d]">{issueAction?.description}</p><label className="text-sm font-semibold">Status<select className="mt-1 h-10 w-full rounded-md border bg-white px-3" value={issueAction?.status || "open"} onChange={event => setIssueAction((old: any) => ({ ...old, status: event.target.value }))}><option value="open">Open</option><option value="in_progress">In progress</option><option value="booked">Booked</option><option value="completed">Completed</option><option value="not_required">Not required</option></select></label><Button disabled={issueUpdate.isPending} onClick={() => issueUpdate.mutate(issueAction)}>Save Issue</Button></DialogContent></Dialog>
  </div>;
}

function recordSummary(tab: string, row: any) {
  if (tab === "km") return `${row.totalKm || 0} km · ${row.businessKm || 0} business`;
  if (tab === "fuel") return `${row.litres || 0} L · ${money(row.cost)} · ${row.litresPer100Km == null ? "L/100 unavailable" : `${Number(row.litresPer100Km).toFixed(2)} L/100 KM`}`;
  if (tab === "monthly") return row.feedback;
  if (tab === "issues") return row.description;
  if (tab === "maintenance") return row.description || row.title || row.workDone || "Workshop job";
  if (tab === "service") return `${pretty(row.workDone)} · ${money(row.cost)}`;
  return pretty(row.comments || row.overallResult);
}

function correctionFields(kind: string, row: any) {
  if (kind === "km-logs") return [["logDate", "Date", "date"], ["startOdometer", "Start odometer", "number"], ["endOdometer", "End odometer", "number"], ["businessKm", "Business KM", "number"], ["privateKm", "Private KM", "number"], ["notes", "Notes", "text"]];
  if (kind === "fuel-fillups") return [["fillDate", "Date", "date"], ["odometer", "Odometer", "number"], ["litres", "Litres", "number"], ["cost", "Cost", "number"], ["fuelType", "Fuel type", "text"], ["notes", "Notes", "text"]];
  return [["inspectionDate", "Date", "date"], ["overallResult", "Overall result", "text"], ["itemsJson", "Inspection items JSON", "text"], ["comments", "Comments", "text"]];
}

function CorrectionDialog({ action, onClose, activity }: any) {
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [patch, setPatch] = useState<Record<string, any>>({});
  useEffect(() => {
    setReason("");
    if (!action) return setPatch({});
    setPatch(Object.fromEntries(correctionFields(action.kind, action.row).map(([key]) => [key, action.row[key] == null ? "" : key.toLowerCase().includes("date") ? String(action.row[key]).slice(0, 10) : action.row[key]])));
  }, [action]);
  const mutation = useMutation({
    mutationFn: () => action.type === "correct"
      ? apiRequest("PATCH", `/api/fleet/${action.kind}/${action.row.id}/correction`, { patch, reason: reason.trim() })
      : apiRequest("POST", `/api/fleet/${action.kind}/${action.row.id}/${action.type}`, { reason: reason.trim() }),
    onSuccess: () => { activity.refetch(); onClose(); toast({ title: "Fleet record updated" }); },
    onError: error => toast({ title: "Record was not updated", description: errorText(error), variant: "destructive" }),
  });
  return <Dialog open={Boolean(action)} onOpenChange={open => !open && onClose()}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{action?.type === "correct" ? "Correct Fleet Record" : action?.type === "restore" ? "Restore Fleet Record" : "Remove Fleet Record"}</DialogTitle></DialogHeader>
    {action?.type === "correct" && <div className="grid gap-3 sm:grid-cols-2">{correctionFields(action.kind, action.row).map(([key, label, type]) => <label key={key} className="text-sm font-semibold">{label}<Input className="mt-1" type={type} step={type === "number" ? "any" : undefined} value={patch[key] ?? ""} onChange={event => setPatch(old => ({ ...old, [key]: type === "number" && event.target.value !== "" ? Number(event.target.value) : event.target.value }))} /></label>)}</div>}
    <label className="text-sm font-semibold">Reason (required)<Input autoFocus placeholder="Enter the reason for this change" value={reason} onChange={event => setReason(event.target.value)} className="mt-1" /></label>
    <Button className="bg-[#a33227]" disabled={!reason.trim() || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? "Saving…" : "Confirm Change"}</Button>
  </DialogContent></Dialog>;
}

function RecordDialog({ selected, onClose, names, audit }: any) {
  const row = selected?.row;
  const entries = row ? audit.filter((item: any) => (item.entityId || item.entity_id) === row.id) : [];
  return <Dialog open={Boolean(selected)} onOpenChange={open => !open && onClose()}><DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>Fleet Record Details</DialogTitle></DialogHeader>{row && <><div className="grid gap-2 rounded-lg bg-[#f2efe9] p-4 text-sm sm:grid-cols-2"><Detail label="Vehicle" value={names.vehicle(row.vehicleId)} /><Detail label="Driver" value={names.worker(row.workerId || row.createdByWorkerId || row.assignedDriverId)} /><Detail label="Date" value={date(rowDate(row))} /><Detail label="Status" value={pretty(row.status || row.overallResult)} />{Object.entries(row).filter(([key, value]) => !["id", "vehicleId", "workerId", "photoUrl", "receiptPhoto"].includes(key) && value != null && typeof value !== "object").slice(0, 12).map(([key, value]) => <Detail key={key} label={pretty(key)} value={pretty(value)} />)}</div>{row.photoUrl && <a href={row.photoUrl} target="_blank" rel="noopener noreferrer" className="block rounded-lg border p-3"><p className="mb-2 text-sm font-bold">Inspection photo</p><img src={row.photoUrl} alt="Vehicle inspection evidence" className="max-h-72 w-full rounded object-contain" /></a>}<div><h3 className="mb-2 font-bold">Audit Trail</h3>{entries.map((entry: any) => <div key={entry.id} className="mb-2 rounded-lg border p-3 text-xs"><div className="flex flex-wrap justify-between gap-2"><b>{pretty(entry.action)}</b><span>{dateTime(entry.createdAt || entry.created_at)} · Actor {entry.actorId || entry.actor_id || "—"}</span></div><p className="mt-2"><b>Reason:</b> {entry.reason || "—"}</p><details className="mt-2"><summary className="cursor-pointer font-semibold">Before / After</summary><div className="mt-2 grid gap-2 sm:grid-cols-2"><pre className="overflow-auto rounded bg-[#f2efe9] p-2">{JSON.stringify(entry.beforeJson || entry.before_json || null, null, 2)}</pre><pre className="overflow-auto rounded bg-[#f2efe9] p-2">{JSON.stringify(entry.afterJson || entry.after_json || null, null, 2)}</pre></div></details></div>)}{!entries.length && <p className="text-sm text-[#6e756d]">No corrections or removal actions for this record.</p>}</div></>}</DialogContent></Dialog>;
}

function Detail({ label, value }: any) { return <div><span className="text-xs font-bold uppercase text-[#6e756d]">{label}</span><p className="break-words">{value}</p></div>; }
function Vehicles({ vehicles, manager, onAdd, navigate }: any) { return <div><div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-lg font-bold">Fleet Register</h2><p className="text-sm text-[#6e756d]">{vehicles.length} vehicles · select a vehicle for its live profile</p></div>{manager && <Button onClick={onAdd} className="bg-[#a33227]"><Plus className="mr-2 h-4 w-4" />Add Vehicle</Button>}</div><div className="overflow-hidden rounded-xl border border-[#d8d2c7] bg-[#fbfaf7]">{vehicles.map((vehicle: any) => <button onClick={() => navigate(`/fleet/vehicles/${vehicle.id}`)} key={vehicle.id} className="flex w-full items-center justify-between border-b p-4 text-left last:border-0 hover:bg-[#f2efe9]"><div><p className="font-bold">{vehicle.name}</p><p className="text-xs text-[#6e756d]">{vehicle.registration} · {vehicle.make} {vehicle.model} {vehicle.year || ""}</p></div><span className="flex items-center gap-1 text-xs font-bold capitalize text-[#246a54]">{pretty(vehicle.vehicleStatus || "active")}<ChevronRight className="h-3 w-3" /></span></button>)}{!vehicles.length && <Empty label="Fleet register is empty." />}</div></div>; }

function Settings({ settingsQuery, templatesQuery }: any) {
  const latest = settingsQuery.data?.[0];
  const initial = latest?.settings_json ?? latest?.settingsJson ?? {};
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [templateName, setTemplateName] = useState("");
  const [templateItems, setTemplateItems] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  useEffect(() => setSettings(initial), [latest]);
  const save = useMutation({
    mutationFn: () => apiRequest("POST", "/api/fleet/settings", { settings }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/fleet/settings"] }); toast({ title: "Fleet settings saved" }); },
    onError: error => toast({ title: "Settings were not saved", description: errorText(error), variant: "destructive" }),
  });
  const templateMutation = useMutation({
    mutationFn: async ({ method, url, body, second }: any) => {
      await apiRequest(method, url, body);
      if (second) await apiRequest(second.method, second.url, second.body);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/fleet/inspection-templates"] }); toast({ title: "Inspection template updated" }); },
    onError: error => toast({ title: "Template was not updated", description: errorText(error), variant: "destructive" }),
  });
  const createTemplate = () => {
    const items = templateItems.split("\n").map(item => item.trim()).filter(Boolean);
    templateMutation.mutate({ method: "POST", url: "/api/fleet/inspection-templates", body: { name: templateName, items } }, { onSuccess: () => { setTemplateName(""); setTemplateItems(""); } });
  };
  if (settingsQuery.isLoading || templatesQuery.isLoading) return <PanelState label="Loading Fleet Settings…" />;
  if (settingsQuery.error || templatesQuery.error) return <PanelState error={errorText(settingsQuery.error || templatesQuery.error)} action={() => { settingsQuery.refetch(); templatesQuery.refetch(); }} />;
  return <div className="space-y-5"><section className="rounded-xl border bg-[#fbfaf7] p-5"><div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#a33227]"><SlidersHorizontal className="h-4 w-4" />Fleet Policy · Version {latest?.version ?? "new"}</div><div className="grid gap-4 sm:grid-cols-2"><SettingInput label="Service interval (KM)" name="kmInterval" value={settings.kmInterval ?? ""} setSettings={setSettings} type="number" /><SettingInput label="Service interval (months)" name="monthInterval" value={settings.monthInterval ?? ""} setSettings={setSettings} type="number" /></div><div className="mt-4 grid gap-3 sm:grid-cols-2">{[["dailyReminder", "Daily check reminders"], ["monthlyReminder", "Monthly check reminders"]].map(([key, label]) => <label key={key} className="flex items-center justify-between rounded-lg border p-3 text-sm font-semibold">{label}<input type="checkbox" checked={Boolean(settings[key])} onChange={event => setSettings(old => ({ ...old, [key]: event.target.checked }))} /></label>)}</div><Button className="mt-4 bg-[#171b1a]" disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? "Saving…" : "Save Fleet Settings"}</Button></section>
    <section className="rounded-xl border bg-[#fbfaf7] p-5"><h2 className="font-bold">Inspection Templates</h2><p className="mb-4 text-sm text-[#6e756d]">Create, edit, reorder, archive and restore checklist items.</p><div className="mb-5 grid gap-2 rounded-lg bg-[#f2efe9] p-4"><Input placeholder="Template name" value={templateName} onChange={event => setTemplateName(event.target.value)} /><textarea className="min-h-24 rounded-md border bg-white p-3 text-sm" placeholder={"One checklist item per line"} value={templateItems} onChange={event => setTemplateItems(event.target.value)} /><Button disabled={!templateName.trim() || !templateItems.trim() || templateMutation.isPending} onClick={createTemplate}><Plus className="mr-2 h-4 w-4" />Create Template</Button></div><div className="space-y-3">{(templatesQuery.data ?? []).map((template: any) => <TemplateCard key={template.id} template={template} mutate={templateMutation.mutate} pending={templateMutation.isPending} />)}{!templatesQuery.data?.length && <Empty label="No inspection templates exist." />}</div></section>
  </div>;
}

function SettingInput({ label, name, value, setSettings, type }: any) { return <label className="text-sm font-semibold">{label}<Input className="mt-1" type={type} value={value} onChange={event => setSettings((old: any) => ({ ...old, [name]: type === "number" ? Number(event.target.value) : event.target.value }))} /></label>; }
function TemplateCard({ template, mutate, pending }: any) {
  const archived = Boolean(template.archived_at || template.archivedAt);
  const [open, setOpen] = useState(!archived);
  const sorted = [...(template.items ?? [])].sort((a, b) => a.position - b.position);
  const itemUrl = (item: any) => `/api/fleet/inspection-templates/${template.id}/items/${item.id}`;
  const patch = (item: any, body: any) => mutate({ method: "PATCH", url: itemUrl(item), body });
  const swap = (item: any, other: any) => mutate({
    method: "PATCH", url: itemUrl(item), body: { position: other.position },
    second: { method: "PATCH", url: itemUrl(other), body: { position: item.position } },
  });
  return <div className={`rounded-lg border ${archived ? "bg-[#eeeae3] opacity-75" : "bg-white"}`}><div className="flex items-center justify-between gap-2 p-3"><button className="flex flex-1 items-center gap-2 text-left font-bold" onClick={() => setOpen(value => !value)}><ChevronDown className={`h-4 w-4 transition-transform ${open ? "" : "-rotate-90"}`} />{template.name}<span className="text-xs font-normal text-[#6e756d]">v{template.version}</span></button><Button size="sm" variant="outline" disabled={pending} onClick={() => mutate({ method: "POST", url: `/api/fleet/inspection-templates/${template.id}/${archived ? "restore" : "archive"}` })}>{archived ? "Restore" : "Archive"}</Button></div>{open && <div className="space-y-2 border-t p-3">{sorted.map((item: any, index: number) => <div className="flex gap-2" key={item.id}><Input defaultValue={item.label} onBlur={event => event.target.value.trim() !== item.label && patch(item, { label: event.target.value })} /><Button title="Move up" variant="outline" size="sm" disabled={index === 0 || pending} onClick={() => swap(item, sorted[index - 1])}>Up</Button><Button title="Move down" variant="outline" size="sm" disabled={index === sorted.length - 1 || pending} onClick={() => swap(item, sorted[index + 1])}>Down</Button><Button variant="outline" size="sm" disabled={pending} onClick={() => patch(item, { archived: !Boolean(item.archived_at || item.archivedAt) })}>{item.archived_at || item.archivedAt ? "Restore" : "Archive"}</Button></div>)}</div>}</div>;
}

function Empty({ label }: { label: string }) { return <div className="p-10 text-center text-sm text-[#6e756d]"><Truck className="mx-auto mb-2 h-7 w-7 opacity-40" />{label}</div>; }
function PanelState({ label, error, action }: { label?: string; error?: string; action?: () => void }) { return <div className="rounded-xl border bg-[#fbfaf7] p-10 text-center text-sm text-[#6e756d]">{error ? <><AlertTriangle className="mx-auto mb-2 text-[#a33227]" /><p>{error}</p>{action && <Button className="mt-3" variant="outline" onClick={action}>Try Again</Button>}</> : label}</div>; }
function AccessDenied() { return <div className="rounded-xl border border-[#e0aaa0] bg-[#fff5f2] p-8 text-center"><ShieldCheck className="mx-auto mb-3 text-[#a33227]" /><h2 className="font-bold">Fleet Settings require a manager</h2><p className="text-sm text-[#6e756d]">Only the exact admin and manager backend roles can change fleet configuration.</p></div>; }