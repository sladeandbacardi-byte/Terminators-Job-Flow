import { useState, useEffect } from "react";
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
import { CalendarIcon, Plus, Trash2, Calculator, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { RentalContract, Client, Department, Worker, Team } from "@shared/schema";
import { z } from "zod";

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Format as "R1 500.00" — space thousands, dot decimal */
export function formatZAR(amount: number): string {
  const [whole, cents] = amount.toFixed(2).split(".");
  const withSpaces = whole.replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
  return `R${withSpaces}.${cents}`;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SCHEDULE_FREQUENCIES = [
  "Daily", "2 x a week", "Weekly", "Twice a month", "Monthly",
  "Every 2 months", "Quarterly", "Every 6 months", "Annually",
  "Once-off", "On Demand",
] as const;

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const WEEKS_OF_MONTH = [1, 2, 3, 4, 5];
const BILLING_FREQUENCIES = ["weekly", "monthly", "quarterly", "annually", "once-off"];
const REFILL_RULES = ["Not Applicable", "As needed", "Monthly", "Quarterly", "Annually"];
const INVOICE_RULES = ["Monthly", "Quarterly", "Annually", "Once-off", "Per Visit"];

// ── Line-item state ────────────────────────────────────────────────────────────

interface LineItem {
  id: string;
  itemName: string;
  refillRule: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
  notes: string;
}

function emptyItem(): LineItem {
  return { id: crypto.randomUUID(), itemName: "", refillRule: "Not Applicable", quantity: 1, unitPrice: "", totalPrice: "", notes: "" };
}

function calcItemTotal(unitPrice: string, qty: number): string {
  const p = parseFloat(unitPrice);
  if (!isFinite(p) || p < 0) return "";
  return (p * qty).toFixed(2);
}

// ── Form schema ───────────────────────────────────────────────────────────────

const contractFormSchema = z.object({
  clientId:              z.string().min(1, "Client is required"),
  customerName:          z.string().optional(),
  departmentId:          z.string().optional(),
  // Contract dates
  startDate:             z.date({ required_error: "Start date is required" }),
  endDate:               z.date().optional(),
  lastPriceIncreaseDate: z.date().optional(),
  nextIncreaseDate:      z.date().optional(),
  increasePercentage:    z.string().optional(),
  // Scheduling
  frequency:             z.string().optional(),
  weekOfMonth:           z.coerce.number().optional(),
  dayOfWeek:             z.string().optional(),
  startTime:             z.string().optional(),
  estimatedDuration:     z.coerce.number().optional(),
  assignedTeamId:        z.string().optional(),
  assignedTeamName:      z.string().optional(),
  assignedTechnicianId:  z.string().optional(),
  assignedTechnicianName:z.string().optional(),
  routeSequence:         z.coerce.number().optional(),
  fixedTime:             z.boolean().default(false),
  // Pricing / invoicing
  billingFrequency:      z.string().optional(),
  invoiceRule:           z.string().optional(),
  // Address
  address:               z.string().optional(),
  googleMapsLink:        z.string().optional(),
  // Notes / status
  notes:                 z.string().optional(),
  isActive:              z.boolean().default(true),
  activeStatus:          z.boolean().default(true),
});

type ContractFormData = z.infer<typeof contractFormSchema>;

// ── Component ─────────────────────────────────────────────────────────────────

interface ContractFormProps {
  contract?: RentalContract | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function ContractForm({ contract, onSuccess, onCancel }: ContractFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: clients = [] }     = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: departments = [] } = useQuery<Department[]>({ queryKey: ["/api/departments"] });
  const { data: workers = [] }     = useQuery<Worker[]>({ queryKey: ["/api/workers"] });
  const { data: teams = [] }       = useQuery<Team[]>({ queryKey: ["/api/teams"] });

  // ── Line items ────────────────────────────────────────────────────────────
  const { data: existingItems = [] } = useQuery<any[]>({
    queryKey: ["/api/contracts", contract?.id, "items"],
    queryFn: () => fetch(`/api/contracts/${contract!.id}/items`).then(r => r.json()),
    enabled: !!contract?.id,
  });

  const [items, setItems] = useState<LineItem[]>([emptyItem()]);

  useEffect(() => {
    if (existingItems.length > 0) {
      setItems(existingItems.map((i: any) => ({
        id: i.id ?? crypto.randomUUID(),
        itemName: i.itemName ?? "",
        refillRule: i.refillRule ?? "Not Applicable",
        quantity: i.quantity ?? 1,
        unitPrice: String(i.unitPrice ?? ""),
        totalPrice: String(i.totalPrice ?? ""),
        notes: i.notes ?? "",
      })));
    }
  }, [existingItems]);

  const addItem  = () => setItems(prev => [...prev, emptyItem()]);
  const removeItem = (id: string) => setItems(prev => prev.length > 1 ? prev.filter(i => i.id !== id) : prev);
  const updateItem = (id: string, patch: Partial<LineItem>) =>
    setItems(prev => prev.map(i => {
      if (i.id !== id) return i;
      const updated = { ...i, ...patch };
      if (patch.unitPrice !== undefined || patch.quantity !== undefined) {
        updated.totalPrice = calcItemTotal(updated.unitPrice, updated.quantity);
      }
      return updated;
    }));

  const grandTotal = items.reduce((sum, i) => {
    const t = parseFloat(i.totalPrice);
    return sum + (isFinite(t) ? t : 0);
  }, 0);

  // ── Form ─────────────────────────────────────────────────────────────────
  const form = useForm<ContractFormData>({
    resolver: zodResolver(contractFormSchema),
    defaultValues: {
      clientId:              contract?.clientId ?? "",
      customerName:          contract?.customerName ?? "",
      departmentId:          contract?.departmentId ?? "",
      startDate:             contract ? new Date(contract.startDate) : new Date(),
      endDate:               contract?.endDate ? new Date(contract.endDate) : undefined,
      lastPriceIncreaseDate: (contract as any)?.lastPriceIncreaseDate ? new Date((contract as any).lastPriceIncreaseDate) : undefined,
      nextIncreaseDate:      (contract as any)?.nextIncreaseDate ? new Date((contract as any).nextIncreaseDate) : undefined,
      increasePercentage:    String((contract as any)?.increasePercentage ?? ""),
      frequency:             (contract as any)?.frequency ?? "",
      weekOfMonth:           (contract as any)?.weekOfMonth ?? undefined,
      dayOfWeek:             (contract as any)?.dayOfWeek ?? "",
      startTime:             (contract as any)?.startTime ?? "",
      estimatedDuration:     (contract as any)?.estimatedDuration ?? undefined,
      assignedTeamId:        (contract as any)?.assignedTeamId ?? "",
      assignedTeamName:      (contract as any)?.assignedTeamName ?? "",
      assignedTechnicianId:  (contract as any)?.assignedTechnicianId ?? "",
      assignedTechnicianName:(contract as any)?.assignedTechnicianName ?? "",
      routeSequence:         (contract as any)?.routeSequence ?? undefined,
      fixedTime:             (contract as any)?.fixedTime ?? false,
      billingFrequency:      contract?.billingFrequency ?? "monthly",
      invoiceRule:           (contract as any)?.invoiceRule ?? "",
      address:               (contract as any)?.address ?? "",
      googleMapsLink:        (contract as any)?.googleMapsLink ?? "",
      notes:                 contract?.notes ?? "",
      isActive:              contract?.isActive ?? true,
      activeStatus:          (contract as any)?.activeStatus ?? true,
    },
  });

  const watchedFrequency  = form.watch("frequency");
  const watchedClientId   = form.watch("clientId");
  const watchedTeamId     = form.watch("assignedTeamId");
  const watchedTechId     = form.watch("assignedTechnicianId");

  // Auto-fill customerName when client changes
  useEffect(() => {
    if (watchedClientId) {
      const c = clients.find(x => x.id === watchedClientId);
      if (c) form.setValue("customerName", c.name);
    }
  }, [watchedClientId, clients]);

  // Auto-fill team/tech names
  useEffect(() => {
    if (watchedTeamId) {
      const t = teams.find(x => x.id === watchedTeamId);
      if (t) form.setValue("assignedTeamName", t.name);
    }
  }, [watchedTeamId, teams]);
  useEffect(() => {
    if (watchedTechId) {
      const w = workers.find(x => x.id === watchedTechId);
      if (w) form.setValue("assignedTechnicianName", w.name);
    }
  }, [watchedTechId, workers]);

  const needsWeek = ["Twice a month", "Monthly", "Every 2 months", "Quarterly", "Every 6 months", "Annually"].includes(watchedFrequency ?? "");
  const needsDay  = !["Daily", "Once-off", "On Demand", ""].includes(watchedFrequency ?? "");

  // ── Mutations ─────────────────────────────────────────────────────────────
  const buildPayload = (data: ContractFormData) => ({
    ...data,
    calculatedTotal: grandTotal > 0 ? grandTotal.toFixed(2) : undefined,
    monthlyPrice:    data.billingFrequency === "monthly" && grandTotal > 0 ? grandTotal.toFixed(2) : null,
    unitPrice:       grandTotal > 0 ? grandTotal.toFixed(2) : null,
    quantity:        1,
    inventoryItemId: null,
    items: items.filter(i => i.itemName.trim()),
    // Active status — keep both field names in sync
    activeStatus: data.isActive,
  });

  const createMutation = useMutation({
    mutationFn: (data: ContractFormData) => apiRequest("POST", "/api/contracts", buildPayload(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/service-contracts/occurrences"] });
      toast({ title: "Contract created", description: "Rental contract saved successfully." });
      onSuccess();
    },
    onError: (err: any) =>
      toast({ title: "Error", description: err?.message ?? "Failed to create contract.", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: ContractFormData) => apiRequest("PUT", `/api/contracts/${contract!.id}`, buildPayload(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts", contract!.id, "items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/service-contracts/occurrences"] });
      toast({ title: "Contract updated", description: "Rental contract updated successfully." });
      onSuccess();
    },
    onError: (err: any) =>
      toast({ title: "Error", description: err?.message ?? "Failed to update contract.", variant: "destructive" }),
  });

  const onSubmit = (data: ContractFormData) =>
    contract ? updateMutation.mutate(data) : createMutation.mutate(data);

  const isPending = createMutation.isPending || updateMutation.isPending;

  // ── Date picker helper ────────────────────────────────────────────────────
  function DatePicker({ value, onChange, placeholder }: { value?: Date; onChange: (d?: Date) => void; placeholder: string }) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !value && "text-muted-foreground")}>
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? format(value, "dd MMM yyyy") : <span>{placeholder}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={value} onSelect={onChange} initialFocus />
        </PopoverContent>
      </Popover>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

        {/* ══════════════ 1. CLIENT DETAILS ══════════════ */}
        <section>
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 pb-1 border-b">Client Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField control={form.control} name="clientId" render={({ field }) => (
              <FormItem>
                <FormLabel>Client <span className="text-red-500">*</span></FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Select a client" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {clients.filter(c => c.status !== "suspended").map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="departmentId" render={({ field }) => (
              <FormItem>
                <FormLabel>Department</FormLabel>
                <Select onValueChange={field.onChange} value={field.value ?? ""}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {departments.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
          </div>
        </section>

        {/* ══════════════ 2. RENTAL ITEMS ══════════════ */}
        <section>
          <div className="flex items-center justify-between mb-3 pb-1 border-b">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Rental Items / Service Lines</h3>
            <Button type="button" size="sm" variant="outline" onClick={addItem} className="gap-1 text-xs">
              <Plus className="h-3.5 w-3.5" /> Add Item
            </Button>
          </div>

          <div className="space-y-3">
            {items.map((item, idx) => (
              <div key={item.id} className="border rounded-lg p-3 bg-gray-50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">Item {idx + 1}</span>
                  {items.length > 1 && (
                    <Button type="button" size="icon" variant="ghost" className="h-6 w-6 text-red-500 hover:text-red-700" onClick={() => removeItem(item.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-2">
                    <label className="text-xs text-gray-600 font-medium">Item / Service Name</label>
                    <Input
                      placeholder="e.g. Sanitary Bin, Air Freshener"
                      value={item.itemName}
                      onChange={e => updateItem(item.id, { itemName: e.target.value })}
                      className="mt-1 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 font-medium">Refill Rule</label>
                    <Select value={item.refillRule} onValueChange={v => updateItem(item.id, { refillRule: v })}>
                      <SelectTrigger className="mt-1 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {REFILL_RULES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-gray-600 font-medium">Qty</label>
                    <Input
                      type="number" min="1" step="1"
                      value={item.quantity}
                      onChange={e => updateItem(item.id, { quantity: parseInt(e.target.value) || 1 })}
                      className="mt-1 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 font-medium">Unit Price (R)</label>
                    <Input
                      type="number" min="0" step="0.01" placeholder="0.00"
                      value={item.unitPrice}
                      onChange={e => updateItem(item.id, { unitPrice: e.target.value })}
                      className="mt-1 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 font-medium">Total</label>
                    <Input
                      readOnly
                      value={item.totalPrice ? `R ${parseFloat(item.totalPrice).toFixed(2)}` : "—"}
                      className="mt-1 text-sm bg-gray-100 text-gray-600"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-600 font-medium">Notes (optional)</label>
                  <Input
                    placeholder="Item-specific notes"
                    value={item.notes}
                    onChange={e => updateItem(item.id, { notes: e.target.value })}
                    className="mt-1 text-sm"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Grand total */}
          {grandTotal > 0 && (
            <div className="mt-3 flex items-center gap-2 rounded-md border-2 border-blue-200 bg-blue-50 px-4 py-2">
              <Calculator className="h-4 w-4 text-blue-500 shrink-0" />
              <span className="text-xs text-blue-600 font-medium">Total Contract Value:</span>
              <span className="text-lg font-bold text-blue-700 ml-auto">{formatZAR(grandTotal)}</span>
            </div>
          )}
        </section>

        {/* ══════════════ 3. CONTRACT DATES ══════════════ */}
        <section>
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 pb-1 border-b">Contract Dates</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField control={form.control} name="startDate" render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Start Date <span className="text-red-500">*</span></FormLabel>
                <FormControl>
                  <DatePicker value={field.value} onChange={field.onChange} placeholder="Pick start date" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="endDate" render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>End Date <span className="text-muted-foreground font-normal text-xs">(Optional)</span></FormLabel>
                <FormControl>
                  <DatePicker value={field.value} onChange={field.onChange} placeholder="Pick end date (optional)" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="lastPriceIncreaseDate" render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Last Price Increase Date <span className="text-muted-foreground font-normal text-xs">(Optional)</span></FormLabel>
                <FormControl>
                  <DatePicker value={field.value} onChange={field.onChange} placeholder="Date of last increase" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="nextIncreaseDate" render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Next Increase Date <span className="text-muted-foreground font-normal text-xs">(Optional)</span></FormLabel>
                <FormControl>
                  <DatePicker value={field.value} onChange={field.onChange} placeholder="Date of next increase" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="increasePercentage" render={({ field }) => (
              <FormItem>
                <FormLabel>Increase % <span className="text-muted-foreground font-normal text-xs">(Optional)</span></FormLabel>
                <FormControl>
                  <Input type="number" min="0" step="0.1" placeholder="e.g. 10" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
        </section>

        {/* ══════════════ 4. SCHEDULING ══════════════ */}
        <section>
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 pb-1 border-b">Scheduling</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField control={form.control} name="frequency" render={({ field }) => (
              <FormItem>
                <FormLabel>Service Frequency</FormLabel>
                <Select onValueChange={field.onChange} value={field.value ?? ""}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Select frequency" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {SCHEDULE_FREQUENCIES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Contracts with a frequency appear on the Calendar</p>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="startTime" render={({ field }) => (
              <FormItem>
                <FormLabel>Start Time <span className="text-muted-foreground font-normal text-xs">(Optional)</span></FormLabel>
                <FormControl>
                  <Input type="time" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {needsDay && (
              <FormField control={form.control} name="dayOfWeek" render={({ field }) => (
                <FormItem>
                  <FormLabel>Day of Week</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select day" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {DAYS_OF_WEEK.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            )}

            {needsWeek && (
              <FormField control={form.control} name="weekOfMonth" render={({ field }) => (
                <FormItem>
                  <FormLabel>Week of Month</FormLabel>
                  <Select onValueChange={v => field.onChange(parseInt(v))} value={field.value ? String(field.value) : ""}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select week" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {WEEKS_OF_MONTH.map(w => <SelectItem key={w} value={String(w)}>Week {w}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            )}

            <FormField control={form.control} name="estimatedDuration" render={({ field }) => (
              <FormItem>
                <FormLabel>Estimated Duration (min) <span className="text-muted-foreground font-normal text-xs">(Optional)</span></FormLabel>
                <FormControl>
                  <Input type="number" min="1" step="1" placeholder="e.g. 30" {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="routeSequence" render={({ field }) => (
              <FormItem>
                <FormLabel>Route Sequence <span className="text-muted-foreground font-normal text-xs">(Optional)</span></FormLabel>
                <FormControl>
                  <Input type="number" min="1" step="1" placeholder="e.g. 1" {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="assignedTeamId" render={({ field }) => (
              <FormItem>
                <FormLabel>Assigned Team <span className="text-muted-foreground font-normal text-xs">(Optional)</span></FormLabel>
                <Select onValueChange={field.onChange} value={field.value ?? ""}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Select team" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="assignedTechnicianId" render={({ field }) => (
              <FormItem>
                <FormLabel>Assigned Technician <span className="text-muted-foreground font-normal text-xs">(Optional)</span></FormLabel>
                <Select onValueChange={field.onChange} value={field.value ?? ""}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Select technician" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {workers.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
          </div>

          <div className="mt-3">
            <FormField control={form.control} name="fixedTime" render={({ field }) => (
              <FormItem className="flex flex-row items-center gap-3">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormLabel className="font-normal cursor-pointer">Fixed time appointment (cannot be rescheduled)</FormLabel>
              </FormItem>
            )} />
          </div>
        </section>

        {/* ══════════════ 5. PRICING & INVOICING ══════════════ */}
        <section>
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 pb-1 border-b">Pricing &amp; Invoicing</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField control={form.control} name="billingFrequency" render={({ field }) => (
              <FormItem>
                <FormLabel>Billing Frequency</FormLabel>
                <Select onValueChange={field.onChange} value={field.value ?? "monthly"}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Select billing frequency" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {BILLING_FREQUENCIES.map(f => <SelectItem key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="invoiceRule" render={({ field }) => (
              <FormItem>
                <FormLabel>Invoice Rule <span className="text-muted-foreground font-normal text-xs">(Optional)</span></FormLabel>
                <Select onValueChange={field.onChange} value={field.value ?? ""}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Select invoice rule" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {INVOICE_RULES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
          </div>
        </section>

        {/* ══════════════ 6. ADDRESS & NOTES ══════════════ */}
        <section>
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 pb-1 border-b">Address &amp; Notes</h3>
          <div className="space-y-4">
            <FormField control={form.control} name="address" render={({ field }) => (
              <FormItem>
                <FormLabel>Service Address <span className="text-muted-foreground font-normal text-xs">(Optional)</span></FormLabel>
                <FormControl>
                  <Input placeholder="Full service address" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="googleMapsLink" render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> Google Maps Link <span className="text-muted-foreground font-normal text-xs">(Optional)</span>
                </FormLabel>
                <FormControl>
                  <Input placeholder="https://maps.google.com/..." {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notes <span className="text-muted-foreground font-normal text-xs">(Optional)</span></FormLabel>
                <FormControl>
                  <Textarea placeholder="Additional contract notes or special instructions" className="min-h-[80px]" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="isActive" render={({ field }) => (
              <FormItem className="flex flex-row items-center gap-3">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={v => { field.onChange(v); form.setValue("activeStatus", !!v); }} />
                </FormControl>
                <FormLabel className="font-normal cursor-pointer">Active contract (appears on calendar &amp; billing)</FormLabel>
              </FormItem>
            )} />
          </div>
        </section>

        {/* ══════════════ ACTIONS ══════════════ */}
        <div className="flex justify-end gap-3 pt-2 border-t">
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving…" : (contract ? "Update Contract" : "Create Contract")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
