import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Users, UserCheck, UserX, Search, Phone, Mail, IdCard,
  CalendarDays, AlertCircle, Clock, Briefcase, ChevronDown,
  Shield, Star,
} from "lucide-react";
import { getInitials } from "@/lib/utils";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Worker, Department, Team, AttendanceRecord, AttendanceMemberRecord } from "@shared/schema";

const TODAY = format(new Date(), "yyyy-MM-dd");
const TODAY_DISPLAY = format(new Date(), "EEEE, d MMMM yyyy");

const DEPT_COLORS: Record<string, string> = {
  "div-1": "border-green-200 bg-green-50",
  "div-2": "border-purple-200 bg-purple-50",
  "div-3": "border-blue-200 bg-blue-50",
  "div-4": "border-orange-200 bg-orange-50",
  "div-5": "border-pink-200 bg-pink-50",
  "div-6": "border-indigo-200 bg-indigo-50",
  "div-7": "border-amber-200 bg-amber-50",
  "none":  "border-gray-200 bg-gray-50",
};
const DEPT_BADGE: Record<string, string> = {
  "div-1": "bg-green-100 text-green-800",
  "div-2": "bg-purple-100 text-purple-800",
  "div-3": "bg-blue-100 text-blue-800",
  "div-4": "bg-orange-100 text-orange-800",
  "div-5": "bg-pink-100 text-pink-800",
  "div-6": "bg-indigo-100 text-indigo-800",
  "div-7": "bg-amber-100 text-amber-800",
};

