import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, isToday, parseISO, addDays, subDays } from "date-fns";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import MobileNavigation from "@/components/layout/mobile-nav";
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

const STATUS_CONFIG: Record<string, { icon: JSX.Element; label: string; class: string }> = {
  completed:   { icon: <CheckCircle2 className="h-3.5 w-3.5" />, label: "Completed",   class: "bg-green-100 text-green-700" },
  in_progress: { icon: <Loader2      className="h-3.5 w-3.5 animate-spin" />, label: "In Progress", class: "bg-blue-100 text-blue-700" },
  scheduled:   { icon: <Circle       className="h-3.5 w-3.5" />, label: "Scheduled",   class: "bg-gray-100 text-gray-700" },
  cancelled:   { icon: <AlertCircle  className="h-3.5 w-3.5" />, label: "Cancelled",   class: "bg-red-100 text-red-600" },
};

function formatTime(dateStr: string | null, timeStr: string | null): string {
  if (timeStr) return timeStr.slice(0, 5);
  if (dateStr) {
    try {
      return format(parseISO(dateStr), "HH:mm");
    } catch { return "—" }
  }
  return "—";
}

function isSameDay(dateStr: string | null, target: Date): boolean {
  if (!dateStr) return false;
  try {
    const d = parseISO(dateStr);
    return (
      d.getFullYear() === target.getFullYear() &&
      d.getMonth() === target.getMonth() &&
      d.getDate() === target.getDate()
    );
  } catch { return false; }
}

export default function FieldDiariesPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [deptFilter, setDeptFilter] = useState<string>("all");

  const { data: workers = [] } = useQuery<Worker[]>({ queryKey: ["/api/workers"] });
  const { data: jobs = [] } = useQuery<Job[]>({ queryKey: ["/api/jobs"] });
  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: departments = [] } = useQuery<Department[]>({ queryKey: ["/api/departments"] });

  const clientMap = useMemo(() =>
    Object.fromEntries(clients.map(c => [c.id, c])), [clients]);

  const deptMap = useMemo(() =>
    Object.fromEntries(departments.map(d => [d.id, d])), [departments]);

  const fieldWorkers = useMemo(() =>
    workers.filter(w => w.departmentId && SERVICE_DEPT_IDS.includes(w.departmentId) && w.isActive)
      .filter(w => deptFilter === "all" || w.departmentId === deptFilter)
      .sort((a, b) => (a.departmentId ?? "").localeCompare(b.departmentId ?? "") || a.name.localeCompare(b.name)),
    [workers, deptFilter]);

  const jobsForDate = useMemo(() =>
    jobs.filter(j => isSameDay(j.scheduledDate, selectedDate)),
    [jobs, selectedDate]);

  const serviceDepts = departments.filter(d => SERVICE_DEPT_IDS.includes(d.id));

  const dateLabel = isToday(selectedDate)
    ? `Today — ${format(selectedDate, "EEEE, d MMMM yyyy")}`
    : format(selectedDate, "EEEE, d MMMM yyyy");

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Field Diaries" onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />
        <MobileNavigation isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

        <main className="flex-1 overflow-y-auto p-6 pb-20 lg:pb-6">
          <div className="space-y-6">

            {/* Page header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                  <CalendarDays className="h-7 w-7 text-primary" />
                  Field Staff Diaries
                </h1>
                <p className="text-muted-foreground mt-1">
                  See where each technician will be — useful for planning on-site surveys
                </p>
              </div>

              {/* Date navigator */}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => setSelectedDate(d => subDays(d, 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant={isToday(selectedDate) ? "default" : "outline"}
                  className="min-w-[180px] text-sm"
                  onClick={() => setSelectedDate(new Date())}
                >
                  {isToday(selectedDate) ? "Today" : format(selectedDate, "d MMM yyyy")}
                </Button>
                <Button variant="outline" size="icon" onClick={() => setSelectedDate(d => addDays(d, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Filters + summary bar */}
            <div className="flex flex-wrap items-center gap-3">
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

              <span className="text-sm text-muted-foreground">
                {dateLabel} · <strong>{fieldWorkers.length}</strong> field staff · <strong>{jobsForDate.filter(j => fieldWorkers.some(w => w.id === j.workerId)).length}</strong> jobs
              </span>
            </div>

            {/* Worker diary cards */}
            {fieldWorkers.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <User className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No field staff found for the selected filter.</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {fieldWorkers.map(worker => {
                  const dept = deptMap[worker.departmentId ?? ""];
                  const workerJobs = jobsForDate
                    .filter(j => j.workerId === worker.id)
                    .sort((a, b) => {
                      const ta = a.scheduledTime ?? formatTime(a.scheduledDate, null);
                      const tb = b.scheduledTime ?? formatTime(b.scheduledDate, null);
                      return ta.localeCompare(tb);
                    });

                  const deptColorBar = DEPT_COLORS[worker.departmentId ?? ""] ?? "bg-gray-400";
                  const deptCard = DEPT_LIGHT[worker.departmentId ?? ""] ?? "bg-gray-50 border-gray-200";

                  return (
                    <Card key={worker.id} className={`border ${deptCard} overflow-hidden`}>
                      {/* Dept colour bar */}
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
                                <Phone className="h-3 w-3" />
                                {worker.phone}
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
                            {workerJobs.map((job, idx) => {
                              const client = clientMap[job.clientId ?? ""];
                              const statusCfg = STATUS_CONFIG[job.status ?? "scheduled"] ?? STATUS_CONFIG.scheduled;
                              const timeStr = formatTime(job.scheduledDate, job.scheduledTime);

                              return (
                                <div key={job.id} className="bg-white rounded-lg border p-3 space-y-1.5 shadow-sm">
                                  {/* Time + status row */}
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-800">
                                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                      {timeStr}
                                      {job.estimatedDuration && (
                                        <span className="text-xs font-normal text-muted-foreground">
                                          ({job.estimatedDuration} min)
                                        </span>
                                      )}
                                    </div>
                                    <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${statusCfg.class}`}>
                                      {statusCfg.icon}
                                      {statusCfg.label}
                                    </span>
                                  </div>

                                  {/* Job title */}
                                  <p className="text-sm font-medium leading-tight">{job.title}</p>

                                  {/* Client */}
                                  {client && (
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                      <Briefcase className="h-3 w-3 shrink-0" />
                                      <span className="truncate">{client.name}</span>
                                    </div>
                                  )}

                                  {/* Location */}
                                  {job.location && (
                                    <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                                      <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
                                      <span className="leading-snug">{job.location}</span>
                                    </div>
                                  )}

                                  {/* Notes for sales context */}
                                  {job.notes && (
                                    <p className="text-xs text-gray-400 italic border-t pt-1.5 mt-1">{job.notes}</p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Job count summary */}
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
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
