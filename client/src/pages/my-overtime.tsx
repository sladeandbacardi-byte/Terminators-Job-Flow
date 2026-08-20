import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { format } from "date-fns";
import { CheckCircle2, Clock3, Edit3, FileClock, History, Plus, Save, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { calculateOvertimeMinutes, formatOvertimeMinutes } from "@shared/overtime";
import type { Client, Job } from "@shared/schema";

type OvertimeStatus = "pending" | "approved" | "rejected";

type OvertimeEntry = {
  id: string;
  employeeId: string;
  employeeName: string;
  workDate: string;
  clientId: string;
  clientName: string;
  jobId: string | null;
  jobLabel: string | null;
  startTime: string;
  finishTime: string;
  notes: string;
  overtimeMinutes: number;
  status: OvertimeStatus;
  approvedByName: string | null;
  approvalTimestamp: string | null;
  rejectionReason: string | null;
  createdAt: string;
};

type AuditEvent = {
  id: string;
  actorName: string;
  action: string;
  details: string | null;
  createdAt: string;
};

type FormState = {
  workDate: string;
  clientId: string;
  jobId: string;
  startTime: string;
  finishTime: string;
  notes: string;
};

const today = () => new Date().toISOString().slice(0, 10);
const newEntry = (): FormState => ({
  workDate: today(),
  clientId: "",
  jobId: "",
  startTime: "",
  finishTime: "",
  notes: "",
});

const statusStyle: Record<OvertimeStatus, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
  rejected: "bg-red-100 text-red-800 border-red-200",
};

function readableDate(date: string) {
  return format(new Date(`${date}T12:00:00`), "dd MMM yyyy");
}

