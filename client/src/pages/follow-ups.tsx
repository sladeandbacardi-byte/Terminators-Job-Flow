import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format, isPast, isToday, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Check, Phone, Mail, MessageSquare, Users, AlertTriangle, Clock } from "lucide-react";
import type { SalesFollowUp, QuoteSubmission, Worker } from "@shared/schema";

const METHODS = ["Phone call", "Email", "WhatsApp", "Client visit", "Other"];
const FU_TYPES = [
  { value: "first_followup",  label: "First Follow-up (2 days)" },
  { value: "second_followup", label: "Second Follow-up (7 days)" },
  { value: "manual",          label: "Manual / Ad-hoc" },
  { value: "after_sales",     label: "After-sales Follow-up" },
];

function MethodIcon({ m }: { m: string | null | undefined }) {
  if (m === "Phone call") return <Phone className="h-3 w-3" />;
  if (m === "Email") return <Mail className="h-3 w-3" />;
  if (m === "WhatsApp") return <MessageSquare className="h-3 w-3" />;
  if (m === "Client visit") return <Users className="h-3 w-3" />;
  return <Clock className="h-3 w-3" />;
}

type FU = SalesFollowUp & { lead?: QuoteSubmission };

export default function FollowUpsPage() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<"active"|"overdue"|"today"|"completed"|"all">("active");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SalesFollowUp | null>(null);
  const [form, setForm] = useState<Partial<SalesFollowUp>>({});
  const [completeId, setCompleteId] = useState<string | null>(null);
  const [completeNote, setCompleteNote] = useState("");

  const { data: followUps = [], isLoading } = useQuery<SalesFollowUp[]>({ queryKey: ["/api/sales-follow-ups"] });
  const { data: leads = [] } = useQuery<QuoteSubmission[]>({ queryKey: ["/api/quote-submissions"] });
  const { data: workers = [] } = useQuery<Worker[]>({ queryKey: ["/api/workers"] });

  const enriched: FU[] = useMemo(() =>
    followUps.map(fu => ({ ...fu, lead: leads.find(l => l.id === fu.leadId) })),
    [followUps, leads]);

  const overdue = enriched.filter(f => f.status === "pending" && f.dueDate && isPast(parseISO(f.dueDate)) && !isToday(parseISO(f.dueDate)));
  const todayDue = enriched.filter(f => f.status === "pending" && f.dueDate && isToday(parseISO(f.dueDate)));
  const upcoming = enriched.filter(f => f.status === "pending" && f.dueDate && !isPast(parseISO(f.dueDate)));
  const completed = enriched.filter(f => f.status === "completed");

  const displayed = useMemo(() => ({
    active:    [...overdue, ...todayDue, ...upcoming],
    overdue,
    today:     todayDue,
    completed,
    all:       enriched,
  }[statusFilter] ?? enriched), [statusFilter, enriched, overdue, todayDue, upcoming, completed]);

  const save = useMutation({
    mutationFn: () => editing
      ? apiRequest("PUT", `/api/sales-follow-ups/${editing.id}`, form)
      : apiRequest("POST", "/api/sales-follow-ups", { ...form, status: "pending" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-follow-ups"] });
      setOpen(false);
      toast({ title: editing ? "Follow-up updated" : "Follow-up created" });
    },
    onError: () => toast({ title: "Save failed", variant: "destructive" }),
  });

  const complete = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      apiRequest("PUT", `/api/sales-follow-ups/${id}`, {
        status: "completed",
        completedAt: new Date().toISOString().split("T")[0],
        notes,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-follow-ups"] });
      setCompleteId(null); setCompleteNote("");
      toast({ title: "Follow-up marked complete" });
    },
  });

  function openNew() { setEditing(null); setForm({ method: "Phone call" }); setOpen(true); }
  function openEdit(fu: SalesFollowUp) { setEditing(fu); setForm({ ...fu }); setOpen(true); }

  function dueBadge(dueDate: string | null | undefined) {
    if (!dueDate) return null;
    try {
      const d = parseISO(dueDate);
      if (isToday(d)) return <Badge className="bg-amber-100 text-amber-700 border-0 text-[11px]">Today</Badge>;
      if (isPast(d))  return <Badge className="bg-red-100 text-red-700 border-0 text-[11px]">Overdue</Badge>;
      return <span className="text-xs text-gray-500">{format(d, "d MMM yyyy")}</span>;
    } catch { return <span className="text-xs text-gray-400">{dueDate}</span>; }
  }

  const workerName = (id: string | null | undefined) => workers.find(w => w.id === id)?.name;

  const TABS = [
    { v: "active",    l: "Active",   count: overdue.length + todayDue.length + upcoming.length },
    { v: "overdue",   l: "Overdue",  count: overdue.length },
    { v: "today",     l: "Today",    count: todayDue.length },
    { v: "completed", l: "Done",     count: completed.length },
    { v: "all",       l: "All",      count: enriched.length },
  ] as const;

  return (
      <>
        <div className="p-4 sm:p-6 pb-20 lg:pb-6">
          <div className="max-w-5xl mx-auto space-y-4">

            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Overdue",   n: overdue.length,   cls: "bg-red-50 border-red-200 text-red-700" },
                { label: "Due Today", n: todayDue.length,  cls: "bg-amber-50 border-amber-200 text-amber-700" },
                { label: "Upcoming",  n: upcoming.length,  cls: "bg-blue-50 border-blue-200 text-blue-700" },
                { label: "Completed", n: completed.length, cls: "bg-green-50 border-green-200 text-green-700" },
              ].map(s => (
                <div key={s.label} className={`border rounded-xl p-3 ${s.cls.replace(/text-\w+-\d+/, "")}`}>
                  <div className={`text-2xl font-bold ${s.cls.split(" ").find(c => c.startsWith("text-"))}`}>{s.n}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Filter bar */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex gap-1.5 flex-wrap">
                {TABS.map(t => (
                  <button key={t.v} onClick={() => setStatusFilter(t.v as any)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border transition ${
                      statusFilter === t.v ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                    }`}>
                    {t.l}
                    {t.count > 0 && <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${statusFilter === t.v ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600"}`}>{t.count}</span>}
                  </button>
                ))}
              </div>
              <Button onClick={openNew} size="sm" className="h-8 gap-1 text-xs">
                <Plus className="h-3.5 w-3.5" /> Add Follow-up
              </Button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {isLoading ? (
                <div className="py-12 text-center text-gray-400">Loading…</div>
              ) : displayed.length === 0 ? (
                <div className="py-12 text-center">
                  <Check className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <div className="text-gray-400 text-sm">No follow-ups to show.</div>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b text-left">
                    <tr>
                      <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Client / Lead</th>
                      <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Method</th>
                      <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Due</th>
                      <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Assigned</th>
                      <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">Notes</th>
                      <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayed.map(fu => (
                      <tr key={fu.id} className="border-t border-gray-50 hover:bg-gray-50/50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{fu.lead?.companyName ?? "—"}</div>
                          <div className="text-xs text-gray-400">{fu.lead?.contactPerson} {fu.lead?.phone ? `· ${fu.lead.phone}` : ""}</div>
                          {fu.type && (
                            <div className="text-[11px] text-blue-600 mt-0.5">
                              {FU_TYPES.find(t => t.value === fu.type)?.label ?? fu.type}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className="flex items-center gap-1.5 text-xs text-gray-600">
                            <MethodIcon m={fu.method} /> {fu.method ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3">{dueBadge(fu.dueDate)}</td>
                        <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-500">
                          {workerName(fu.assignedTo) ?? "—"}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-400 max-w-[200px] truncate">
                          {fu.notes || "—"}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {fu.status !== "completed" && (
                            <Button size="sm" variant="outline"
                              onClick={() => { setCompleteId(fu.id); setCompleteNote(fu.notes ?? ""); }}
                              className="h-7 text-xs gap-1 mr-1">
                              <Check className="h-3 w-3" /> Done
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => openEdit(fu)} className="h-7 text-xs">Edit</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

      {/* Mark complete dialog */}
      <Dialog open={!!completeId} onOpenChange={o => { if (!o) { setCompleteId(null); setCompleteNote(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Mark Follow-up Complete</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Outcome / Notes</Label>
            <Textarea rows={3} value={completeNote} onChange={e => setCompleteNote(e.target.value)}
              placeholder="What happened? Any next steps?" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCompleteId(null); setCompleteNote(""); }}>Cancel</Button>
            <Button onClick={() => completeId && complete.mutate({ id: completeId, notes: completeNote })}
              disabled={complete.isPending}>
              {complete.isPending ? "Saving…" : "Mark Complete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add / Edit dialog */}
      <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) setEditing(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Edit Follow-up" : "New Follow-up"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="col-span-2">
              <Label>Lead / Client</Label>
              <Select value={form.leadId ?? "_none"} onValueChange={v => setForm(p => ({ ...p, leadId: v === "_none" ? undefined : v }))}>
                <SelectTrigger><SelectValue placeholder="Link to a lead" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— Not linked —</SelectItem>
                  {leads.map(l => <SelectItem key={l.id} value={l.id}>{l.companyName} ({l.contactPerson})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Due Date *</Label>
              <Input type="date" value={form.dueDate ?? ""} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} />
            </div>
            <div>
              <Label>Method</Label>
              <Select value={form.method ?? "Phone call"} onValueChange={v => setForm(p => ({ ...p, method: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Type</Label>
              <Select value={form.type ?? "_none"} onValueChange={v => setForm(p => ({ ...p, type: v === "_none" ? undefined : v }))}>
                <SelectTrigger><SelectValue placeholder="Follow-up type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— General —</SelectItem>
                  {FU_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Assigned To</Label>
              <Select value={form.assignedTo ?? "_none"} onValueChange={v => setForm(p => ({ ...p, assignedTo: v === "_none" ? undefined : v }))}>
                <SelectTrigger><SelectValue placeholder="Assign" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— Unassigned —</SelectItem>
                  {workers.filter(w => w.isActive !== false).map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Notes</Label>
              <Textarea rows={2} value={form.notes ?? ""} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending || !form.dueDate}>
              {save.isPending ? "Saving…" : editing ? "Save Changes" : "Create Follow-up"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </>
  );
}
