import { useState, useEffect } from "react";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  FileText, Phone, Mail, MapPin, Calendar, User,
  MessageSquare, ChevronDown, ChevronUp, Building2, Briefcase, UserPlus,
  Package, AlertCircle, RefreshCw, ClipboardList, FileCheck, Plus, Trash2,
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

// ── New Quote — department/service configuration ──────────────────────────────

const DEPT_LABELS: Record<string, string> = {
  pest_control:     "Pest Control",
  hygiene_washroom: "Hygiene / Washroom",
  sanitary_bins:    "Sanitary Bins",
  deep_cleaning:    "Deep Cleaning",
  dustmats:         "Dustmats",
  coc:              "COC (Certificates)",
  other:            "Other",
};

const DEPT_SERVICES: Record<string, string[]> = {
  pest_control:     ["Monthly pest control","Rodent control","Cockroach treatment","Ant treatment","Flea treatment","Bed bug treatment","Fly control","Termite treatment","Once-off inspection","Other"],
  hygiene_washroom: ["Hand soap dispenser","Paper towel dispenser","Toilet paper dispenser","Air freshener dispenser","Sanitary bin service","Seat sanitizer","Urinal sanitizer","Deep washroom clean","Other"],
  sanitary_bins:    ["Sanitary bin rental and service","Sanitary bin collection only","Feminine hygiene service","Other"],
  deep_cleaning:    ["Once-off deep clean","Kitchen deep clean","Washroom deep clean","Office deep clean","High-level cleaning","Floor cleaning","Other"],
  coc:              ["Electrical COC single-phase","Electrical COC three-phase","Wood borer COC","Electrical + Wood borer COC","Other"],
  dustmats:         ["Dustmat hire","Dustmat cleaning","Other"],
  other:            ["Other"],
};

const ITEM_UNITS = ["Unit","Dispenser","Bin","Room","Site","Square metre","Hour","Visit","Treatment","Inspection","Certificate","Other"];

const ITEM_FREQS = [
  { value: "once_off",    label: "Once-off" },
  { value: "weekly",      label: "Weekly" },
  { value: "fortnightly", label: "Fortnightly" },
  { value: "monthly",     label: "Monthly" },
  { value: "bi_monthly",  label: "Every 2 Months" },
  { value: "quarterly",   label: "Quarterly" },
  { value: "biannual",    label: "6-Monthly" },
  { value: "annual",      label: "Annually" },
  { value: "on_demand",   label: "On Demand" },
];

const QUOTE_TYPES = [
  { value: "once_off",  label: "Once-off Service" },
  { value: "recurring", label: "Recurring Service" },
  { value: "rental",    label: "Rental Contract" },
  { value: "product",   label: "Product / Stock Sale" },
  { value: "mixed",     label: "Mixed Quote" },
];

const QUOTE_STATUS_OPTIONS = [
  { value: "draft",              label: "Draft" },
  { value: "quoted",             label: "Quoted" },
  { value: "sent",               label: "Sent" },
  { value: "follow_up",          label: "Follow-up Required" },
  { value: "accepted",           label: "Accepted" },
  { value: "declined",           label: "Declined" },
  { value: "converted",          label: "Converted to Job" },
  { value: "converted_contract", label: "Converted to Contract" },
];

const VAT_MODES = [
  { value: "exclusive", label: "VAT Exclusive (add 15%)" },
  { value: "inclusive", label: "VAT Inclusive (15% included)" },
  { value: "none",      label: "No VAT" },
];

const VAT_RATE = 0.15;

interface QuoteLineItem {
  id: string;
  department: string;
  serviceType: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  frequency: string;
}

const emptyItem = (): QuoteLineItem => ({
  id: Math.random().toString(36).slice(2),
  department: "pest_control",
  serviceType: "",
  description: "",
  quantity: 1,
  unit: "Unit",
  unitPrice: 0,
  frequency: "monthly",
});

