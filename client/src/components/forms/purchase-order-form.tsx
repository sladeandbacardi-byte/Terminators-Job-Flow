import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2, Package } from "lucide-react";
import { insertPurchaseOrderSchema, type PurchaseOrder, type Supplier, type InventoryItem } from "@shared/schema";

const formSchema = insertPurchaseOrderSchema.extend({
  expectedDeliveryDate: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    inventoryItemId: z.string().min(1, "Please select an item"),
    quantity: z.number().min(1, "Quantity must be at least 1"),
    unitPrice: z.string().min(1, "Unit price is required"),
    notes: z.string().optional(),
  })).min(1, "At least one item is required"),
});

type FormValues = z.infer<typeof formSchema>;

interface PurchaseOrderFormProps {
  purchaseOrder?: PurchaseOrder;
  onSubmit: (data: z.infer<typeof formSchema>) => void;
  onCancel: () => void;
}

export function PurchaseOrderForm({ purchaseOrder, onSubmit, onCancel }: PurchaseOrderFormProps) {
  const [selectedSupplier, setSelectedSupplier] = useState<string>("");

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });

  const { data: inventoryItems = [] } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory"],
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      poNumber: purchaseOrder?.poNumber || "",
      supplierId: purchaseOrder?.supplierId || "",
      requestedById: purchaseOrder?.requestedById || "user-1", // Default current user
      status: purchaseOrder?.status || "pending",
      totalAmount: purchaseOrder?.totalAmount || "0",
      expectedDeliveryDate: purchaseOrder?.expectedDeliveryDate ? 
        new Date(purchaseOrder.expectedDeliveryDate).toISOString().slice(0, 16) : "",
      notes: purchaseOrder?.notes || "",
      items: [{
        inventoryItemId: "",
        quantity: 1,
        unitPrice: "0",
        notes: "",
      }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control as any,
    name: "items",
  });

  const watchedItems = form.watch("items");

  // Calculate total amount when items change
  useEffect(() => {
    const total = watchedItems.reduce((sum, item) => {
      const quantity = item.quantity || 0;
      const unitPrice = parseFloat(item.unitPrice || "0");
      return sum + (quantity * unitPrice);
    }, 0);
    
    form.setValue("totalAmount", total.toFixed(2));
  }, [watchedItems, form]);

  // Filter inventory items by supplier when supplier changes
  const availableItems = selectedSupplier ? 
    inventoryItems.filter(item => item.supplier === suppliers.find(s => s.id === selectedSupplier)?.name) :
    inventoryItems;

  const getInventoryItemName = (itemId: string) => {
    const item = inventoryItems.find(i => i.id === itemId);
    return item ? `${item.name} (${item.sku})` : "Unknown Item";
  };

  const getStockLevel = (itemId: string) => {
    const item = inventoryItems.find(i => i.id === itemId);
    return item?.quantity || 0;
  };

  const getStockStatus = (itemId: string) => {
    const item = inventoryItems.find(i => i.id === itemId);
    if (!item) return "unknown";
    
    if (item.quantity <= item.minStockLevel) return "critical";
    if (item.quantity <= item.reorderPoint) return "low";
    if (item.quantity >= item.maxStockLevel) return "overstocked";
    return "normal";
  };

  const handleSubmit = (data: z.infer<typeof formSchema>) => {
    // Calculate total amount
    const totalAmount = data.items.reduce((sum, item) => {
      return sum + (item.quantity * parseFloat(item.unitPrice));
    }, 0);

    onSubmit({
      ...data,
      totalAmount: totalAmount.toString(),
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="supplierId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Supplier*</FormLabel>
                <Select 
                  onValueChange={(value) => {
                    field.onChange(value);
                    setSelectedSupplier(value);
                  }} 
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger data-testid="select-supplier">
                      <SelectValue placeholder="Select a supplier" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {suppliers.filter(s => s.isActive).map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
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
            name="expectedDeliveryDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Expected Delivery Date</FormLabel>
                <FormControl>
                  <Input 
                    type="datetime-local"
                    {...field} 
                    data-testid="input-delivery-date"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Enter any notes about this purchase order" 
                  {...field}
                  value={field.value ?? ""}
                  data-testid="textarea-notes"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Items Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Order Items
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.map((field, index) => (
              <div key={field.id} className="border rounded-lg p-4 space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium">Item #{index + 1}</h4>
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => remove(index)}
                      data-testid={`button-remove-item-${index}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name={`items.${index}.inventoryItemId`}
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Inventory Item*</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid={`select-item-${index}`}>
                              <SelectValue placeholder="Select item" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {availableItems.map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                <div className="flex items-center justify-between w-full">
                                  <span>{item.name} ({item.sku})</span>
                                  <div className="flex items-center gap-2 ml-2">
                                    <Badge variant="outline" className="text-xs">
                                      Stock: {item.quantity}
                                    </Badge>
                                    {getStockStatus(item.id) === "critical" && (
                                      <Badge variant="destructive" className="text-xs">Critical</Badge>
                                    )}
                                    {getStockStatus(item.id) === "low" && (
                                      <Badge variant="secondary" className="text-xs">Low</Badge>
                                    )}
                                  </div>
                                </div>
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
                    name={`items.${index}.quantity`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantity*</FormLabel>
                        <FormControl>
                          <Input 
                            type="number"
                            min="1"
                            placeholder="0"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            data-testid={`input-quantity-${index}`}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`items.${index}.unitPrice`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit Price*</FormLabel>
                        <FormControl>
                          <Input 
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            {...field}
                            data-testid={`input-unit-price-${index}`}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name={`items.${index}.notes`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Item Notes</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Optional notes for this item"
                          {...field}
                          data-testid={`input-item-notes-${index}`}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Show item summary */}
                {watchedItems[index]?.inventoryItemId && (
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-medium">
                        {getInventoryItemName(watchedItems[index].inventoryItemId)}
                      </span>
                      <div className="flex items-center gap-2">
                        <span>Current Stock: {getStockLevel(watchedItems[index].inventoryItemId)}</span>
                        <span className="font-medium">
                          Line Total: R{(watchedItems[index].quantity * parseFloat(watchedItems[index].unitPrice || "0")).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              onClick={() => append({
                inventoryItemId: "",
                quantity: 1,
                unitPrice: "0",
                notes: "",
              })}
              className="w-full"
              data-testid="button-add-item"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Another Item
            </Button>
          </CardContent>
        </Card>

        {/* Total Summary */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-center text-lg font-semibold">
              <span>Total Amount:</span>
              <span data-testid="total-amount">R{form.watch("totalAmount") || "0.00"}</span>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end space-x-2">
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
            disabled={form.formState.isSubmitting}
            data-testid="button-submit"
          >
            {purchaseOrder ? "Update Purchase Order" : "Create Purchase Order"}
          </Button>
        </div>
      </form>
    </Form>
  );
}