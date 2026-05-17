import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Briefcase, Users, CheckCircle, Clock, AlertCircle, Calendar, MapPin } from "lucide-react";
import type { Job, Worker, Department } from "@shared/schema";

type Range = "today" | "week" | "month";

function getRange(range: Range) {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);
  if (range === "today") {
    start.setHours(0, 0, 0, 0); end.setHours(23, 59, 59, 999);
  } else if (range === "week") {
    const d = now.getDay(); const diff = d === 0 ? -6 : 1 - d;
    start.setDate(now.getDate() + diff); start.setHours(0, 0, 0, 0);
    end.setDate(start.getDate() + 6); end.setHours(23, 59, 59, 999);
  } else {
    start.setDate(1); start.setHours(0, 0, 0, 0);
    end.setMonth(now.getMonth() + 1, 0); end.setHours(23, 59, 59, 999);
  }
  return { start, end };
}

function inRange(date: any, range: Range) {
  if (!date) return false;
  const d = new Date(date);
  const { start, end } = getRange(range);
  return d >= start && d <= end;
}

const statusBadge: Record<string, string> = {
  completed: "bg-green-100 text-green-800",
  in_progress: "bg-blue-100 text-blue-800",
  pending: "bg-yellow-100 text-yellow-800",
  scheduled: "bg-purple-100 text-purple-800",
  cancelled: "bg-red-100 text-red-700",
};

export function ServiceDashboard() {
  const [range, setRange] = useState<Range>("today");
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: jobs = [] } = useQuery<Job[]>({ queryKey: ["/api/jobs"] });
  const { data: workers = [] } = useQuery<Worker[]>({ queryKey: ["/api/workers"] });
  const { data: departments = [] } = useQuery<Department[]>({ queryKey: ["/api/departments"] });

  const deptMap = Object.fromEntries(departments.map(d => [d.id, d]));
  const workerMap = Object.fromEntries(workers.map(w => [w.id, w]));

  const filtered = jobs.filter(j => inRange(j.scheduledDate, range));
  const completed = filtered.filter(j => j.status === "completed").length;
  const inProgress = filtered.filter(j => j.status === "in_progress").length;
  const pending = filtered.filter(j => j.status === "pending" || j.status === "scheduled").length;

  // Group by department
  const byDept = departments
    .filter(d => ["div-1","div-2","div-3","div-4"].includes(d.id))
    .map(dept => ({
      dept,
      jobs: filtered.filter(j => j.departmentId === dept.id),
    }))
    .filter(x => x.jobs.length > 0);

  // Group by worker
  const byWorker = workers
    .map(w => ({ worker: w, jobs: filtered.filter(j => j.workerId === w.id) }))
    .filter(x => x.jobs.length > 0)
    .sort((a, b) => b.jobs.length - a.jobs.length);

  return (
    <div className="space-y-6">
      {/* Range toggle */}
      <div className="flex justify-end">
        <div className="flex gap-1">
          {(["today","week","month"] as Range[]).map(r => (
            <Button key={r} size="sm" variant={range === r ? "default" : "outline"}
              className="text-xs h-8 px-3" onClick={() => setRange(r)}>
              {r === "today" ? "Today" : r === "week" ? "This Week" : "This Month"}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Jobs by Department */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400" /> Jobs by Department
            </CardTitle>
          </CardHeader>
          <CardContent>
            {byDept.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No jobs scheduled</p>
            ) : (
              <div className="space-y-3">
                {byDept.map(({ dept, jobs: djobs }) => (
                  <div key={dept.id}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: dept.colorCode }} />
                        <span className="text-sm font-medium">{dept.name}</span>
                      </div>
                      <span className="text-sm font-bold">{djobs.length}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="h-2 rounded-full transition-all"
                        style={{ backgroundColor: dept.colorCode, width: `${(djobs.length / filtered.length) * 100}%` }} />
                    </div>
                    <div className="flex gap-3 mt-1 text-xs text-gray-500">
                      <span className="text-green-600">{djobs.filter(j=>j.status==="completed").length} done</span>
                      <span className="text-blue-600">{djobs.filter(j=>j.status==="in_progress").length} active</span>
                      <span className="text-yellow-600">{djobs.filter(j=>j.status==="pending"||j.status==="scheduled").length} pending</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Jobs by Worker */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-400" /> Jobs by Worker
            </CardTitle>
          </CardHeader>
          <CardContent>
            {byWorker.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No jobs assigned</p>
            ) : (
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {byWorker.map(({ worker, jobs: wjobs }) => {
                  const dept = deptMap[worker.departmentId ?? ""];
                  return (
                    <div key={worker.id} className="border rounded-lg overflow-hidden">
                      <button className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 text-left"
                        onClick={() => setExpanded(expanded === worker.id ? null : worker.id)}>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: dept?.colorCode ?? "#6b7280" }} />
                          <span className="text-sm font-medium">{worker.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-green-600">{wjobs.filter(j=>j.status==="completed").length}✓</span>
                          <Badge variant="outline" className="text-xs">{wjobs.length}</Badge>
                        </div>
                      </button>
                      {expanded === worker.id && (
                        <div className="border-t bg-gray-50 divide-y">
                          {wjobs.map(job => (
                            <div key={job.id} className="flex items-center justify-between px-3 py-1.5">
                              <div>
                                <p className="text-xs font-medium">{job.title}</p>
                                {job.location && <p className="text-xs text-gray-400 flex items-center gap-1"><MapPin className="h-2.5 w-2.5"/>{job.location}</p>}
                              </div>
                              <Badge className={`text-xs ${statusBadge[job.status] ?? "bg-gray-100"}`}>
                                {job.status?.replace("_"," ")}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Job List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All Jobs — {range === "today" ? "Today" : range === "week" ? "This Week" : "This Month"}</CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No jobs for this period</p>
          ) : (
            <div className="divide-y">
              {filtered.map(job => {
                const worker = workerMap[job.workerId ?? ""];
                const dept = deptMap[job.departmentId ?? ""];
                return (
                  <div key={job.id} className="flex items-center justify-between py-3 px-1">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: dept?.colorCode ?? "#9ca3af" }} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{job.title}</p>
                        <p className="text-xs text-gray-500">
                          {worker?.name ?? "Unassigned"}
                          {job.scheduledDate ? ` · ${new Date(job.scheduledDate).toLocaleDateString("en-ZA",{weekday:"short",day:"numeric",month:"short"})}` : ""}
                          {job.scheduledTime ? ` ${job.scheduledTime}` : ""}
                        </p>
                      </div>
                    </div>
                    <Badge className={`text-xs flex-shrink-0 ml-2 ${statusBadge[job.status] ?? "bg-gray-100"}`}>
                      {job.status?.replace("_"," ")}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
