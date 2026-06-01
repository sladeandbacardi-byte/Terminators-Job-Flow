import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertJobSchema, formatClientAddress } from "@shared/schema";
import type { Job, Client, Worker, Department, ServiceContract } from "@shared/schema";
import { z } from "zod";

// ── Constants ──────────────────────────────────────────────────────────────────

const JOB_SERVICE_TYPES = [
  { value: "pest_control",   label: "Pest Control" },
  { value: "sanitary_bins",  label: "Sanitary Bins" },
  { value: "washroom",       label: "Washroom Service" },
  { value: "washroom_refills", label: "Washroom Refills" },
  { value: "dustmats",       label: "Dustmats" },
  { value: "deep_cleaning",  label: "Deep Cleaning" },
  { value: "wood_borer_coc", label: "Wood Borer COC" },
  { value: "electrical_coc", label: "Electrical COC" },
  { value: "other",          label: "Other" },
];

const PEST_TYPES = [
  { value: "rodents",                   label: "Rodents" },
  { value: "cockroaches",               label: "Cockroaches" },
  { value: "ants",                      label: "Ants" },
  { value: "fleas",                     label: "Fleas" },
  { value: "flies",                     label: "Flies" },
  { value: "bed_bugs",                  label: "Bed Bugs" },
  { value: "termites",                  label: "Termites" },
  { value: "wood_borer",                label: "Wood Borer" },
  { value: "birds",                     label: "Birds" },
  { value: "stored_product_insects",    label: "Stored Product Insects" },
  { value: "other",                     label: "Other" },
];

const TREATMENT_TYPES = [
  { value: "inspection",      label: "Inspection" },
  { value: "treatment",       label: "Treatment" },
  { value: "follow_up",       label: "Follow-up" },
  { value: "monitoring",      label: "Monitoring" },
  { value: "baiting",         label: "Baiting" },
  { value: "fumigation",      label: "Fumigation" },
  { value: "spray_treatment", label: "Spray Treatment" },
  { value: "gel_treatment",   label: "Gel Treatment" },
  { value: "dust_treatment",  label: "Dust Treatment" },
  { value: "proofing",        label: "Proofing" },
  { value: "coc_inspection",  label: "COC Inspection" },
  { value: "other",           label: "Other" },
];

const INVOICE_STATUSES = [
  { value: "not_invoiced",      label: "Not Ready" },
  { value: "ready_to_invoice",  label: "Ready to Invoice" },
  { value: "invoiced",          label: "Invoiced" },
  { value: "do_not_invoice",    label: "Do Not Invoice" },
];

const JOB_STATUSES   = ["scheduled", "in_progress", "completed", "cancelled", "pending"];
const JOB_PRIORITIES = ["low", "medium", "high", "urgent"];

// ── Schema ────────────────────────────────────────────────────────────────────

const jobFormSchema = insertJobSchema.extend({
  scheduledDate: z.date({ required_error: "Date is required" }),
  price:        z.union([z.string(), z.number(), z.null()]).optional(),
  pricePerUnit: z.union([z.string(), z.number(), z.null()]).optional(),
  quantity:     z.union([z.string(), z.number(), z.null()]).optional(),
});

type JobFormData = z.infer<typeof jobFormSchema>;

