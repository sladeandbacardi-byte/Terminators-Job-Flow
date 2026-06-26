import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, parseISO } from "date-fns";
import { queryClient, apiRequest } from "@/lib/queryClient";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import MobileNavigation from "@/components/layout/mobile-nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import {
  FileText, Phone, Mail, MapPin, Calendar, User,
  MessageSquare, ChevronDown, ChevronUp, Building2, Briefcase, UserPlus,
  Package, AlertCircle, RefreshCw, ClipboardList, FileCheck, Plus,
} from "lucide-react";
import type { QuoteSubmission, Worker, Client, Department } from "@shared/schema";

// ── schemas ───────────────────────────────────────────────────────────────────

const convertToJobSchema = z.object({
  clientId:            z.string().optional(),
  workerId:            z.string().optional(),
  salespersonId:       z.string().optional(),
  departmentId:        z.string().min(1, "Department required"),
  scheduledDate:       z.string().min(1, "Date required"),
  scheduledTime:       z.string().optional(),
  address:             z.string().optional(),
  notes:               z.string().optional(),
  estimatedValue:      z.string().optional(),
  frequency:           z.string().optional(),
  specialInstructions: z.string().optional(),
});

const FREQUENCY_OPTIONS = [
  { value: "once_off",    label: "Once-off" },
  { value: "weekly",      label: "Weekly" },
  { value: "fortnightly", label: "Fortnightly" },
  { value: "monthly",     label: "Monthly" },
  { value: "bi_monthly",  label: "Every 2 Months" },
  { value: "quarterly",   label: "Quarterly" },
  { value: "biannual",    label: "Every 6 Months" },
  { value: "annual",      label: "Annually" },
];

const convertToContractSchema = z.object({
  clientId:     z.string().min(1, "Client required"),
  departmentId: z.string().min(1, "Department required"),
  serviceType:  z.string().min(1, "Service type required"),
  frequency:    z.string().min(1, "Frequency required"),
  contractPrice: z.string().optional(),
  startDate:    z.string().optional(),
  notes:        z.string().optional(),
});
type ConvertContractForm = z.infer<typeof convertToContractSchema>;

function parseLineItems(json: string | null | undefined): Array<{ description: string; qty?: number; unit?: string }> {
  if (!json) return [];
  try { return JSON.parse(json); } catch { return []; }
}

const newClientSchema = z.object({
  name:         z.string().min(2, "Company name required"),
  contactPerson: z.string().optional(),
  email:        z.string().email("Valid email required").or(z.literal("")).optional(),
  phone:        z.string().optional(),
  address:      z.string().optional(),
  industry:     z.string().optional(),
  departmentId: z.string().min(1, "Department required"),
});

const newQuoteSchema = z.object({
  companyName:            z.string().min(2, "Company name required"),
  contactPerson:          z.string().min(1, "Contact person required"),
  email:                  z.string().email("Valid email required"),
  phone:                  z.string().min(1, "Phone required"),
  serviceType:            z.string().min(1, "Service type required"),
  description:            z.string().min(1, "Description required"),
  address:                z.string().optional(),
  preferredContactMethod: z.string().default("email"),
  quoteAmount:            z.string().optional(),
  frequency:              z.string().optional(),
});
type NewQuoteForm = z.infer<typeof newQuoteSchema>;

type ConvertJobForm = z.infer<typeof convertToJobSchema>;

// ── constants ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: "quoted",    label: "Quoted",   class: "bg-purple-100 text-purple-700" },
  { value: "converted", label: "Accepted", class: "bg-green-100 text-green-700" },
  { value: "declined",  label: "Declined", class: "bg-red-100 text-red-600" },
];

const SERVICE_LABELS: Record<string, string> = {
  pest_control:  "Pest Control",
  sanitary_bins: "Sanitary Bins",
  washroom:      "Washroom",
  deep_cleaning: "Deep Cleaning",
};

const SERVICE_TO_DEPT: Record<string, string> = {
  pest_control:  "div-1",
  sanitary_bins: "div-2",
  washroom:      "div-3",
  deep_cleaning: "div-4",
};

