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
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, Plus, X, Package, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertJobSchema } from "@shared/schema";
import { SERVICE_TYPES, JOB_PRIORITIES, RECURRING_PATTERNS } from "@/lib/constants";
import type { Job, Client, Worker, Division, InventoryItem, InsertJobInventoryItem } from "@shared/schema";
import { z } from "zod";
import { useState } from "react";

const jobFormSchema = insertJobSchema.extend({
  scheduledDate: z.date({
    required_error: "Scheduled date is required",
  }),
});

type JobFormData = z.infer<typeof jobFormSchema>;

interface SelectedInventoryItem {
  inventoryItem: InventoryItem;
  quantity: number;
  isRental: boolean;
  rentalStartDate?: Date;
  rentalEndDate?: Date;
  notes?: string;
}

interface JobFormProps {
  job?: Job | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function JobForm({ job, onSuccess, onCancel }: JobFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedItems, setSelectedItems] = useState<SelectedInventoryItem[]>([]);
  const [showItemSelector, setShowItemSelector] = useState(false);
  const [itemSearchTerm, setItemSearchTerm] = useState("");
  const [itemDivisionFilter, setItemDivisionFilter] = useState("all");

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
  });

  const { data: workers = [] } = useQuery<Worker[]>({
    queryKey: ['/api/workers'],
  });

  const { data: divisions = [] } = useQuery<Division[]>({
    queryKey: ['/api/divisions'],
  });

  const { data: inventoryItems = [] } = useQuery<InventoryItem[]>({
    queryKey: ['/api/inventory'],
  });

  const form = useForm<JobFormData>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: {
      title: job?.title || "",
      description: job?.description || "",
      clientId: job?.clientId || "",
      workerId: job?.workerId || "",
      divisionId: job?.divisionId || "",
      serviceType: job?.serviceType || "",
      status: job?.status || "pending",
      scheduledDate: job ? new Date(job.scheduledDate) : new Date(),
      priority: job?.priority || "medium",
      estimatedDuration: job?.estimatedDuration || 0,
      location: job?.location || "",
      notes: job?.notes || "",
      isRecurring: job?.isRecurring || false,
      recurringPattern: job?.recurringPattern || undefined,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: JobFormData) => {
      // First create the job
      const response = await apiRequest('/api/jobs', 'POST', data);
      const createdJob = response as any;
      
      // Then create job inventory items if any are selected
      if (selectedItems.length > 0) {
        for (const selectedItem of selectedItems) {
          const jobInventoryItem: InsertJobInventoryItem = {
            jobId: createdJob.id,
            inventoryItemId: selectedItem.inventoryItem.id,
            quantity: selectedItem.quantity.toString(),
            unitPrice: selectedItem.inventoryItem.unitPrice || "0",
            notes: selectedItem.notes || "",
            isRental: selectedItem.isRental,
            rentalStartDate: selectedItem.rentalStartDate,
            rentalEndDate: selectedItem.rentalEndDate
          };
          await apiRequest('/api/job-inventory', 'POST', jobInventoryItem);
        }
      }
      
      return createdJob;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/job-inventory'] });
      toast({
        title: "Success",
        description: "Job created successfully with selected equipment",
      });
      onSuccess();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create job",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: JobFormData) => apiRequest(`/api/jobs/${job!.id}`, 'PATCH', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      toast({
        title: "Success",
        description: "Job updated successfully",
      });
      onSuccess();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update job",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: JobFormData) => {
    if (job) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const selectedDivision = form.watch("divisionId");
  const availableWorkers = workers.filter(worker => 
    worker.isActive && (!selectedDivision || worker.divisionId === selectedDivision)
  );

  const isRecurring = form.watch("isRecurring");

  // Helper functions for inventory selection
  const addInventoryItem = (item: InventoryItem) => {
    const exists = selectedItems.find(selected => selected.inventoryItem.id === item.id);
    if (exists) {
      toast({
        title: "Item already added",
        description: "This item is already selected for this job",
        variant: "destructive",
      });
      return;
    }

    const newItem: SelectedInventoryItem = {
      inventoryItem: item,
      quantity: 1,
      isRental: item.type === 'rental_equipment',
      rentalStartDate: item.type === 'rental_equipment' ? new Date() : undefined,
      rentalEndDate: item.type === 'rental_equipment' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : undefined, // 30 days default
      notes: ""
    };

    setSelectedItems([...selectedItems, newItem]);
    setShowItemSelector(false);
  };

  const removeInventoryItem = (itemId: string) => {
    setSelectedItems(selectedItems.filter(item => item.inventoryItem.id !== itemId));
  };

  const updateInventoryItem = (itemId: string, updates: Partial<SelectedInventoryItem>) => {
    setSelectedItems(selectedItems.map(item => 
      item.inventoryItem.id === itemId ? { ...item, ...updates } : item
    ));
  };

  // Enhanced filtering for inventory items with search and division filter
  const availableInventory = inventoryItems.filter(item => {
    // Search filter - matches name, description, or SKU
    const matchesSearch = itemSearchTerm === "" || 
      item.name.toLowerCase().includes(itemSearchTerm.toLowerCase()) ||
      item.description?.toLowerCase().includes(itemSearchTerm.toLowerCase()) ||
      item.sku.toLowerCase().includes(itemSearchTerm.toLowerCase());
    
    // Division filter
    const matchesDivision = itemDivisionFilter === "all" || 
      item.divisionId === itemDivisionFilter ||
      !item.divisionId; // Include unassigned items
    
    return matchesSearch && matchesDivision;
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" data-testid="job-form">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">
            {job ? "Edit Job" : "Create New Job"}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Job Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter job title" {...field} data-testid="input-title" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-client">
                        <SelectValue placeholder="Select a client" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {clients.map((client) => (
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
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="divisionId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Division</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-division">
                        <SelectValue placeholder="Select a division" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {divisions.map((division) => (
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
              control={form.control}
              name="workerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assigned Worker</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                    <FormControl>
                      <SelectTrigger data-testid="select-worker">
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
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="serviceType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Service Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-service-type">
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
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Priority</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-priority">
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="scheduledDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Scheduled Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                          data-testid="input-scheduled-date"
                        >
                          {field.value ? (
                            formatDateTime(field.value)
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
                        disabled={(date) =>
                          date < new Date(new Date().setHours(0, 0, 0, 0))
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="estimatedDuration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estimated Duration (minutes)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="120" 
                      {...field}
                      value={field.value || ""}
                      onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : 0)}
                      data-testid="input-duration"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Location</FormLabel>
                <FormControl>
                  <Input placeholder="Enter job location" {...field} value={field.value || ""} data-testid="input-location" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Enter job description" 
                    className="min-h-[100px]" 
                    {...field} 
                    value={field.value || ""}
                    data-testid="input-description"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Additional notes or instructions" 
                    {...field} 
                    value={field.value || ""}
                    data-testid="input-notes"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Inventory Selection Section */}
          <div className="space-y-4 border-t pt-6">
            <div className="flex items-center justify-between">
              <h3 className="text-md font-medium">Equipment & Consumables</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowItemSelector(true)}
                data-testid="button-add-inventory"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Items
              </Button>
            </div>

            {selectedItems.length > 0 && (
              <div className="space-y-3">
                {selectedItems.map((selectedItem) => (
                  <div key={selectedItem.inventoryItem.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Package className="h-5 w-5 text-blue-500" />
                        <div>
                          <p className="font-medium">{selectedItem.inventoryItem.name}</p>
                          <p className="text-sm text-muted-foreground">{selectedItem.inventoryItem.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={selectedItem.isRental ? "default" : "secondary"}>
                          {selectedItem.isRental ? "Rental" : "Consumable"}
                        </Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeInventoryItem(selectedItem.inventoryItem.id)}
                          data-testid={`button-remove-${selectedItem.inventoryItem.id}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="text-sm font-medium">Quantity</label>
                        <Input
                          type="number"
                          min="1"
                          value={selectedItem.quantity}
                          onChange={(e) => updateInventoryItem(selectedItem.inventoryItem.id, { 
                            quantity: parseInt(e.target.value) || 1 
                          })}
                          data-testid={`input-quantity-${selectedItem.inventoryItem.id}`}
                        />
                      </div>
                      
                      {selectedItem.isRental && (
                        <>
                          <div>
                            <label className="text-sm font-medium">Rental Start Date</label>
                            <Input
                              type="date"
                              value={selectedItem.rentalStartDate?.toISOString().split('T')[0] || ""}
                              onChange={(e) => updateInventoryItem(selectedItem.inventoryItem.id, {
                                rentalStartDate: e.target.value ? new Date(e.target.value) : undefined
                              })}
                              data-testid={`input-start-date-${selectedItem.inventoryItem.id}`}
                            />
                          </div>
                          
                          <div>
                            <label className="text-sm font-medium">Rental End Date</label>
                            <Input
                              type="date"
                              value={selectedItem.rentalEndDate?.toISOString().split('T')[0] || ""}
                              onChange={(e) => updateInventoryItem(selectedItem.inventoryItem.id, {
                                rentalEndDate: e.target.value ? new Date(e.target.value) : undefined
                              })}
                              data-testid={`input-end-date-${selectedItem.inventoryItem.id}`}
                            />
                          </div>
                        </>
                      )}
                    </div>

                    <div>
                      <label className="text-sm font-medium">Notes</label>
                      <Textarea
                        placeholder="Additional notes for this item..."
                        value={selectedItem.notes || ""}
                        onChange={(e) => updateInventoryItem(selectedItem.inventoryItem.id, { 
                          notes: e.target.value 
                        })}
                        data-testid={`textarea-notes-${selectedItem.inventoryItem.id}`}
                        className="resize-none"
                        rows={2}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Inventory Item Selector Dialog */}
            {showItemSelector && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Select Products & Services</h3>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowItemSelector(false);
                        setItemSearchTerm("");
                        setItemDivisionFilter("all");
                      }}
                      data-testid="button-close-selector"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {/* Search and Filter Controls */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        placeholder="Search products/services by name, description, or SKU..."
                        value={itemSearchTerm}
                        onChange={(e) => setItemSearchTerm(e.target.value)}
                        className="pl-10"
                        data-testid="input-search-items"
                      />
                    </div>
                    <Select value={itemDivisionFilter} onValueChange={setItemDivisionFilter}>
                      <SelectTrigger data-testid="select-division-filter">
                        <SelectValue placeholder="Filter by division" />
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
                  </div>
                  
                  {/* Results counter */}
                  <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
                    <span>
                      {availableInventory.length} product{availableInventory.length !== 1 ? 's' : ''} 
                      {itemSearchTerm && ` matching "${itemSearchTerm}"`}
                    </span>
                    {itemSearchTerm && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setItemSearchTerm("")}
                        className="h-6 px-2 text-xs"
                      >
                        Clear search
                      </Button>
                    )}
                  </div>
                  
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {availableInventory.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">
                        {itemSearchTerm ? 
                          `No products or services found matching "${itemSearchTerm}"` : 
                          "No products or services available for the selected division."
                        }
                      </p>
                    ) : (
                      availableInventory.map((item) => (
                        <div
                          key={item.id}
                          className="border rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                          onClick={() => addInventoryItem(item)}
                          data-testid={`inventory-item-${item.id}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <Package className="h-4 w-4 text-blue-500" />
                              <div>
                                <p className="font-medium">{item.name}</p>
                                <p className="text-sm text-muted-foreground">{item.description}</p>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <span>Stock: {item.quantity}</span>
                                  <span>•</span>
                                  <span>SKU: {item.sku}</span>
                                  {item.divisionId && (
                                    <>
                                      <span>•</span>
                                      <span className="text-blue-600 font-medium">
                                        {divisions.find(d => d.id === item.divisionId)?.name || 'Unknown Division'}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <Badge variant={item.type === 'rental_equipment' ? "default" : "secondary"}>
                                {item.type === 'rental_equipment' ? 'Rental' : 'Consumable'}
                              </Badge>
                              {item.unitPrice && (
                                <p className="text-sm font-medium mt-1">R {item.unitPrice}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <FormField
            control={form.control}
            name="isRecurring"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    data-testid="checkbox-recurring"
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Recurring Job</FormLabel>
                  <p className="text-sm text-muted-foreground">
                    This job will repeat according to the selected pattern
                  </p>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          {isRecurring && (
            <FormField
              control={form.control}
              name="recurringPattern"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Recurring Pattern</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                    <FormControl>
                      <SelectTrigger data-testid="select-recurring-pattern">
                        <SelectValue placeholder="Select recurring pattern" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        <div className="flex justify-end space-x-4">
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
            {createMutation.isPending || updateMutation.isPending ? "Saving..." : (job ? "Update Job" : "Create Job")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
