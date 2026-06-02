import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import MobileNavigation from "@/components/layout/mobile-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  ArrowLeft, Building, Phone, Mail, MapPin, Edit, User, FileText,
  Briefcase, CreditCard, Calendar, ExternalLink, ClipboardList, Receipt,
  MessageSquare, FlaskConical, Package, FolderOpen, Plus, Trash2, ChevronDown, ChevronRight,
} from "lucide-react";
import { ClientForm } from "@/components/forms/client-form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatClientAddress, hasStructuredAddress, type Client, type Job, type Invoice, type Department } from "@shared/schema";

// ── Types ──────────────────────────────────────────────────────────────────

type ExtendedClient = Client & {
  tradingName?: string;
  alternateEmailAddress?: string;
  alternatePhoneNumber?: string;
  billingName?: string;
  billingEmail?: string;
  billingPhone?: string;
  companyRegistrationNumber?: string;
};

type ServiceContract = {
  id: string; clientId: string; customerName: string; contractNumber?: string;
  serviceType: string; departmentId: string; frequency: string;
  assignedTeamId?: string; assignedTeamName?: string; assignedTechnicianName?: string;
  startTime?: string; estimatedDuration?: number; startDate?: string | Date;
  endDate?: string | Date; activeStatus: boolean; contractPrice?: string;
  notes?: string; dayOfWeek?: string; weekOfMonth?: number;
};

type QuoteSubmission = {
  id: string; clientId?: string; companyName: string; status: string; stage?: string;
  serviceType?: string; quoteAmount?: string; quoteNumber?: string; createdAt?: string; notes?: string;
};

type TreatmentReport = {
  id: string; clientId: string; jobId?: string; contractId?: string;
  technicianId?: string; technicianName?: string; reportDate: string;
  reportNumber?: string; serviceType?: string; pestType?: string; treatmentType?: string;
  siteArea?: string; chemicalsUsed?: string; quantityUsed?: string; batchNumber?: string;
  activeIngredient?: string; treatmentNotes?: string; recommendations?: string;
  followUpRequired?: boolean; followUpDate?: string; customerName?: string;
  status?: string; createdAt?: string;
};

type CommunicationNote = {
  id: string; clientId: string; jobId?: string; contractId?: string;
  noteDate: string; noteTime?: string; type: string; contactPerson?: string;
  notes: string; confirmationReceived?: boolean; createdBy?: string; createdAt?: string;
};

type JobInventoryItem = {
  id: string; jobId: string; inventoryItemId: string; quantity: number;
  unitPrice?: string; notes?: string; isRental?: boolean; createdAt?: string;
};

