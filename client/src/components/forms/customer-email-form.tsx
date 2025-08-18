import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormField, FormItem, FormLabel, FormMessage, FormControl } from "@/components/ui/form";
import { Mail, Send, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Client } from "@shared/schema";

const customerEmailSchema = z.object({
  clientId: z.string().min(1, "Please select a client"),
  subject: z.string().min(1, "Subject is required"),
  message: z.string().min(10, "Message must be at least 10 characters long"),
  username: z.string().min(1, "Outlook email is required"),
  password: z.string().min(1, "Password is required"),
});

type CustomerEmailForm = z.infer<typeof customerEmailSchema>;

interface CustomerEmailFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  preselectedClientId?: string;
}

export default function CustomerEmailForm({ onSuccess, onCancel, preselectedClientId }: CustomerEmailFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
  });

  const form = useForm<CustomerEmailForm>({
    resolver: zodResolver(customerEmailSchema),
    defaultValues: {
      clientId: preselectedClientId || "",
      subject: "",
      message: "",
      username: "",
      password: "",
    },
  });

  const selectedClientId = form.watch("clientId");
  const selectedClient = clients.find(c => c.id === selectedClientId);

  const handleSubmit = async (data: CustomerEmailForm) => {
    setIsSubmitting(true);
    try {
      const result = await apiRequest("POST", "/api/send-customer-email", {
        body: JSON.stringify(data),
      });

      toast({
        title: "Success",
        description: `Email sent to ${selectedClient?.name}`,
      });

      onSuccess?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send email",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
          <Mail className="h-6 w-6 text-green-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Send Email to Customer</h3>
          <p className="text-sm text-gray-600">
            Send a custom email to your clients
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="clientId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Select Client</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-client">
                      <SelectValue placeholder="Choose a client to email" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name} {client.email && `(${client.email})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedClient && (
                  <p className="text-sm text-gray-600">
                    Email will be sent to: {selectedClient.email || "No email address on file"}
                  </p>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          {selectedClient && !selectedClient.email && (
            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <p className="text-sm text-red-800">
                <strong>Warning:</strong> This client doesn't have an email address on file. 
                Please update their contact information before sending emails.
              </p>
            </div>
          )}

          <FormField
            control={form.control}
            name="subject"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Subject</FormLabel>
                <FormControl>
                  <Input 
                    {...field}
                    placeholder="Enter email subject"
                    data-testid="input-email-subject"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="message"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Message</FormLabel>
                <FormControl>
                  <Textarea 
                    {...field}
                    placeholder="Write your message here..."
                    rows={6}
                    data-testid="textarea-email-message"
                  />
                </FormControl>
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
              disabled={isSubmitting || !selectedClient?.email}
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
                  Send Email
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}