const CONTACT_LABELS: Record<string, string> = {
  email:    "Email",
  phone:    "Phone",
  whatsapp: "WhatsApp",
  either:   "Either",
};

function statusConfig(status: string) {
  return STATUS_OPTIONS.find(s => s.value === status) ?? STATUS_OPTIONS[0];
}

// ── QuoteCard ─────────────────────────────────────────────────────────────────

interface QuoteCardProps {
  quote: QuoteSubmission;
  salesWorkers: Worker[];
  allWorkers: Worker[];
  clients: Client[];
  departments: Department[];
}

function QuoteCard({ quote, salesWorkers, allWorkers, clients, departments }: QuoteCardProps) {
  const [, navigate] = useLocation();
  const [expanded, setExpanded]       = useState(false);
  const [notes, setNotes]             = useState(quote.notes ?? "");
  const [editingNotes, setEditingNotes] = useState(false);

  // Decline dialog
  const [declineOpen, setDeclineOpen]   = useState(false);
  const [declineReason, setDeclineReason] = useState("");

  // Convert-to-job dialog
  const [acceptOpen, setAcceptOpen]   = useState(false);
  const [newClientMode, setNewClientMode] = useState(false);

  // Convert-to-contract dialog
  const [contractOpen, setContractOpen] = useState(false);

  const { toast } = useToast();

  const deptId = SERVICE_TO_DEPT[quote.serviceType] ?? departments[0]?.id ?? "";

  // ── Forms ──
  const convertJobForm = useForm<ConvertJobForm>({
    resolver: zodResolver(convertToJobSchema),
    defaultValues: {
      clientId: "", workerId: "", salespersonId: "", departmentId: deptId,
      scheduledDate: "", scheduledTime: "08:00",
      address: quote.address || "", notes: quote.description || "", estimatedValue: "",
    },
  });

  const convertContractForm = useForm<ConvertContractForm>({
    resolver: zodResolver(convertToContractSchema),
    defaultValues: {
      clientId: (quote as any).clientId ?? "",
      departmentId: deptId,
      serviceType: quote.serviceType,
      frequency: (quote as any).frequency ?? "monthly",
      contractPrice: quote.quoteAmount ?? "",
      startDate: "",
      notes: quote.notes ?? "",
    },
  });

  const newClientForm = useForm<z.infer<typeof newClientSchema>>({
    resolver: zodResolver(newClientSchema),
    defaultValues: {
      name: "", contactPerson: "", email: "", phone: "",
      address: "", industry: "", departmentId: deptId,
    },
  });

  // ── Mutations ──
  const updateMutation = useMutation({
    mutationFn: (data: Partial<QuoteSubmission>) =>
      apiRequest("PATCH", `/api/quote-submissions/${quote.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quote-submissions"] });
      toast({ title: "Quote updated" });
    },
    onError: () => toast({ title: "Update failed", variant: "destructive" }),
  });

  const convertMutation = useMutation({
    mutationFn: async ({ jobData, newClientData }: { jobData: ConvertJobForm; newClientData?: z.infer<typeof newClientSchema> }) => {
      // Resolve client — create new if needed
      let clientId = jobData.clientId;
      if (newClientMode && newClientData) {
        const res = await apiRequest("POST", "/api/clients", { ...newClientData, status: "active" });
        if (!res.ok) throw new Error("Failed to create client");
        const json = await res.json();
        clientId = json.id;
        queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      }
      if (!clientId) throw new Error("No client selected");

      // Use the dedicated conversion endpoint — atomic job creation + quote status update
      const res = await apiRequest("POST", `/api/quote-submissions/${quote.id}/convert-to-job`, {
        clientId,
        workerId:            jobData.workerId || null,
        departmentId:        jobData.departmentId,
        scheduledDate:       jobData.scheduledDate,
        scheduledTime:       jobData.scheduledTime || "08:00",
        address:             jobData.address || quote.address || "",
        notes:               [
          `Contact: ${quote.contactPerson}${quote.phone ? ' · ' + quote.phone : ''}${quote.email ? ' · ' + quote.email : ''}`,
          jobData.notes?.trim() || "",
        ].filter(Boolean).join('\n'),
        estimatedValue:      jobData.estimatedValue || quote.quoteAmount || null,
        frequency:           jobData.frequency || null,
        specialInstructions: jobData.specialInstructions || null,
        salespersonId:       jobData.salespersonId || quote.assignedTo || null,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to convert quote to job");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quote-submissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Job created!", description: "Quote converted — job added to schedule." });
      setAcceptOpen(false);
      navigate("/jobs");
    },
    onError: (e: any) => toast({ title: "Failed to create job", description: e.message, variant: "destructive" }),
  });

  const convertContractMutation = useMutation({
    mutationFn: async (data: ConvertContractForm) => {
      // Use the dedicated conversion endpoint — atomic contract creation + quote status update
      const res = await apiRequest("POST", `/api/quote-submissions/${quote.id}/convert-to-contract`, {
        clientId:      data.clientId,
        departmentId:  data.departmentId,
        serviceType:   data.serviceType,
        frequency:     data.frequency,
        contractPrice: data.contractPrice || null,
        startDate:     data.startDate || null,
        notes:         data.notes || null,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create service contract");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quote-submissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/service-contracts"] });
      toast({ title: "Contract created!", description: "Quote converted to a service contract." });
      setContractOpen(false);
    },
    onError: (e: any) => toast({ title: "Failed to create contract", description: e.message, variant: "destructive" }),
  });

  // ── Handlers ──
  const handleStatusChange = (status: string) => {
    if (status === "declined") {
      setDeclineReason("");
      setDeclineOpen(true);
    } else if (status === "converted") {
      // Priority: use the quote's stored clientId if present, then fall back to name-match
      const linkedClientId = (quote as any).clientId as string | undefined;
      const exactMatch = linkedClientId ? clients.find(c => c.id === linkedClientId) : null;
      const nameMatch = !exactMatch ? clients.find(c =>
        c.name.toLowerCase().includes(quote.companyName.toLowerCase()) ||
        quote.companyName.toLowerCase().includes(c.name.toLowerCase())
      ) : null;
      const match = exactMatch ?? nameMatch;

      // Pre-fill forms from quote data
      convertJobForm.reset({
        clientId:            match?.id ?? "",
        workerId:            "",
        salespersonId:       quote.assignedTo ?? "",
        departmentId:        deptId,
        scheduledDate:       "",
        scheduledTime:       "08:00",
        address:             quote.address || "",
        notes:               "",
        estimatedValue:      quote.quoteAmount ?? "",
        frequency:           (quote as any).frequency || "",
        specialInstructions: (quote as any).specialInstructions || "",
      });
      newClientForm.reset({
        name:          quote.companyName,
        contactPerson: quote.contactPerson || "",
        email:         quote.email || "",
        phone:         quote.phone || "",
        address:       quote.address || "",
        industry:      "",
        departmentId:  deptId,
      });
      // Only enter "create new" mode if there is truly no client link and no name-match
      setNewClientMode(!match);
      setAcceptOpen(true);
    } else {
      updateMutation.mutate({ status });
    }
  };

  const handleDeclineConfirm = () => {
    if (!declineReason.trim()) return;
    updateMutation.mutate({ status: "declined", notes: declineReason.trim() });
    setDeclineOpen(false);
  };

  const handleConvertSubmit = (jobData: ConvertJobForm) => {
    if (newClientMode) {
      newClientForm.handleSubmit(nc => convertMutation.mutate({ jobData, newClientData: nc }))();
    } else {
      if (!jobData.clientId) {
        convertJobForm.setError("clientId", { message: "Select a client or create a new one" });
        return;
      }
      convertMutation.mutate({ jobData });
    }
  };

  const handleSaveNotes = () => {
    updateMutation.mutate({ notes });
    setEditingNotes(false);
  };

  const cfg = statusConfig(quote.status);

  return (
    <>
    <Card className="border hover:shadow-md transition-shadow">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-primary/10 shrink-0">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-base leading-tight truncate">{quote.companyName}</p>
                {quote.quoteNumber && (
                  <span className="text-xs font-mono font-medium text-blue-700 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded shrink-0">
                    {quote.quoteNumber}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 text-sm text-muted-foreground">
                <User className="h-3.5 w-3.5 shrink-0" />
                <span>{quote.contactPerson}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <Badge variant="outline" className="text-xs font-medium">
              {SERVICE_LABELS[quote.serviceType] ?? quote.serviceType}
            </Badge>
            <Select
              value={quote.status}
              onValueChange={handleStatusChange}
              disabled={updateMutation.isPending || convertMutation.isPending}
            >
              <SelectTrigger className={`h-7 text-xs font-medium border-0 px-2 rounded-full w-auto ${cfg.class}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(s => (
                  <SelectItem key={s.value} value={s.value}>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.class}`}>{s.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-3">
        {/* Contact details */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {quote.email && (
            <a href={`mailto:${quote.email}`} className="flex items-center gap-1.5 hover:text-primary">
              <Mail className="h-3.5 w-3.5" />{quote.email}
            </a>
          )}
          {quote.phone && (
            <a href={`tel:${quote.phone}`} className="flex items-center gap-1.5 hover:text-primary">
              <Phone className="h-3.5 w-3.5" />{quote.phone}
            </a>
          )}
          {quote.preferredContactMethod && (
            <span className="flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              Prefers {CONTACT_LABELS[quote.preferredContactMethod] ?? quote.preferredContactMethod}
            </span>
          )}
        </div>

        {/* Address */}
        {quote.address && (
          <div className="flex items-start gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>{quote.address}</span>
          </div>
        )}

        {/* Salesperson */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground shrink-0">Salesperson:</span>
          <Select
            value={quote.assignedTo ?? "none"}
            onValueChange={(val) => updateMutation.mutate({ assignedTo: val === "none" ? null : val } as Partial<QuoteSubmission>)}
            disabled={updateMutation.isPending}
          >
            <SelectTrigger className="h-7 text-xs w-44">
              <SelectValue placeholder="Unassigned" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Unassigned —</SelectItem>
              {salesWorkers.map(w => (
                <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Dates */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Submitted {quote.submittedAt ? format(parseISO(quote.submittedAt as unknown as string), "d MMM yyyy") : "—"}
          </span>
          {quote.followUpDate && (
            <span className="flex items-center gap-1 text-amber-600 font-medium">
              <Calendar className="h-3 w-3" />
              Follow up {format(parseISO(quote.followUpDate as unknown as string), "d MMM yyyy")}
            </span>
          )}
        </div>

        {/* Expand / collapse */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary font-medium"
        >
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {expanded ? "Hide details" : "Show details"}
        </button>

        {expanded && (
          <div className="space-y-3 pt-1 border-t">
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">Request Description</p>
              <p className="text-sm text-gray-700 bg-gray-50 rounded p-3 leading-relaxed">{quote.description}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">Internal Notes</p>
              {editingNotes ? (
                <div className="space-y-2">
                  <Textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Add follow-up notes, pricing discussed, next steps..."
                    className="text-sm min-h-[80px]"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveNotes} disabled={updateMutation.isPending}>Save</Button>
                    <Button size="sm" variant="outline" onClick={() => { setNotes(quote.notes ?? ""); setEditingNotes(false); }}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => setEditingNotes(true)}
                  className="text-sm text-gray-600 bg-gray-50 rounded p-3 min-h-[40px] cursor-text hover:bg-gray-100 transition-colors border border-dashed border-gray-200"
                >
                  {notes || <span className="text-gray-400 italic">Click to add notes...</span>}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Convert to Contract button — shown when quote is in "quoted" status */}
        {quote.status === "quoted" && (
          <div className="pt-2 border-t flex justify-end">
            <Button
              size="sm"
              variant="outline"
              className="text-xs gap-1.5 border-teal-300 text-teal-700 hover:bg-teal-50"
              onClick={() => {
                const linkedClient = clients.find(c => c.id === (quote as any).clientId);
                convertContractForm.reset({
                  clientId:     (quote as any).clientId ?? "",
                  departmentId: deptId,
                  serviceType:  quote.serviceType,
                  frequency:    (quote as any).frequency ?? "monthly",
                  contractPrice: quote.quoteAmount ?? "",
                  startDate:    "",
                  notes:        quote.notes ?? "",
                });
                setContractOpen(true);
              }}
            >
              <FileCheck className="h-3.5 w-3.5" /> Convert to Contract
            </Button>
          </div>
        )}
      </CardContent>
    </Card>

    {/* ── Decline dialog ── */}
    <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Reason for Declining</DialogTitle>
        </DialogHeader>
        <div className="py-2 space-y-2">
          <p className="text-sm text-muted-foreground">
            Please enter why this quote was declined. This will be saved as a note.
          </p>
          <Textarea
            autoFocus
            rows={3}
            placeholder="e.g. Price too high, went with competitor..."
            value={declineReason}
            onChange={e => setDeclineReason(e.target.value)}
            className="resize-none"
          />
          {declineReason.trim() === "" && (
            <p className="text-xs text-red-500">A reason is required before declining.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDeclineOpen(false)}>Cancel</Button>
          <Button
            variant="destructive"
            disabled={!declineReason.trim() || updateMutation.isPending}
            onClick={handleDeclineConfirm}
          >
            {updateMutation.isPending ? "Saving..." : "Confirm Decline"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* ── Convert to Job dialog ── */}
    <Dialog open={acceptOpen} onOpenChange={setAcceptOpen}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="h-4 w-4" /> Convert to Job — {quote.companyName}
          </DialogTitle>
        </DialogHeader>

        {/* Quote details summary — read-only */}
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 space-y-2.5 text-sm">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Quote Details — Auto-copied to Job</p>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            <div className="flex items-center gap-1.5 text-gray-700">
              <Briefcase className="h-3.5 w-3.5 text-blue-500 shrink-0" />
              <span className="font-medium">Service:</span>
              <span>{SERVICE_LABELS[quote.serviceType] ?? quote.serviceType}</span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-700">
              <User className="h-3.5 w-3.5 text-blue-500 shrink-0" />
              <span className="font-medium">Contact:</span>
              <span>{quote.contactPerson}</span>
            </div>
            {quote.phone && (
              <div className="flex items-center gap-1.5 text-gray-700">
                <Phone className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                <span>{quote.phone}</span>
              </div>
            )}
            {quote.email && (
              <div className="flex items-center gap-1.5 text-gray-700">
                <Mail className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                <span className="truncate">{quote.email}</span>
              </div>
            )}
            {quote.address && (
              <div className="col-span-2 flex items-start gap-1.5 text-gray-700">
                <MapPin className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
                <span className="font-medium shrink-0">Site:</span>
                <span>{quote.address}</span>
              </div>
            )}
          </div>

          {quote.description && (
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <ClipboardList className="h-3.5 w-3.5 text-blue-500" />
                <span className="text-xs font-semibold text-gray-600">Scope of Work</span>
              </div>
              <p className="text-xs text-gray-700 bg-white rounded p-2 border border-blue-100 leading-relaxed whitespace-pre-wrap">{quote.description}</p>
            </div>
          )}

          {(() => {
            const items = parseLineItems(quote.lineItemsJson);
            return items.length > 0 ? (
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5 text-blue-500" />
                  <span className="text-xs font-semibold text-gray-600">Products / Items Required</span>
                </div>
                <ul className="bg-white border border-blue-100 rounded p-2 space-y-0.5">
                  {items.map((li, i) => (
                    <li key={i} className="text-xs text-gray-700 flex items-baseline gap-1.5">
                      <span className="text-blue-400">•</span>
                      {li.description}
                      {li.qty && <span className="text-gray-400">— qty: {li.qty}{li.unit ? ' ' + li.unit : ''}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null;
          })()}

          {(quote as any).specialInstructions && (
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-xs font-semibold text-gray-600">Special Instructions</span>
              </div>
              <p className="text-xs text-gray-700 bg-amber-50 border border-amber-100 rounded p-2 whitespace-pre-wrap">{(quote as any).specialInstructions}</p>
            </div>
          )}

          {(quote as any).frequency && (
            <div className="flex items-center gap-1.5 text-xs text-gray-700">
              <RefreshCw className="h-3.5 w-3.5 text-blue-500" />
              <span className="font-medium">Frequency:</span>
              <span>{FREQUENCY_OPTIONS.find(f => f.value === (quote as any).frequency)?.label ?? (quote as any).frequency}</span>
            </div>
          )}
        </div>

        <Form {...convertJobForm}>
          <form
            onSubmit={convertJobForm.handleSubmit(handleConvertSubmit)}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-3">

              {/* Client selector / new client toggle */}
              <div className="col-span-2 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Client</span>
                  {/* Only show the "create new" toggle when the quote has no linked clientId */}
                  {!(quote as any).clientId && (
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
                  )}
                </div>

                {!newClientMode ? (
                  <FormField control={convertJobForm.control} name="clientId" render={({ field }) => (
                    <FormItem>
                      {/* If the quote already has a stored clientId, show it as a locked badge */}
                      {(quote as any).clientId && clients.find(c => c.id === (quote as any).clientId) ? (
                        <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2">
                          <Building2 className="h-4 w-4 text-green-600 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-green-800 truncate">
                              {clients.find(c => c.id === (quote as any).clientId)?.name}
                            </p>
                            <p className="text-xs text-green-600">Linked client — carried through from lead</p>
                          </div>
                        </div>
                      ) : (
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select existing client" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {clients.filter(c => c.status === "active").map(c => (
                              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <FormMessage />
                    </FormItem>
                  )} />
                ) : (
                  <div className="border rounded-lg p-3 bg-blue-50 space-y-3">
                    <p className="text-xs font-medium text-blue-700 flex items-center gap-1">
                      <UserPlus className="h-3.5 w-3.5" /> New client details (pre-filled from quote)
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

              {/* Department */}
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

              {/* Salesperson */}
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

              {/* Assign Worker */}
              <FormField control={convertJobForm.control} name="workerId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Assign Worker <span className="text-gray-400 font-normal">(optional)</span></FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {allWorkers.filter(w => w.isActive !== false).map(w => (
                        <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Date */}
              <FormField control={convertJobForm.control} name="scheduledDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Time */}
              <FormField control={convertJobForm.control} name="scheduledTime" render={({ field }) => (
                <FormItem>
                  <FormLabel>Time</FormLabel>
                  <FormControl><Input type="time" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Address */}
              <FormField control={convertJobForm.control} name="address" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Job Address</FormLabel>
                  <FormControl><Input placeholder="Site address" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Frequency */}
              <FormField control={convertJobForm.control} name="frequency" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1">
                    <RefreshCw className="h-3.5 w-3.5 text-gray-400" /> Frequency
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select frequency" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="none">— Not specified —</SelectItem>
                      {FREQUENCY_OPTIONS.map(f => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Estimated value */}
              <FormField control={convertJobForm.control} name="estimatedValue" render={({ field }) => (
                <FormItem>
                  <FormLabel>Estimated Value (R)</FormLabel>
                  <FormControl><Input type="number" placeholder="0.00" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Special Instructions */}
              <FormField control={convertJobForm.control} name="specialInstructions" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel className="flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-500" /> Special Instructions
                    <span className="text-gray-400 font-normal ml-1">(pre-filled from quote)</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      placeholder="Access codes, safety requirements, client preferences..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Notes */}
              <FormField control={convertJobForm.control} name="notes" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Additional Job Notes</FormLabel>
                  <FormControl><Textarea rows={2} placeholder="Internal notes for the field worker..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAcceptOpen(false)}>Cancel</Button>
              <Button
                type="submit"
                disabled={convertMutation.isPending}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Briefcase className="h-4 w-4 mr-1" />
                {convertMutation.isPending ? "Creating Job..." : "Create Job & Mark Won"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>

    {/* ── Convert to Contract dialog ── */}
    <Dialog open={contractOpen} onOpenChange={setContractOpen}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCheck className="h-4 w-4 text-teal-600" /> Convert to Service Contract — {quote.companyName}
          </DialogTitle>
        </DialogHeader>

        <Form {...convertContractForm}>
          <form onSubmit={convertContractForm.handleSubmit(d => convertContractMutation.mutate(d))} className="space-y-4">

            {/* Client selector */}
            <FormField control={convertContractForm.control} name="clientId" render={({ field }) => (
              <FormItem>
                <FormLabel>Client Account <span className="text-red-500">*</span></FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {clients.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}{c.contactPerson ? ` — ${c.contactPerson}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
                <p className="text-xs text-muted-foreground">
                  The contract will be linked to this client account.
                </p>
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
              {/* Department */}
              <FormField control={convertContractForm.control} name="departmentId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Department <span className="text-red-500">*</span></FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {departments.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Service type */}
              <FormField control={convertContractForm.control} name="serviceType" render={({ field }) => (
                <FormItem>
                  <FormLabel>Service Type <span className="text-red-500">*</span></FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select service" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="pest_control">Pest Control</SelectItem>
                      <SelectItem value="sanitary_bins">Sanitary Bins</SelectItem>
                      <SelectItem value="washroom">Washroom</SelectItem>
                      <SelectItem value="deep_cleaning">Deep Cleaning</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Frequency */}
              <FormField control={convertContractForm.control} name="frequency" render={({ field }) => (
                <FormItem>
                  <FormLabel>Frequency <span className="text-red-500">*</span></FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select frequency" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {FREQUENCY_OPTIONS.map(f => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Contract price */}
              <FormField control={convertContractForm.control} name="contractPrice" render={({ field }) => (
                <FormItem>
                  <FormLabel>Contract Price (R)</FormLabel>
                  <FormControl><Input type="text" placeholder="e.g. 1200.00" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Start date */}
              <FormField control={convertContractForm.control} name="startDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Start Date</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Notes */}
              <FormField control={convertContractForm.control} name="notes" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Contract Notes</FormLabel>
                  <FormControl><Textarea rows={2} placeholder="Access requirements, special instructions..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setContractOpen(false)}>Cancel</Button>
              <Button
                type="submit"
                disabled={convertContractMutation.isPending}
                className="bg-teal-600 hover:bg-teal-700 text-white"
              >
                <FileCheck className="h-4 w-4 mr-1" />
                {convertContractMutation.isPending ? "Creating Contract..." : "Create Contract & Mark Won"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
    </>
  );
}

// ── QuotesPage ────────────────────────────────────────────────────────────────

export default function QuotesPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [statusFilter, setStatusFilter]   = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [showNewQuote, setShowNewQuote]   = useState(false);

  const { toast } = useToast();

  const { data: quotes = [], isLoading } = useQuery<QuoteSubmission[]>({ queryKey: ["/api/quote-submissions"] });
  const { data: workers = [] }     = useQuery<Worker[]>({ queryKey: ["/api/workers"] });
  const { data: clients = [] }     = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: departments = [] } = useQuery<Department[]>({ queryKey: ["/api/departments"] });

  const salesWorkers = workers.filter(w => w.departmentId === "div-5" && w.isActive !== false);

  const QUOTE_STATUSES = ["quoted", "converted", "declined"];
  const filtered = quotes.filter(q => {
    if (!QUOTE_STATUSES.includes(q.status)) return false;
    const matchStatus  = statusFilter  === "all" || q.status      === statusFilter;
    const matchService = serviceFilter === "all" || q.serviceType === serviceFilter;
    return matchStatus && matchService;
  });

  const countByStatus = (s: string) => quotes.filter(q => q.status === s).length;

  const newQuoteForm = useForm<NewQuoteForm>({
    resolver: zodResolver(newQuoteSchema),
    defaultValues: {
      companyName: "", contactPerson: "", email: "", phone: "",
      serviceType: "", description: "", address: "",
      preferredContactMethod: "email", quoteAmount: "", frequency: "",
    },
  });

  const createQuoteMutation = useMutation({
    mutationFn: (data: NewQuoteForm) =>
      apiRequest("POST", "/api/quote-submissions", { ...data, status: "quoted", origination: "other" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quote-submissions"] });
      toast({ title: "Quote created successfully" });
      setShowNewQuote(false);
      newQuoteForm.reset();
    },
    onError: () => toast({ title: "Failed to create quote", variant: "destructive" }),
  });

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Quotes" onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />
        <MobileNavigation isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

        <main className="flex-1 overflow-y-auto p-6 pb-20 lg:pb-6">
          <div className="space-y-5">

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                  <FileText className="h-7 w-7 text-primary" />
                  Quotes
                </h1>
                <p className="text-muted-foreground mt-1">
                  Manage quote requests from prospective clients
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-sm text-muted-foreground">
                  <strong>{filtered.length}</strong> shown · <strong>{countByStatus("quoted")}</strong> pending · <strong>{countByStatus("converted")}</strong> accepted
                </div>
                <Button onClick={() => setShowNewQuote(true)} className="gap-2">
                  <Plus className="h-4 w-4" /> New Quote
                </Button>
              </div>
            </div>

            {/* Status tabs */}
            <div className="flex gap-1.5 flex-wrap">
              {[{ value: "all", label: "All" }, ...STATUS_OPTIONS].map(s => (
                <button
                  key={s.value}
                  onClick={() => setStatusFilter(s.value)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                    statusFilter === s.value
                      ? "bg-primary text-white border-primary"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {s.label}
                  {s.value !== "all" && (
                    <span className="ml-1.5 text-xs opacity-70">({countByStatus(s.value)})</span>
                  )}
                </button>
              ))}

              <Select value={serviceFilter} onValueChange={setServiceFilter}>
                <SelectTrigger className="h-8 text-sm w-44 ml-auto">
                  <SelectValue placeholder="All Services" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Services</SelectItem>
                  {Object.entries(SERVICE_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Quote cards */}
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">Loading quotes...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No quotes match the selected filters.</p>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {filtered
                  .sort((a, b) => new Date(b.submittedAt as unknown as string).getTime() - new Date(a.submittedAt as unknown as string).getTime())
                  .map(q => (
                    <QuoteCard
                      key={q.id}
                      quote={q}
                      salesWorkers={salesWorkers}
                      allWorkers={workers}
                      clients={clients}
                      departments={departments}
                    />
                  ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ── New Quote Dialog ─────────────────────────────────────────── */}
      <Dialog open={showNewQuote} onOpenChange={setShowNewQuote}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" /> New Quote
            </DialogTitle>
          </DialogHeader>
          <Form {...newQuoteForm}>
            <form onSubmit={newQuoteForm.handleSubmit(data => createQuoteMutation.mutate(data))} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={newQuoteForm.control} name="companyName" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Company Name *</FormLabel>
                    <FormControl><Input placeholder="e.g. ABC Holdings" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={newQuoteForm.control} name="contactPerson" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Person *</FormLabel>
                    <FormControl><Input placeholder="Full name" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={newQuoteForm.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone *</FormLabel>
                    <FormControl><Input placeholder="+27 ..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={newQuoteForm.control} name="email" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Email *</FormLabel>
                    <FormControl><Input type="email" placeholder="email@company.co.za" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={newQuoteForm.control} name="serviceType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select service" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {Object.entries(SERVICE_LABELS).map(([v, l]) => (
                          <SelectItem key={v} value={v}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={newQuoteForm.control} name="frequency" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Frequency</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select frequency" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {FREQUENCY_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={newQuoteForm.control} name="address" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Address</FormLabel>
                    <FormControl><Input placeholder="Site address" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={newQuoteForm.control} name="quoteAmount" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quote Amount (R)</FormLabel>
                    <FormControl><Input placeholder="e.g. 2500.00" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={newQuoteForm.control} name="preferredContactMethod" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preferred Contact</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="phone">Phone</SelectItem>
                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        <SelectItem value="either">Either</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={newQuoteForm.control} name="description" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Description / Requirements *</FormLabel>
                    <FormControl><Textarea placeholder="Describe the service requirements..." rows={3} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowNewQuote(false)}>Cancel</Button>
                <Button type="submit" disabled={createQuoteMutation.isPending}>
                  {createQuoteMutation.isPending ? "Creating..." : "Create Quote"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
