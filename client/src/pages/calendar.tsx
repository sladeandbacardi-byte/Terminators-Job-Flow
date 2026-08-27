import { useState, useRef, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, differenceInMinutes } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Clock, 
  MapPin, 
  User,
  Search,
  X,
  Filter,
  AlertTriangle
} from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatClientAddress, type Job, type Client, type Worker, type Department, type Team, type TeamMember } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { getDashboardRole, canMoveCalendarEvent, type DashboardRole } from "@/lib/dashboardRole";
import JobForm from "@/components/forms/job-form";
import type { DiaryEvent, CalendarSourceType } from "@shared/calendar-types";
import { statusColorClasses, statusColor } from "@shared/calendar-types";
import { 
  OutlookDiaryCalendar, 
  OutlookColumnsView, 
  type OutlookDiaryCalendarHandle, 
  type OutlookCalView, 
  type OutlookColumn 
} from "@/components/calendar/outlook-diary-calendar";

type ViewType = OutlookCalView | "team";

const jobEditSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  scheduledDate: z.string().min(1, "Date is required"),
  scheduledTime: z.string().min(1, "Time is required"),
  estimatedDuration: z.number().min(15, "Duration must be at least 15 minutes"),
  clientId: z.string().min(1, "Client is required"),
  workerId: z.string().optional(),
  departmentId: z.string().min(1, "Department is required"),
  location: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]),
  status: z.enum(["scheduled", "in_progress", "completed", "cancelled"]),
});

type JobEditForm = z.infer<typeof jobEditSchema>;

