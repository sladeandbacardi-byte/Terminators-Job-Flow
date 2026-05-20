import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertJobSchema } from "@shared/schema";
import { SERVICE_TYPES, RECURRENCE_PERIODS, DAYS_OF_WEEK, DIARY_OPTIONS } from "@/lib/constants";
import type { Job, Client, Worker, Department } from "@shared/schema";
import { z } from "zod";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const jobFormSchema = insertJobSchema.extend({
  scheduledDate: z.date({
    required_error: "From date is required",
  }),
  price: z.union([z.string(), z.number(), z.null()]).optional(),
  pricePerUnit: z.union([z.string(), z.number(), z.null()]).optional(),
});

type JobFormData = z.infer<typeof jobFormSchema>;

interface JobFormProps {
  job?: Job | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function JobForm({ job, onSuccess, onCancel }: JobFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showNotesDialog, setShowNotesDialog] = useState(false);

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
  });

  const { data: workers = [] } = useQuery<Worker[]>({
    queryKey: ['/api/workers'],
  });

  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ['/api/departments'],
  });

  const form = useForm<JobFormData>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: {
      title: job?.title || "",
      description: job?.description || "",
      clientId: job?.clientId || "",
      workerId: job?.workerId || "",
      departmentId: job?.departmentId || "",
      serviceType: job?.serviceType || "",
      status: job?.status || "scheduled",
      scheduledDate: job ? new Date(job.scheduledDate) : new Date(),
      scheduledTime: job?.scheduledTime || "",
      priority: job?.priority || "medium",
      estimatedDuration: job?.estimatedDuration || 60,
      location: job?.location || "",
      notes: job?.notes || "",
      isRecurring: job?.isRecurring || false,
      recurringPattern: job?.recurringPattern || undefined,
      diary: job?.diary || "",
      howInvoiced: job?.howInvoiced || "",
      email: job?.email || "",
      areaCode: job?.areaCode || "",
      salesperson: job?.salesperson || "",
      contractNo: job?.contractNo || "",
      isContract: job?.isContract || false,
      service: job?.service || "",
      insects: job?.insects || "",
      price: job?.price || undefined,
      pricePerUnit: job?.pricePerUnit || undefined,
      increaseDate: job?.increaseDate || "",
      specialInstructions: job?.specialInstructions || "",
      internalInstructions: job?.internalInstructions || "",
      isFixed: job?.isFixed || false,
      orderNo: job?.orderNo || "",
      recurrenceInterval: job?.recurrenceInterval || undefined,
      recurrencePeriod: job?.recurrencePeriod || "",
      recurrenceDay: job?.recurrenceDay || "",
      recurrenceCount: job?.recurrenceCount || undefined,
      recurrenceYears: job?.recurrenceYears || undefined,
      googleMapsLink: job?.googleMapsLink || "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: JobFormData) => {
      const response = await apiRequest("POST", "/api/jobs", data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      toast({ description: "Job created successfully" });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        description: `Failed to create job: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: JobFormData) => apiRequest("PATCH", `/api/jobs/${job!.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      toast({ description: "Job updated successfully" });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        description: `Failed to update job: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: JobFormData) => {
    const client = clients.find(c => c.id === data.clientId);
    const dept = departments.find(d => d.id === data.departmentId);
    const autoTitle = data.title || `${dept?.name || "Service"} - ${client?.name || "Client"} - ${new Date(data.scheduledDate).toLocaleDateString()}`;
    const submitData = {
      ...data,
      title: autoTitle,
      price: data.price !== undefined ? String(data.price) : null,
      pricePerUnit: data.pricePerUnit !== undefined ? String(data.pricePerUnit) : null,
    };
    if (job) {
      updateMutation.mutate(submitData as any);
    } else {
      createMutation.mutate(submitData as any);
    }
  };

  const selectedDepartment = form.watch("departmentId");
  const availableWorkers = workers.filter(worker =>
    worker.isActive && (!selectedDepartment || worker.departmentId === selectedDepartment)
  );

  const isRecurring = form.watch("isRecurring");

  const selectedClient = clients.find(c => c.id === form.watch("clientId"));

  const buildServiceTypeLabel = () => {
    const dept = departments.find(d => d.id === selectedDepartment);
    const worker = workers.find(w => w.id === form.watch("workerId"));
    if (dept && worker) return `${dept.name.toUpperCase()} - ${worker.name.split(' ')[0].toUpperCase()}`;
    if (dept) return dept.name.toUpperCase();
    return "";
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" data-testid="job-form">
        {/* Section: Header */}
        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-3 uppercase tracking-wide">Header</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <FormField
              control={form.control}
              name="diary"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">Diary</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Select diary" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {DIARY_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <div>
              <label className="text-sm font-medium">Service Type</label>
              <div className="mt-1 h-8 flex items-center px-3 rounded-md border bg-gray-100 dark:bg-gray-800 text-sm font-medium">
                {buildServiceTypeLabel() || "Select department & worker"}
              </div>
            </div>

            <FormField
              control={form.control}
              name="howInvoiced"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">How Invoiced</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Monthly, Per Visit" {...field} value={field.value || ""} className="h-8 text-sm" />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Section: Client Info */}
        <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-green-800 dark:text-green-200 mb-3 uppercase tracking-wide">Client Info</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">Client Name *</FormLabel>
                  <Select onValueChange={(val) => {
                    field.onChange(val);
                    const client = clients.find(c => c.id === val);
                    if (client) {
                      form.setValue("email", client.email || "");
                      form.setValue("location", client.address || "");
                    }
                  }} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger className="h-8 text-sm" data-testid="select-client">
                        <SelectValue placeholder="Select a client" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {clients.filter((c) => c.status !== "suspended").map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                      {clients.some((c) => c.status === "suspended") && (
                        <div className="px-2 py-1.5 text-xs text-muted-foreground border-t mt-1">
                          {clients.filter((c) => c.status === "suspended").length} suspended client(s) hidden
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="Client email" {...field} value={field.value || ""} className="h-8 text-sm" />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">Service At (Location)</FormLabel>
                  <FormControl>
                    <Input placeholder="Service location" {...field} value={field.value || ""} className="h-8 text-sm" />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="googleMapsLink"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel className="text-sm">Google Maps Link</FormLabel>
                  <FormControl>
                    <Input
                      type="url"
                      placeholder="Paste Google Maps link (e.g. https://maps.app.goo.gl/...)"
                      {...field}
                      value={field.value || ""}
                      className="h-8 text-sm"
                      data-testid="input-google-maps-link"
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="areaCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">Area Code</FormLabel>
                  <FormControl>
                    <Input placeholder="Area code" {...field} value={field.value || ""} className="h-8 text-sm" />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="salesperson"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">Salesperson</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Select salesperson" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {workers
                        .filter(w => w.departmentId === "div-5" && w.isActive !== false)
                        .map(w => (
                          <SelectItem key={w.id} value={w.name}>{w.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contractNo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">Contract No.</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter or auto-generated" {...field} value={field.value || ""} className="h-8 text-sm" />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
          </div>

          <div className="mt-3">
            <FormField
              control={form.control}
              name="isContract"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel className="text-sm font-normal">Contract</FormLabel>
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Section: Service Details */}
        <div className="bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-orange-800 dark:text-orange-200 mb-3 uppercase tracking-wide">Service Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="departmentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">Department *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger className="h-8 text-sm" data-testid="select-department">
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {departments.filter(d => ["div-1","div-2","div-3","div-4"].includes(d.id)).map((department) => (
                        <SelectItem key={department.id} value={department.id}>
                          {department.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="workerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">Assigned Worker</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger className="h-8 text-sm" data-testid="select-worker">
                        <SelectValue placeholder="Select a worker" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableWorkers.map((worker) => (
                        <SelectItem key={worker.id} value={worker.id}>
                          {worker.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="serviceType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">Service Type *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger className="h-8 text-sm" data-testid="select-service-type">
                        <SelectValue placeholder="Select service type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {SERVICE_TYPES.map((service) => (
                        <SelectItem key={service} value={service}>
                          {service}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="service"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">Service</FormLabel>
                  <FormControl>
                    <Input placeholder="Service description" {...field} value={field.value || ""} className="h-8 text-sm" />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="insects"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">Insects</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Cockroaches, Rats, Ants" {...field} value={field.value || ""} className="h-8 text-sm" />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">Price (R)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...field}
                      value={field.value || ""}
                      onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                      className="h-8 text-sm"
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="pricePerUnit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">P.P.U (Per Unit)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...field}
                      value={field.value || ""}
                      onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                      className="h-8 text-sm"
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="increaseDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">Incr. Date</FormLabel>
                  <FormControl>
                    <Input
                      type="month"
                      {...field}
                      value={field.value || ""}
                      className="h-8 text-sm"
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
          </div>

          <div className="mt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowNotesDialog(true)}
              className="gap-2"
            >
              <StickyNote className="h-4 w-4" />
              Notes
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <FormField
              control={form.control}
              name="specialInstructions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">Special Instructions</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Instructions for the client..."
                      {...field}
                      value={field.value || ""}
                      className="min-h-[60px] text-sm"
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="internalInstructions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">Internal Instructions</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Internal notes for the team..."
                      {...field}
                      value={field.value || ""}
                      className="min-h-[60px] text-sm"
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Hidden title field - auto-generated */}
        <input type="hidden" {...form.register("title")} />

        {/* Section: Schedule */}
        <div className="bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-purple-800 dark:text-purple-200 mb-3 uppercase tracking-wide">Schedule</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <FormField
              control={form.control}
              name="scheduledDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="text-sm">From Date *</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "h-8 text-sm pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                          data-testid="input-scheduled-date"
                        >
                          {field.value ? (
                            new Date(field.value).toLocaleDateString()
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="estimatedDuration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">Duration</FormLabel>
                  <Select
                    value={String(field.value || 60)}
                    onValueChange={(v) => field.onChange(v === "custom" ? 60 : parseInt(v))}
                  >
                    <FormControl>
                      <SelectTrigger className="h-8 text-sm" data-testid="input-duration">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="30">30 min</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                      <SelectItem value="90">1.5 hours</SelectItem>
                      <SelectItem value="120">2 hours</SelectItem>
                      <SelectItem value="150">2.5 hours</SelectItem>
                      <SelectItem value="180">3 hours</SelectItem>
                      <SelectItem value="240">4 hours</SelectItem>
                      <SelectItem value="300">5 hours</SelectItem>
                      <SelectItem value="360">6 hours</SelectItem>
                      <SelectItem value="480">Full day (8 h)</SelectItem>
                      <SelectItem value="960">2 days</SelectItem>
                      <SelectItem value="1440">3 days</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="scheduledTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">Start Time</FormLabel>
                  <FormControl>
                    <Input
                      type="time"
                      {...field}
                      value={field.value || ""}
                      className="h-8 text-sm"
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="orderNo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">Order No.</FormLabel>
                  <FormControl>
                    <Input placeholder="Order number" {...field} value={field.value || ""} className="h-8 text-sm" />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
          </div>

          <div className="mt-3">
            <FormField
              control={form.control}
              name="isFixed"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel className="text-sm font-normal">Fixed</FormLabel>
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Section: Recurrence */}
        <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-3 uppercase tracking-wide">Recurrence</h3>

          <FormField
            control={form.control}
            name="isRecurring"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center space-x-2 space-y-0 mb-3">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    data-testid="checkbox-recurring"
                  />
                </FormControl>
                <FormLabel className="text-sm font-normal">Enable Recurring Schedule</FormLabel>
              </FormItem>
            )}
          />

          {isRecurring && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm">Every</span>
                <FormField
                  control={form.control}
                  name="recurrenceInterval"
                  render={({ field }) => (
                    <FormItem className="w-20">
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          {...field}
                          value={field.value || ""}
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                          className="h-8 text-sm"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <span className="text-sm">per</span>
                <FormField
                  control={form.control}
                  name="recurrencePeriod"
                  render={({ field }) => (
                    <FormItem className="w-48">
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Select period" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {RECURRENCE_PERIODS.map((period) => (
                            <SelectItem key={period.value} value={period.value}>
                              {period.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm">Specific Day:</span>
                <FormField
                  control={form.control}
                  name="recurrenceDay"
                  render={({ field }) => (
                    <FormItem className="w-40">
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Select day" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {DAYS_OF_WEEK.map((day) => (
                            <SelectItem key={day} value={day}>{day}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm">for</span>
                <FormField
                  control={form.control}
                  name="recurrenceCount"
                  render={({ field }) => (
                    <FormItem className="w-20">
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          placeholder="#"
                          {...field}
                          value={field.value || ""}
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                          className="h-8 text-sm"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <span className="text-sm">time(s) OR</span>
                <FormField
                  control={form.control}
                  name="recurrenceYears"
                  render={({ field }) => (
                    <FormItem className="w-20">
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          placeholder="#"
                          {...field}
                          value={field.value || ""}
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                          className="h-8 text-sm"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <span className="text-sm">year(s)</span>
              </div>
            </div>
          )}
        </div>

        {/* Section: Actions */}
        <div className="flex justify-end space-x-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={createMutation.isPending || updateMutation.isPending}
            data-testid="button-submit"
          >
            {createMutation.isPending || updateMutation.isPending ? "Saving..." : "OK"}
          </Button>
        </div>
      </form>

      {/* Notes Dialog */}
      <Dialog open={showNotesDialog} onOpenChange={setShowNotesDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Job Notes</DialogTitle>
          </DialogHeader>
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Textarea
                    placeholder="Enter job notes..."
                    {...field}
                    value={field.value || ""}
                    className="min-h-[200px] text-sm"
                    data-testid="input-notes"
                  />
                </FormControl>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />
          <div className="flex justify-end">
            <Button type="button" onClick={() => setShowNotesDialog(false)} size="sm">
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Form>
  );
}