const fmtZAR = (n: number) =>
  `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Temporary safety-net so quote creation is never blocked if /api/legal-entities
// fails or returns nothing — used only when the real query errors or is empty.
const FALLBACK_LEGAL_ENTITIES: import("@shared/schema").LegalEntity[] = [
  { id: "terminators_cc", name: "Terminators CC", tradingName: null, registrationNumber: null,
    vatNumber: null, physicalAddress: null, postalAddress: null, phone: null, email: null,
    bankName: null, bankAccount: null, bankBranch: null, bankAccountType: null,
    defaultPaymentTerms: null, invoiceFooter: null, quoteFooter: null,
    isActive: true, isDefault: true, createdAt: new Date(), updatedAt: new Date() } as any,
  { id: "terminators_pty_ltd", name: "Terminators Pty Ltd", tradingName: null, registrationNumber: null,
    vatNumber: null, physicalAddress: null, postalAddress: null, phone: null, email: null,
    bankName: null, bankAccount: null, bankBranch: null, bankAccountType: null,
    defaultPaymentTerms: null, invoiceFooter: null, quoteFooter: null,
    isActive: true, isDefault: false, createdAt: new Date(), updatedAt: new Date() } as any,
];

// ── NewQuoteDialog ────────────────────────────────────────────────────────────

interface NewQuoteDialogProps {
  open: boolean;
  onClose: () => void;
  clients: Client[];
}

function NewQuoteDialog({ open, onClose, clients }: NewQuoteDialogProps) {
  const { toast } = useToast();
  const [tab, setTab] = useState("client");

  // Legal entity
  const [legalEntityId,   setLegalEntityId]   = useState("");
  const [legalEntityName, setLegalEntityName] = useState("");

  const {
    data: legalEntities = [],
    isLoading: legalEntitiesLoading,
    isError: legalEntitiesError,
    error: legalEntitiesFetchError,
    refetch: refetchLegalEntities,
  } = useQuery<import("@shared/schema").LegalEntity[]>({
    queryKey: ["/api/legal-entities"],
  });

  // TEMP DEBUG — remove once entity loading is confirmed fixed in production
  useEffect(() => {
    console.log("[IssuingEntity] Fetching /api/legal-entities…", { loading: legalEntitiesLoading });
  }, [legalEntitiesLoading]);
  useEffect(() => {
    if (legalEntitiesError) console.log("[IssuingEntity] API error:", legalEntitiesFetchError);
    else if (!legalEntitiesLoading) console.log("[IssuingEntity] API response:", legalEntities);
  }, [legalEntities, legalEntitiesError, legalEntitiesLoading]);

  // The dropdown is populated immediately from the hardcoded fallback list and
  // is upgraded in place once the real active entities arrive — it is NEVER
  // gated on the API call being in flight, so it can never get stuck showing
  // a loading state or be left unusable if the request is slow or fails.
  const realActiveEntities = legalEntities.filter(e => e.isActive);
  const availableEntities = realActiveEntities.length > 0 ? realActiveEntities : FALLBACK_LEGAL_ENTITIES;
  const usingFallbackEntities = availableEntities === FALLBACK_LEGAL_ENTITIES;

  // Auto-select default entity when list (real or fallback) loads
  useEffect(() => {
    if (availableEntities.length > 0 && !legalEntityId) {
      const def = availableEntities.find(e => e.isDefault && e.isActive) ?? availableEntities.find(e => e.isActive);
      if (def) { setLegalEntityId(def.id); setLegalEntityName(def.name); }
    }
  }, [availableEntities]);

  // TEMP DEBUG — remove once entity loading is confirmed fixed in production
  useEffect(() => {
    if (legalEntityId) console.log("[IssuingEntity] Selected entity:", { legalEntityId, legalEntityName, usingFallbackEntities });
  }, [legalEntityId, legalEntityName]);

  // Client fields
  const [companyName,     setCompanyName]     = useState("");
  const [contactPerson,   setContactPerson]   = useState("");
  const [phone,           setPhone]           = useState("");
  const [email,           setEmail]           = useState("");
  const [siteAddress,     setSiteAddress]     = useState("");
  const [billingAddress,  setBillingAddress]  = useState("");
  const [preferredContact,setPreferredContact]= useState("email");
  const [vatNumber,       setVatNumber]       = useState("");
  const [companyReg,      setCompanyReg]      = useState("");

  // Quote settings
  const [quoteType,     setQuoteType]     = useState("once_off");
  const [status,        setStatus]        = useState("draft");
  const [vatMode,       setVatMode]       = useState("exclusive");
  const [description,   setDescription]   = useState("");
  const [internalNotes, setInternalNotes] = useState("");

  // Line items
  const [lineItems, setLineItems] = useState<QuoteLineItem[]>([emptyItem()]);

  const reset = () => {
    setTab("client");
    setLegalEntityId(""); setLegalEntityName("");
    setCompanyName(""); setContactPerson(""); setPhone(""); setEmail("");
    setSiteAddress(""); setBillingAddress(""); setPreferredContact("email");
    setVatNumber(""); setCompanyReg("");
    setQuoteType("once_off"); setStatus("draft"); setVatMode("exclusive");
    setDescription(""); setInternalNotes("");
    setLineItems([emptyItem()]);
  };

  useEffect(() => { if (open) reset(); }, [open]);

  const fillFromClient = (clientId: string) => {
    const c = clients.find(cl => cl.id === clientId);
    if (!c) return;
    setCompanyName(c.name ?? "");
    setContactPerson(c.contactPerson ?? "");
    setEmail(c.email ?? "");
    setPhone(c.phone ?? "");
    setSiteAddress(c.address ?? "");
  };

  const updateItem = (id: string, changes: Partial<QuoteLineItem>) =>
    setLineItems(prev => prev.map(i => i.id === id ? { ...i, ...changes } : i));
  const removeItem = (id: string) =>
    setLineItems(prev => prev.filter(i => i.id !== id));

  // Calculations
  const itemTotal     = (i: QuoteLineItem) => i.quantity * i.unitPrice;
  const onceOffSub    = lineItems.filter(i => i.frequency === "once_off").reduce((s, i) => s + itemTotal(i), 0);
  const monthlySub    = lineItems.filter(i => i.frequency === "monthly").reduce((s, i) => s + itemTotal(i), 0);
  const otherSub      = lineItems.filter(i => i.frequency !== "once_off" && i.frequency !== "monthly").reduce((s, i) => s + itemTotal(i), 0);
  const allSub        = lineItems.reduce((s, i) => s + itemTotal(i), 0);
  const vatAmount     = vatMode === "exclusive" ? allSub * VAT_RATE
                      : vatMode === "inclusive" ? allSub * VAT_RATE / (1 + VAT_RATE)
                      : 0;
  const grandTotal    = vatMode === "exclusive" ? allSub + vatAmount : allSub;

  const mutation = useMutation({
    mutationFn: (payload: object) =>
      apiRequest("POST", "/api/quote-submissions", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quote-submissions"] });
      toast({ title: "Quote created" });
      reset();
      onClose();
    },
    onError: () => toast({ title: "Failed to create quote", variant: "destructive" }),
  });

  const handleSubmit = () => {
    if (!legalEntityId) { toast({ title: "Issuing entity is required", variant: "destructive" }); return; }
    if (!companyName.trim()) { setTab("client"); toast({ title: "Company name is required", variant: "destructive" }); return; }
    if (!contactPerson.trim()) { setTab("client"); toast({ title: "Contact person is required", variant: "destructive" }); return; }
    if (!email.trim()) { setTab("client"); toast({ title: "Email is required", variant: "destructive" }); return; }
    if (!phone.trim()) { setTab("client"); toast({ title: "Phone is required", variant: "destructive" }); return; }
    if (lineItems.length === 0) { setTab("items"); toast({ title: "Add at least one line item", variant: "destructive" }); return; }

    const depts = [...new Set(lineItems.map(i => i.department))];
    const primaryServiceType = depts.length === 1
      ? (depts[0] === "hygiene_washroom" ? "washroom" : depts[0] === "coc" ? "pest_control" : depts[0] === "dustmats" ? "pest_control" : depts[0])
      : "pest_control";

    mutation.mutate({
      companyName, contactPerson, email, phone,
      address: siteAddress,
      preferredContactMethod: preferredContact,
      serviceType: primaryServiceType,
      description: description || lineItems.map(i => i.description).filter(Boolean).join("; ") || "Quote",
      internalNotes,
      quoteType,
      status,
      legalEntityId: legalEntityId || undefined,
      legalEntityName: legalEntityName || undefined,
      lineItemsJson: JSON.stringify({
        items: lineItems,
        vatMode, billingAddress, vatNumber, companyReg,
        onceOffSubtotal: onceOffSub.toFixed(2),
        monthlySubtotal: monthlySub.toFixed(2),
        vatAmount: vatAmount.toFixed(2),
        grandTotal: grandTotal.toFixed(2),
      }),
      monthlyRecurring: monthlySub.toFixed(2),
      quoteAmount: grandTotal.toFixed(2),
      origination: "other",
    });
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-hidden flex flex-col p-0" onInteractOutside={e => e.preventDefault()}>
        <DialogHeader className="px-6 pt-5 pb-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-primary" /> New Quote
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex-1 overflow-hidden flex flex-col min-h-0">
          <TabsList className="mx-6 mt-3 mb-1 w-auto self-start shrink-0">
            <TabsTrigger value="client" data-testid="tab-client">1. Client Details</TabsTrigger>
            <TabsTrigger value="items" data-testid="tab-items">2. Quote Items</TabsTrigger>
            <TabsTrigger value="summary" data-testid="tab-summary">3. Notes &amp; Summary</TabsTrigger>
          </TabsList>

          {/* ── TAB 1: Client ──────────────────────────────────────────── */}
          <TabsContent value="client" className="flex-1 overflow-y-auto px-6 pb-6 mt-2">

            {/* Issuing Entity — always a live, working dropdown. It is populated
                from the hardcoded fallback list immediately, upgraded to the
                real API list once it arrives, and is never disabled. */}
            <div className={`rounded-md border p-3 mb-4 ${!legalEntityId ? "border-red-300 bg-red-50" : "border-gray-200 bg-gray-50"}`}>
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Issuing Entity <span className="text-red-500">*</span></span>
                {!legalEntityId && <span className="text-xs text-red-500">— please select one</span>}
              </div>
              <Select
                value={legalEntityId}
                onValueChange={id => {
                  const entity = availableEntities.find(e => e.id === id);
                  setLegalEntityId(id);
                  setLegalEntityName(entity?.name ?? "");
                  console.log("[IssuingEntity] Selected entity:", { id, name: entity?.name, usingFallbackEntities });
                }}
              >
                <SelectTrigger className="bg-white" data-testid="select-issuing-entity">
                  <SelectValue placeholder="Select issuing entity…" />
                </SelectTrigger>
                <SelectContent>
                  {availableEntities.map(e => (
                    <SelectItem key={e.id} value={e.id} data-testid={`entity-option-${e.id}`}>
                      {e.name}
                      {e.isDefault && <span className="ml-1 text-xs opacity-70">(default)</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {usingFallbackEntities && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-orange-600">
                    {legalEntitiesError
                      ? "Could not load issuing entities from the server — using default list."
                      : legalEntitiesLoading
                        ? "Loading full entity details in the background — default list shown for now."
                        : "No active issuing entities returned by the server — using default list."}
                  </span>
                  <button
                    type="button"
                    onClick={() => refetchLegalEntities()}
                    className="text-xs font-medium text-primary underline hover:no-underline"
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>

            <div className="rounded-md border bg-muted/40 p-3 mb-5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Auto-fill from existing client</p>
              <Select onValueChange={id => { if (id !== "__none__") fillFromClient(id); }}>
                <SelectTrigger className="bg-white"><SelectValue placeholder="Search and select a client…" /></SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value="__none__">— None (manual entry) —</SelectItem>
                  {[...clients].sort((a, b) => a.name.localeCompare(b.name)).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}{c.contactPerson ? ` · ${c.contactPerson}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <label className="text-sm font-medium">Company Name *</label>
                <Input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="e.g. ABC Holdings" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Contact Person *</label>
                <Input value={contactPerson} onChange={e => setContactPerson(e.target.value)} placeholder="Full name" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Phone *</label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+27 ..." />
              </div>
              <div className="col-span-2 space-y-1.5">
                <label className="text-sm font-medium">Email *</label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@company.co.za" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <label className="text-sm font-medium">Site Address</label>
                <Input value={siteAddress} onChange={e => setSiteAddress(e.target.value)} placeholder="Physical site address" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <label className="text-sm font-medium">Billing Address <span className="text-muted-foreground font-normal text-xs">(optional — if different)</span></label>
                <Input value={billingAddress} onChange={e => setBillingAddress(e.target.value)} placeholder="Leave blank if same as site address" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Preferred Contact</label>
                <Select value={preferredContact} onValueChange={setPreferredContact}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="phone">Phone</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="either">Either</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">VAT Number <span className="text-muted-foreground font-normal text-xs">(optional)</span></label>
                <Input value={vatNumber} onChange={e => setVatNumber(e.target.value)} placeholder="e.g. 4123456789" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <label className="text-sm font-medium">Company Registration No. <span className="text-muted-foreground font-normal text-xs">(optional)</span></label>
                <Input value={companyReg} onChange={e => setCompanyReg(e.target.value)} placeholder="e.g. 2021/123456/07" />
              </div>
            </div>

            <div className="flex justify-end mt-5">
              <Button onClick={() => setTab("items")}>Next: Quote Items →</Button>
            </div>
          </TabsContent>

          {/* ── TAB 2: Line Items ──────────────────────────────────────── */}
          <TabsContent value="items" className="flex-1 overflow-y-auto px-6 pb-6 mt-2 space-y-3">
            {lineItems.map((item, idx) => (
              <div key={item.id} className="border rounded-lg p-4 bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-muted-foreground">Item {idx + 1}</span>
                  {lineItems.length > 1 && (
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-red-500 hover:text-red-700 hover:bg-red-50 gap-1"
                      onClick={() => removeItem(item.id)}>
                      <Trash2 className="h-3.5 w-3.5" /> Remove
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Department</label>
                    <Select value={item.department} onValueChange={v => updateItem(item.id, { department: v, serviceType: "" })}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(DEPT_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Service / Product Type</label>
                    <Select value={item.serviceType} onValueChange={v => updateItem(item.id, { serviceType: v })}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select type…" /></SelectTrigger>
                      <SelectContent>{(DEPT_SERVICES[item.department] ?? ["Other"]).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="text-xs font-medium">Description</label>
                    <Input className="h-8 text-sm" value={item.description}
                      onChange={e => updateItem(item.id, { description: e.target.value })}
                      placeholder="Describe the work or product" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Qty</label>
                    <Input type="number" min="1" className="h-8 text-sm" value={item.quantity}
                      onChange={e => updateItem(item.id, { quantity: Math.max(1, Number(e.target.value) || 1) })} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Unit</label>
                    <Select value={item.unit} onValueChange={v => updateItem(item.id, { unit: v })}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>{ITEM_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Unit Price (R)</label>
                    <Input type="number" min="0" step="0.01" className="h-8 text-sm" value={item.unitPrice || ""}
                      onChange={e => updateItem(item.id, { unitPrice: Number(e.target.value) || 0 })} placeholder="0.00" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Frequency</label>
                    <Select value={item.frequency} onValueChange={v => updateItem(item.id, { frequency: v })}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>{ITEM_FREQS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 flex items-center justify-end pt-0.5 border-t mt-1">
                    <span className="text-sm text-muted-foreground mr-2">Line Total:</span>
                    <span className="font-bold text-primary text-base">{fmtZAR(itemTotal(item))}</span>
                    <span className="text-xs text-muted-foreground ml-1.5">
                      / {ITEM_FREQS.find(f => f.value === item.frequency)?.label}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            <Button variant="outline" className="w-full gap-2 border-dashed"
              onClick={() => setLineItems(p => [...p, emptyItem()])}>
              <Plus className="h-4 w-4" /> Add Line Item
            </Button>

            {lineItems.length > 0 && (
              <div className="rounded-md bg-muted/50 p-3 flex flex-wrap gap-4 text-sm">
                {onceOffSub > 0 && <span><span className="text-muted-foreground">Once-off: </span><strong>{fmtZAR(onceOffSub)}</strong></span>}
                {monthlySub > 0 && <span><span className="text-muted-foreground">Monthly: </span><strong>{fmtZAR(monthlySub)}/mo</strong></span>}
                {otherSub > 0  && <span><span className="text-muted-foreground">Other recurring: </span><strong>{fmtZAR(otherSub)}</strong></span>}
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setTab("client")}>← Back</Button>
              <Button onClick={() => setTab("summary")}>Next: Summary →</Button>
            </div>
          </TabsContent>

          {/* ── TAB 3: Notes & Summary ─────────────────────────────────── */}
          <TabsContent value="summary" className="flex-1 overflow-y-auto px-6 pb-6 mt-2 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Quote Type</label>
                <Select value={quoteType} onValueChange={setQuoteType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{QUOTE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Quote Status</label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{QUOTE_STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <label className="text-sm font-medium">VAT Treatment</label>
                <Select value={vatMode} onValueChange={setVatMode}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{VAT_MODES.map(v => <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <label className="text-sm font-medium">Description / Requirements</label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
                  placeholder="Describe the work required…" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <label className="text-sm font-medium">Internal Notes <span className="text-muted-foreground font-normal text-xs">(staff only)</span></label>
                <Textarea value={internalNotes} onChange={e => setInternalNotes(e.target.value)} rows={2}
                  placeholder="Notes not visible to the client…" />
              </div>
            </div>

            {/* Totals panel */}
            <div className="rounded-lg border bg-white p-4 space-y-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Quote Totals</h3>
              {allSub === 0
                ? <p className="text-sm text-muted-foreground">No line items — go to Quote Items to add them.</p>
                : <>
                    {onceOffSub > 0 && (
                      <div className="flex justify-between text-sm">
                        <span>Once-off total</span><span className="font-medium">{fmtZAR(onceOffSub)}</span>
                      </div>
                    )}
                    {monthlySub > 0 && (
                      <div className="flex justify-between text-sm">
                        <span>Monthly recurring</span><span className="font-medium">{fmtZAR(monthlySub)} /mo</span>
                      </div>
                    )}
                    {otherSub > 0 && (
                      <div className="flex justify-between text-sm">
                        <span>Other recurring</span><span className="font-medium">{fmtZAR(otherSub)}</span>
                      </div>
                    )}
                    {vatMode !== "none" && (
                      <div className="border-t pt-2 flex justify-between text-sm">
                        <span>{vatMode === "inclusive" ? "VAT (incl. 15%)" : "VAT (15%)"}</span>
                        <span className="font-medium">{fmtZAR(vatAmount)}</span>
                      </div>
                    )}
                    <div className="border-t pt-2 flex justify-between font-bold text-base">
                      <span>Total {vatMode === "exclusive" ? "incl. VAT" : vatMode === "inclusive" ? "(VAT incl.)" : "(No VAT)"}</span>
                      <span className="text-primary">{fmtZAR(grandTotal)}</span>
                    </div>
                  </>
              }
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setTab("items")}>← Back</Button>
              <Button onClick={handleSubmit} disabled={mutation.isPending} className="gap-2" data-testid="button-save-quote">
                <FileText className="h-4 w-4" />
                {mutation.isPending ? "Creating…" : "Create Quote"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

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
            {(quote as any).legalEntityName && (
              <span className="text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded">
                {(quote as any).legalEntityName}
              </span>
            )}
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

      <NewQuoteDialog open={showNewQuote} onClose={() => setShowNewQuote(false)} clients={clients} />
    </div>
  );
}
