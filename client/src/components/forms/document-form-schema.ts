import { z } from "zod";

export const lineItemSchema = z.object({
  description: z.string().min(1, "Description required"),
  quantity: z.string().min(1, "Required"),
  unitPrice: z.string().min(1, "Required"),
  total: z.string(),
});

export const documentFormSchema = z.object({
  companyName: z.string().optional(),
  contactPerson: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  streetNumber: z.string().optional(),
  streetName: z.string().optional(),
  area: z.string().optional(),
  town: z.string().optional(),
  serviceType: z.string().optional(),
  preferredContactMethod: z.string().optional(),
  assignedTo: z.string().optional(),
  validityDays: z.string().optional(),
  clientId: z.string().optional(),
  status: z.string().optional(),
  issueDate: z.date().optional(),
  dueDate: z.date().optional(),
  terms: z.string().optional(),
  lineItems: z.array(lineItemSchema).min(1, "Add at least one item"),
  subtotal: z.string().default("0.00"),
  vatAmount: z.string().default("0.00"),
  totalAmount: z.string().default("0.00"),
  notes: z.string().optional(),
  origination: z.string().optional(),
  originationOther: z.string().optional(),
});

export type DocumentFormValues = z.infer<typeof documentFormSchema>;
export type DocType = "lead" | "quote" | "invoice";
