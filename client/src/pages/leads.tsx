import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Phone, Mail, MapPin, Clock, ChevronRight, Briefcase, CheckCircle2,
  XCircle, FileText, ArrowRight, Calendar, User, Building2, AlertCircle, UserPlus, ChevronDown,
  Send,
} from "lucide-react";
import DocumentForm, { type DocumentFormValues } from "@/components/forms/document-form";
import type { QuoteSubmission, Client, Worker, Department } from "@shared/schema";

// ─── types ───────────────────────────────────────────────────────────────────

type LeadStatus = "new" | "contacted" | "quoted" | "converted" | "declined";

const SERVICE_LABELS: Record<string, string> = {
  pest_control: "Pest Control",
  sanitary_bins: "Sanitary Bins",
  washroom: "Washroom",
  deep_cleaning: "Deep Cleaning",
};

const PIPELINE: { status: LeadStatus; label: string; color: string; dotColor: string }[] = [
  { status: "new",       label: "New Leads",  color: "bg-blue-50 border-blue-200",   dotColor: "bg-blue-500"   },
  { status: "contacted", label: "Contacted",  color: "bg-amber-50 border-amber-200", dotColor: "bg-amber-400"  },
  { status: "quoted",    label: "Quoted",     color: "bg-purple-50 border-purple-200", dotColor: "bg-purple-500" },
  { status: "converted", label: "Won",        color: "bg-green-50 border-green-200", dotColor: "bg-green-500"  },
  { status: "declined",  label: "Lost",       color: "bg-gray-50 border-gray-200",   dotColor: "bg-gray-400"   },
];

// ─── schema ──────────────────────────────────────────────────────────────────


const convertToJobSchema = z.object({
  clientId: z.string().optional(),
  workerId: z.string().optional(),
  salespersonId: z.string().optional(),
  departmentId: z.string().min(1, "Department required"),
  scheduledDate: z.string().min(1, "Date required"),
  scheduledTime: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  estimatedValue: z.string().optional(),
});

const newClientSchema = z.object({
  name: z.string().min(2, "Company name required"),
  contactPerson: z.string().optional(),
  email: z.string().email("Valid email required").or(z.literal("")).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  industry: z.string().optional(),
  departmentId: z.string().min(1, "Department required"),
});

type ConvertJobForm = z.infer<typeof convertToJobSchema>;

// ─── helpers ─────────────────────────────────────────────────────────────────

function daysAgo(date: any) {
  if (!date) return "";
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return `${diff}d ago`;
}

function followUpLabel(date: any) {
  if (!date) return null;
  const d = new Date(date);
  const diff = Math.ceil((d.getTime() - Date.now()) / 86400000);
  if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, urgent: true };
  if (diff === 0) return { text: "Follow up today", urgent: true };
  return { text: `Follow up in ${diff}d`, urgent: false };
}

// ─── main component ───────────────────────────────────────────────────────────

