import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
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

const BILLING_FREQUENCIES = [
  { value: "weekly",    label: "Weekly" },
  { value: "monthly",   label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annually",  label: "Annually" },
  { value: "once-off",  label: "Once-off" },
] as const;

const contractFormSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  inventoryItemId: z.string().min(1, "Equipment is required"),
  unitPrice: z.string().min(1, "Unit price is required").refine(
    (v) => !isNaN(parseFloat(v)) && parseFloat(v) >= 0,
    "Unit price must be 0 or more"
  ),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  billingFrequency: z.enum(["weekly", "monthly", "quarterly", "annually", "once-off"]),
  calculatedTotal: z.string().optional(),
  startDate: z.date({ required_error: "Start date is required" }),
  endDate: z.date().optional(),
  lastPriceIncrease: z.date().optional(),
  isActive: z.boolean().default(true),
  notes: z.string().optional(),
});

type ContractFormData = z.infer<typeof contractFormSchema>;

const FREQ_LABEL: Record<string, string> = {
  weekly:    "week",
  monthly:   "month",
  quarterly: "quarter",
  annually:  "year",
  "once-off": "once",
};

function calcTotal(unitPrice: string, quantity: number): number {
  const p = parseFloat(unitPrice);
  const q = Number(quantity);
  if (isNaN(p) || isNaN(q) || q <= 0) return 0;
  return p * q;
}

function formatZAR(amount: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", minimumFractionDigits: 2 }).format(amount);
}

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

  // Resolve defaults — migrate legacy monthlyPrice if new fields absent
  const defaultUnitPrice = contract
    ? (contract.unitPrice ?? contract.monthlyPrice ?? "")
    : "";
  const defaultQuantity = contract
    ? (contract.quantity ?? 1)
    : 1;
  const defaultFreq = (contract?.billingFrequency as ContractFormData["billingFrequency"]) ?? "monthly";

  const form = useForm<ContractFormData>({
    resolver: zodResolver(contractFormSchema),
    defaultValues: {
      clientId: contract?.clientId ?? "",
      inventoryItemId: contract?.inventoryItemId ?? "",
      unitPrice: String(defaultUnitPrice),
      quantity: defaultQuantity,
      billingFrequency: defaultFreq,
      calculatedTotal: contract?.calculatedTotal ?? "",
      startDate: contract ? new Date(contract.startDate) : new Date(),
      endDate: contract?.endDate ? new Date(contract.endDate) : undefined,
      lastPriceIncrease: contract?.lastPriceIncrease ? new Date(contract.lastPriceIncrease) : undefined,
      isActive: contract?.isActive ?? true,
      notes: contract?.notes ?? "",
    },
  });

  const unitPriceVal = useWatch({ control: form.control, name: "unitPrice" });
  const quantityVal  = useWatch({ control: form.control, name: "quantity" });
  const freqVal      = useWatch({ control: form.control, name: "billingFrequency" });

  const total = calcTotal(unitPriceVal, quantityVal);

  // Keep calculatedTotal field in sync so it's submitted correctly
  useEffect(() => {
    form.setValue("calculatedTotal", total > 0 ? total.toFixed(2) : "");
  }, [total, form]);

  const createMutation = useMutation({
    mutationFn: (data: ContractFormData) => apiRequest("POST", "/api/contracts", {
      ...data,
      monthlyPrice: freqVal === "monthly" ? total.toFixed(2) : null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({ title: "Contract created", description: "Rental contract created successfully." });
      onSuccess();
    },
    onError: () => toast({ title: "Error", description: "Failed to create contract.", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: ContractFormData) => apiRequest("PUT", `/api/contracts/${contract!.id}`, {
      ...data,
      monthlyPrice: freqVal === "monthly" ? total.toFixed(2) : null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({ title: "Contract updated", description: "Rental contract updated successfully." });
      onSuccess();
    },
    onError: () => toast({ title: "Error", description: "Failed to update contract.", variant: "destructive" }),
  });

  const onSubmit = (data: ContractFormData) => {
    contract ? updateMutation.mutate(data) : createMutation.mutate(data);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

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
                    <SelectItem key={item.id} value={item.id}>{item.name} ({item.sku})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        {/* Pricing structure */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField control={form.control} name="unitPrice" render={({ field }) => (
            <FormItem>
              <FormLabel>Unit Price (ZAR)</FormLabel>
              <FormControl>
                <Input type="number" step="0.01" min="0" placeholder="150.00" {...field} data-testid="input-unit-price" />
              </FormControl>
              <p className="text-xs text-muted-foreground mt-1">Price per unit / item</p>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="quantity" render={({ field }) => (
            <FormItem>
              <FormLabel>Quantity</FormLabel>
              <FormControl>
                <Input type="number" min="1" step="1" placeholder="1" {...field} data-testid="input-quantity" />
              </FormControl>
              <p className="text-xs text-muted-foreground mt-1">Number of units</p>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="billingFrequency" render={({ field }) => (
            <FormItem>
              <FormLabel>Billing Frequency</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
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
              <p className="text-xs text-muted-foreground mt-1">How often billed</p>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        {/* Calculated Total — live, read-only */}
        <div className={cn(
          "rounded-lg border-2 px-4 py-3 flex items-center gap-3",
          total > 0 ? "border-blue-200 bg-blue-50" : "border-gray-200 bg-gray-50"
        )}>
          <Calculator className={cn("h-5 w-5 shrink-0", total > 0 ? "text-blue-500" : "text-gray-400")} />
          <div className="flex-1">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Calculated Total</p>
            {total > 0 ? (
              <p className="text-lg font-bold text-blue-700">
                {formatZAR(total)}
                <span className="text-sm font-normal text-blue-500 ml-1">
                  / {freqVal === "once-off" ? "once" : FREQ_LABEL[freqVal] ?? freqVal}
                </span>
              </p>
            ) : (
              <p className="text-sm text-gray-400 italic">Enter unit price and quantity above</p>
            )}
          </div>
          {total > 0 && (
            <div className="text-right text-xs text-gray-400 shrink-0">
              {unitPriceVal && Number(quantityVal) > 0 && (
                <span>{formatZAR(parseFloat(unitPriceVal))} × {quantityVal}</span>
              )}
            </div>
          )}
        </div>

        {/* Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField control={form.control} name="startDate" render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Start Date</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")} data-testid="input-start-date">
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
              <FormLabel>End Date <span className="text-muted-foreground font-normal">(Optional)</span></FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")} data-testid="input-end-date">
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
                    disabled={(date) => { const s = form.getValues("startDate"); return s ? date < s : false; }}
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
            <FormLabel>Last Price Increase <span className="text-muted-foreground font-normal">(Optional)</span></FormLabel>
            <Popover>
              <PopoverTrigger asChild>
                <FormControl>
                  <Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")} data-testid="input-price-increase">
                    {field.value ? formatDate(field.value) : <span>Select date of last increase</span>}
                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                  </Button>
                </FormControl>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(d) => d > new Date()} initialFocus />
              </PopoverContent>
            </Popover>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="notes" render={({ field }) => (
          <FormItem>
            <FormLabel>Notes</FormLabel>
            <FormControl>
              <Textarea placeholder="Additional contract notes or terms" className="min-h-[80px]" {...field} value={field.value ?? ""} data-testid="input-notes" />
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
          <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel">Cancel</Button>
          <Button type="submit" disabled={isPending} data-testid="button-submit">
            {isPending ? "Saving..." : (contract ? "Update Contract" : "Create Contract")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
