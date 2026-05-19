import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DepartmentOverview } from "./department-overview";
import { WorkerJobsSummary } from "./worker-jobs-summary";
import {
  Clock, AlertTriangle, ChevronDown, ChevronUp, ExternalLink, LayoutGrid,
} from "lucide-react";
import { format, isValid } from "date-fns";
import { Link } from "wouter";
import type { Job, Worker, Client, Department } from "@shared/schema";

const STATUS_COLORS: Record<string, string> = {
  completed:   "bg-green-100 text-green-800",
  in_progress: "bg-blue-100 text-blue-800",
  scheduled:   "bg-orange-100 text-orange-800",
  pending:     "bg-yellow-100 text-yellow-800",
  cancelled:   "bg-red-100 text-red-800",
};

function statusColor(status: string) {
  return STATUS_COLORS[status] ?? STATUS_COLORS[status.replace("-", "_")] ?? "bg-gray-100 text-gray-600";
}

function formatStatus(status: string) {
  const map: Record<string, string> = {
    in_progress:  "In Progress",
    "in-progress": "In Progress",
    scheduled:    "Scheduled",
    completed:    "Completed",
    cancelled:    "Cancelled",
    pending:      "Pending",
    unassigned:   "Unassigned",
    overdue:      "Overdue",
  };
  return map[status] ?? status.replace(/[_-]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

const SERVICE_DEPTS = [
  { id: "div-1", name: "Pest Control",   color: "#22c55e" },
  { id: "div-2", name: "Sanitary Bins",  color: "#8b5cf6" },
  { id: "div-3", name: "Washroom",       color: "#3b82f6" },
  { id: "div-4", name: "Deep Cleaning",  color: "#f59e0b" },
];

export function CoordinatorDashboard() {
  const [attentionExpanded, setAttentionExpanded] = useState(true);
  const [deptDialogOpen, setDeptDialogOpen] = useState(false);

  const { data: jobs = [] }    = useQuery<Job[]>({       queryKey: ["/api/jobs"] });
  const { data: workers = [] } = useQuery<Worker[]>({    queryKey: ["/api/workers"] });
  const { data: clients = [] } = useQuery<Client[]>({    queryKey: ["/api/clients"] });
  const { data: departments = [] } = useQuery<Department[]>({ queryKey: ["/api/departments"] });

  const todayStr = format(new Date(), "yyyy-MM-dd");

  const todayJobs = jobs.filter(j => {
    if (!j.scheduledDate) return false;
    const d = new Date(j.scheduledDate);
    return isValid(d) && format(d, "yyyy-MM-dd") === todayStr;
  });

  const getWorkerName = (id: string | null) =>
    workers.find(w => w.id === id)?.name ?? "Unassigned";
  const getClientName = (id: string | null) =>
    clients.find(c => c.id === id)?.name ?? "—";
  const getDeptName = (id: string | null) =>
    departments.find(d => d.id === id)?.name ?? "—";
  const getTime = (job: Job) => {
    if (job.scheduledTime) return job.scheduledTime;
    if (job.scheduledDate) {
      const d = new Date(job.scheduledDate);
      const h = d.getHours(), m = d.getMinutes();
      if (h > 0 || m > 0) return format(d, "HH:mm");
    }
    return "—";
  };

  // Jobs needing attention
  const unassignedJobs = todayJobs.filter(j => !j.workerId);
  const awaitingReview = todayJobs.filter(j => j.status === "completed" && !j.notes);
  const cancelledJobs  = todayJobs.filter(j => j.status === "cancelled");
  const overdueJobs    = jobs.filter(j => {
    if (!j.scheduledDate) return false;
    const d = new Date(j.scheduledDate);
    return d < new Date()
      && j.status !== "completed"
      && j.status !== "cancelled"
      && format(d, "yyyy-MM-dd") !== todayStr;
  });

  const attentionJobs = [
    ...unassignedJobs.map(j => ({ ...j, _reason: "Unassigned" })),
    ...awaitingReview.map(j => ({ ...j, _reason: "No diary entry" })),
    ...cancelledJobs.map(j =>  ({ ...j, _reason: "Cancelled" })),
    ...overdueJobs.map(j =>    ({ ...j, _reason: "Overdue" })),
  ];
  const hasAttention = attentionJobs.length > 0;

  // Compact dept counts (active = not completed/cancelled)
  const deptCounts = SERVICE_DEPTS.map(d => ({
    ...d,
    activeJobs: jobs.filter(j =>
      j.departmentId === d.id &&
      j.status !== "completed" &&
      j.status !== "cancelled"
    ).length,
  }));

  return (
    <div className="space-y-5">

      {/* ── 1. ALL JOBS TODAY ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-400" />
            All Jobs Today — {format(new Date(), "d MMMM yyyy")}
            <span className="ml-auto text-xs font-normal text-gray-400">
              {todayJobs.length} job{todayJobs.length !== 1 ? "s" : ""}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {todayJobs.length === 0 ? (
            <p className="text-sm text-gray-400 italic text-center py-8">No jobs scheduled for today.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left bg-gray-50/60">
                    <th className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Job #</th>
                    <th className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Client</th>
                    <th className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden sm:table-cell">Dept</th>
                    <th className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden md:table-cell">Worker</th>
                    <th className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden sm:table-cell">Time</th>
                    <th className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                    <th className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden lg:table-cell">Notes</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {todayJobs.map(job => (
                    <tr
                      key={job.id}
                      className={`hover:bg-gray-50 transition-colors ${!job.workerId ? "bg-red-50/30" : ""}`}
                    >
                      <td className="px-3 py-2.5 font-mono text-xs text-gray-400">{job.jobNumber ?? job.id.slice(0, 6)}</td>
                      <td className="px-3 py-2.5 font-medium text-gray-800 max-w-[130px] truncate">{getClientName(job.clientId)}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-500 hidden sm:table-cell">{getDeptName(job.departmentId ?? null)}</td>
                      <td className="px-3 py-2.5 hidden md:table-cell text-xs">
                        {job.workerId
                          ? <span className="text-gray-600">{getWorkerName(job.workerId)}</span>
                          : <span className="text-red-500 font-semibold">Unassigned</span>}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-500 hidden sm:table-cell">{getTime(job)}</td>
                      <td className="px-3 py-2.5">
                        <Badge className={`text-[11px] px-2 py-0.5 rounded-full font-medium border-0 ${statusColor(job.status)}`}>
                          {formatStatus(job.status)}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-gray-400 text-xs truncate max-w-[150px] hidden lg:table-cell">
                        {job.notes
                          ? job.notes
                          : job.status === "completed"
                            ? <span className="text-amber-500 italic">No diary entry</span>
                            : "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <Link href="/jobs">
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 border border-blue-200 rounded px-2 py-0.5 hover:bg-blue-50 transition-colors cursor-pointer whitespace-nowrap">
                            View Job <ExternalLink className="h-3 w-3" />
                          </span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 2. JOBS NEEDING ATTENTION (conditional) ────────────────────────── */}
      {hasAttention && (
        <Card className="border-amber-200">
          <CardHeader className="pb-2">
            <button
              className="w-full flex items-center justify-between text-left"
              onClick={() => setAttentionExpanded(e => !e)}
            >
              <CardTitle className="text-sm font-semibold text-amber-700 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Jobs Needing Attention
                <span className="ml-1 bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
                  {attentionJobs.length}
                </span>
              </CardTitle>
              {attentionExpanded
                ? <ChevronUp className="h-4 w-4 text-amber-400" />
                : <ChevronDown className="h-4 w-4 text-amber-400" />}
            </button>
          </CardHeader>
          {attentionExpanded && (
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-amber-100 text-left bg-amber-50/40">
                      <th className="px-3 py-2 text-xs font-semibold text-amber-500 uppercase tracking-wide">Issue</th>
                      <th className="px-3 py-2 text-xs font-semibold text-amber-500 uppercase tracking-wide">Job #</th>
                      <th className="px-3 py-2 text-xs font-semibold text-amber-500 uppercase tracking-wide">Client</th>
                      <th className="px-3 py-2 text-xs font-semibold text-amber-500 uppercase tracking-wide hidden sm:table-cell">Worker</th>
                      <th className="px-3 py-2 text-xs font-semibold text-amber-500 uppercase tracking-wide">Status</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-50">
                    {attentionJobs.map((job, idx) => (
                      <tr key={`${job.id}-${idx}`} className="hover:bg-amber-50/30 transition-colors">
                        <td className="px-3 py-2.5">
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                            job._reason === "Unassigned"     ? "bg-red-100 text-red-700" :
                            job._reason === "No diary entry" ? "bg-amber-100 text-amber-700" :
                            job._reason === "Cancelled"      ? "bg-gray-100 text-gray-500" :
                            "bg-orange-100 text-orange-700"
                          }`}>
                            {job._reason}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs text-gray-400">{job.jobNumber ?? job.id.slice(0, 6)}</td>
                        <td className="px-3 py-2.5 font-medium text-gray-800 max-w-[120px] truncate">{getClientName(job.clientId)}</td>
                        <td className="px-3 py-2.5 hidden sm:table-cell text-xs text-gray-500">
                          {job.workerId ? getWorkerName(job.workerId) : <span className="text-red-500">—</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge className={`text-[11px] px-2 py-0.5 rounded-full font-medium border-0 ${statusColor(job.status)}`}>
                            {formatStatus(job.status)}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5">
                          <Link href="/jobs">
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 border border-blue-200 rounded px-2 py-0.5 hover:bg-blue-50 transition-colors cursor-pointer whitespace-nowrap">
                              View Job <ExternalLink className="h-3 w-3" />
                            </span>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* ── 3. JOBS BY WORKER ─────────────────────────────────────────────── */}
      <WorkerJobsSummary />

      {/* ── 4. COMPACT DEPARTMENT SUMMARY ─────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 text-gray-400" />
              Service Departments
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7 px-3"
              onClick={() => setDeptDialogOpen(true)}
            >
              View Department Overview
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {deptCounts.map(d => (
              <div
                key={d.id}
                className="flex flex-col items-center justify-center rounded-lg border p-3 gap-1"
                style={{ borderLeftColor: d.color, borderLeftWidth: 3 }}
              >
                <span className="text-2xl font-bold text-gray-900">{d.activeJobs}</span>
                <span className="text-[11px] text-gray-500 text-center leading-tight">{d.name}</span>
                <span className="text-[10px] text-gray-400">active jobs</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Full Department Overview dialog */}
      <Dialog open={deptDialogOpen} onOpenChange={setDeptDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LayoutGrid className="h-5 w-5 text-gray-500" />
              Department Overview
            </DialogTitle>
          </DialogHeader>
          <DepartmentOverview defaultSelection={["div-1", "div-2", "div-3", "div-4"]} />
        </DialogContent>
      </Dialog>

    </div>
  );
}