export default function Leads() {
  const { toast } = useToast();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showNewLead, setShowNewLead] = useState(false);
  const [convertLead, setConvertLead] = useState<QuoteSubmission | null>(null);
  const [quoteLead, setQuoteLead] = useState<QuoteSubmission | null>(null);
  const [notesLead, setNotesLead] = useState<QuoteSubmission | null>(null);
  const [notesText, setNotesText] = useState("");
  const [newClientMode, setNewClientMode] = useState(false);
  const [quotePreview, setQuotePreview] = useState(false);

  const { data: leads = [], isLoading } = useQuery<QuoteSubmission[]>({ queryKey: ["/api/quote-submissions"] });
  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: workers = [] } = useQuery<Worker[]>({ queryKey: ["/api/workers"] });
  const { data: departments = [] } = useQuery<Department[]>({ queryKey: ["/api/departments"] });

  // ── mutations ──
  const createLead = useMutation({
    mutationFn: (data: DocumentFormValues) => apiRequest("POST", "/api/quote-submissions", {
      companyName: data.companyName,
      contactPerson: data.contactPerson,
      email: data.email,
      phone: data.phone,
      serviceType: data.serviceType || "pest_control",
      description: data.lineItems.map(i => `${i.description} (x${i.quantity})`).join("; ") || "See line items",
      address: data.address,
      preferredContactMethod: data.preferredContactMethod || "phone",
      notes: data.notes,
      assignedTo: data.assignedTo && data.assignedTo !== "unassigned" ? data.assignedTo : null,
      lineItems: JSON.stringify(data.lineItems),
      quoteAmount: data.totalAmount,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quote-submissions"] });
      setShowNewLead(false);
      toast({ title: "Lead created", description: "New lead added to the pipeline." });
    },
    onError: () => toast({ title: "Error", description: "Failed to create lead.", variant: "destructive" }),
  });

  const advanceLead = useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: string; notes?: string }) =>
      apiRequest("PATCH", `/api/quote-submissions/${id}`, { status, ...(notes ? { notes } : {}) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quote-submissions"] });
      toast({ title: "Lead updated" });
    },
    onError: () => toast({ title: "Error", description: "Failed to update lead.", variant: "destructive" }),
  });

  const saveNotes = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      apiRequest("PATCH", `/api/quote-submissions/${id}`, { notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quote-submissions"] });
      setNotesLead(null);
      toast({ title: "Notes saved" });
    },
  });

  const createClient = useMutation({
    mutationFn: (data: z.infer<typeof newClientSchema>) =>
      apiRequest("POST", "/api/clients", { ...data, status: "active" }),
  });

  const convertToJob = useMutation({
    mutationFn: async ({ lead, jobData, newClientData }: { lead: QuoteSubmission; jobData: ConvertJobForm; newClientData?: z.infer<typeof newClientSchema> }) => {
      let clientId = jobData.clientId;
      // If creating a new client, do that first
      if (newClientMode && newClientData) {
        const created = await apiRequest("POST", "/api/clients", { ...newClientData, status: "active" });
        const json = await created.json();
        clientId = json.id;
        queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      }
      if (!clientId) throw new Error("No client selected or created");
      const scheduledDate = new Date(`${jobData.scheduledDate}T${jobData.scheduledTime || "08:00"}:00`);
      const serviceLabel = SERVICE_LABELS[lead.serviceType] ?? lead.serviceType;
      const clientName = newClientMode && newClientData ? newClientData.name : (clients.find(c => c.id === clientId)?.name ?? "Client");
      const salespersonName = jobData.salespersonId
        ? (workers.find(w => w.id === jobData.salespersonId)?.name ?? "")
        : (lead.assignedTo ? (workers.find(w => w.id === lead.assignedTo)?.name ?? "") : "");
      await apiRequest("POST", "/api/jobs", {
        title: `${serviceLabel} — ${clientName}`,
        clientId,
        workerId: jobData.workerId || null,
        departmentId: jobData.departmentId,
        serviceType: lead.serviceType,
        status: "scheduled",
        scheduledDate: scheduledDate.toISOString(),
        address: jobData.address || lead.address || "",
        notes: jobData.notes || lead.description || "",
        estimatedValue: jobData.estimatedValue || null,
        priority: "medium",
        salesperson: salespersonName,
      });
      await apiRequest("PATCH", `/api/quote-submissions/${lead.id}`, { status: "converted" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quote-submissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      setConvertLead(null);
      convertJobForm.reset();
      toast({ title: "Job created!", description: "Lead converted — job added to schedule." });
    },
    onError: () => toast({ title: "Error", description: "Failed to convert lead to job.", variant: "destructive" }),
  });

  const sendQuote = useMutation({
    mutationFn: async (data: DocumentFormValues) => {
      if (!quoteLead) throw new Error("No lead selected");
      const res = await apiRequest("POST", `/api/quote-submissions/${quoteLead.id}/send-quote`, {
        amount: data.totalAmount,
        validityDays: parseInt(data.validityDays || "30"),
        message: data.notes,
        lineItems: JSON.stringify(data.lineItems),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quote-submissions"] });
      setQuoteLead(null);
      toast({ title: "Quote sent!", description: "Quote emailed to client — lead moved to Quoted." });
    },
    onError: () => toast({ title: "Error", description: "Failed to send quote.", variant: "destructive" }),
  });

  // ── forms ──
  const salesWorkers = workers.filter(w => w.departmentId === "div-5" && w.isActive !== false);

  const convertJobForm = useForm<ConvertJobForm>({
    resolver: zodResolver(convertToJobSchema),
    defaultValues: { clientId: "", workerId: "", departmentId: "", scheduledDate: "", scheduledTime: "08:00", address: convertLead?.address || "", notes: "", estimatedValue: "" },
  });

  const newClientForm = useForm<z.infer<typeof newClientSchema>>({
    resolver: zodResolver(newClientSchema),
    defaultValues: { name: "", contactPerson: "", email: "", phone: "", address: "", industry: "", departmentId: "" },
  });

  // Reset convert form when lead changes
  const openConvertDialog = (lead: QuoteSubmission) => {
    setConvertLead(lead);
    setNewClientMode(false);
    const deptId = deptForService(lead.serviceType, departments);
    newClientForm.reset({
      name: lead.companyName || "",
      contactPerson: lead.contactPerson || "",
      email: lead.email || "",
      phone: lead.phone || "",
      address: lead.address || "",
      industry: "",
      departmentId: deptId,
    });
    convertJobForm.reset({
      clientId: "",
      workerId: "",
      departmentId: deptForService(lead.serviceType, departments),
      scheduledDate: "",
      scheduledTime: "08:00",
      address: lead.address || "",
      notes: lead.description || "",
      estimatedValue: "",
    });
  };

  const totals = PIPELINE.reduce((acc, col) => {
    acc[col.status] = leads.filter(l => l.status === col.status).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar />

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="relative bg-white w-64 shadow-lg">
            <Sidebar />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Lead Pipeline" onMobileMenuToggle={() => setIsMobileMenuOpen(true)} />

        <main className="flex-1 overflow-y-auto p-6 pb-20 lg:pb-6">
    <div className="space-y-6 max-w-full">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lead Pipeline</h1>
          <p className="text-sm text-gray-500">Track leads from first contact through to job and invoice</p>
        </div>
        <Button onClick={() => setShowNewLead(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" /> New Lead
        </Button>
      </div>

      {/* Pipeline flow indicator */}
      <div className="flex items-center gap-1 text-xs text-gray-500 overflow-x-auto pb-1">
        {["New Lead", "Contacted", "Quoted", "Convert to Job", "Create Invoice"].map((step, i, arr) => (
          <span key={step} className="flex items-center gap-1 whitespace-nowrap">
            <span className={`px-2 py-0.5 rounded-full font-medium ${i === 3 ? "bg-green-100 text-green-700" : i === 4 ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>{step}</span>
            {i < arr.length - 1 && <ArrowRight className="h-3 w-3 text-gray-400" />}
          </span>
        ))}
      </div>

      {/* Kanban columns */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading pipeline...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-start">
          {PIPELINE.map(col => {
            const colLeads = leads.filter(l => l.status === col.status)
              .sort((a, b) => new Date(b.submittedAt ?? 0).getTime() - new Date(a.submittedAt ?? 0).getTime());
            return (
              <div key={col.status} className={`rounded-xl border ${col.color} p-3 min-h-[200px]`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${col.dotColor}`} />
                    <span className="text-sm font-semibold text-gray-700">{col.label}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">{colLeads.length}</Badge>
                </div>
                <div className="space-y-2">
                  {colLeads.map(lead => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      workers={workers}
                      onAdvance={(status) => advanceLead.mutate({ id: lead.id, status })}
                      onConvert={() => openConvertDialog(lead)}
                      onQuote={() => { setQuoteLead(lead); setQuotePreview(false); }}
                      onNotes={() => { setNotesLead(lead); setNotesText(lead.notes ?? ""); }}
                      onDecline={() => advanceLead.mutate({ id: lead.id, status: "declined" })}
                    />
                  ))}
                  {colLeads.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-4">No leads here</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── New Lead dialog ── */}
      <Dialog open={showNewLead} onOpenChange={setShowNewLead}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
          <DocumentForm
            docType="lead"
            salesWorkers={salesWorkers}
            isPending={createLead.isPending}
            onSubmit={d => createLead.mutate(d)}
            onCancel={() => setShowNewLead(false)}
          />
        </DialogContent>
      </Dialog>

      {/* ── Convert to Job dialog ── */}
      {convertLead && (
        <Dialog open={!!convertLead} onOpenChange={() => setConvertLead(null)}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Briefcase className="h-4 w-4" /> Convert to Job — {convertLead.companyName}
              </DialogTitle>
            </DialogHeader>
            <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 mb-2 space-y-1">
              <p><span className="font-medium">Service:</span> {SERVICE_LABELS[convertLead.serviceType]}</p>
              <p><span className="font-medium">Contact:</span> {convertLead.contactPerson} · {convertLead.phone}</p>
              {convertLead.description && <p><span className="font-medium">Requirements:</span> {convertLead.description}</p>}
            </div>
            <Form {...convertJobForm}>
              <form
                onSubmit={convertJobForm.handleSubmit(d => {
                  if (newClientMode) {
                    newClientForm.handleSubmit(nc => convertToJob.mutate({ lead: convertLead, jobData: d, newClientData: nc }))();
                  } else {
                    if (!d.clientId) { convertJobForm.setError("clientId", { message: "Select a client or create a new one" }); return; }
                    convertToJob.mutate({ lead: convertLead, jobData: d });
                  }
                })}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-3">

                  {/* ── Client selector / new client toggle ── */}
                  <div className="col-span-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Client</span>
                      <button
                        type="button"
                        onClick={() => setNewClientMode(v => !v)}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {newClientMode ? (
                          <><ChevronDown className="h-3.5 w-3.5" /> Use existing client</>
                        ) : (
                          <><UserPlus className="h-3.5 w-3.5" /> Create new client</>
                        )}
                      </button>
                    </div>

                    {!newClientMode ? (
                      <FormField control={convertJobForm.control} name="clientId" render={({ field }) => (
                        <FormItem>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select existing client" /></SelectTrigger></FormControl>
                            <SelectContent>
                              {clients.filter(c => c.status === "active").map(c => (
                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                    ) : (
                      <div className="border rounded-lg p-3 bg-blue-50 space-y-3">
                        <p className="text-xs font-medium text-blue-700 flex items-center gap-1">
                          <UserPlus className="h-3.5 w-3.5" /> New client details
                        </p>
                          <div className="grid grid-cols-2 gap-2">
                            <FormField control={newClientForm.control} name="name" render={({ field }) => (
                              <FormItem className="col-span-2">
                                <FormLabel className="text-xs">Company / Client Name *</FormLabel>
                                <FormControl><Input placeholder="e.g. Spar Newton Park" className="h-8 text-sm" {...field} /></FormControl>
                                <FormMessage className="text-xs" />
                              </FormItem>
                            )} />
                            <FormField control={newClientForm.control} name="contactPerson" render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Contact Person</FormLabel>
                                <FormControl><Input placeholder="Full name" className="h-8 text-sm" {...field} /></FormControl>
                              </FormItem>
                            )} />
                            <FormField control={newClientForm.control} name="phone" render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Phone</FormLabel>
                                <FormControl><Input placeholder="+27 41 ..." className="h-8 text-sm" {...field} /></FormControl>
                              </FormItem>
                            )} />
                            <FormField control={newClientForm.control} name="email" render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Email</FormLabel>
                                <FormControl><Input type="email" placeholder="email@co.za" className="h-8 text-sm" {...field} /></FormControl>
                                <FormMessage className="text-xs" />
                              </FormItem>
                            )} />
                            <FormField control={newClientForm.control} name="industry" render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Industry</FormLabel>
                                <FormControl><Input placeholder="e.g. Retail" className="h-8 text-sm" {...field} /></FormControl>
                              </FormItem>
                            )} />
                            <FormField control={newClientForm.control} name="address" render={({ field }) => (
                              <FormItem className="col-span-2">
                                <FormLabel className="text-xs">Address</FormLabel>
                                <FormControl><Input placeholder="Street address" className="h-8 text-sm" {...field} /></FormControl>
                              </FormItem>
                            )} />
                          </div>
                      </div>
                    )}
                  </div>
                  <FormField control={convertJobForm.control} name="departmentId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Department" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {departments.filter(d => ["div-1","div-2","div-3","div-4"].includes(d.id)).map(d => (
                            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={convertJobForm.control} name="salespersonId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Salesperson</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select salesperson" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="none">— Unassigned —</SelectItem>
                          {salesWorkers.map(w => (
                            <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={convertJobForm.control} name="workerId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assign Worker <span className="text-gray-400 font-normal">(optional)</span></FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {workers.filter(w => w.isActive !== false).map(w => (
                            <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={convertJobForm.control} name="scheduledDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={convertJobForm.control} name="scheduledTime" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Time</FormLabel>
                      <FormControl><Input type="time" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={convertJobForm.control} name="address" render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Job Address</FormLabel>
                      <FormControl><Input placeholder="Site address" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={convertJobForm.control} name="estimatedValue" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estimated Value (R)</FormLabel>
                      <FormControl><Input type="number" placeholder="0.00" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={convertJobForm.control} name="notes" render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Job Notes</FormLabel>
                      <FormControl><Textarea rows={2} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setConvertLead(null)}>Cancel</Button>
                  <Button type="submit" disabled={convertToJob.isPending} className="bg-green-600 hover:bg-green-700">
                    <Briefcase className="h-4 w-4 mr-1" />
                    {convertToJob.isPending ? "Creating Job..." : "Create Job & Mark Won"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Send Quote dialog ── */}
      {quoteLead && (
        <Dialog open={!!quoteLead} onOpenChange={() => { setQuoteLead(null); setQuotePreview(false); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
            <DocumentForm
              docType="quote"
              clientInfo={{
                companyName: quoteLead.companyName,
                contactPerson: quoteLead.contactPerson,
                email: quoteLead.email,
                phone: quoteLead.phone,
                address: quoteLead.address ?? undefined,
                serviceType: quoteLead.serviceType,
              }}
              isPending={sendQuote.isPending}
              submitLabel={`Send Quote to ${quoteLead.contactPerson}`}
              onSubmit={d => sendQuote.mutate(d)}
              onCancel={() => { setQuoteLead(null); setQuotePreview(false); }}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* ── Notes dialog ── */}
      {notesLead && (
        <Dialog open={!!notesLead} onOpenChange={() => setNotesLead(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Notes — {notesLead.companyName}</DialogTitle>
            </DialogHeader>
            <Textarea rows={5} value={notesText} onChange={e => setNotesText(e.target.value)} placeholder="Internal notes, call summary, quote amount, etc." />
            <DialogFooter>
              <Button variant="outline" onClick={() => setNotesLead(null)}>Cancel</Button>
              <Button onClick={() => saveNotes.mutate({ id: notesLead.id, notes: notesText })} disabled={saveNotes.isPending}>
                {saveNotes.isPending ? "Saving..." : "Save Notes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
        </main>
      </div>
    </div>
  );
}

// ─── Lead Card ────────────────────────────────────────────────────────────────

function LeadCard({
  lead,
  workers,
  onAdvance,
  onConvert,
  onQuote,
  onNotes,
  onDecline,
}: {
  lead: QuoteSubmission;
  workers: Worker[];
  onAdvance: (status: string) => void;
  onConvert: () => void;
  onQuote: () => void;
  onNotes: () => void;
  onDecline: () => void;
}) {
  const fu = followUpLabel(lead.followUpDate);
  const assignedWorker = lead.assignedTo ? workers.find(w => w.id === lead.assignedTo) : null;
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-3 space-y-2">
      {/* Company + service */}
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{lead.companyName}</p>
          <p className="text-xs text-gray-500 flex items-center gap-1"><User className="h-3 w-3" />{lead.contactPerson}</p>
        </div>
        <Badge variant="outline" className="text-xs flex-shrink-0">{SERVICE_LABELS[lead.serviceType] ?? lead.serviceType}</Badge>
      </div>

      {/* Contact info */}
      <div className="flex flex-col gap-0.5 text-xs text-gray-500">
        <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{lead.phone}</span>
        {lead.address && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /><span className="truncate">{lead.address}</span></span>}
        {assignedWorker && (
          <span className="flex items-center gap-1 text-blue-600 font-medium">
            <Briefcase className="h-3 w-3" />Sales: {assignedWorker.name}
          </span>
        )}
      </div>

      {/* Description snippet */}
      {lead.description && (
        <p className="text-xs text-gray-600 line-clamp-2">{lead.description}</p>
      )}

      {/* Notes */}
      {lead.notes && (
        <p className="text-xs text-indigo-600 italic border-l-2 border-indigo-200 pl-2 line-clamp-2">{lead.notes}</p>
      )}

      {/* Follow-up */}
      {fu && (
        <p className={`text-xs font-medium flex items-center gap-1 ${fu.urgent ? "text-red-600" : "text-gray-500"}`}>
          <Calendar className="h-3 w-3" />{fu.text}
        </p>
      )}

      {/* Age */}
      <p className="text-xs text-gray-400 flex items-center gap-1"><Clock className="h-3 w-3" />{daysAgo(lead.submittedAt)}</p>

      {/* Actions */}
      <div className="flex flex-wrap gap-1 pt-1 border-t border-gray-100">
        {lead.status === "new" && (
          <Button size="sm" variant="outline" className="text-xs h-6 px-2" onClick={() => onAdvance("contacted")}>
            <ChevronRight className="h-3 w-3 mr-0.5" /> Contacted
          </Button>
        )}
        {lead.status === "contacted" && (
          <Button size="sm" variant="outline" className="text-xs h-6 px-2 border-green-300 text-green-700 hover:bg-green-50" onClick={onQuote}>
            <Send className="h-3 w-3 mr-0.5" /> Send Quote
          </Button>
        )}
        {lead.status === "quoted" && lead.quoteAmount && (
          <span className="text-xs text-purple-600 font-medium flex items-center gap-1">
            <FileText className="h-3 w-3" /> R {parseFloat(lead.quoteAmount).toFixed(2)} quoted
          </span>
        )}
        {lead.status === "quoted" && (
          <Button size="sm" className="text-xs h-6 px-2 bg-green-600 hover:bg-green-700 text-white" onClick={onConvert}>
            <Briefcase className="h-3 w-3 mr-0.5" /> Convert to Job
          </Button>
        )}
        {lead.status === "converted" && (
          <span className="text-xs text-green-600 font-medium flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Won — job created
          </span>
        )}
        {lead.status === "declined" && (
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <XCircle className="h-3 w-3" /> Lost
          </span>
        )}

        <Button size="sm" variant="ghost" className="text-xs h-6 px-2 text-gray-500" onClick={onNotes}>
          Notes
        </Button>

        {(lead.status === "new" || lead.status === "contacted" || lead.status === "quoted") && (
          <Button size="sm" variant="ghost" className="text-xs h-6 px-2 text-red-500 hover:text-red-700" onClick={onDecline}>
            <XCircle className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function deptForService(serviceType: string, departments: Department[]): string {
  const map: Record<string, string> = {
    pest_control: "div-1",
    sanitary_bins: "div-2",
    washroom: "div-3",
    deep_cleaning: "div-4",
  };
  return map[serviceType] ?? departments[0]?.id ?? "";
}
