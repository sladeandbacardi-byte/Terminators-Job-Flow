import { useState, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameDay, isSameMonth, isToday, addWeeks, subWeeks, addMonths, subMonths, startOfDay, endOfDay, addHours, differenceInCalendarDays, isBefore, isAfter, min, max } from "date-fns";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import MobileNavigation from "@/components/layout/mobile-nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Clock, 
  MapPin, 
  User,
  Search,
  Edit,
  Save,
  X,
  FileText
} from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatClientAddress, type Job, type Client, type Worker, type Department, type Team, type TeamMember } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { getDashboardRole } from "@/lib/dashboardRole";

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  type: 'job' | 'appointment' | 'meeting' | 'reminder';
  priority: 'low' | 'medium' | 'high';
  clientId?: string;
  workerId?: string;
  departmentId?: string;
  location?: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'pending';
  color?: string;
  estimatedDuration?: number;
}

type ViewType = 'month' | 'week' | 'day' | 'agenda';

// Form schemas
const appointmentSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  startDate: z.string().min(1, "Start date is required"),
  startTime: z.string().min(1, "Start time is required"),
  duration: z.number().min(15, "Duration must be at least 15 minutes"),
  clientId: z.string().optional(),
  workerId: z.string().optional(),
  departmentId: z.string().optional(),
  location: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]),
});

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

