import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Link, useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  format, parseISO,
} from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { getDashboardRole, canMoveCalendarEvent, type DashboardRole } from "@/lib/dashboardRole";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronLeft, ChevronRight, MapPin, Clock, User,
  X, Search, Navigation, FileText,
} from "lucide-react";
import type { Worker, Job, Client } from "@shared/schema";
import type { DiaryEvent } from "@shared/calendar-types";
import { statusColorClasses } from "@shared/calendar-types";
import {
  OutlookDiaryCalendar,
  type OutlookDiaryCalendarHandle,
  type OutlookCalView,
} from "@/components/calendar/outlook-diary-calendar";

// ─── Constants ────────────────────────────────────────────────────────────────

const SERVICE_DEPT_IDS = ["div-1", "div-2", "div-3", "div-4"];

function jobToDiaryEvent(j: Job, clientMap: Record<string, Client>, workers: Worker[], role: DashboardRole, currentWorkerId: string | null | undefined): DiaryEvent {
  const client = clientMap[j.clientId ?? ""];
  const worker = workers.find(w => w.id === j.workerId);
  const start = j.scheduledDate as unknown as string;
  const time = j.scheduledTime || "09:00";
  const startDateTime = `${start.split("T")[0]}T${time}`;
  
  // End time calculation
  const startDate = parseISO(startDateTime);
  const endDate = new Date(startDate.getTime() + (j.estimatedDuration || 60) * 60000);

  const canMove = canMoveCalendarEvent(role, currentWorkerId, {
    sourceType: j.isContract ? "serviceContractOccurrence" : "onceOffJob",
    assignedUserId: j.workerId,
  });

  return {
    eventId: j.id,
    sourceType: j.isContract ? "serviceContractOccurrence" : "onceOffJob",
    sourceId: j.id,
    clientId: j.clientId,
    title: j.title,
    clientName: client?.name || "Unknown Client",
    department: j.departmentId,
    serviceType: j.serviceType,
    assignedUserId: j.workerId,
    assignedUserName: worker?.name || "Unassigned",
    startDateTime: startDate.toISOString(),
    endDateTime: endDate.toISOString(),
    durationMinutes: j.estimatedDuration || 60,
    status: j.status,
    location: j.location || client?.address,
    googleMapsLink: j.googleMapsLink,
    editable: canMove,
    draggable: canMove,
    meta: {
      raw: j,
      routeSequence: j.orderNo,
      contractNo: j.contractNo,
      invoiceStatus: j.invoiceStatus,
      jobNumber: j.jobNumber,
    },
  };
}

