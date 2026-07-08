import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventClickArg, EventContentArg, EventMouseEnterArg, EventMouseLeaveArg, DateSelectArg } from "@fullcalendar/core";
import type { EventDropArg } from "@fullcalendar/core";
import type { EventResizeDoneArg } from "@fullcalendar/interaction";
import { format, differenceInMinutes, parseISO, addDays } from "date-fns";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Calendar, ChevronLeft, ChevronRight, Plus, MapPin, Phone, User,
  CheckCircle2, FileText, XCircle, MoreHorizontal, Users, Filter,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Worker, SalesAppointment } from "@shared/schema";
import { SALES_APPT_TYPES, SALES_APPT_STATUSES } from "@shared/schema";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";

// ── Constants
const TYPE_LABELS: Record<string, string> = Object.fromEntries(SALES_APPT_TYPES.map(t => [t.value, t.label]));
const STATUS_META: Record<string, { label: string; classes: string }> = {
  planned:     { label: "Planned",     classes: "bg-blue-50 text-blue-700 border-blue-200" },
  confirmed:   { label: "Confirmed",   classes: "bg-green-50 text-green-700 border-green-200" },
  completed:   { label: "Completed",   classes: "bg-gray-50 text-gray-600 border-gray-200" },
  cancelled:   { label: "Cancelled",   classes: "bg-red-50 text-red-700 border-red-200" },
  rescheduled: { label: "Rescheduled", classes: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  no_show:     { label: "No Show",     classes: "bg-orange-50 text-orange-700 border-orange-200" },
};
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
type CalView = "timeGridWeek" | "timeGridDay" | "dayGridMonth" | "listWeek" | "team";

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
function getApptLabel(a: SalesAppointment): string {
  const name = a.clientName || a.title || "Appointment";
  const type = TYPE_LABELS[a.appointmentType] || "";
  if (!type || name === type) return name;
  return `${name} – ${type}`;
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

export default function SalesDiary() {
  const { toast } = useToast();
  const { user } = useAuth();
  const calendarRef = useRef<FullCalendar>(null);

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

  // Team view drag
  const [dragOverRep, setDragOverRep] = useState<string | null>(null);
  const teamDragRef = useRef<SalesAppointment | null>(null);

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

  // ── Filtered appointments → FullCalendar events
  const filtered = useMemo(() => appointments.filter(a => {
    if (filterRep !== "all" && a.assignedToId !== filterRep) return false;
    if (filterType !== "all" && a.appointmentType !== filterType) return false;
    if (filterStatus !== "all" && a.status !== filterStatus) return false;
    if (filterClient && !a.clientName?.toLowerCase().includes(filterClient.toLowerCase())) return false;
    return true;
  }), [appointments, filterRep, filterType, filterStatus, filterClient]);

  const fcEvents = useMemo(() => filtered.map(a => {
    const color = TYPE_COLORS[a.appointmentType] || "#64748b";
    return {
      id: a.id,
      title: a.clientName || a.title || "Appointment",
      start: `${a.date}T${a.startTime}`,
      end: `${a.date}T${a.endTime}`,
      backgroundColor: color + "1a",
      borderColor: color,
      textColor: "#1f2937",
      extendedProps: { ...a, _color: color } as SalesAppointment & { _color: string },
    };
  }), [filtered]);

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

  // ── FullCalendar callbacks
  const handleEventDrop = useCallback((info: EventDropArg) => {
    const newDate = format(info.event.start!, "yyyy-MM-dd");
    const newStart = format(info.event.start!, "HH:mm");
    const newEnd = format(info.event.end!, "HH:mm");
    moveMut.mutate(
      { id: info.event.id, date: newDate, startTime: newStart, endTime: newEnd },
      {
        onError: (err: any) => {
          info.revert();
          let detail = "";
          try { const p = JSON.parse(String(err?.message ?? "").replace(/^\d+:\s*/, "")); detail = p?.details || p?.error || ""; } catch {}
          toast({ title: `Could not move appointment${detail ? ": " + detail : ""}`, variant: "destructive" });
        },
      }
    );
  }, []);

  const handleEventResize = useCallback((info: EventResizeDoneArg) => {
    const newEnd = format(info.event.end!, "HH:mm");
    moveMut.mutate(
      { id: info.event.id, endTime: newEnd },
      {
        onError: (err: any) => {
          info.revert();
          let detail = "";
          try { const p = JSON.parse(String(err?.message ?? "").replace(/^\d+:\s*/, "")); detail = p?.details || p?.error || ""; } catch {}
          toast({ title: `Could not resize appointment${detail ? ": " + detail : ""}`, variant: "destructive" });
        },
      }
    );
  }, []);

  const handleEventClick = useCallback((info: EventClickArg) => {
    info.jsEvent.preventDefault();
    const a = info.event.extendedProps as SalesAppointment;
    setDetailAppt(a);
  }, []);

  const handleEventMouseEnter = useCallback((info: EventMouseEnterArg) => {
    const a = info.event.extendedProps as SalesAppointment;
    setTipAppt(a);
    setTipPos({ x: info.jsEvent.clientX, y: info.jsEvent.clientY });
  }, []);

  const handleEventMouseLeave = useCallback((_info: EventMouseLeaveArg) => {
    setTipAppt(null);
  }, []);

  const handleSelect = useCallback((info: DateSelectArg) => {
    const d = format(info.start, "yyyy-MM-dd");
    const s = format(info.start, "HH:mm");
    const e = format(info.end, "HH:mm");
    openNew(d, s === e ? "09:00" : s, s === e ? "10:00" : e);
    calendarRef.current?.getApi().unselect();
  }, [openNew]);

  // ── Custom event content (Outlook-style labels)
  const renderEventContent = useCallback((info: EventContentArg) => {
    const a = info.event.extendedProps as SalesAppointment & { _color: string };
    const color = a._color || "#64748b";
    const name = a.clientName || a.title || "Appointment";
    const typeLabel = TYPE_LABELS[a.appointmentType] || "";
    const sm = STATUS_META[a.status] || STATUS_META.planned;
    const startStr = format(info.event.start!, "HH:mm");
    const endStr = format(info.event.end!, "HH:mm");
    const dur = differenceInMinutes(info.event.end!, info.event.start!);
    const durLabel = formatDuration(dur);
    const vType = info.view.type;

    // ── MONTH VIEW: compact "HH:mm Name – Type" bar
    if (vType === "dayGridMonth") {
      const label = typeLabel && name !== typeLabel ? `${name} – ${typeLabel}` : name;
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 3, padding: "1px 4px", overflow: "hidden", width: "100%" }}>
          <span style={{ fontSize: 10, color, fontWeight: 700, flexShrink: 0, lineHeight: 1.2 }}>{startStr}</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.2 }}>
            {label}
          </span>
        </div>
      );
    }

    // ── LIST VIEW: full row
    if (vType === "listWeek") {
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "2px 4px" }}>
          <strong style={{ color: "#111827", fontSize: 13 }}>{name}</strong>
          <span style={{ color: "#6b7280", fontSize: 12 }}>{typeLabel}</span>
          <span style={{ color, fontSize: 11, fontWeight: 600 }}>{startStr}–{endStr}{durLabel ? ` · ${durLabel}` : ""}</span>
          <span style={{ fontSize: 10, padding: "0 5px", borderRadius: 3, border: "1px solid" }} className={sm.classes}>{sm.label}</span>
        </div>
      );
    }

    // ── TIME GRID (week/day): Outlook-style block
    // Priority: time > client name > type > duration > status
    if (dur <= 15) {
      // Tiny block: just time + name on one line
      return (
        <div style={{ padding: "0 4px", overflow: "hidden", height: "100%", display: "flex", alignItems: "center" }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {startStr} {name}
          </span>
        </div>
      );
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", padding: "2px 4px 2px 0", overflow: "hidden", height: "100%", gap: 1 }}>
        {/* Time always first */}
        <span style={{ fontSize: 10, fontWeight: 600, color, whiteSpace: "nowrap", lineHeight: 1.2 }}>
          {startStr}–{endStr}{durLabel ? ` · ${durLabel}` : ""}
        </span>
        {/* Client name */}
        <span style={{ fontSize: 11, fontWeight: 700, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.3 }}>
          {name}
        </span>
        {/* Type — only if enough height */}
        {dur >= 30 && (
          <span style={{ fontSize: 10, color: "#4b5563", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.2 }}>
            {typeLabel}
          </span>
        )}
        {/* Status badge — only for large blocks */}
        {dur >= 75 && (
          <span style={{ fontSize: 9, padding: "1px 4px", borderRadius: 3, border: "1px solid currentColor", display: "inline-block", marginTop: "auto", lineHeight: 1.4 }} className={sm.classes}>
            {sm.label}
          </span>
        )}
      </div>
    );
  }, []);

  // ── Calendar navigation
  const navPrev  = () => { if (view === "team") setTeamDate(d => format(addDays(parseISO(d), -1), "yyyy-MM-dd")); else calendarRef.current?.getApi().prev(); };
  const navNext  = () => { if (view === "team") setTeamDate(d => format(addDays(parseISO(d), 1), "yyyy-MM-dd"));  else calendarRef.current?.getApi().next(); };
  const navToday = () => { if (view === "team") setTeamDate(format(new Date(), "yyyy-MM-dd"));                    else calendarRef.current?.getApi().today(); };

  const switchView = (v: CalView) => {
    setView(v);
    if (v !== "team") {
      setTimeout(() => calendarRef.current?.getApi().changeView(v), 0);
    }
  };

  const VIEW_LABELS: Record<CalView, string> = {
    timeGridDay: "Day", timeGridWeek: "Week", dayGridMonth: "Month", listWeek: "List", team: "Team",
  };

  // ── Team View
  const TeamView = () => {
    const dateStr = teamDate;
    const reps = salesWorkers.length > 0 ? salesWorkers : workers.slice(0, 4);
    const dayAppts = filtered.filter(a => a.date === dateStr).sort((a, b) => a.startTime.localeCompare(b.startTime));

    return (
      <div className="grid gap-3 overflow-auto" style={{ gridTemplateColumns: `repeat(${Math.min(reps.length, 4)}, minmax(220px,1fr))` }}>
        {reps.map(rep => {
          const repAppts = dayAppts.filter(a => a.assignedToId === rep.id);
          const isOver = dragOverRep === rep.id;
          return (
            <div
              key={rep.id}
              className={`rounded-xl border-2 transition-colors ${isOver ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-white"}`}
              onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverRep(rep.id); }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverRep(null); }}
              onDrop={e => {
                e.preventDefault();
                const drag = teamDragRef.current;
                setDragOverRep(null);
                if (!drag || drag.assignedToId === rep.id) { teamDragRef.current = null; return; }
                moveMut.mutate(
                  { id: drag.id, assignedToId: rep.id },
                  {
                    onSuccess: () => toast({ title: `Moved to ${rep.name}.` }),
                    onError: (err: any) => {
                      let detail = "";
                      try { const p = JSON.parse(String(err?.message ?? "").replace(/^\d+:\s*/, "")); detail = p?.details || p?.error || ""; } catch {}
                      queryClient.invalidateQueries({ queryKey: ["/api/sales-appointments"] });
                      toast({ title: `Could not move appointment${detail ? ": " + detail : ""}`, variant: "destructive" });
                    },
                  }
                );
                teamDragRef.current = null;
              }}
            >
              <div className={`flex items-center gap-2 px-3 py-2.5 border-b rounded-t-xl ${isOver ? "border-blue-300 bg-blue-100" : "border-gray-100 bg-gray-50"}`}>
                <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700 flex-shrink-0">
                  {rep.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-800 truncate">{rep.name}</p>
                  <p className="text-xs text-gray-400">{rep.role || "Sales Rep"}</p>
                </div>
                <Badge variant="secondary" className="text-xs ml-auto flex-shrink-0">{repAppts.length}</Badge>
              </div>
              {isOver && (
                <div className="mx-2 mt-2 rounded border-2 border-dashed border-blue-400 bg-blue-50/50 py-2 text-center text-xs text-blue-500 font-medium">
                  Drop to reassign
                </div>
              )}
              <div className="p-2 space-y-1.5 min-h-[80px]">
                {repAppts.length === 0 && !isOver && (
                  <p className="text-xs text-gray-400 text-center py-5">No appointments today</p>
                )}
                {repAppts.map(a => {
                  const color = TYPE_COLORS[a.appointmentType] || "#64748b";
                  const dur = calcDuration(a.startTime, a.endTime);
                  const sm = STATUS_META[a.status] || STATUS_META.planned;
                  return (
                    <div
                      key={a.id}
                      draggable
                      className="rounded-lg border-l-4 bg-white shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow p-2.5 select-none"
                      style={{ borderLeftColor: color }}
                      onDragStart={e => { e.stopPropagation(); teamDragRef.current = a; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", a.id); }}
                      onDragEnd={() => { teamDragRef.current = null; setDragOverRep(null); }}
                      onClick={() => setDetailAppt(a)}
                      onMouseEnter={e => { setTipAppt(a); setTipPos({ x: e.clientX, y: e.clientY }); }}
                      onMouseLeave={() => setTipAppt(null)}
                    >
                      <p className="text-xs font-bold text-gray-900 leading-tight truncate">{a.clientName || a.title}</p>
                      <p className="text-xs text-gray-500 truncate">{TYPE_LABELS[a.appointmentType]}</p>
                      <p className="text-xs font-medium mt-0.5" style={{ color }}>
                        {a.startTime}–{a.endTime}{dur > 0 ? ` · ${formatDuration(dur)}` : ""}
                      </p>
                      <span className={`text-xs px-1.5 py-0 rounded border inline-block mt-1 ${sm.classes}`}>{sm.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const hasFilters = filterRep !== "all" || filterType !== "all" || filterStatus !== "all" || filterClient !== "";

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden lg:pl-64">
        <Header title="Sales Diary" />
        <main className="flex-1 overflow-auto p-4 space-y-3">

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
            <TeamView />
          ) : (
            <div className="bg-white border rounded-xl overflow-hidden sales-diary-fc">
              <FullCalendar
                ref={calendarRef}
                plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
                initialView="timeGridWeek"
                headerToolbar={false}
                editable={true}
                selectable={true}
                selectMirror={true}
                eventDurationEditable={true}
                eventStartEditable={true}
                snapDuration="00:15:00"
                slotDuration="00:30:00"
                slotLabelInterval="01:00"
                slotMinTime="06:00:00"
                slotMaxTime="19:00:00"
                allDaySlot={false}
                nowIndicator={true}
                expandRows={true}
                height="auto"
                contentHeight={680}
                firstDay={1}
                dayHeaderFormat={{ weekday: "short", day: "numeric" }}
                slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
                eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
                events={fcEvents}
                eventContent={renderEventContent}
                eventClick={handleEventClick}
                eventDrop={handleEventDrop}
                eventResize={handleEventResize}
                eventMouseEnter={handleEventMouseEnter}
                eventMouseLeave={handleEventMouseLeave}
                select={handleSelect}
                datesSet={(arg) => setViewTitle(arg.view.title)}
              />
            </div>
          )}

        </main>
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
              <span className={`px-1 rounded border text-xs ${STATUS_META[tipAppt.status]?.classes}`}>{STATUS_META[tipAppt.status]?.label}</span>
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
                <Badge variant="outline" className={`border ${STATUS_META[detailAppt.status]?.classes}`}>{STATUS_META[detailAppt.status]?.label}</Badge>
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
    </div>
  );
}
