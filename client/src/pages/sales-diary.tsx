import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { format, parseISO, addDays } from "date-fns";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ChevronLeft, ChevronRight, Plus, MapPin, Phone, User,
  CheckCircle2, FileText, XCircle, Filter,
} from "lucide-react";
import type { Worker, SalesAppointment } from "@shared/schema";
import { SALES_APPT_TYPES, SALES_APPT_STATUSES } from "@shared/schema";
import type { DiaryEvent } from "@shared/calendar-types";
import { statusColorClasses } from "@shared/calendar-types";
import { getDashboardRole, canMoveCalendarEvent, type DashboardRole } from "@/lib/dashboardRole";
import {
  OutlookDiaryCalendar, OutlookColumnsView,
  type OutlookDiaryCalendarHandle, type OutlookCalView, type OutlookColumn,
} from "@/components/calendar/outlook-diary-calendar";

// ── Constants
const TYPE_LABELS: Record<string, string> = Object.fromEntries(SALES_APPT_TYPES.map(t => [t.value, t.label]));
const STATUS_LABELS: Record<string, string> = Object.fromEntries(SALES_APPT_STATUSES.map(s => [s.value, s.label]));
const TYPE_COLORS: Record<string, string> = {
  new_lead_meeting:      "#3b82f6",
  site_visit:            "#8b5cf6",
  quote_followup:        "#f59e0b",
  contract_renewal:      "#10b981",
  existing_client_visit: "#06b6d4",
  complaint_visit:       "#ef4444",
  internal_meeting:      "#6b7280",
  other:                 "#64748b",
};
type CalView = OutlookCalView | "team";
const VIEW_LABELS: Record<CalView, string> = {
  timeGridDay: "Day", timeGridWeek: "Week", dayGridMonth: "Month", listWeek: "List", team: "Team",
};

