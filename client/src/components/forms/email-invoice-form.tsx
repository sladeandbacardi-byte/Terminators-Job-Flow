import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormField, FormItem, FormLabel, FormMessage, FormControl } from "@/components/ui/form";
import { Mail, Send, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Invoice, Client } from "@shared/schema";

const emailInvoiceSchema = z.object({
  email: z.string().email("Please enter a valid email address").optional(),
  username: z.string().min(1, "Outlook email is required"),
  password: z.string().min(1, "Password is required"),
});

type EmailInvoiceForm = z.infer<typeof emailInvoiceSchema>;

interface EmailInvoiceFormProps {
  invoice: Invoice;
  client: Client;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function EmailInvoiceForm({ invoice, client, onSuccess, onCancel }: EmailInvoiceFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<EmailInvoiceForm>({
    resolver: zodResolver(emailInvoiceSchema),
    defaultValues: {
      email: client.email || "",
      username: "",
      password: "",
    },
  });

  const handleSubmit = async (data: EmailInvoiceForm) => {
    setIsSubmitting(true);
    try {
      const result = await apiRequest("POST", `/api/invoices/${invoice.id}/send-email`, {
        body: JSON.stringify(data),
      });

      toast({
        title: "Success",
        description: `Invoice email sent to ${data.email || client.email}`,
      });

      onSuccess?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send invoice email",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
          <Mail className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Email Invoice</h3>
          <p className="text-sm text-gray-600">
            Send invoice {invoice.invoiceNumber} to {client.name}
          </p>
        </div>
      </div>

      <div className="bg-gray-50 p-4 rounded-lg">
        <h4 className="font-medium text-gray-900 mb-2">Invoice Details</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Invoice Number:</span>
            <span className="ml-2 font-medium">{invoice.invoiceNumber}</span>
          </div>
          <div>
            <span className="text-gray-600">Amount:</span>
            <span className="ml-2 font-medium">R{parseFloat(invoice.total).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
          </div>
          <div>
            <span className="text-gray-600">Due Date:</span>
            <span className="ml-2 font-medium">{new Date(invoice.dueDate).toLocaleDateString()}</span>
          </div>
          <div>
            <span className="text-gray-600">Status:</span>
            <span className="ml-2 font-medium capitalize">{invoice.status}</span>
          </div>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Recipient Email (Optional)</FormLabel>
                <FormControl>
                  <Input 
                    {...field}
                    type="email"
                    placeholder={client.email || "Enter email address"}
                    data-testid="input-recipient-email"
                  />
                </FormControl>
                <p className="text-sm text-gray-600">
                  Leave blank to use client's email: {client.email}
                </p>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
            <h4 className="font-medium text-yellow-900 mb-2">Outlook Authentication Required</h4>
            <p className="text-sm text-yellow-800 mb-4">
              Enter your Microsoft Outlook credentials to send emails from your account.
            </p>
            
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Your Outlook Email</FormLabel>
                    <FormControl>
                      <Input 
                        {...field}
                        type="email"
                        placeholder="your-email@outlook.com"
                        data-testid="input-outlook-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Outlook Password</FormLabel>
                    <FormControl>
                      <Input 
                        {...field}
                        type="password"
                        placeholder="Your password"
                        data-testid="input-outlook-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              data-testid="button-cancel-email"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              data-testid="button-send-email"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Invoice
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}