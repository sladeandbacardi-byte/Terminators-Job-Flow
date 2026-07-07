import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isSameDay, isSameMonth, parseISO, addWeeks, subWeeks, addMonths, subMonths } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Calendar, ChevronLeft, ChevronRight, Plus, Clock, MapPin, Phone, User,
  CheckCircle2, RefreshCw, FileText, Link2, XCircle, MoreHorizontal, Users, List, Filter,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Worker, SalesAppointment } from "@shared/schema";
import { SALES_APPT_TYPES, SALES_APPT_STATUSES } from "@shared/schema";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";

type ViewMode = "day" | "week" | "month" | "list";

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

const HOURS = Array.from({ length: 12 }, (_, i) => i + 7); // 07:00–18:00

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

function emptyForm(): Partial<SalesAppointment> {
  return {
    title: "", clientName: "", contactPerson: "", phone: "", siteAddress: "",
    appointmentType: "new_lead_meeting", appointmentTypeOther: "", assignedToId: "",
    date: format(new Date(), "yyyy-MM-dd"), startTime: "09:00", endTime: "10:00",
    estimatedDuration: 60, status: "planned", notes: "",
  };
}

export default function SalesDiary() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [view, setView] = useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filterRep, setFilterRep] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterClient, setFilterClient] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editAppt, setEditAppt] = useState<SalesAppointment | null>(null);
  const [formData, setFormData] = useState<Partial<SalesAppointment>>(emptyForm());
  const [completeAppt, setCompleteAppt] = useState<SalesAppointment | null>(null);
  const [completionData, setCompletionData] = useState({ completionNote: "", clientFeedback: "", nextAction: "", followUpDate: "" });
  const [detailAppt, setDetailAppt] = useState<SalesAppointment | null>(null);
  const [managerView, setManagerView] = useState(false);

  const searchStr = useSearch();

  const { data: appointments = [] } = useQuery<SalesAppointment[]>({ queryKey: ["/api/sales-appointments"] });
  const { data: workers = [] } = useQuery<Worker[]>({ queryKey: ["/api/workers"] });

  // Match the logged-in admin user to a worker record (by email, then by full name)
  const currentWorker = useMemo(() => {
    if (!user) return null;
    const byEmail = workers.find(w => w.email?.toLowerCase() === (user.email || "").toLowerCase());
    if (byEmail) return byEmail;
    const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
    return workers.find(w => w.name.toLowerCase() === fullName) || null;
  }, [workers, user]);

  // Auto-fill assignedToId with the current user's worker record whenever the
  // form opens for a new appointment and no rep has been chosen yet.
  useEffect(() => {
    if (showForm && !editAppt && currentWorker && !formData.assignedToId) {
      setFormData(f => ({ ...f, assignedToId: currentWorker.id }));
    }
  }, [showForm, editAppt, currentWorker]);

  // Pre-fill form from URL params (e.g. when coming from the Leads page)
  useEffect(() => {
    if (!searchStr) return;
    const params = new URLSearchParams(searchStr);
    const clientName = params.get("clientName");
    if (!clientName) return;
    // Prefer the lead's assigned rep; fall back to the current user's worker
    const repId = params.get("assignedTo") || currentWorker?.id || "";
    setFormData({
      ...emptyForm(),
      clientName,
      contactPerson: params.get("contactPerson") || "",
      phone: params.get("phone") || "",
      siteAddress: params.get("siteAddress") || "",
      leadId: params.get("leadId") || undefined,
      appointmentType: (params.get("appointmentType") as any) || "new_lead_meeting",
      title: `${TYPE_LABELS[params.get("appointmentType") || "new_lead_meeting"] || "New Lead Meeting"} – ${clientName}`,
      assignedToId: repId,
    });
    setEditAppt(null);
    setShowForm(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const salesWorkers = useMemo(() => workers.filter(w => w.departmentId === "div-5" || appointments.some(a => a.assignedToId === w.id)), [workers, appointments]);

  const createMut = useMutation({
    mutationFn: (data: Partial<SalesAppointment>) => apiRequest("POST", "/api/sales-appointments", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/sales-appointments"] }); setShowForm(false); toast({ title: "Appointment created" }); },
    onError: (err: any) => {
      let detail = "Could not save appointment.";
      try {
        const raw = String(err?.message ?? "");
        const jsonPart = raw.replace(/^\d+:\s*/, "");
        const parsed = JSON.parse(jsonPart);
        if (parsed?.details) detail = `Could not save appointment: ${parsed.details}`;
        else if (parsed?.error) detail = `Could not save appointment: ${parsed.error}`;
      } catch { /* ignore parse errors */ }
      toast({ title: "Error", description: detail, variant: "destructive" });
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...data }: Partial<SalesAppointment> & { id: string }) => apiRequest("PATCH", `/api/sales-appointments/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/sales-appointments"] }); setShowForm(false); setEditAppt(null); setDetailAppt(null); setCompleteAppt(null); toast({ title: "Appointment updated" }); },
    onError: (err: any) => {
      let detail = "Could not update appointment.";
      try {
        const raw = String(err?.message ?? "");
        const jsonPart = raw.replace(/^\d+:\s*/, "");
        const parsed = JSON.parse(jsonPart);
        if (parsed?.details) detail = `Could not update appointment: ${parsed.details}`;
        else if (parsed?.error) detail = `Could not update appointment: ${parsed.error}`;
      } catch { /* ignore parse errors */ }
      toast({ title: "Error", description: detail, variant: "destructive" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/sales-appointments/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/sales-appointments"] }); setDetailAppt(null); toast({ title: "Appointment deleted" }); },
  });

  // ── filtering
  const filtered = useMemo(() => appointments.filter(a => {
    if (filterRep !== "all" && a.assignedToId !== filterRep) return false;
    if (filterType !== "all" && a.appointmentType !== filterType) return false;
    if (filterStatus !== "all" && a.status !== filterStatus) return false;
    if (filterClient && !a.clientName.toLowerCase().includes(filterClient.toLowerCase())) return false;
    return true;
  }), [appointments, filterRep, filterType, filterStatus, filterClient]);

  const apptsByDate = useMemo(() => {
    const map: Record<string, SalesAppointment[]> = {};
    for (const a of filtered) {
      (map[a.date] = map[a.date] || []).push(a);
    }
    return map;
  }, [filtered]);

  // ── navigation
  const nav = (dir: 1 | -1) => {
    if (view === "day")   setCurrentDate(d => addDays(d, dir));
    if (view === "week")  setCurrentDate(d => dir === 1 ? addWeeks(d, 1) : subWeeks(d, 1));
    if (view === "month") setCurrentDate(d => dir === 1 ? addMonths(d, 1) : subMonths(d, 1));
    if (view === "list")  setCurrentDate(d => addDays(d, dir * 14));
  };

  const openNew = (date?: string) => {
    setEditAppt(null);
    setFormData({
      ...emptyForm(),
      date: date || format(currentDate, "yyyy-MM-dd"),
      assignedToId: currentWorker?.id || "",
    });
    setShowForm(true);
  };

  const openEdit = (a: SalesAppointment) => {
    setEditAppt(a);
    setFormData({ ...a });
    setShowForm(true);
    setDetailAppt(null);
  };

  const saveForm = () => {
    if (!formData.appointmentType) {
      toast({ title: "Appointment type is required", variant: "destructive" }); return;
    }
    if (!formData.assignedToId) {
      toast({ title: "Please select an assigned sales rep.", variant: "destructive" }); return;
    }
    if (!formData.date) {
      toast({ title: "Date is required", variant: "destructive" }); return;
    }
    if (!formData.startTime) {
      toast({ title: "Start time is required", variant: "destructive" }); return;
    }
    if (!formData.endTime) {
      toast({ title: "End time is required", variant: "destructive" }); return;
    }
    if (timeToMinutes(formData.endTime) <= timeToMinutes(formData.startTime)) {
      toast({ title: "End time must be after start time.", variant: "destructive" }); return;
    }
    if (!formData.title && !formData.clientName) {
      toast({ title: "Please enter a title or client name.", variant: "destructive" }); return;
    }

    // Sanitise: strip placeholder values and empty strings for optional fields
    const payload: Partial<SalesAppointment> = {
      ...formData,
      title: formData.title || formData.clientName || "Appointment",
      assignedToId: formData.assignedToId || null,
      estimatedDuration: formData.estimatedDuration || null,
      leadId: formData.leadId || null,
      quoteId: formData.quoteId || null,
      departmentId: formData.departmentId || null,
    };

    if (editAppt) {
      updateMut.mutate({ ...payload, id: editAppt.id } as SalesAppointment & { id: string });
    } else {
      createMut.mutate(payload);
    }
  };

  const markComplete = (a: SalesAppointment) => {
    setCompleteAppt(a);
    setCompletionData({ completionNote: a.completionNote || "", clientFeedback: a.clientFeedback || "", nextAction: a.nextAction || "", followUpDate: a.followUpDate || "" });
    setDetailAppt(null);
  };

  const saveCompletion = () => {
    if (!completeAppt) return;
    updateMut.mutate({ id: completeAppt.id, status: "completed", ...completionData });
    setCompleteAppt(null);
  };

  const workerName = (id: string | null | undefined) => workers.find(w => w.id === id)?.name || "Unassigned";

  // ═══ RENDER APPOINTMENT CARD (reused across views)
  const ApptCard = ({ a, compact = false }: { a: SalesAppointment; compact?: boolean }) => {
    const sm = STATUS_META[a.status] || STATUS_META.planned;
    const color = TYPE_COLORS[a.appointmentType] || "#64748b";
    return (
      <div
        className="bg-white rounded border-l-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
        style={{ borderLeftColor: color }}
        onClick={() => setDetailAppt(a)}
      >
        <div className={`p-2 ${compact ? "space-y-0.5" : "space-y-1"}`}>
          <div className="flex items-start justify-between gap-1">
            <p className={`font-semibold text-gray-900 ${compact ? "text-xs" : "text-sm"} line-clamp-1`}>{a.title}</p>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                <Button variant="ghost" size="sm" className="h-5 w-5 p-0 flex-shrink-0"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={e => { e.stopPropagation(); markComplete(a); }}><CheckCircle2 className="h-4 w-4 mr-2" />Mark Completed</DropdownMenuItem>
                <DropdownMenuItem onClick={e => { e.stopPropagation(); updateMut.mutate({ id: a.id, status: "rescheduled" }); }}><RefreshCw className="h-4 w-4 mr-2" />Reschedule</DropdownMenuItem>
                <DropdownMenuItem onClick={e => { e.stopPropagation(); openEdit(a); }}><FileText className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={e => { e.stopPropagation(); updateMut.mutate({ id: a.id, status: "cancelled" }); }} className="text-red-600"><XCircle className="h-4 w-4 mr-2" />Cancel</DropdownMenuItem>
                <DropdownMenuItem onClick={e => { e.stopPropagation(); if (confirm("Delete this appointment?")) deleteMut.mutate(a.id); }} className="text-red-600"><XCircle className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <p className={`text-gray-600 ${compact ? "text-xs" : "text-xs"} flex items-center gap-1`}>
            <Clock className="h-3 w-3 flex-shrink-0" />{a.startTime}–{a.endTime}
            {a.estimatedDuration ? ` (${a.estimatedDuration}min)` : ""}
          </p>
          {!compact && <p className="text-xs text-gray-500 flex items-center gap-1 line-clamp-1"><User className="h-3 w-3" />{a.clientName}</p>}
          {!compact && a.siteAddress && <p className="text-xs text-gray-400 flex items-center gap-1 line-clamp-1"><MapPin className="h-3 w-3" />{a.siteAddress}</p>}
          <div className="flex items-center gap-1 flex-wrap">
            <Badge variant="outline" className={`text-xs border px-1.5 py-0 ${sm.classes}`}>{sm.label}</Badge>
            {!compact && <Badge variant="outline" className="text-xs px-1.5 py-0 text-gray-500">{TYPE_LABELS[a.appointmentType]}</Badge>}
          </div>
          {!compact && <p className="text-xs text-blue-600 font-medium">{workerName(a.assignedToId)}</p>}
        </div>
      </div>
    );
  };

  // ═══ DAY VIEW
  const DayView = () => {
    const dateStr = format(currentDate, "yyyy-MM-dd");
    const dayAppts = (apptsByDate[dateStr] || []).sort((a, b) => a.startTime.localeCompare(b.startTime));
    if (managerView) {
      const reps = salesWorkers.length > 0 ? salesWorkers : workers.slice(0, 3);
      return (
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(reps.length, 3)}, 1fr)` }}>
          {reps.map(rep => {
            const repAppts = dayAppts.filter(a => a.assignedToId === rep.id);
            return (
              <Card key={rep.id}>
                <CardHeader className="py-3 px-4 border-b">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400" />{rep.name}
                    <Badge variant="secondary" className="text-xs ml-auto">{repAppts.length} appt{repAppts.length !== 1 ? "s" : ""}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 space-y-2">
                  {repAppts.length === 0 ? <p className="text-xs text-gray-400 text-center py-4">No appointments</p> :
                    repAppts.map(a => (
                      <div key={a.id} className="border-l-4 pl-2 py-1 rounded-sm" style={{ borderLeftColor: TYPE_COLORS[a.appointmentType] }}>
                        <p className="text-xs font-semibold text-gray-800">{a.startTime} – {TYPE_LABELS[a.appointmentType]}</p>
                        <p className="text-xs text-gray-600">{a.clientName}</p>
                        <Badge variant="outline" className={`text-xs border px-1.5 py-0 mt-0.5 ${STATUS_META[a.status]?.classes}`}>{STATUS_META[a.status]?.label}</Badge>
                      </div>
                    ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      );
    }
    return (
      <div className="grid grid-cols-[64px_1fr] border rounded-lg overflow-hidden bg-white">
        {HOURS.map(h => {
          const hStr = `${String(h).padStart(2, "0")}:00`;
          const slotAppts = dayAppts.filter(a => {
            const start = timeToMinutes(a.startTime);
            return start >= h * 60 && start < (h + 1) * 60;
          });
          return [
            <div key={`h-${h}`} className="border-r border-b bg-gray-50 flex items-start justify-end pr-2 pt-1.5 text-xs text-gray-400 font-medium">{hStr}</div>,
            <div key={`s-${h}`} className="border-b min-h-[60px] p-1 space-y-1 relative">
              {slotAppts.map(a => <ApptCard key={a.id} a={a} />)}
              {slotAppts.length === 0 && (
                <button className="w-full h-full absolute inset-0 opacity-0 hover:opacity-100 flex items-center justify-center text-xs text-gray-300 hover:text-gray-400"
                  onClick={() => openNew(dateStr)}>+ Add</button>
              )}
            </div>,
          ];
        })}
      </div>
    );
  };

  // ═══ WEEK VIEW
  const WeekView = () => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    return (
      <div className="border rounded-lg overflow-hidden bg-white">
        {/* Header */}
        <div className="grid border-b" style={{ gridTemplateColumns: "64px repeat(7, 1fr)" }}>
          <div className="bg-gray-50 border-r" />
          {days.map(d => (
            <div key={d.toISOString()} className={`border-r p-2 text-center ${isSameDay(d, new Date()) ? "bg-blue-50" : "bg-gray-50"}`}>
              <p className="text-xs text-gray-500 font-medium">{format(d, "EEE")}</p>
              <p className={`text-sm font-bold ${isSameDay(d, new Date()) ? "text-blue-600" : "text-gray-800"}`}>{format(d, "d")}</p>
              <p className="text-xs text-gray-400">{(apptsByDate[format(d, "yyyy-MM-dd")] || []).length > 0 ? `${(apptsByDate[format(d, "yyyy-MM-dd")] || []).length} appt` : ""}</p>
            </div>
          ))}
        </div>
        {/* Hour rows */}
        {HOURS.map(h => (
          <div key={h} className="grid border-b" style={{ gridTemplateColumns: "64px repeat(7, 1fr)" }}>
            <div className="border-r bg-gray-50 flex items-start justify-end pr-2 pt-1 text-xs text-gray-400 min-h-[56px]">{`${String(h).padStart(2, "0")}:00`}</div>
            {days.map(d => {
              const dateStr = format(d, "yyyy-MM-dd");
              const slotAppts = (apptsByDate[dateStr] || []).filter(a => {
                const start2 = timeToMinutes(a.startTime);
                return start2 >= h * 60 && start2 < (h + 1) * 60;
              });
              return (
                <div key={d.toISOString()} className={`border-r p-0.5 min-h-[56px] space-y-0.5 ${isSameDay(d, new Date()) ? "bg-blue-50/30" : ""}`}>
                  {slotAppts.map(a => <ApptCard key={a.id} a={a} compact />)}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  // ═══ MONTH VIEW
  const MonthView = () => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    const gridStart = startOfWeek(start, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(end, { weekStartsOn: 1 });
    const days: Date[] = [];
    let cur = gridStart;
    while (cur <= gridEnd) { days.push(cur); cur = addDays(cur, 1); }
    return (
      <div className="border rounded-lg overflow-hidden bg-white">
        <div className="grid grid-cols-7 border-b">
          {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => (
            <div key={d} className="bg-gray-50 border-r last:border-r-0 text-center py-2 text-xs font-semibold text-gray-500">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map(d => {
            const dateStr = format(d, "yyyy-MM-dd");
            const dayAppts2 = (apptsByDate[dateStr] || []);
            const isToday = isSameDay(d, new Date());
            const isCurrentMonth = isSameMonth(d, currentDate);
            return (
              <div key={dateStr} className={`border-r border-b min-h-[90px] p-1 ${isCurrentMonth ? "" : "bg-gray-50"}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${isToday ? "bg-blue-600 text-white" : isCurrentMonth ? "text-gray-700" : "text-gray-300"}`}>{format(d, "d")}</span>
                  {isCurrentMonth && <button className="text-gray-300 hover:text-gray-500 text-xs" onClick={() => openNew(dateStr)}>+</button>}
                </div>
                <div className="space-y-0.5">
                  {dayAppts2.slice(0, 3).map(a => (
                    <div key={a.id} className="text-xs rounded px-1 py-0.5 truncate cursor-pointer hover:opacity-80"
                      style={{ backgroundColor: TYPE_COLORS[a.appointmentType] + "22", color: TYPE_COLORS[a.appointmentType], borderLeft: `2px solid ${TYPE_COLORS[a.appointmentType]}` }}
                      onClick={() => setDetailAppt(a)}>
                      {a.startTime} {a.clientName}
                    </div>
                  ))}
                  {dayAppts2.length > 3 && <p className="text-xs text-gray-400 pl-1">+{dayAppts2.length - 3} more</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ═══ LIST VIEW
  const ListView = () => {
    const start = currentDate;
    const end = addDays(start, 14);
    const days: Date[] = [];
    let c = start;
    while (c <= end) { days.push(c); c = addDays(c, 1); }
    return (
      <div className="space-y-4">
        {days.map(d => {
          const dateStr = format(d, "yyyy-MM-dd");
          const dayAppts3 = (apptsByDate[dateStr] || []).sort((a, b) => a.startTime.localeCompare(b.startTime));
          if (dayAppts3.length === 0) return null;
          return (
            <div key={dateStr}>
              <div className={`flex items-center gap-2 mb-2 ${isSameDay(d, new Date()) ? "text-blue-600" : "text-gray-600"}`}>
                <Calendar className="h-4 w-4" />
                <span className="text-sm font-semibold">{format(d, "EEEE, d MMMM yyyy")}</span>
                <Badge variant="secondary" className="text-xs">{dayAppts3.length}</Badge>
              </div>
              <div className="space-y-2 ml-6">
                {dayAppts3.map(a => <ApptCard key={a.id} a={a} />)}
              </div>
            </div>
          );
        })}
        {days.every(d => !(apptsByDate[format(d, "yyyy-MM-dd")] || []).length) && (
          <div className="text-center py-16 text-gray-400">
            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No appointments in this period</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => openNew()}>Schedule one</Button>
          </div>
        )}
      </div>
    );
  };

  // ── date range label
  const rangeLabel = () => {
    if (view === "day") return format(currentDate, "EEEE, d MMMM yyyy");
    if (view === "week") {
      const s = startOfWeek(currentDate, { weekStartsOn: 1 });
      const e = endOfWeek(currentDate, { weekStartsOn: 1 });
      return `${format(s, "d MMM")} – ${format(e, "d MMM yyyy")}`;
    }
    if (view === "month") return format(currentDate, "MMMM yyyy");
    return `${format(currentDate, "d MMM")} – ${format(addDays(currentDate, 14), "d MMM yyyy")}`;
  };

  const hasFilters = filterRep !== "all" || filterType !== "all" || filterStatus !== "all" || filterClient !== "";

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden lg:pl-64">
        <Header title="Sales Diary" />
        <main className="flex-1 overflow-auto p-4 space-y-4">

          {/* ── Top bar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-white border rounded-lg p-1">
              {(["day","week","month","list"] as ViewMode[]).map(v => (
                <Button key={v} variant={view === v ? "default" : "ghost"} size="sm" className="h-7 text-xs capitalize"
                  onClick={() => setView(v)}>{v}</Button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => nav(-1)}><ChevronLeft className="h-4 w-4" /></Button>
              <span className="text-sm font-medium text-gray-700 min-w-[180px] text-center">{rangeLabel()}</span>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => nav(1)}><ChevronRight className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setCurrentDate(new Date())}>Today</Button>
            </div>
            <div className="flex-1" />
            <Button variant="outline" size="sm" className={`h-7 text-xs gap-1 ${managerView ? "border-indigo-400 text-indigo-700 bg-indigo-50" : ""}`}
              onClick={() => setManagerView(v => !v)}>
              <Users className="h-3.5 w-3.5" />{managerView ? "Manager View" : "Team View"}
            </Button>
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
            <Input placeholder="Search client…" value={filterClient} onChange={e => setFilterClient(e.target.value)}
              className="h-7 text-xs w-36" />
            {hasFilters && (
              <Button variant="ghost" size="sm" className="h-7 text-xs text-gray-400"
                onClick={() => { setFilterRep("all"); setFilterType("all"); setFilterStatus("all"); setFilterClient(""); }}>
                Clear
              </Button>
            )}
          </div>

          {/* ── Calendar view */}
          {view === "day"   && <DayView />}
          {view === "week"  && <WeekView />}
          {view === "month" && <MonthView />}
          {view === "list"  && <ListView />}

        </main>
      </div>

      {/* ═══ CREATE / EDIT DIALOG */}
      <Dialog open={showForm} onOpenChange={v => { setShowForm(v); if (!v) setEditAppt(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editAppt ? "Edit Appointment" : "New Appointment"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Title *</Label>
              <Input value={formData.title || ""} onChange={e => setFormData(f => ({ ...f, title: e.target.value }))} placeholder="Appointment title" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Client / Company Name *</Label>
              <Input value={formData.clientName || ""} onChange={e => setFormData(f => ({ ...f, clientName: e.target.value }))} placeholder="Client name" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Contact Person</Label>
              <Input value={formData.contactPerson || ""} onChange={e => setFormData(f => ({ ...f, contactPerson: e.target.value }))} placeholder="Contact person" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Phone</Label>
              <Input value={formData.phone || ""} onChange={e => setFormData(f => ({ ...f, phone: e.target.value }))} placeholder="Phone number" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Site Address</Label>
              <Input value={formData.siteAddress || ""} onChange={e => setFormData(f => ({ ...f, siteAddress: e.target.value }))} placeholder="Site address" />
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
                <Label className="text-xs">Other Appointment Details</Label>
                <Input value={formData.appointmentTypeOther || ""} onChange={e => setFormData(f => ({ ...f, appointmentTypeOther: e.target.value }))} placeholder="Describe the appointment" />
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
            <div className="space-y-1">
              <Label className="text-xs">Estimated Duration (minutes)</Label>
              <Input type="number" value={formData.estimatedDuration || ""} onChange={e => setFormData(f => ({ ...f, estimatedDuration: parseInt(e.target.value) || undefined }))} placeholder="60" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Notes</Label>
              <Textarea value={formData.notes || ""} onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))} rows={3} placeholder="Any notes for this appointment…" />
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
                {detailAppt.title}
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
                <div><p className="text-xs text-gray-400 mb-0.5">Time</p><p>{detailAppt.startTime} – {detailAppt.endTime}{detailAppt.estimatedDuration ? ` (${detailAppt.estimatedDuration}min)` : ""}</p></div>
                <div><p className="text-xs text-gray-400 mb-0.5">Sales Rep</p><p>{workerName(detailAppt.assignedToId)}</p></div>
                {detailAppt.siteAddress && <div className="col-span-2"><p className="text-xs text-gray-400 mb-0.5">Address</p><p className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-gray-400" />{detailAppt.siteAddress}</p></div>}
                {detailAppt.notes && <div className="col-span-2"><p className="text-xs text-gray-400 mb-0.5">Notes</p><p className="text-sm text-gray-700 bg-gray-50 rounded p-2">{detailAppt.notes}</p></div>}
              </div>
              {detailAppt.status === "completed" && (detailAppt.completionNote || detailAppt.clientFeedback || detailAppt.nextAction) && (
                <div className="border rounded-lg p-3 bg-green-50 space-y-1 text-sm">
                  <p className="text-xs font-semibold text-green-700 mb-1">Completion Summary</p>
                  {detailAppt.completionNote && <p><span className="text-xs text-gray-500">What happened:</span> {detailAppt.completionNote}</p>}
                  {detailAppt.clientFeedback && <p><span className="text-xs text-gray-500">Client feedback:</span> {detailAppt.clientFeedback}</p>}
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
                  <Button size="sm" variant="outline" className="text-red-600 border-red-200" onClick={() => { updateMut.mutate({ id: detailAppt.id, status: "cancelled" }); }}>
                    <XCircle className="h-3.5 w-3.5 mr-1" />Cancel
                  </Button>
                )}
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
                <Textarea value={completionData.completionNote} onChange={e => setCompletionData(d => ({ ...d, completionNote: e.target.value }))} rows={3} placeholder="Brief summary of the appointment…" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Client Feedback</Label>
                <Textarea value={completionData.clientFeedback} onChange={e => setCompletionData(d => ({ ...d, clientFeedback: e.target.value }))} rows={2} placeholder="What did the client say?" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Next Action Required</Label>
                <Input value={completionData.nextAction} onChange={e => setCompletionData(d => ({ ...d, nextAction: e.target.value }))} placeholder="e.g. Send quote, Call back next week" />
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

