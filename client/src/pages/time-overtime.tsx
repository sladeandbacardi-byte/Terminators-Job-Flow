import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Clock3, History, Plus, RotateCcw, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { calculateOvertimeBreakdown, formatOvertimeMinutes } from "@shared/overtime";
import { OVERTIME_WORK_TYPE_LABELS, TIME_OFF_REASON_LABELS, type Client, type Job, type Worker } from "@shared/schema";
import { EmailNotificationDetails } from "@/components/time/email-notification-details";

type Entry = {
  id: string;
  entryType: "OVERTIME" | "AUTHORISED_TIME_OFF";
  employeeId: string;
  employeeName: string;
  workDate: string;
  startTime: string;
  finishTime: string;
  overtimeMinutes: number;
  status: "pending" | "approved" | "rejected";
  notes: string;
  clientId?: string | null;
  clientName?: string;
  jobId?: string | null;
  jobLabel?: string | null;
  workType?: keyof typeof OVERTIME_WORK_TYPE_LABELS;
  otherDescription?: string | null;
  timeOffReason?: keyof typeof TIME_OFF_REASON_LABELS | string | null;
  timeOffOtherReason?: string | null;
  rejectionReason?: string | null;
  approvedByName?: string | null;
};

type Summary = {
  approvedOvertimeMinutes: number;
  approvedTimeOffMinutes: number;
  pendingOvertimeMinutes: number;
  pendingTimeOffMinutes: number;
};

const today = () => new Date().toISOString().slice(0, 10);

const formatAuditDetails = (details?: string | null) => {
  if (!details) return null;
  try {
    const parsed = JSON.parse(details) as { submittedBy?: string; onBehalfOf?: string };
    if (parsed.submittedBy && parsed.onBehalfOf) {
      return `Submitted by ${parsed.submittedBy} on behalf of ${parsed.onBehalfOf}`;
    }
  } catch {
    // Older audit entries may contain plain text details.
  }
  return details;
};

const statusClass = (status: Entry["status"]) =>
  status === "approved"
    ? "bg-emerald-100 text-emerald-800"
    : status === "rejected"
      ? "bg-red-100 text-red-800"
      : "bg-amber-100 text-amber-800";

const entryReason = (entry: Entry) => {
  if (entry.entryType === "AUTHORISED_TIME_OFF") {
    if (entry.timeOffReason === "other") return entry.timeOffOtherReason || "Other";
    return (entry.timeOffReason && TIME_OFF_REASON_LABELS[entry.timeOffReason as keyof typeof TIME_OFF_REASON_LABELS]) || "Authorised Time Off";
  }
  if (entry.workType === "other") return entry.otherDescription || "Other";
  return (entry.workType && OVERTIME_WORK_TYPE_LABELS[entry.workType]) || "Overtime";
};

