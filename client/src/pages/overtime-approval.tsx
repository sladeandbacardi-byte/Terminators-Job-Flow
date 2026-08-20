import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Check, CheckCheck, Clock3, Filter, History, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatOvertimeMinutes } from "@shared/overtime";
import type { Worker } from "@shared/schema";

type OvertimeStatus = "pending" | "approved" | "rejected";

type OvertimeEntry = {
  id: string;
  employeeId: string;
  employeeName: string;
  workDate: string;
  clientName: string;
  jobLabel: string | null;
  startTime: string;
  finishTime: string;
  notes: string;
  overtimeMinutes: number;
  status: OvertimeStatus;
  approvedByName: string | null;
  approvalTimestamp: string | null;
  rejectionReason: string | null;
};

type AuditEvent = {
  id: string;
  actorName: string;
  action: string;
  details: string | null;
  createdAt: string;
};

const statusStyle: Record<OvertimeStatus, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
  rejected: "bg-red-100 text-red-800 border-red-200",
};

function readableDate(date: string) {
  return format(new Date(`${date}T12:00:00`), "dd MMM yyyy");
}

export default function OvertimeApproval() {
  const { toast } = useToast();
  const [employeeId, setEmployeeId] = useState("all");
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [auditEntry, setAuditEntry] = useState<OvertimeEntry | null>(null);

  const overtimeUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (employeeId !== "all") params.set("employeeId", employeeId);
    if (status !== "all") params.set("status", status);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const query = params.toString();
    return query ? `/api/overtime?${query}` : "/api/overtime";
  }, [employeeId, status, from, to]);

  const { data: overtimeData, isLoading } = useQuery<{
    entries: OvertimeEntry[];
    summary: { pendingMinutes: number; approvedMinutes: number };
  }>({ queryKey: [overtimeUrl] });
  const { data: workers = [] } = useQuery<Worker[]>({ queryKey: ["/api/workers"] });
  const { data: audit = [], isLoading: loadingAudit } = useQuery<AuditEvent[]>({
    queryKey: ["/api/overtime", auditEntry?.id, "audit"],
    enabled: Boolean(auditEntry),
  });

  const refreshOvertime = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/overtime"] });
    queryClient.invalidateQueries({ queryKey: ["/api/overtime/my"] });
  };

  const action = useMutation({
    mutationFn: async ({ id, kind, reason }: { id: string; kind: "approve" | "reject" | "reopen"; reason?: string }) => {
      const response = await apiRequest("POST", `/api/overtime/${id}/${kind}`, reason ? { reason } : {});
      return response.json();
    },
    onSuccess: (_, variables) => {
      refreshOvertime();
      setSelectedIds(current => {
        const next = new Set(current);
        next.delete(variables.id);
        return next;
      });
      toast({ title: `Overtime ${variables.kind === "reopen" ? "reopened" : `${variables.kind}d`}` });
    },
    onError: (error: Error) => toast({ title: "Could not update overtime", description: error.message, variant: "destructive" }),
  });

  const bulkApprove = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/overtime/bulk-approve", { ids: [...selectedIds] });
      return response.json() as Promise<{ approvedCount: number }>;
    },
    onSuccess: result => {
      refreshOvertime();
      setSelectedIds(new Set());
      toast({ title: "Overtime approved", description: `${result.approvedCount} entr${result.approvedCount === 1 ? "y" : "ies"} approved.` });
    },
    onError: (error: Error) => toast({ title: "Could not approve selected overtime", description: error.message, variant: "destructive" }),
  });

  const entries = overtimeData?.entries ?? [];
  const pendingEntries = entries.filter(entry => entry.status === "pending");
  const allPendingSelected = pendingEntries.length > 0 && pendingEntries.every(entry => selectedIds.has(entry.id));

  const toggleSelected = (id: string, checked: boolean) => {
    setSelectedIds(current => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const reject = (entry: OvertimeEntry) => {
    const reason = window.prompt(`Reject ${entry.employeeName}'s overtime? You can add an optional reason.`);
    if (reason === null) return;
    action.mutate({ id: entry.id, kind: "reject", reason });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-red-700 mb-1">
            <CheckCheck className="h-5 w-5" />
            <span className="text-sm font-semibold">Management review</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Overtime Approval</h1>
          <p className="text-sm text-gray-500 mt-1">Review overtime worked outside 08:00–16:00 and keep an accountable approval trail.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Pending overtime</p>
          <p className="mt-1 text-2xl font-bold text-amber-900">{formatOvertimeMinutes(overtimeData?.summary.pendingMinutes ?? 0)}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Approved overtime</p>
          <p className="mt-1 text-2xl font-bold text-emerald-900">{formatOvertimeMinutes(overtimeData?.summary.approvedMinutes ?? 0)}</p>
        </div>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <h2 className="font-semibold text-gray-900">Filters</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger><SelectValue placeholder="All employees" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All employees</SelectItem>
                {workers.filter(worker => worker.isActive !== false).map(worker => <SelectItem key={worker.id} value={worker.id}>{worker.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue placeholder="All statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" aria-label="From date" value={from} onChange={event => setFrom(event.target.value)} />
            <Input type="date" aria-label="To date" value={to} onChange={event => setTo(event.target.value)} />
          </div>
          {(employeeId !== "all" || status !== "all" || from || to) && (
            <Button variant="ghost" size="sm" onClick={() => {
              setEmployeeId("all");
              setStatus("all");
              setFrom("");
              setTo("");
              setSelectedIds(new Set());
            }}>Clear filters</Button>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="p-4 sm:px-6 sm:py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Overtime entries</h2>
            <p className="text-sm text-gray-500">{entries.length} entry{entries.length === 1 ? "" : "ies"} shown</p>
          </div>
          <Button disabled={selectedIds.size === 0 || bulkApprove.isPending} onClick={() => bulkApprove.mutate()} className="bg-emerald-600 hover:bg-emerald-700">
            <CheckCheck className="h-4 w-4 mr-2" />Approve selected ({selectedIds.size})
          </Button>
        </div>

        {isLoading ? (
          <div className="px-6 py-12 text-center text-sm text-gray-500">Loading overtime entries…</div>
        ) : entries.length ? (
          <div className="divide-y divide-gray-100">
            {pendingEntries.length > 0 && (
              <label className="flex items-center gap-2 px-4 py-3 sm:px-6 bg-gray-50 text-sm font-medium text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allPendingSelected}
                  onChange={event => setSelectedIds(event.target.checked ? new Set(pendingEntries.map(entry => entry.id)) : new Set())}
                  className="h-4 w-4 accent-red-600"
                />
                Select all pending entries on this page
              </label>
            )}
            {entries.map(entry => (
              <article key={entry.id} className="p-4 sm:px-6 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex gap-3 min-w-0">
                  {entry.status === "pending" ? (
                    <input
                      aria-label={`Select ${entry.employeeName} overtime`}
                      type="checkbox"
                      checked={selectedIds.has(entry.id)}
                      onChange={event => toggleSelected(entry.id, event.target.checked)}
                      className="mt-1 h-4 w-4 shrink-0 accent-red-600"
                    />
                  ) : <span className="w-4 shrink-0" />}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-gray-900">{entry.employeeName}</p>
                      <Badge variant="outline" className={statusStyle[entry.status]}>{entry.status}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-gray-700">{readableDate(entry.workDate)} · {entry.clientName}{entry.jobLabel ? ` · ${entry.jobLabel}` : ""}</p>
                    <p className="mt-1 text-xs text-gray-500">{entry.startTime}–{entry.finishTime} · {entry.notes}</p>
                    {entry.status === "approved" && entry.approvedByName && (
                      <p className="mt-1 text-xs text-emerald-700">Approved by {entry.approvedByName}{entry.approvalTimestamp ? ` on ${format(new Date(entry.approvalTimestamp), "dd MMM yyyy, HH:mm")}` : ""}</p>
                    )}
                    {entry.status === "rejected" && entry.rejectionReason && <p className="mt-1 text-xs text-red-700">Reason: {entry.rejectionReason}</p>}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <span className="mr-1 text-lg font-bold text-gray-900">{formatOvertimeMinutes(entry.overtimeMinutes)}</span>
                  {entry.status === "pending" && (
                    <>
                      <Button size="sm" onClick={() => action.mutate({ id: entry.id, kind: "approve" })} disabled={action.isPending} className="bg-emerald-600 hover:bg-emerald-700">
                        <Check className="h-3.5 w-3.5 mr-1.5" />Approve
                      </Button>
                      <Button size="sm" variant="outline" className="text-red-700 border-red-200 hover:bg-red-50" onClick={() => reject(entry)} disabled={action.isPending}>
                        <X className="h-3.5 w-3.5 mr-1.5" />Reject
                      </Button>
                    </>
                  )}
                  {(entry.status === "approved" || entry.status === "rejected") && (
                    <Button size="sm" variant="outline" onClick={() => action.mutate({ id: entry.id, kind: "reopen" })} disabled={action.isPending}>
                      <RotateCcw className="h-3.5 w-3.5 mr-1.5" />Reopen
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
            <p className="mt-3 font-medium text-gray-700">No overtime entries match these filters</p>
            <p className="mt-1 text-sm text-gray-500">Try changing the filters or check again after staff submit overtime.</p>
          </div>
        )}
      </section>

      <Dialog open={Boolean(auditEntry)} onOpenChange={open => !open && setAuditEntry(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Approval history</DialogTitle>
            <DialogDescription>{auditEntry ? `${auditEntry.employeeName} · ${readableDate(auditEntry.workDate)}` : ""}</DialogDescription>
          </DialogHeader>
          {loadingAudit ? <p className="py-6 text-center text-sm text-gray-500">Loading history…</p> : (
            <ol className="space-y-4">
              {audit.map(event => (
                <li key={event.id} className="relative border-l-2 border-gray-200 pl-4">
                  <span className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-red-500" />
                  <p className="text-sm font-medium text-gray-900 capitalize">{event.action}</p>
                  <p className="text-xs text-gray-600">by {event.actorName} · {format(new Date(event.createdAt), "dd MMM yyyy, HH:mm")}</p>
                  {event.details?.includes("reason") && <p className="mt-1 text-xs text-gray-500">{event.details.replace(/[{}"]/g, "").replace("reason:", "")}</p>}
                </li>
              ))}
            </ol>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}