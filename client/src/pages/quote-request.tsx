import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Bug, Droplet, Sparkles, Trash2 } from "lucide-react";

const quoteRequestSchema = z.object({
  companyName: z.string().min(2, "Company name is required"),
  contactPerson: z.string().min(2, "Contact person is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().min(10, "Valid phone number is required"),
  serviceType: z.enum(["pest_control", "sanitary_bins", "washroom", "deep_cleaning"], {
    required_error: "Please select a service type",
  }),
  description: z.string().min(20, "Please provide at least 20 characters describing your needs"),
  address: z.string().optional(),
  preferredContactMethod: z.enum(["email", "phone", "either"]).default("email"),
});

type QuoteRequestForm = z.infer<typeof quoteRequestSchema>;

export default function QuoteRequest() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const form = useForm<QuoteRequestForm>({
    resolver: zodResolver(quoteRequestSchema),
    defaultValues: {
      companyName: "",
      contactPerson: "",
      email: "",
      phone: "",
      description: "",
      address: "",
      preferredContactMethod: "email",
    },
  });

  const onSubmit = async (data: QuoteRequestForm) => {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/public/quote-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Failed to submit quote request");
      }

      setIsSuccess(true);
      form.reset();
    } catch (error) {
      console.error("Quote submission error:", error);
      alert("Failed to submit quote request. Please try again or contact us directly.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const services = [
    { value: "pest_control", label: "Pest Control", icon: Bug, color: "text-green-600" },
    { value: "sanitary_bins", label: "Sanitary Bins", icon: Trash2, color: "text-purple-600" },
    { value: "washroom", label: "Washroom Services", icon: Droplet, color: "text-blue-600" },
    { value: "deep_cleaning", label: "Deep Cleaning", icon: Sparkles, color: "text-orange-600" },
  ];

  if (isSuccess) {
    return (
    <>
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <CheckCircle2 className="h-16 w-16 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Quote Request Submitted!</CardTitle>
            <CardDescription className="text-base mt-2">
              Thank you for your interest. We'll review your request and contact you within 24 hours.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => setIsSuccess(false)} 
              className="w-full"
              data-testid="button-submit-another"
            >
              Submit Another Request
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Request a Quote</h1>
          <p className="text-lg text-gray-600">
            Tell us about your needs and we'll get back to you with a customized solution
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {services.map((service) => {
            const Icon = service.icon;
            return (
              <Card key={service.value} className="text-center hover:shadow-lg transition-shadow">
                <CardContent className="pt-6">
                  <Icon className={`h-10 w-10 mx-auto mb-2 ${service.color}`} />
                  <p className="text-sm font-medium text-gray-700">{service.label}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Quote Request Form</CardTitle>
            <CardDescription>
              Fill out the form below and we'll contact you with pricing and availability
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="companyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Name *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Your Company Ltd" 
                            {...field} 
                            data-testid="input-company-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="contactPerson"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Person *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="John Smith" 
                            {...field} 
                            data-testid="input-contact-person"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address *</FormLabel>
                        <FormControl>
                          <Input 
                            type="email" 
                            placeholder="john@company.com" 
                            {...field} 
                            data-testid="input-email"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number *</FormLabel>
                        <FormControl>
                          <Input 
                            type="tel" 
                            placeholder="+27 11 123 4567" 
                            {...field} 
                            data-testid="input-phone"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="serviceType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Service Type *</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                        data-testid="select-service-type"
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a service" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="pest_control">Pest Control</SelectItem>
                          <SelectItem value="sanitary_bins">Sanitary Bins</SelectItem>
                          <SelectItem value="washroom">Washroom Services</SelectItem>
                          <SelectItem value="deep_cleaning">Deep Cleaning</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Service Address (Optional)</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="123 Main Street, City" 
                          {...field} 
                          data-testid="input-address"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description *</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Please describe your requirements, facility size, frequency needed, and any specific concerns..."
                          className="min-h-[120px]"
                          {...field}
                          data-testid="textarea-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="preferredContactMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preferred Contact Method *</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                        data-testid="select-contact-method"
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="phone">Phone</SelectItem>
                          <SelectItem value="either">Either</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isSubmitting}
                  data-testid="button-submit-quote"
                >
                  {isSubmitting ? "Submitting..." : "Submit Quote Request"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <div className="mt-8 text-center text-sm text-gray-600">
          <p>Have questions? Call us at <a href="tel:+27111234567" className="text-blue-600 hover:underline">+27 11 123 4567</a></p>
          <p className="mt-1">Or email <a href="mailto:quotes@theterminators.co.za" className="text-blue-600 hover:underline">quotes@theterminators.co.za</a></p>
        </div>
      </div>
    </div>
  );
}
