import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DepartmentOverview } from "./department-overview";
import { WorkerJobsSummary } from "./worker-jobs-summary";
import { CalendarDays, CheckCircle, ClipboardList, Users } from "lucide-react";
import { format, isValid } from "date-fns";
import type { Job, Worker, Client, Department } from "@shared/schema";

const STATUS_COLORS: Record<string, string> = {
  completed:   "bg-green-100 text-green-800",
  "in-progress": "bg-blue-100 text-blue-800",
  scheduled:   "bg-gray-100 text-gray-700",
  pending:     "bg-yellow-100 text-yellow-800",
  cancelled:   "bg-red-100 text-red-700",
};

export function CoordinatorDashboard() {
  const { data: jobs = [] }        = useQuery<Job[]>({        queryKey: ["/api/jobs"] });
  const { data: workers = [] }     = useQuery<Worker[]>({     queryKey: ["/api/workers"] });
  const { data: clients = [] }     = useQuery<Client[]>({     queryKey: ["/api/clients"] });
  const { data: departments = [] } = useQuery<Department[]>({ queryKey: ["/api/departments"] });

  const todayStr = format(new Date(), "yyyy-MM-dd");

  const todayJobs = jobs.filter(j => {
    if (!j.scheduledDate) return false;
    const d = new Date(j.scheduledDate);
    return isValid(d) && format(d, "yyyy-MM-dd") === todayStr;
  });

  const jobsDoneToday   = todayJobs.filter(j => j.status === "completed").length;
  const activeJobsToday = todayJobs.filter(j => j.status === "in-progress").length;
  const pendingToday    = todayJobs.filter(j => j.status === "scheduled" || j.status === "pending").length;

  const getWorkerName = (id: string | null) =>
    workers.find(w => w.id === id)?.name ?? "Unassigned";
  const getClientName = (id: string | null) =>
    clients.find(c => c.id === id)?.name ?? "—";
  const getDeptName = (id: string | null) =>
    departments.find(d => d.id === id)?.name ?? "—";

  return (
    <div className="space-y-6">

      {/* Quick-stat strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Jobs Done Today",   value: jobsDoneToday,   icon: CheckCircle,   color: "text-green-600",  bg: "bg-green-50  border-green-100"  },
          { label: "In Progress",       value: activeJobsToday, icon: ClipboardList, color: "text-blue-600",   bg: "bg-blue-50   border-blue-100"   },
          { label: "Scheduled / Pending", value: pendingToday,  icon: CalendarDays,  color: "text-orange-600", bg: "bg-orange-50 border-orange-100" },
          { label: "Workers Active",    value: workers.filter(w => w.isActive !== false).length, icon: Users, color: "text-cyan-700", bg: "bg-cyan-50 border-cyan-100" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label} className={`border ${bg}`}>
            <CardContent className="p-4 flex items-center gap-3">
              <Icon className={`h-8 w-8 ${color} flex-shrink-0`} />
              <div>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-gray-500 leading-tight">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Jobs by Department */}
      <DepartmentOverview />

      {/* Jobs by Worker */}
      <WorkerJobsSummary />

      {/* All Jobs Today */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-gray-400" />
            All Jobs Today — {format(new Date(), "d MMMM yyyy")}
            <span className="ml-auto text-xs font-normal text-gray-400">{todayJobs.length} job{todayJobs.length !== 1 ? "s" : ""}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {todayJobs.length === 0 ? (
            <p className="text-sm text-gray-400 italic text-center py-8">No jobs scheduled for today.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left">
                    <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Job #</th>
                    <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Client</th>
                    <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Department</th>
                    <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Worker</th>
                    <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {todayJobs.map(job => (
                    <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{job.jobNumber ?? job.id.slice(0, 8)}</td>
                      <td className="px-4 py-2.5 font-medium text-gray-800">{getClientName(job.clientId)}</td>
                      <td className="px-4 py-2.5 text-gray-600 hidden sm:table-cell">{getDeptName(job.departmentId ?? null)}</td>
                      <td className="px-4 py-2.5 text-gray-600 hidden md:table-cell">{getWorkerName(job.workerId ?? null)}</td>
                      <td className="px-4 py-2.5">
                        <Badge className={`text-[11px] px-2 py-0.5 rounded-full capitalize font-medium border-0 ${STATUS_COLORS[job.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {job.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-gray-400 text-xs truncate max-w-[180px] hidden lg:table-cell">{job.notes ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
