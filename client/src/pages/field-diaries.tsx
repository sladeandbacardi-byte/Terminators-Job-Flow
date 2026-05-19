import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  format, isToday, parseISO, addDays, subDays,
  startOfWeek, endOfWeek, addWeeks, subWeeks,
  startOfMonth, endOfMonth, addMonths, subMonths,
  eachDayOfInterval, isSameMonth, isSameDay as fnsIsSameDay,
} from "date-fns";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import MobileNavigation from "@/components/layout/mobile-nav";
import { useAuth } from "@/hooks/useAuth";
import { getDashboardRole } from "@/lib/dashboardRole";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ChevronLeft, ChevronRight, MapPin, Clock, User,
  Briefcase, CalendarDays, Phone, CheckCircle2, AlertCircle,
  Circle, Loader2,
} from "lucide-react";
import type { Worker, Job, Client, Department } from "@shared/schema";

// ─── Constants ────────────────────────────────────────────────────────────────

const SERVICE_DEPT_IDS = ["div-1", "div-2", "div-3", "div-4"];

const DEPT_COLORS: Record<string, string> = {
  "div-1": "bg-green-500",
  "div-2": "bg-purple-500",
  "div-3": "bg-blue-500",
  "div-4": "bg-amber-500",
};

const DEPT_LIGHT: Record<string, string> = {
  "div-1": "bg-green-50 border-green-200",
  "div-2": "bg-purple-50 border-purple-200",
  "div-3": "bg-blue-50 border-blue-200",
  "div-4": "bg-amber-50 border-amber-200",
};

const DEPT_PILL: Record<string, string> = {
  "div-1": "bg-green-100 text-green-800",
  "div-2": "bg-purple-100 text-purple-800",
  "div-3": "bg-blue-100 text-blue-800",
  "div-4": "bg-amber-100 text-amber-800",
};

const DEPT_DOT: Record<string, string> = {
  "div-1": "bg-green-500",
  "div-2": "bg-purple-500",
  "div-3": "bg-blue-500",
  "div-4": "bg-amber-500",
};

const STATUS_CONFIG: Record<string, { icon: JSX.Element; label: string; class: string }> = {
  completed:   { icon: <CheckCircle2 className="h-3.5 w-3.5" />, label: "Completed",   class: "bg-green-100 text-green-700" },
  in_progress: { icon: <Loader2      className="h-3.5 w-3.5 animate-spin" />, label: "In Progress", class: "bg-blue-100 text-blue-700" },
  scheduled:   { icon: <Circle       className="h-3.5 w-3.5" />, label: "Scheduled",   class: "bg-gray-100 text-gray-700" },
  cancelled:   { icon: <AlertCircle  className="h-3.5 w-3.5" />, label: "Cancelled",   class: "bg-red-100 text-red-600" },
};

type ViewMode = "day" | "week" | "month";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(dateStr: string | null, timeStr: string | null): string {
  if (timeStr) return timeStr.slice(0, 5);
  if (dateStr) {
    try { return format(parseISO(dateStr), "HH:mm"); } catch { return "—"; }
  }
  return "—";
}