export default function HRDashboard() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("staff");
  const [profileWorker, setProfileWorker] = useState<Worker | null>(null);

  const { data: workers = [] } = useQuery<Worker[]>({ queryKey: ["/api/workers"] });
  const { data: departments = [] } = useQuery<Department[]>({ queryKey: ["/api/departments"] });
  const { data: teams = [] } = useQuery<Team[]>({ queryKey: ["/api/teams"] });

  const deptMap = useMemo(() => new Map(departments.map(d => [d.id, d])), [departments]);

  const activeWorkers = workers.filter(w => w.isActive);
  const inactiveWorkers = workers.filter(w => !w.isActive);

  const byDept = useMemo(() => {
    const map = new Map<string, Worker[]>();
    for (const w of activeWorkers) {
      const key = w.departmentId ?? "none";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(w);
    }
    return map;
  }, [activeWorkers]);

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return workers.filter(w => {
      const matchesDept = deptFilter === "all" || w.departmentId === deptFilter;
      const matchesTerm = term === "" ||
        w.name.toLowerCase().includes(term) ||
        (w.role ?? "").toLowerCase().includes(term) ||
        (w.idNumber ?? "").toLowerCase().includes(term);
      return matchesDept && matchesTerm;
    });
  }, [workers, searchTerm, deptFilter]);

  // Low leave balance
  const lowLeaveWorkers = useMemo(
    () => activeWorkers.filter(w => (w.leaveBalance ?? 15) <= 5).sort((a, b) => (a.leaveBalance ?? 15) - (b.leaveBalance ?? 15)),
    [activeWorkers]
  );

  return (
      <>
        <div className="p-6 pb-20 lg:pb-6 space-y-6">

          {/* Page header */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">HR Dashboard</h1>
            <p className="text-sm text-gray-500 mt-0.5">{TODAY_DISPLAY}</p>
          </div>

          {/* KPI tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="Total Staff" value={String(workers.length)} icon={Users} color="bg-blue-50 border-blue-200 text-blue-800" />
            <Kpi label="Active" value={String(activeWorkers.length)} icon={UserCheck} color="bg-green-50 border-green-200 text-green-800" />
            <Kpi label="Inactive / Off" value={String(inactiveWorkers.length)} icon={UserX} color="bg-gray-50 border-gray-200 text-gray-700" />
            <Kpi label="Low Leave Balance" value={String(lowLeaveWorkers.length)} icon={CalendarDays} color={lowLeaveWorkers.length > 0 ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-green-50 border-green-200 text-green-800"} />
          </div>

          {/* Dept headcount */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {departments.map(d => {
              const count = byDept.get(d.id)?.length ?? 0;
              return (
                <button
                  key={d.id}
                  onClick={() => setDeptFilter(deptFilter === d.id ? "all" : d.id)}
                  className={`border rounded-xl p-3 text-left transition hover:opacity-90 ${DEPT_COLORS[d.id] ?? "border-gray-200 bg-gray-50"} ${deptFilter === d.id ? "ring-2 ring-offset-1 ring-current" : ""}`}
                >
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.colorCode }} />
                    <span className="text-xs font-semibold text-gray-700 truncate">{d.name}</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{count}</p>
                  <p className="text-[11px] text-gray-500">staff</p>
                </button>
              );
            })}
          </div>

          {/* Main tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <TabsList className="grid grid-cols-3 w-full max-w-md">
                <TabsTrigger value="staff">Staff Directory</TabsTrigger>
                <TabsTrigger value="attendance">Today's Attendance</TabsTrigger>
                <TabsTrigger value="leave">
                  Leave
                  {lowLeaveWorkers.length > 0 && (
                    <span className="ml-1.5 bg-amber-500 text-white text-[10px] rounded-full px-1.5 font-bold">
                      {lowLeaveWorkers.length}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>

              {activeTab === "staff" && (
                <div className="flex gap-2 flex-1 max-w-sm">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                    <Input
                      placeholder="Search name, role, ID…"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="pl-8 h-8 text-sm"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Staff Directory */}
            <TabsContent value="staff" className="mt-4">
              {deptFilter !== "all" && (
                <p className="text-xs text-gray-500 mb-3">
                  Showing {deptMap.get(deptFilter)?.name} staff.{" "}
                  <button className="underline" onClick={() => setDeptFilter("all")}>Show all</button>
                </p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map(w => (
                  <WorkerCard
                    key={w.id}
                    worker={w}
                    deptName={w.departmentId ? (deptMap.get(w.departmentId)?.name ?? "Unknown") : "Office"}
                    badgeClass={DEPT_BADGE[w.departmentId ?? ""] ?? "bg-gray-100 text-gray-800"}
                    onViewProfile={() => setProfileWorker(w)}
                  />
                ))}
                {filtered.length === 0 && (
                  <div className="col-span-full p-10 text-center bg-white rounded-xl border text-sm text-gray-400">
                    No staff match the current filters.
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Today's Attendance */}
            <TabsContent value="attendance" className="mt-4">
              <AttendanceOverview teams={teams} workers={workers} />
            </TabsContent>

            {/* Leave Overview */}
            <TabsContent value="leave" className="mt-4">
              <LeaveOverview workers={activeWorkers} deptMap={deptMap} />
            </TabsContent>
          </Tabs>

        </div>

      {/* Staff Profile Dialog */}
      <Dialog open={!!profileWorker} onOpenChange={open => { if (!open) setProfileWorker(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Staff Profile</DialogTitle>
            <DialogDescription>Full HR profile for this team member.</DialogDescription>
          </DialogHeader>
          {profileWorker && (
            <StaffProfile worker={profileWorker} deptName={profileWorker.departmentId ? (deptMap.get(profileWorker.departmentId)?.name ?? "Unknown") : "Office"} />
          )}
        </DialogContent>
      </Dialog>
      </>
  );
}

function WorkerCard({ worker, deptName, badgeClass, onViewProfile }: {
  worker: Worker; deptName: string; badgeClass: string; onViewProfile: () => void;
}) {
  const leave = worker.leaveBalance ?? 15;
  const lowLeave = leave <= 5;

  return (
    <div className={`bg-white border rounded-xl p-4 hover:shadow-sm transition-shadow ${!worker.isActive ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-3 mb-3">
        <Avatar className="h-11 w-11 flex-shrink-0">
          <AvatarFallback className="bg-primary-100 text-primary-700 font-semibold text-sm">
            {getInitials(worker.name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate">{worker.name}</p>
          <p className="text-xs text-gray-500 truncate">{worker.role ?? "Team Member"}</p>
          <div className="flex items-center gap-1.5 mt-1">
            <Badge className={`text-xs ${badgeClass}`}>{deptName}</Badge>
            {!worker.isActive && <Badge className="text-xs bg-red-100 text-red-700">Inactive</Badge>}
          </div>
        </div>
      </div>

      <div className="space-y-1 text-xs text-gray-600 mb-3">
        <div className="flex items-center gap-2">
          <Mail className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
          <span className="truncate">{worker.email}</span>
        </div>
        <div className="flex items-center gap-2">
          <Phone className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
          <span>{worker.phone}</span>
        </div>
        {worker.startDate && (
          <div className="flex items-center gap-2">
            <CalendarDays className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
            <span>Started {worker.startDate}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="flex items-center gap-1.5">
          <CalendarDays className={`h-3.5 w-3.5 ${lowLeave ? "text-amber-500" : "text-gray-400"}`} />
          <span className={`text-xs font-medium ${lowLeave ? "text-amber-600" : "text-gray-500"}`}>
            {leave} leave day{leave !== 1 ? "s" : ""} left
          </span>
          {lowLeave && <AlertCircle className="h-3.5 w-3.5 text-amber-500" />}
        </div>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onViewProfile}>
          View Profile
        </Button>
      </div>
    </div>
  );
}

function StaffProfile({ worker, deptName }: { worker: Worker; deptName: string }) {
  const leave = worker.leaveBalance ?? 15;
  const fields = [
    { label: "Full Name", value: worker.name, icon: Users },
    { label: "Job Title / Role", value: worker.role ?? "—", icon: Briefcase },
    { label: "Department", value: deptName, icon: Shield },
    { label: "Employee ID", value: worker.employeeId ?? "—", icon: IdCard },
    { label: "ID Number", value: worker.idNumber ?? "—", icon: IdCard },
    { label: "Start Date", value: worker.startDate ?? "—", icon: CalendarDays },
    { label: "Email", value: worker.email, icon: Mail },
    { label: "Phone", value: worker.phone, icon: Phone },
    { label: "Emergency Contact", value: worker.emergencyContactName ?? "—", icon: AlertCircle },
    { label: "Emergency Phone", value: worker.emergencyContactPhone ?? "—", icon: Phone },
    { label: "Leave Balance", value: `${leave} day${leave !== 1 ? "s" : ""} remaining`, icon: CalendarDays },
    { label: "Status", value: worker.isActive ? "Active" : "Inactive", icon: UserCheck },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 pb-3 border-b">
        <Avatar className="h-16 w-16">
          <AvatarFallback className="bg-primary-100 text-primary-700 text-xl font-bold">
            {getInitials(worker.name)}
          </AvatarFallback>
        </Avatar>
        <div>
          <h3 className="text-lg font-bold text-gray-900">{worker.name}</h3>
          <p className="text-sm text-gray-500">{worker.role ?? "Team Member"} · {deptName}</p>
          <Badge className={worker.isActive ? "bg-green-100 text-green-800 mt-1" : "bg-red-100 text-red-800 mt-1"}>
            {worker.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {fields.map(f => (
          <div key={f.label} className="bg-gray-50 rounded-lg p-2.5">
            <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">{f.label}</p>
            <p className="text-sm font-medium text-gray-800 mt-0.5">{f.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AttendanceOverview({ teams, workers }: { teams: Team[]; workers: Worker[] }) {
  const workerMap = useMemo(() => new Map(workers.map(w => [w.id, w])), [workers]);

  // Fetch all attendance records to find today's
  const { data: allAttendance = [] } = useQuery<AttendanceRecord[]>({
    queryKey: ["/api/attendance"],
  });

  const todayRecords = useMemo(
    () => allAttendance.filter(r => r.date === TODAY),
    [allAttendance]
  );

  const activeTeams = teams.filter(t => t.isActive);
  const submittedTeamIds = new Set(todayRecords.filter(r => r.status === "submitted").map(r => r.teamId));
  const pendingTeams = activeTeams.filter(t => !submittedTeamIds.has(t.id));
  const submittedTeams = activeTeams.filter(t => submittedTeamIds.has(t.id));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-green-700">{submittedTeams.length}</p>
          <p className="text-xs text-green-600">Teams submitted</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-amber-700">{pendingTeams.length}</p>
          <p className="text-xs text-amber-600">Teams pending</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-blue-700">{activeTeams.length}</p>
          <p className="text-xs text-blue-600">Active teams</p>
        </div>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">Team Attendance Status — {TODAY_DISPLAY}</h3>
        </div>
        {activeTeams.length === 0 ? (
          <p className="p-6 text-sm text-gray-400 italic text-center">No active teams configured.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {activeTeams.map(team => {
              const submitted = submittedTeamIds.has(team.id);
              const record = todayRecords.find(r => r.teamId === team.id);
              return (
                <div key={team.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{team.name}</p>
                    {record?.submittedAt && (
                      <p className="text-xs text-gray-400">
                        Submitted at {format(new Date(record.submittedAt), "HH:mm")}
                      </p>
                    )}
                  </div>
                  {submitted ? (
                    <Badge className="bg-green-100 text-green-800 gap-1.5">
                      <UserCheck className="h-3 w-3" /> Submitted
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-800 gap-1.5">
                      <Clock className="h-3 w-3" /> Pending
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 text-center">
        Go to <a href="/attendance" className="underline text-blue-600">Team Attendance</a> to take attendance for a specific team.
      </p>
    </div>
  );
}

function LeaveOverview({ workers, deptMap }: { workers: Worker[]; deptMap: Map<string, Department> }) {
  const sorted = [...workers].sort((a, b) => (a.leaveBalance ?? 15) - (b.leaveBalance ?? 15));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-red-700">{workers.filter(w => (w.leaveBalance ?? 15) === 0).length}</p>
          <p className="text-xs text-red-600">No leave remaining</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-amber-700">{workers.filter(w => (w.leaveBalance ?? 15) > 0 && (w.leaveBalance ?? 15) <= 5).length}</p>
          <p className="text-xs text-amber-600">1–5 days left</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-green-700">{workers.filter(w => (w.leaveBalance ?? 15) > 5).length}</p>
          <p className="text-xs text-green-600">6+ days left</p>
        </div>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">Leave Balance by Staff Member</h3>
          <p className="text-xs text-gray-400 mt-0.5">Sorted by lowest leave balance first</p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
            <tr>
              <th className="text-left px-4 py-2">Name</th>
              <th className="text-left px-4 py-2">Department</th>
              <th className="text-left px-4 py-2">Role</th>
              <th className="text-right px-4 py-2">Leave Left</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sorted.map(w => {
              const leave = w.leaveBalance ?? 15;
              const color = leave === 0 ? "text-red-700 font-bold"
                : leave <= 5 ? "text-amber-700 font-semibold"
                : "text-gray-700";
              return (
                <tr key={w.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-xs bg-primary-100 text-primary-700">
                          {getInitials(w.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-gray-900">{w.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-gray-500 text-xs">
                    {w.departmentId ? (deptMap.get(w.departmentId)?.name ?? "—") : "Office"}
                  </td>
                  <td className="px-4 py-2 text-gray-500 text-xs">{w.role ?? "—"}</td>
                  <td className={`px-4 py-2 text-right ${color}`}>
                    {leave} day{leave !== 1 ? "s" : ""}
                    {leave === 0 && " ⚠️"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({ label, value, icon: Icon, color }: { label: string; value: string; icon: any; color: string }) {
  return (
    <div className={`border rounded-xl p-4 flex items-start justify-between ${color}`}>
      <div>
        <p className="text-[11px] uppercase tracking-wide opacity-70 font-semibold">{label}</p>
        <p className="text-xl font-bold mt-1">{value}</p>
      </div>
      <Icon className="h-5 w-5 opacity-60" />
    </div>
  );
}
