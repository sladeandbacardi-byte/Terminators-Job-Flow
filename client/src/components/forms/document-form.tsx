import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Trash2, FileText, Receipt, Briefcase, CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { Worker, Client } from "@shared/schema";

// ── service catalogue ─────────────────────────────────────────────────────────

const SERVICE_CATALOGUE = [
  { group: "Pest Control", items: [
    "General Pest Control Treatment",
    "Termite (White Ant) Treatment",
    "Fumigation",
    "Rodent Control",
    "Cockroach Treatment",
    "Ant Treatment",
    "Fly Control",
    "Mosquito Treatment",
    "Bird Control / Proofing",
    "Bed Bug Treatment",
    "Flea Treatment",
  ]},
  { group: "Sanitary Bins", items: [
    "Sanitary Bin Supply & Monthly Collection",
    "Sanitary Bin Quarterly Service",
    "Sanitary Bin Rental",
    "Nappy Disposal Service",
    "Medical Waste Disposal",
  ]},
  { group: "Washroom", items: [
    "Washroom Hygiene Monthly Service",
    "Air Freshener / Deodoriser Service",
    "Liquid Soap Dispenser Service",
    "Hand Sanitizer Dispenser Service",
    "Hand Dryer Maintenance",
    "Toilet Roll / Paper Dispenser Service",
    "Urinal Hygiene Service",
    "Feminine Hygiene Bag Service",
  ]},
  { group: "Deep Cleaning", items: [
    "Deep Cleaning Service",
    "Office Deep Clean",
    "Industrial / Factory Deep Clean",
    "Kitchen / Canteen Deep Clean",
    "Carpet Cleaning",
    "Upholstery Cleaning",
    "Window & Glass Cleaning",
    "High-Pressure Cleaning",
    "Post-Construction Clean",
  ]},
  { group: "General / Other", items: [
    "Site Inspection",
    "Consultation / Survey",
    "Call-out Fee",
    "After-Hours Service",
    "Emergency Response",
    "Training & Awareness",
    "Certificate of Treatment",
    "Annual Contract Service",
  ]},
];

// ── schemas ───────────────────────────────────────────────────────────────────

export const lineItemSchema = z.object({
  description: z.string().min(1, "Description required"),
  quantity: z.string().min(1, "Required"),
  unitPrice: z.string().min(1, "Required"),
  total: z.string(),
});

export const documentFormSchema = z.object({
  // Client info (lead / quote)
  companyName: z.string().optional(),
  contactPerson: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  // Split address fields
  streetNumber: z.string().optional(),
  streetName: z.string().optional(),
  area: z.string().optional(),
  town: z.string().optional(),
  serviceType: z.string().optional(),
  preferredContactMethod: z.string().optional(),
  assignedTo: z.string().optional(),
  // Quote specific
  validityDays: z.string().optional(),
  // Invoice specific
  clientId: z.string().optional(),
  status: z.string().optional(),
  issueDate: z.date().optional(),
  dueDate: z.date().optional(),
  terms: z.string().optional(),
  // Line items + totals
  lineItems: z.array(lineItemSchema).min(1, "Add at least one item"),
  subtotal: z.string().default("0.00"),
  vatAmount: z.string().default("0.00"),
  totalAmount: z.string().default("0.00"),
  notes: z.string().optional(),
});

export type DocumentFormValues = z.infer<typeof documentFormSchema>;

// ── types ─────────────────────────────────────────────────────────────────────

export type DocType = "lead" | "quote" | "invoice";

interface DocumentFormProps {
  docType: DocType;
  defaultValues?: Partial<DocumentFormValues>;
  salesWorkers?: Worker[];
  clients?: Client[];
  isPending?: boolean;
  onSubmit: (data: DocumentFormValues) => void;
  onCancel: () => void;
  submitLabel?: string;
  clientInfo?: {
    companyName: string;
    contactPerson: string;
    email: string;
    phone: string;
    address?: string;
    serviceType: string;
  };
}

// ── config ────────────────────────────────────────────────────────────────────

const DOC_CONFIG = {
  lead:    { label: "LEAD",    color: "text-blue-700",   bg: "bg-blue-50",   border: "border-blue-200",   btnClass: "bg-blue-600 hover:bg-blue-700",     icon: Briefcase },
  quote:   { label: "QUOTE",   color: "text-purple-700", bg: "bg-purple-50", border: "border-purple-200", btnClass: "bg-purple-600 hover:bg-purple-700", icon: FileText  },
  invoice: { label: "INVOICE", color: "text-green-700",  bg: "bg-green-50",  border: "border-green-200",  btnClass: "bg-green-600 hover:bg-green-700",   icon: Receipt   },
};

