import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Search, ArrowUp, ArrowDown, Pencil, Trash2, MapPin, Printer,
  CalendarPlus, ListOrdered,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { MonthlyServiceSequence, Department, Client, Worker, Team } from "@shared/schema";

const FREQUENCIES = ["Weekly", "Fortnightly", "Monthly", "Every 2 Months", "Quarterly", "Once-off"];
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const WEEKS = [1, 2, 3, 4, 5];
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

type SeqForm = Partial<MonthlyServiceSequence>;

export default function MonthlySequencePage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [techFilter, setTechFilter] = useState<string>("all");

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<MonthlyServiceSequence | null>(null);
  const [form, setForm] = useState<SeqForm>({});

  const [showGenerate, setShowGenerate] = useState(false);
  const now = new Date();
  const [genMonth, setGenMonth] = useState<number>(now.getMonth() + 1);
  const [genYear, setGenYear] = useState<number>(now.getFullYear());
  const [genDept, setGenDept] = useState<string>("all");
  const [genTech, setGenTech] = useState<string>("all");
  const [genTeam, setGenTeam] = useState<string>("all");
  const [skipDupes, setSkipDupes] = useState(true);

  const { data: sequences = [], isLoading } = useQuery<MonthlyServiceSequence[]>({
    queryKey: ["/api/monthly-service-sequences"],
  });
  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: departments = [] } = useQuery<Department[]>({ queryKey: ["/api/departments"] });
  const { data: workers = [] } = useQuery<Worker[]>({ queryKey: ["/api/workers"] });
  const { data: teams = [] } = useQuery<Team[]>({ queryKey: ["/api/teams"] });

  const deptMap = useMemo(() => new Map(departments.map(d => [d.id, d])), [departments]);

  // Filter
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sequences
      .filter(s => deptFilter === "all" || s.departmentId === deptFilter)
      .filter(s => techFilter === "all" ||
        s.assignedTechnicianId === techFilter ||
        s.assignedTeamId === techFilter)
      .filter(s => !term || s.customerName.toLowerCase().includes(term));
  }, [sequences, search, deptFilter, techFilter]);

  // Group: Week → Day → Sequences
  const grouped = useMemo(() => {
    const map = new Map<number, Map<string, MonthlyServiceSequence[]>>();
    for (const s of filtered) {
      if (!map.has(s.serviceWeek)) map.set(s.serviceWeek, new Map());
      const dayMap = map.get(s.serviceWeek)!;
      if (!dayMap.has(s.serviceDay)) dayMap.set(s.serviceDay, []);
      dayMap.get(s.serviceDay)!.push(s);
    }
    for (const dayMap of Array.from(map.values())) {
      for (const arr of Array.from(dayMap.values())) {
        arr.sort((a: MonthlyServiceSequence, b: MonthlyServiceSequence) => a.jobSequence - b.jobSequence);
      }
    }
    return map;
  }, [filtered]);

  const sortedWeeks = Array.from(grouped.keys()).sort((a, b) => a - b);

  // Mutations
  const save = useMutation({
    mutationFn: async (payload: SeqForm) => {
      const method = editing ? "PUT" : "POST";
      const url = editing
        ? `/api/monthly-service-sequences/${editing.id}`
        : "/api/monthly-service-sequences";
      const r = await apiRequest(method, url, payload);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/monthly-service-sequences"] });
      setShowForm(false);
      setEditing(null);
      setForm({});
      toast({ title: editing ? "Sequence updated" : "Sequence added" });
    },
    onError: (e: any) => toast({ title: "Save failed", description: e?.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/monthly-service-sequences/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/monthly-service-sequences"] });
      toast({ title: "Removed from sequence" });
    },
  });

  const move = useMutation({
    mutationFn: async ({ id, direction }: { id: string; direction: "up" | "down" }) =>
      apiRequest("POST", `/api/monthly-service-sequences/${id}/move`, { direction }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/monthly-service-sequences"] }),
  });

  const toggleActive = useMutation({
    mutationFn: async (s: MonthlyServiceSequence) =>
      apiRequest("PUT", `/api/monthly-service-sequences/${s.id}`, { activeStatus: !s.activeStatus }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/monthly-service-sequences"] }),
  });

  const generate = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/monthly-service-sequences/generate", {
        year: genYear,
        month: genMonth,
        departmentId: genDept === "all" ? undefined : genDept,
        technicianId: genTech === "all" ? undefined : genTech,
        teamId: genTeam === "all" ? undefined : genTeam,
        skipDuplicates: skipDupes,
      });
      return r.json();
    },
    onSuccess: (res: { createdCount: number; skipped: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      setShowGenerate(false);
      toast({
        title: "Monthly jobs generated",
        description: `${res.createdCount} created, ${res.skipped} skipped (duplicates).`,
      });
    },
    onError: (e: any) => toast({ title: "Generate failed", description: e?.message, variant: "destructive" }),
  });

  const openAdd = () => {
    setEditing(null);
    setForm({
      serviceFrequency: "Monthly",
      serviceWeek: 1,
      serviceDay: "Monday",
      jobSequence: 1,
      activeStatus: true,
      defaultStartTime: "07:30",
    });
    setShowForm(true);
  };

  const openEdit = (s: MonthlyServiceSequence) => {
    setEditing(s);
    setForm(s);
    setShowForm(true);
  };

  const onCustomerPick = (clientId: string) => {
    const c = clients.find(x => x.id === clientId);
    if (!c) return;
    setForm(f => ({
      ...f,
      customerId: c.id,
      customerName: c.name,
      departmentId: f.departmentId ?? c.departmentId,
      address: c.address ?? [c.streetNumber, c.streetName, c.suburb, c.city].filter(Boolean).join(" "),
      googleMapsLink: f.googleMapsLink ?? c.googleMapsLink ?? undefined,
    }));
  };

  const onTechPick = (workerId: string) => {
    if (workerId === "none") {
      setForm(f => ({ ...f, assignedTechnicianId: undefined, assignedTechnicianName: undefined }));
      return;
    }
    const w = workers.find(x => x.id === workerId);
    if (!w) return;
    setForm(f => ({ ...f, assignedTechnicianId: w.id, assignedTechnicianName: w.name }));
  };

  const onTeamPick = (teamId: string) => {
    if (teamId === "none") {
      setForm(f => ({ ...f, assignedTeamId: undefined, assignedTeamName: undefined }));
      return;
    }
    const t = teams.find(x => x.id === teamId);
    if (!t) return;
    setForm(f => ({ ...f, assignedTeamId: t.id, assignedTeamName: t.name }));
  };

  const canSave =
    !!form.customerId && !!form.departmentId && !!form.serviceType &&
    !!form.serviceFrequency && !!form.serviceDay && !!form.serviceWeek;

  const routeSheetHref = `/monthly-route-sheet?year=${genYear}&month=${genMonth}${genDept !== "all" ? `&dept=${genDept}` : ""}`;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Monthly Service Sequence" />
        <main className="flex-1 overflow-y-auto p-6 space-y-4">

          {/* Toolbar */}
          <div className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col md:flex-row gap-2 md:items-center md:justify-between">
            <div className="flex gap-2 items-center flex-wrap">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input
                  placeholder="Search customer…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8 h-9 w-56"
                  data-testid="search-sequence"
                />
              </div>
              <Select value={deptFilter} onValueChange={setDeptFilter}>
                <SelectTrigger className="h-9 w-40" data-testid="filter-dept"><SelectValue placeholder="Department" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All departments</SelectItem>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={techFilter} onValueChange={setTechFilter}>
                <SelectTrigger className="h-9 w-44" data-testid="filter-tech"><SelectValue placeholder="Technician / Team" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All technicians/teams</SelectItem>
                  {workers.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                  {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name} (team)</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Link href={routeSheetHref}>
                <Button variant="outline" size="sm" data-testid="button-route-sheet">
                  <Printer className="h-4 w-4 mr-1.5" /> Route Sheet
                </Button>
              </Link>
              <Button variant="outline" size="sm" onClick={() => setShowGenerate(true)} data-testid="button-generate">
                <CalendarPlus className="h-4 w-4 mr-1.5" /> Generate Monthly Jobs
              </Button>
              <Button size="sm" onClick={openAdd} data-testid="button-add-sequence">
                <Plus className="h-4 w-4 mr-1.5" /> Add to Sequence
              </Button>
            </div>
          </div>

          {/* List grouped by Week → Day → Sequence */}
          {isLoading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : sequences.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 text-center">
              <ListOrdered className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500 mb-3">No recurring service sequences yet.</p>
              <Button onClick={openAdd} data-testid="button-add-first">
                <Plus className="h-4 w-4 mr-1.5" /> Add your first customer
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No sequences match the current filters.</p>
          ) : (
            <div className="space-y-3">
              {sortedWeeks.map(wk => {
                const dayMap = grouped.get(wk)!;
                const sortedDays = Array.from(dayMap.keys()).sort((a, b) => DAYS.indexOf(a) - DAYS.indexOf(b));
                return (
                  <div key={wk} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <div className="bg-blue-50 border-b border-blue-100 px-4 py-2">
                      <h2 className="text-sm font-bold text-blue-900">Week {wk}</h2>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {sortedDays.map(day => {
                        const rows = dayMap.get(day)!;
                        return (
                          <div key={day}>
                            <div className="px-4 py-2 bg-gray-50 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                              {day}
                            </div>
                            <div className="divide-y divide-gray-50">
                              {rows.map((s, idx) => {
                                const dept = deptMap.get(s.departmentId);
                                return (
                                  <div
                                    key={s.id}
                                    className={`px-4 py-2.5 flex items-center gap-3 ${!s.activeStatus ? "bg-gray-50 opacity-60" : ""}`}
                                    data-testid={`seq-row-${s.id}`}
                                  >
                                    <span className="w-7 text-center text-sm font-bold text-blue-700">{s.jobSequence}.</span>

                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <p className="text-sm font-medium text-gray-900 truncate">{s.customerName}</p>
                                        {dept && (
                                          <Badge
                                            variant="outline"
                                            style={{ borderColor: dept.colorCode ?? "#999", color: dept.colorCode ?? "#666" }}
                                            className="text-[10px]"
                                          >
                                            {dept.name}
                                          </Badge>
                                        )}
                                        <Badge variant="outline" className="text-[10px] bg-gray-50">{s.serviceType}</Badge>
                                        <Badge variant="outline" className="text-[10px] bg-gray-50">{s.serviceFrequency}</Badge>
                                        {!s.activeStatus && <Badge variant="outline" className="text-[10px] bg-gray-200 text-gray-600">Inactive</Badge>}
                                      </div>
                                      <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-3 flex-wrap">
                                        {s.defaultStartTime && <span>⏱ {s.defaultStartTime}</span>}
                                        {s.estimatedDuration ? <span>{s.estimatedDuration} min</span> : null}
                                        {s.assignedTechnicianName && <span>👤 {s.assignedTechnicianName}</span>}
                                        {s.assignedTeamName && <span>👥 {s.assignedTeamName}</span>}
                                        {s.googleMapsLink && (
                                          <a href={s.googleMapsLink} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                                            <MapPin className="h-3 w-3" /> Map
                                          </a>
                                        )}
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1">
                                      <Button
                                        size="icon" variant="ghost"
                                        className="h-7 w-7"
                                        disabled={idx === 0 || move.isPending}
                                        onClick={() => move.mutate({ id: s.id, direction: "up" })}
                                        title="Move up"
                                        data-testid={`move-up-${s.id}`}
                                      >
                                        <ArrowUp className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button
                                        size="icon" variant="ghost"
                                        className="h-7 w-7"
                                        disabled={idx === rows.length - 1 || move.isPending}
                                        onClick={() => move.mutate({ id: s.id, direction: "down" })}
                                        title="Move down"
                                        data-testid={`move-down-${s.id}`}
                                      >
                                        <ArrowDown className="h-3.5 w-3.5" />
                                      </Button>
                                      <div className="mx-1">
                                        <Switch
                                          checked={!!s.activeStatus}
                                          onCheckedChange={() => toggleActive.mutate(s)}
                                          data-testid={`toggle-active-${s.id}`}
                                        />
                                      </div>
                                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(s)} title="Edit" data-testid={`edit-${s.id}`}>
                                        <Pencil className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button
                                        size="icon" variant="ghost" className="h-7 w-7 text-rose-600"
                                        onClick={() => {
                                          if (confirm(`Remove ${s.customerName} from the sequence?`)) remove.mutate(s.id);
                                        }}
                                        title="Remove"
                                        data-testid={`delete-${s.id}`}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Add / Edit dialog */}
      <Dialog open={showForm} onOpenChange={(o) => { setShowForm(o); if (!o) { setEditing(null); setForm({}); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit sequence" : "Add to monthly sequence"}</DialogTitle>
            <DialogDescription>Set when and in what order this customer should be serviced each month.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="col-span-2">
              <Label>Customer *</Label>
              <Select value={form.customerId ?? ""} onValueChange={onCustomerPick}>
                <SelectTrigger data-testid="form-customer"><SelectValue placeholder="Select a customer…" /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Department *</Label>
              <Select value={form.departmentId ?? ""} onValueChange={(v) => setForm(f => ({ ...f, departmentId: v }))}>
                <SelectTrigger data-testid="form-dept"><SelectValue placeholder="Department" /></SelectTrigger>
                <SelectContent>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Service Type *</Label>
              <Input
                value={form.serviceType ?? ""}
                onChange={e => setForm(f => ({ ...f, serviceType: e.target.value }))}
                placeholder="e.g. Pest Control, Sanitary Bin Swap"
                data-testid="form-service"
              />
            </div>

            <div>
              <Label>Technician</Label>
              <Select value={form.assignedTechnicianId ?? "none"} onValueChange={onTechPick}>
                <SelectTrigger data-testid="form-tech"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {workers.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Team</Label>
              <Select value={form.assignedTeamId ?? "none"} onValueChange={onTeamPick}>
                <SelectTrigger data-testid="form-team"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Frequency *</Label>
              <Select value={form.serviceFrequency ?? "Monthly"} onValueChange={(v) => setForm(f => ({ ...f, serviceFrequency: v }))}>
                <SelectTrigger data-testid="form-freq"><SelectValue /></SelectTrigger>
                <SelectContent>{FREQUENCIES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div>
              <Label>Service Week *</Label>
              <Select value={String(form.serviceWeek ?? 1)} onValueChange={(v) => setForm(f => ({ ...f, serviceWeek: Number(v) }))}>
                <SelectTrigger data-testid="form-week"><SelectValue /></SelectTrigger>
                <SelectContent>{WEEKS.map(w => <SelectItem key={w} value={String(w)}>Week {w}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div>
              <Label>Service Day *</Label>
              <Select value={form.serviceDay ?? "Monday"} onValueChange={(v) => setForm(f => ({ ...f, serviceDay: v }))}>
                <SelectTrigger data-testid="form-day"><SelectValue /></SelectTrigger>
                <SelectContent>{DAYS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div>
              <Label>Job Sequence #</Label>
              <Input
                type="number" min={0}
                value={form.jobSequence ?? ""}
                onChange={e => setForm(f => ({ ...f, jobSequence: e.target.value === "" ? 0 : Number(e.target.value) }))}
                placeholder="auto"
                data-testid="form-seq"
              />
              <p className="text-[10px] text-gray-400 mt-0.5">Leave blank to auto-append next number for that day</p>
            </div>

            <div>
              <Label>Default Start Time</Label>
              <Input
                type="time"
                value={form.defaultStartTime ?? "07:30"}
                onChange={e => setForm(f => ({ ...f, defaultStartTime: e.target.value }))}
                data-testid="form-time"
              />
            </div>

            <div>
              <Label>Est. Duration (min)</Label>
              <Input
                type="number" min={0}
                value={form.estimatedDuration ?? ""}
                onChange={e => setForm(f => ({ ...f, estimatedDuration: e.target.value ? Number(e.target.value) : undefined }))}
                data-testid="form-duration"
              />
            </div>

            <div className="col-span-2">
              <Label>Google Maps Link</Label>
              <Input
                value={form.googleMapsLink ?? ""}
                onChange={e => setForm(f => ({ ...f, googleMapsLink: e.target.value }))}
                placeholder="https://maps.google.com/…"
                data-testid="form-maps"
              />
            </div>

            <div className="col-span-2">
              <Label>Address</Label>
              <Input
                value={form.address ?? ""}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                data-testid="form-address"
              />
            </div>

            <div className="col-span-2">
              <Label>Notes</Label>
              <Textarea
                rows={2}
                value={form.notes ?? ""}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                data-testid="form-notes"
              />
            </div>

            <div className="col-span-2 flex items-center gap-3 pt-1">
              <Switch
                checked={form.activeStatus !== false}
                onCheckedChange={(v) => setForm(f => ({ ...f, activeStatus: v }))}
                data-testid="form-active"
              />
              <span className="text-sm">Active</span>
              <span className="text-xs text-gray-400">(inactive sequences are skipped when generating jobs)</span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={() => save.mutate(form)} disabled={!canSave || save.isPending} data-testid="form-save">
              {save.isPending ? "Saving…" : editing ? "Save changes" : "Add to sequence"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Monthly Jobs dialog */}
      <Dialog open={showGenerate} onOpenChange={setShowGenerate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Generate monthly jobs</DialogTitle>
            <DialogDescription>
              Creates real job cards from every active sequence for the chosen month.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 py-2">
            <div>
              <Label>Month</Label>
              <Select value={String(genMonth)} onValueChange={v => setGenMonth(Number(v))}>
                <SelectTrigger data-testid="gen-month"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Year</Label>
              <Input
                type="number"
                value={genYear}
                onChange={e => setGenYear(Number(e.target.value) || now.getFullYear())}
                data-testid="gen-year"
              />
            </div>
            <div className="col-span-2">
              <Label>Department (optional)</Label>
              <Select value={genDept} onValueChange={setGenDept}>
                <SelectTrigger data-testid="gen-dept"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All departments</SelectItem>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Technician (optional)</Label>
              <Select value={genTech} onValueChange={setGenTech}>
                <SelectTrigger data-testid="gen-tech"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All technicians</SelectItem>
                  {workers.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Team (optional)</Label>
              <Select value={genTeam} onValueChange={setGenTeam}>
                <SelectTrigger data-testid="gen-team"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All teams</SelectItem>
                  {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 flex items-center gap-3 pt-1">
              <Switch checked={skipDupes} onCheckedChange={setSkipDupes} data-testid="gen-skip-dupes" />
              <span className="text-sm">Skip duplicates</span>
              <span className="text-xs text-gray-400">(don't recreate jobs already on the schedule)</span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerate(false)}>Cancel</Button>
            <Button onClick={() => generate.mutate()} disabled={generate.isPending} data-testid="gen-confirm">
              {generate.isPending ? "Generating…" : "Generate jobs"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