export default function TimeOvertime() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = ["admin", "superadmin"].includes(String(user?.role || "").toLowerCase());
  const [employeeId, setEmployeeId] = useState("all");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [clientId, setClientId] = useState("all");
  const [jobId, setJobId] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [overtimeOpen, setOvertimeOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [auditEntry, setAuditEntry] = useState<Entry | null>(null);
  const [rejection, setRejection] = useState<Entry | null>(null);
  const [form, setForm] = useState({
    employeeId: "",
    workDate: today(),
    startTime: "",
    finishTime: "",
    reason: "gap_between_jobs",
    otherReason: "",
    notes: "",
    overrideConflictReason: "",
  });
  const [overtimeForm, setOvertimeForm] = useState({
    employeeId: "",
    workDate: today(),
    startTime: "",
    finishTime: "",
    workType: "client_job",
    clientId: "",
    notes: "",
  });
  const [lastViewedEmployeeId, setLastViewedEmployeeId] = useState("");

  const url = useMemo(() => {
    const params = new URLSearchParams();
    if (employeeId !== "all") params.set("employeeId", employeeId);
    if (status !== "all") params.set("status", status);
    if (type !== "all") params.set("type", type);
    if (clientId !== "all") params.set("clientId", clientId);
    if (jobId !== "all") params.set("jobId", jobId);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return `/api/time${params.toString() ? `?${params}` : ""}`;
  }, [clientId, employeeId, from, jobId, status, to, type]);

  const { data = { entries: [], summary: {} as Summary }, isLoading, isError } =
    useQuery<{ entries: Entry[]; summary: Summary }>({ queryKey: [url] });
  const { data: workers = [] } = useQuery<Worker[]>({ queryKey: ["/api/workers"] });
  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: jobs = [] } = useQuery<Job[]>({ queryKey: ["/api/jobs"] });
  const activeWorkers = useMemo(() => workers.filter(worker => worker.isActive !== false), [workers]);
  const overtimeCalculation = useMemo(
    () => calculateOvertimeBreakdown(overtimeForm.startTime, overtimeForm.finishTime)?.totalMinutes ?? 0,
    [overtimeForm.finishTime, overtimeForm.startTime],
  );
  const { data: audit = [] } = useQuery<any[]>({
    queryKey: ["/api/overtime", auditEntry?.id, "audit"],
    enabled: Boolean(auditEntry),
    refetchInterval: auditEntry ? 2000 : false,
  });
  const timelineUrl = timelineOpen && employeeId !== "all" && from
    ? `/api/time/timeline?employeeId=${employeeId}&date=${from}`
    : "";
  const { data: timeline } = useQuery<{ items: any[] }>({
    queryKey: [timelineUrl],
    enabled: Boolean(timelineUrl),
  });

  useEffect(() => {
    const requestedId = new URLSearchParams(window.location.search).get("entry");
    const requested = requestedId ? data.entries.find(entry => entry.id === requestedId) : undefined;
    if (requested) setAuditEntry(requested);
  }, [data.entries]);

  useEffect(() => {
    setLastViewedEmployeeId(localStorage.getItem("time-review-last-employee") || "");
  }, []);

  useEffect(() => {
    if (overtimeOpen && !overtimeForm.employeeId && activeWorkers.length) {
      const remembered = activeWorkers.some(worker => worker.id === lastViewedEmployeeId) ? lastViewedEmployeeId : "";
      setOvertimeForm(form => ({ ...form, employeeId: remembered || activeWorkers[0].id }));
    }
  }, [activeWorkers, lastViewedEmployeeId, overtimeForm.employeeId, overtimeOpen]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/time"] });
    queryClient.invalidateQueries({ queryKey: ["/api/time/my"] });
  };

  const action = useMutation({
    mutationFn: async ({ entry, kind, reason }: { entry: Entry; kind: "approve" | "reject" | "reopen"; reason?: string }) =>
      (await apiRequest(
        "POST",
        `${entry.entryType === "AUTHORISED_TIME_OFF" ? "/api/time-off" : "/api/overtime"}/${entry.id}/${kind}`,
        reason ? { reason } : {},
      )).json(),
    onSuccess: () => {
      refresh();
      toast({ title: "Time entry updated" });
    },
    onError: (error: Error) =>
      toast({ title: "Could not update entry", description: error.message, variant: "destructive" }),
  });

  const create = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/time-off", form)).json(),
    onSuccess: () => {
      refresh();
      setCreateOpen(false);
      setForm({
        employeeId: "",
        workDate: today(),
        startTime: "",
        finishTime: "",
        reason: "gap_between_jobs",
        otherReason: "",
        notes: "",
        overrideConflictReason: "",
      });
      toast({
        title: "Authorised Time Off created",
        description: "The approved entry and authorising manager are recorded.",
      });
    },
    onError: (error: Error) =>
      toast({ title: "Could not authorise Time Off", description: error.message, variant: "destructive" }),
  });

  const openOvertimeForm = () => {
    const selectedEmployee = employeeId !== "all" && activeWorkers.some(worker => worker.id === employeeId)
      ? employeeId
      : activeWorkers.find(worker => worker.id === lastViewedEmployeeId)?.id || activeWorkers[0]?.id || "";
    setOvertimeForm({
      employeeId: selectedEmployee,
      workDate: today(),
      startTime: "",
      finishTime: "",
      workType: "client_job",
      clientId: "",
      notes: "",
    });
    setOvertimeOpen(true);
  };

  const createOvertime = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/overtime", {
      employeeId: overtimeForm.employeeId,
      workDate: overtimeForm.workDate,
      startTime: overtimeForm.startTime,
      finishTime: overtimeForm.finishTime,
      workType: overtimeForm.workType,
      clientId: overtimeForm.workType === "client_job" ? overtimeForm.clientId : null,
      notes: overtimeForm.notes,
    })).json(),
    onSuccess: () => {
      refresh();
      setOvertimeOpen(false);
      toast({
        title: "Overtime entry created",
        description: "The entry is ready for approval and records you as the submitting manager.",
      });
    },
    onError: (error: Error) =>
      toast({ title: "Could not create overtime", description: error.message, variant: "destructive" }),
  });

  const resend = useMutation({
    mutationFn: async (entry: Entry) => (await apiRequest("POST", `/api/time-off/${entry.id}/resend-notification`)).json(),
    onSuccess: (_, entry) => {
      queryClient.invalidateQueries({ queryKey: ["/api/overtime", entry.id, "audit"] });
      toast({ title: "Time Off notification sent successfully." });
    },
    onError: (error: Error) =>
      toast({ title: "Could not resend Time Off notification", description: error.message, variant: "destructive" }),
  });

  const currentTab =
    type === "all" && status === "all"
      ? "all"
      : type === "OVERTIME" && status === "all"
        ? "overtime"
        : type === "AUTHORISED_TIME_OFF" && status === "all"
          ? "time-off"
          : type === "all" && status === "pending"
            ? "pending"
            : type === "all" && status === "approved"
              ? "approved"
              : type === "all" && status === "rejected"
                ? "rejected"
                : "custom";

  const setTab = (tab: string) => {
    const filters: Record<string, [string, string]> = {
      all: ["all", "all"],
      overtime: ["OVERTIME", "all"],
      "time-off": ["AUTHORISED_TIME_OFF", "all"],
      pending: ["all", "pending"],
      approved: ["all", "approved"],
      rejected: ["all", "rejected"],
    };
    const [nextType, nextStatus] = filters[tab] || ["all", "all"];
    setType(nextType);
    setStatus(nextStatus);
  };

  const canCreateOvertime = Boolean(
    overtimeForm.employeeId &&
      overtimeForm.workDate &&
      overtimeForm.startTime &&
      overtimeForm.finishTime &&
      overtimeCalculation > 0 &&
      overtimeForm.notes.trim() &&
      (overtimeForm.workType !== "client_job" || overtimeForm.clientId),
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <div className="flex flex-col justify-between gap-3 sm:flex-row">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-red-700">
            <Clock3 className="h-5 w-5" /> Management time review
          </p>
          <h1 className="mt-1 text-2xl font-bold">Time &amp; Overtime</h1>
          <p className="mt-1 text-sm text-slate-500">
            Review every employee&apos;s Overtime and authorised Time Off record in one place.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={openOvertimeForm} className="bg-red-600 hover:bg-red-700">
            <Plus className="mr-2 h-4 w-4" /> Add entry for employee
          </Button>
          <Button onClick={() => setCreateOpen(true)} className="bg-slate-900 hover:bg-slate-800">
            <Plus className="mr-2 h-4 w-4" /> Authorise Time Off
          </Button>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ["Pending Overtime", data.summary.pendingOvertimeMinutes, "amber", "Awaiting management approval"],
          ["Pending Time Off", data.summary.pendingTimeOffMinutes, "amber", "Awaiting management approval"],
          ["Approved Overtime This Month", data.summary.approvedOvertimeMinutes, "emerald", "Current calendar month"],
          ["Approved Time Off This Month", data.summary.approvedTimeOffMinutes, "slate", "Current calendar month"],
        ].map(([label, value, colour, caption]) => (
          <div
            key={String(label)}
            className={`rounded-xl border p-4 ${
              colour === "emerald"
                ? "border-emerald-200 bg-emerald-50"
                : colour === "amber"
                  ? "border-amber-200 bg-amber-50"
                  : "border-slate-200 bg-slate-50"
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</p>
            <p className="mt-2 text-2xl font-bold">{formatOvertimeMinutes(Number(value || 0))}</p>
            <p className="mt-1 text-xs text-slate-500">{caption}</p>
          </div>
        ))}
      </section>

      <section className="rounded-xl border bg-white p-4 shadow-sm">
        <Tabs value={currentTab} onValueChange={setTab}>
          <TabsList className="flex h-auto w-full justify-start overflow-x-auto">
            {[
              ["all", "ALL"],
              ["overtime", "OVERTIME"],
              ["time-off", "TIME OFF"],
              ["pending", "PENDING APPROVAL"],
              ["approved", "APPROVED"],
              ["rejected", "REJECTED"],
            ].map(([value, label]) => (
              <TabsTrigger key={value} value={value} className="min-w-max flex-1 px-3 py-2 text-xs sm:text-sm">
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            value={employeeId}
            onValueChange={value => {
              setEmployeeId(value);
              if (value !== "all") {
                setLastViewedEmployeeId(value);
                localStorage.setItem("time-review-last-employee", value);
              }
            }}
          >
            <SelectTrigger aria-label="Filter by employee"><SelectValue placeholder="Employee" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All employees</SelectItem>
              {activeWorkers.map(worker => <SelectItem key={worker.id} value={worker.id}>{worker.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={value => setType(value)}>
            <SelectTrigger aria-label="Filter by type"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="OVERTIME">Overtime</SelectItem>
              <SelectItem value="AUTHORISED_TIME_OFF">Authorised Time Off</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={value => setStatus(value)}>
            <SelectTrigger aria-label="Filter by status"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending approval</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger aria-label="Filter by client"><SelectValue placeholder="Client" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All clients</SelectItem>
              {clients.map(client => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={jobId} onValueChange={setJobId}>
            <SelectTrigger aria-label="Filter by job"><SelectValue placeholder="Job" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All jobs</SelectItem>
              {jobs.map(job => <SelectItem key={job.id} value={job.id}>{job.jobNumber || job.title}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={from} onChange={event => setFrom(event.target.value)} aria-label="From date" />
          <Input type="date" value={to} onChange={event => setTo(event.target.value)} aria-label="To date" />
        </div>
        {employeeId !== "all" && from && (
          <Button variant="outline" size="sm" className="mt-3" onClick={() => setTimelineOpen(true)}>
            View daily timeline
          </Button>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="border-b p-4 sm:px-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="font-semibold">Time records</h2>
              <p className="text-sm text-slate-500">
                {isError ? "Could not load time records." : `${data.entries.length} record${data.entries.length === 1 ? "" : "s"} shown`}
              </p>
            </div>
            <p className="text-xs text-slate-500">Use View for the full audit history and notification delivery.</p>
          </div>
        </div>
        {isLoading ? (
          <p className="p-8 text-sm text-slate-500">Loading management time records…</p>
        ) : data.entries.length ? (
          <div className="overflow-x-auto">
            <Table className="min-w-[1120px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Client / Job</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>Finish</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.entries.map(entry => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{entry.employeeName}</TableCell>
                    <TableCell className="whitespace-nowrap">{entry.workDate}</TableCell>
                    <TableCell>
                      <Badge className={entry.entryType === "OVERTIME" ? "bg-red-100 text-red-800" : "bg-slate-200 text-slate-800"}>
                        {entry.entryType === "OVERTIME" ? "Overtime" : "Time Off"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[190px]">
                        <p className="truncate">{entry.clientName || "—"}</p>
                        {entry.jobLabel && <p className="truncate text-xs text-slate-500">{entry.jobLabel}</p>}
                      </div>
                    </TableCell>
                    <TableCell>{entry.startTime}</TableCell>
                    <TableCell>{entry.finishTime}</TableCell>
                    <TableCell className="whitespace-nowrap font-semibold">{formatOvertimeMinutes(entry.overtimeMinutes)}</TableCell>
                    <TableCell className="max-w-[190px] text-sm">
                      <p>{entryReason(entry)}</p>
                      {entry.notes && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{entry.notes}</p>}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusClass(entry.status)}>{entry.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {entry.status === "pending" && (
                          <>
                            <Button size="sm" onClick={() => action.mutate({ entry, kind: "approve" })} disabled={action.isPending}>
                              <Check className="mr-1 h-3.5 w-3.5" /> Approve
                            </Button>
                            <Button size="sm" variant="outline" className="text-red-700" onClick={() => setRejection(entry)} disabled={action.isPending}>
                              <X className="mr-1 h-3.5 w-3.5" /> Reject
                            </Button>
                          </>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => setAuditEntry(entry)}>
                          <History className="mr-1 h-3.5 w-3.5" /> View
                        </Button>
                        {entry.status !== "pending" && (
                          <Button size="sm" variant="outline" onClick={() => action.mutate({ entry, kind: "reopen" })} disabled={action.isPending}>
                            <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reopen
                          </Button>
                        )}
                        {isAdmin && entry.entryType === "AUTHORISED_TIME_OFF" && (
                          <Button size="sm" variant="outline" disabled={resend.isPending} onClick={() => resend.mutate(entry)}>
                            Resend
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : isError ? (
          <p className="p-10 text-center text-sm text-red-700">Time records could not be loaded. Please refresh and try again.</p>
        ) : (
          <p className="p-10 text-center text-sm text-slate-500">No time records match these filters.</p>
        )}
      </section>

      <Dialog open={overtimeOpen} onOpenChange={setOvertimeOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add overtime entry for employee</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-500">This entry will be submitted on behalf of the selected employee and remain pending until approved.</p>
            <label className="block text-sm font-medium">
              Employee
              <Select value={overtimeForm.employeeId} onValueChange={employeeId => {
                setOvertimeForm(form => ({ ...form, employeeId }));
                setLastViewedEmployeeId(employeeId);
                localStorage.setItem("time-review-last-employee", employeeId);
              }}>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>{activeWorkers.map(worker => <SelectItem key={worker.id} value={worker.id}>{worker.name}</SelectItem>)}</SelectContent>
              </Select>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <Input type="date" value={overtimeForm.workDate} onChange={event => setOvertimeForm(form => ({ ...form, workDate: event.target.value }))} />
              <Input type="time" value={overtimeForm.startTime} onChange={event => setOvertimeForm(form => ({ ...form, startTime: event.target.value }))} />
              <Input type="time" value={overtimeForm.finishTime} onChange={event => setOvertimeForm(form => ({ ...form, finishTime: event.target.value }))} />
            </div>
            <label className="text-sm font-medium">
              Work type
              <Select value={overtimeForm.workType} onValueChange={workType => setOvertimeForm(form => ({ ...form, workType, clientId: workType === "client_job" ? form.clientId : "" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(OVERTIME_WORK_TYPE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
              </Select>
            </label>
            {overtimeForm.workType === "client_job" && (
              <label className="text-sm font-medium">
                Client
                <Select value={overtimeForm.clientId} onValueChange={clientId => setOvertimeForm(form => ({ ...form, clientId }))}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>{clients.map(client => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectContent>
                </Select>
              </label>
            )}
            <label className="block text-sm font-medium">
              Notes <span className="text-red-600">*</span>
              <Textarea value={overtimeForm.notes} onChange={event => setOvertimeForm(form => ({ ...form, notes: event.target.value }))} placeholder="Why was overtime required?" />
            </label>
            {overtimeForm.startTime && overtimeForm.finishTime && (
              <p className={`rounded-lg p-3 text-sm ${overtimeCalculation > 0 ? "bg-slate-50" : "bg-amber-50 text-amber-800"}`}>
                {overtimeCalculation > 0
                  ? <>Calculated overtime: <strong>{formatOvertimeMinutes(overtimeCalculation)}</strong></>
                  : "Finish time must be later than start time and include time outside normal hours."}
              </p>
            )}
            <Button disabled={!canCreateOvertime || createOvertime.isPending} className="w-full bg-red-600 hover:bg-red-700" onClick={() => createOvertime.mutate()}>
              {createOvertime.isPending ? "Saving…" : "Submit overtime"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Authorise Time Off</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Select value={form.employeeId} onValueChange={employeeId => setForm(current => ({ ...current, employeeId }))}>
              <SelectTrigger><SelectValue placeholder="Employee" /></SelectTrigger>
              <SelectContent>{workers.map(worker => <SelectItem key={worker.id} value={worker.id}>{worker.name}</SelectItem>)}</SelectContent>
            </Select>
            <div className="grid grid-cols-3 gap-2">
              <Input type="date" value={form.workDate} onChange={event => setForm(current => ({ ...current, workDate: event.target.value }))} />
              <Input type="time" value={form.startTime} onChange={event => setForm(current => ({ ...current, startTime: event.target.value }))} />
              <Input type="time" value={form.finishTime} onChange={event => setForm(current => ({ ...current, finishTime: event.target.value }))} />
            </div>
            <Select value={form.reason} onValueChange={reason => setForm(current => ({ ...current, reason }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(TIME_OFF_REASON_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
            </Select>
            {form.reason === "other" && <Input placeholder="Other reason" value={form.otherReason} onChange={event => setForm(current => ({ ...current, otherReason: event.target.value }))} />}
            <Textarea placeholder="Notes (optional)" value={form.notes} onChange={event => setForm(current => ({ ...current, notes: event.target.value }))} />
            <Textarea placeholder="Override reason (only if a scheduled job conflicts)" value={form.overrideConflictReason} onChange={event => setForm(current => ({ ...current, overrideConflictReason: event.target.value }))} />
            <Button className="w-full bg-slate-900" disabled={!form.employeeId || !form.startTime || !form.finishTime || create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? "Authorising…" : "Authorise"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(rejection)} onOpenChange={open => !open && setRejection(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject time entry</DialogTitle></DialogHeader>
          <Textarea id="reject-time-reason" placeholder="Reason (optional)" />
          <Button className="bg-red-600" onClick={() => {
            const reason = (document.getElementById("reject-time-reason") as HTMLTextAreaElement)?.value;
            if (rejection) action.mutate({ entry: rejection, kind: "reject", reason });
            setRejection(null);
          }}>Reject</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(auditEntry)} onOpenChange={open => !open && setAuditEntry(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>History &amp; email delivery</DialogTitle></DialogHeader>
          <EmailNotificationDetails audit={audit} />
          <p className="mt-5 border-t pt-4 text-xs font-semibold uppercase tracking-wide text-slate-600">Approval history</p>
          <ol className="mt-3 space-y-3">
            {audit.filter(event => !event.action.startsWith("TIME_")).map(event => (
              <li key={event.id} className="border-l-2 pl-3">
                <p className="capitalize font-medium">{event.action.replaceAll("_", " ").toLowerCase()}</p>
                <p className="text-xs text-slate-500">{event.actorName} · {new Date(event.createdAt).toLocaleString("en-ZA")}</p>
                {formatAuditDetails(event.details) && <p className="mt-1 text-xs text-slate-500">{formatAuditDetails(event.details)}</p>}
              </li>
            ))}
          </ol>
        </DialogContent>
      </Dialog>

      <Dialog open={timelineOpen} onOpenChange={setTimelineOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Daily timeline</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {timeline?.items?.map((item: any) => (
              <div key={`${item.type}-${item.id}`} className={`rounded-lg border p-3 ${item.type === "TIME_OFF" ? "border-slate-300 bg-slate-50" : item.type === "OVERTIME" ? "border-red-200 bg-red-50" : "border-blue-200 bg-blue-50"}`}>
                <p className="text-xs font-bold">{item.type === "JOB" ? "NORMAL WORK / JOB" : item.type === "TIME_OFF" ? "TIME OFF" : "OVERTIME"}</p>
                <p className="font-semibold">{item.startTime}–{item.finishTime} · {item.label}</p>
              </div>
            )) || <p className="text-sm text-slate-500">No timeline items.</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}