const DEPT_SERVICE_LABELS: Record<string, string> = {
  pest_control:  "Pest Control",
  sanitary_bins: "Sanitary Bins",
  washroom:      "Washroom",
  deep_cleaning: "Deep Cleaning",
};

const BLANK_ITEM = { description: "", quantity: "1", unitPrice: "0.00", total: "0.00" };

// ── component ─────────────────────────────────────────────────────────────────

export default function DocumentForm({
  docType,
  defaultValues,
  salesWorkers = [],
  clients = [],
  isPending,
  onSubmit,
  onCancel,
  submitLabel,
  clientInfo,
}: DocumentFormProps) {
  const cfg = DOC_CONFIG[docType];
  const Icon = cfg.icon;

  const dueDefault = new Date();
  dueDefault.setDate(dueDefault.getDate() + 30);

  const form = useForm<DocumentFormValues>({
    resolver: zodResolver(documentFormSchema),
    defaultValues: {
      companyName: clientInfo?.companyName ?? "",
      contactPerson: clientInfo?.contactPerson ?? "",
      email: clientInfo?.email ?? "",
      phone: clientInfo?.phone ?? "",
      streetNumber: "",
      streetName: "",
      area: "",
      town: "",
      serviceType: clientInfo?.serviceType ?? "",
      preferredContactMethod: "phone",
      assignedTo: "",
      validityDays: "30",
      clientId: "",
      status: "draft",
      issueDate: new Date(),
      dueDate: dueDefault,
      terms: "Payment due within 30 days.",
      lineItems: [{ ...BLANK_ITEM }],
      subtotal: "0.00",
      vatAmount: "0.00",
      totalAmount: "0.00",
      notes: "",
      ...defaultValues,
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "lineItems" });

  const recalc = (items: { quantity: string; unitPrice: string }[]) => {
    const sub = items.reduce((s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.unitPrice) || 0), 0);
    const vat = sub * 0.15;
    form.setValue("subtotal",    sub.toFixed(2));
    form.setValue("vatAmount",   vat.toFixed(2));
    form.setValue("totalAmount", (sub + vat).toFixed(2));
  };

  const handleItemChange = (idx: number, key: "description" | "quantity" | "unitPrice", val: string) => {
    const items = form.getValues("lineItems").map((it, i) => {
      if (i !== idx) return it;
      const updated = { ...it, [key]: val };
      updated.total = ((parseFloat(updated.quantity) || 0) * (parseFloat(updated.unitPrice) || 0)).toFixed(2);
      return updated;
    });
    form.setValue("lineItems", items);
    recalc(items);
  };

  // Unique datalist id to avoid collisions if multiple DocumentForms exist
  const datalistId = `svc-list-${docType}`;

  return (
    <Form {...form}>
      {/* Service suggestion datalist */}
      <datalist id={datalistId}>
        {SERVICE_CATALOGUE.flatMap(g => g.items).map(s => (
          <option key={s} value={s} />
        ))}
      </datalist>

      <form onSubmit={form.handleSubmit(onSubmit)}>

        {/* ── document header banner ── */}
        <div className={`rounded-t-lg px-5 py-3 ${cfg.bg} border ${cfg.border} flex items-center justify-between gap-3`}>
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-white/70">
              <Icon className={`h-4 w-4 ${cfg.color}`} />
            </div>
            <div>
              <p className={`text-xs font-bold tracking-widest uppercase ${cfg.color}`}>{cfg.label}</p>
              <p className="text-xs text-gray-500">The Terminators · {format(new Date(), "d MMM yyyy")}</p>
            </div>
          </div>

          {docType === "invoice" && (
            <FormField control={form.control} name="status" render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger className="h-7 text-xs w-28 bg-white/70 border-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["draft","sent","paid","overdue","cancelled"].map(s => (
                    <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )} />
          )}

          {docType === "quote" && (
            <div className="flex items-center gap-1.5 text-xs text-purple-600 font-medium">
              <CalendarIcon className="h-3.5 w-3.5" />
              <span>Valid for:</span>
              <FormField control={form.control} name="validityDays" render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger className="h-7 text-xs w-24 bg-white/70 border-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["7","14","30","60","90"].map(d => <SelectItem key={d} value={d}>{d} days</SelectItem>)}
                  </SelectContent>
                </Select>
              )} />
            </div>
          )}
        </div>

        {/* ── body ── */}
        <div className={`border border-t-0 ${cfg.border} rounded-b-lg p-5 space-y-5`}>

          {/* ── CLIENT SECTION ── */}
          <section>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
              {docType === "invoice" ? "Bill To" : "Client Details"}
            </p>

            {docType === "invoice" ? (
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="clientId" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Client <span className="text-red-500">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {clients.filter(c => c.status !== "suspended").map(c => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}{c.contactPerson ? ` — ${c.contactPerson}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="issueDate" render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Issue Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" className={cn("w-full pl-3 text-left font-normal text-sm", !field.value && "text-muted-foreground")}>
                            {field.value ? format(field.value, "d MMM yyyy") : "Pick date"}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="dueDate" render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Due Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" className={cn("w-full pl-3 text-left font-normal text-sm", !field.value && "text-muted-foreground")}>
                            {field.value ? format(field.value, "d MMM yyyy") : "Pick date"}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

            ) : clientInfo ? (
              /* Read-only client summary (quote pre-filled from lead) */
              <div className="bg-gray-50 rounded-lg p-3 grid grid-cols-2 gap-y-2 gap-x-4 text-sm border border-gray-100">
                <div><span className="text-xs text-gray-400 block">Business</span><strong>{clientInfo.companyName}</strong></div>
                <div><span className="text-xs text-gray-400 block">Contact</span>{clientInfo.contactPerson}</div>
                <div><span className="text-xs text-gray-400 block">Email</span>{clientInfo.email}</div>
                <div><span className="text-xs text-gray-400 block">Phone</span>{clientInfo.phone}</div>
                {clientInfo.address && <div className="col-span-2"><span className="text-xs text-gray-400 block">Address</span>{clientInfo.address}</div>}
                <div className="col-span-2"><span className="text-xs text-gray-400 block">Service</span>{DEPT_SERVICE_LABELS[clientInfo.serviceType] ?? clientInfo.serviceType}</div>
              </div>

            ) : (
              /* Editable client fields (new lead) */
              <div className="grid grid-cols-2 gap-3">

                {/* Business name */}
                <FormField control={form.control} name="companyName" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Business / Company Name <span className="text-red-500">*</span></FormLabel>
                    <FormControl><Input placeholder="e.g. Spar Newton Park" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Contact + Phone */}
                <FormField control={form.control} name="contactPerson" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Person <span className="text-red-500">*</span></FormLabel>
                    <FormControl><Input placeholder="Full name" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone <span className="text-red-500">*</span></FormLabel>
                    <FormControl><Input placeholder="+27 41 ..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Email + Preferred contact */}
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email <span className="text-red-500">*</span></FormLabel>
                    <FormControl><Input type="email" placeholder="email@company.co.za" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="preferredContactMethod" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preferred Contact</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="phone">📞 Phone Call</SelectItem>
                        <SelectItem value="whatsapp">💬 WhatsApp</SelectItem>
                        <SelectItem value="email">✉️ Email</SelectItem>
                        <SelectItem value="either">Any / Either</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />

                {/* Service type */}
                <FormField control={form.control} name="serviceType" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Service Department <span className="text-red-500">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select service department" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="pest_control">🐛 Pest Control</SelectItem>
                        <SelectItem value="sanitary_bins">🗑️ Sanitary Bins</SelectItem>
                        <SelectItem value="washroom">🚿 Washroom</SelectItem>
                        <SelectItem value="deep_cleaning">🧹 Deep Cleaning</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* ── ADDRESS — 4 separate boxes ── */}
                <div className="col-span-2">
                  <p className="text-sm font-medium mb-2">Service Address <span className="text-xs text-gray-400 font-normal">(optional)</span></p>
                  <div className="grid grid-cols-4 gap-2">
                    <FormField control={form.control} name="streetNumber" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-gray-500">Street No.</FormLabel>
                        <FormControl><Input placeholder="12" className="h-8 text-sm" {...field} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="streetName" render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel className="text-xs text-gray-500">Street Name</FormLabel>
                        <FormControl><Input placeholder="Main Road" className="h-8 text-sm" {...field} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="area" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-gray-500">Area / Suburb</FormLabel>
                        <FormControl><Input placeholder="Humewood" className="h-8 text-sm" {...field} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="town" render={({ field }) => (
                      <FormItem className="col-span-4">
                        <FormLabel className="text-xs text-gray-500">Town / City</FormLabel>
                        <FormControl><Input placeholder="Port Elizabeth" className="h-8 text-sm" {...field} /></FormControl>
                      </FormItem>
                    )} />
                  </div>
                </div>

                {/* Salesperson */}
                {salesWorkers.length > 0 && (
                  <FormField control={form.control} name="assignedTo" render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Assigned Salesperson</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? ""}>
                        <FormControl><SelectTrigger><SelectValue placeholder="— Unassigned —" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="unassigned">— Unassigned —</SelectItem>
                          {salesWorkers.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                )}
              </div>
            )}
          </section>

          {/* ── LINE ITEMS ── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Services / Items</p>
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs gap-1"
                onClick={() => append({ ...BLANK_ITEM })}>
                <Plus className="h-3.5 w-3.5" /> Add Item
              </Button>
            </div>

            <div className="grid grid-cols-12 gap-1.5 px-2 mb-1 text-xs text-gray-400 font-medium">
              <span className="col-span-5">Service / Description</span>
              <span className="col-span-2 text-center">Qty</span>
              <span className="col-span-2 text-right">Unit Price</span>
              <span className="col-span-2 text-right">Total</span>
              <span className="col-span-1" />
            </div>

            <div className="space-y-1.5">
              {fields.map((field, idx) => (
                <div key={field.id} className="grid grid-cols-12 gap-1.5 items-center bg-gray-50 rounded-lg px-2 py-2">
                  <div className="col-span-5">
                    {/* Input with datalist for service autocomplete */}
                    <input
                      list={datalistId}
                      placeholder="Type or pick a service..."
                      className="flex h-8 w-full rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={form.watch(`lineItems.${idx}.description`)}
                      onChange={e => handleItemChange(idx, "description", e.target.value)}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number" min="0" step="0.01"
                      className="h-8 text-sm text-center bg-white"
                      value={form.watch(`lineItems.${idx}.quantity`)}
                      onChange={e => handleItemChange(idx, "quantity", e.target.value)}
                    />
                  </div>
                  <div className="col-span-2 relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">R</span>
                    <Input
                      type="number" min="0" step="0.01"
                      className="h-8 text-sm pl-5 bg-white"
                      value={form.watch(`lineItems.${idx}.unitPrice`)}
                      onChange={e => handleItemChange(idx, "unitPrice", e.target.value)}
                    />
                  </div>
                  <div className="col-span-2 flex items-center justify-end pr-1 text-sm font-medium text-gray-700">
                    R {parseFloat(form.watch(`lineItems.${idx}.total`) || "0").toFixed(2)}
                  </div>
                  <div className="col-span-1 flex justify-center">
                    <Button type="button" variant="ghost" size="sm"
                      className="h-7 w-7 p-0 text-gray-300 hover:text-red-500"
                      disabled={fields.length === 1}
                      onClick={() => {
                        remove(idx);
                        recalc(form.getValues("lineItems").filter((_, i) => i !== idx));
                      }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            {form.formState.errors.lineItems && (
              <p className="text-xs text-red-500 mt-1">{form.formState.errors.lineItems.message as string}</p>
            )}
          </section>

          {/* ── TOTALS ── */}
          <div className="bg-gray-50 rounded-lg px-4 py-3 space-y-1.5 text-sm border border-gray-100">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal (excl. VAT)</span>
              <span>R {form.watch("subtotal")}</span>
            </div>
            <div className="flex justify-between text-gray-400 text-xs">
              <span>VAT (15%)</span>
              <span>R {form.watch("vatAmount")}</span>
            </div>
            <div className="flex justify-between font-bold text-base border-t pt-2 mt-1">
              <span>Total</span>
              <span className="text-green-700">R {form.watch("totalAmount")}</span>
            </div>
          </div>

          {/* ── NOTES / TERMS ── */}
          <div className={`grid gap-3 ${docType === "invoice" ? "grid-cols-2" : "grid-cols-1"}`}>
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs text-gray-500 uppercase tracking-wide font-semibold">
                  {docType === "lead" ? "Internal Notes" : "Notes to Client"}
                  <span className="normal-case font-normal ml-1 text-gray-400">(optional)</span>
                </FormLabel>
                <FormControl>
                  <Textarea rows={2} className="text-sm resize-none"
                    placeholder={docType === "lead" ? "How did this lead come in? Any context..." : "Any additional information for the client..."}
                    {...field} value={field.value ?? ""} />
                </FormControl>
              </FormItem>
            )} />

            {docType === "invoice" && (
              <FormField control={form.control} name="terms" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Payment Terms</FormLabel>
                  <FormControl>
                    <Textarea rows={2} className="text-sm resize-none" placeholder="Payment terms..."
                      {...field} value={field.value ?? ""} />
                  </FormControl>
                </FormItem>
              )} />
            )}
          </div>

          {/* ── FOOTER ── */}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
            <Button type="submit" disabled={isPending} className={`text-white ${cfg.btnClass}`}>
              {isPending ? "Saving..." : (submitLabel ?? (
                docType === "lead" ? "Save Lead" :
                docType === "quote" ? "Send Quote" :
                "Create Invoice"
              ))}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
