import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Pencil, Trash2, MapPin } from "lucide-react";
import { format } from "date-fns";
import type { ServiceContract, Department, Client, Worker, Team } from "@shared/schema";

const FREQS = [
  "Daily","2 x a week","Weekly","Twice a month","Monthly",
  "Every 2 months","Quarterly","Every 6 months","Annually","Once-off",
] as const;
const INVOICE_FREQS = [
  "Per Service","Weekly","Monthly","Quarterly","Every 6 months","Annually",
] as const;
const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const WEEKS_OPTS: { val: number; label: string }[] = [
  { val: 1, label: "1st week" },
  { val: 2, label: "2nd week" },
  { val: 3, label: "3rd week" },
  { val: 4, label: "4th week" },
  { val: 5, label: "Last week" },
];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

type ContractForm = Partial<ServiceContract> & { startDate?: string | Date | null; endDate?: string | Date | null };

function ordinal(n: number) {
  if (n === 5) return "Last";
  return n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`;
}

function scheduleSummary(c: ServiceContract): string {
  const t = c.startTime ? ` at ${c.startTime}` : "";
  switch (c.frequency) {
    case "Daily":
      return `Daily${t}`;
    case "2 x a week":
      return `${c.dayOfWeek ?? "?"} and ${c.secondDayOfWeek ?? "?"}${t}`;
    case "Weekly":
      return `Every ${c.dayOfWeek ?? "?"}${t}`;
    case "Twice a month": {
      const a = `${ordinal(c.weekOfMonth ?? 1)} ${c.dayOfWeek ?? ""}${c.startTime ? " at " + c.startTime : ""}`;
      const b = `${ordinal(c.secondWeekOfMonth ?? 3)} ${c.secondDayOfWeek ?? ""}${c.secondStartTime ? " at " + c.secondStartTime : ""}`;
      return `${a} and ${b}`;
    }
    case "Monthly":
    case "Every 2 months":
    case "Quarterly":
    case "Every 6 months": {
      const cadence = c.frequency === "Monthly" ? "" :
                      c.frequency === "Every 2 months" ? " (every 2 months)" :
                      c.frequency === "Quarterly" ? " (quarterly)" : " (every 6 months)";
      return `${ordinal(c.weekOfMonth ?? 1)} ${c.dayOfWeek ?? ""}${t}${cadence}`;
    }
    case "Annually":
      return `Every ${MONTHS[(c.annualMonth ?? 1) - 1]} — ${ordinal(c.weekOfMonth ?? 1)} ${c.dayOfWeek ?? ""}${t}`;
    case "Once-off":
      return c.startDate ? `${format(new Date(c.startDate), "d MMM yyyy")}${t}` : "Once-off";
  }
  return c.frequency;
}

export default function ServiceContractsPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceContract | null>(null);
  const [form, setForm] = useState<ContractForm>({});

  const { data: contracts = [], isLoading } = useQuery<ServiceContract[]>({ queryKey: ["/api/service-contracts"] });
  const { data: departments = [] } = useQuery<Department[]>({ queryKey: ["/api/departments"] });
  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: workers = [] } = useQuery<Worker[]>({ queryKey: ["/api/workers"] });
  const { data: teams = [] } = useQuery<Team[]>({ queryKey: ["/api/teams"] });

  const filtered = useMemo(() =>
    contracts.filter(c => {
      if (deptFilter !== "all" && c.departmentId !== deptFilter) return false;
      if (statusFilter === "active" && !c.activeStatus) return false;
      if (statusFilter === "inactive" && c.activeStatus) return false;
      if (search && !c.customerName.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    }), [contracts, deptFilter, statusFilter, search]);

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = { ...form };
      // Sanitize empty optional values
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-contracts"] });
      toast({ title: "Contract deleted" });
    },
  });

  const toggleActive = useMutation({
    mutationFn: async (c: ServiceContract) =>
      apiRequest("PUT", `/api/service-contracts/${c.id}`, { activeStatus: !c.activeStatus }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/service-contracts"] }),
  });

  const openNew = () => {
    setEditing(null);
    setForm({
      activeStatus: true,
      frequency: "Monthly",
      weekOfMonth: 1,
      dayOfWeek: "Monday",
      startTime: "08:00",
      estimatedDuration: 60,
    });
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

  // Auto-fill customerName when customer is picked
  const setCustomer = (id: string) => {
    const cl = clients.find(c => c.id === id);
    setForm(f => ({ ...f, customerId: id, customerName: cl?.name ?? f.customerName ?? "" }));
  };
  const setTech = (id: string) => {
    if (id === "_none") {
      setForm(f => ({ ...f, assignedTechnicianId: null, assignedTechnicianName: null, assignedTeamId: null, assignedTeamName: null }));
      return;
    }
    if (id.startsWith("team:")) {
      const tid = id.slice(5);
      const t = teams.find(x => x.id === tid);
      setForm(f => ({ ...f, assignedTeamId: tid, assignedTeamName: t?.name ?? null, assignedTechnicianId: null, assignedTechnicianName: null }));
    } else {
      const w = workers.find(x => x.id === id);
      setForm(f => ({ ...f, assignedTechnicianId: id, assignedTechnicianName: w?.name ?? null, assignedTeamId: null, assignedTeamName: null }));
    }
  };
  const techValue = form.assignedTeamId ? `team:${form.assignedTeamId}` : form.assignedTechnicianId || "_none";

  const freq = form.frequency || "Monthly";
  const show = {
    endDate: freq !== "Once-off",
    weekOfMonth: ["Monthly","Twice a month","Every 2 months","Quarterly","Every 6 months","Annually"].includes(freq),
    dayOfWeek: ["2 x a week","Weekly","Twice a month","Monthly","Every 2 months","Quarterly","Every 6 months","Annually"].includes(freq),
    secondDayOfWeek: freq === "2 x a week",
    twiceMonth: freq === "Twice a month",
    annualMonth: freq === "Annually",
  };
  // Start Date is the anchor for cadence — REQUIRED for stepped frequencies & Once-off
  const startRequired = ["Once-off","Every 2 months","Quarterly","Every 6 months","Annually"].includes(freq);
  const startLabel = freq === "Once-off" ? "Date *" : startRequired ? "Start Date *" : "Start Date (optional)";

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Contracts" />
        <main className="flex-1 overflow-y-auto p-6 space-y-4">

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-900">
            <div className="font-semibold mb-1">What is a Contract?</div>
            <p>A contract is a <b>recurring job</b> that repeats on a schedule (like an Outlook recurring appointment). Once you create a contract, the calendar will automatically show each visit on the right day and time — no need to generate jobs manually.</p>
            <p className="mt-1">For a single visit on one date, choose the <b>Once-off</b> frequency.</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col md:flex-row gap-2 md:items-center md:justify-between">
            <div className="flex gap-2 items-center flex-wrap">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input
                  placeholder="Search customer…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8 h-9 w-56"
                  data-testid="search-contract"
                />
              </div>
              <Select value={deptFilter} onValueChange={setDeptFilter}>
                <SelectTrigger className="h-9 w-40" data-testid="filter-dept"><SelectValue placeholder="Department" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All departments</SelectItem>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-32" data-testid="filter-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active only</SelectItem>
                  <SelectItem value="inactive">Inactive only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={openNew} className="h-9" data-testid="btn-add-contract">
              <Plus className="h-4 w-4 mr-1" />New Contract
            </Button>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr className="border-b">
                  <th className="px-3 py-2 font-semibold">Customer</th>
                  <th className="px-3 py-2 font-semibold">Service</th>
                  <th className="px-3 py-2 font-semibold">Service Freq.</th>
                  <th className="px-3 py-2 font-semibold">Invoicing</th>
                  <th className="px-3 py-2 font-semibold">Schedule</th>
                  <th className="px-3 py-2 font-semibold">Technician / Team</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={8} className="px-3 py-6 text-center text-gray-400">Loading…</td></tr>
                )}
                {!isLoading && filtered.length === 0 && (
                  <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-400">
                    No contracts yet. Click <b>New Contract</b> to add your first one.
                  </td></tr>
                )}
                {filtered.map(c => {
                  const dept = departments.find(d => d.id === c.departmentId);
                  const assigned = c.assignedTeamName ? `${c.assignedTeamName} (team)` : c.assignedTechnicianName ?? "—";
                  return (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50" data-testid={`row-contract-${c.id}`}>
                      <td className="px-3 py-2">
                        <div className="font-medium">{c.customerName}</div>
                        {dept && <div className="text-xs text-gray-500">{dept.name}</div>}
                      </td>
                      <td className="px-3 py-2">{c.serviceType}</td>
                      <td className="px-3 py-2"><Badge variant="outline">{c.frequency}</Badge></td>
                      <td className="px-3 py-2 text-gray-700">{c.invoicingFrequency || "—"}</td>
                      <td className="px-3 py-2 text-gray-700">{scheduleSummary(c)}</td>
                      <td className="px-3 py-2">{assigned}</td>
                      <td className="px-3 py-2">
                        <Switch checked={!!c.activeStatus} onCheckedChange={() => toggleActive.mutate(c)} data-testid={`toggle-${c.id}`} />
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(c)} data-testid={`edit-${c.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Delete contract for ${c.customerName}?`)) remove.mutate(c.id); }} data-testid={`delete-${c.id}`}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </main>
      </div>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); setForm({}); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Contract" : "New Contract"}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 py-2">
            {/* Frequencies pinned at the top of the form */}
            <div>
              <Label>Service Frequency *</Label>
              <Select value={freq} onValueChange={v => setForm(f => ({ ...f, frequency: v }))}>
                <SelectTrigger data-testid="f-freq"><SelectValue placeholder="How often the visit happens" /></SelectTrigger>
                <SelectContent>
                  {FREQS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Invoicing Frequency</Label>
              <Select value={form.invoicingFrequency || ""} onValueChange={v => setForm(f => ({ ...f, invoicingFrequency: v }))}>
                <SelectTrigger data-testid="f-invoice-freq"><SelectValue placeholder="How often the customer is invoiced" /></SelectTrigger>
                <SelectContent>
                  {INVOICE_FREQS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 border-t pt-3" />

            <div>
              <Label>Customer *</Label>
              <Select value={form.customerId || ""} onValueChange={setCustomer}>
                <SelectTrigger data-testid="f-customer"><SelectValue placeholder="Choose customer" /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Service Type *</Label>
              <Input value={form.serviceType ?? ""} onChange={e => setForm(f => ({ ...f, serviceType: e.target.value }))} placeholder="e.g. Pest Control" data-testid="f-service" />
            </div>
            <div>
              <Label>Department *</Label>
              <Select value={form.departmentId || ""} onValueChange={v => setForm(f => ({ ...f, departmentId: v }))}>
                <SelectTrigger data-testid="f-dept"><SelectValue placeholder="Choose department" /></SelectTrigger>
                <SelectContent>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Assigned Technician / Team</Label>
              <Select value={techValue} onValueChange={setTech}>
                <SelectTrigger data-testid="f-tech"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— Unassigned —</SelectItem>
                  {workers.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                  {teams.map(t => <SelectItem key={t.id} value={`team:${t.id}`}>{t.name} (team)</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Start date is anchor for cadence — required for stepped frequencies & once-off */}
            <div>
              <Label>{startLabel}</Label>
              <Input type="date" value={(form.startDate as string) ?? ""} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} data-testid="f-start-date" />
            </div>
            {show.endDate && (
              <div>
                <Label>End Date (optional)</Label>
                <Input type="date" value={(form.endDate as string) ?? ""} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} data-testid="f-end-date" />
              </div>
            )}

            {show.annualMonth && (
              <div>
                <Label>Month *</Label>
                <Select value={String(form.annualMonth ?? 1)} onValueChange={v => setForm(f => ({ ...f, annualMonth: Number(v) }))}>
                  <SelectTrigger data-testid="f-annual-month"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {show.weekOfMonth && (
              <div>
                <Label>Week of Month *</Label>
                <Select value={String(form.weekOfMonth ?? 1)} onValueChange={v => setForm(f => ({ ...f, weekOfMonth: Number(v) }))}>
                  <SelectTrigger data-testid="f-week"><SelectValue /></SelectTrigger>
                  <SelectContent>{WEEKS_OPTS.map(w => <SelectItem key={w.val} value={String(w.val)}>{w.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}

            {show.dayOfWeek && (
              <div>
                <Label>{freq === "2 x a week" ? "First Day of Week *" : "Day of Week *"}</Label>
                <Select value={form.dayOfWeek ?? ""} onValueChange={v => setForm(f => ({ ...f, dayOfWeek: v }))}>
                  <SelectTrigger data-testid="f-day"><SelectValue placeholder="Choose day" /></SelectTrigger>
                  <SelectContent>{DAYS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}

            {show.secondDayOfWeek && (
              <div>
                <Label>Second Day of Week *</Label>
                <Select value={form.secondDayOfWeek ?? ""} onValueChange={v => setForm(f => ({ ...f, secondDayOfWeek: v }))}>
                  <SelectTrigger data-testid="f-day2"><SelectValue placeholder="Choose day" /></SelectTrigger>
                  <SelectContent>{DAYS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}

            {show.twiceMonth && (
              <>
                <div>
                  <Label>Second Week of Month *</Label>
                  <Select value={String(form.secondWeekOfMonth ?? 3)} onValueChange={v => setForm(f => ({ ...f, secondWeekOfMonth: Number(v) }))}>
                    <SelectTrigger data-testid="f-week2"><SelectValue /></SelectTrigger>
                    <SelectContent>{WEEKS_OPTS.map(w => <SelectItem key={w.val} value={String(w.val)}>{w.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Second Day of Week *</Label>
                  <Select value={form.secondDayOfWeek ?? ""} onValueChange={v => setForm(f => ({ ...f, secondDayOfWeek: v }))}>
                    <SelectTrigger data-testid="f-day2b"><SelectValue placeholder="Choose day" /></SelectTrigger>
                    <SelectContent>{DAYS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Second Start Time</Label>
                  <Input type="time" value={form.secondStartTime ?? ""} onChange={e => setForm(f => ({ ...f, secondStartTime: e.target.value }))} data-testid="f-time2" />
                </div>
              </>
            )}

            <div>
              <Label>Start Time *</Label>
              <Input type="time" value={form.startTime ?? ""} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} data-testid="f-time" />
            </div>
            <div>
              <Label>Estimated Duration (min)</Label>
              <Input type="number" min={15} step={15} value={form.estimatedDuration ?? 60} onChange={e => setForm(f => ({ ...f, estimatedDuration: Number(e.target.value) || null }))} data-testid="f-duration" />
            </div>

            <div className="col-span-2">
              <Label>Google Maps Link</Label>
              <Input value={form.googleMapsLink ?? ""} onChange={e => setForm(f => ({ ...f, googleMapsLink: e.target.value }))} placeholder="https://maps.google.com/?q=…" data-testid="f-maps" />
            </div>
            <div className="col-span-2">
              <Label>Notes</Label>
              <Textarea rows={2} value={form.notes ?? ""} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} data-testid="f-notes" />
            </div>

            <div className="col-span-2 flex items-center gap-2">
              <Switch checked={form.activeStatus !== false} onCheckedChange={v => setForm(f => ({ ...f, activeStatus: v }))} data-testid="f-active" />
              <span className="text-sm">Active</span>
              <span className="text-xs text-gray-400">(inactive contracts don't appear on the calendar)</span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending || !form.customerId || !form.serviceType || !form.departmentId || !form.frequency || (startRequired && !form.startDate)} data-testid="f-save">
              {save.isPending ? "Saving…" : (editing ? "Save Changes" : "Create Contract")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
