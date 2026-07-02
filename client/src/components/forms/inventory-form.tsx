import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertInventoryItemSchema } from "@shared/schema";
import type { InventoryItem, Department } from "@shared/schema";
import { z } from "zod";

// ── Item type options ─────────────────────────────────────────────────────────
const ITEM_TYPES = [
  "Consumable",
  "Equipment / Rental Item",
  "Chemical",
  "Tool",
  "PPE",
  "Service Item",
  "Other",
] as const;

// ── Department → categories mapping ──────────────────────────────────────────
const DEPT_CATEGORIES: Record<string, string[]> = {
  "Pest Control": [
    "Rodent Control", "Crawling Insects", "Flying Insects", "Bait Stations",
    "Baits", "Chemicals", "Monitoring Equipment", "PPE", "Tools", "Other Pest Control",
  ],
  "Washroom": [
    "Dispensers", "Refills", "Aerosol Units", "Soap", "Paper Products",
    "Toilet Products", "Urinal Products", "Hand Sanitizer", "Consumables", "Other Washroom",
  ],
  "Sanitary Bins": [
    "Sanitary Bins", "Sani Powder", "Plastic Liners / Packets", "Deodorisers",
    "Consumables", "Replacement Bins", "Other Sanitary Bins",
  ],
  "Deep Cleaning": [
    "Cleaning Chemicals", "Equipment", "Consumables", "PPE", "Tools", "Other Deep Cleaning",
  ],
  "Dustmats": [
    "Dustmats", "Replacement Mats", "Cleaning", "Other Dustmats",
  ],
  "Hygiene": [
    "Hygiene Equipment", "Hygiene Refills", "Consumables", "Other Hygiene",
  ],
};

const GENERAL_CATEGORIES = [
  "General", "Consumables", "Equipment", "Tools", "PPE", "Chemicals", "Other",
];

function getCategoriesForDept(deptName: string | undefined): string[] {
  if (!deptName) return GENERAL_CATEGORIES;
  const match = Object.keys(DEPT_CATEGORIES).find(
    k => deptName.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(deptName.toLowerCase())
  );
  return match ? DEPT_CATEGORIES[match] : GENERAL_CATEGORIES;
}

// ── Form schema ───────────────────────────────────────────────────────────────
const inventoryFormSchema = insertInventoryItemSchema.extend({
  name: z.string().min(1, "Item name is required"),
  type: z.string().min(1, "Type is required"),
  sku: z.string().optional(),
  costPrice: z.string().optional().transform(v => v && v !== "" ? v : undefined),
  sellingPrice: z.string().optional().transform(v => v && v !== "" ? v : undefined),
  unitPrice: z.string().optional().transform(v => v && v !== "" ? v : undefined),
  quantity: z.number().min(0, "Quantity must be 0 or greater"),
  category: z.string().optional(),
  departmentId: z.string().optional(),
});

type InventoryFormData = z.infer<typeof inventoryFormSchema>;