type AppointmentForm = z.infer<typeof appointmentSchema>;
type JobEditForm = z.infer<typeof jobEditSchema>;

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState<ViewType>('month');
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditJobDialogOpen, setIsEditJobDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [teamFilter, setTeamFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [draggedEvent, setDraggedEvent] = useState<CalendarEvent | null>(null);
  const [showAllHours, setShowAllHours] = useState(false);

  const dragCounter = useRef(0);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { user } = useAuth();
  const isTechnician = getDashboardRole({ departmentId: user?.departmentId, role: user?.role }) === "service";

  // Form handlers
  const appointmentForm = useForm<AppointmentForm>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      title: "",
      description: "",
      startDate: format(new Date(), 'yyyy-MM-dd'),
      startTime: format(new Date(), 'HH:mm'),
      duration: 60,
      priority: "medium",
    },
  });

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

  // Fetch calendar events (jobs and custom events)
  const { data: events = [], isLoading } = useQuery<CalendarEvent[]>({
    queryKey: ['/api/calendar/events', format(currentDate, 'yyyy-MM')],
    refetchInterval: 30000,
  });

  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: ['/api/jobs'],
  });

  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ['/api/departments'],
  });

  const { data: workers = [] } = useQuery<Worker[]>({
    queryKey: ['/api/workers'],
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
  });

  const { data: teams = [] } = useQuery<Team[]>({ queryKey: ['/api/teams'] });
  const { data: teamMembers = [] } = useQuery<TeamMember[]>({ queryKey: ['/api/team-members'] });

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

  const teamOptions = useMemo(() => {
    if (departmentFilter === "all") return teams;
    return teams.filter(t => t.departmentId === departmentFilter);
  }, [teams, departmentFilter]);

  const onDepartmentChange = (val: string) => {
    setDepartmentFilter(val);
    if (val !== "all" && teamFilter !== "all") {
      const t = teams.find(t => t.id === teamFilter);
      if (!t || t.departmentId !== val) setTeamFilter("all");
    }
  };

  // Resolve the logged-in technician's worker record
  const myWorker = useMemo(() => {
    if (!isTechnician) return null;
    const byEmail = workers.find(w => user?.email && w.email === user.email);
    if (byEmail) return byEmail;
    // Fallback: busiest active worker in user's department (demo mode)
    const inDept = workers
      .filter(w => w.departmentId === user?.departmentId && w.isActive !== false)
      .map(w => ({ w, count: jobs.filter(j => j.workerId === w.id).length }))
      .sort((a, b) => b.count - a.count);
    return inDept[0]?.w ?? null;
  }, [isTechnician, workers, jobs, user]);

  // Mutations
  const createAppointmentMutation = useMutation({
    mutationFn: async (data: AppointmentForm) => {
      const appointmentData = {
        ...data,
        scheduledDate: `${data.startDate}T${data.startTime}:00.000Z`,
        estimatedDuration: data.duration,
        type: 'appointment' as const,
      };
      return apiRequest('POST', '/api/calendar/events', appointmentData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/calendar/events'] });
      setIsCreateDialogOpen(false);
      appointmentForm.reset();
      toast({ title: "Appointment created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create appointment", variant: "destructive" });
    },
  });

  const updateJobMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: JobEditForm }) => {
      const jobData = {
        ...data,
        scheduledDate: `${data.scheduledDate}T${data.scheduledTime}:00.000Z`,
      };
      return apiRequest('PATCH', `/api/jobs/${id}`, jobData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      setIsEditJobDialogOpen(false);
      setEditingJob(null);
      jobEditForm.reset();
      toast({ title: "Job updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update job", variant: "destructive" });
    },
  });

  const moveEventMutation = useMutation({
    mutationFn: async ({ eventId, newDate }: { eventId: string; newDate: string }) => {
      const event = allEvents.find(e => e.id === eventId);
      if (!event) throw new Error('Event not found');


      if (event.type === 'job') {
        const job = jobs.find(j => j.id === eventId);
        if (!job) throw new Error('Job not found');
        
        return await apiRequest('PATCH', `/api/jobs/${eventId}`, { scheduledDate: newDate });
      } else {
        return apiRequest('PATCH', `/api/calendar/events/${eventId}`, { scheduledDate: newDate });
      }
    },
    onSuccess: async (data, variables) => {
      // Force immediate refetch instead of just invalidation
      await queryClient.refetchQueries({ queryKey: ['/api/jobs'] });
      await queryClient.refetchQueries({ queryKey: ['/api/calendar/events'] });
      
      // Check if event was moved to a different month
      const movedToDate = new Date(variables.newDate);
      const movedToMonth = format(movedToDate, 'yyyy-MM');
      const currentMonth = format(currentDate, 'yyyy-MM');
      
      
      if (movedToMonth !== currentMonth) {
        // Only navigate if event moved to a different month
        setCurrentDate(movedToDate);
        toast({ 
          title: "Event moved to " + format(movedToDate, 'MMMM yyyy'),
          description: "Calendar updated to show the new date"
        });
      } else {
        // Event stayed in same month - just show success message
        toast({ title: "Event moved successfully" });
      }
    },
    onError: (error) => {
      console.error('Move failed:', error);
      toast({ title: "Failed to move event", variant: "destructive" });
    },
  });

  // Convert jobs to calendar events with safe date handling
  const jobEvents: CalendarEvent[] = jobs.map(job => {
    const client = clients.find(c => c.id === job.clientId);
    const worker = workers.find(w => w.id === job.workerId);
    
    const scheduledDate = new Date(job.scheduledDate);
    
    // Validate the scheduled date
    if (isNaN(scheduledDate.getTime())) {
      console.warn(`Invalid scheduled date for job ${job.id}:`, job.scheduledDate);
      return null;
    }

    // Merge scheduledTime ("HH:mm") into the date so events show at the right hour
    if (job.scheduledTime) {
      const parts = job.scheduledTime.split(':');
      if (parts.length >= 2) {
        scheduledDate.setHours(parseInt(parts[0]), parseInt(parts[1]), 0, 0);
      }
    }
    
    const endTime = new Date(scheduledDate.getTime() + (job.estimatedDuration || 60) * 60000);
    
    
    const jobColor = (() => {
      if (job.status !== 'completed' && job.status !== 'cancelled') {
        const jobDate = new Date(job.scheduledDate);
        if (!isNaN(jobDate.getTime()) && jobDate < new Date()) return '#dc2626';
      }
      if (!job.workerId) return '#9ca3af';
      switch (job.status) {
        case 'scheduled':   return '#f97316';
        case 'in_progress': return '#3b82f6';
        case 'completed':   return '#22c55e';
        case 'cancelled':   return '#ef4444';
        case 'pending':     return '#eab308';
        default:            return '#9ca3af';
      }
    })();

    return {
      id: job.id,
      title: `${job.title}${client ? ` - ${client.name}` : ''}`,
      description: job.description || '',
      startTime: scheduledDate,
      endTime: endTime,
      type: 'job',
      priority: job.priority as 'low' | 'medium' | 'high',
      clientId: job.clientId,
      workerId: job.workerId || undefined,
      departmentId: job.departmentId,
      location: job.location || (client ? formatClientAddress(client) : '') || undefined,
      status: job.status as 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'pending',
      color: jobColor,
    };
  }).filter(Boolean) as CalendarEvent[];

  const allEvents = [...events, ...jobEvents];

  const filteredEvents = allEvents.filter(event => {
    // Safety check for event validity
    if (!event || !event.startTime || !event.title) {
      console.warn('Invalid event found:', event);
      return false;
    }

    // Validate startTime is a valid Date
    if (!(event.startTime instanceof Date) || isNaN(event.startTime.getTime())) {
      console.warn('Invalid startTime for event:', event.id, event.startTime);
      return false;
    }

    const matchesSearch = event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (event.description && event.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesDepartment = departmentFilter === "all" || event.departmentId === departmentFilter;
    const matchesTeam = teamFilter === "all" ||
      (event.workerId ? !!workerTeamsMap.get(event.workerId)?.has(teamFilter) : false);
    const matchesStatus = statusFilter === "all" || event.status === statusFilter;
    // Technicians only see their own jobs
    const matchesWorker = !isTechnician || !myWorker || event.workerId === myWorker.id;

    return matchesSearch && matchesDepartment && matchesTeam && matchesStatus && matchesWorker;
  });

  function getPriorityColor(priority: string): string {
    switch (priority) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'scheduled':   return 'bg-orange-100 text-orange-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'completed':   return 'bg-green-100 text-green-800';
      case 'cancelled':   return 'bg-red-100 text-red-800';
      case 'pending':     return 'bg-yellow-100 text-yellow-800';
      default:            return 'bg-gray-100 text-gray-700';
    }
  }

  // Event handlers
  const handleEventClick = (event: CalendarEvent) => {
    if (event.type === 'job') {
      const job = jobs.find(j => j.id === event.id);
      if (job) {
        setEditingJob(job);
        const scheduledDate = new Date(job.scheduledDate);
        
        // Validate date before formatting
        if (isNaN(scheduledDate.getTime())) {
          console.error('Invalid date for job editing:', job.scheduledDate);
          toast({ title: "Error: Invalid job date", variant: "destructive" });
          return;
        }
        
        jobEditForm.reset({
          title: job.title,
          description: job.description || "",
          scheduledDate: format(scheduledDate, 'yyyy-MM-dd'),
          scheduledTime: format(scheduledDate, 'HH:mm'),
          estimatedDuration: job.estimatedDuration || 60,
          clientId: job.clientId,
          workerId: job.workerId || "",
          departmentId: job.departmentId,
          location: job.location || "",
          priority: job.priority as "low" | "medium" | "high",
          status: job.status as "scheduled" | "in_progress" | "completed" | "cancelled",
        });
        setIsEditJobDialogOpen(true);
      }
    } else {
      setSelectedEvent(event);
      setIsEventDialogOpen(true);
    }
  };

  const handleCreateAppointment = (data: AppointmentForm) => {
    createAppointmentMutation.mutate(data);
  };

  const handleUpdateJob = (data: JobEditForm) => {
    if (editingJob) {
      updateJobMutation.mutate({ id: editingJob.id, data });
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, event: CalendarEvent) => {
    setDraggedEvent(event);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', event.id);
  };

  const handleDragEnd = () => {
    setDraggedEvent(null);
    dragCounter.current = 0;
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetDate: Date, preserveTime: boolean = true) => {
    e.preventDefault();
    dragCounter.current = 0;
    
    if (draggedEvent && targetDate && !isNaN(targetDate.getTime())) {
      try {
        const newDate = new Date(targetDate);
        
        // In day view, use the target time (hour from drop zone)
        // In month/week view, preserve the original time
        if (preserveTime && draggedEvent.startTime && !isNaN(draggedEvent.startTime.getTime())) {
          newDate.setHours(draggedEvent.startTime.getHours());
          newDate.setMinutes(draggedEvent.startTime.getMinutes());
          newDate.setSeconds(draggedEvent.startTime.getSeconds());
        } else if (!preserveTime) {
          // Use the exact time from targetDate (includes hour from drop zone in day view)
          // Already set in targetDate, no need to modify
        } else {
          // Default to 9 AM if startTime is invalid
          newDate.setHours(9);
          newDate.setMinutes(0);
          newDate.setSeconds(0);
        }
        
        
        // Validate the final date before sending
        if (!isNaN(newDate.getTime())) {
          moveEventMutation.mutate({
            eventId: draggedEvent.id,
            newDate: newDate.toISOString()
          });
        }
      } catch (error) {
        console.error('Error in handleDrop:', error);
        toast({ title: "Failed to move event", variant: "destructive" });
      }
    }
    setDraggedEvent(null);
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    switch (viewType) {
      case 'month':
        setCurrentDate(direction === 'next' ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
        break;
      case 'week':
        setCurrentDate(direction === 'next' ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
        break;
      case 'day':
        setCurrentDate(direction === 'next' ? addDays(currentDate, 1) : addDays(currentDate, -1));
        break;
    }
  };

  const getViewTitle = () => {
    switch (viewType) {
      case 'month':
        return format(currentDate, 'MMMM yyyy');
      case 'week':
        const weekStart = startOfWeek(currentDate);
        const weekEnd = endOfWeek(currentDate);
        return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
      case 'day':
        return format(currentDate, 'EEEE, d MMMM yyyy');
      case 'agenda':
        return 'Upcoming Events';
      default:
        return '';
    }
  };

  const getEventsForDate = (date: Date, useFiltered = true) => {
    if (!date || isNaN(date.getTime())) {
      console.warn('Invalid date passed to getEventsForDate:', date);
      return [];
    }
    
    // Use allEvents for day view to show everything, filteredEvents for other views
    const eventsToSearch = useFiltered ? filteredEvents : allEvents;
    
    return eventsToSearch.filter(event => {
      try {
        if (!event || !event.startTime) {
          return false;
        }
        
        // Ensure startTime is a valid Date object
        const eventDate = event.startTime instanceof Date ? event.startTime : new Date(event.startTime);
        if (isNaN(eventDate.getTime())) {
          console.warn('Invalid date for event:', event.id);
          return false;
        }
        
        return isSameDay(eventDate, date);
      } catch (error) {
        console.warn('Error comparing dates for event:', event?.id, error);
        return false;
      }
    });
  };

  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const rows = [];
    let days = [];
    let day = new Date(startDate);

    // Generate complete calendar grid - ensuring we show all days including the last day of month
    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        const currentDay = new Date(day);
        const dayEvents = getEventsForDate(currentDay);
        const isCurrentMonth = isSameMonth(currentDay, currentDate);
        const isCurrentDayFlag = isToday(currentDay);

        days.push(
          <div
            key={currentDay.toISOString()}
            className={cn(
              "min-h-[120px] p-2 border border-gray-200 cursor-pointer hover:bg-gray-50",
              !isCurrentMonth && "bg-gray-100 text-gray-400",
              isCurrentDayFlag && "bg-blue-50 border-blue-300"
            )}
            onClick={() => setCurrentDate(new Date(currentDay))}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, currentDay)}
          >
            <div className={cn(
              "text-sm font-medium mb-1",
              isCurrentDayFlag && "text-blue-600"
            )}>
              {format(currentDay, 'd')}
            </div>
            <div className="space-y-1">
              {dayEvents.slice(0, 3).map((event, index) => (
                <div
                  key={event.id}
                  className="text-xs p-1 rounded cursor-pointer hover:opacity-80 group relative"
                  style={{ backgroundColor: (event.color || '#6b7280') + '20', color: event.color || '#6b7280' }}
                  draggable
                  onDragStart={(e) => handleDragStart(e, event)}
                  onDragEnd={handleDragEnd}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEventClick(event);
                  }}
                >
                  <div className="truncate font-medium">{event.title}</div>
                  <div className="flex justify-between items-center">
                    <div className="truncate text-gray-600">
                      {format(event.startTime, 'HH:mm')}
                    </div>
                    {event.type === 'job' && (
                      <Edit className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </div>
              ))}
              {dayEvents.length > 3 && (
                <div className="text-xs text-gray-500 text-center">
                  +{dayEvents.length - 3} more
                </div>
              )}
            </div>
          </div>
        );
        
        day = addDays(day, 1);
      }
      
      // Create a row with the 7 days
      rows.push(
        <div key={`week-${rows.length}`} className="grid grid-cols-7">
          {days}
        </div>
      );
      days = [];
    }

    return (
      <div className="space-y-0">
        {/* Week headers */}
        <div className="grid grid-cols-7 border-b">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="p-3 text-center font-medium text-gray-600 border-r border-gray-200 last:border-r-0">
              {day}
            </div>
          ))}
        </div>
        {rows}
      </div>
    );
  };

  const renderWeekView = () => {
    const HOUR_HEIGHT = 64;
    const weekStart = startOfWeek(currentDate);
    const weekEnd = addDays(weekStart, 6);
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const businessHours = Array.from({ length: 10 }, (_, i) => i + 7);
    const allHoursArr = Array.from({ length: 24 }, (_, i) => i);
    const hours = showAllHours ? allHoursArr : businessHours;
    const hourOffset = showAllHours ? 0 : 7;
    const totalHeight = hours.length * HOUR_HEIGHT;

    // ── Separate multi-day events from timed events ──────────────────────────
    const isMultiDay = (ev: CalendarEvent) => {
      if (!ev.endTime || !(ev.endTime instanceof Date) || isNaN(ev.endTime.getTime())) return false;
      return differenceInCalendarDays(ev.endTime, ev.startTime) >= 1;
    };

    // Multi-day events that overlap this week
    const weekMultiDayEvents = filteredEvents.filter(ev => {
      if (!isMultiDay(ev)) return false;
      const evStart = startOfDay(ev.startTime);
      const evEnd = startOfDay(ev.endTime);
      return !isAfter(evStart, weekEnd) && !isBefore(evEnd, weekStart);
    });

    // Build rows of non-overlapping multi-day banners (greedy packing)
    type BannerRow = Array<{ ev: CalendarEvent; startCol: number; endCol: number }>;
    const bannerRows: BannerRow[] = [];
    for (const ev of weekMultiDayEvents) {
      const evStart = startOfDay(ev.startTime);
      const evEnd = startOfDay(ev.endTime);
      const startCol = weekDays.findIndex(d => isSameDay(d, max([evStart, weekStart])));
      const endCol = weekDays.findLastIndex(d => !isAfter(startOfDay(d), evEnd));
      const sc = startCol === -1 ? 0 : startCol;
      const ec = endCol === -1 ? 6 : endCol;
      // Find first row where this event fits
      let placed = false;
      for (const row of bannerRows) {
        const conflicts = row.some(b => !(ec < b.startCol || sc > b.endCol));
        if (!conflicts) { row.push({ ev, startCol: sc, endCol: ec }); placed = true; break; }
      }
      if (!placed) bannerRows.push([{ ev, startCol: sc, endCol: ec }]);
    }

    const BANNER_ROW_HEIGHT = 24; // px per row
    const allDayHeight = Math.max(bannerRows.length * BANNER_ROW_HEIGHT + 4, 28); // min 28px

    // ── Timed events (exclude multi-day) per day column ──────────────────────
    const getPositionedEventsForDay = (day: Date) => {
      const dayEvts = filteredEvents.filter(ev => {
        if (isMultiDay(ev)) return false;
        try {
          const d = ev.startTime instanceof Date ? ev.startTime : new Date(ev.startTime);
          return !isNaN(d.getTime()) && isSameDay(d, day);
        } catch { return false; }
      });

      const raw = dayEvts.map(ev => {
        const startHour = ev.startTime.getHours();
        const startMin = ev.startTime.getMinutes();
        if (!showAllHours && (startHour < 7 || startHour >= 17)) return null;
        const adjustedHour = startHour - hourOffset;

        // Clip duration at end of visible hours
        const rawDuration =
          ev.endTime && ev.endTime instanceof Date && !isNaN(ev.endTime.getTime())
            ? (ev.endTime.getTime() - ev.startTime.getTime()) / 60000
            : 60;
        const maxDuration = (hours[hours.length - 1] - startHour + 1) * 60 - startMin;
        const duration = Math.min(rawDuration, maxDuration);

        const top = adjustedHour * HOUR_HEIGHT + (startMin * HOUR_HEIGHT / 60);
        const height = Math.max(duration * HOUR_HEIGHT / 60, 24);
        if (isNaN(top) || isNaN(height) || top < 0 || adjustedHour < 0) return null;
        return { ...ev, top, height, clipped: rawDuration > maxDuration };
      }).filter(Boolean) as Array<CalendarEvent & { top: number; height: number; clipped: boolean }>;

      // Group overlapping events side-by-side
      const groups: Array<typeof raw> = [];
      for (const ev of raw) {
        let placed = false;
        for (const g of groups) {
          const overlaps = g.some(ge => !(ev.top >= ge.top + ge.height || ge.top >= ev.top + ev.height));
          if (overlaps) { g.push(ev); placed = true; break; }
        }
        if (!placed) groups.push([ev]);
      }
      const final: Array<CalendarEvent & { top: number; height: number; clipped: boolean; left: string; width: string }> = [];
      for (const g of groups) {
        const n = g.length;
        g.forEach((ev, i) => final.push({ ...ev, left: `${(i * 100) / n}%`, width: `${100 / n}%` }));
      }
      return final;
    };

    return (
      <div className="flex flex-col h-full">
        {/* ── Sticky header: day names + all-day banner ───────────────────── */}
        <div className="sticky top-0 z-10 bg-white border-b shadow-sm">
          {/* Day name row */}
          <div className="grid" style={{ gridTemplateColumns: '64px repeat(7, 1fr)' }}>
            <div className="border-r border-b" />
            {weekDays.map(day => (
              <div
                key={day.toISOString()}
                className="p-2 text-center border-r border-b last:border-r-0 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => { setCurrentDate(day); setViewType('day'); }}
              >
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">{format(day, 'EEE')}</div>
                <div className={cn(
                  "text-xl font-bold w-9 h-9 mx-auto mt-0.5 flex items-center justify-center rounded-full",
                  isToday(day) ? "bg-blue-600 text-white" : "text-gray-900 hover:bg-gray-100"
                )}>
                  {format(day, 'd')}
                </div>
              </div>
            ))}
          </div>

          {/* All-day / multi-day banner row */}
          <div className="grid" style={{ gridTemplateColumns: '64px repeat(7, 1fr)' }}>
            <div className="border-r flex items-center justify-end pr-1" style={{ height: allDayHeight + 'px' }}>
              <span className="text-xs text-gray-400 select-none">all-day</span>
            </div>
            {/* Single relative container spanning all 7 columns */}
            <div className="relative col-span-7 border-b" style={{ height: allDayHeight + 'px' }}>
              {bannerRows.map((row, rowIdx) =>
                row.map(({ ev, startCol, endCol }) => {
                  const colWidth = 100 / 7;
                  const left = startCol * colWidth;
                  const width = (endCol - startCol + 1) * colWidth;
                  const daysTotal = differenceInCalendarDays(ev.endTime, ev.startTime);
                  const daysLabel = daysTotal > 1 ? ` (${daysTotal}d)` : '';
                  return (
                    <div
                      key={ev.id}
                      className="absolute rounded cursor-pointer text-white text-xs font-semibold flex items-center px-1.5 truncate hover:opacity-80 transition-opacity"
                      style={{
                        top: rowIdx * BANNER_ROW_HEIGHT + 2 + 'px',
                        height: BANNER_ROW_HEIGHT - 3 + 'px',
                        left: `calc(${left}% + 2px)`,
                        width: `calc(${width}% - 4px)`,
                        backgroundColor: ev.color || '#6b7280',
                        minWidth: 0,
                      }}
                      title={`${ev.title}${daysLabel} — ${format(ev.startTime, 'MMM d')} to ${format(ev.endTime, 'MMM d')}`}
                      onClick={() => handleEventClick(ev)}
                    >
                      {startCol === 0 || !isBefore(startOfDay(ev.startTime), weekStart)
                        ? <span className="truncate">{ev.title}{daysLabel}</span>
                        : <span className="truncate opacity-80">↵ {ev.title}{daysLabel}</span>
                      }
                      {endCol < 6 && isAfter(startOfDay(ev.endTime), weekEnd) && <span className="ml-auto shrink-0">→</span>}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ── Scrollable time grid ─────────────────────────────────────────── */}
        <div className="flex-1 overflow-auto">
          <div className="flex" style={{ minHeight: totalHeight + 'px' }}>
            {/* Time label column */}
            <div className="w-16 shrink-0 border-r bg-gray-50 select-none">
              {hours.map(hour => (
                <div key={hour} className="border-b border-gray-100 flex items-start justify-end pr-2 pt-1" style={{ height: HOUR_HEIGHT + 'px' }}>
                  <span className="text-xs text-gray-400">{format(new Date().setHours(hour, 0), 'HH:mm')}</span>
                </div>
              ))}
            </div>

            {/* Day columns */}
            {weekDays.map(day => {
              const posEvts = getPositionedEventsForDay(day);
              return (
                <div
                  key={day.toISOString()}
                  className={cn("flex-1 relative border-r last:border-r-0", isToday(day) && "bg-blue-50/20")}
                  style={{ height: totalHeight + 'px' }}
                >
                  {hours.map((hour, idx) => (
                    <div
                      key={hour}
                      className="absolute w-full border-b border-gray-100"
                      style={{ top: idx * HOUR_HEIGHT + 'px', height: HOUR_HEIGHT + 'px' }}
                      onDragOver={handleDragOver}
                      onDragEnter={handleDragEnter}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => { const d = new Date(day); d.setHours(hour, 0, 0, 0); handleDrop(e, d); }}
                    />
                  ))}

                  {posEvts.map(ev => (
                    <div
                      key={ev.id}
                      className="absolute rounded overflow-hidden cursor-pointer border hover:opacity-80 transition-opacity"
                      style={{
                        top: ev.top + 'px',
                        height: ev.height + 'px',
                        left: `calc(${ev.left} + 2px)`,
                        width: `calc(${ev.width} - 4px)`,
                        backgroundColor: (ev.color || '#6b7280') + '25',
                        borderColor: ev.color || '#6b7280',
                        borderLeftWidth: '3px',
                        color: ev.color || '#374151',
                        minHeight: '24px',
                      }}
                      draggable
                      onDragStart={(e) => handleDragStart(e, ev)}
                      onDragEnd={handleDragEnd}
                      onClick={() => handleEventClick(ev)}
                    >
                      <div className="px-1 pt-0.5">
                        <div className="font-semibold text-xs truncate leading-tight">{ev.title}</div>
                        {ev.height >= 36 && (
                          <div className="text-xs opacity-70 truncate leading-tight">
                            {format(ev.startTime, 'HH:mm')} – {ev.clipped ? `${format(hours[hours.length-1]+1 <= 23 ? hours[hours.length-1]+1 : 23, '00')}:00 →` : format(ev.endTime, 'HH:mm')}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    // Use filtered events for day view to respect department and status filters
    const dayEvents = getEventsForDate(currentDate, true).sort((a, b) => {
      try {
        return a.startTime.getTime() - b.startTime.getTime();
      } catch (error) {
        console.warn('Error sorting events:', error, { a: a?.id, b: b?.id });
        return 0;
      }
    });
    
    console.log(`Day view for ${format(currentDate, 'yyyy-MM-dd')}: Found ${dayEvents.length} events`);
    dayEvents.forEach(event => {
      console.log(`  Event: ${event.title} at ${format(event.startTime, 'HH:mm')}`);
    });

    // Function to detect overlapping events and calculate positioning
    const calculateEventPositions = (events: CalendarEvent[]) => {
      const positionedEvents = events.map(event => {
        // Safety checks for event properties
        if (!event || !event.startTime) {
          console.warn('Skipping invalid event in day view:', event?.id);
          return null;
        }

        const startHour = event.startTime.getHours();
        const startMinute = event.startTime.getMinutes();
        
        // Calculate duration with proper fallback
        let duration = 60; // Default 1 hour
        if (event.endTime && event.endTime instanceof Date && !isNaN(event.endTime.getTime())) {
          duration = (event.endTime.getTime() - event.startTime.getTime()) / (1000 * 60);
        } else if (event.estimatedDuration) {
          duration = event.estimatedDuration;
        }
        
        // Calculate position based on whether we're showing business hours or full day
        const hourOffset = showAllHours ? 0 : 7; // Business hours start at 7 AM
        const adjustedHour = startHour - hourOffset;
        
        // Skip events outside visible hours
        if (!showAllHours && (startHour < 7 || startHour >= 17)) {
          return null;
        }
        
        const top = (adjustedHour * 64) + (startMinute * 64 / 60);
        const height = Math.max((duration * 64 / 60), 40); // Ensure minimum height

        // Validate calculated values
        if (isNaN(top) || isNaN(height) || top < 0 || height < 0 || adjustedHour < 0) {
          console.warn('Invalid positioning for event:', event.id, { 
            top, height, startHour, startMinute, duration, adjustedHour 
          });
          return null;
        }

        return {
          ...event,
          top,
          height,
          duration,
          startTime: event.startTime,
          endTime: event.endTime && event.endTime instanceof Date 
            ? event.endTime 
            : new Date(event.startTime.getTime() + duration * 60000)
        };
      }).filter(Boolean);

      // Group overlapping events
      const groups: Array<typeof positionedEvents> = [];
      
      for (const event of positionedEvents) {
        if (!event) continue;
        
        let addedToGroup = false;
        
        for (const group of groups) {
          // Check if this event overlaps with any event in the group
          const overlaps = group.some(groupEvent => {
            if (!groupEvent) return false;
            const eventEnd = event.top + event.height;
            const groupEventEnd = groupEvent.top + groupEvent.height;
            
            return !(event.top >= groupEventEnd || groupEvent.top >= eventEnd);
          });
          
          if (overlaps) {
            group.push(event);
            addedToGroup = true;
            break;
          }
        }
        
        if (!addedToGroup) {
          groups.push([event]);
        }
      }

      // Calculate positions for each group
      const finalEvents: Array<typeof positionedEvents[0] & { left: string; width: string; column: number }> = [];
      
      for (const group of groups) {
        const groupSize = group.length;
        const columnWidth = `${100 / groupSize}%`;
        
        group.forEach((event, index) => {
          if (!event) return;
          finalEvents.push({
            ...event,
            left: `${(index * 100) / groupSize}%`,
            width: columnWidth,
            column: index
          });
        });
      }

      return finalEvents.filter(Boolean);
    };

    const positionedEvents = calculateEventPositions(dayEvents);
    // Display hours: 7 AM to 5 PM (business hours) or full day
    const businessHours = Array.from({ length: 10 }, (_, i) => i + 7);
    const allHours = Array.from({ length: 24 }, (_, i) => i);
    const hours = showAllHours ? allHours : businessHours;

    return (
      <div className="flex h-full">
        {/* Time column */}
        <div className="w-20 border-r bg-gray-50">
          {hours.map(hour => (
            <div key={hour} className="h-16 border-b border-gray-100 p-2 text-xs text-gray-500 text-right">
              {format(new Date().setHours(hour, 0), 'HH:mm')}
            </div>
          ))}
        </div>

        {/* Events column */}
        <div className="flex-1 relative">
          {hours.map(hour => (
            <div 
              key={hour} 
              className="h-16 border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
              onDragOver={handleDragOver}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDrop={(e) => {
                const dropDate = new Date(currentDate);
                dropDate.setHours(hour, 0, 0, 0);
                handleDrop(e, dropDate, false);
              }}
            ></div>
          ))}
          
          {/* Events overlay */}
          {positionedEvents.map(event => {
            return (
              <div
                key={event.id}
                className="absolute p-2 rounded cursor-pointer hover:opacity-80 border border-gray-200 overflow-hidden"
                style={{ 
                  top: `${event.top}px`, 
                  height: `${event.height}px`,
                  left: event.left,
                  width: event.width,
                  backgroundColor: (event.color || '#6b7280') + '20',
                  color: event.color || '#6b7280',
                  minHeight: '40px',
                  marginLeft: '4px',
                  marginRight: '4px'
                }}
                onClick={() => handleEventClick(event)}
                draggable
                  onDragStart={(e) => handleDragStart(e, event)}
                  onDragEnd={handleDragEnd}
                >
                  <div className="font-medium text-sm truncate">{event.title}</div>
                  <div className="text-xs text-gray-600">
                    {format(event.startTime, 'HH:mm')} - {format(event.endTime, 'HH:mm')}
                  </div>
                  {event.location && (
                    <div className="text-xs text-gray-500 truncate">
                      📍 {event.location}
                    </div>
                  )}
                </div>
              );
          }).filter(Boolean)}
        </div>
      </div>
    );
  };

  const renderAgendaView = () => {
    const upcomingEvents = filteredEvents
      .filter(event => event.startTime >= new Date())
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
      .slice(0, 50);

    if (upcomingEvents.length === 0) {
      return (
        <div className="text-center py-12 text-gray-500">
          <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No upcoming events found</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {upcomingEvents.map(event => (
          <Card key={event.id} className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => {
                  setSelectedEvent(event);
                  setIsEventDialogOpen(true);
                }}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: event.color }}
                    ></div>
                    <h3 className="font-medium">{event.title}</h3>
                    <Badge className={getStatusColor(event.status)} variant="secondary">
                      {event.status.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>
                  
                  <div className="space-y-1 text-sm text-gray-600">
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4" />
                      <span>
                        {format(event.startTime, 'MMM d, yyyy')} • {format(event.startTime, 'HH:mm')} - {format(event.endTime, 'HH:mm')}
                      </span>
                    </div>
                    
                    {event.location && (
                      <div className="flex items-center space-x-2">
                        <MapPin className="h-4 w-4" />
                        <span>{event.location}</span>
                      </div>
                    )}
                    
                    {event.workerId && (
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4" />
                        <span>{workers.find(w => w.id === event.workerId)?.name || 'Unknown Worker'}</span>
                      </div>
                    )}
                  </div>
                  
                  {event.description && (
                    <p className="text-sm text-gray-700 mt-2 line-clamp-2">{event.description}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderCurrentView = () => {
    try {
      switch (viewType) {
        case 'month': return renderMonthView();
        case 'week': return renderWeekView();
        case 'day': return renderDayView();
        case 'agenda': return renderAgendaView();
        default: return renderMonthView();
      }
    } catch (error) {
      console.error('Error rendering calendar view:', viewType, error);
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="text-red-600 mb-2">Error loading calendar view</div>
            <Button 
              onClick={() => {
                setViewType('month');
                setDepartmentFilter('all');
                setTeamFilter('all');
                setStatusFilter('all');
              }}
              variant="outline"
            >
              Reset Calendar
            </Button>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="min-h-screen flex bg-gray-50" data-testid="calendar-page">
      <Sidebar />
      
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="relative bg-white w-64 shadow-lg">
            <Sidebar />
          </div>
        </div>
      )}
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          title="Calendar" 
          onMobileMenuToggle={() => setIsMobileMenuOpen(true)}
        />
        
        <main className="flex-1 overflow-hidden p-6 pb-20 lg:pb-6">
          {/* Technician subtitle */}
          {isTechnician && (
            <p className="text-sm text-muted-foreground mb-4">
              View your assigned jobs by day, week or month.
            </p>
          )}

          {/* Calendar Controls */}
          <div className="mb-6 space-y-4">
            {/* Top Controls */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigateDate('prev')}
                    data-testid="prev-date"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline" 
                    size="sm"
                    onClick={() => setCurrentDate(new Date())}
                    data-testid="today-button"
                  >
                    Today
                  </Button>
                  <Button
                    variant="outline"
                    size="sm" 
                    onClick={() => navigateDate('next')}
                    data-testid="next-date"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                {viewType === 'day' ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button 
                        variant="ghost" 
                        className="text-xl font-semibold text-gray-900 hover:bg-gray-100 h-auto p-2"
                        data-testid="date-picker-trigger"
                      >
                        <CalendarIcon className="h-4 w-4 mr-2" />
                        {getViewTitle()}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={currentDate}
                        onSelect={(date) => {
                          if (date) {
                            setCurrentDate(date);
                          }
                        }}
                        initialFocus
                        data-testid="date-picker-calendar"
                      />
                    </PopoverContent>
                  </Popover>
                ) : (
                  <h2 className="text-xl font-semibold text-gray-900">{getViewTitle()}</h2>
                )}
              </div>

              <div className="flex items-center space-x-2">
                {/* Daily Department Card Button — coordinators/admin only */}
                {!isTechnician && (
                  <Link href="/daily-department-card">
                    <Button
                      variant="outline"
                      className="text-blue-600 border-blue-600 hover:bg-blue-50"
                      data-testid="daily-department-card"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Print Daily Schedule
                    </Button>
                  </Link>
                )}
                
                {/* Create Appointment Button — coordinators/admin only */}
                {!isTechnician && (
                  <Button
                    onClick={() => setIsCreateDialogOpen(true)}
                    className="bg-green-600 hover:bg-green-700 text-white"
                    data-testid="create-appointment"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Appointment
                  </Button>
                )}

                {/* View Tabs */}
                <Tabs value={viewType} onValueChange={(value) => setViewType(value as ViewType)}>
                  <TabsList>
                    <TabsTrigger value="month" data-testid="month-view">Month</TabsTrigger>
                    <TabsTrigger value="week" data-testid="week-view">Week</TabsTrigger>
                    <TabsTrigger value="day" data-testid="day-view">Day</TabsTrigger>
                    <TabsTrigger value="agenda" data-testid="agenda-view">Agenda</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col lg:flex-row lg:items-center space-y-2 lg:space-y-0 lg:space-x-4">
              <div className="flex items-center space-x-2">
                <Search className="h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search events..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-64"
                  data-testid="search-events"
                />
              </div>

              <Select value={departmentFilter} onValueChange={onDepartmentChange}>
                <SelectTrigger className="w-48" data-testid="department-filter">
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.filter(d => ["div-1","div-2","div-3","div-4"].includes(d.id)).map(department => (
                    <SelectItem key={department.id} value={department.id}>
                      {department.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={teamFilter} onValueChange={setTeamFilter}>
                <SelectTrigger className="w-48" data-testid="team-filter">
                  <SelectValue placeholder="All Teams" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Teams</SelectItem>
                  {teamOptions.map(t => {
                    const dept = departments.find(d => d.id === t.departmentId);
                    return (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}{departmentFilter === "all" && dept ? ` (${dept.name})` : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48" data-testid="status-filter">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="scheduled">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block" />
                      Scheduled
                    </span>
                  </SelectItem>
                  <SelectItem value="in_progress">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                      In Progress
                    </span>
                  </SelectItem>
                  <SelectItem value="completed">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
                      Completed
                    </span>
                  </SelectItem>
                  <SelectItem value="cancelled">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
                      Cancelled
                    </span>
                  </SelectItem>
                  <SelectItem value="pending">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 inline-block" />
                      Pending
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* Status Colour Legend */}
              <div className="hidden lg:flex items-center gap-2.5 flex-wrap bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
                <span className="text-xs text-gray-500 font-medium shrink-0">Legend:</span>
                {[
                  { label: 'Scheduled / To Do', color: '#f97316' },
                  { label: 'In Progress', color: '#3b82f6' },
                  { label: 'Completed', color: '#22c55e' },
                  { label: 'Cancelled', color: '#ef4444' },
                  { label: 'Pending', color: '#eab308' },
                  { label: 'Unassigned', color: '#9ca3af' },
                  { label: 'Overdue', color: '#dc2626' },
                ].map(({ label, color }) => (
                  <div key={label} className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-xs text-gray-600">{label}</span>
                  </div>
                ))}
              </div>

              {/* Hour View Toggle for Day View */}
              {viewType === 'day' && (
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium">View:</label>
                  <Button
                    variant={showAllHours ? "outline" : "default"}
                    size="sm"
                    onClick={() => setShowAllHours(!showAllHours)}
                    data-testid="hour-view-toggle"
                  >
                    <Clock className="h-4 w-4 mr-2" />
                    {showAllHours ? "Full Day (24 Hours)" : "Business Hours (7AM-5PM)"}
                  </Button>
                </div>
              )}

            </div>
          </div>

          {/* Calendar View */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm h-[calc(100vh-240px)] overflow-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              renderCurrentView()
            )}
          </div>

          {/* Event Details Dialog */}
          <Dialog open={isEventDialogOpen} onOpenChange={setIsEventDialogOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center space-x-2">
                  <div 
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: selectedEvent?.color }}
                  ></div>
                  <span>{selectedEvent?.title}</span>
                </DialogTitle>
              </DialogHeader>
              
              {selectedEvent && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <Label className="font-medium">Date</Label>
                      <p>{format(selectedEvent.startTime, 'MMM d, yyyy')}</p>
                    </div>
                    <div>
                      <Label className="font-medium">Time</Label>
                      <p>{format(selectedEvent.startTime, 'HH:mm')} - {format(selectedEvent.endTime, 'HH:mm')}</p>
                    </div>
                    <div>
                      <Label className="font-medium">Type</Label>
                      <p className="capitalize">{selectedEvent.type}</p>
                    </div>
                    <div>
                      <Label className="font-medium">Status</Label>
                      <Badge className={getStatusColor(selectedEvent.status)} variant="secondary">
                        {selectedEvent.status.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </div>
                  </div>

                  {selectedEvent.location && (
                    <div>
                      <Label className="font-medium">Location</Label>
                      <p className="text-sm text-gray-600">{selectedEvent.location}</p>
                    </div>
                  )}

                  {selectedEvent.description && (
                    <div>
                      <Label className="font-medium">Description</Label>
                      <p className="text-sm text-gray-600">{selectedEvent.description}</p>
                    </div>
                  )}

                  {selectedEvent.workerId && (
                    <div>
                      <Label className="font-medium">Assigned Worker</Label>
                      <p className="text-sm text-gray-600">
                        {workers.find(w => w.id === selectedEvent.workerId)?.name || 'Unknown Worker'}
                      </p>
                    </div>
                  )}

                  {selectedEvent.clientId && (
                    <div>
                      <Label className="font-medium">Client</Label>
                      <p className="text-sm text-gray-600">
                        {clients.find(c => c.id === selectedEvent.clientId)?.name || 'Unknown Client'}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Create Appointment Dialog */}
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Appointment</DialogTitle>
                <DialogDescription>Schedule a new appointment or meeting</DialogDescription>
              </DialogHeader>
              <Form {...appointmentForm}>
                <form onSubmit={appointmentForm.handleSubmit(handleCreateAppointment)} className="space-y-4">
                  <FormField
                    control={appointmentForm.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input placeholder="Appointment title" {...field} data-testid="appointment-title" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={appointmentForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Appointment description" {...field} data-testid="appointment-description" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={appointmentForm.control}
                    name="departmentId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Department</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="appointment-department">
                              <SelectValue placeholder="Select department" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {departments.filter(d => ["div-1","div-2","div-3","div-4"].includes(d.id)).map(department => (
                              <SelectItem key={department.id} value={department.id}>
                                {department.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={appointmentForm.control}
                      name="startDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} data-testid="appointment-date" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={appointmentForm.control}
                      name="startTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Time</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} data-testid="appointment-time" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={appointmentForm.control}
                    name="duration"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Duration (minutes)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="15" 
                            step="15" 
                            {...field} 
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                            data-testid="appointment-duration" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={appointmentForm.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="appointment-priority">
                              <SelectValue placeholder="Select priority" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={appointmentForm.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Appointment location" {...field} data-testid="appointment-location" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end space-x-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createAppointmentMutation.isPending}
                      data-testid="create-appointment-submit"
                    >
                      {createAppointmentMutation.isPending ? "Creating..." : "Create Appointment"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          {/* Edit Job Dialog */}
          <Dialog open={isEditJobDialogOpen} onOpenChange={setIsEditJobDialogOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Edit Job</DialogTitle>
                <DialogDescription>Update job details and schedule</DialogDescription>
              </DialogHeader>
              <Form {...jobEditForm}>
                <form onSubmit={jobEditForm.handleSubmit(handleUpdateJob)} className="space-y-4">
                  <FormField
                    control={jobEditForm.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Job Title</FormLabel>
                        <FormControl>
                          <Input placeholder="Job title" {...field} data-testid="job-title" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={jobEditForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Job description" {...field} data-testid="job-description" />
                        </FormControl>
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
                          <FormControl>
                            <Input type="date" {...field} data-testid="job-date" />
                          </FormControl>
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
                          <FormControl>
                            <Input type="time" {...field} data-testid="job-time" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={jobEditForm.control}
                      name="clientId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Client</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="job-client">
                                <SelectValue placeholder="Select client" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {clients.filter(c => c.status !== "suspended").map(client => (
                                <SelectItem key={client.id} value={client.id}>
                                  {client.name}
                                </SelectItem>
                              ))}
                              {clients.some(c => c.status === "suspended") && (
                                <div className="px-2 py-1.5 text-xs text-muted-foreground border-t mt-1">
                                  {clients.filter(c => c.status === "suspended").length} suspended client(s) hidden
                                </div>
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={jobEditForm.control}
                      name="workerId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Worker (Optional)</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="job-worker">
                                <SelectValue placeholder="Select worker" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="unassigned">Unassigned</SelectItem>
                              {workers.map(worker => (
                                <SelectItem key={worker.id} value={worker.id}>
                                  {worker.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={jobEditForm.control}
                      name="departmentId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Department</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="job-department">
                                <SelectValue placeholder="Select department" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {departments.filter(d => ["div-1","div-2","div-3","div-4"].includes(d.id)).map(department => (
                                <SelectItem key={department.id} value={department.id}>
                                  {department.name}
                                </SelectItem>
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
                              <SelectTrigger data-testid="job-status">
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
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
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={jobEditForm.control}
                      name="estimatedDuration"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Duration (minutes)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min="15" 
                              step="15" 
                              {...field} 
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                              data-testid="job-duration" 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={jobEditForm.control}
                      name="priority"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Priority</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="job-priority">
                                <SelectValue placeholder="Select priority" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={jobEditForm.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Job location" {...field} data-testid="job-location" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end space-x-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsEditJobDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={updateJobMutation.isPending}
                      data-testid="update-job-submit"
                    >
                      {updateJobMutation.isPending ? "Updating..." : "Update Job"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </main>
      </div>

      <MobileNavigation />
    </div>
  );
}