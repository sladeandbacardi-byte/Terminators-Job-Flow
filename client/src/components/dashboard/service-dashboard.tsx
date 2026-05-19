import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import {
  Briefcase, CheckCircle, Clock, AlertTriangle, MapPin,
  Gauge, ClipboardCheck, Fuel, AlertCircle, FileWarning,
  Play, ChevronRight, CalendarDays,
} from "lucide-react";
import { format, isValid, startOfWeek, endOfWeek } from "date-fns";
import type { Job, Worker, Client, Department } from "@shared/schema";

/* ── helpers ─────────────────────────────────────────────────────────────── */

const STATUS_COLORS: Record<string, string> = {
  completed:    "bg-green-100 text-green-800",
  in_progress:  "bg-blue-100 text-blue-800",
  "in-progress":"bg-blue-100 text-blue-800",
  scheduled:    "bg-orange-100 text-orange-800",
  pending:      "bg-yellow-100 text-yellow-800",
  cancelled:    "bg-red-100 text-red-800",
};

function sc(status: string) {
  return STATUS_COLORS[status] ?? STATUS_COLORS[status?.replace("-","_")] ?? "bg-gray-100 text-gray-600";
}

function fmt(status: string) {
  const map: Record<string, string> = {
    in_progress: "In Progress", "in-progress": "In Progress",
    scheduled: "Scheduled", completed: "Completed",
    cancelled: "Cancelled", pending: "Pending",
  };
  return map[status] ?? status?.replace(/[_-]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function getTime(job: Job) {
  if (job.scheduledTime) return job.scheduledTime;
  if (job.scheduledDate) {
    const d = new Date(job.scheduledDate);
    const h = d.getHours(), m = d.getMinutes();
    if (h > 0 || m > 0) return format(d, "HH:mm");
  }
  return "—";
}

function isToday(date: string | Date | null | undefined) {
  if (!date) return false;
  const d = new Date(date);
  return isValid(d) && format(d, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
}

function isThisWeek(date: string | Date | null | undefined) {
  if (!date) return false;
  const d = new Date(date);
  const now = new Date();
  return isValid(d) && d >= startOfWeek(now, { weekStartsOn: 1 }) && d <= endOfWeek(now, { weekStartsOn: 1 });
}

function isActive(status: string) {
  return status === "in_progress" || status === "in-progress";
}

/* ── action button label based on job status ─────────────────────────────── */
function actionLabel(status: string) {
  if (isActive(status)) return "Continue Job";
  if (status === "completed") return "View Job";
  return "Start Job";
}

function actionStyle(status: string) {
  if (isActive(status)) return "bg-blue-600 hover:bg-blue-700 text-white";
  if (status === "completed") return "bg-gray-100 hover:bg-gray-200 text-gray-700";
  return "bg-green-600 hover:bg-green-700 text-white";
}

/* ── Fleet quick-action buttons ─────────────────────────────────────────── */
const FLEET_ACTIONS = [
  { label: "Log KMs",            href: "/fleet/km-log",       icon: Gauge,         color: "text-blue-600 border-blue-200 hover:bg-blue-50" },
  { label: "Vehicle Inspection", href: "/fleet/inspection",   icon: ClipboardCheck, color: "text-indigo-600 border-indigo-200 hover:bg-indigo-50" },
  { label: "Fuel Fill-up",       href: "/fleet/fuel",         icon: Fuel,          color: "text-orange-600 border-orange-200 hover:bg-orange-50" },
  { label: "Report Vehicle Issue",href: "/fleet/report-issue",icon: AlertCircle,   color: "text-red-600 border-red-200 hover:bg-red-50" },
];

/* ════════════════════════════════════════════════════════════════════════════
   ServiceDashboard  (renders for role === "service")
   ════════════════════════════════════════════════════════════════════════════ */
export function ServiceDashboard() {
  const { user } = useAuth();
  const [weekExpanded, setWeekExpanded] = useState(false);

  const { data: allJobs     = [] } = useQuery<Job[]>({       queryKey: ["/api/jobs"] });
  const { data: workers     = [] } = useQuery<Worker[]>({    queryKey: ["/api/workers"] });
  const { data: clients     = [] } = useQuery<Client[]>({    queryKey: ["/api/clients"] });
  const { data: departments = [] } = useQuery<Department[]>({ queryKey: ["/api/departments"] });

  /* ── Resolve which worker this user is ────────────────────────────────────
     Priority: direct ID match → email match → worker with most assigned jobs
     (the last fallback gives meaningful demo data when no auth link exists)   */
  const myWorker: Worker | undefined = (() => {
    // 1. direct ID or email match
    const direct = workers.find(
      w => w.id === (user as any)?.id || w.email === (user as any)?.email
    );
    if (direct) return direct;

    // 2. service-dept worker with the most jobs (best demo fallback)
    const serviceDepts = new Set(["div-1","div-2","div-3","div-4"]);
    const ranked = workers
      .filter(w => serviceDepts.has(w.departmentId ?? "") && w.isActive !== false)
      .map(w => ({ w, count: allJobs.filter(j => j.workerId === w.id).length }))
      .sort((a, b) => b.count - a.count);
    return ranked[0]?.w;
  })();

  const getClient = (id: string | null) => clients.find(c => c.id === id)?.name ?? "—";
  const getDept   = (id: string | null) => departments.find(d => d.id === id)?.name ?? "—";

  /* ── All data filtered to THIS worker — single source of truth ────────── */
  const myJobs  = myWorker ? allJobs.filter(j => j.workerId === myWorker.id) : [];
  const myToday = myJobs.filter(j => isToday(j.scheduledDate));   // ← used by BOTH stats AND list
  const myWeek  = myJobs.filter(j => isThisWeek(j.scheduledDate));

  /* Current job = first in-progress job today */
  const currentJob = myToday.find(j => isActive(j.status));

  /* Jobs needing diary = completed (any date) with no notes */
  const diaryDue = myJobs.filter(j => j.status === "completed" && !j.notes);

  /* Snapshot counts — derived from myToday, same as the list below */
  const countToday      = myToday.length;
  const countDone       = myToday.filter(j => j.status === "completed").length;
  const countInProgress = myToday.filter(j => isActive(j.status)).length;
  const countDiaryDue   = diaryDue.length;

  /* Week stats */
  const weekDone    = myWeek.filter(j => j.status === "completed").length;
  const weekTotal   = myWeek.length;
  const weekUpcoming = myWeek.filter(j => j.status === "scheduled" || j.status === "pending").length;

  return (
    <div className="space-y-5">

      {/* ── Snapshot cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Jobs Today",         value: countToday,      cls: "bg-blue-50 border-blue-100",   val: "text-blue-700"   },
          { label: "Completed Today",    value: countDone,       cls: "bg-green-50 border-green-100", val: "text-green-700"  },
          { label: "In Progress",        value: countInProgress, cls: countInProgress > 0 ? "bg-blue-50 border-blue-200" : "bg-gray-50 border-gray-100", val: countInProgress > 0 ? "text-blue-600" : "text-gray-400" },
          { label: "Field Diaries Due",  value: countDiaryDue,   cls: countDiaryDue > 0   ? "bg-amber-50 border-amber-200" : "bg-gray-50 border-gray-100", val: countDiaryDue > 0   ? "text-amber-600" : "text-gray-400" },
        ].map(({ label, value, cls, val }) => (
          <div key={label} className={`border rounded-xl p-3 text-center ${cls}`}>
            <p className={`text-2xl font-bold leading-tight ${val}`}>{value}</p>
            <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Current Job (if any in-progress) ────────────────────────────────── */}
      {currentJob && (
        <Card className="border-blue-300 bg-blue-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-blue-700 flex items-center gap-2">
              <Play className="h-4 w-4 text-blue-500 fill-blue-500" />
              Current Job — In Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="space-y-0.5">
                <p className="font-semibold text-gray-900">{getClient(currentJob.clientId)}</p>
                <p className="text-sm text-gray-600">{getDept(currentJob.departmentId ?? null)}</p>
                {currentJob.location && (
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {currentJob.location}
                  </p>
                )}
                <p className="text-xs text-gray-400">Started: {getTime(currentJob)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/field-diaries">
                  <Button size="sm" variant="outline" className="text-xs h-8 border-blue-300 text-blue-700 hover:bg-blue-100">
                    Submit Field Diary
                  </Button>
                </Link>
                <Link href="/fleet/report-issue">
                  <Button size="sm" variant="outline" className="text-xs h-8 border-red-200 text-red-600 hover:bg-red-50">
                    Report Issue
                  </Button>
                </Link>
                <Link href="/jobs">
                  <Button size="sm" className="text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white">
                    Open Job
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── My Jobs Today ───────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-gray-400" />
            My Jobs Today — {format(new Date(), "d MMMM yyyy")}
            <span className="ml-auto text-xs font-normal text-gray-400">
              {myToday.length} job{myToday.length !== 1 ? "s" : ""}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!myWorker ? (
            <div className="text-center py-10 text-gray-400">
              <Briefcase className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No worker profile linked to this account.</p>
              <p className="text-xs mt-1 text-gray-300">Contact your coordinator to set up your profile.</p>
            </div>
          ) : myToday.length === 0 ? (
            <p className="text-sm text-gray-400 italic text-center py-10">No jobs scheduled for today.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {myToday.map(job => (
                <div
                  key={job.id}
                  className={`px-4 py-3 ${isActive(job.status) ? "bg-blue-50/30" : ""}`}
                >
                  {/* Row 1: number + client + time + status */}
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[11px] text-gray-400 flex-shrink-0">
                          {job.jobNumber ?? job.id.slice(0, 6)}
                        </span>
                        <span className="font-semibold text-gray-900 text-sm truncate">
                          {getClient(job.clientId)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-gray-500">{getDept(job.departmentId ?? null)}</span>
                        {job.location && (
                          <span className="text-xs text-gray-400 flex items-center gap-0.5">
                            <MapPin className="h-3 w-3" /> {job.location}
                          </span>
                        )}
                        <span className="text-xs text-gray-400">
                          <Clock className="h-3 w-3 inline mr-0.5" />{getTime(job)}
                        </span>
                      </div>
                      {job.notes && (
                        <p className="text-xs text-gray-400 mt-1 line-clamp-1 italic">"{job.notes}"</p>
                      )}
                      {!job.notes && job.status === "completed" && (
                        <p className="text-xs text-amber-500 italic mt-1">No field diary entry</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <Badge className={`text-[11px] px-2 py-0.5 rounded-full font-medium border-0 ${sc(job.status)}`}>
                        {fmt(job.status)}
                      </Badge>
                    </div>
                  </div>
                  {/* Row 2: action button */}
                  <div className="flex justify-end mt-1">
                    <Link href="/jobs">
                      <button className={`text-xs font-medium px-3 py-1 rounded-md transition-colors ${actionStyle(job.status)}`}>
                        {actionLabel(job.status)}
                      </button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Jobs Needing Field Diary ──────────────────────────────────────────── */}
      {diaryDue.length > 0 && (
        <Card className="border-amber-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-amber-700 flex items-center gap-2">
              <FileWarning className="h-4 w-4 text-amber-500" />
              Jobs Needing Field Diary
              <span className="ml-1 bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
                {diaryDue.length}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-amber-50">
              {diaryDue.map(job => (
                <div key={job.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="font-medium text-sm text-gray-800">{getClient(job.clientId)}</p>
                    <p className="text-xs text-gray-400">
                      {job.scheduledDate
                        ? format(new Date(job.scheduledDate), "EEE d MMM")
                        : "No date"}
                      {" · "}{getDept(job.departmentId ?? null)}
                    </p>
                  </div>
                  <Link href="/field-diaries">
                    <Button size="sm" className="text-xs h-7 bg-amber-500 hover:bg-amber-600 text-white">
                      Submit Diary
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Fleet Quick Actions ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Gauge className="h-4 w-4 text-gray-400" />
            Fleet Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {FLEET_ACTIONS.map(({ label, href, icon: Icon, color }) => (
              <Link key={label} href={href}>
                <button className={`w-full flex flex-col items-center gap-1.5 p-3 rounded-lg border text-xs font-medium transition-colors ${color}`}>
                  <Icon className="h-5 w-5" />
                  <span className="text-center leading-tight">{label}</span>
                </button>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── My Week (collapsible) ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <button
            className="w-full flex items-center justify-between text-left"
            onClick={() => setWeekExpanded(e => !e)}
          >
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-gray-400" />
              My Week
              <span className="text-xs font-normal text-gray-400 ml-1">
                {weekTotal} job{weekTotal !== 1 ? "s" : ""} · {weekDone} done · {weekUpcoming} upcoming
              </span>
            </CardTitle>
            <ChevronRight className={`h-4 w-4 text-gray-400 transition-transform ${weekExpanded ? "rotate-90" : ""}`} />
          </button>
        </CardHeader>
        {weekExpanded && (
          <CardContent className="p-0">
            {myWeek.length === 0 ? (
              <p className="text-sm text-gray-400 italic text-center py-6">No jobs this week.</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {myWeek
                  .sort((a, b) => new Date(a.scheduledDate!).getTime() - new Date(b.scheduledDate!).getTime())
                  .map(job => (
                    <div key={job.id} className="flex items-center justify-between px-4 py-2.5">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{getClient(job.clientId)}</p>
                        <p className="text-xs text-gray-400">
                          {job.scheduledDate ? format(new Date(job.scheduledDate), "EEE d MMM") : "—"}
                          {" · "}{getTime(job)}
                        </p>
                      </div>
                      <Badge className={`text-[11px] px-2 py-0.5 rounded-full font-medium border-0 ${sc(job.status)}`}>
                        {fmt(job.status)}
                      </Badge>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

    </div>
  );
}