export default function Calendar() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const calendarRef = useRef<OutlookDiaryCalendarHandle>(null);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState<ViewType>('timeGridWeek');
  const [viewTitle, setViewTitle] = useState("");
  const [teamDate, setTeamDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const [selectedEvent, setSelectedEvent] = useState<DiaryEvent | null>(null);
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditJobDialogOpen, setIsEditJobDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  
  // 3-way occurrence move dialog
  const [occurrenceMoveTarget, setOccurrenceMoveTarget] = useState<{ event: DiaryEvent, newStart: Date, newEnd: Date, revert: () => void } | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "oneoff" | "contract" | "sales" | "followup">("all");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [areaFilter, setAreaFilter] = useState("all");
  const [serviceTypeFilter, setServiceTypeFilter] = useState("all");
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState("all");

  const role: DashboardRole = useMemo(() => 
    getDashboardRole({ departmentId: (user as any)?.departmentId, role: user?.role }),
    [user]
  );
  const isTechnician = role === "service";

  const jobEditForm = useForm<JobEditForm>({
    resolver: zodResolver(jobEditSchema),
    defaultValues: {
      title: "",
      description: "",
      scheduledDate: "",
      scheduledTime: "",
      estimatedDuration: 60,
      priority: "medium",
      status: "scheduled",
    },
  });

  // Queries
  const { data: customEvents = [] } = useQuery<any[]>({
    queryKey: ['/api/calendar/events', format(currentDate, 'yyyy-MM')],
  });
  const { data: salesAppointments = [] } = useQuery<any[]>({
    queryKey: ['/api/sales-appointments'],
  });
  const { data: salesFollowUps = [] } = useQuery<any[]>({
    queryKey: ['/api/sales-follow-ups'],
  });
  const { data: salesLeads = [] } = useQuery<any[]>({
    queryKey: ['/api/quote-submissions'],
  });

  const { data: jobs = [] } = useQuery<Job[]>({ queryKey: ['/api/jobs'] });
  const { data: departments = [] } = useQuery<Department[]>({ queryKey: ['/api/departments'] });
  const { data: workers = [] } = useQuery<Worker[]>({ queryKey: ['/api/workers'] });
  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ['/api/clients'] });
  const { data: teams = [] } = useQuery<Team[]>({ queryKey: ['/api/teams'] });
  const { data: teamMembers = [] } = useQuery<TeamMember[]>({ queryKey: ['/api/team-members'] });

  // Contract occurrences for the visible window
  const occWindow = useMemo(() => {
    const s = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    s.setDate(s.getDate() - 7);
    const e = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    e.setDate(e.getDate() + 7);
    e.setHours(23, 59, 59, 999);
    return { start: s.toISOString(), end: e.toISOString() };
  }, [currentDate]);

  const { data: contractOccurrences = [] } = useQuery<any[]>({
    queryKey: ['/api/service-contracts/occurrences', occWindow.start, occWindow.end],
    queryFn: async () => {
      const r = await fetch(`/api/service-contracts/occurrences?start=${encodeURIComponent(occWindow.start)}&end=${encodeURIComponent(occWindow.end)}`, { credentials: 'include' });
      if (!r.ok) return [];
      return r.json();
    },
  });

  // Resolve the logged-in technician's worker record
  const myWorker = useMemo(() => {
    if (role !== "service") return null;
    return workers.find(w => user?.email && w.email?.toLowerCase() === user.email.toLowerCase()) || null;
  }, [role, workers, user]);

  // worker -> set of team ids
  const workerTeamsMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    teamMembers.forEach(tm => {
      const set = map.get(tm.workerId) ?? new Set<string>();
      set.add(tm.teamId);
      map.set(tm.workerId, set);
    });
    return map;
  }, [teamMembers]);

  // Mutations
  const updateJobMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Job> }) => {
      return apiRequest('PATCH', `/api/jobs/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      setIsEditJobDialogOpen(false);
      setEditingJob(null);
      toast({ title: "Job updated successfully" });
    },
  });

  const moveJobMutation = useMutation({
    mutationFn: async ({ id, scheduledDate, scheduledTime, estimatedDuration }: { id: string, scheduledDate?: Date, scheduledTime?: string, estimatedDuration?: number }) => {
      return apiRequest('PATCH', `/api/jobs/${id}`, { scheduledDate, scheduledTime, estimatedDuration });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      toast({ title: "Job moved successfully" });
    },
  });

  const upsertExceptionMutation = useMutation({
    mutationFn: async (data: any) => apiRequest('POST', '/api/contract-occurrence-exceptions', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/service-contracts/occurrences'] });
      setOccurrenceMoveTarget(null);
      toast({ title: "Occurrence updated successfully" });
    },
  });

  const updateContractMutation = useMutation({
    mutationFn: async ({ id, kind, data }: { id: string, kind: 'service'|'rental', data: any }) => {
      const endpoint = kind === 'service' ? `/api/service-contracts/${id}` : `/api/rental-contracts/${id}`;
      return apiRequest('PATCH', endpoint, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/service-contracts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/service-contracts/occurrences'] });
      setOccurrenceMoveTarget(null);
      toast({ title: "Contract schedule updated" });
    },
  });

  // --- Mapping to DiaryEvent ---

  const jobToDiaryEvent = useCallback((job: Job): DiaryEvent | null => {
    const client = clients.find(c => c.id === job.clientId);
    const worker = workers.find(w => w.id === job.workerId);
    
    const start = new Date(job.scheduledDate);
    if (isNaN(start.getTime())) return null;

    if (job.scheduledTime) {
      const parts = job.scheduledTime.split(':');
      if (parts.length >= 2) start.setHours(parseInt(parts[0]), parseInt(parts[1]), 0, 0);
    }
    
    const end = new Date(start.getTime() + (job.estimatedDuration || 60) * 60000);
    
    const canMove = canMoveCalendarEvent(role, myWorker?.id, { sourceType: "onceOffJob", assignedUserId: job.workerId });

    return {
      eventId: job.id,
      sourceType: "onceOffJob",
      sourceId: job.id,
      clientId: job.clientId,
      title: job.title,
      clientName: client?.name,
      department: departments.find(d => d.id === job.departmentId)?.name,
      serviceType: job.serviceType,
      assignedUserId: job.workerId,
      assignedUserName: worker?.name,
      startDateTime: start.toISOString(),
      endDateTime: end.toISOString(),
      durationMinutes: job.estimatedDuration || 60,
      status: job.status,
      priority: job.priority,
      location: job.location || (client ? formatClientAddress(client) : ''),
      colour: statusColor(job.status),
      editable: canMove,
      draggable: canMove,
      meta: { raw: job, invoiceStatus: job.invoiceStatus }
    };
  }, [clients, workers, departments, role, myWorker]);

  const occurrenceToDiaryEvent = useCallback((occ: any): DiaryEvent | null => {
    const start = new Date(occ.scheduledDate);
    if (isNaN(start.getTime())) return null;
    const end = new Date(start.getTime() + (occ.estimatedDuration || 60) * 60000);
    
    const sourceType: CalendarSourceType = occ.contractKind === 'rental' ? 'rentalContractOccurrence' : 'serviceContractOccurrence';
    const canMove = canMoveCalendarEvent(role, myWorker?.id, { sourceType, assignedUserId: occ.assignedTechnicianId });

    return {
      eventId: occ.id,
      sourceType,
      sourceId: occ.contractId,
      clientId: occ.clientId,
      title: `${occ.serviceType || 'Service'} - ${occ.customerName}`,
      clientName: occ.customerName,
      department: departments.find(d => d.id === occ.departmentId)?.name,
      serviceType: occ.serviceType,
      assignedUserId: occ.assignedTechnicianId,
      assignedUserName: occ.assignedTechnicianName,
      assignedTeamId: occ.assignedTeamId,
      startDateTime: start.toISOString(),
      endDateTime: end.toISOString(),
      durationMinutes: occ.estimatedDuration || 60,
      status: occ.status || 'scheduled',
      location: occ.address,
      colour: "#0d9488", // Teal for contracts
      editable: canMove,
      draggable: canMove,
      meta: { raw: occ, isOccurrence: true, originalDate: occ.originalDate }
    };
  }, [departments, role, myWorker]);

  const customToDiaryEvent = useCallback((ev: any): DiaryEvent | null => {
    const start = new Date(ev.scheduledDate);
    if (isNaN(start.getTime())) return null;
    const end = new Date(start.getTime() + (ev.estimatedDuration || 60) * 60000);
    
    return {
      eventId: ev.id,
      sourceType: "other",
      sourceId: ev.id,
      title: ev.title,
      startDateTime: start.toISOString(),
      endDateTime: end.toISOString(),
      durationMinutes: ev.estimatedDuration || 60,
      status: ev.status || 'scheduled',
      colour: "#64748b",
      editable: role === 'admin' || role === 'manager',
      draggable: role === 'admin' || role === 'manager',
      meta: { raw: ev }
    };
  }, [role]);

  const salesAppointmentToDiaryEvent = useCallback((appointment: any): DiaryEvent | null => {
    const start = new Date(`${appointment.date}T${appointment.startTime || "09:00"}:00`);
    if (isNaN(start.getTime())) return null;
    const duration = Number(appointment.estimatedDuration) || 60;
    const end = appointment.endTime
      ? new Date(`${appointment.date}T${appointment.endTime}:00`)
      : new Date(start.getTime() + duration * 60_000);
    const worker = workers.find(candidate => candidate.id === appointment.assignedToId);
    const canEdit = role === "admin" || role === "manager" || role === "sales";

    return {
      eventId: `sales-appointment-${appointment.id}`,
      sourceType: "salesAppointment",
      sourceId: appointment.id,
      clientId: appointment.clientId,
      title: appointment.title || appointment.clientName || "Sales appointment",
      clientName: appointment.clientName,
      department: "Sales",
      serviceType: appointment.appointmentType === "site_visit" ? "Site visit" : "Sales appointment",
      assignedUserId: appointment.assignedToId,
      assignedUserName: worker?.name ?? appointment.assignedToName,
      startDateTime: start.toISOString(),
      endDateTime: end.toISOString(),
      durationMinutes: duration,
      status: appointment.status || "scheduled",
      priority: appointment.priority,
      location: appointment.siteAddress || appointment.address,
      colour: appointment.appointmentType === "site_visit" ? "#0f766e" : "#7c3aed",
      editable: canEdit,
      draggable: canEdit,
      meta: { raw: appointment, salesAppointment: true },
    };
  }, [role, workers]);

  const quoteFollowUpToDiaryEvent = useCallback((lead: any): DiaryEvent | null => {
    if (!lead.followUpDate) return null;
    const start = new Date(lead.followUpDate);
    if (isNaN(start.getTime())) return null;
    start.setHours(start.getHours() || 9, start.getMinutes(), 0, 0);
    const worker = workers.find(candidate => candidate.id === lead.assignedTo);
    const canEdit = role === "admin" || role === "manager" || role === "sales";

    return {
      eventId: `quote-follow-up-${lead.id}`,
      sourceType: "followUp",
      sourceId: lead.id,
      clientId: lead.clientId,
      title: `Quote follow-up – ${lead.companyName}`,
      clientName: lead.companyName,
      department: "Sales",
      serviceType: "Quote follow-up",
      assignedUserId: lead.assignedTo,
      assignedUserName: worker?.name,
      startDateTime: start.toISOString(),
      endDateTime: new Date(start.getTime() + 30 * 60_000).toISOString(),
      durationMinutes: 30,
      status: lead.status || "scheduled",
      priority: lead.priority,
      location: lead.address,
      colour: "#f59e0b",
      editable: canEdit,
      draggable: false,
      meta: { raw: lead, quoteFollowUp: true },
    };
  }, [role, workers]);

  const salesFollowUpToDiaryEvent = useCallback((followUp: any): DiaryEvent | null => {
    if (!followUp.dueDate) return null;
    const start = new Date(`${followUp.dueDate}T09:00:00`);
    if (isNaN(start.getTime())) return null;
    const lead = salesLeads.find(candidate => candidate.id === followUp.leadId);
    const worker = workers.find(candidate => candidate.id === followUp.assignedToId || candidate.id === followUp.assignedTo);
    const canEdit = role === "admin" || role === "manager" || role === "sales";

    return {
      eventId: `sales-follow-up-${followUp.id}`,
      sourceType: "followUp",
      sourceId: followUp.id,
      clientId: lead?.clientId,
      title: followUp.title || followUp.subject || `Follow-up – ${lead?.companyName || "Sales"}`,
      clientName: lead?.companyName,
      department: "Sales",
      serviceType: "Follow-up",
      assignedUserId: followUp.assignedToId || followUp.assignedTo,
      assignedUserName: worker?.name,
      startDateTime: start.toISOString(),
      endDateTime: new Date(start.getTime() + 30 * 60_000).toISOString(),
      durationMinutes: 30,
      status: followUp.status || "scheduled",
      priority: followUp.priority,
      colour: "#f59e0b",
      editable: canEdit,
      draggable: false,
      meta: { raw: followUp, salesFollowUp: true },
    };
  }, [role, salesLeads, workers]);

  const allEvents = useMemo(() => {
    const j = jobs.map(jobToDiaryEvent).filter(Boolean) as DiaryEvent[];
    const o = contractOccurrences.map(occurrenceToDiaryEvent).filter(Boolean) as DiaryEvent[];
    const c = customEvents.map(customToDiaryEvent).filter(Boolean) as DiaryEvent[];
    const a = salesAppointments.map(salesAppointmentToDiaryEvent).filter(Boolean) as DiaryEvent[];
    const q = salesLeads.map(quoteFollowUpToDiaryEvent).filter(Boolean) as DiaryEvent[];
    const f = salesFollowUps.map(salesFollowUpToDiaryEvent).filter(Boolean) as DiaryEvent[];
    return [...j, ...o, ...c, ...a, ...q, ...f];
  }, [jobs, contractOccurrences, customEvents, salesAppointments, salesLeads, salesFollowUps, jobToDiaryEvent, occurrenceToDiaryEvent, customToDiaryEvent, salesAppointmentToDiaryEvent, quoteFollowUpToDiaryEvent, salesFollowUpToDiaryEvent]);

  const filteredEvents = useMemo(() => allEvents.filter(ev => {
    if (searchTerm && !ev.title.toLowerCase().includes(searchTerm.toLowerCase()) && !ev.clientName?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    
    if (departmentFilter !== "all") {
      const raw = ev.meta?.raw;
      if (raw?.departmentId !== departmentFilter) return false;
    }

    if (assigneeFilter !== "all") {
      const [kind, id] = assigneeFilter.split(":");
      if (kind === "worker") {
        if (ev.assignedUserId !== id) return false;
      } else if (kind === "team") {
        if (ev.assignedUserId) {
          if (!workerTeamsMap.get(ev.assignedUserId)?.has(id)) return false;
        } else if (ev.assignedTeamId !== id) {
          return false;
        }
      }
    }

    if (statusFilter !== "all" && ev.status !== statusFilter) return false;
    if (customerFilter !== "all" && ev.clientId !== customerFilter) return false;
    if (serviceTypeFilter !== "all" && ev.serviceType !== serviceTypeFilter) return false;
    if (invoiceStatusFilter !== "all" && ev.meta?.invoiceStatus !== invoiceStatusFilter) return false;

    if (typeFilter === "contract" && !ev.meta?.isOccurrence) return false;
    if (typeFilter === "oneoff" && ev.sourceType !== "onceOffJob") return false;
    if (typeFilter === "sales" && ev.sourceType !== "salesAppointment") return false;
    if (typeFilter === "followup" && ev.sourceType !== "followUp") return false;

    if (areaFilter !== "all") {
      const client = clients.find(c => c.id === ev.clientId);
      const area = (client?.suburb || client?.city || "").trim();
      if (area !== areaFilter) return false;
    }

    // Technicians only see their own jobs
    if (isTechnician && myWorker && ev.assignedUserId !== myWorker.id) return false;

    return true;
  }), [allEvents, searchTerm, departmentFilter, assigneeFilter, statusFilter, typeFilter, customerFilter, areaFilter, serviceTypeFilter, invoiceStatusFilter, workerTeamsMap, isTechnician, myWorker, clients]);

  // --- Handlers ---

  const handleEventClick = useCallback((ev: DiaryEvent) => {
    if (ev.sourceType === 'onceOffJob') {
      const job = jobs.find(j => j.id === ev.sourceId);
      if (job) {
        setEditingJob(job);
        const start = new Date(ev.startDateTime);
        jobEditForm.reset({
          title: job.title,
          description: job.description || "",
          scheduledDate: format(start, 'yyyy-MM-dd'),
          scheduledTime: format(start, 'HH:mm'),
          estimatedDuration: job.estimatedDuration || 60,
          clientId: job.clientId,
          workerId: job.workerId || "",
          departmentId: job.departmentId,
          location: job.location || "",
          priority: job.priority as any,
          status: job.status as any,
        });
        setIsEditJobDialogOpen(true);
      }
    } else {
      setSelectedEvent(ev);
      setIsEventDialogOpen(true);
    }
  }, [jobs, jobEditForm]);

  const handleEventDrop = useCallback((ev: DiaryEvent, newStart: Date, newEnd: Date, revert: () => void) => {
    const duration = differenceInMinutes(newEnd, newStart);
    if (ev.meta?.isOccurrence) {
      setOccurrenceMoveTarget({ event: ev, newStart, newEnd, revert });
      return;
    }

    const confirmMsg = `Move "${ev.title}" to ${format(newStart, 'EEEE, d MMMM')} at ${format(newStart, 'HH:mm')}?`;
    if (!window.confirm(confirmMsg)) {
      revert();
      return;
    }

    if (ev.sourceType === 'onceOffJob') {
      moveJobMutation.mutate({
        id: ev.sourceId,
        scheduledDate: newStart,
        scheduledTime: format(newStart, 'HH:mm'),
        estimatedDuration: duration
      }, { onError: revert });
    } else if (ev.sourceType === 'other') {
      apiRequest('PATCH', `/api/calendar/events/${ev.sourceId}`, {
        scheduledDate: newStart,
        estimatedDuration: duration
      }).then(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/calendar/events'] });
      }).catch(revert);
    } else if (ev.sourceType === 'salesAppointment') {
      apiRequest('PATCH', `/api/sales-appointments/${ev.sourceId}`, {
        date: format(newStart, 'yyyy-MM-dd'),
        startTime: format(newStart, 'HH:mm'),
        endTime: format(newEnd, 'HH:mm'),
        estimatedDuration: duration,
      }).then(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/sales-appointments'] });
      }).catch(revert);
    }
  }, [moveJobMutation]);

  const handleEventResize = useCallback((ev: DiaryEvent, newStart: Date, newEnd: Date, revert: () => void) => {
    const duration = differenceInMinutes(newEnd, newStart);
    if (ev.meta?.isOccurrence) {
      setOccurrenceMoveTarget({ event: ev, newStart, newEnd, revert });
      return;
    }

    if (ev.sourceType === 'onceOffJob') {
      moveJobMutation.mutate({ id: ev.sourceId, estimatedDuration: duration }, { onError: revert });
    } else if (ev.sourceType === 'other') {
       apiRequest('PATCH', `/api/calendar/events/${ev.sourceId}`, { estimatedDuration: duration })
        .then(() => queryClient.invalidateQueries({ queryKey: ['/api/calendar/events'] }))
        .catch(revert);
    } else if (ev.sourceType === 'salesAppointment') {
      apiRequest('PATCH', `/api/sales-appointments/${ev.sourceId}`, {
        endTime: format(newEnd, 'HH:mm'),
        estimatedDuration: duration,
      }).then(() => queryClient.invalidateQueries({ queryKey: ['/api/sales-appointments'] }))
        .catch(revert);
    }
  }, [moveJobMutation]);

  const handleReassign = useCallback((ev: DiaryEvent, targetColumnId: string) => {
    if (ev.assignedUserId === targetColumnId) return;
    
    const worker = workers.find(w => w.id === targetColumnId);
    const confirmMsg = `Reassign "${ev.title}" to ${worker?.name || 'Unknown'}?`;
    if (!window.confirm(confirmMsg)) return;

    if (ev.meta?.isOccurrence) {
      upsertExceptionMutation.mutate({
        contractId: ev.sourceId,
        contractKind: ev.meta.raw.contractKind,
        originalDate: ev.meta.originalDate,
        assignedTechnicianId: targetColumnId,
        status: ev.status
      });
    } else if (ev.sourceType === 'onceOffJob') {
      moveJobMutation.mutate({ id: ev.sourceId, workerId: targetColumnId } as any);
    } else if (ev.sourceType === 'salesAppointment') {
      apiRequest('PATCH', `/api/sales-appointments/${ev.sourceId}`, { assignedToId: targetColumnId })
        .then(() => queryClient.invalidateQueries({ queryKey: ['/api/sales-appointments'] }))
        .catch(() => toast({ title: "Unable to reassign appointment", variant: "destructive" }));
    }
  }, [workers, upsertExceptionMutation, moveJobMutation, toast]);

  const handleOccurrenceMoveAction = (action: 'occurrence' | 'schedule' | 'cancel') => {
    if (!occurrenceMoveTarget) return;
    const { event, newStart, revert } = occurrenceMoveTarget;
    const raw = event.meta?.raw;

    if (action === 'occurrence') {
      upsertExceptionMutation.mutate({
        contractId: event.sourceId,
        contractKind: raw.contractKind,
        originalDate: event.meta?.originalDate,
        newDate: format(newStart, 'yyyy-MM-dd'),
        newStartTime: format(newStart, 'HH:mm'),
        durationMinutes: differenceInMinutes(occurrenceMoveTarget.newEnd, newStart),
        assignedTechnicianId: event.assignedUserId,
        status: event.status
      });
    } else if (action === 'schedule') {
       updateContractMutation.mutate({
         id: event.sourceId,
         kind: raw.contractKind,
         data: {
           startTime: format(newStart, 'HH:mm'),
           dayOfWeek: format(newStart, 'EEEE'),
         }
       });
    } else {
      revert();
      setOccurrenceMoveTarget(null);
    }
  };

  // --- Filter options ---

  const areaOptions = useMemo(() => Array.from(new Set(
    clients.map(c => (c.suburb || c.city || "").trim()).filter(Boolean)
  )).sort((a, b) => a.localeCompare(b)), [clients]);

  const serviceTypeOptions = useMemo(() => Array.from(new Set(
    allEvents.map(e => e.serviceType).filter(Boolean)
  )).sort() as string[], [allEvents]);

  const assigneeGroups = useMemo(() => {
    const groups: { department: Department; options: any[] }[] = [];
    const sortedDepts = [...departments].sort((a, b) => a.name.localeCompare(b.name));
    
    sortedDepts.forEach(dept => {
      if (departmentFilter !== "all" && departmentFilter !== dept.id) return;
      
      const deptWorkers = workers.filter(w => w.departmentId === dept.id && w.isActive !== false)
        .map(w => ({ kind: "worker", id: w.id, label: w.name }));
      
      const deptTeams = teams.filter(t => t.departmentId === dept.id && t.isActive !== false)
        .map(t => ({ kind: "team", id: t.id, label: t.name }));

      if (deptWorkers.length > 0 || deptTeams.length > 0) {
        groups.push({ department: dept, options: [...deptWorkers, ...deptTeams] });
      }
    });
    return groups;
  }, [departments, workers, teams, departmentFilter]);

  const teamColumns: OutlookColumn[] = useMemo(() => {
    const activeWorkers = workers.filter(w => w.isActive !== false);
    return activeWorkers.map(w => ({
      id: w.id,
      label: w.name,
      sublabel: departments.find(d => d.id === w.departmentId)?.name,
      events: filteredEvents.filter(ev => ev.assignedUserId === w.id)
    }));
  }, [workers, filteredEvents, departments]);

  const hasFilters = searchTerm || departmentFilter !== "all" || assigneeFilter !== "all" || statusFilter !== "all" || typeFilter !== "all" || customerFilter !== "all" || areaFilter !== "all" || serviceTypeFilter !== "all" || invoiceStatusFilter !== "all";

  const clearFilters = () => {
    setSearchTerm("");
    setDepartmentFilter("all");
    setAssigneeFilter("all");
    setStatusFilter("all");
    setTypeFilter("all");
    setCustomerFilter("all");
    setAreaFilter("all");
    setServiceTypeFilter("all");
    setInvoiceStatusFilter("all");
  };

  return (
      <>
        <div className="p-4 space-y-3">

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-0.5 bg-white border rounded-lg p-1">
              {(['timeGridDay', 'timeGridWeek', 'dayGridMonth', 'listWeek', 'team'] as ViewType[]).map(v => (
                <Button 
                  key={v} 
                  variant={viewType === v ? "default" : "ghost"} 
                  size="sm" 
                  className="h-7 text-xs px-2.5" 
                  onClick={() => {
                    setViewType(v);
                    if (v !== 'team') {
                      setTimeout(() => calendarRef.current?.getApi()?.changeView(v), 0);
                    }
                  }}
                >
                  {v === 'timeGridDay' ? 'Day' : v === 'timeGridWeek' ? 'Week' : v === 'dayGridMonth' ? 'Month' : v === 'listWeek' ? 'List' : 'Team'}
                </Button>
              ))}
            </div>

            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => calendarRef.current?.prev()}><ChevronLeft className="h-4 w-4" /></Button>
              <span className="text-sm font-medium text-gray-700 min-w-[180px] text-center">{viewTitle}</span>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => calendarRef.current?.next()}><ChevronRight className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => calendarRef.current?.today()}>Today</Button>
            </div>

            <div className="flex-1" />
            <Button size="sm" className="h-7 text-xs gap-1 bg-blue-600 hover:bg-blue-700" onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" />New Job
            </Button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 bg-white border rounded-lg p-2">
            <div className="relative w-48">
              <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-gray-400" />
              <Input 
                placeholder="Search jobs/clients..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
                className="h-7 text-xs pl-7" 
              />
            </div>
            
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="h-7 text-xs w-32"><SelectValue placeholder="Dept" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger className="h-7 text-xs w-40"><SelectValue placeholder="Assignee" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Assignees</SelectItem>
                {assigneeGroups.map(group => (
                  <SelectGroup key={group.department.id}>
                    <SelectLabel className="text-[10px] uppercase text-gray-400 px-2 py-1">{group.department.name}</SelectLabel>
                    {group.options.map(opt => (
                      <SelectItem key={`${opt.kind}:${opt.id}`} value={`${opt.kind}:${opt.id}`}>
                        {opt.kind === 'team' ? `Team: ${opt.label}` : opt.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-7 text-xs w-32"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            <Select value={serviceTypeFilter} onValueChange={setServiceTypeFilter}>
              <SelectTrigger className="h-7 text-xs w-32"><SelectValue placeholder="Service" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Services</SelectItem>
                {serviceTypeOptions.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={val => setTypeFilter(val as any)}>
              <SelectTrigger className="h-7 text-xs w-32"><SelectValue placeholder="Job Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="oneoff">One-off Jobs</SelectItem>
                <SelectItem value="contract">Contracts</SelectItem>
                <SelectItem value="sales">Sales Appointments</SelectItem>
                <SelectItem value="followup">Follow-ups</SelectItem>
              </SelectContent>
            </Select>

            <Select value={areaFilter} onValueChange={setAreaFilter}>
              <SelectTrigger className="h-7 text-xs w-32"><SelectValue placeholder="Area" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Areas</SelectItem>
                {areaOptions.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={invoiceStatusFilter} onValueChange={setInvoiceStatusFilter}>
              <SelectTrigger className="h-7 text-xs w-36"><SelectValue placeholder="Invoice Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Inv Status</SelectItem>
                <SelectItem value="not_invoiced">Not Invoiced</SelectItem>
                <SelectItem value="ready_to_invoice">Ready to Invoice</SelectItem>
                <SelectItem value="invoiced">Invoiced</SelectItem>
              </SelectContent>
            </Select>

            {hasFilters && (
              <Button variant="ghost" size="sm" className="h-7 text-xs text-gray-400 gap-1" onClick={clearFilters}>
                <X className="h-3 w-3" />Clear
              </Button>
            )}
          </div>

          {/* Calendar Display */}
          <div className="relative">
            {viewType === 'team' ? (
              <OutlookColumnsView 
                columns={teamColumns}
                onEventClick={handleEventClick}
                onReassign={handleReassign}
                emptyLabel="No jobs assigned"
              />
            ) : (
              <OutlookDiaryCalendar 
                ref={calendarRef}
                events={filteredEvents}
                view={viewType as OutlookCalView}
                onDatesSet={setViewTitle}
                onEventClick={handleEventClick}
                onEventDrop={handleEventDrop}
                onEventResize={handleEventResize}
                onSelect={(start, end) => {
                  // Since we removed appointmentForm, we can directly open the Job creation dialog
                  setIsCreateDialogOpen(true);
                }}
              />
            )}

            {filteredEvents.length === 0 && hasFilters && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/50 pointer-events-none">
                <div className="bg-white border shadow-lg rounded-lg p-4 flex flex-col items-center gap-2">
                  <Filter className="h-8 w-8 text-gray-300" />
                  <p className="text-sm font-medium text-gray-500">No events matching your filters</p>
                  <Button variant="link" size="sm" onClick={clearFilters}>Clear all filters</Button>
                </div>
              </div>
            )}
          </div>
        </div>

      {/* Dialogs */}

      <Dialog open={isEventDialogOpen} onOpenChange={setIsEventDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedEvent?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3 text-sm">
              <Clock className="h-4 w-4 text-gray-400" />
              <span>
                {selectedEvent && format(new Date(selectedEvent.startDateTime), 'EEEE, d MMMM yyyy')}
                <br />
                <span className="text-gray-500">
                  {selectedEvent && format(new Date(selectedEvent.startDateTime), 'HH:mm')} – {selectedEvent && format(new Date(selectedEvent.endDateTime), 'HH:mm')} ({selectedEvent?.durationMinutes} min)
                </span>
              </span>
            </div>
            {selectedEvent?.location && (
              <div className="flex items-center gap-3 text-sm">
                <MapPin className="h-4 w-4 text-gray-400" />
                <span className="whitespace-pre-line">{selectedEvent.location}</span>
              </div>
            )}
            <div className="flex items-center gap-3 text-sm">
              <User className="h-4 w-4 text-gray-400" />
              <span>Assigned: {selectedEvent?.assignedUserName || 'Unassigned'}</span>
            </div>
            <div className="pt-2 flex gap-2">
              <Badge className={selectedEvent ? statusColorClasses(selectedEvent.status) : ''}>
                {selectedEvent?.status.replace('_', ' ')}
              </Badge>
              {selectedEvent?.meta?.invoiceStatus && (
                <Badge variant="outline">{selectedEvent.meta.invoiceStatus.replace('_', ' ')}</Badge>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            {selectedEvent?.meta?.isOccurrence ? (
              <Button variant="outline" onClick={() => setLocation(selectedEvent.meta?.raw.contractKind === 'rental' ? `/contracts?id=${selectedEvent.sourceId}` : `/service-contracts?id=${selectedEvent.sourceId}`)}>
                Open Contract
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setLocation(`/job-card/${selectedEvent?.sourceId}`)}>
                Open Job Card
              </Button>
            )}
            <Button onClick={() => setIsEventDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Job</DialogTitle>
          </DialogHeader>
          <JobForm 
            onSuccess={() => {
              setIsCreateDialogOpen(false);
              queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
            }}
            onCancel={() => setIsCreateDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isEditJobDialogOpen} onOpenChange={setIsEditJobDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Job: {editingJob?.title}</DialogTitle>
          </DialogHeader>
          <Form {...jobEditForm}>
            <form onSubmit={jobEditForm.handleSubmit(data => {
              const payload = {
                ...data,
                scheduledDate: new Date(`${data.scheduledDate}T${data.scheduledTime}:00.000Z`)
              };
              updateJobMutation.mutate({ id: editingJob!.id, data: payload as any });
            })} className="space-y-4">
              <FormField
                control={jobEditForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={jobEditForm.control}
                  name="scheduledDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={jobEditForm.control}
                  name="scheduledTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Time</FormLabel>
                      <FormControl><Input type="time" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={jobEditForm.control}
                name="workerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Technician</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select technician" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {workers.filter(w => w.isActive !== false).map(w => (
                          <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={jobEditForm.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditJobDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={updateJobMutation.isPending}>Save Changes</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!occurrenceMoveTarget} onOpenChange={open => !open && setOccurrenceMoveTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Update Recurring Service
            </DialogTitle>
            <DialogDescription>
              How would you like to apply this change to the recurring contract?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <Button className="w-full justify-start h-auto py-3 px-4 flex flex-col items-start gap-1" variant="outline" onClick={() => handleOccurrenceMoveAction('occurrence')}>
              <span className="font-bold">This occurrence only</span>
              <span className="text-xs text-gray-500 font-normal">Create an exception for this specific date only.</span>
            </Button>
            <Button className="w-full justify-start h-auto py-3 px-4 flex flex-col items-start gap-1" variant="outline" onClick={() => handleOccurrenceMoveAction('schedule')}>
              <span className="font-bold">Update contract schedule</span>
              <span className="text-xs text-gray-500 font-normal">Change the base schedule for all future occurrences.</span>
            </Button>
            <Button className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50" variant="ghost" onClick={() => handleOccurrenceMoveAction('cancel')}>
              Cancel move
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      </>
  );
}
