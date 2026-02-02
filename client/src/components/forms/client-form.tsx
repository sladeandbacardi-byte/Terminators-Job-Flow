import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import type { Client, Department } from "@shared/schema";

const clientFormSchema = z.object({
  name: z.string().min(1, "Company name is required"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  contactPerson: z.string().optional(),
  businessType: z.string().optional(),
  status: z.enum(["active", "inactive", "suspended"]),
  departmentId: z.string().min(1, "Department is required"),
  taxNumber: z.string().optional(),
  paymentTerms: z.string().optional(),
  creditLimit: z.number().min(0).optional(),
  notes: z.string().optional(),
});

type ClientFormData = z.infer<typeof clientFormSchema>;

interface ClientFormProps {
  client?: Client;
  onSubmit: (data: ClientFormData) => void;
  onCancel: () => void;
}

export function ClientForm({ client, onSubmit, onCancel }: ClientFormProps) {
  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      name: client?.name || "",
      email: client?.email || "",
      phone: client?.phone || "",
      address: client?.address || "",
      contactPerson: client?.contactPerson || "",
      businessType: client?.businessType || "",
      status: (client?.status as "active" | "inactive" | "suspended") || "active",
      departmentId: client?.departmentId || "",
      taxNumber: client?.taxNumber || "",
      paymentTerms: client?.paymentTerms || "",
      creditLimit: client?.creditLimit ? parseFloat(String(client.creditLimit)) : undefined,
      notes: client?.notes || "",
    },
  });

  const handleSubmit = (data: ClientFormData) => {
    const submitData = {
      ...data,
      email: data.email || null,
      phone: data.phone || null,
      address: data.address || null,
      contactPerson: data.contactPerson || null,
      businessType: data.businessType || null,
      taxNumber: data.taxNumber || null,
      paymentTerms: data.paymentTerms || null,
      creditLimit: data.creditLimit !== undefined ? String(data.creditLimit) : null,
      notes: data.notes || null,
    };
    onSubmit(submitData);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm">Company Name *</FormLabel>
                <FormControl>
                  <Input placeholder="Enter company name" {...field} data-testid="input-company-name" className="h-8 text-sm" />
                </FormControl>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="businessType"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm">Business Type</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Restaurant, Office, Retail" {...field} data-testid="input-business-type" className="h-8 text-sm" />
                </FormControl>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="contactPerson"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm">Contact Person</FormLabel>
                <FormControl>
                  <Input placeholder="Enter contact person name" {...field} data-testid="input-contact-person" className="h-8 text-sm" />
                </FormControl>
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
                  <Input type="email" placeholder="Enter email address" {...field} data-testid="input-email" className="h-8 text-sm" />
                </FormControl>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm">Phone</FormLabel>
                <FormControl>
                  <Input placeholder="Enter phone number" {...field} data-testid="input-phone" className="h-8 text-sm" />
                </FormControl>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm">Status *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-status" className="h-8 text-sm">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="departmentId"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm">Department *</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-department" className="h-8 text-sm">
                    <SelectValue placeholder="Select department" />
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
              <FormMessage className="text-xs" />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm">Address</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Enter full business address" 
                  {...field} 
                  data-testid="textarea-address"
                  className="min-h-[60px] text-sm py-1"
                />
              </FormControl>
              <FormMessage className="text-xs" />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="taxNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm">Tax Number</FormLabel>
                <FormControl>
                  <Input placeholder="Enter tax/VAT number" {...field} data-testid="input-tax-number" className="h-8 text-sm" />
                </FormControl>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="creditLimit"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm">Credit Limit</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    placeholder="Enter credit limit" 
                    {...field}
                    onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                    value={field.value || ""}
                    data-testid="input-credit-limit"
                    className="h-8 text-sm"
                  />
                </FormControl>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="paymentTerms"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm">Payment Terms</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Net 30, Cash on Delivery" {...field} data-testid="input-payment-terms" className="h-8 text-sm" />
              </FormControl>
              <FormMessage className="text-xs" />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm">Notes</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Additional notes" 
                  {...field} 
                  data-testid="textarea-notes"
                  className="min-h-[60px] text-sm py-1"
                />
              </FormControl>
              <FormMessage className="text-xs" />
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-2 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onCancel} data-testid="button-cancel">
            Cancel
          </Button>
          <Button type="submit" size="sm" data-testid="button-submit">
            {client ? "Update Client" : "Create Client"}
          </Button>
        </div>
      </form>
    </Form>
  );
}