interface InventoryFormProps {
  item?: InventoryItem | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function InventoryForm({ item, onSuccess, onCancel }: InventoryFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  const form = useForm<InventoryFormData>({
    resolver: zodResolver(inventoryFormSchema),
    defaultValues: {
      name:          item?.name          ?? "",
      type:          item?.type          ?? "Consumable",
      sku:           item?.sku           ?? "",
      quantity:      item?.quantity      ?? 0,
      minStockLevel: item?.minStockLevel ?? 5,
      maxStockLevel: item?.maxStockLevel ?? 100,
      reorderPoint:  item?.reorderPoint  ?? 10,
      costPrice:     item?.costPrice     ?? "",
      sellingPrice:  item?.sellingPrice  ?? "",
      unitPrice:     item?.unitPrice     ?? "",
      description:   item?.description  ?? "",
      departmentId:  item?.departmentId  ?? "",
      category:      item?.category      ?? "",
      location:      item?.location      ?? "",
      supplier:      item?.supplier      ?? "",
    },
  });

  // watch departmentId to drive dynamic category list
  const watchedDeptId = form.watch("departmentId");
  const selectedDept = departments.find(d => d.id === watchedDeptId);
  const categoryOptions = getCategoriesForDept(selectedDept?.name);

  const createMutation = useMutation({
    mutationFn: (data: InventoryFormData) => apiRequest("POST", "/api/inventory", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      toast({ title: "Item created", description: "Stock item saved successfully." });
      onSuccess();
    },
    onError: (err: any) => {
      const msg = err?.message || "Failed to create inventory item";
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: InventoryFormData) => apiRequest("PUT", `/api/inventory/${item!.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      toast({ title: "Item updated", description: "Stock item saved successfully." });
      onSuccess();
    },
    onError: (err: any) => {
      const msg = err?.message || "Failed to update inventory item";
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const onSubmit = (data: InventoryFormData) => {
    const payload = {
      ...data,
      departmentId: data.departmentId === "__none__" || !data.departmentId ? undefined : data.departmentId,
      unitPrice: data.sellingPrice || data.unitPrice,
    };
    if (item) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <h2 className="text-lg font-semibold">
          {item ? "Edit Stock Item" : "Add New Stock Item"}
        </h2>

        {/* ── Row 1: Name + SKU ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem>
              <FormLabel>Item Name <span className="text-red-500">*</span></FormLabel>
              <FormControl><Input placeholder="e.g. Hand Sanitizer Dispenser - Automatic" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="sku" render={({ field }) => (
            <FormItem>
              <FormLabel>SKU <span className="text-xs font-normal text-gray-400">(optional — auto-generated)</span></FormLabel>
              <FormControl><Input placeholder="e.g. HSD-AUTO-001" {...field} value={field.value ?? ""} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        {/* ── Row 2: Type + Department ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField control={form.control} name="type" render={({ field }) => (
            <FormItem>
              <FormLabel>Type <span className="text-red-500">*</span></FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                <SelectContent>
                  {ITEM_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="departmentId" render={({ field }) => (
            <FormItem>
              <FormLabel>Department</FormLabel>
              <Select
                onValueChange={v => {
                  field.onChange(v === "__none__" ? "" : v);
                  form.setValue("category", ""); // reset category when dept changes
                }}
                value={field.value || "__none__"}
              >
                <FormControl><SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="__none__">All Departments / General</SelectItem>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        {/* ── Row 3: Category ── */}
        <FormField control={form.control} name="category" render={({ field }) => (
          <FormItem>
            <FormLabel>Category</FormLabel>
            <Select onValueChange={field.onChange} value={field.value || ""}>
              <FormControl><SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger></FormControl>
              <SelectContent>
                <SelectItem value="">No category</SelectItem>
                {categoryOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />

        {/* ── Row 4: Quantity ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField control={form.control} name="quantity" render={({ field }) => (
            <FormItem>
              <FormLabel>Quantity on Hand</FormLabel>
              <FormControl>
                <Input type="number" min={0} placeholder="0"
                  {...field} onChange={e => field.onChange(parseInt(e.target.value) || 0)} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="location" render={({ field }) => (
            <FormItem className="md:col-span-2">
              <FormLabel>Storage Location</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Main Warehouse - Shelf A3" {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        {/* ── Pricing ── */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-700 border-b pb-1">Pricing (ZAR)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={form.control} name="costPrice" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-gray-600">
                  Cost Price <span className="text-xs font-normal text-gray-400">(what you pay)</span>
                </FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" min="0" placeholder="0.00" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="sellingPrice" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-green-700 font-semibold">
                  Selling Price <span className="text-xs font-normal text-gray-400">(charged to client)</span>
                </FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" min="0" placeholder="0.00"
                    className="border-green-300 focus:border-green-500"
                    {...field} value={field.value ?? ""} />
                </FormControl>
                <p className="text-xs text-green-600 mt-0.5">Auto-fills in contracts</p>
                <FormMessage />
              </FormItem>
            )} />
          </div>
        </div>

        {/* ── Stock levels ── */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-700 border-b pb-1">Stock Levels</h3>
          <div className="grid grid-cols-3 gap-4">
            <FormField control={form.control} name="minStockLevel" render={({ field }) => (
              <FormItem>
                <FormLabel>Minimum</FormLabel>
                <FormControl>
                  <Input type="number" min={0} placeholder="5"
                    {...field} onChange={e => field.onChange(parseInt(e.target.value) || 0)} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="reorderPoint" render={({ field }) => (
              <FormItem>
                <FormLabel>Reorder At</FormLabel>
                <FormControl>
                  <Input type="number" min={0} placeholder="10"
                    {...field} onChange={e => field.onChange(parseInt(e.target.value) || 0)} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="maxStockLevel" render={({ field }) => (
              <FormItem>
                <FormLabel>Maximum</FormLabel>
                <FormControl>
                  <Input type="number" min={0} placeholder="100"
                    {...field} onChange={e => field.onChange(parseInt(e.target.value) || 0)} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
        </div>

        {/* ── Supplier + Description ── */}
        <FormField control={form.control} name="supplier" render={({ field }) => (
          <FormItem>
            <FormLabel>Supplier</FormLabel>
            <FormControl>
              <Input placeholder="e.g. HygieneTech Solutions" {...field} value={field.value ?? ""} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="description" render={({ field }) => (
          <FormItem>
            <FormLabel>Description</FormLabel>
            <FormControl>
              <Textarea placeholder="Optional description…" className="min-h-[80px]"
                {...field} value={field.value ?? ""} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>Cancel</Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving…" : item ? "Update Item" : "Add Item"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
