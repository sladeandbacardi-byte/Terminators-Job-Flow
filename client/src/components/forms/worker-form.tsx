import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertWorkerSchema } from "@shared/schema";
import type { Worker, Department } from "@shared/schema";
import { z } from "zod";

const workerFormSchema = insertWorkerSchema.extend({
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  leaveBalance: z.coerce.number().int().min(0).max(365).optional(),
});

type WorkerFormData = z.infer<typeof workerFormSchema>;

interface WorkerFormProps {
  worker?: Worker | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function WorkerForm({ worker, onSuccess, onCancel }: WorkerFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ['/api/departments'],
  });

  const form = useForm<WorkerFormData>({
    resolver: zodResolver(workerFormSchema),
    defaultValues: {
      name: worker?.name || "",
      email: worker?.email || "",
      phone: worker?.phone || "",
      role: worker?.role || "",
      departmentId: worker?.departmentId || "",
      isActive: worker?.isActive ?? true,
      idNumber: worker?.idNumber || "",
      startDate: worker?.startDate || "",
      emergencyContactName: worker?.emergencyContactName || "",
      emergencyContactPhone: worker?.emergencyContactPhone || "",
      leaveBalance: worker?.leaveBalance ?? 15,
    },
  });

  useEffect(() => {
    form.reset({
      name: worker?.name || "",
      email: worker?.email || "",
      phone: worker?.phone || "",
      role: worker?.role || "",
      departmentId: worker?.departmentId || "",
      isActive: worker?.isActive ?? true,
      idNumber: worker?.idNumber || "",
      startDate: worker?.startDate || "",
      emergencyContactName: worker?.emergencyContactName || "",
      emergencyContactPhone: worker?.emergencyContactPhone || "",
      leaveBalance: worker?.leaveBalance ?? 15,
    });
  }, [worker]);

  const createMutation = useMutation({
    mutationFn: (data: WorkerFormData) => apiRequest('POST', '/api/workers', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workers'] });
      toast({ title: "Success", description: "Worker created successfully" });
      onSuccess();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create worker", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: WorkerFormData) => apiRequest('PUT', `/api/workers/${worker!.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workers'] });
      toast({ title: "Success", description: "Worker updated successfully" });
      onSuccess();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update worker", variant: "destructive" });
    },
  });

  const onSubmit = (data: WorkerFormData) => {
    if (worker) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" data-testid="worker-form">
        <Tabs defaultValue="basic">
          <TabsList className="grid grid-cols-2 w-full mb-2">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="hr">HR Profile</TabsTrigger>
          </TabsList>

          {/* ── Basic Info ── */}
          <TabsContent value="basic" className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter worker's full name" {...field} data-testid="input-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Job Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Pest Control Operator" {...field} value={field.value ?? ""} data-testid="input-role" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="worker@terminators.co.za" {...field} data-testid="input-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="+27 41 123 4567" {...field} data-testid="input-phone" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="departmentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Department</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger data-testid="select-department">
                        <SelectValue placeholder="Select a department" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {departments.map((department) => (
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
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} data-testid="checkbox-active" />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Active Worker</FormLabel>
                    <p className="text-sm text-muted-foreground">Worker is available for job assignments</p>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </TabsContent>

          {/* ── HR Profile ── */}
          <TabsContent value="hr" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="idNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ID Number</FormLabel>
                    <FormControl>
                      <Input placeholder="SA ID number" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="emergencyContactName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Emergency Contact Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Next of kin / emergency contact" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="emergencyContactPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Emergency Contact Phone</FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="+27 82 000 0000" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="leaveBalance"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Annual Leave Balance (days remaining)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      max={365}
                      placeholder="15"
                      {...field}
                      value={field.value ?? 15}
                      onChange={e => field.onChange(parseInt(e.target.value) || 0)}
                    />
                  </FormControl>
                  <p className="text-xs text-gray-500">Number of annual leave days the employee has remaining</p>
                  <FormMessage />
                </FormItem>
              )}
            />
          </TabsContent>
        </Tabs>

        <div className="flex justify-end space-x-4 pt-2">
          <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel">
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={createMutation.isPending || updateMutation.isPending}
            data-testid="button-submit"
          >
            {createMutation.isPending || updateMutation.isPending ? "Saving..." : (worker ? "Update Worker" : "Add Worker")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
