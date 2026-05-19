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
import { CalendarIcon, Calculator } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { RentalContract, Client, InventoryItem } from "@shared/schema";
import { z } from "zod";

// ── Constants ─────────────────────────────────────────────────────────────────

const BILLING_FREQUENCIES = [
  { value: "weekly",    label: "Weekly" },
  { value: "monthly",   label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annually",  label: "Annually" },
  { value: "once-off",  label: "Once-off" },
] as const;

type BillingFrequency = typeof BILLING_FREQUENCIES[number]["value"];

// "per week", "per month", "per quarter", "per year", "once-off"
const FREQ_SUFFIX: Record<BillingFrequency, string> = {
  weekly:    "per week",
  monthly:   "per month",
  quarterly: "per quarter",
  annually:  "per year",
  "once-off": "once-off",
};

// ── Schema ────────────────────────────────────────────────────────────────────

const contractFormSchema = z.object({
  clientId:         z.string().min(1, "Client is required"),
  inventoryItemId:  z.string().min(1, "Equipment is required"),
  unitPrice:        z.string().min(1, "Unit price is required").refine(
    v => !isNaN(parseFloat(v)) && parseFloat(v) >= 0,
    "Unit price must be 0 or more"
  ),
  quantity:         z.coerce.number().int().min(1, "Quantity must be at least 1"),
  billingFrequency: z.enum(["weekly", "monthly", "quarterly", "annually", "once-off"]),
  calculatedTotal:  z.string().optional(),
  startDate:        z.date({ required_error: "Start date is required" }),
  endDate:          z.date().optional(),
  lastPriceIncrease: z.date().optional(),
  isActive:         z.boolean().default(true),
  notes:            z.string().optional(),
});

type ContractFormData = z.infer<typeof contractFormSchema>;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Format as "R1 500.00" — space thousands, dot decimal */
export function formatZAR(amount: number): string {
  const [whole, cents] = amount.toFixed(2).split(".");
  const withSpaces = whole.replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0"); // non-breaking space
  return `R${withSpaces}.${cents}`;
}

function computeTotal(unitPrice: string, qty: number | string): number {
  const p = parseFloat(String(unitPrice));
  const q = parseInt(String(qty), 10);
  if (!isFinite(p) || !isFinite(q) || p < 0 || q <= 0) return 0;
  return p * q;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ContractFormProps {
  contract?: RentalContract | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function ContractForm({ contract, onSuccess, onCancel }: ContractFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: allItems = [] } = useQuery<InventoryItem[]>({ queryKey: ["/api/inventory"] });
  const inventoryItems = allItems.filter(i => i.type === "rental_equipment");

  // Migrate legacy monthlyPrice → unitPrice for edit mode
  const defaultUnitPrice = contract
    ? String(contract.unitPrice ?? contract.monthlyPrice ?? "")
    : "";
  const defaultQty = contract ? (contract.quantity ?? 1) : 1;
  const defaultFreq = (contract?.billingFrequency as BillingFrequency | undefined) ?? "monthly";

  const form = useForm<ContractFormData>({
    resolver: zodResolver(contractFormSchema),
    defaultValues: {
      clientId:         contract?.clientId ?? "",
      inventoryItemId:  contract?.inventoryItemId ?? "",
      unitPrice:        defaultUnitPrice,
      quantity:         defaultQty,
      billingFrequency: defaultFreq,
      calculatedTotal:  contract?.calculatedTotal ?? "",
      startDate:        contract ? new Date(contract.startDate) : new Date(),
      endDate:          contract?.endDate ? new Date(contract.endDate) : undefined,
      lastPriceIncrease: contract?.lastPriceIncrease ? new Date(contract.lastPriceIncrease) : undefined,
      isActive:         contract?.isActive ?? true,
      notes:            contract?.notes ?? "",
    },
  });

  // form.watch() triggers re-render on every keystroke — most reliable approach
  const unitPriceVal     = form.watch("unitPrice");
  const quantityVal      = form.watch("quantity");
  const billingFreqVal   = form.watch("billingFrequency") as BillingFrequency;

  const total    = computeTotal(unitPriceVal, quantityVal);
  const hasTotal = total > 0;
  const freqSuffix = FREQ_SUFFIX[billingFreqVal] ?? billingFreqVal;

  // ── Mutations ──────────────────────────────────────────────────────────────

  const buildPayload = (data: ContractFormData) => ({
    ...data,
    calculatedTotal: hasTotal ? total.toFixed(2) : undefined,
    // keep monthlyPrice in sync for legacy reports
    monthlyPrice: billingFreqVal === "monthly" && hasTotal ? total.toFixed(2) : null,
  });

  const createMutation = useMutation({
    mutationFn: (data: ContractFormData) =>
      apiRequest("POST", "/api/contracts", buildPayload(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({ title: "Contract created", description: "Rental contract created successfully." });
      onSuccess();
    },
    onError: () =>
      toast({ title: "Error", description: "Failed to create contract.", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: ContractFormData) =>
      apiRequest("PUT", `/api/contracts/${contract!.id}`, buildPayload(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({ title: "Contract updated", description: "Rental contract updated successfully." });
      onSuccess();
    },
    onError: () =>
      toast({ title: "Error", description: "Failed to update contract.", variant: "destructive" }),
  });

  const onSubmit = (data: ContractFormData) =>
    contract ? updateMutation.mutate(data) : createMutation.mutate(data);

  const isPending = createMutation.isPending || updateMutation.isPending;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" data-testid="contract-form">
        <h2 className="text-lg font-semibold">
          {contract ? "Edit Rental Contract" : "Create New Rental Contract"}
        </h2>

        {/* Client + Equipment */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField control={form.control} name="clientId" render={({ field }) => (
            <FormItem>
              <FormLabel>Client</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-client">
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {clients.filter(c => c.status !== "suspended").map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
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
          )} />

          <FormField control={form.control} name="inventoryItemId" render={({ field }) => (
            <FormItem>
              <FormLabel>Rental Equipment</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-equipment">
                    <SelectValue placeholder="Select equipment" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {inventoryItems.map(item => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} ({item.sku})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        {/* ── Pricing ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField control={form.control} name="unitPrice" render={({ field }) => (
            <FormItem>
              <FormLabel>Unit Price (ZAR)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="150.00"
                  {...field}
                  data-testid="input-unit-price"
                />
              </FormControl>
              <p className="text-xs text-muted-foreground mt-0.5">Price per unit / item</p>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="quantity" render={({ field }) => (
            <FormItem>
              <FormLabel>Quantity</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="1"
                  {...field}
                  data-testid="input-quantity"
                />
              </FormControl>
              <p className="text-xs text-muted-foreground mt-0.5">Number of units</p>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="billingFrequency" render={({ field }) => (
            <FormItem>
              <FormLabel>Billing Frequency</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-frequency">
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {BILLING_FREQUENCIES.map(f => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-0.5">How often billed</p>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        {/* ── Calculated Total — live read-only display ─────────────── */}
        <div className={cn(
          "rounded-lg border-2 px-4 py-3",
          hasTotal ? "border-blue-200 bg-blue-50" : "border-gray-200 bg-gray-50"
        )}>
          <div className="flex items-start gap-3">
            <Calculator className={cn(
              "h-5 w-5 mt-0.5 shrink-0",
              hasTotal ? "text-blue-500" : "text-gray-400"
            )} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Calculated Total
              </p>

              {hasTotal ? (
                <>
                  {/* Big total line */}
                  <p className="text-2xl font-bold text-blue-700 leading-tight">
                    {formatZAR(total)}
                    <span className="text-sm font-normal text-blue-500 ml-2">{freqSuffix}</span>
                  </p>
                  {/* Breakdown line */}
                  <p className="text-xs text-gray-500 mt-1">
                    {parseInt(String(quantityVal), 10)}{" "}
                    {parseInt(String(quantityVal), 10) === 1 ? "unit" : "units"}
                    {" × "}
                    {formatZAR(parseFloat(unitPriceVal) || 0)}
                    {" = "}
                    <strong>{formatZAR(total)}</strong>
                    {" "}
                    {freqSuffix}
                  </p>
                </>
              ) : (
                <p className="text-sm text-gray-400 italic">
                  Enter unit price and quantity above
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── Dates ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField control={form.control} name="startDate" render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Start Date</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                      data-testid="input-start-date"
                    >
                      {field.value ? formatDate(field.value) : <span>Pick start date</span>}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="endDate" render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>
                End Date <span className="text-muted-foreground font-normal text-xs">(Optional)</span>
              </FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                      data-testid="input-end-date"
                    >
                      {field.value ? formatDate(field.value) : <span>Pick end date</span>}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) => {
                      const s = form.getValues("startDate");
                      return s ? date < s : false;
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <FormField control={form.control} name="lastPriceIncrease" render={({ field }) => (
          <FormItem className="flex flex-col">
            <FormLabel>
              Last Price Increase <span className="text-muted-foreground font-normal text-xs">(Optional)</span>
            </FormLabel>
            <Popover>
              <PopoverTrigger asChild>
                <FormControl>
                  <Button
                    variant="outline"
                    className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                    data-testid="input-price-increase"
                  >
                    {field.value ? formatDate(field.value) : <span>Select date of last increase</span>}
                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                  </Button>
                </FormControl>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={field.value}
                  onSelect={field.onChange}
                  disabled={(d) => d > new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="notes" render={({ field }) => (
          <FormItem>
            <FormLabel>Notes</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Additional contract notes or terms"
                className="min-h-[80px]"
                {...field}
                value={field.value ?? ""}
                data-testid="input-notes"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="isActive" render={({ field }) => (
          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
            <FormControl>
              <Checkbox checked={field.value} onCheckedChange={field.onChange} data-testid="checkbox-active" />
            </FormControl>
            <div className="space-y-1 leading-none">
              <FormLabel>Active Contract</FormLabel>
              <p className="text-sm text-muted-foreground">Contract is currently active and billing</p>
            </div>
            <FormMessage />
          </FormItem>
        )} />

        <div className="flex justify-end space-x-3 pt-2">
          <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel">
            Cancel
          </Button>
          <Button type="submit" disabled={isPending} data-testid="button-submit">
            {isPending ? "Saving..." : (contract ? "Update Contract" : "Create Contract")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