// ── Helpers
function timeToMinutes(t: string): number {
  const [h, m] = (t || "00:00").split(":").map(Number);
  return h * 60 + (isNaN(m) ? 0 : m);
}
function calcDuration(s: string, e: string): number {
  return Math.max(0, timeToMinutes(e) - timeToMinutes(s));
}
function formatDuration(min: number): string {
  if (min <= 0) return "";
  const h = Math.floor(min / 60), m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
function emptyForm(date?: string, start?: string, end?: string): Partial<SalesAppointment> {
  return {
    title: "", clientName: "", contactPerson: "", phone: "", siteAddress: "",
    appointmentType: "new_lead_meeting", appointmentTypeOther: "", assignedToId: "",
    date: date || format(new Date(), "yyyy-MM-dd"),
    startTime: start || "09:00", endTime: end || "10:00",
    status: "planned", notes: "",
  };
}

/** Maps a SalesAppointment record onto the standard cross-app DiaryEvent shape. */
function apptToDiaryEvent(a: SalesAppointment, workers: Worker[], canMove: boolean): DiaryEvent {
  return {
    eventId: a.id,
    sourceType: "salesAppointment",
    sourceId: a.id,
    title: a.title || a.clientName || "Appointment",
    clientName: a.clientName,
    department: a.departmentId,
    serviceType: TYPE_LABELS[a.appointmentType] || a.appointmentType,
    assignedUserId: a.assignedToId,
    assignedUserName: workers.find(w => w.id === a.assignedToId)?.name || "Unassigned",
    startDateTime: `${a.date}T${a.startTime}`,
    endDateTime: `${a.date}T${a.endTime}`,
    durationMinutes: calcDuration(a.startTime, a.endTime),
    status: a.status,
    location: a.siteAddress,
    colour: TYPE_COLORS[a.appointmentType] || "#64748b",
    editable: canMove,
    draggable: canMove,
    meta: { raw: a },
  };
}

export default function SalesDiary() {
  const { toast } = useToast();
  const { user } = useAuth();
  const calendarRef = useRef<OutlookDiaryCalendarHandle>(null);

  const [view, setView] = useState<CalView>("timeGridWeek");
  const [viewTitle, setViewTitle] = useState("");
  const [teamDate, setTeamDate] = useState(format(new Date(), "yyyy-MM-dd"));

  // Filters
  const [filterRep, setFilterRep] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterClient, setFilterClient] = useState("");

  // Dialogs
  const [showForm, setShowForm] = useState(false);
  const [editAppt, setEditAppt] = useState<SalesAppointment | null>(null);
  const [formData, setFormData] = useState<Partial<SalesAppointment>>(emptyForm());
  const [detailAppt, setDetailAppt] = useState<SalesAppointment | null>(null);
  const [completeAppt, setCompleteAppt] = useState<SalesAppointment | null>(null);
  const [completionData, setCompletionData] = useState({ completionNote: "", clientFeedback: "", nextAction: "", followUpDate: "" });

  // Hover tooltip
  const [tipAppt, setTipAppt] = useState<SalesAppointment | null>(null);
  const [tipPos, setTipPos] = useState({ x: 0, y: 0 });

  // Track mouse for tooltip repositioning
  useEffect(() => {
    if (!tipAppt) return;
    const onMove = (e: MouseEvent) => setTipPos({ x: e.clientX, y: e.clientY });
    document.addEventListener("mousemove", onMove);
    return () => document.removeEventListener("mousemove", onMove);
  }, [!!tipAppt]);

  const searchStr = useSearch();

  // ── Queries
  const { data: appointments = [] } = useQuery<SalesAppointment[]>({ queryKey: ["/api/sales-appointments"] });
  const { data: workers = [] } = useQuery<Worker[]>({ queryKey: ["/api/workers"] });

  const currentWorker = useMemo(() => {
    if (!user) return null;
    const byEmail = workers.find(w => w.email?.toLowerCase() === (user.email || "").toLowerCase());
    if (byEmail) return byEmail;
    const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
    return workers.find(w => w.name.toLowerCase() === fullName) || null;
  }, [workers, user]);

  const role: DashboardRole = useMemo(
    () => getDashboardRole({ departmentId: user?.departmentId, role: user?.role }),
    [user]
  );

  useEffect(() => {
    if (showForm && !editAppt && currentWorker && !formData.assignedToId) {
      setFormData(f => ({ ...f, assignedToId: currentWorker.id }));
    }
  }, [showForm, editAppt, currentWorker]);

  // Handle deep-link from leads
  useEffect(() => {
    if (!searchStr) return;
    const params = new URLSearchParams(searchStr);
    const clientName = params.get("clientName");
    if (!clientName) return;
    const repId = params.get("assignedTo") || currentWorker?.id || "";
    setFormData({
      ...emptyForm(),
      clientName,
      contactPerson: params.get("contactPerson") || "",
      phone: params.get("phone") || "",
      siteAddress: params.get("siteAddress") || "",
      leadId: params.get("leadId") || undefined,
      appointmentType: (params.get("appointmentType") as any) || "new_lead_meeting",
      title: `${TYPE_LABELS[params.get("appointmentType") || "new_lead_meeting"]} – ${clientName}`,
      assignedToId: repId,
    });
    setEditAppt(null);
    setShowForm(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const salesWorkers = useMemo(
    () => workers.filter(w => w.departmentId === "div-5" || appointments.some(a => a.assignedToId === w.id)),
    [workers, appointments]
  );

  const workerName = (id: string | null | undefined) => workers.find(w => w.id === id)?.name || "Unassigned";

  // ── Mutations
  const createMut = useMutation({
    mutationFn: (data: Partial<SalesAppointment>) => apiRequest("POST", "/api/sales-appointments", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/sales-appointments"] }); setShowForm(false); toast({ title: "Appointment created" }); },
    onError: (err: any) => {
      let detail = "";
      try { const p = JSON.parse(String(err?.message ?? "").replace(/^\d+:\s*/, "")); detail = p?.details || p?.error || ""; } catch {}
      toast({ title: "Could not create appointment" + (detail ? `: ${detail}` : ""), variant: "destructive" });
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...data }: Partial<SalesAppointment> & { id: string }) => apiRequest("PATCH", `/api/sales-appointments/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-appointments"] });
      setShowForm(false); setEditAppt(null); setDetailAppt(null); setCompleteAppt(null);
      toast({ title: "Appointment updated" });
    },
    onError: (err: any) => {
      let detail = "";
      try { const p = JSON.parse(String(err?.message ?? "").replace(/^\d+:\s*/, "")); detail = p?.details || p?.error || ""; } catch {}
      toast({ title: "Could not update appointment" + (detail ? `: ${detail}` : ""), variant: "destructive" });
    },
  });

  const moveMut = useMutation({
    mutationFn: ({ id, ...data }: any) => apiRequest("PATCH", `/api/sales-appointments/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/sales-appointments"] }); toast({ title: "Appointment moved." }); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/sales-appointments/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/sales-appointments"] }); setDetailAppt(null); toast({ title: "Appointment deleted" }); },
  });

  // ── Filtered appointments → standardized DiaryEvent shape
  const filtered = useMemo(() => appointments.filter(a => {
    if (filterRep !== "all" && a.assignedToId !== filterRep) return false;
    if (filterType !== "all" && a.appointmentType !== filterType) return false;
    if (filterStatus !== "all" && a.status !== filterStatus) return false;
    if (filterClient && !a.clientName?.toLowerCase().includes(filterClient.toLowerCase())) return false;
    return true;
  }), [appointments, filterRep, filterType, filterStatus, filterClient]);

  const diaryEvents = useMemo(() => filtered.map(a => apptToDiaryEvent(
    a, workers,
    canMoveCalendarEvent(role, currentWorker?.id, { sourceType: "salesAppointment", assignedUserId: a.assignedToId }),
  )), [filtered, workers, role, currentWorker]);

  // ── Open / edit helpers
  const openNew = useCallback((date?: string, startTime?: string, endTime?: string) => {
    setEditAppt(null);
    setFormData({ ...emptyForm(date, startTime, endTime), assignedToId: currentWorker?.id || "" });
    setShowForm(true);
  }, [currentWorker]);

  const openEdit = useCallback((a: SalesAppointment) => {
    setEditAppt(a);
    setFormData({ ...a });
    setDetailAppt(null);
    setShowForm(true);
  }, []);

  const markComplete = useCallback((a: SalesAppointment) => {
    setCompleteAppt(a);
    setCompletionData({ completionNote: a.completionNote || "", clientFeedback: a.clientFeedback || "", nextAction: a.nextAction || "", followUpDate: a.followUpDate || "" });
    setDetailAppt(null);
  }, []);

  const saveCompletion = useCallback(() => {
    if (!completeAppt) return;
    updateMut.mutate({ id: completeAppt.id, status: "completed", ...completionData });
    setCompleteAppt(null);
  }, [completeAppt, completionData]);

  const saveForm = useCallback(() => {
    if (!formData.appointmentType) { toast({ title: "Appointment type is required", variant: "destructive" }); return; }
    if (!formData.assignedToId) { toast({ title: "Please select an assigned sales rep.", variant: "destructive" }); return; }
    if (!formData.date) { toast({ title: "Date is required", variant: "destructive" }); return; }
    if (!formData.startTime || !formData.endTime) { toast({ title: "Start and end time are required", variant: "destructive" }); return; }
    if (timeToMinutes(formData.endTime) <= timeToMinutes(formData.startTime)) { toast({ title: "End time must be after start time.", variant: "destructive" }); return; }
    if (!formData.title && !formData.clientName) { toast({ title: "Please enter a title or client name.", variant: "destructive" }); return; }

    const duration = calcDuration(formData.startTime!, formData.endTime!);
    const payload: any = {
      ...formData,
      title: formData.title || formData.clientName || "Appointment",
      assignedToId: formData.assignedToId || null,
      estimatedDuration: duration > 0 ? duration : null,
      leadId: formData.leadId || null,
      quoteId: formData.quoteId || null,
      departmentId: formData.departmentId || null,
    };
    if (editAppt) updateMut.mutate({ ...payload, id: editAppt.id });
    else createMut.mutate(payload);
  }, [formData, editAppt]);

  // ── OutlookDiaryCalendar callbacks
  const handleEventClick = useCallback((ev: DiaryEvent) => {
    const a = ev.meta?.raw as SalesAppointment | undefined;
    if (a) setDetailAppt(a);
  }, []);

  const handleEventDrop = useCallback((ev: DiaryEvent, newStart: Date, newEnd: Date, revert: () => void) => {
    const a = ev.meta?.raw as SalesAppointment | undefined;
    if (!a) return;
    const newDate = format(newStart, "yyyy-MM-dd");
    const newStartTime = format(newStart, "HH:mm");
    const newEndTime = format(newEnd, "HH:mm");
    moveMut.mutate(
      { id: a.id, date: newDate, startTime: newStartTime, endTime: newEndTime },
      {
        onError: (err: any) => {
          revert();
          let detail = "";
          try { const p = JSON.parse(String(err?.message ?? "").replace(/^\d+:\s*/, "")); detail = p?.details || p?.error || ""; } catch {}
          toast({ title: `Could not move appointment${detail ? ": " + detail : ""}`, variant: "destructive" });
        },
      }
    );
  }, []);

  const handleEventResize = useCallback((ev: DiaryEvent, _newStart: Date, newEnd: Date, revert: () => void) => {
    const a = ev.meta?.raw as SalesAppointment | undefined;
    if (!a) return;
    const newEndTime = format(newEnd, "HH:mm");
    moveMut.mutate(
      { id: a.id, endTime: newEndTime },
      {
        onError: (err: any) => {
          revert();
          let detail = "";
          try { const p = JSON.parse(String(err?.message ?? "").replace(/^\d+:\s*/, "")); detail = p?.details || p?.error || ""; } catch {}
          toast({ title: `Could not resize appointment${detail ? ": " + detail : ""}`, variant: "destructive" });
        },
      }
    );
  }, []);

  const handleEventMouseEnter = useCallback((ev: DiaryEvent, x: number, y: number) => {
    const a = ev.meta?.raw as SalesAppointment | undefined;
    if (!a) return;
    setTipAppt(a);
    setTipPos({ x, y });
  }, []);

  const handleSelect = useCallback((start: Date, end: Date) => {
    const d = format(start, "yyyy-MM-dd");
    const s = format(start, "HH:mm");
    const e = format(end, "HH:mm");
    openNew(d, s === e ? "09:00" : s, s === e ? "10:00" : e);
  }, [openNew]);

  // ── Calendar navigation
  const navPrev  = () => { if (view === "team") setTeamDate(d => format(addDays(parseISO(d), -1), "yyyy-MM-dd")); else calendarRef.current?.prev(); };
  const navNext  = () => { if (view === "team") setTeamDate(d => format(addDays(parseISO(d), 1), "yyyy-MM-dd"));  else calendarRef.current?.next(); };
  const navToday = () => { if (view === "team") setTeamDate(format(new Date(), "yyyy-MM-dd"));                    else calendarRef.current?.today(); };

  const switchView = (v: CalView) => {
    setView(v);
    if (v !== "team") {
      setTimeout(() => calendarRef.current?.getApi()?.changeView(v), 0);
    }
  };

  // ── Team View columns (side-by-side reassignment cards)
  const teamColumns: OutlookColumn[] = useMemo(() => {
    const reps = salesWorkers.length > 0 ? salesWorkers : workers.slice(0, 4);
    const dayEvents = diaryEvents
      .filter(ev => ev.startDateTime.startsWith(teamDate))
      .sort((a, b) => a.startDateTime.localeCompare(b.startDateTime));
    return reps.map(rep => ({
      id: rep.id,
      label: rep.name,
      sublabel: rep.role || "Sales Rep",
      events: dayEvents.filter(ev => ev.assignedUserId === rep.id),
    }));
  }, [salesWorkers, workers, diaryEvents, teamDate]);

  const handleTeamReassign = useCallback((ev: DiaryEvent, targetColumnId: string) => {
    const a = ev.meta?.raw as SalesAppointment | undefined;
    if (!a || a.assignedToId === targetColumnId) return;
    moveMut.mutate(
      { id: a.id, assignedToId: targetColumnId },
      {
        onSuccess: () => toast({ title: `Moved to ${workerName(targetColumnId)}.` }),
        onError: (err: any) => {
          let detail = "";
          try { const p = JSON.parse(String(err?.message ?? "").replace(/^\d+:\s*/, "")); detail = p?.details || p?.error || ""; } catch {}
          queryClient.invalidateQueries({ queryKey: ["/api/sales-appointments"] });
          toast({ title: `Could not move appointment${detail ? ": " + detail : ""}`, variant: "destructive" });
        },
      }
    );
  }, [workers]);

  const hasFilters = filterRep !== "all" || filterType !== "all" || filterStatus !== "all" || filterClient !== "";

  return (
      <>
        <div className="p-4 space-y-3">

          {/* ── Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* View switcher */}
            <div className="flex items-center gap-0.5 bg-white border rounded-lg p-1">
              {(["timeGridDay","timeGridWeek","dayGridMonth","listWeek","team"] as CalView[]).map(v => (
                <Button key={v} variant={view === v ? "default" : "ghost"} size="sm"
                  className="h-7 text-xs px-2.5" onClick={() => switchView(v)}>
                  {VIEW_LABELS[v]}
                </Button>
              ))}
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={navPrev}><ChevronLeft className="h-4 w-4" /></Button>
              <span className="text-sm font-medium text-gray-700 min-w-[200px] text-center">
                {view === "team" ? `Team · ${format(parseISO(teamDate), "EEEE, d MMMM yyyy")}` : viewTitle}
              </span>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={navNext}><ChevronRight className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={navToday}>Today</Button>
            </div>

            <div className="flex-1" />
            <Button size="sm" className="h-7 text-xs gap-1 bg-blue-600 hover:bg-blue-700" onClick={() => openNew()}>
              <Plus className="h-3.5 w-3.5" />New Appointment
            </Button>
          </div>

          {/* ── Filters */}
          <div className="flex flex-wrap gap-2 bg-white border rounded-lg p-2">
            <Filter className="h-4 w-4 text-gray-400 self-center flex-shrink-0" />
            <Select value={filterRep} onValueChange={setFilterRep}>
              <SelectTrigger className="h-7 text-xs w-40"><SelectValue placeholder="All reps" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sales Reps</SelectItem>
                {salesWorkers.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-7 text-xs w-44"><SelectValue placeholder="All types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {SALES_APPT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-7 text-xs w-36"><SelectValue placeholder="All statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {SALES_APPT_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="Search client…" value={filterClient} onChange={e => setFilterClient(e.target.value)} className="h-7 text-xs w-36" />
            {hasFilters && (
              <Button variant="ghost" size="sm" className="h-7 text-xs text-gray-400"
                onClick={() => { setFilterRep("all"); setFilterType("all"); setFilterStatus("all"); setFilterClient(""); }}>
                Clear
              </Button>
            )}
          </div>

          {/* ── Calendar / Team View */}
          {view === "team" ? (
            <OutlookColumnsView
              columns={teamColumns}
              onEventClick={handleEventClick}
              onEventMouseEnter={handleEventMouseEnter}
              onEventMouseLeave={() => setTipAppt(null)}
              onReassign={handleTeamReassign}
              emptyLabel="No appointments today"
            />
          ) : (
            <OutlookDiaryCalendar
              ref={calendarRef}
              events={diaryEvents}
              view={view}
              onDatesSet={setViewTitle}
              onEventClick={handleEventClick}
              onEventDrop={handleEventDrop}
              onEventResize={handleEventResize}
              onEventMouseEnter={handleEventMouseEnter}
              onEventMouseLeave={() => setTipAppt(null)}
              onSelect={handleSelect}
            />
          )}

        </div>
      {/* ── Hover Tooltip */}
      {tipAppt && (
        <div
          className="fixed z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-3 text-xs pointer-events-none"
          style={{
            maxWidth: 280,
            left: Math.min(tipPos.x + 14, window.innerWidth - 290),
            top: Math.min(tipPos.y + 14, window.innerHeight - 230),
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: TYPE_COLORS[tipAppt.appointmentType] }} />
            <p className="font-bold text-sm text-gray-900 leading-tight">{tipAppt.clientName || tipAppt.title}</p>
          </div>
          {tipAppt.contactPerson && <p className="text-gray-600 flex items-center gap-1 mb-0.5"><User className="h-3 w-3 text-gray-400" />{tipAppt.contactPerson}</p>}
          {tipAppt.phone && <p className="text-gray-600 flex items-center gap-1 mb-0.5"><Phone className="h-3 w-3 text-gray-400" />{tipAppt.phone}</p>}
          {tipAppt.siteAddress && <p className="text-gray-600 flex items-center gap-1 mb-0.5"><MapPin className="h-3 w-3 text-gray-400" />{tipAppt.siteAddress}</p>}
          <div className="border-t border-gray-100 mt-2 pt-2 space-y-0.5 text-gray-700">
            <p><span className="text-gray-400 mr-1">Type:</span>{TYPE_LABELS[tipAppt.appointmentType]}</p>
            <p><span className="text-gray-400 mr-1">Rep:</span>{workerName(tipAppt.assignedToId)}</p>
            <p><span className="text-gray-400 mr-1">Date:</span>{tipAppt.date}</p>
            <p><span className="text-gray-400 mr-1">Time:</span>{tipAppt.startTime}–{tipAppt.endTime}
              {calcDuration(tipAppt.startTime, tipAppt.endTime) > 0 ? ` (${formatDuration(calcDuration(tipAppt.startTime, tipAppt.endTime))})` : ""}
            </p>
            <p><span className="text-gray-400 mr-1">Status:</span>
              <span className={`px-1 rounded border text-xs ${statusColorClasses(tipAppt.status)}`}>{STATUS_LABELS[tipAppt.status] || tipAppt.status}</span>
            </p>
            {tipAppt.notes && <p className="border-t border-gray-100 pt-1 mt-1 text-gray-600 line-clamp-3"><span className="text-gray-400 mr-1">Notes:</span>{tipAppt.notes}</p>}
          </div>
        </div>
      )}

      {/* ═══ CREATE / EDIT DIALOG */}
      <Dialog open={showForm} onOpenChange={v => { setShowForm(v); if (!v) setEditAppt(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editAppt ? "Edit Appointment" : "New Appointment"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Title</Label>
              <Input value={formData.title || ""} onChange={e => setFormData(f => ({ ...f, title: e.target.value }))} placeholder="Appointment title" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Client / Company Name *</Label>
              <Input value={formData.clientName || ""} onChange={e => setFormData(f => ({ ...f, clientName: e.target.value }))} placeholder="Client name" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Contact Person</Label>
              <Input value={formData.contactPerson || ""} onChange={e => setFormData(f => ({ ...f, contactPerson: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Phone</Label>
              <Input value={formData.phone || ""} onChange={e => setFormData(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Site Address</Label>
              <Input value={formData.siteAddress || ""} onChange={e => setFormData(f => ({ ...f, siteAddress: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Appointment Type *</Label>
              <Select value={formData.appointmentType || "new_lead_meeting"} onValueChange={v => setFormData(f => ({ ...f, appointmentType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SALES_APPT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {formData.appointmentType === "other" && (
              <div className="space-y-1">
                <Label className="text-xs">Describe the Appointment</Label>
                <Input value={formData.appointmentTypeOther || ""} onChange={e => setFormData(f => ({ ...f, appointmentTypeOther: e.target.value }))} />
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Assigned Sales Rep *</Label>
              <Select value={formData.assignedToId || ""} onValueChange={v => setFormData(f => ({ ...f, assignedToId: v || "" }))}>
                <SelectTrigger className={!formData.assignedToId ? "border-orange-300" : ""}><SelectValue placeholder="Select sales rep" /></SelectTrigger>
                <SelectContent>
                  {(salesWorkers.length > 0 ? salesWorkers : workers).map(w => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={formData.status || "planned"} onValueChange={v => setFormData(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SALES_APPT_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Date *</Label>
              <Input type="date" value={formData.date || ""} onChange={e => setFormData(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Start Time *</Label>
              <Input type="time" value={formData.startTime || ""} onChange={e => setFormData(f => ({ ...f, startTime: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">End Time *</Label>
              <Input type="time" value={formData.endTime || ""} onChange={e => setFormData(f => ({ ...f, endTime: e.target.value }))} />
            </div>
            {formData.startTime && formData.endTime && timeToMinutes(formData.endTime) > timeToMinutes(formData.startTime) && (
              <div className="space-y-1">
                <Label className="text-xs text-gray-500">Duration</Label>
                <p className="text-sm font-medium py-2 px-3 bg-gray-50 border rounded-md text-gray-700">
                  {formatDuration(calcDuration(formData.startTime, formData.endTime))}
                </p>
              </div>
            )}
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Notes</Label>
              <Textarea value={formData.notes || ""} onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={saveForm} disabled={createMut.isPending || updateMut.isPending}>
              {(createMut.isPending || updateMut.isPending) ? "Saving…" : editAppt ? "Save Changes" : "Create Appointment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ DETAIL DIALOG */}
      {detailAppt && (
        <Dialog open onOpenChange={() => setDetailAppt(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: TYPE_COLORS[detailAppt.appointmentType] }} />
                {detailAppt.clientName || detailAppt.title}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-1">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className={`border ${statusColorClasses(detailAppt.status)}`}>{STATUS_LABELS[detailAppt.status] || detailAppt.status}</Badge>
                <Badge variant="outline" className="text-gray-600">{TYPE_LABELS[detailAppt.appointmentType]}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><p className="text-xs text-gray-400 mb-0.5">Client</p><p className="font-medium">{detailAppt.clientName}</p></div>
                {detailAppt.contactPerson && <div><p className="text-xs text-gray-400 mb-0.5">Contact</p><p>{detailAppt.contactPerson}</p></div>}
                {detailAppt.phone && <div><p className="text-xs text-gray-400 mb-0.5">Phone</p><p>{detailAppt.phone}</p></div>}
                <div><p className="text-xs text-gray-400 mb-0.5">Date</p><p>{detailAppt.date && format(parseISO(detailAppt.date), "EEE d MMM yyyy")}</p></div>
                <div><p className="text-xs text-gray-400 mb-0.5">Time</p>
                  <p>{detailAppt.startTime} – {detailAppt.endTime}
                    <span className="text-gray-500 text-xs ml-1">({formatDuration(calcDuration(detailAppt.startTime, detailAppt.endTime))})</span>
                  </p>
                </div>
                <div><p className="text-xs text-gray-400 mb-0.5">Sales Rep</p><p>{workerName(detailAppt.assignedToId)}</p></div>
                {detailAppt.siteAddress && <div className="col-span-2"><p className="text-xs text-gray-400 mb-0.5">Address</p><p className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-gray-400" />{detailAppt.siteAddress}</p></div>}
                {detailAppt.notes && <div className="col-span-2"><p className="text-xs text-gray-400 mb-0.5">Notes</p><p className="text-sm text-gray-700 bg-gray-50 rounded p-2">{detailAppt.notes}</p></div>}
              </div>
              {detailAppt.status === "completed" && (detailAppt.completionNote || detailAppt.clientFeedback || detailAppt.nextAction) && (
                <div className="border rounded-lg p-3 bg-green-50 space-y-1 text-sm">
                  <p className="text-xs font-semibold text-green-700 mb-1">Completion Summary</p>
                  {detailAppt.completionNote && <p><span className="text-xs text-gray-500">What happened:</span> {detailAppt.completionNote}</p>}
                  {detailAppt.clientFeedback && <p><span className="text-xs text-gray-500">Feedback:</span> {detailAppt.clientFeedback}</p>}
                  {detailAppt.nextAction && <p><span className="text-xs text-gray-500">Next action:</span> {detailAppt.nextAction}</p>}
                  {detailAppt.followUpDate && <p><span className="text-xs text-gray-500">Follow-up:</span> {format(parseISO(detailAppt.followUpDate), "d MMM yyyy")}</p>}
                </div>
              )}
            </div>
            <DialogFooter className="flex flex-wrap gap-2 justify-start sm:justify-between">
              <div className="flex gap-2 flex-wrap">
                {detailAppt.status !== "completed" && (
                  <Button size="sm" variant="outline" className="text-green-700 border-green-300 hover:bg-green-50" onClick={() => markComplete(detailAppt)}>
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Mark Complete
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => openEdit(detailAppt)}><FileText className="h-3.5 w-3.5 mr-1" />Edit</Button>
                {detailAppt.status !== "cancelled" && (
                  <Button size="sm" variant="outline" className="text-red-600 border-red-200" onClick={() => updateMut.mutate({ id: detailAppt.id, status: "cancelled" })}>
                    <XCircle className="h-3.5 w-3.5 mr-1" />Cancel
                  </Button>
                )}
                <Button size="sm" variant="outline" className="text-red-700 border-red-200" onClick={() => { if (confirm("Delete?")) deleteMut.mutate(detailAppt.id); }}>
                  <XCircle className="h-3.5 w-3.5 mr-1" />Delete
                </Button>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setDetailAppt(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ═══ COMPLETION DIALOG */}
      {completeAppt && (
        <Dialog open onOpenChange={() => setCompleteAppt(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Mark as Completed — {completeAppt.clientName}</DialogTitle></DialogHeader>
            <div className="space-y-3 py-1">
              {completeAppt.appointmentType === "site_visit" && (
                <p className="text-xs text-purple-700 bg-purple-50 border border-purple-200 rounded px-2 py-1.5">
                  Completing this site visit will move the lead to "Quote Required" on the Leads board.
                </p>
              )}
              <div className="space-y-1">
                <Label className="text-xs">What happened?</Label>
                <Textarea value={completionData.completionNote} onChange={e => setCompletionData(d => ({ ...d, completionNote: e.target.value }))} rows={3} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Client Feedback</Label>
                <Textarea value={completionData.clientFeedback} onChange={e => setCompletionData(d => ({ ...d, clientFeedback: e.target.value }))} rows={2} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Next Action Required</Label>
                <Input value={completionData.nextAction} onChange={e => setCompletionData(d => ({ ...d, nextAction: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Follow-up Date (optional)</Label>
                <Input type="date" value={completionData.followUpDate} onChange={e => setCompletionData(d => ({ ...d, followUpDate: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCompleteAppt(null)}>Cancel</Button>
              <Button onClick={saveCompletion} disabled={updateMut.isPending} className="bg-green-600 hover:bg-green-700">
                {updateMut.isPending ? "Saving…" : "Save & Complete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      </>
  );
}