interface JobFormProps {
  job?: Job | null;
  onSuccess: () => void;
  onCancel: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function JobForm({ job, onSuccess, onCancel }: JobFormProps) {
  const { toast }        = useToast();
  const queryClient      = useQueryClient();
  const [activeTab, setActiveTab]     = useState("details");
  const [manualTotal, setManualTotal] = useState(false);

  const { data: clients     = [] } = useQuery<Client[]>    ({ queryKey: ["/api/clients"]          });
  const { data: workers     = [] } = useQuery<Worker[]>    ({ queryKey: ["/api/workers"]          });
  const { data: departments = [] } = useQuery<Department[]>({ queryKey: ["/api/departments"]      });
  const { data: contracts   = [] } = useQuery<ServiceContract[]>({ queryKey: ["/api/service-contracts"] });

  const jAny = job as any;

  const form = useForm<JobFormData>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: {
      title:              job?.title ?? "",
      description:        job?.description ?? "",
      clientId:           job?.clientId ?? "",
      workerId:           job?.workerId ?? "",
      departmentId:       job?.departmentId ?? "",
      serviceType:        job?.serviceType ?? "",
      status:             job?.status ?? "scheduled",
      scheduledDate:      job ? new Date(job.scheduledDate) : new Date(),
      scheduledTime:      job?.scheduledTime ?? "",
      priority:           job?.priority ?? "medium",
      estimatedDuration:  job?.estimatedDuration ?? 60,
      location:           job?.location ?? "",
      googleMapsLink:     job?.googleMapsLink ?? "",
      contractNo:         job?.contractNo ?? "",
      specialInstructions: job?.specialInstructions ?? "",
      internalInstructions: job?.internalInstructions ?? "",
      insects:            job?.insects ?? "",
      service:            job?.service ?? "",
      notes:              job?.notes ?? "",
      completionNotes:    job?.completionNotes ?? "",
      invoiceStatus:      job?.invoiceStatus ?? "not_invoiced",
      price:              job?.price ?? undefined,
      pricePerUnit:       job?.pricePerUnit ?? undefined,
      orderNo:            job?.orderNo ?? "",
      jobNumber:          job?.jobNumber ?? "",
      // New fields
      serviceCategory:            jAny?.serviceCategory ?? "",
      treatmentType:              jAny?.treatmentType ?? "",
      otherPestType:              jAny?.otherPestType ?? "",
      quantity:                   jAny?.quantity ?? "1",
      vatIncluded:                jAny?.vatIncluded ?? false,
      mustBeInvoiced:             jAny?.mustBeInvoiced !== false,
      invoiceRef:                 jAny?.invoiceRef ?? "",
      financeNotes:               jAny?.financeNotes ?? "",
      linkedContractId:           jAny?.linkedContractId ?? "",
      completionAllUnitsChecked:  jAny?.completionAllUnitsChecked ?? "",
      completionExtraFaultFound:  jAny?.completionExtraFaultFound ?? false,
      completionCustomerSignature: jAny?.completionCustomerSignature ?? "",
    } as any,
  });

  const watchDeptId         = form.watch("departmentId");
  const watchServiceType    = form.watch("serviceType");
  const watchStatus         = form.watch("status");
  const watchPestType       = form.watch("insects");
  const watchQty            = form.watch("quantity" as any);
  const watchUnitPrice      = form.watch("pricePerUnit");
  const watchMustInvoice    = form.watch("mustBeInvoiced" as any);
  const watchExtraFault     = form.watch("completionExtraFaultFound" as any);
  const watchAllUnits       = form.watch("completionAllUnitsChecked" as any);

  const isPestControl = useMemo(
    () => watchServiceType === "pest_control" ||
      watchDeptId === "div-1" ||
      (departments.find(d => d.id === watchDeptId)?.name ?? "").toLowerCase().includes("pest"),
    [watchServiceType, watchDeptId, departments],
  );

  const availableWorkers = useMemo(
    () => workers.filter(w => w.isActive !== false && (!watchDeptId || w.departmentId === watchDeptId)),
    [workers, watchDeptId],
  );

  const clientContracts = useMemo(() => {
    const cId = form.watch("clientId");
    if (!cId) return [];
    return contracts.filter(c => (c as any).customerId === cId && c.activeStatus);
  }, [contracts, form.watch("clientId")]);

  // Auto-calculate total price
  useEffect(() => {
    if (!manualTotal) {
      const qty  = parseFloat(String(watchQty ?? "1")) || 0;
      const unit = parseFloat(String(watchUnitPrice ?? "0")) || 0;
      if (qty > 0 && unit > 0) {
        form.setValue("price" as any, String((qty * unit).toFixed(2)));
      }
    }
  }, [watchQty, watchUnitPrice, manualTotal]);

  // Auto-set invoice status
  useEffect(() => {
    const mustInv     = form.getValues("mustBeInvoiced" as any);
    const curInvStatus = form.getValues("invoiceStatus");
    if (!mustInv) {
      form.setValue("invoiceStatus", "do_not_invoice");
    } else if (watchStatus === "completed" && mustInv && curInvStatus === "not_invoiced") {
      form.setValue("invoiceStatus", "ready_to_invoice");
    }
  }, [watchMustInvoice, watchStatus]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/jobs", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ description: "Job created successfully" });
      onSuccess();
    },
    onError: (e: Error) => toast({ description: `Failed to create job: ${e.message}`, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/jobs/${job!.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ description: "Job updated successfully" });
      onSuccess();
    },
    onError: (e: Error) => toast({ description: `Failed to update job: ${e.message}`, variant: "destructive" }),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const onSubmit = (data: JobFormData) => {
    const client = clients.find(c => c.id === data.clientId);
    const dept   = departments.find(d => d.id === data.departmentId);
    const autoTitle = data.title ||
      `${dept?.name ?? "Service"} - ${client?.name ?? "Client"} - ${new Date(data.scheduledDate).toLocaleDateString()}`;
    const payload = {
      ...data,
      title:        autoTitle,
      price:        data.price        != null ? String(data.price)        : null,
      pricePerUnit: data.pricePerUnit != null ? String(data.pricePerUnit) : null,
    };
    if (job) updateMutation.mutate(payload);
    else     createMutation.mutate(payload);
  };

  // ── JSX ─────────────────────────────────────────────────────────────────────
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="details"    className="text-xs sm:text-sm">Job Details</TabsTrigger>
            <TabsTrigger value="service"    className="text-xs sm:text-sm">Service</TabsTrigger>
            <TabsTrigger value="pricing"    className="text-xs sm:text-sm">Pricing</TabsTrigger>
            <TabsTrigger value="completion" className="text-xs sm:text-sm">Completion</TabsTrigger>
          </TabsList>

          {/* ── TAB 1 · Job Details ─────────────────────────────────────── */}
          <TabsContent value="details" className="pt-3 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

              <FormField control={form.control} name="clientId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Client *</FormLabel>
                  <Select onValueChange={(val) => {
                    field.onChange(val);
                    const c = clients.find(x => x.id === val);
                    if (c) {
                      form.setValue("location", formatClientAddress(c) ?? "");
                      form.setValue("googleMapsLink", c.googleMapsLink ?? "");
                    }
                  }} value={field.value ?? ""}>
                    <FormControl>
                      <SelectTrigger data-testid="select-client"><SelectValue placeholder="Choose client" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {clients.filter(c => c.status !== "suspended").map(c =>
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="departmentId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Department *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                    <FormControl>
                      <SelectTrigger data-testid="select-department"><SelectValue placeholder="Choose department" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {departments.filter(d => ["div-1","div-2","div-3","div-4"].includes(d.id)).map(d =>
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="workerId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Technician / Worker</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                    <FormControl>
                      <SelectTrigger data-testid="select-worker"><SelectValue placeholder="Choose worker" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">— Unassigned —</SelectItem>
                      {availableWorkers.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? "scheduled"}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {JOB_STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="scheduledDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Date *</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      value={field.value ? new Date(field.value).toISOString().split("T")[0] : ""}
                      onChange={e => field.onChange(e.target.value ? new Date(e.target.value) : new Date())}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="scheduledTime" render={({ field }) => (
                <FormItem>
                  <FormLabel>Time</FormLabel>
                  <FormControl>
                    <Input type="time" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="priority" render={({ field }) => (
                <FormItem>
                  <FormLabel>Priority</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? "medium"}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {JOB_PRIORITIES.map(p => <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="estimatedDuration" render={({ field }) => (
                <FormItem>
                  <FormLabel>Duration (min)</FormLabel>
                  <FormControl>
                    <Input
                      type="number" min={15} step={15}
                      {...field} value={field.value ?? ""}
                      onChange={e => field.onChange(parseInt(e.target.value) || undefined)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="location" render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Location / Address</FormLabel>
                  <FormControl>
                    <Input placeholder="Service address" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="googleMapsLink" render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Google Maps Link</FormLabel>
                  <FormControl>
                    <Input
                      type="url" placeholder="https://maps.app.goo.gl/…"
                      {...field} value={field.value ?? ""}
                      data-testid="input-google-maps-link"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>Job Title <span className="text-xs text-gray-400 font-normal">(auto-generated if blank)</span></FormLabel>
                  <FormControl>
                    <Input placeholder="Leave blank to auto-generate" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="contractNo" render={({ field }) => (
                <FormItem>
                  <FormLabel>Contract No.</FormLabel>
                  <FormControl>
                    <Input placeholder="Contract reference" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="Job description" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

            </div>
          </TabsContent>

          {/* ── TAB 2 · Service Details ──────────────────────────────────── */}
          <TabsContent value="service" className="pt-3 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

              <FormField control={form.control} name="serviceType" render={({ field }) => (
                <FormItem>
                  <FormLabel>Service Type *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                    <FormControl>
                      <SelectTrigger data-testid="select-service-type"><SelectValue placeholder="Choose service type" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {JOB_SERVICE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name={"serviceCategory" as any} render={({ field }) => (
                <FormItem>
                  <FormLabel>Service Category</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Residential, Commercial" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Pest Type — only for Pest Control */}
              {isPestControl && (
                <FormField control={form.control} name="insects" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pest / Insect Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Choose pest type" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PEST_TYPES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              )}

              {/* Other Pest — shown when "other" chosen */}
              {isPestControl && watchPestType === "other" && (
                <FormField control={form.control} name={"otherPestType" as any} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Other Pest / Insect Type</FormLabel>
                    <FormControl>
                      <Input placeholder="Describe pest type" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              )}

              {/* Treatment Type — only for Pest Control */}
              {isPestControl && (
                <FormField control={form.control} name={"treatmentType" as any} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Treatment Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Choose treatment type" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TREATMENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              )}

              <FormField control={form.control} name="specialInstructions" render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Special Instructions <span className="text-xs text-gray-400 font-normal">(client-visible)</span></FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="Instructions visible to client" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="internalInstructions" render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Internal Notes <span className="text-xs text-gray-400 font-normal">(team-only)</span></FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="Notes for the team — not visible to client" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {clientContracts.length > 0 && (
                <FormField control={form.control} name={"linkedContractId" as any} render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Linked Service Contract <span className="text-xs text-gray-400 font-normal">(optional)</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Link to a contract (optional)" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">— None —</SelectItem>
                        {clientContracts.map(c => (
                          <SelectItem key={c.id} value={c.id}>
                            {(c as any).contractNumber ?? c.id} — {c.serviceType}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              )}

            </div>
          </TabsContent>

          {/* ── TAB 3 · Pricing / Invoicing ─────────────────────────────── */}
          <TabsContent value="pricing" className="pt-3 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">

              <FormField control={form.control} name={"quantity" as any} render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity</FormLabel>
                  <FormControl>
                    <Input
                      type="number" min={0} step={0.01} placeholder="1"
                      {...field} value={field.value ?? ""}
                      onChange={e => { field.onChange(e.target.value); setManualTotal(false); }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="pricePerUnit" render={({ field }) => (
                <FormItem>
                  <FormLabel>Unit Price (R)</FormLabel>
                  <FormControl>
                    <Input
                      type="number" min={0} step={0.01} placeholder="0.00"
                      {...field} value={field.value ?? ""}
                      onChange={e => { field.onChange(e.target.value); setManualTotal(false); }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name={"price" as any} render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Total Price (R)
                    {manualTotal && <span className="ml-1.5 text-xs text-amber-600 font-normal">⚠ overridden</span>}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number" min={0} step={0.01} placeholder="Auto-calculated"
                      {...field} value={field.value ?? ""}
                      onChange={e => { field.onChange(e.target.value); setManualTotal(true); }}
                    />
                  </FormControl>
                  {manualTotal && (
                    <p className="text-xs text-amber-600 mt-0.5">
                      Total has been manually overridden.{" "}
                      <button type="button" className="underline" onClick={() => setManualTotal(false)}>
                        Re-calculate
                      </button>
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )} />

              <div className="flex items-center gap-2 pt-4">
                <Switch
                  checked={!!form.watch("vatIncluded" as any)}
                  onCheckedChange={v => form.setValue("vatIncluded" as any, v)}
                />
                <Label className="font-normal text-sm cursor-pointer">VAT Included</Label>
              </div>

              <div className="flex items-center gap-2 pt-4">
                <Switch
                  checked={form.watch("mustBeInvoiced" as any) !== false}
                  onCheckedChange={v => form.setValue("mustBeInvoiced" as any, v)}
                />
                <Label className="font-normal text-sm cursor-pointer">Must Be Invoiced</Label>
              </div>

              <FormField control={form.control} name="invoiceStatus" render={({ field }) => (
                <FormItem>
                  <FormLabel>Invoice Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? "not_invoiced"}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {INVOICE_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name={"invoiceRef" as any} render={({ field }) => (
                <FormItem>
                  <FormLabel>Invoice Number / Ref</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. INV-2026-001" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name={"financeNotes" as any} render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Invoice / Finance Notes</FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="Notes for finance team" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

            </div>
          </TabsContent>

          {/* ── TAB 4 · Technician Completion ───────────────────────────── */}
          <TabsContent value="completion" className="pt-3 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

              <FormField control={form.control} name={"completionAllUnitsChecked" as any} render={({ field }) => (
                <FormItem>
                  <FormLabel>All Units Checked / Completed</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="yes">Yes — All units completed</SelectItem>
                      <SelectItem value="no">No — Not all units completed</SelectItem>
                      <SelectItem value="na">Not Applicable</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              {watchAllUnits === "no" && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>Please note below why not all units were completed.</span>
                </div>
              )}

              <div className="flex items-center gap-3 pt-1">
                <Switch
                  checked={!!form.watch("completionExtraFaultFound" as any)}
                  onCheckedChange={v => form.setValue("completionExtraFaultFound" as any, v)}
                />
                <Label className="font-normal text-sm cursor-pointer">Extra Fault / Extra Work Found</Label>
              </div>

              {watchExtraFault && (
                <div className="md:col-span-2">
                  <Button
                    type="button" variant="outline"
                    className="border-orange-300 text-orange-700 hover:bg-orange-50 w-full"
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Report Extra Fault / Extra Work
                  </Button>
                </div>
              )}

              <FormField control={form.control} name="completionNotes" render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Technician Notes</FormLabel>
                  <FormControl>
                    <Textarea rows={3} placeholder="Notes from the technician after completing the job" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name={"completionCustomerSignature" as any} render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Customer Signature / Reference</FormLabel>
                  <FormControl>
                    <Input placeholder="Initials or signature reference" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Chemicals / Stock Used</FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="e.g. 100 ml permethrin, 2× Racumin bait blocks" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

            </div>
          </TabsContent>

        </Tabs>

        {/* ── Actions ─────────────────────────────────────────────────────── */}
        <div className="flex justify-between items-center pt-2 border-t gap-2">
          <div className="flex gap-1">
            {(["details","service","pricing","completion"] as const).map((t, i) => (
              <button
                key={t} type="button"
                onClick={() => setActiveTab(t)}
                className={`w-2 h-2 rounded-full transition-colors ${activeTab === t ? "bg-primary" : "bg-gray-300 hover:bg-gray-400"}`}
                title={t}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : job ? "Save Changes" : "Create Job"}
            </Button>
          </div>
        </div>

      </form>
    </Form>
  );
}