export default function FieldDiaries() {
  const { user } = useAuth();
  const { toast } = useToast();
  const calendarRef = useRef<OutlookDiaryCalendarHandle>(null);

  const [view, setView] = useState<OutlookCalView>("timeGridDay");
  const [viewTitle, setViewTitle] = useState("");

  // Filters
  const [filterWorker, setFilterWorker] = useState("all");
  const [filterSvc, setFilterSvc] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterInv, setFilterInv] = useState("all");
  const [searchClient, setSearchClient] = useState("");

  // Details Dialog
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  // ── Deep-link: ?open=<diaryId> from global search
  const search = useSearch();
  const openDiaryId = new URLSearchParams(search).get('open');
  const { data: openDiary } = useQuery<any>({
    queryKey: [`/api/field-diaries/${openDiaryId}`],
    enabled: !!openDiaryId,
  });

  // ── Queries
  const { data: jobs = [], isLoading: jobsLoading } = useQuery<Job[]>({ queryKey: ["/api/jobs"] });
  const { data: workers = [] } = useQuery<Worker[]>({ queryKey: ["/api/workers"] });
  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["/api/clients"] });

  useEffect(() => {
    if (!openDiary || jobs.length === 0) return;
    const job = jobs.find(j => j.id === openDiary.jobId);
    if (job) {
      setSelectedJob(job);
      window.history.replaceState(null, '', '/field-diaries');
    }
  }, [openDiary, jobs]);

  const clientMap = useMemo(() => Object.fromEntries(clients.map(c => [c.id, c])), [clients]);

  const role = useMemo(() => getDashboardRole({ departmentId: (user as any)?.departmentId, role: (user as any)?.role }), [user]);
  const currentWorkerId = useMemo(() => {
    if (!user) return null;
    return workers.find(w => w.email === user.email)?.id;
  }, [user, workers]);

  const fieldWorkers = useMemo(() =>
    workers.filter(w => SERVICE_DEPT_IDS.includes(w.departmentId ?? "")),
    [workers]
  );

  const svcTypes = useMemo(() => {
    const s = new Set<string>();
    jobs.forEach(j => { if (j.serviceType) s.add(j.serviceType); });
    return Array.from(s).sort();
  }, [jobs]);

  // ── Mutations
  const updateJobMut = useMutation({
    mutationFn: ({ id, ...data }: any) => apiRequest("PATCH", `/api/jobs/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Job updated" });
      setSelectedJob(null);
    },
  });

  const filteredEvents = useMemo(() => {
    return jobs
      .filter(j => {
        if (filterWorker !== "all" && j.workerId !== filterWorker) return false;
        if (filterSvc !== "all" && j.serviceType !== filterSvc) return false;
        if (filterStatus === "completed" && j.status !== "completed") return false;
        if (filterStatus === "not_completed" && (j.status === "completed" || j.status === "cancelled")) return false;
        if (searchClient && !clientMap[j.clientId ?? ""]?.name?.toLowerCase().includes(searchClient.toLowerCase())) return false;
        if (filterInv !== "all") {
          if (filterInv === "not_invoiced" && (j.invoiceStatus && j.invoiceStatus !== "not_invoiced")) return false;
          if (filterInv === "ready" && j.invoiceStatus !== "ready_to_invoice") return false;
          if (filterInv === "invoiced" && !["invoiced", "exported"].includes(j.invoiceStatus || "")) return false;
        }
        return true;
      })
      .map(j => jobToDiaryEvent(j, clientMap, workers, role, currentWorkerId));
  }, [jobs, filterWorker, filterSvc, filterStatus, filterInv, searchClient, clientMap, workers, role, currentWorkerId]);

  const handleEventClick = useCallback((ev: DiaryEvent) => {
    setSelectedJob(ev.meta?.raw);
  }, []);

  const handleEventDrop = useCallback((ev: DiaryEvent, newStart: Date, newEnd: Date, revert: () => void) => {
    const j = ev.meta?.raw as Job;
    if (!j) return;
    updateJobMut.mutate(
      {
        id: j.id,
        scheduledDate: format(newStart, "yyyy-MM-dd"),
        scheduledTime: format(newStart, "HH:mm"),
        estimatedDuration: Math.round((newEnd.getTime() - newStart.getTime()) / 60000),
      },
      { onError: revert }
    );
  }, []);

  const hasFilters = filterWorker !== "all" || filterSvc !== "all" || filterStatus !== "all" || filterInv !== "all" || searchClient !== "";

  return (
      <>
        <div className="p-4 space-y-4">

          {/* ── Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 bg-white border rounded-lg p-1">
              {(["timeGridDay", "timeGridWeek", "dayGridMonth", "listWeek"] as OutlookCalView[]).map(v => (
                <Button
                  key={v}
                  variant={view === v ? "default" : "ghost"}
                  size="sm"
                  className="h-8 text-xs px-3"
                  onClick={() => { setView(v); setTimeout(() => calendarRef.current?.getApi()?.changeView(v), 0); }}
                >
                  {v === "timeGridDay" ? "Day" : v === "timeGridWeek" ? "Week" : v === "dayGridMonth" ? "Month" : "List"}
                </Button>
              ))}
            </div>

            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => calendarRef.current?.prev()}><ChevronLeft className="h-4 w-4" /></Button>
              <span className="text-sm font-semibold text-gray-700 min-w-[180px] text-center">{viewTitle}</span>
              <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => calendarRef.current?.next()}><ChevronRight className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => calendarRef.current?.today()}>Today</Button>
            </div>
          </div>

          {/* ── Filters */}
          <div className="flex flex-wrap gap-2 bg-white border rounded-xl p-3 shadow-sm">
            <div className="relative w-48">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search client..."
                value={searchClient}
                onChange={e => setSearchClient(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>

            <Select value={filterWorker} onValueChange={setFilterWorker}>
              <SelectTrigger className="h-9 w-44 text-sm"><SelectValue placeholder="All Staff" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Staff</SelectItem>
                {fieldWorkers.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={filterSvc} onValueChange={setFilterSvc}>
              <SelectTrigger className="h-9 w-48 text-sm"><SelectValue placeholder="All Services" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Services</SelectItem>
                {svcTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-9 w-40 text-sm"><SelectValue placeholder="All Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="completed">Completed Only</SelectItem>
                <SelectItem value="not_completed">Not Completed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterInv} onValueChange={setFilterInv}>
              <SelectTrigger className="h-9 w-40 text-sm"><SelectValue placeholder="Invoice Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Invoicing</SelectItem>
                <SelectItem value="not_invoiced">Not Invoiced</SelectItem>
                <SelectItem value="ready">Ready to Invoice</SelectItem>
                <SelectItem value="invoiced">Invoiced / Exported</SelectItem>
              </SelectContent>
            </Select>

            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
                onClick={() => {
                  setFilterWorker("all");
                  setFilterSvc("all");
                  setFilterStatus("all");
                  setFilterInv("all");
                  setSearchClient("");
                }}
              >
                <X className="h-3.5 w-3.5 mr-1" /> Clear
              </Button>
            )}
          </div>

          {/* ── Calendar */}
          <div className="relative flex-1">
            {jobsLoading && (
              <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center">
                <Badge variant="outline" className="animate-pulse">Loading jobs...</Badge>
              </div>
            )}
            <OutlookDiaryCalendar
              ref={calendarRef}
              events={filteredEvents}
              view={view}
              onDatesSet={setViewTitle}
              onEventClick={handleEventClick}
              onEventDrop={handleEventDrop}
              height={700}
            />
          </div>
        </div>

      {/* ── Details Dialog */}
      <Dialog open={!!selectedJob} onOpenChange={() => setSelectedJob(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-500" />
              {selectedJob?.title}
            </DialogTitle>
          </DialogHeader>

          {selectedJob && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase text-gray-400">Client</Label>
                  <p className="text-sm font-semibold">{clientMap[selectedJob.clientId]?.name}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase text-gray-400">Status</Label>
                  <div>
                    <Badge className={statusColorClasses(selectedJob.status)}>
                      {selectedJob.status}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-gray-400">Address</Label>
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                  <p className="text-sm">{selectedJob.location || "No address provided"}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase text-gray-400">Time</Label>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <p className="text-sm">{selectedJob.scheduledTime || "09:00"} ({selectedJob.estimatedDuration || 60}m)</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase text-gray-400">Staff</Label>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400" />
                    <p className="text-sm">{workers.find(w => w.id === selectedJob.workerId)?.name || "Unassigned"}</p>
                  </div>
                </div>
              </div>

              {selectedJob.notes && (
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase text-gray-400">Notes</Label>
                  <p className="text-sm text-gray-600 italic bg-gray-50 p-2 rounded">{selectedJob.notes}</p>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                {selectedJob.googleMapsLink && (
                  <Button variant="outline" size="sm" className="gap-2" asChild>
                    <a href={selectedJob.googleMapsLink} target="_blank" rel="noopener noreferrer">
                      <Navigation className="h-4 w-4" /> Open Maps
                    </a>
                  </Button>
                )}
                <Button variant="outline" size="sm" className="gap-2" asChild>
                  <Link href={`/jobs?id=${selectedJob.id}`}>
                    <FileText className="h-4 w-4" /> Open Job
                  </Link>
                </Button>
                <Button variant="outline" size="sm" className="gap-2" asChild>
                  <Link href={`/clients/${selectedJob.clientId}`}>
                    <User className="h-4 w-4" /> Open Client
                  </Link>
                </Button>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelectedJob(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </>
  );
}
