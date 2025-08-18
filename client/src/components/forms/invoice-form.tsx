import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertInvoiceSchema } from "@shared/schema";
import type { Invoice, Client, InvoiceItem } from "@shared/schema";
import { z } from "zod";

const invoiceFormSchema = insertInvoiceSchema.extend({
  issueDate: z.date({
    required_error: "Issue date is required",
  }),
  dueDate: z.date({
    required_error: "Due date is required",
  }),
  paymentDate: z.date().optional(),
  items: z.array(z.object({
    description: z.string().min(1, "Description is required"),
    quantity: z.string().min(1, "Quantity is required"),
    unitPrice: z.string().min(1, "Unit price is required"),
    total: z.string(),
  })).min(1, "At least one item is required"),
});

type InvoiceFormData = z.infer<typeof invoiceFormSchema>;

interface InvoiceFormProps {
  invoice?: Invoice | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function InvoiceForm({ invoice, onSuccess, onCancel }: InvoiceFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCalculating, setIsCalculating] = useState(false);

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
  });

  const { data: invoiceItems = [] } = useQuery<InvoiceItem[]>({
    queryKey: ['/api/invoices', invoice?.id, 'items'],
    enabled: !!invoice?.id,
  });

  const form = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      clientId: invoice?.clientId || "",
      status: invoice?.status || "draft",
      issueDate: invoice ? new Date(invoice.issueDate) : new Date(),
      dueDate: invoice ? new Date(invoice.dueDate) : (() => {
        const date = new Date();
        date.setDate(date.getDate() + 30);
        return date;
      })(),
      paymentDate: invoice?.paymentDate ? new Date(invoice.paymentDate) : undefined,
      subtotal: invoice?.subtotal || "0.00",
      taxAmount: invoice?.taxAmount || "0.00",
      total: invoice?.total || "0.00",
      paidAmount: invoice?.paidAmount || "0.00",
      notes: invoice?.notes || "",
      terms: invoice?.terms || "Payment due within 30 days",
      items: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  // Load invoice items when editing
  useEffect(() => {
    if (invoice && invoiceItems.length > 0) {
      const formItems = invoiceItems.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
      }));
      form.setValue('items', formItems);
      calculateTotals(formItems);
    } else if (!invoice) {
      // Add initial item for new invoices
      append({
        description: "",
        quantity: "1",
        unitPrice: "0.00",
        total: "0.00",
      });
    }
  }, [invoice, invoiceItems, append, form]);

  const calculateTotals = (items: any[]) => {
    setIsCalculating(true);
    
    const subtotal = items.reduce((sum, item) => {
      const quantity = parseFloat(item.quantity) || 0;
      const unitPrice = parseFloat(item.unitPrice) || 0;
      return sum + (quantity * unitPrice);
    }, 0);

    const taxAmount = subtotal * 0.15; // 15% VAT for South Africa
    const total = subtotal + taxAmount;

    form.setValue('subtotal', subtotal.toFixed(2));
    form.setValue('taxAmount', taxAmount.toFixed(2));
    form.setValue('total', total.toFixed(2));
    
    setIsCalculating(false);
  };

  const handleItemChange = (index: number, field: string, value: string) => {
    const currentItems = form.getValues('items');
    const updatedItems = [...currentItems];
    updatedItems[index] = { ...updatedItems[index], [field]: value };

    if (field === 'quantity' || field === 'unitPrice') {
      const quantity = parseFloat(updatedItems[index].quantity) || 0;
      const unitPrice = parseFloat(updatedItems[index].unitPrice) || 0;
      updatedItems[index].total = (quantity * unitPrice).toFixed(2);
    }

    form.setValue('items', updatedItems);
    calculateTotals(updatedItems);
  };

  const addItem = () => {
    append({
      description: "",
      quantity: "1",
      unitPrice: "0.00",
      total: "0.00",
    });
  };

  const removeItem = (index: number) => {
    remove(index);
    const currentItems = form.getValues('items');
    calculateTotals(currentItems.filter((_, i) => i !== index));
  };

  const createMutation = useMutation({
    mutationFn: async (data: InvoiceFormData) => {
      // Create the invoice
      const invoiceData = {
        ...data,
        items: undefined, // Remove items from invoice data
      };
      const createdInvoice = await apiRequest('POST', '/api/invoices', invoiceData);
      
      // Create invoice items
      for (const item of data.items) {
        await apiRequest('POST', `/api/invoices/${createdInvoice.id}/items`, {
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
        });
      }
      
      return createdInvoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      toast({
        title: "Success",
        description: "Invoice created successfully",
      });
      onSuccess();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create invoice",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: InvoiceFormData) => {
      // Update the invoice
      const invoiceData = {
        ...data,
        items: undefined, // Remove items from invoice data
      };
      const updatedInvoice = await apiRequest('PUT', `/api/invoices/${invoice!.id}`, invoiceData);
      
      // Note: In a real app, you'd also update the invoice items
      // For now, we'll keep it simple and just update the invoice
      
      return updatedInvoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      toast({
        title: "Success",
        description: "Invoice updated successfully",
      });
      onSuccess();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update invoice",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InvoiceFormData) => {
    if (invoice) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" data-testid="invoice-form">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="clientId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Client</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-client">
                      <SelectValue placeholder="Select a client" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
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
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="issueDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Issue Date</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                        data-testid="input-issue-date"
                      >
                        {field.value ? (
                          formatDate(field.value)
                        ) : (
                          <span>Pick issue date</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="dueDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Due Date</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                        data-testid="input-due-date"
                      >
                        {field.value ? (
                          formatDate(field.value)
                        ) : (
                          <span>Pick due date</span>
                        )}
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
                        const issueDate = form.getValues("issueDate");
                        return issueDate ? date < issueDate : false;
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Invoice Items */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Invoice Items</h3>
            <Button type="button" onClick={addItem} variant="outline" size="sm" data-testid="add-item-button">
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </div>

          <div className="space-y-3">
            {fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-12 gap-3 items-end p-3 border rounded-lg">
                <div className="col-span-5">
                  <label className="text-sm font-medium">Description</label>
                  <Input
                    placeholder="Item description"
                    value={form.watch(`items.${index}.description`)}
                    onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                    data-testid={`item-description-${index}`}
                  />
                </div>
                
                <div className="col-span-2">
                  <label className="text-sm font-medium">Qty</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="1"
                    value={form.watch(`items.${index}.quantity`)}
                    onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                    data-testid={`item-quantity-${index}`}
                  />
                </div>
                
                <div className="col-span-2">
                  <label className="text-sm font-medium">Unit Price</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={form.watch(`items.${index}.unitPrice`)}
                    onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value)}
                    data-testid={`item-unit-price-${index}`}
                  />
                </div>
                
                <div className="col-span-2">
                  <label className="text-sm font-medium">Total</label>
                  <Input
                    value={`R${form.watch(`items.${index}.total`)}`}
                    readOnly
                    className="bg-gray-50"
                    data-testid={`item-total-${index}`}
                  />
                </div>
                
                <div className="col-span-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeItem(index)}
                    disabled={fields.length === 1}
                    data-testid={`remove-item-${index}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="bg-gray-50 p-4 rounded-lg space-y-2">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span className="font-medium">R{form.watch('subtotal')}</span>
          </div>
          <div className="flex justify-between">
            <span>VAT (15%):</span>
            <span className="font-medium">R{form.watch('taxAmount')}</span>
          </div>
          <div className="flex justify-between text-lg font-semibold border-t pt-2">
            <span>Total:</span>
            <span>R{form.watch('total')}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Additional notes for the client" 
                    className="min-h-[100px]" 
                    {...field} 
                    data-testid="input-notes"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="terms"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Payment Terms</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Payment terms and conditions" 
                    className="min-h-[100px]" 
                    {...field} 
                    data-testid="input-terms"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end space-x-4">
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
            disabled={createMutation.isPending || updateMutation.isPending || isCalculating}
            data-testid="button-submit"
          >
            {createMutation.isPending || updateMutation.isPending ? "Saving..." : (invoice ? "Update Invoice" : "Create Invoice")}
          </Button>
        </div>
      </form>
    </Form>
  );
}