function jobOnDay(job: Job, target: Date): boolean {
  const d = job.scheduledDate;
  if (!d) return false;
  try {
    const jd = parseISO(d as unknown as string);
    return (
      jd.getFullYear() === target.getFullYear() &&
      jd.getMonth()    === target.getMonth()    &&
      jd.getDate()     === target.getDate()
    );
  } catch { return false; }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function JobPill({ job, clientMap }: { job: Job; clientMap: Record<string, Client> }) {
  const client = clientMap[job.clientId ?? ""];
  const time = formatTime(job.scheduledDate as unknown as string, job.scheduledTime);
  return (
    <div className="text-xs bg-white border rounded px-2 py-1 space-y-0.5 shadow-sm">
      <div className="font-semibold text-gray-800 truncate leading-tight">{job.title}</div>
      <div className="flex items-center gap-1 text-gray-500">
        <Clock className="h-2.5 w-2.5 shrink-0" />
        <span>{time}</span>
        {client && <><span>·</span><span className="truncate">{client.name}</span></>}
      </div>
    </div>
  );
}

// ─── Day View ─────────────────────────────────────────────────────────────────

function DayView({
  selectedDate, fieldWorkers, jobs, clientMap, deptMap, isTechnician,
}: {
  selectedDate: Date;
  fieldWorkers: Worker[];
  jobs: Job[];
  clientMap: Record<string, Client>;
  deptMap: Record<string, Department>;
  isTechnician?: boolean;
}) {
  const jobsForDate = useMemo(
    () => jobs.filter(j => jobOnDay(j, selectedDate)),
    [jobs, selectedDate],
  );

  if (fieldWorkers.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <User className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p>
          {isTechnician
            ? "No jobs scheduled for you for the selected day."
            : "No field staff found for the selected filter."}
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {fieldWorkers.map(worker => {
        const dept = deptMap[worker.departmentId ?? ""];
        const workerJobs = jobsForDate
          .filter(j => j.workerId === worker.id)
          .sort((a, b) => {
            const ta = a.scheduledTime ?? formatTime(a.scheduledDate as unknown as string, null);
            const tb = b.scheduledTime ?? formatTime(b.scheduledDate as unknown as string, null);
            return ta.localeCompare(tb);
          });

        const deptColorBar = DEPT_COLORS[worker.departmentId ?? ""] ?? "bg-gray-400";
        const deptCard = DEPT_LIGHT[worker.departmentId ?? ""] ?? "bg-gray-50 border-gray-200";

        return (
          <Card key={worker.id} className={`border ${deptCard} overflow-hidden`}>
            <div className={`h-1.5 w-full ${deptColorBar}`} />
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-base leading-tight">{worker.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{worker.role}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {dept && (
                    <Badge variant="outline" className="text-xs shrink-0" style={{ borderColor: dept.colorCode ?? undefined, color: dept.colorCode ?? undefined }}>
                      {dept.name}
                    </Badge>
                  )}
                  {worker.phone && (
                    <a href={`tel:${worker.phone}`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
                      <Phone className="h-3 w-3" />{worker.phone}
                    </a>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {workerJobs.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground text-sm border border-dashed rounded-lg">
                  No jobs scheduled for this day
                </div>
              ) : (
                <div className="space-y-2">
                  {workerJobs.map(job => {
                    const client = clientMap[job.clientId ?? ""];
                    const statusCfg = STATUS_CONFIG[job.status ?? "scheduled"] ?? STATUS_CONFIG.scheduled;
                    const timeStr = formatTime(job.scheduledDate as unknown as string, job.scheduledTime);
                    return (
                      <div key={job.id} className="bg-white rounded-lg border p-3 space-y-1.5 shadow-sm">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-800">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            {timeStr}
                            {job.estimatedDuration && (
                              <span className="text-xs font-normal text-muted-foreground">({job.estimatedDuration} min)</span>
                            )}
                          </div>
                          <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${statusCfg.class}`}>
                            {statusCfg.icon}{statusCfg.label}
                          </span>
                        </div>
                        <p className="text-sm font-medium leading-tight">{job.title}</p>
                        {client && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Briefcase className="h-3 w-3 shrink-0" />
                            <span className="truncate">{client.name}</span>
                          </div>
                        )}
                        {job.location && (
                          <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
                            <span className="leading-snug">{job.location}</span>
                          </div>
                        )}
                        {job.notes && (
                          <p className="text-xs text-gray-400 italic border-t pt-1.5 mt-1">{job.notes}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {workerJobs.length > 0 && (
                <p className="text-xs text-muted-foreground text-right mt-2">
                  {workerJobs.length} job{workerJobs.length !== 1 ? "s" : ""} today
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ─── Week View ────────────────────────────────────────────────────────────────

function WeekView({
  weekStart, fieldWorkers, jobs, clientMap,
}: {
  weekStart: Date;
  fieldWorkers: Worker[];
  jobs: Job[];
  clientMap: Record<string, Client>;
}) {
  const weekDays = eachDayOfInterval({ start: weekStart, end: endOfWeek(weekStart, { weekStartsOn: 1 }) });

  if (fieldWorkers.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <User className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p>No field staff found for the selected filter.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left px-4 py-3 font-semibold text-gray-600 w-40 shrink-0 sticky left-0 bg-gray-50 z-10 border-r border-gray-200">
              Staff Member
            </th>
            {weekDays.map(day => (
              <th key={day.toISOString()} className={`text-center px-2 py-3 font-medium min-w-[120px] border-l border-gray-100 ${isToday(day) ? "bg-primary/5 text-primary font-bold" : "text-gray-500"}`}>
                <div className="text-xs uppercase tracking-wide">{format(day, "EEE")}</div>
                <div className={`text-base mt-0.5 font-bold rounded-full w-7 h-7 flex items-center justify-center mx-auto ${isToday(day) ? "bg-primary text-white" : ""}`}>
                  {format(day, "d")}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {fieldWorkers.map((worker, wi) => {
            const deptPill = DEPT_PILL[worker.departmentId ?? ""] ?? "bg-gray-100 text-gray-700";
            const deptBar  = DEPT_COLORS[worker.departmentId ?? ""] ?? "bg-gray-300";
            return (
              <tr key={worker.id} className={`border-b border-gray-100 ${wi % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                {/* Worker cell */}
                <td className={`px-4 py-3 sticky left-0 z-10 border-r border-gray-200 ${wi % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-1 h-10 rounded-full shrink-0 ${deptBar}`} />
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate leading-tight text-sm">{worker.name}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${deptPill}`}>
                        {worker.role}
                      </span>
                    </div>
                  </div>
                </td>
                {/* Day cells */}
                {weekDays.map(day => {
                  const dayJobs = jobs
                    .filter(j => j.workerId === worker.id && jobOnDay(j, day))
                    .sort((a, b) => (a.scheduledTime ?? "").localeCompare(b.scheduledTime ?? ""));
                  return (
                    <td key={day.toISOString()} className={`px-2 py-2 border-l border-gray-100 align-top ${isToday(day) ? "bg-primary/5" : ""}`}>
                      {dayJobs.length === 0 ? (
                        <div className="h-8 flex items-center justify-center">
                          <span className="text-gray-300 text-xs">—</span>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {dayJobs.map(job => (
                            <JobPill key={job.id} job={job} clientMap={clientMap} />
                          ))}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Month View ───────────────────────────────────────────────────────────────

function MonthView({
  monthAnchor, jobs, fieldWorkers, onSelectDay,
}: {
  monthAnchor: Date;
  jobs: Job[];
  fieldWorkers: Worker[];
  onSelectDay: (d: Date) => void;
}) {
  const mStart = startOfMonth(monthAnchor);
  const mEnd   = endOfMonth(monthAnchor);

  // calendar grid always starts on Mon
  const gridStart = startOfWeek(mStart, { weekStartsOn: 1 });
  const gridEnd   = endOfWeek(mEnd, { weekStartsOn: 1 });
  const gridDays  = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const workerIds = new Set(fieldWorkers.map(w => w.id));

  // Build a map: "yyyy-MM-dd" → jobs[]
  const jobsByDay = useMemo(() => {
    const map: Record<string, Job[]> = {};
    jobs.forEach(j => {
      if (!j.scheduledDate) return;
      if (!workerIds.has(j.workerId ?? "")) return;
      try {
        const key = format(parseISO(j.scheduledDate as unknown as string), "yyyy-MM-dd");
        if (!map[key]) map[key] = [];
        map[key].push(j);
      } catch {}
    });
    return map;
  }, [jobs, workerIds]);

  const DAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
        {DAY_HEADERS.map(d => (
          <div key={d} className="py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 divide-x divide-gray-100">
        {gridDays.map((day, idx) => {
          const key = format(day, "yyyy-MM-dd");
          const dayJobs = jobsByDay[key] ?? [];
          const inMonth = isSameMonth(day, monthAnchor);
          const today   = isToday(day);

          // Group dots by dept
          const deptIds = [...new Set(dayJobs
            .map(j => fieldWorkers.find(w => w.id === j.workerId)?.departmentId)
            .filter(Boolean) as string[])];

          return (
            <button
              key={day.toISOString()}
              onClick={() => onSelectDay(day)}
              className={`min-h-[90px] p-2 text-left transition-colors border-b border-gray-100 hover:bg-primary/5 group
                ${!inMonth ? "opacity-40" : ""}
                ${today ? "bg-primary/5" : "bg-white"}
                ${idx % 7 === 6 ? "" : ""}
              `}
            >
              {/* Date number */}
              <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold mb-1
                ${today ? "bg-primary text-white" : "text-gray-700 group-hover:bg-primary/10"}
              `}>
                {format(day, "d")}
              </div>

              {/* Job count badge */}
              {dayJobs.length > 0 && (
                <div className="text-xs text-gray-500 font-medium mb-1">
                  {dayJobs.length} job{dayJobs.length !== 1 ? "s" : ""}
                </div>
              )}

              {/* Department dots */}
              {deptIds.length > 0 && (
                <div className="flex flex-wrap gap-0.5">
                  {deptIds.map(dId => (
                    <span key={dId} className={`inline-block w-2 h-2 rounded-full ${DEPT_DOT[dId] ?? "bg-gray-400"}`} />
                  ))}
                </div>
              )}

              {/* Mini job titles */}
              {dayJobs.slice(0, 2).map(job => {
                const dId = fieldWorkers.find(w => w.id === job.workerId)?.departmentId ?? "";
                const pill = DEPT_PILL[dId] ?? "bg-gray-100 text-gray-600";
                return (
                  <div key={job.id} className={`mt-0.5 text-[10px] rounded px-1 py-0.5 truncate leading-tight font-medium ${pill}`}>
                    {job.title}
                  </div>
                );
              })}
              {dayJobs.length > 2 && (
                <div className="text-[10px] text-gray-400 mt-0.5">+{dayJobs.length - 2} more</div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FieldDiariesPage() {
  const { user } = useAuth();
  const dashboardRole = getDashboardRole({ departmentId: user?.departmentId, role: user?.role });
  const isTechnician = dashboardRole === "service";

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [view, setView]             = useState<ViewMode>("day");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [weekAnchor, setWeekAnchor]     = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [monthAnchor, setMonthAnchor]   = useState<Date>(startOfMonth(new Date()));
  const [deptFilter, setDeptFilter]     = useState<string>("all");

  const { data: workers    = [] } = useQuery<Worker[]>    ({ queryKey: ["/api/workers"]     });
  const { data: jobs       = [] } = useQuery<Job[]>       ({ queryKey: ["/api/jobs"]        });
  const { data: clients    = [] } = useQuery<Client[]>    ({ queryKey: ["/api/clients"]     });
  const { data: departments= [] } = useQuery<Department[]>({ queryKey: ["/api/departments"] });

  const clientMap = useMemo(() => Object.fromEntries(clients.map(c    => [c.id, c])),    [clients]);
  const deptMap   = useMemo(() => Object.fromEntries(departments.map(d => [d.id, d])), [departments]);

  // For technicians: find their own worker record
  // Priority: email match → name match → busiest active worker in user's dept (demo fallback)
  const myWorker = useMemo(() => {
    if (!isTechnician) return null;
    const byEmail = workers.find(w => user?.email && w.email === user.email);
    if (byEmail) return byEmail;
    const byName = workers.find(w =>
      user?.firstName && user?.lastName &&
      w.name === `${user.firstName} ${user.lastName}`
    );
    if (byName) return byName;
    // Demo fallback: busiest active worker in user's department
    const inDept = workers
      .filter(w => w.departmentId === user?.departmentId && w.isActive !== false)
      .map(w => ({ w, count: jobs.filter(j => j.workerId === w.id).length }))
      .sort((a, b) => b.count - a.count);
    return inDept[0]?.w ?? null;
  }, [isTechnician, workers, jobs, user]);

  const fieldWorkers = useMemo(() => {
    // Technicians only see their own row
    if (isTechnician) return myWorker ? [myWorker] : [];
    return workers
      .filter(w => w.departmentId && SERVICE_DEPT_IDS.includes(w.departmentId) && w.isActive)
      .filter(w => deptFilter === "all" || w.departmentId === deptFilter)
      .sort((a, b) => (a.departmentId ?? "").localeCompare(b.departmentId ?? "") || a.name.localeCompare(b.name));
  }, [workers, deptFilter, isTechnician, myWorker]);

  const serviceDepts = departments.filter(d => SERVICE_DEPT_IDS.includes(d.id));

  // ── Navigator logic per view ──
  function prev() {
    if (view === "day")   setSelectedDate(d => subDays(d, 1));
    if (view === "week")  setWeekAnchor(d  => subWeeks(d, 1));
    if (view === "month") setMonthAnchor(d => subMonths(d, 1));
  }
  function next() {
    if (view === "day")   setSelectedDate(d => addDays(d, 1));
    if (view === "week")  setWeekAnchor(d  => addWeeks(d, 1));
    if (view === "month") setMonthAnchor(d => addMonths(d, 1));
  }
  function goToday() {
    setSelectedDate(new Date());
    setWeekAnchor(startOfWeek(new Date(), { weekStartsOn: 1 }));
    setMonthAnchor(startOfMonth(new Date()));
  }

  function periodLabel() {
    if (view === "day") {
      return isToday(selectedDate)
        ? `Today — ${format(selectedDate, "EEEE, d MMMM yyyy")}`
        : format(selectedDate, "EEEE, d MMMM yyyy");
    }
    if (view === "week") {
      const ws = weekAnchor;
      const we = endOfWeek(weekAnchor, { weekStartsOn: 1 });
      return `${format(ws, "d MMM")} – ${format(we, "d MMM yyyy")}`;
    }
    if (view === "month") {
      return format(monthAnchor, "MMMM yyyy");
    }
    return "";
  }

  function isCurrentPeriodToday() {
    if (view === "day")  return isToday(selectedDate);
    if (view === "week") return fnsIsSameDay(weekAnchor, startOfWeek(new Date(), { weekStartsOn: 1 }));
    if (view === "month") return fnsIsSameDay(monthAnchor, startOfMonth(new Date()));
    return false;
  }

  // When clicking a day in month view → switch to day view
  function handleMonthDayClick(day: Date) {
    setSelectedDate(day);
    setView("day");
  }

  const jobCountInPeriod = useMemo(() => {
    const workerIds = new Set(fieldWorkers.map(w => w.id));
    if (view === "day") return jobs.filter(j => jobOnDay(j, selectedDate) && workerIds.has(j.workerId ?? "")).length;
    if (view === "week") {
      const ws = weekAnchor;
      const we = endOfWeek(weekAnchor, { weekStartsOn: 1 });
      return jobs.filter(j => {
        if (!j.scheduledDate || !workerIds.has(j.workerId ?? "")) return false;
        try {
          const d = parseISO(j.scheduledDate as unknown as string);
          return d >= ws && d <= we;
        } catch { return false; }
      }).length;
    }
    if (view === "month") {
      const ms = monthAnchor;
      const me = endOfMonth(monthAnchor);
      return jobs.filter(j => {
        if (!j.scheduledDate || !workerIds.has(j.workerId ?? "")) return false;
        try {
          const d = parseISO(j.scheduledDate as unknown as string);
          return d >= ms && d <= me;
        } catch { return false; }
      }).length;
    }
    return 0;
  }, [jobs, view, selectedDate, weekAnchor, monthAnchor, fieldWorkers]);

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title={isTechnician ? "Field Diaries" : "Staff Schedule"} onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />
        <MobileNavigation isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

        <main className="flex-1 overflow-y-auto p-6 pb-20 lg:pb-6">
          <div className="space-y-5">

            {/* Page header */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                  <CalendarDays className="h-7 w-7 text-primary" />
                  {isTechnician ? "Field Diaries" : "Field Staff Schedule"}
                </h1>
                <p className="text-muted-foreground mt-1">
                  {isTechnician
                    ? "Submit job reports, notes, photos and signatures after completing work."
                    : "See each technician's jobs, locations and availability for the day"}
                </p>
              </div>

              {/* View toggle */}
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 self-start">
                {(["day", "week", "month"] as ViewMode[]).map(v => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors capitalize
                      ${view === v ? "bg-white shadow text-primary" : "text-gray-500 hover:text-gray-700"}`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Controls bar */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Department filter — hidden for technicians (they only see themselves) */}
              {!isTechnician && (
                <Select value={deptFilter} onValueChange={setDeptFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="All Departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {serviceDepts.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Date navigator */}
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" onClick={prev}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant={isCurrentPeriodToday() ? "default" : "outline"}
                  className="min-w-[200px] text-sm"
                  onClick={goToday}
                >
                  {isCurrentPeriodToday() ? "Today" : periodLabel()}
                </Button>
                <Button variant="outline" size="icon" onClick={next}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Summary */}
              <span className="text-sm text-muted-foreground ml-auto">
                {!isCurrentPeriodToday() && <span className="mr-1">{periodLabel()} ·</span>}
                <strong>{fieldWorkers.length}</strong> staff ·{" "}
                <strong>{jobCountInPeriod}</strong> job{jobCountInPeriod !== 1 ? "s" : ""}
              </span>
            </div>

            {/* View content */}
            {view === "day" && (
              <DayView
                selectedDate={selectedDate}
                fieldWorkers={fieldWorkers}
                jobs={jobs}
                clientMap={clientMap}
                deptMap={deptMap}
                isTechnician={isTechnician}
              />
            )}

            {view === "week" && (
              <WeekView
                weekStart={weekAnchor}
                fieldWorkers={fieldWorkers}
                jobs={jobs}
                clientMap={clientMap}
              />
            )}

            {view === "month" && (
              <MonthView
                monthAnchor={monthAnchor}
                jobs={jobs}
                fieldWorkers={fieldWorkers}
                onSelectDay={handleMonthDayClick}
              />
            )}

          </div>
        </main>
      </div>
    </div>
  );
}
