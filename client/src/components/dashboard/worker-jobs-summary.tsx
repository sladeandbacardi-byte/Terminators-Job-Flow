import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Briefcase, CheckCircle, Clock, AlertCircle } from "lucide-react";
import type { Worker, Job, Department } from "@shared/schema";

type Range = "today" | "week" | "month";

function getDateRange(range: Range): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  if (range === "today") {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else if (range === "week") {
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    start.setDate(now.getDate() + diff);
    start.setHours(0, 0, 0, 0);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
  } else {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    end.setMonth(now.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
  }
  return { start, end };
}

function isInRange(dateVal: string | Date | null | undefined, range: Range): boolean {
  if (!dateVal) return false;
  const d = new Date(dateVal);
  const { start, end } = getDateRange(range);
  return d >= start && d <= end;
}

const rangeLabels: Record<Range, string> = {
  today: "Today",
  week: "This Week",
  month: "This Month",
};

const statusIcon: Record<string, JSX.Element> = {
  completed: <CheckCircle className="h-3 w-3 text-green-500" />,
  in_progress: <Clock className="h-3 w-3 text-blue-500" />,
  pending: <AlertCircle className="h-3 w-3 text-yellow-500" />,
  cancelled: <AlertCircle className="h-3 w-3 text-red-400" />,
};

const statusBadge: Record<string, string> = {
  completed:   "bg-green-100 text-green-800",
  in_progress: "bg-blue-100 text-blue-800",
  scheduled:   "bg-orange-100 text-orange-800",
  pending:     "bg-yellow-100 text-yellow-800",
  cancelled:   "bg-red-100 text-red-800",
};

export function WorkerJobsSummary() {
  const [range, setRange] = useState<Range>("week");
  const [expandedWorker, setExpandedWorker] = useState<string | null>(null);

  const { data: workers = [] } = useQuery<Worker[]>({ queryKey: ["/api/workers"] });
  const { data: jobs = [] } = useQuery<Job[]>({ queryKey: ["/api/jobs"] });
  const { data: departments = [] } = useQuery<Department[]>({ queryKey: ["/api/departments"] });

  const deptMap = Object.fromEntries(departments.map(d => [d.id, d]));

  const filteredJobs = jobs.filter(j => isInRange(j.scheduledDate, range));

  const workerSummaries = workers
    .map(worker => {
      const workerJobs = filteredJobs.filter(j => j.workerId === worker.id);
      const dept = deptMap[worker.departmentId ?? ""];
      return {
        worker,
        dept,
        jobs: workerJobs,
        completed: workerJobs.filter(j => j.status === "completed").length,
        inProgress: workerJobs.filter(j => j.status === "in_progress").length,
        pending: workerJobs.filter(j => j.status === "pending").length,
      };
    })
    .filter(s => s.jobs.length > 0)
    .sort((a, b) => b.jobs.length - a.jobs.length);

  const unassigned = filteredJobs.filter(j => !j.workerId || !workers.find(w => w.id === j.workerId));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5 text-gray-500" />
            Jobs per Worker
          </CardTitle>
          <div className="flex gap-1">
            {(["today", "week", "month"] as Range[]).map(r => (
              <Button
                key={r}
                size="sm"
                variant={range === r ? "default" : "outline"}
                className="text-xs h-7 px-3"
                onClick={() => setRange(r)}
              >
                {rangeLabels[r]}
              </Button>
            ))}
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {filteredJobs.length} job{filteredJobs.length !== 1 ? "s" : ""} scheduled for {rangeLabels[range].toLowerCase()}
        </p>
      </CardHeader>

      <CardContent>
        {workerSummaries.length === 0 && unassigned.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Briefcase className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No jobs scheduled for {rangeLabels[range].toLowerCase()}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {workerSummaries.map(({ worker, dept, jobs: wJobs, completed, inProgress, pending }) => (
              <div key={worker.id} className="border rounded-lg overflow-hidden">
                {/* Worker row */}
                <button
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                  onClick={() => setExpandedWorker(expandedWorker === worker.id ? null : worker.id)}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: dept?.colorCode ?? "#6b7280" }}
                    />
                    <div>
                      <p className="font-medium text-sm text-gray-900">{worker.name}</p>
                      <p className="text-xs text-gray-500">{worker.role}{dept ? ` · ${dept.name}` : ""}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-2 text-xs">
                      {completed > 0 && (
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle className="h-3 w-3" />{completed}
                        </span>
                      )}
                      {inProgress > 0 && (
                        <span className="flex items-center gap-1 text-blue-600">
                          <Clock className="h-3 w-3" />{inProgress}
                        </span>
                      )}
                      {pending > 0 && (
                        <span className="flex items-center gap-1 text-yellow-600">
                          <AlertCircle className="h-3 w-3" />{pending}
                        </span>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs font-semibold min-w-[28px] justify-center">
                      {wJobs.length}
                    </Badge>
                    <span className="text-gray-400 text-xs">{expandedWorker === worker.id ? "▲" : "▼"}</span>
                  </div>
                </button>

                {/* Expanded job list */}
                {expandedWorker === worker.id && (
                  <div className="border-t bg-gray-50 divide-y">
                    {wJobs.map(job => (
                      <div key={job.id} className="flex items-center justify-between px-4 py-2">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{job.title}</p>
                          {job.scheduledDate && (
                            <p className="text-xs text-gray-400">
                              {new Date(job.scheduledDate).toLocaleDateString("en-ZA", {
                                weekday: "short", day: "numeric", month: "short",
                              })}
                              {job.scheduledTime ? ` · ${job.scheduledTime}` : ""}
                            </p>
                          )}
                        </div>
                        <Badge className={`text-xs ${statusBadge[job.status] ?? "bg-gray-100 text-gray-600"}`}>
                          <span className="flex items-center gap-1">
                            {statusIcon[job.status]}
                            {job.status?.replace("_", " ")}
                          </span>
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Unassigned jobs */}
            {unassigned.length > 0 && (
              <div className="border rounded-lg overflow-hidden border-dashed border-gray-300">
                <button
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                  onClick={() => setExpandedWorker(expandedWorker === "__unassigned" ? null : "__unassigned")}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-gray-300 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-sm text-gray-500">Unassigned</p>
                      <p className="text-xs text-gray-400">No worker assigned</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs font-semibold text-gray-500">
                      {unassigned.length}
                    </Badge>
                    <span className="text-gray-400 text-xs">{expandedWorker === "__unassigned" ? "▲" : "▼"}</span>
                  </div>
                </button>
                {expandedWorker === "__unassigned" && (
                  <div className="border-t bg-gray-50 divide-y">
                    {unassigned.map(job => (
                      <div key={job.id} className="flex items-center justify-between px-4 py-2">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{job.title}</p>
                          {job.scheduledDate && (
                            <p className="text-xs text-gray-400">
                              {new Date(job.scheduledDate).toLocaleDateString("en-ZA", {
                                weekday: "short", day: "numeric", month: "short",
                              })}
                            </p>
                          )}
                        </div>
                        <Badge className={`text-xs ${statusBadge[job.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {job.status?.replace("_", " ")}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
