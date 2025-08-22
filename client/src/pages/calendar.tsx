import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameDay, isSameMonth, isToday, addWeeks, subWeeks, addMonths, subMonths, startOfDay, endOfDay, addHours } from "date-fns";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import MobileNavigation from "@/components/layout/mobile-nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
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
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Job, Client, Worker, Division } from "@shared/schema";

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
  divisionId?: string;
  location?: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  color?: string;
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
  divisionId: z.string().optional(),
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
  divisionId: z.string().min(1, "Division is required"),
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
  const [divisionFilter, setDivisionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [draggedEvent, setDraggedEvent] = useState<CalendarEvent | null>(null);
  const dragCounter = useRef(0);

  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  const { data: divisions = [] } = useQuery<Division[]>({
    queryKey: ['/api/divisions'],
  });

  const { data: workers = [] } = useQuery<Worker[]>({
    queryKey: ['/api/workers'],
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
  });

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

      console.log(`Moving event ${eventId} to ${newDate}`);

      if (event.type === 'job') {
        const job = jobs.find(j => j.id === eventId);
        if (!job) throw new Error('Job not found');
        
        const response = await apiRequest('PATCH', `/api/jobs/${eventId}`, { scheduledDate: newDate });
        console.log('Job move response:', response);
        return response;
      } else {
        return apiRequest('PATCH', `/api/calendar/events/${eventId}`, { scheduledDate: newDate });
      }
    },
    onSuccess: async (data, variables) => {
      console.log('Move successful, invalidating queries and refetching');
      
      // Force immediate refetch instead of just invalidation
      await queryClient.refetchQueries({ queryKey: ['/api/jobs'] });
      await queryClient.refetchQueries({ queryKey: ['/api/calendar/events'] });
      
      // Check if event was moved to a different month
      const movedToDate = new Date(variables.newDate);
      const movedToMonth = format(movedToDate, 'yyyy-MM');
      const currentMonth = format(currentDate, 'yyyy-MM');
      
      console.log(`Event moved from ${currentMonth} to ${movedToMonth}`);
      
      if (movedToMonth !== currentMonth) {
        // Only navigate if event moved to a different month
        console.log('Navigating to new month:', movedToMonth);
        setCurrentDate(movedToDate);
        toast({ 
          title: "Event moved to " + format(movedToDate, 'MMMM yyyy'),
          description: "Calendar updated to show the new date"
        });
      } else {
        // Event stayed in same month - just show success message
        console.log('Event moved within same month');
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
    
    const endTime = new Date(scheduledDate.getTime() + (job.estimatedDuration || 60) * 60000);
    
    // Debug logging for job conversion
    if (job.id === 'job-9') {
      console.log(`Converting job-9: scheduled date = ${job.scheduledDate}, parsed date = ${scheduledDate.toISOString()}`);
    }
    
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
      divisionId: job.divisionId,
      location: job.location || (client ? client.address : '') || undefined,
      status: job.status as 'scheduled' | 'in_progress' | 'completed' | 'cancelled',
      color: getPriorityColor(job.priority),
    };
  }).filter(Boolean) as CalendarEvent[];

  // Debug: Log job events and current month
  const currentMonthStr = format(currentDate, 'yyyy-MM');
  const eventsThisMonth = jobEvents.filter(e => format(e.startTime, 'yyyy-MM') === currentMonthStr);
  console.log(`Calendar showing month: ${currentMonthStr}`);
  console.log(`Total job events: ${jobEvents.length}, Events this month: ${eventsThisMonth.length}`);
  console.log('Events this month:', eventsThisMonth.map(e => ({ id: e.id, title: e.title.split(' - ')[0], date: format(e.startTime, 'yyyy-MM-dd') })));

  const allEvents = [...events, ...jobEvents];

  const filteredEvents = allEvents.filter(event => {
    const matchesSearch = event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (event.description && event.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesDivision = divisionFilter === "all" || event.divisionId === divisionFilter;
    const matchesStatus = statusFilter === "all" || event.status === statusFilter;
    
    return matchesSearch && matchesDivision && matchesStatus;
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
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
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
          divisionId: job.divisionId,
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

  const handleDrop = (e: React.DragEvent, targetDate: Date) => {
    e.preventDefault();
    dragCounter.current = 0;
    
    if (draggedEvent && targetDate && !isNaN(targetDate.getTime())) {
      try {
        const newDate = new Date(targetDate);
        
        // Preserve the original time when moving the event
        if (draggedEvent.startTime && !isNaN(draggedEvent.startTime.getTime())) {
          newDate.setHours(draggedEvent.startTime.getHours());
          newDate.setMinutes(draggedEvent.startTime.getMinutes());
          newDate.setSeconds(draggedEvent.startTime.getSeconds());
        } else {
          // Default to 9 AM if startTime is invalid
          newDate.setHours(9);
          newDate.setMinutes(0);
          newDate.setSeconds(0);
        }
        
        console.log(`Dropping event ${draggedEvent.id} on ${format(targetDate, 'yyyy-MM-dd')} at ${format(newDate, 'HH:mm')}`);
        
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
        return format(currentDate, 'EEEE, MMMM d, yyyy');
      case 'agenda':
        return 'Upcoming Events';
      default:
        return '';
    }
  };

  const getEventsForDate = (date: Date) => {
    return filteredEvents.filter(event => 
      isSameDay(event.startTime, date)
    );
  };

  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const rows = [];
    let days = [];
    let day = startDate;

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        const dayEvents = getEventsForDate(day);
        const isCurrentMonth = isSameMonth(day, currentDate);
        const isCurrentDay = isToday(day);

        days.push(
          <div
            key={day.toString()}
            className={cn(
              "min-h-[120px] p-2 border border-gray-200 cursor-pointer hover:bg-gray-50",
              !isCurrentMonth && "bg-gray-100 text-gray-400",
              isCurrentDay && "bg-blue-50 border-blue-300"
            )}
            onClick={() => setCurrentDate(day)}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, day)}
          >
            <div className={cn(
              "text-sm font-medium mb-1",
              isCurrentDay && "text-blue-600"
            )}>
              {format(day, 'd')}
            </div>
            <div className="space-y-1">
              {dayEvents.slice(0, 3).map((event, index) => (
                <div
                  key={event.id}
                  className="text-xs p-1 rounded cursor-pointer hover:opacity-80 group relative"
                  style={{ backgroundColor: event.color + '20', color: event.color }}
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
      rows.push(
        <div key={day.toString()} className="grid grid-cols-7">
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
    const weekStart = startOfWeek(currentDate);
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const hours = Array.from({ length: 24 }, (_, i) => i);

    return (
      <div className="flex flex-col h-full">
        {/* Week header */}
        <div className="grid grid-cols-8 border-b bg-gray-50">
          <div className="p-3 border-r"></div>
          {weekDays.map(day => (
            <div key={day.toString()} className="p-3 text-center border-r border-gray-200 last:border-r-0">
              <div className="font-medium">{format(day, 'EEE')}</div>
              <div className={cn(
                "text-lg",
                isToday(day) ? "text-blue-600 font-bold" : "text-gray-900"
              )}>
                {format(day, 'd')}
              </div>
            </div>
          ))}
        </div>

        {/* Time grid */}
        <div className="flex-1 overflow-auto">
          {hours.map(hour => (
            <div key={hour} className="grid grid-cols-8 border-b border-gray-100">
              <div className="p-2 text-xs text-gray-500 border-r bg-gray-50 text-right">
                {format(new Date().setHours(hour, 0), 'HH:mm')}
              </div>
              {weekDays.map(day => {
                const dayHourEvents = filteredEvents.filter(event => 
                  isSameDay(event.startTime, day) && 
                  event.startTime.getHours() === hour
                );
                
                return (
                  <div key={`${day}-${hour}`} className="min-h-[60px] p-1 border-r border-gray-100 last:border-r-0 relative"
                    onDragOver={handleDragOver}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => {
                      const dropDate = new Date(day);
                      dropDate.setHours(hour, 0, 0, 0);
                      handleDrop(e, dropDate);
                    }}
                  >
                    {dayHourEvents.map(event => (
                      <div
                        key={event.id}
                        className="absolute left-1 right-1 top-1 text-xs p-1 rounded cursor-pointer hover:opacity-80 group"
                        style={{ backgroundColor: event.color + '20', color: event.color }}
                        draggable
                        onDragStart={(e) => handleDragStart(e, event)}
                        onDragEnd={handleDragEnd}
                        onClick={() => handleEventClick(event)}
                      >
                        <div className="font-medium truncate">{event.title}</div>
                        <div className="text-gray-600 truncate">
                          {format(event.startTime, 'HH:mm')} - {format(event.endTime, 'HH:mm')}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    const dayEvents = getEventsForDate(currentDate).sort((a, b) => 
      a.startTime.getTime() - b.startTime.getTime()
    );
    const hours = Array.from({ length: 24 }, (_, i) => i);

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
            <div key={hour} className="h-16 border-b border-gray-100"></div>
          ))}
          
          {/* Events overlay */}
          {dayEvents.map(event => {
            const startHour = event.startTime.getHours();
            const startMinute = event.startTime.getMinutes();
            const duration = (event.endTime.getTime() - event.startTime.getTime()) / (1000 * 60);
            const top = (startHour * 64) + (startMinute * 64 / 60);
            const height = (duration * 64 / 60);

            return (
              <div
                key={event.id}
                className="absolute left-2 right-2 p-2 rounded cursor-pointer hover:opacity-80"
                style={{ 
                  top: `${top}px`, 
                  height: `${height}px`,
                  backgroundColor: event.color + '20',
                  color: event.color,
                  minHeight: '40px'
                }}
                onClick={() => {
                  setSelectedEvent(event);
                  setIsEventDialogOpen(true);
                }}
              >
                <div className="font-medium text-sm">{event.title}</div>
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
          })}
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
    switch (viewType) {
      case 'month': return renderMonthView();
      case 'week': return renderWeekView();
      case 'day': return renderDayView();
      case 'agenda': return renderAgendaView();
      default: return renderMonthView();
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
                <h2 className="text-xl font-semibold text-gray-900">{getViewTitle()}</h2>
              </div>

              <div className="flex items-center space-x-2">
                {/* Create Appointment Button */}
                <Button
                  onClick={() => setIsCreateDialogOpen(true)}
                  className="bg-green-600 hover:bg-green-700 text-white"
                  data-testid="create-appointment"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Appointment
                </Button>

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

              <Select value={divisionFilter} onValueChange={setDivisionFilter}>
                <SelectTrigger className="w-48" data-testid="division-filter">
                  <SelectValue placeholder="All Divisions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Divisions</SelectItem>
                  {divisions.map(division => (
                    <SelectItem key={division.id} value={division.id}>
                      {division.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48" data-testid="status-filter">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Calendar View */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm h-[calc(100vh-280px)] overflow-hidden">
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
                              {clients.map(client => (
                                <SelectItem key={client.id} value={client.id}>
                                  {client.name}
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
                      name="divisionId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Division</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="job-division">
                                <SelectValue placeholder="Select division" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {divisions.map(division => (
                                <SelectItem key={division.id} value={division.id}>
                                  {division.name}
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