export default function MyOvertime() {
  const { user } = useAuth();
  const { toast } = useToast();
  const search = useSearch();
  const jobFromUrl = new URLSearchParams(search).get("job");
  const appliedPrefill = useRef<string | null>(null);
  const [form, setForm] = useState<FormState>(newEntry);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [auditEntry, setAuditEntry] = useState<OvertimeEntry | null>(null);

  const { data: overtimeData, isLoading } = useQuery<{
    entries: OvertimeEntry[];
    summary: { pendingMinutes: number; approvedMinutes: number };
  }>({ queryKey: ["/api/overtime/my"] });
  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: jobs = [] } = useQuery<Job[]>({ queryKey: ["/api/jobs"] });
  const { data: prefill } = useQuery<{ clientId: string; jobId: string; workDate: string }>({
    queryKey: ["/api/overtime/prefill", jobFromUrl],
    enabled: Boolean(jobFromUrl),
  });
  const { data: audit = [], isLoading: loadingAudit } = useQuery<AuditEvent[]>({
    queryKey: ["/api/overtime", auditEntry?.id, "audit"],
    enabled: Boolean(auditEntry),
  });

  useEffect(() => {
    if (!prefill || !jobFromUrl || appliedPrefill.current === jobFromUrl) return;
    setEditingId(null);
    setForm({
      workDate: prefill.workDate,
      clientId: prefill.clientId,
      jobId: prefill.jobId,
      startTime: "",
      finishTime: "",
      notes: "",
    });
    appliedPrefill.current = jobFromUrl;
  }, [prefill, jobFromUrl]);

  const overtimeMinutes = useMemo(
    () => calculateOvertimeMinutes(form.startTime, form.finishTime),
    [form.startTime, form.finishTime],
  );
  const jobsForClient = useMemo(
    () => jobs.filter(job => !form.clientId || job.clientId === form.clientId),
    [jobs, form.clientId],
  );

  const saveEntry = useMutation({
    mutationFn: async () => {
      const endpoint = editingId ? `/api/overtime/${editingId}` : "/api/overtime";
      const response = await apiRequest(editingId ? "PATCH" : "POST", endpoint, {
        ...form,
        jobId: form.jobId || null,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/overtime/my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/overtime"] });
      toast({
        title: editingId ? "Overtime updated" : "Overtime submitted",
        description: editingId ? "Your pending overtime entry was updated." : "Your overtime entry is ready for approval.",
      });
      setEditingId(null);
      setForm(newEntry());
      window.history.replaceState(null, "", window.location.pathname);
    },
    onError: (error: Error) => toast({ title: "Could not save overtime", description: error.message, variant: "destructive" }),
  });

  const startEditing = (entry: OvertimeEntry) => {
    setEditingId(entry.id);
    setForm({
      workDate: entry.workDate,
      clientId: entry.clientId,
      jobId: entry.jobId ?? "",
      startTime: entry.startTime,
      finishTime: entry.finishTime,
      notes: entry.notes,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(newEntry());
    window.history.replaceState(null, "", window.location.pathname);
  };

  const canSave = Boolean(
    form.workDate && form.clientId && form.startTime && form.finishTime && form.notes.trim() && overtimeMinutes && overtimeMinutes > 0,
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-red-700 mb-1">
            <Clock3 className="h-5 w-5" />
            <span className="text-sm font-semibold">Time outside normal hours</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">My Overtime</h1>
          <p className="text-sm text-gray-500 mt-1">Log time worked before 08:00 or after 16:00. Normal hours are never included.</p>
        </div>
        <Badge variant="outline" className="w-fit px-3 py-1.5 text-sm">
          Employee: {user?.username || [user?.firstName, user?.lastName].filter(Boolean).join(" ")}
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Pending approval</p>
          <p className="mt-1 text-2xl font-bold text-amber-900">{formatOvertimeMinutes(overtimeData?.summary.pendingMinutes ?? 0)}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Approved total</p>
          <p className="mt-1 text-2xl font-bold text-emerald-900">{formatOvertimeMinutes(overtimeData?.summary.approvedMinutes ?? 0)}</p>
        </div>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-4 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-gray-900">{editingId ? "Edit pending overtime" : "Log overtime"}</h2>
          <p className="mt-1 text-sm text-gray-500">Your employee name is taken from your signed-in profile. Overtime is calculated automatically.</p>
        </div>
        <form
          className="p-4 sm:p-6 space-y-5"
          onSubmit={event => {
            event.preventDefault();
            if (canSave) saveEntry.mutate();
          }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-gray-700">Date worked</span>
              <Input type="date" value={form.workDate} onChange={event => setForm(current => ({ ...current, workDate: event.target.value }))} required />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-gray-700">Start time</span>
              <Input type="time" value={form.startTime} onChange={event => setForm(current => ({ ...current, startTime: event.target.value }))} required />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-gray-700">Finish time</span>
              <Input type="time" value={form.finishTime} onChange={event => setForm(current => ({ ...current, finishTime: event.target.value }))} required />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-gray-700">Client</span>
              <Select
                value={form.clientId}
                onValueChange={clientId => setForm(current => ({
                  ...current,
                  clientId,
                  jobId: current.jobId && jobs.find(job => job.id === current.jobId)?.clientId === clientId ? current.jobId : "",
                }))}
              >
                <SelectTrigger><SelectValue placeholder="Select a client" /></SelectTrigger>
                <SelectContent>
                  {clients.map(client => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-gray-700">Job card <span className="font-normal text-gray-400">(optional)</span></span>
              <Select value={form.jobId || "__none__"} onValueChange={jobId => {
                if (jobId === "__none__") return setForm(current => ({ ...current, jobId: "" }));
                const job = jobs.find(item => item.id === jobId);
                setForm(current => ({ ...current, jobId, clientId: job?.clientId ?? current.clientId }));
              }}>
                <SelectTrigger><SelectValue placeholder="No job card" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No job card</SelectItem>
                  {jobsForClient.map(job => <SelectItem key={job.id} value={job.id}>{job.jobNumber || job.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
            <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Calculated overtime</p>
              <p className="mt-0.5 text-xl font-bold text-red-900">
                {overtimeMinutes === null ? "Enter valid times" : formatOvertimeMinutes(overtimeMinutes)}
              </p>
            </div>
          </div>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-gray-700">Notes / reason</span>
            <Textarea
              value={form.notes}
              onChange={event => setForm(current => ({ ...current, notes: event.target.value }))}
              placeholder="Why was overtime required?"
              rows={3}
              required
            />
          </label>

          {overtimeMinutes === 0 && form.startTime && form.finishTime && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
              No overtime detected. Normal working hours are 08:00 to 16:00.
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {editingId && <Button type="button" variant="outline" onClick={resetForm}>Cancel edit</Button>}
            <Button type="submit" disabled={!canSave || saveEntry.isPending} className="bg-red-600 hover:bg-red-700">
              {editingId ? <Save className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              {saveEntry.isPending ? "Saving…" : editingId ? "Save changes" : "Submit overtime"}
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-4 sm:px-6 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">My overtime history</h2>
            <p className="text-sm text-gray-500">Approved entries are locked until a manager reopens them.</p>
          </div>
          <FileClock className="h-5 w-5 text-gray-400" />
        </div>
        {isLoading ? (
          <div className="px-6 py-12 text-center text-sm text-gray-500">Loading overtime history…</div>
        ) : overtimeData?.entries.length ? (
          <div className="divide-y divide-gray-100">
            {overtimeData.entries.map(entry => (
              <article key={entry.id} className="p-4 sm:px-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-gray-900">{readableDate(entry.workDate)}</p>
                    <Badge variant="outline" className={statusStyle[entry.status]}>{entry.status}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-gray-600">{entry.clientName}{entry.jobLabel ? ` · ${entry.jobLabel}` : ""}</p>
                  <p className="mt-1 text-xs text-gray-500">{entry.startTime}–{entry.finishTime} · {entry.notes}</p>
                  {entry.status === "approved" && entry.approvedByName && (
                    <p className="mt-1 text-xs text-emerald-700">Approved by {entry.approvedByName}{entry.approvalTimestamp ? ` on ${format(new Date(entry.approvalTimestamp), "dd MMM yyyy, HH:mm")}` : ""}</p>
                  )}
                  {entry.status === "rejected" && entry.rejectionReason && <p className="mt-1 text-xs text-red-700">Reason: {entry.rejectionReason}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <span className="mr-1 text-lg font-bold text-gray-900">{formatOvertimeMinutes(entry.overtimeMinutes)}</span>
                  {entry.status === "pending" && (
                    <Button size="sm" variant="outline" onClick={() => startEditing(entry)}>
                      <Edit3 className="h-3.5 w-3.5 mr-1.5" />Edit
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setAuditEntry(entry)}>
                    <History className="h-3.5 w-3.5 mr-1.5" />History
                  </Button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="px-6 py-12 text-center">
            <Clock3 className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-3 font-medium text-gray-700">No overtime logged yet</p>
            <p className="mt-1 text-sm text-gray-500">Use the form above when you work outside 08:00–16:00.</p>
          </div>
        )}
      </section>

      <Dialog open={Boolean(auditEntry)} onOpenChange={open => !open && setAuditEntry(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Overtime history</DialogTitle>
            <DialogDescription>{auditEntry ? `${readableDate(auditEntry.workDate)} · ${formatOvertimeMinutes(auditEntry.overtimeMinutes)}` : ""}</DialogDescription>
          </DialogHeader>
          {loadingAudit ? <p className="py-6 text-center text-sm text-gray-500">Loading history…</p> : (
            <ol className="space-y-4">
              {audit.map(event => (
                <li key={event.id} className="relative border-l-2 border-gray-200 pl-4">
                  <span className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-red-500" />
                  <p className="text-sm font-medium text-gray-900 capitalize">{event.action}</p>
                  <p className="text-xs text-gray-600">by {event.actorName} · {format(new Date(event.createdAt), "dd MMM yyyy, HH:mm")}</p>
                  {event.details && <p className="mt-1 text-xs text-gray-500">{event.details.includes("reason") ? event.details.replace(/[{}"]/g, "").replace("reason:", "") : ""}</p>}
                </li>
              ))}
            </ol>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}