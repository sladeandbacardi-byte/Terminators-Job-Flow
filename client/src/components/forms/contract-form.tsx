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
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertRentalContractSchema } from "@shared/schema";
import type { RentalContract, Client, InventoryItem } from "@shared/schema";
import { z } from "zod";

const contractFormSchema = insertRentalContractSchema.extend({
  startDate: z.date({
    required_error: "Start date is required",
  }),
  endDate: z.date().optional(),
  lastPriceIncrease: z.date().optional(),
  monthlyPrice: z.string().min(1, "Monthly price is required").transform((val) => val),
});

type ContractFormData = z.infer<typeof contractFormSchema>;

interface ContractFormProps {
  contract?: RentalContract | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function ContractForm({ contract, onSuccess, onCancel }: ContractFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
  });

  const { data: inventoryItems = [] } = useQuery<InventoryItem[]>({
    queryKey: ['/api/inventory'],
    select: (items) => items.filter(item => item.type === 'rental_equipment'),
  });

  const form = useForm<ContractFormData>({
    resolver: zodResolver(contractFormSchema),
    defaultValues: {
      clientId: contract?.clientId || "",
      inventoryItemId: contract?.inventoryItemId || "",
      monthlyPrice: contract?.monthlyPrice || "",
      startDate: contract ? new Date(contract.startDate) : new Date(),
      endDate: contract?.endDate ? new Date(contract.endDate) : undefined,
      lastPriceIncrease: contract?.lastPriceIncrease ? new Date(contract.lastPriceIncrease) : undefined,
      isActive: contract?.isActive ?? true,
      notes: contract?.notes || "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: ContractFormData) => apiRequest('POST', '/api/contracts', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contracts'] });
      toast({
        title: "Success",
        description: "Contract created successfully",
      });
      onSuccess();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create contract",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: ContractFormData) => apiRequest('PUT', `/api/contracts/${contract!.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contracts'] });
      toast({
        title: "Success",
        description: "Contract updated successfully",
      });
      onSuccess();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update contract",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ContractFormData) => {
    if (contract) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" data-testid="contract-form">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">
            {contract ? "Edit Rental Contract" : "Create New Rental Contract"}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              name="inventoryItemId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rental Equipment</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-equipment">
                        <SelectValue placeholder="Select equipment" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {inventoryItems.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name} ({item.sku})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="monthlyPrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Monthly Price (ZAR)</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    step="0.01"
                    placeholder="1500.00" 
                    {...field} 
                    data-testid="input-monthly-price"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Start Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                          data-testid="input-start-date"
                        >
                          {field.value ? (
                            formatDate(field.value)
                          ) : (
                            <span>Pick start date</span>
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
              name="endDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>End Date (Optional)</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                          data-testid="input-end-date"
                        >
                          {field.value ? (
                            formatDate(field.value)
                          ) : (
                            <span>Pick end date</span>
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
                          const startDate = form.getValues("startDate");
                          return startDate ? date < startDate : false;
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

          <FormField
            control={form.control}
            name="lastPriceIncrease"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Last Price Increase (Optional)</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                        data-testid="input-price-increase"
                      >
                        {field.value ? (
                          formatDate(field.value)
                        ) : (
                          <span>Select date of last increase</span>
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
                      disabled={(date) => date > new Date()}
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
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Additional contract notes or terms" 
                    className="min-h-[100px]" 
                    {...field}
                    value={field.value || ""}
                    data-testid="input-notes"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    data-testid="checkbox-active"
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Active Contract</FormLabel>
                  <p className="text-sm text-muted-foreground">
                    Contract is currently active and billing
                  </p>
                </div>
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
            disabled={createMutation.isPending || updateMutation.isPending}
            data-testid="button-submit"
          >
            {createMutation.isPending || updateMutation.isPending ? "Saving..." : (contract ? "Update Contract" : "Create Contract")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
