import { useState, useEffect } from "react";
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
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, User } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Client, Department } from "@shared/schema";

const clientFormSchema = z.object({
  name: z.string().min(1, "Company name is required"),
  tradingName: z.string().optional(),
  email: z.string().email("Must be a valid email").optional().or(z.literal("")),
  alternateEmailAddress: z.string().email("Must be a valid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  alternatePhoneNumber: z.string().optional(),
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
  // Financial / legal
  taxNumber: z.string().optional(),
  companyRegistrationNumber: z.string().optional(),
  paymentTerms: z.string().optional(),
  creditLimit: z.number().min(0).optional(),
  // Billing contact
  billingName: z.string().optional(),
  billingEmail: z.string().email("Must be a valid email").optional().or(z.literal("")),
  billingPhone: z.string().optional(),
  notes: z.string().optional(),
  sageCustomerCode: z.string().optional(),
  hasRentalContract: z.boolean().optional().default(false),
  rentalContractStatus: z.enum(["Active", "Inactive", "None"]).optional().default("None"),
  rentalContractType: z.string().optional(),
  rentalNotes: z.string().optional(),
});

type ClientFormData = z.infer<typeof clientFormSchema>;

interface ClientFormProps {
  client?: Client;
  onSubmit: (data: ClientFormData) => void | Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
  allClients?: Client[];
}

export function ClientForm({ client, onSubmit, onCancel, isSubmitting = false, allClients }: ClientFormProps) {
  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  const { data: fetchedClients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    enabled: !allClients,
  });

  const clients = allClients ?? fetchedClients;

  const [duplicates, setDuplicates] = useState<Client[]>([]);
  const [duplicatesDismissed, setDuplicatesDismissed] = useState(false);

  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      name: client?.name || "",
      tradingName: (client as any)?.tradingName || "",
      email: client?.email || "",
      alternateEmailAddress: (client as any)?.alternateEmailAddress || "",
      phone: client?.phone || "",
      alternatePhoneNumber: (client as any)?.alternatePhoneNumber || "",
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
      companyRegistrationNumber: (client as any)?.companyRegistrationNumber || "",
      paymentTerms: client?.paymentTerms || "",
      creditLimit: client?.creditLimit ? parseFloat(String(client.creditLimit)) : undefined,
      billingName: (client as any)?.billingName || "",
      billingEmail: (client as any)?.billingEmail || "",
      billingPhone: (client as any)?.billingPhone || "",
      notes: client?.notes || "",
      sageCustomerCode: (client as any)?.sageCustomerCode || "",
      hasRentalContract: (client as any)?.hasRentalContract ?? false,
      rentalContractStatus: ((client as any)?.rentalContractStatus as "Active" | "Inactive" | "None") || "None",
      rentalContractType: (client as any)?.rentalContractType || "",
      rentalNotes: (client as any)?.rentalNotes || "",
    },
  });

  // Watch fields for duplicate detection (only for new clients)
  const watchedName = form.watch("name");
  const watchedPhone = form.watch("phone");
  const watchedEmail = form.watch("email");
  const watchedStreetNumber = form.watch("streetNumber");
  const watchedStreetName = form.watch("streetName");
  const watchedSuburb = form.watch("suburb");

  useEffect(() => {
    if (client) return; // skip duplicate check when editing
    setDuplicatesDismissed(false);

    const norm = (s?: string | null) => (s || "").toLowerCase().trim();
    const found = clients.filter((c) => {
      if (watchedName && norm(c.name) === norm(watchedName)) return true;
      if (watchedPhone && watchedPhone.length >= 7 && norm(c.phone) === norm(watchedPhone)) return true;
      if (watchedEmail && watchedEmail.includes("@") && norm(c.email) === norm(watchedEmail)) return true;
      if (
        watchedStreetNumber && watchedStreetName && watchedSuburb &&
        norm(c.streetNumber) === norm(watchedStreetNumber) &&
        norm(c.streetName) === norm(watchedStreetName) &&
        norm(c.suburb) === norm(watchedSuburb)
      ) return true;
      return false;
    });
    setDuplicates(found);
  }, [watchedName, watchedPhone, watchedEmail, watchedStreetNumber, watchedStreetName, watchedSuburb, clients, client]);

  const handleSubmit = (data: ClientFormData) => {
    const submitData: any = {
      ...data,
      tradingName: data.tradingName || undefined,
      email: data.email || undefined,
      alternateEmailAddress: data.alternateEmailAddress || undefined,
      phone: data.phone || undefined,
      alternatePhoneNumber: data.alternatePhoneNumber || undefined,
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
      companyRegistrationNumber: data.companyRegistrationNumber || undefined,
      paymentTerms: data.paymentTerms || undefined,
      creditLimit: data.creditLimit !== undefined ? String(data.creditLimit) : undefined,
      billingName: data.billingName || undefined,
      billingEmail: data.billingEmail || undefined,
      billingPhone: data.billingPhone || undefined,
      notes: data.notes || undefined,
      sageCustomerCode: data.sageCustomerCode || undefined,
      hasRentalContract: !!data.hasRentalContract,
      rentalContractStatus: data.hasRentalContract ? (data.rentalContractStatus === "None" ? "Active" : data.rentalContractStatus) : "None",
      rentalContractType: data.hasRentalContract ? (data.rentalContractType || undefined) : undefined,
      rentalNotes: data.hasRentalContract ? (data.rentalNotes || undefined) : undefined,
    };
    onSubmit(submitData);
  };

  const hasRental = form.watch("hasRentalContract");
  const legacyAddress = client?.address?.trim();
  const hasStructured =
    form.watch("streetNumber") || form.watch("streetName") || form.watch("suburb") ||
    form.watch("city") || form.watch("province") || form.watch("postalCode");

  const showDuplicateWarning = !client && !duplicatesDismissed && duplicates.length > 0;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">

        {/* ── Duplicate Warning ─────────────────────────────────────── */}
        {showDuplicateWarning && (
          <div className="border border-amber-300 bg-amber-50 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Possible existing client{duplicates.length > 1 ? "s" : ""} found
            </div>
            <p className="text-xs text-amber-700">A client with a matching name, phone, email, or address already exists. Do you want to use the existing client instead?</p>
            <div className="space-y-1">
              {duplicates.map((d) => (
                <div key={d.id} className="flex items-center gap-2 text-xs bg-white border border-amber-200 rounded p-2">
                  <User className="h-3 w-3 text-amber-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{d.name}</span>
                    {d.contactPerson && <span className="text-muted-foreground ml-1">· {d.contactPerson}</span>}
                    {d.phone && <span className="text-muted-foreground ml-1">· {d.phone}</span>}
                    {d.email && <span className="text-muted-foreground ml-1">· {d.email}</span>}
                    {(d.suburb || d.city) && <span className="text-muted-foreground ml-1">· {[d.suburb, d.city].filter(Boolean).join(", ")}</span>}
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">{d.status}</Badge>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="button" size="sm" variant="outline" className="text-xs h-7 border-amber-300 text-amber-800 hover:bg-amber-100" onClick={() => setDuplicatesDismissed(true)}>
                Continue creating new client
              </Button>
            </div>
          </div>
        )}

        {/* ── Business Details ──────────────────────────────────────── */}
        <div className="border rounded-lg p-3 space-y-3 bg-gray-50/50">
          <h4 className="text-sm font-semibold text-gray-700">Business Details</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">Business / Company Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter company name" {...field} data-testid="input-company-name" className="h-8 text-sm" />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="tradingName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">Trading Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Trading name (if different)" {...field} className="h-8 text-sm" />
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
            <FormField
              control={form.control}
              name="departmentId"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
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
          </div>
        </div>

        {/* ── Contact Details ───────────────────────────────────────── */}
        <div className="border rounded-lg p-3 space-y-3 bg-gray-50/50">
          <h4 className="text-sm font-semibold text-gray-700">Contact Details</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="contactPerson"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">Contact Person</FormLabel>
                  <FormControl>
                    <Input placeholder="Primary contact name" {...field} data-testid="input-contact-person" className="h-8 text-sm" />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">Phone Number</FormLabel>
                  <FormControl>
                    <Input placeholder="Primary phone number" {...field} data-testid="input-phone" className="h-8 text-sm" />
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
                  <FormLabel className="text-sm">Email Address</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="Primary email address" {...field} data-testid="input-email" className="h-8 text-sm" />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="alternatePhoneNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">Alternate Phone</FormLabel>
                  <FormControl>
                    <Input placeholder="Alternate phone number" {...field} className="h-8 text-sm" />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="alternateEmailAddress"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel className="text-sm">Alternate Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="Alternate email address" {...field} className="h-8 text-sm" />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* ── Address Section ───────────────────────────────────────── */}
        <div className="border rounded-lg p-3 space-y-3 bg-gray-50/50">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-700">Physical Address</h4>
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

        {/* ── Billing Contact ───────────────────────────────────────── */}
        <div className="border rounded-lg p-3 space-y-3 bg-gray-50/50">
          <h4 className="text-sm font-semibold text-gray-700">Billing Contact</h4>
          <p className="text-xs text-muted-foreground -mt-1">Leave blank if same as main contact above.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <FormField
              control={form.control}
              name="billingName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">Billing Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Billing contact name" {...field} className="h-8 text-sm" />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="billingEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">Billing Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="Billing email address" {...field} className="h-8 text-sm" />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="billingPhone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">Billing Phone</FormLabel>
                  <FormControl>
                    <Input placeholder="Billing phone number" {...field} className="h-8 text-sm" />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* ── Financial & Legal ─────────────────────────────────────── */}
        <div className="border rounded-lg p-3 space-y-3 bg-gray-50/50">
          <h4 className="text-sm font-semibold text-gray-700">Financial & Legal</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="taxNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">VAT Number</FormLabel>
                  <FormControl>
                    <Input placeholder="VAT / Tax number" {...field} data-testid="input-tax-number" className="h-8 text-sm" />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="companyRegistrationNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">Company Reg. Number</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., 2023/123456/07" {...field} className="h-8 text-sm" />
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
                  <FormLabel className="text-sm">Credit Limit (R)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="0.00"
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
        </div>

        {/* ── Rental Contract ───────────────────────────────────────── */}
        <div className="border rounded-lg p-3 space-y-3 bg-blue-50/40">
          <h4 className="text-sm font-semibold text-gray-700">Rental Contract</h4>
          <p className="text-xs text-gray-500 -mt-2">
            Does this customer rent equipment (e.g. sanitary bins, dispensers) from us?
          </p>

          <FormField
            control={form.control}
            name="hasRentalContract"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm">Has Rental Contract?</FormLabel>
                <Select
                  value={field.value ? "yes" : "no"}
                  onValueChange={(v) => {
                    const yes = v === "yes";
                    field.onChange(yes);
                    if (!yes) {
                      form.setValue("rentalContractStatus", "None");
                      form.setValue("rentalContractType", "");
                      form.setValue("rentalNotes", "");
                    } else if (form.getValues("rentalContractStatus") === "None") {
                      form.setValue("rentalContractStatus", "Active");
                    }
                  }}
                >
                  <FormControl>
                    <SelectTrigger data-testid="select-has-rental" className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="no">No</SelectItem>
                    <SelectItem value="yes">Yes</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />

          {hasRental && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="rentalContractStatus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">Rental Contract Status</FormLabel>
                      <Select
                        value={field.value === "None" ? "Active" : field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-rental-status" className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Active">Active</SelectItem>
                          <SelectItem value="Inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="rentalContractType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">Rental Contract Type</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Sanitary bins, Soap dispensers" {...field} data-testid="input-rental-type" className="h-8 text-sm" />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="rentalNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">Rental Notes</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Anything relevant about the rental arrangement" {...field} data-testid="textarea-rental-notes" className="min-h-[50px] text-sm py-1" />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
            </>
          )}
        </div>

        {/* ── Notes ────────────────────────────────────────────────── */}
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm">Internal Notes</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Additional notes about this client"
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