type InventoryItem = {
  id: string; name: string; type?: string; unitPrice?: string; description?: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────

function statusColor(status: string) {
  switch (status) {
    case "active":    return "bg-green-100 text-green-800";
    case "inactive":  return "bg-gray-100 text-gray-700";
    case "suspended": return "bg-red-100 text-red-800";
    default:          return "bg-gray-100 text-gray-700";
  }
}

function jobStatusColor(status: string) {
  switch (status) {
    case "completed":   return "bg-green-100 text-green-800";
    case "in_progress": return "bg-blue-100 text-blue-800";
    case "scheduled":   return "bg-purple-100 text-purple-800";
    case "cancelled":   return "bg-red-100 text-red-800";
    default:            return "bg-gray-100 text-gray-700";
  }
}

function invoiceStatusColor(status: string) {
  switch (status) {
    case "paid":    return "bg-green-100 text-green-800";
    case "sent":    return "bg-blue-100 text-blue-800";
    case "overdue": return "bg-red-100 text-red-800";
    case "draft":   return "bg-gray-100 text-gray-700";
    default:        return "bg-gray-100 text-gray-700";
  }
}

const NOTE_TYPES = ["WhatsApp", "Phone", "Email", "In Person", "Other"] as const;

const DOC_CATEGORIES = [
  { label: "Treatment Reports",       icon: "📋", desc: "Pest control & fumigation reports" },
  { label: "Installation Checklists", icon: "✅", desc: "Equipment and device installation records" },
  { label: "Survey Sheets",           icon: "📐", desc: "Site survey and assessment forms" },
  { label: "Photos / Pictures",       icon: "📷", desc: "Before and after service photos" },
  { label: "Proof of Delivery",       icon: "📦", desc: "Signed delivery confirmations" },
  { label: "Signed Worksheets",       icon: "✍️",  desc: "Client-signed service worksheets" },
  { label: "ISO Pest Control File",   icon: "🏷️",  desc: "ISO compliance documentation" },
  { label: "Other Documents",         icon: "📎", desc: "General correspondence and files" },
];

// ── Main Page ──────────────────────────────────────────────────────────────

export default function ClientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [isEditOpen,      setIsEditOpen]      = useState(false);
  const [trOpen,          setTrOpen]          = useState(false);
  const [cnOpen,          setCnOpen]          = useState(false);
  const [expandedTr,      setExpandedTr]      = useState<string | null>(null);
  const [expandedCn,      setExpandedCn]      = useState<string | null>(null);

  // Treatment report form
  const [trForm, setTrForm] = useState<Partial<TreatmentReport>>({});

  // Communication note form
  const [cnForm, setCnForm] = useState<Partial<CommunicationNote>>({
    type: "Phone", noteDate: format(new Date(), "yyyy-MM-dd"),
  });

  // ── Queries ───────────────────────────────────────────────────────────────

  const { data: client, isLoading } = useQuery<ExtendedClient>({
    queryKey: ["/api/clients", id],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${id}`);
      if (!res.ok) throw new Error("Client not found");
      return res.json();
    },
    enabled: !!id,
  });

  const { data: allJobs = [] }      = useQuery<Job[]>({ queryKey: ["/api/jobs"] });
  const { data: allInvoices = [] }  = useQuery<Invoice[]>({ queryKey: ["/api/invoices"] });
  const { data: allContracts = [] } = useQuery<ServiceContract[]>({ queryKey: ["/api/service-contracts"] });
  const { data: allQuotes = [] }    = useQuery<QuoteSubmission[]>({ queryKey: ["/api/quote-submissions"] });
  const { data: departments = [] }  = useQuery<Department[]>({ queryKey: ["/api/departments"] });
  const { data: allClients = [] }   = useQuery<Client[]>({ queryKey: ["/api/clients"] });

  const { data: treatmentRpts = [] } = useQuery<TreatmentReport[]>({
    queryKey: ["/api/treatment-reports", id],
    queryFn: () => fetch(`/api/treatment-reports?clientId=${id}`).then(r => r.json()),
    enabled: !!id,
  });

  const { data: commNotes = [] } = useQuery<CommunicationNote[]>({
    queryKey: ["/api/communication-notes", id],
    queryFn: () => fetch(`/api/communication-notes?clientId=${id}`).then(r => r.json()),
    enabled: !!id,
  });

  const { data: allInventoryItems = [] } = useQuery<InventoryItem[]>({ queryKey: ["/api/inventory"] });

  // Stock usage: collect all job-inventory items for client's jobs
  const clientJobIds = new Set(allJobs.filter(j => j.clientId === id).map(j => j.id));
  // We use a combined query for all job-inventory-items (no dedicated per-client endpoint yet)
  const { data: allJobInvItems = [] } = useQuery<JobInventoryItem[]>({
    queryKey: ["/api/job-inventory"],
    enabled: !!id,
  });
  const clientStockUsage = allJobInvItems.filter(i => clientJobIds.has(i.jobId));

  // ── Derived ───────────────────────────────────────────────────────────────

  const clientJobs       = allJobs.filter(j => j.clientId === id);
  const clientInvoices   = allInvoices.filter(i => i.clientId === id);
  const clientContracts  = allContracts.filter(c => c.clientId === id);
  const clientQuotes     = allQuotes.filter(q =>
    q.clientId === id ||
    (q.companyName && client && q.companyName.toLowerCase() === client.name.toLowerCase())
  );

  const upcomingJobs  = clientJobs.filter(j => j.status === "scheduled" && new Date(j.scheduledDate) >= new Date());
  const inProgressJobs= clientJobs.filter(j => j.status === "in_progress");
  const completedJobs = clientJobs.filter(j => j.status === "completed");
  const otherJobs     = clientJobs.filter(j => !["scheduled","in_progress","completed"].includes(j.status));

  const getDeptName = (deptId?: string) => departments.find(d => d.id === deptId)?.name ?? "—";
  const getJobTitle = (jobId?: string)  => allJobs.find(j => j.id === jobId)?.title ?? jobId ?? "—";
  const getItemName = (itemId: string)  => allInventoryItems.find(i => i.id === itemId)?.name ?? itemId;

  // ── Mutations ─────────────────────────────────────────────────────────────

  const updateMutation = useMutation({
    mutationFn: async (data: any) => (await apiRequest("PATCH", `/api/clients/${id}`, data)).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/clients", id] });
      qc.invalidateQueries({ queryKey: ["/api/clients"] });
      setIsEditOpen(false);
      toast({ description: "Client updated successfully" });
    },
    onError: () => toast({ description: "Failed to update client", variant: "destructive" }),
  });

  const createTr = useMutation({
    mutationFn: async (data: any) => (await apiRequest("POST", "/api/treatment-reports", { ...data, clientId: id })).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/treatment-reports", id] });
      setTrOpen(false);
      setTrForm({});
      toast({ description: "Treatment report saved" });
    },
    onError: (e: any) => toast({ description: e?.message ?? "Save failed", variant: "destructive" }),
  });

  const deleteTr = useMutation({
    mutationFn: (rid: string) => apiRequest("DELETE", `/api/treatment-reports/${rid}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/treatment-reports", id] }); toast({ description: "Report deleted" }); },
  });

  const createCn = useMutation({
    mutationFn: async (data: any) => (await apiRequest("POST", "/api/communication-notes", { ...data, clientId: id })).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/communication-notes", id] });
      setCnOpen(false);
      setCnForm({ type: "Phone", noteDate: format(new Date(), "yyyy-MM-dd") });
      toast({ description: "Note saved" });
    },
    onError: (e: any) => toast({ description: e?.message ?? "Save failed", variant: "destructive" }),
  });

  const deleteCn = useMutation({
    mutationFn: (nid: string) => apiRequest("DELETE", `/api/communication-notes/${nid}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/communication-notes", id] }); toast({ description: "Note deleted" }); },
  });

  // ── Loading / not found ───────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen flex bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Loading client profile…</p>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen flex bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">Client not found.</p>
            <Link href="/clients">
              <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Clients</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const c = client;

  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Client Profile" />
        <main className="flex-1 overflow-y-auto p-6 pb-20 lg:pb-6">
          <div className="max-w-6xl mx-auto space-y-6">

            {/* Back */}
            <div className="flex items-center gap-3">
              <Link href="/clients">
                <Button variant="ghost" size="sm"><ArrowLeft className="mr-1 h-4 w-4" /> Clients</Button>
              </Link>
            </div>

            {/* Header Card */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row gap-4 justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h1 className="text-2xl font-bold">{client.name}</h1>
                      {c.tradingName && <span className="text-muted-foreground text-sm">T/A {c.tradingName}</span>}
                      <Badge className={statusColor(client.status)}>{client.status}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      {client.businessType && <span className="flex items-center gap-1"><Building className="h-3.5 w-3.5" />{client.businessType}</span>}
                      {client.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{client.phone}</span>}
                      {client.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{client.email}</span>}
                      {(client.suburb || client.city) && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{[client.suburb, client.city].filter(Boolean).join(", ")}</span>}
                    </div>
                    <div className="flex gap-3 text-xs text-muted-foreground pt-1">
                      <span>{getDeptName(client.departmentId)}</span>
                      {client.contactPerson && <span>· Contact: {client.contactPerson}</span>}
                    </div>
                  </div>
                  <div className="shrink-0">
                    <Button onClick={() => setIsEditOpen(true)} size="sm">
                      <Edit className="mr-2 h-4 w-4" /> Edit Client
                    </Button>
                  </div>
                </div>

                {/* Quick stats */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4 pt-4 border-t">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{clientJobs.length}</div>
                    <div className="text-xs text-muted-foreground">Jobs</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{clientContracts.filter(c => c.activeStatus).length}</div>
                    <div className="text-xs text-muted-foreground">Active Contracts</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{clientInvoices.filter(i => i.status !== "paid").length}</div>
                    <div className="text-xs text-muted-foreground">Open Invoices</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-teal-600">{treatmentRpts.length}</div>
                    <div className="text-xs text-muted-foreground">Treatment Reports</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">{commNotes.length}</div>
                    <div className="text-xs text-muted-foreground">Comm. Notes</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tabs */}
            <Tabs defaultValue="details">
              <TabsList className="flex-wrap h-auto gap-1">
                <TabsTrigger value="details">
                  <User className="mr-1 h-3.5 w-3.5" />Details
                </TabsTrigger>
                <TabsTrigger value="jobs">
                  <Briefcase className="mr-1 h-3.5 w-3.5" />Jobs
                  {clientJobs.length > 0 && <Badge variant="secondary" className="ml-1 text-xs py-0 px-1.5">{clientJobs.length}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="contracts">
                  <ClipboardList className="mr-1 h-3.5 w-3.5" />Contracts
                  {clientContracts.length > 0 && <Badge variant="secondary" className="ml-1 text-xs py-0 px-1.5">{clientContracts.length}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="invoices">
                  <Receipt className="mr-1 h-3.5 w-3.5" />Invoices
                  {clientInvoices.length > 0 && <Badge variant="secondary" className="ml-1 text-xs py-0 px-1.5">{clientInvoices.length}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="treatment-reports">
                  <FlaskConical className="mr-1 h-3.5 w-3.5" />Treatment Reports
                  {treatmentRpts.length > 0 && <Badge variant="secondary" className="ml-1 text-xs py-0 px-1.5">{treatmentRpts.length}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="comm-notes">
                  <MessageSquare className="mr-1 h-3.5 w-3.5" />Comm. Notes
                  {commNotes.length > 0 && <Badge variant="secondary" className="ml-1 text-xs py-0 px-1.5">{commNotes.length}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="stock-usage">
                  <Package className="mr-1 h-3.5 w-3.5" />Stock Usage
                  {clientStockUsage.length > 0 && <Badge variant="secondary" className="ml-1 text-xs py-0 px-1.5">{clientStockUsage.length}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="documents">
                  <FolderOpen className="mr-1 h-3.5 w-3.5" />Documents
                </TabsTrigger>
                <TabsTrigger value="quotes">
                  <FileText className="mr-1 h-3.5 w-3.5" />Quotes
                  {clientQuotes.length > 0 && <Badge variant="secondary" className="ml-1 text-xs py-0 px-1.5">{clientQuotes.length}</Badge>}
                </TabsTrigger>
              </TabsList>

              {/* ── DETAILS ──────────────────────────────────────────────── */}
              <TabsContent value="details" className="space-y-4 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Building className="h-4 w-4" />Business Details</CardTitle></CardHeader>
                    <CardContent className="text-sm space-y-1.5">
                      <Row label="Business Name"  value={client.name} />
                      {c.tradingName && <Row label="Trading Name" value={c.tradingName} />}
                      <Row label="Business Type"  value={client.businessType} />
                      <Row label="Department"     value={getDeptName(client.departmentId)} />
                      <Row label="Status"         value={<Badge className={statusColor(client.status)}>{client.status}</Badge>} />
                      <Row label="Created"        value={format(new Date(client.createdAt), "dd MMM yyyy")} />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><User className="h-4 w-4" />Contact Details</CardTitle></CardHeader>
                    <CardContent className="text-sm space-y-1.5">
                      <Row label="Contact Person"  value={client.contactPerson} />
                      <Row label="Phone"           value={client.phone} />
                      {c.alternatePhoneNumber && <Row label="Alt. Phone" value={c.alternatePhoneNumber} />}
                      <Row label="Email"           value={client.email} />
                      {c.alternateEmailAddress && <Row label="Alt. Email" value={c.alternateEmailAddress} />}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><MapPin className="h-4 w-4" />Physical Address</CardTitle></CardHeader>
                    <CardContent className="text-sm space-y-1.5">
                      {hasStructuredAddress(client) ? (
                        <>
                          <Row label="Street"      value={[client.streetNumber, client.streetName].filter(Boolean).join(" ") || undefined} />
                          <Row label="Suburb"      value={client.suburb} />
                          <Row label="City"        value={client.city} />
                          <Row label="Province"    value={client.province} />
                          <Row label="Postal Code" value={client.postalCode} />
                        </>
                      ) : client.address ? (
                        <p className="whitespace-pre-line text-muted-foreground">{client.address}</p>
                      ) : (
                        <p className="text-muted-foreground italic">No address on file</p>
                      )}
                      {client.googleMapsLink && (
                        <a href={client.googleMapsLink} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-green-700 hover:text-green-800 underline text-xs mt-1">
                          <ExternalLink className="h-3 w-3" /> Open in Google Maps
                        </a>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><CreditCard className="h-4 w-4" />Billing & Financial</CardTitle></CardHeader>
                    <CardContent className="text-sm space-y-1.5">
                      {(c.billingName || c.billingEmail || c.billingPhone) && (
                        <>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Billing Contact</p>
                          {c.billingName  && <Row label="Name"  value={c.billingName} />}
                          {c.billingEmail && <Row label="Email" value={c.billingEmail} />}
                          {c.billingPhone && <Row label="Phone" value={c.billingPhone} />}
                          <div className="border-t pt-1.5 mt-1.5" />
                        </>
                      )}
                      <Row label="VAT Number"    value={client.taxNumber} />
                      {c.companyRegistrationNumber && <Row label="Reg. Number" value={c.companyRegistrationNumber} />}
                      <Row label="Payment Terms" value={client.paymentTerms} />
                      <Row label="Credit Limit"  value={client.creditLimit ? `R${Number(client.creditLimit).toFixed(2)}` : undefined} />
                    </CardContent>
                  </Card>
                </div>

                {client.notes && (
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Internal Notes</CardTitle></CardHeader>
                    <CardContent><p className="text-sm text-muted-foreground whitespace-pre-line">{client.notes}</p></CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* ── JOBS ─────────────────────────────────────────────────── */}
              <TabsContent value="jobs" className="space-y-4 mt-4">
                {clientJobs.length === 0 ? (
                  <Card><CardContent className="py-8 text-center text-muted-foreground">No jobs found for this client.</CardContent></Card>
                ) : (
                  <>
                    {inProgressJobs.length > 0  && <JobGroup title="In Progress"        jobs={inProgressJobs}  getDeptName={getDeptName} />}
                    {upcomingJobs.length > 0     && <JobGroup title="Upcoming / Scheduled" jobs={upcomingJobs}   getDeptName={getDeptName} />}
                    {completedJobs.length > 0    && <JobGroup title="Completed"          jobs={completedJobs}   getDeptName={getDeptName} />}
                    {otherJobs.length > 0        && <JobGroup title="Other"              jobs={otherJobs}       getDeptName={getDeptName} />}
                  </>
                )}
              </TabsContent>

              {/* ── CONTRACTS ────────────────────────────────────────────── */}
              <TabsContent value="contracts" className="mt-4">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm text-muted-foreground">{clientContracts.length} contract{clientContracts.length !== 1 ? "s" : ""}</span>
                  <Link href={`/service-contracts?newContract=1&clientId=${id}&clientName=${encodeURIComponent(client.name)}`}>
                    <Button size="sm" variant="outline" className="gap-1"><Plus className="h-3.5 w-3.5" />New Contract</Button>
                  </Link>
                </div>
                {clientContracts.length === 0 ? (
                  <Card><CardContent className="py-8 text-center text-muted-foreground">No service contracts for this client.</CardContent></Card>
                ) : (
                  <div className="space-y-3">
                    {clientContracts.map(contract => {
                      const parts: string[] = [];
                      if (contract.frequency) parts.push(contract.frequency);
                      if (contract.dayOfWeek)  parts.push(contract.dayOfWeek);
                      if (contract.weekOfMonth) parts.push(`Week ${contract.weekOfMonth}`);
                      if (contract.startTime)  parts.push(`@ ${contract.startTime}`);
                      return (
                        <Card key={contract.id}>
                          <CardContent className="pt-4">
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                              <div className="space-y-1.5 flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {contract.contractNumber && (
                                    <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{contract.contractNumber}</span>
                                  )}
                                  <span className="font-medium text-sm">{contract.serviceType}</span>
                                  <Badge className={contract.activeStatus ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"}>
                                    {contract.activeStatus ? "Active" : "Inactive"}
                                  </Badge>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                                  <span><span className="font-medium text-gray-600">Dept:</span> {getDeptName(contract.departmentId)}</span>
                                  {parts.length > 0 && <span className="col-span-2"><span className="font-medium text-gray-600">Schedule:</span> {parts.join(" · ")}</span>}
                                  {(contract.assignedTeamName || contract.assignedTechnicianName) && (
                                    <span className="col-span-2 sm:col-span-3"><span className="font-medium text-gray-600">Assigned:</span> {contract.assignedTeamName || contract.assignedTechnicianName}</span>
                                  )}
                                  {contract.contractPrice && <span><span className="font-medium text-gray-600">Price:</span> R{Number(contract.contractPrice).toFixed(2)}</span>}
                                  {contract.startDate && <span><span className="font-medium text-gray-600">Start:</span> {format(new Date(contract.startDate), "dd MMM yyyy")}</span>}
                                  {contract.endDate && <span><span className="font-medium text-gray-600">End:</span> {format(new Date(contract.endDate), "dd MMM yyyy")}</span>}
                                  {contract.estimatedDuration && <span><span className="font-medium text-gray-600">Duration:</span> {contract.estimatedDuration} min</span>}
                                </div>
                              </div>
                              <Link href="/service-contracts">
                                <Button variant="outline" size="sm" className="text-xs shrink-0"><ExternalLink className="mr-1 h-3 w-3" />View</Button>
                              </Link>
                            </div>
                            {contract.notes && <p className="text-xs text-muted-foreground mt-2 border-t pt-2">{contract.notes}</p>}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              {/* ── INVOICES ─────────────────────────────────────────────── */}
              <TabsContent value="invoices" className="mt-4">
                {clientInvoices.length === 0 ? (
                  <Card><CardContent className="py-8 text-center text-muted-foreground">No invoices for this client.</CardContent></Card>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="border-b bg-gray-50 text-xs text-muted-foreground">
                          <th className="text-left p-2">Invoice #</th>
                          <th className="text-left p-2">Date</th>
                          <th className="text-left p-2">Due</th>
                          <th className="text-right p-2">Total</th>
                          <th className="text-left p-2">Status</th>
                          <th className="p-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {clientInvoices.map(inv => (
                          <tr key={inv.id} className="border-b hover:bg-gray-50">
                            <td className="p-2 font-mono text-xs">{inv.invoiceNumber}</td>
                            <td className="p-2">{format(new Date(inv.issueDate), "dd MMM yyyy")}</td>
                            <td className="p-2">{format(new Date(inv.dueDate), "dd MMM yyyy")}</td>
                            <td className="p-2 text-right font-medium">R{Number(inv.total).toFixed(2)}</td>
                            <td className="p-2"><Badge className={`text-xs ${invoiceStatusColor(inv.status)}`}>{inv.status}</Badge></td>
                            <td className="p-2">
                              <Link href="/invoices"><Button variant="ghost" size="sm" className="h-6 text-xs"><ExternalLink className="h-3 w-3" /></Button></Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>

              {/* ── TREATMENT REPORTS ────────────────────────────────────── */}
              <TabsContent value="treatment-reports" className="mt-4">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm text-muted-foreground">{treatmentRpts.length} report{treatmentRpts.length !== 1 ? "s" : ""}</span>
                  <Button size="sm" className="gap-1" onClick={() => { setTrForm({ reportDate: format(new Date(), "yyyy-MM-dd"), customerName: client.name }); setTrOpen(true); }}>
                    <Plus className="h-3.5 w-3.5" />New Report
                  </Button>
                </div>

                {treatmentRpts.length === 0 ? (
                  <Card><CardContent className="py-8 text-center text-muted-foreground">No treatment reports for this client.</CardContent></Card>
                ) : (
                  <div className="space-y-2">
                    {treatmentRpts.map(r => {
                      const isOpen = expandedTr === r.id;
                      return (
                        <Card key={r.id} className="overflow-hidden">
                          <button
                            className="w-full text-left"
                            onClick={() => setExpandedTr(isOpen ? null : r.id)}
                          >
                            <CardContent className="pt-3 pb-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-3 flex-wrap min-w-0">
                                  {isOpen ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />}
                                  {r.reportNumber && <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{r.reportNumber}</span>}
                                  <span className="font-medium text-sm">{format(new Date(r.reportDate), "dd MMM yyyy")}</span>
                                  {r.serviceType && <Badge variant="outline" className="text-xs">{r.serviceType}</Badge>}
                                  {r.pestType && <span className="text-xs text-muted-foreground">{r.pestType}</span>}
                                  {r.technicianName && <span className="text-xs text-muted-foreground hidden sm:inline">· {r.technicianName}</span>}
                                  {r.followUpRequired && <Badge className="bg-amber-100 text-amber-800 text-xs">Follow-up required</Badge>}
                                </div>
                                <Button
                                  size="sm" variant="ghost"
                                  onClick={e => { e.stopPropagation(); if (confirm("Delete this report?")) deleteTr.mutate(r.id); }}
                                  className="shrink-0 h-7 w-7 p-0"
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-red-400" />
                                </Button>
                              </div>
                            </CardContent>
                          </button>
                          {isOpen && (
                            <div className="border-t bg-gray-50 px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                              <Row label="Service Type"     value={r.serviceType} />
                              <Row label="Pest Type"        value={r.pestType} />
                              <Row label="Treatment Type"   value={r.treatmentType} />
                              <Row label="Site Area"        value={r.siteArea} />
                              <Row label="Chemicals Used"   value={r.chemicalsUsed} />
                              <Row label="Quantity Used"    value={r.quantityUsed} />
                              <Row label="Batch Number"     value={r.batchNumber} />
                              <Row label="Active Ingredient" value={r.activeIngredient} />
                              <Row label="Technician"       value={r.technicianName} />
                              <Row label="Job"              value={r.jobId ? getJobTitle(r.jobId) : undefined} />
                              {r.followUpDate && <Row label="Follow-up Date" value={r.followUpDate} />}
                              {r.treatmentNotes && (
                                <div className="col-span-2">
                                  <span className="text-muted-foreground">Treatment Notes: </span>
                                  <span className="font-medium">{r.treatmentNotes}</span>
                                </div>
                              )}
                              {r.recommendations && (
                                <div className="col-span-2">
                                  <span className="text-muted-foreground">Recommendations: </span>
                                  <span className="font-medium">{r.recommendations}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              {/* ── COMMUNICATION NOTES ──────────────────────────────────── */}
              <TabsContent value="comm-notes" className="mt-4">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm text-muted-foreground">{commNotes.length} note{commNotes.length !== 1 ? "s" : ""}</span>
                  <Button size="sm" className="gap-1" onClick={() => { setCnForm({ type: "Phone", noteDate: format(new Date(), "yyyy-MM-dd") }); setCnOpen(true); }}>
                    <Plus className="h-3.5 w-3.5" />Add Note
                  </Button>
                </div>

                {commNotes.length === 0 ? (
                  <Card><CardContent className="py-8 text-center text-muted-foreground">No communication notes yet.</CardContent></Card>
                ) : (
                  <div className="space-y-2">
                    {commNotes.map(n => {
                      const isOpen = expandedCn === n.id;
                      return (
                        <Card key={n.id} className="overflow-hidden">
                          <button className="w-full text-left" onClick={() => setExpandedCn(isOpen ? null : n.id)}>
                            <CardContent className="pt-3 pb-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-3 flex-wrap min-w-0">
                                  {isOpen ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />}
                                  <span className="font-medium text-sm">{format(new Date(n.noteDate), "dd MMM yyyy")}</span>
                                  {n.noteTime && <span className="text-xs text-muted-foreground">{n.noteTime}</span>}
                                  <Badge variant="outline" className="text-xs">{n.type}</Badge>
                                  {n.contactPerson && <span className="text-xs text-muted-foreground hidden sm:inline">{n.contactPerson}</span>}
                                  {n.confirmationReceived && <Badge className="bg-green-100 text-green-800 text-xs">Confirmed</Badge>}
                                </div>
                                <Button
                                  size="sm" variant="ghost"
                                  onClick={e => { e.stopPropagation(); if (confirm("Delete this note?")) deleteCn.mutate(n.id); }}
                                  className="shrink-0 h-7 w-7 p-0"
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-red-400" />
                                </Button>
                              </div>
                              <p className="text-sm text-gray-700 mt-1 pl-7 line-clamp-2">{n.notes}</p>
                            </CardContent>
                          </button>
                          {isOpen && (
                            <div className="border-t bg-gray-50 px-4 py-3 space-y-1.5 text-sm">
                              <Row label="Date"         value={`${n.noteDate}${n.noteTime ? " " + n.noteTime : ""}`} />
                              <Row label="Type"         value={n.type} />
                              <Row label="Contact"      value={n.contactPerson} />
                              <Row label="Confirmed"    value={n.confirmationReceived ? "Yes" : "No"} />
                              {n.createdBy && <Row label="Logged by" value={n.createdBy} />}
                              <div>
                                <span className="text-muted-foreground">Notes: </span>
                                <span className="font-medium whitespace-pre-line">{n.notes}</span>
                              </div>
                            </div>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              {/* ── STOCK USAGE ──────────────────────────────────────────── */}
              <TabsContent value="stock-usage" className="mt-4">
                {clientStockUsage.length === 0 ? (
                  <Card><CardContent className="py-8 text-center text-muted-foreground">No stock usage recorded for this client's jobs.</CardContent></Card>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Item</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Job</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Qty</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Unit Price</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Type</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clientStockUsage.map(item => (
                          <tr key={item.id} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="px-3 py-2.5 font-medium">{getItemName(item.inventoryItemId)}</td>
                            <td className="px-3 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">{getJobTitle(item.jobId)}</td>
                            <td className="px-3 py-2.5">{item.quantity}</td>
                            <td className="px-3 py-2.5 text-xs text-muted-foreground hidden md:table-cell">{item.unitPrice ? `R${Number(item.unitPrice).toFixed(2)}` : "—"}</td>
                            <td className="px-3 py-2.5 hidden md:table-cell">
                              {item.isRental ? <Badge className="bg-blue-100 text-blue-800 text-xs">Rental</Badge> : <Badge variant="outline" className="text-xs">Consumable</Badge>}
                            </td>
                            <td className="px-3 py-2.5 text-xs text-muted-foreground hidden lg:table-cell">{item.notes ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>

              {/* ── DOCUMENTS ────────────────────────────────────────────── */}
              <TabsContent value="documents" className="mt-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  {DOC_CATEGORIES.map(dc => (
                    <Card key={dc.label} className="hover:shadow-sm transition-shadow cursor-default">
                      <CardContent className="pt-4 pb-4 text-center">
                        <div className="text-3xl mb-2">{dc.icon}</div>
                        <div className="text-sm font-medium text-gray-800">{dc.label}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{dc.desc}</div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                  <strong>Coming soon:</strong> File uploads (Treatment Reports, Signed Worksheets, Photos, etc.) will be available here.
                  Treatment reports can already be saved under the <strong>Treatment Reports</strong> tab.
                </div>
              </TabsContent>

              {/* ── QUOTES / LEADS ───────────────────────────────────────── */}
              <TabsContent value="quotes" className="mt-4">
                {clientQuotes.length === 0 ? (
                  <Card><CardContent className="py-8 text-center text-muted-foreground">No quotes or leads for this client.</CardContent></Card>
                ) : (
                  <div className="space-y-3">
                    {clientQuotes.map(q => (
                      <Card key={q.id}>
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                {q.quoteNumber && <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{q.quoteNumber}</span>}
                                {q.serviceType && <span className="text-sm font-medium">{q.serviceType}</span>}
                                <Badge variant="outline" className="text-xs">{q.status}</Badge>
                                {q.stage && <Badge variant="secondary" className="text-xs">{q.stage.replace(/_/g, " ")}</Badge>}
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                                {q.quoteAmount && <span>Amount: R{Number(q.quoteAmount).toFixed(2)}</span>}
                                {q.createdAt && <span>Created: {format(new Date(q.createdAt), "dd MMM yyyy")}</span>}
                              </div>
                              {q.notes && <p className="text-xs text-muted-foreground">{q.notes}</p>}
                            </div>
                            <Link href="/leads">
                              <Button variant="outline" size="sm" className="text-xs shrink-0"><ExternalLink className="mr-1 h-3 w-3" />View</Button>
                            </Link>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </main>
        <MobileNavigation />
      </div>

      {/* ── Edit Client Dialog ───────────────────────────────────────────── */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
            <DialogDescription>Update client information.</DialogDescription>
          </DialogHeader>
          <ClientForm
            client={client}
            allClients={allClients}
            onSubmit={data => updateMutation.mutate(data)}
            onCancel={() => setIsEditOpen(false)}
            isSubmitting={updateMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* ── New Treatment Report Dialog ──────────────────────────────────── */}
      <Dialog open={trOpen} onOpenChange={o => { setTrOpen(o); if (!o) setTrForm({}); }}>
        <DialogContent className="max-w-2xl max-h-[93vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Treatment Report</DialogTitle>
            <DialogDescription>Save a treatment report for {client.name}</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 py-1">
            <div>
              <Label>Report Date *</Label>
              <Input type="date" value={trForm.reportDate ?? ""} onChange={e => setTrForm(f => ({ ...f, reportDate: e.target.value }))} />
            </div>
            <div>
              <Label>Report Number</Label>
              <Input value={trForm.reportNumber ?? ""} onChange={e => setTrForm(f => ({ ...f, reportNumber: e.target.value }))} placeholder="e.g. TR-2026-001" />
            </div>
            <div>
              <Label>Service Type</Label>
              <Input value={trForm.serviceType ?? ""} onChange={e => setTrForm(f => ({ ...f, serviceType: e.target.value }))} placeholder="e.g. Pest Control" />
            </div>
            <div>
              <Label>Pest Type</Label>
              <Input value={trForm.pestType ?? ""} onChange={e => setTrForm(f => ({ ...f, pestType: e.target.value }))} placeholder="e.g. Cockroach, Rodent" />
            </div>
            <div>
              <Label>Treatment Type</Label>
              <Input value={trForm.treatmentType ?? ""} onChange={e => setTrForm(f => ({ ...f, treatmentType: e.target.value }))} placeholder="e.g. Spray, Bait, Fumigation" />
            </div>
            <div>
              <Label>Site Area</Label>
              <Input value={trForm.siteArea ?? ""} onChange={e => setTrForm(f => ({ ...f, siteArea: e.target.value }))} placeholder="e.g. Kitchen, Basement" />
            </div>
            <div>
              <Label>Chemicals Used</Label>
              <Input value={trForm.chemicalsUsed ?? ""} onChange={e => setTrForm(f => ({ ...f, chemicalsUsed: e.target.value }))} placeholder="Product name(s)" />
            </div>
            <div>
              <Label>Quantity Used</Label>
              <Input value={trForm.quantityUsed ?? ""} onChange={e => setTrForm(f => ({ ...f, quantityUsed: e.target.value }))} placeholder="e.g. 500ml" />
            </div>
            <div>
              <Label>Batch Number</Label>
              <Input value={trForm.batchNumber ?? ""} onChange={e => setTrForm(f => ({ ...f, batchNumber: e.target.value }))} />
            </div>
            <div>
              <Label>Active Ingredient</Label>
              <Input value={trForm.activeIngredient ?? ""} onChange={e => setTrForm(f => ({ ...f, activeIngredient: e.target.value }))} />
            </div>
            <div>
              <Label>Technician Name</Label>
              <Input value={trForm.technicianName ?? ""} onChange={e => setTrForm(f => ({ ...f, technicianName: e.target.value }))} />
            </div>
            <div>
              <Label>Linked Job</Label>
              <Select value={trForm.jobId ?? "_none"} onValueChange={v => setTrForm(f => ({ ...f, jobId: v === "_none" ? undefined : v }))}>
                <SelectTrigger><SelectValue placeholder="Select job (optional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— None —</SelectItem>
                  {clientJobs.slice(0, 50).map(j => (
                    <SelectItem key={j.id} value={j.id}>{j.jobNumber ? `${j.jobNumber} — ` : ""}{j.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Treatment Notes</Label>
              <Textarea rows={2} value={trForm.treatmentNotes ?? ""} onChange={e => setTrForm(f => ({ ...f, treatmentNotes: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <Label>Recommendations</Label>
              <Textarea rows={2} value={trForm.recommendations ?? ""} onChange={e => setTrForm(f => ({ ...f, recommendations: e.target.value }))} />
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Switch checked={!!trForm.followUpRequired} onCheckedChange={v => setTrForm(f => ({ ...f, followUpRequired: v }))} />
              <Label className="font-normal">Follow-up Required</Label>
            </div>
            {trForm.followUpRequired && (
              <div>
                <Label>Follow-up Date</Label>
                <Input type="date" value={trForm.followUpDate ?? ""} onChange={e => setTrForm(f => ({ ...f, followUpDate: e.target.value }))} />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTrOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createTr.mutate(trForm)}
              disabled={createTr.isPending || !trForm.reportDate}
            >
              {createTr.isPending ? "Saving…" : "Save Report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── New Communication Note Dialog ────────────────────────────────── */}
      <Dialog open={cnOpen} onOpenChange={o => { setCnOpen(o); if (!o) setCnForm({ type: "Phone", noteDate: format(new Date(), "yyyy-MM-dd") }); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Communication Note</DialogTitle>
            <DialogDescription>Log a communication with {client.name}</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 py-1">
            <div>
              <Label>Date *</Label>
              <Input type="date" value={cnForm.noteDate ?? ""} onChange={e => setCnForm(f => ({ ...f, noteDate: e.target.value }))} />
            </div>
            <div>
              <Label>Time</Label>
              <Input type="time" value={cnForm.noteTime ?? ""} onChange={e => setCnForm(f => ({ ...f, noteTime: e.target.value }))} />
            </div>
            <div>
              <Label>Type *</Label>
              <Select value={cnForm.type ?? "Phone"} onValueChange={v => setCnForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {NOTE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Contact Person</Label>
              <Input value={cnForm.contactPerson ?? ""} onChange={e => setCnForm(f => ({ ...f, contactPerson: e.target.value }))} placeholder={client.contactPerson ?? ""} />
            </div>
            <div className="col-span-2">
              <Label>Notes *</Label>
              <Textarea rows={3} value={cnForm.notes ?? ""} onChange={e => setCnForm(f => ({ ...f, notes: e.target.value }))} placeholder="What was discussed…" />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Switch checked={!!cnForm.confirmationReceived} onCheckedChange={v => setCnForm(f => ({ ...f, confirmationReceived: v }))} />
              <Label className="font-normal">Confirmation Received</Label>
            </div>
            <div>
              <Label>Linked Job</Label>
              <Select value={cnForm.jobId ?? "_none"} onValueChange={v => setCnForm(f => ({ ...f, jobId: v === "_none" ? undefined : v }))}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— None —</SelectItem>
                  {clientJobs.slice(0, 50).map(j => (
                    <SelectItem key={j.id} value={j.id}>{j.jobNumber ? `${j.jobNumber} — ` : ""}{j.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCnOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createCn.mutate(cnForm)}
              disabled={createCn.isPending || !cnForm.noteDate || !cnForm.type || !cnForm.notes}
            >
              {createCn.isPending ? "Saving…" : "Save Note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground shrink-0 w-36">{label}:</span>
      <span className="font-medium break-all">{value}</span>
    </div>
  );
}

function JobGroup({ title, jobs, getDeptName }: { title: string; jobs: Job[]; getDeptName: (id: string) => string }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{title} ({jobs.length})</h3>
      <div className="space-y-2">
        {jobs.map(job => (
          <Card key={job.id} className="hover:shadow-sm transition-shadow">
            <CardContent className="pt-3 pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {job.jobNumber && <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{job.jobNumber}</span>}
                    <span className="font-medium text-sm truncate">{job.title}</span>
                    <Badge className={`text-xs ${jobStatusColor(job.status)}`}>{job.status.replace("_", " ")}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(job.scheduledDate), "dd MMM yyyy")}</span>
                    {job.scheduledTime && <span>{job.scheduledTime}</span>}
                    <span>{getDeptName(job.departmentId)}</span>
                    <span>{job.serviceType}</span>
                    {job.priority && <span>Priority: {job.priority}</span>}
                  </div>
                  {job.location && <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{job.location}</p>}
                </div>
                <Link href="/jobs">
                  <Button variant="ghost" size="sm" className="text-xs shrink-0"><ExternalLink className="h-3 w-3" /></Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
