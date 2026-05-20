import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
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
  contactPerson: z.string().optional(),
  businessType: z.string().optional(),
  status: z.enum(["active", "inactive", "suspended"]),
  departmentId: z.string().min(1, "Department is required"),
  // Structured address fields
  streetNumber: z.string().optional(),
  streetName: z.string().optional(),
  suburb: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  postalCode: z.string().optional(),
  googleMapsLink: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  taxNumber: z.string().optional(),
  paymentTerms: z.string().optional(),
  creditLimit: z.number().min(0).optional(),
  notes: z.string().optional(),
  sageCustomerCode: z.string().optional(),
});

type ClientFormData = z.infer<typeof clientFormSchema>;

interface ClientFormProps {
  client?: Client;
  onSubmit: (data: ClientFormData) => void | Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function ClientForm({ client, onSubmit, onCancel, isSubmitting = false }: ClientFormProps) {
  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      name: client?.name || "",
      email: client?.email || "",
      phone: client?.phone || "",
      contactPerson: client?.contactPerson || "",
      businessType: client?.businessType || "",
      status: (client?.status as "active" | "inactive" | "suspended") || "active",
      departmentId: client?.departmentId || "",
      streetNumber: client?.streetNumber || "",
      streetName: client?.streetName || "",
      suburb: client?.suburb || "",
      city: client?.city || "",
      province: client?.province || "",
      postalCode: client?.postalCode || "",
      googleMapsLink: client?.googleMapsLink || "",
      taxNumber: client?.taxNumber || "",
      paymentTerms: client?.paymentTerms || "",
      creditLimit: client?.creditLimit ? parseFloat(String(client.creditLimit)) : undefined,
      notes: client?.notes || "",
      sageCustomerCode: (client as any)?.sageCustomerCode || "",
    },
  });

  const handleSubmit = (data: ClientFormData) => {
    // Strip blanks so empty strings don't overwrite existing values unnecessarily
    const submitData: any = {
      ...data,
      email: data.email || undefined,
      phone: data.phone || undefined,
      contactPerson: data.contactPerson || undefined,
      businessType: data.businessType || undefined,
      streetNumber: data.streetNumber || undefined,
      streetName: data.streetName || undefined,
      suburb: data.suburb || undefined,
      city: data.city || undefined,
      province: data.province || undefined,
      postalCode: data.postalCode || undefined,
      googleMapsLink: data.googleMapsLink || undefined,
      taxNumber: data.taxNumber || undefined,
      paymentTerms: data.paymentTerms || undefined,
      creditLimit: data.creditLimit !== undefined ? String(data.creditLimit) : undefined,
      notes: data.notes || undefined,
      sageCustomerCode: data.sageCustomerCode || undefined,
    };
    onSubmit(submitData);
  };

  const legacyAddress = client?.address?.trim();
  const hasStructured =
    form.watch("streetNumber") || form.watch("streetName") || form.watch("suburb") ||
    form.watch("city") || form.watch("province") || form.watch("postalCode");

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

        {/* ── Address Section ─────────────────────────────────────────── */}
        <div className="border rounded-lg p-3 space-y-3 bg-gray-50/50">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-700">Address</h4>
            {legacyAddress && !hasStructured && (
              <span className="text-xs text-amber-600">
                Legacy address present — fill the fields below to replace it
              </span>
            )}
          </div>

          {legacyAddress && (
            <div className="text-xs bg-amber-50 border border-amber-200 rounded p-2">
              <span className="font-semibold text-amber-800">Old Address (legacy): </span>
              <span className="text-amber-700 whitespace-pre-line">{legacyAddress}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <FormField
              control={form.control}
              name="streetNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">Street Number</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., 42" {...field} data-testid="input-street-number" className="h-8 text-sm" />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="streetName"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel className="text-sm">Street Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Main Road" {...field} data-testid="input-street-name" className="h-8 text-sm" />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="suburb"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">Suburb / Area</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Sandton" {...field} data-testid="input-suburb" className="h-8 text-sm" />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">City / Town</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Johannesburg" {...field} data-testid="input-city" className="h-8 text-sm" />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="province"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">Province</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Gauteng" {...field} data-testid="input-province" className="h-8 text-sm" />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="postalCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">Postal Code</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., 2196" {...field} data-testid="input-postal-code" className="h-8 text-sm" />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="googleMapsLink"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm">Google Maps Link (optional)</FormLabel>
                <FormControl>
                  <Input
                    placeholder="https://maps.google.com/?q=..."
                    {...field}
                    data-testid="input-google-maps-link"
                    className="h-8 text-sm"
                  />
                </FormControl>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />
        </div>

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
            name="sageCustomerCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm">Sage Customer Code</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., CUST001" {...field} className="h-8 text-sm" />
                </FormControl>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
        </div>

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
          <Button type="button" variant="outline" size="sm" onClick={onCancel} data-testid="button-cancel" disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" size="sm" data-testid="button-submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : client ? "Update Client" : "Create Client"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
