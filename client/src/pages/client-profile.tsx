import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription,
  DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  ArrowLeft, Building, Phone, Mail, MapPin, Edit, User, FileText,
  Briefcase, CreditCard, Calendar, ExternalLink, ClipboardList, Receipt,
  MessageSquare, FlaskConical, Package, FolderOpen, Plus, Trash2,
  ChevronDown, ChevronRight, Printer, Wrench,
} from "lucide-react";
import { ClientForm } from "@/components/forms/client-form";
import ContractForm from "@/components/forms/contract-form";
import UnifiedContractForm from "@/components/forms/unified-contract-form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  formatClientAddress, hasStructuredAddress,
  type Client, type Job, type Invoice, type Department,
} from "@shared/schema";

// ── Local types ────────────────────────────────────────────────────────────

type ExtendedClient = Client & {
  tradingName?: string;
  alternateEmailAddress?: string;
  alternatePhoneNumber?: string;
  billingName?: string;
  billingEmail?: string;
  billingPhone?: string;
  companyRegistrationNumber?: string;
  streetNumber?: string;
  streetName?: string;
  suburb?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  googleMapsLink?: string;
};

type Worker = {
  id: string; name: string; email?: string;
  role?: string; departmentId?: string; teamId?: string;
};

type ServiceContract = {
  id: string; clientId: string; customerName: string; contractNumber?: string;
  serviceType: string; departmentId: string; frequency: string;
  assignedTeamId?: string; assignedTeamName?: string;
  assignedTechnicianId?: string; assignedTechnicianName?: string;
  startTime?: string; estimatedDuration?: number;
  startDate?: string | Date; endDate?: string | Date;
  increaseDate?: string; increasePercentage?: string;
  activeStatus: boolean; contractPrice?: string;
  notes?: string; dayOfWeek?: string; weekOfMonth?: number;
  address?: string; googleMapsLink?: string;
};

type QuoteSubmission = {
  id: string; clientId?: string; companyName: string; contactPerson?: string;
  status: string; stage?: string; serviceType?: string;
  quoteAmount?: string; quoteNumber?: string;
  submittedAt?: string; assignedTo?: string; notes?: string;
};

type TreatmentReport = {
  id: string; clientId: string; jobId?: string; contractId?: string;
  technicianId?: string; technicianName?: string; reportDate: string;
  reportNumber?: string; serviceType?: string; pestType?: string;
  treatmentType?: string; siteArea?: string; chemicalsUsed?: string;
  quantityUsed?: string; batchNumber?: string; activeIngredient?: string;
  treatmentNotes?: string; recommendations?: string;
  followUpRequired?: boolean; followUpDate?: string;
  customerName?: string; status?: string; createdAt?: string;
};

type CommunicationNote = {
  id: string; clientId: string; jobId?: string; contractId?: string;
  noteDate: string; noteTime?: string; type: string;
  contactPerson?: string; notes: string;
  confirmationReceived?: boolean; createdBy?: string; createdAt?: string;
};

type JobInventoryItem = {
  id: string; jobId: string; inventoryItemId: string;
  quantity: number; unitPrice?: string; notes?: string;
  isRental?: boolean; createdAt?: string;
};

type InventoryItem = {
  id: string; name: string; type?: string; unitPrice?: string; description?: string;
};

// ── Constants ──────────────────────────────────────────────────────────────

const NOTE_TYPES = ["WhatsApp", "Phone", "Email", "In Person", "Other"] as const;

const DOC_CATEGORIES = [
  { label: "ISO Pest Control File",   icon: "🏷️", desc: "ISO compliance documentation" },
  { label: "Treatment Reports",       icon: "📋", desc: "Pest control & fumigation reports" },
  { label: "Installation Checklists", icon: "✅", desc: "Equipment and device installation records" },
  { label: "Survey Sheets",           icon: "📐", desc: "Site survey and assessment forms" },
  { label: "Pictures",                icon: "📷", desc: "Before and after service photos" },
  { label: "PODs",                    icon: "📦", desc: "Signed proof of delivery" },
  { label: "Signed Worksheets",       icon: "✍️",  desc: "Client-signed service worksheets" },
  { label: "Other Documents",         icon: "📎", desc: "General correspondence and files" },
];

// ── Colour helpers ─────────────────────────────────────────────────────────

const statusColor = (s: string) =>
  s === "active" ? "bg-green-100 text-green-800"
  : s === "inactive" ? "bg-gray-100 text-gray-700"
  : s === "suspended" ? "bg-red-100 text-red-800"
  : "bg-gray-100 text-gray-700";

const jobStatusColor = (s: string) =>
  s === "completed"   ? "bg-green-100 text-green-800"
  : s === "in_progress" ? "bg-blue-100 text-blue-800"
  : s === "scheduled"   ? "bg-purple-100 text-purple-800"
  : s === "cancelled"   ? "bg-red-100 text-red-800"
  : "bg-gray-100 text-gray-700";

const invStatusColor = (s: string) =>
  s === "paid"      ? "bg-green-100 text-green-800"
  : s === "sent"    ? "bg-blue-100 text-blue-800"
  : s === "overdue" ? "bg-red-100 text-red-800"
  : s === "cancelled" ? "bg-gray-100 text-gray-700"
  : "bg-amber-100 text-amber-800"; // draft

const invJobStatusColor = (s?: string) =>
  !s || s === "not_invoiced"    ? "bg-gray-100 text-gray-500"
  : s === "ready_to_invoice"    ? "bg-amber-100 text-amber-700"
  : s === "invoiced"            ? "bg-green-100 text-green-700"
  : s === "exported"            ? "bg-blue-100 text-blue-700"
  : s === "do_not_invoice"      ? "bg-red-100 text-red-700"
  : "bg-gray-100 text-gray-500";

const invJobStatusLabel = (s?: string) =>
  !s || s === "not_invoiced"     ? "Not Invoiced"
  : s === "ready_to_invoice"     ? "Ready to Invoice"
  : s === "invoiced"             ? "Invoiced"
  : s === "exported"             ? "Exported"
  : s === "do_not_invoice"       ? "Do Not Invoice"
  : s;

// ── Main Page ──────────────────────────────────────────────────────────────

export default function ClientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState("details");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [trOpen, setTrOpen]         = useState(false);
  const [cnOpen, setCnOpen]         = useState(false);
  const [expandedTr, setExpandedTr] = useState<string | null>(null);
  const [expandedCn, setExpandedCn] = useState<string | null>(null);
  const [contractFilter, setContractFilter]   = useState<"all"|"unified"|"service"|"rental"|"active"|"inactive">("all");
  const [showUnifiedForm, setShowUnifiedForm]       = useState(false);
  const [editingUnified, setEditingUnified]         = useState<any | null>(null);
  const [isRentalFormOpen, setIsRentalFormOpen]     = useState(false);
  const [editingRental, setEditingRental]           = useState<any | null>(null);

  const [trForm, setTrForm] = useState<Partial<TreatmentReport>>({});
  const [cnForm, setCnForm] = useState<Partial<CommunicationNote>>({
    type: "Phone", noteDate: format(new Date(), "yyyy-MM-dd"),
  });

  // ── Data queries ────────────────────────────────────────────────────────

  const { data: client, isLoading } = useQuery<ExtendedClient>({
    queryKey: ["/api/clients", id],
    queryFn: () => fetch(`/api/clients/${id}`).then(r => { if (!r.ok) throw new Error("Not found"); return r.json(); }),
    enabled: !!id,
  });

  const { data: allJobs = [] }        = useQuery<Job[]>({ queryKey: ["/api/jobs"] });
  const { data: allInvoices = [] }    = useQuery<Invoice[]>({ queryKey: ["/api/invoices"] });
  const { data: allContracts = [] }   = useQuery<ServiceContract[]>({ queryKey: ["/api/service-contracts"] });
  const { data: allRentalContracts = [] } = useQuery<any[]>({ queryKey: ["/api/contracts"] });
  const { data: clientUnifiedContracts = [] } = useQuery<any[]>({
    queryKey: ["/api/unified-contracts", { clientId: id }],
    queryFn: () => fetch(`/api/unified-contracts?clientId=${id}`).then(r => r.json()),
    enabled: !!id,
  });
  const { data: allQuotes = [] }      = useQuery<QuoteSubmission[]>({ queryKey: ["/api/quote-submissions"] });
  const { data: departments = [] }    = useQuery<Department[]>({ queryKey: ["/api/departments"] });
  const { data: allWorkers = [] }     = useQuery<Worker[]>({ queryKey: ["/api/workers"] });
  const { data: allClients = [] }     = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: allInventory = [] }   = useQuery<InventoryItem[]>({ queryKey: ["/api/inventory"] });
  const { data: clientStockUsageRaw = [] } = useQuery<JobInventoryItem[]>({
    queryKey: ["/api/job-inventory/by-client", id],
    queryFn: () => fetch(`/api/job-inventory/by-client/${id}`).then(r => r.json()),
    enabled: !!id,
  });

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

  // ── Derived lists ───────────────────────────────────────────────────────

  const clientJobs          = allJobs.filter(j => j.clientId === id);
  const clientInvoices      = allInvoices.filter(i => i.clientId === id);
  const clientContracts     = allContracts.filter(c => c.clientId === id);
  const clientRentalContracts = allRentalContracts.filter((c: any) => c.clientId === id);
  const clientQuotes    = allQuotes.filter(q =>
    q.clientId === id ||
    (client && q.companyName?.toLowerCase() === client.name?.toLowerCase())
  );

  const clientStockUsage = clientStockUsageRaw;

  // Job groups
  const inProgressJobs = clientJobs.filter(j => j.status === "in_progress");
  const upcomingJobs   = clientJobs.filter(j => j.status === "scheduled" && new Date(j.scheduledDate) >= new Date());
  const completedJobs  = clientJobs.filter(j => j.status === "completed");
  const otherJobs      = clientJobs.filter(j => !["in_progress","scheduled","completed"].includes(j.status));

  // Stats
  const activeContractCount = clientUnifiedContracts.filter((c: any) => c.activeStatus).length
    + clientContracts.filter(c => c.activeStatus).length
    + clientRentalContracts.filter((c: any) => c.isActive ?? c.activeStatus).length;
  const openInvoiceCount    = clientInvoices.filter(i => i.status !== "paid" && i.status !== "cancelled").length;

  // Lookup helpers
  const getDeptName   = (dId?: string) => departments.find(d => d.id === dId)?.name ?? "—";
  const getWorkerName = (wId?: string) => wId ? (allWorkers.find(w => w.id === wId)?.name ?? wId) : undefined;
  const getJobNum     = (jId?: string) => jId ? (allJobs.find(j => j.id === jId)?.jobNumber ?? jId) : undefined;
  const getJobTitle   = (jId?: string) => jId ? (allJobs.find(j => j.id === jId)?.title ?? jId) : undefined;
  const getJobDate    = (jId: string)  => { const j = allJobs.find(x => x.id === jId); return j ? j.scheduledDate : undefined; };
  const getJobWorker  = (jId: string)  => { const j = allJobs.find(x => x.id === jId); return j?.workerId ? getWorkerName(j.workerId) : undefined; };
  const getItemName   = (iId: string)  => allInventory.find(i => i.id === iId)?.name ?? iId;


  // ── Mutations ───────────────────────────────────────────────────────────

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
    mutationFn: async (data: any) =>
      (await apiRequest("POST", "/api/treatment-reports", { ...data, clientId: id })).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/treatment-reports", id] });
      setTrOpen(false); setTrForm({});
      toast({ description: "Treatment report saved" });
    },
    onError: (e: any) => toast({ description: e?.message ?? "Save failed", variant: "destructive" }),
  });

  const deleteTr = useMutation({
    mutationFn: (rid: string) => apiRequest("DELETE", `/api/treatment-reports/${rid}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/treatment-reports", id] }); toast({ description: "Report deleted" }); },
  });

  const createCn = useMutation({
    mutationFn: async (data: any) =>
      (await apiRequest("POST", "/api/communication-notes", { ...data, clientId: id })).json(),
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

  // ── Loading / not found ────────────────────────────────────────────────

  if (isLoading) {
    return (
      <>
        <div className="p-6 pb-20 lg:pb-6">
          <div className="max-w-6xl mx-auto space-y-5">

            {/* Back */}
            <Link href="/clients">
              <Button variant="ghost" size="sm"><ArrowLeft className="mr-1 h-4 w-4" />Clients</Button>
            </Link>

            {/* Header card */}
            <Card>
              <CardContent className="pt-5">
                <div className="flex flex-col sm:flex-row gap-4 justify-between">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h1 className="text-2xl font-bold truncate">{client.name}</h1>
                      {client.tradingName && (
                        <span className="text-muted-foreground text-sm">T/A {client.tradingName}</span>
                      )}
                      <Badge className={statusColor(client.status)}>{client.status}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                      {client.businessType && (
                        <span className="flex items-center gap-1"><Building className="h-3.5 w-3.5" />{client.businessType}</span>
                      )}
                      {client.phone && (
                        <a href={`tel:${client.phone}`} className="flex items-center gap-1 hover:text-gray-900">
                          <Phone className="h-3.5 w-3.5" />{client.phone}
                        </a>
                      )}
                      {client.email && (
                        <a href={`mailto:${client.email}`} className="flex items-center gap-1 hover:text-gray-900">
                          <Mail className="h-3.5 w-3.5" />{client.email}
                        </a>
                      )}
                      {(client.suburb || client.city) && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {[client.suburb, client.city].filter(Boolean).join(", ")}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-0.5">
                      <span>{getDeptName(client.departmentId)}</span>
                      {client.contactPerson && <span>· {client.contactPerson}</span>}
                    </div>
                  </div>
                  <Button onClick={() => setIsEditOpen(true)} size="sm" className="shrink-0">
                    <Edit className="mr-2 h-4 w-4" />Edit Client
                  </Button>
                </div>

                {/* ── Clickable Quick-Stats ── */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4 pt-4 border-t">
                  {[
                    { label: "Jobs",             value: clientJobs.length,       tab: "jobs",             color: "text-blue-600" },
                    { label: "Active Contracts",  value: activeContractCount,     tab: "contracts",        color: "text-green-600" },
                    { label: "Open Invoices",     value: openInvoiceCount,        tab: "invoices",         color: "text-orange-600" },
                    { label: "Treatment Reports", value: treatmentRpts.length,    tab: "treatment-reports", color: "text-teal-600" },
                    { label: "Comm. Notes",       value: commNotes.length,        tab: "comm-notes",       color: "text-purple-600" },
                  ].map(stat => (
                    <button
                      key={stat.tab}
                      onClick={() => setActiveTab(stat.tab)}
                      className="text-center rounded-lg p-2 hover:bg-gray-100 transition-colors cursor-pointer group"
                    >
                      <div className={`text-2xl font-bold ${stat.color} group-hover:underline`}>{stat.value}</div>
                      <div className="text-xs text-muted-foreground">{stat.label}</div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* ── Tabs ───────────────────────────────────────────────── */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="flex flex-wrap h-auto gap-1">
                <TabsTrigger value="details">
                  <User className="mr-1 h-3.5 w-3.5" />Details
                </TabsTrigger>
                <TabsTrigger value="jobs">
                  <Briefcase className="mr-1 h-3.5 w-3.5" />Jobs
                  {clientJobs.length > 0 && <CountBadge n={clientJobs.length} />}
                </TabsTrigger>
                <TabsTrigger value="contracts">
                  <ClipboardList className="mr-1 h-3.5 w-3.5" />Contracts
                  {clientContracts.length > 0 && <CountBadge n={clientContracts.length} />}
                </TabsTrigger>
                <TabsTrigger value="invoices">
                  <Receipt className="mr-1 h-3.5 w-3.5" />Invoices
                  {clientInvoices.length > 0 && <CountBadge n={clientInvoices.length} />}
                </TabsTrigger>
                <TabsTrigger value="treatment-reports">
                  <FlaskConical className="mr-1 h-3.5 w-3.5" />Treatment Reports
                  {treatmentRpts.length > 0 && <CountBadge n={treatmentRpts.length} />}
                </TabsTrigger>
                <TabsTrigger value="comm-notes">
                  <MessageSquare className="mr-1 h-3.5 w-3.5" />Comm. Notes
                  {commNotes.length > 0 && <CountBadge n={commNotes.length} />}
                </TabsTrigger>
                <TabsTrigger value="stock-usage">
                  <Package className="mr-1 h-3.5 w-3.5" />Stock Usage
                  {clientStockUsage.length > 0 && <CountBadge n={clientStockUsage.length} />}
                </TabsTrigger>
                <TabsTrigger value="documents">
                  <FolderOpen className="mr-1 h-3.5 w-3.5" />Documents
                </TabsTrigger>
                <TabsTrigger value="quotes">
                  <FileText className="mr-1 h-3.5 w-3.5" />Quotes
                  {clientQuotes.length > 0 && <CountBadge n={clientQuotes.length} />}
                </TabsTrigger>
              </TabsList>

              {/* ═══════════════════ DETAILS ════════════════════════════ */}
              <TabsContent value="details" className="space-y-4 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Building className="h-4 w-4" />Business Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-1.5">
                      <Row label="Business Name"  value={client.name} />
                      <Row label="Trading Name"   value={client.tradingName} />
                      <Row label="Business Type"  value={client.businessType} />
                      <Row label="Department"     value={getDeptName(client.departmentId)} />
                      <Row label="Status"         value={<Badge className={statusColor(client.status)}>{client.status}</Badge>} />
                      <Row label="Created"        value={format(new Date(client.createdAt), "dd MMM yyyy")} />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <User className="h-4 w-4" />Contact Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-1.5">
                      <Row label="Contact Person"    value={client.contactPerson} />
                      <Row label="Phone"             value={client.phone} />
                      <Row label="Alternate Phone"   value={client.alternatePhoneNumber} />
                      <Row label="Email"             value={client.email} />
                      <Row label="Alternate Email"   value={client.alternateEmailAddress} />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <MapPin className="h-4 w-4" />Physical Address
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-1.5">
                      {hasStructuredAddress(client) ? (
        <>
                          {(client.streetNumber || client.streetName) && (
                            <Row label="Street" value={[client.streetNumber, client.streetName].filter(Boolean).join(" ")} />
                          )}
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
                          className="inline-flex items-center gap-1 text-green-700 hover:text-green-800 text-xs underline mt-1">
                          <ExternalLink className="h-3 w-3" />Open in Google Maps
                        </a>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />Billing & Financial
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-1.5">
                      {(client.billingName || client.billingEmail || client.billingPhone) && (
                        <>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Billing Contact</p>
                          <Row label="Name"  value={client.billingName} />
                          <Row label="Email" value={client.billingEmail} />
                          <Row label="Phone" value={client.billingPhone} />
                          <div className="border-t pt-2 mt-2" />
                        </>
                      )}
                      <Row label="VAT Number"    value={client.taxNumber} />
                      <Row label="Company Reg."  value={client.companyRegistrationNumber} />
                      <Row label="Payment Terms" value={client.paymentTerms} />
                      <Row label="Credit Limit"  value={client.creditLimit ? `R${Number(client.creditLimit).toFixed(2)}` : undefined} />
                    </CardContent>
                  </Card>
                </div>

                {client.notes && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold">Internal Notes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground whitespace-pre-line">{client.notes}</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* ═══════════════════ JOBS ═══════════════════════════════ */}
              <TabsContent value="jobs" className="space-y-4 mt-4">
                {clientJobs.length === 0 ? (
                  <Card><CardContent className="py-8 text-center text-muted-foreground">No jobs for this client.</CardContent></Card>
                ) : (
                  <>
                    <JobGroup title="In Progress"           jobs={inProgressJobs} getDeptName={getDeptName} getWorkerName={getWorkerName} />
                    <JobGroup title="Upcoming / Scheduled"  jobs={upcomingJobs}   getDeptName={getDeptName} getWorkerName={getWorkerName} />
                    <JobGroup title="Completed"             jobs={completedJobs}  getDeptName={getDeptName} getWorkerName={getWorkerName} />
                    <JobGroup title="Cancelled / Other"     jobs={otherJobs}      getDeptName={getDeptName} getWorkerName={getWorkerName} />
                  </>
                )}
              </TabsContent>

              {/* ═══════════════════ CONTRACTS ══════════════════════════ */}
              <TabsContent value="contracts" className="mt-4">
                {/* ── Header ── */}
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm text-muted-foreground">
                    {clientUnifiedContracts.length + clientContracts.length + clientRentalContracts.length} contract{(clientUnifiedContracts.length + clientContracts.length + clientRentalContracts.length) !== 1 ? "s" : ""}
                    {activeContractCount > 0 && ` · ${activeContractCount} active`}
                  </span>
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => { setEditingUnified(null); setShowUnifiedForm(true); }}>
                    <Plus className="h-3.5 w-3.5" />New Contract
                  </Button>
                </div>

                {/* ── Filter chips ── */}
                {(clientUnifiedContracts.length + clientContracts.length + clientRentalContracts.length) > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {(["all","unified","service","rental","active","inactive"] as const).map(f => {
                      const total = clientUnifiedContracts.length + clientContracts.length + clientRentalContracts.length;
                      const label = f === "all"     ? `All (${total})`
                        : f === "unified" ? `Contracts (${clientUnifiedContracts.length})`
                        : f === "service" ? `Legacy Service (${clientContracts.length})`
                        : f === "rental"  ? `Legacy Rental (${clientRentalContracts.length})`
                        : f === "active"  ? `Active (${activeContractCount})`
                        : `Inactive (${total - activeContractCount})`;
                      return (
                        <button
                          key={f}
                          onClick={() => setContractFilter(f)}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                            contractFilter === f
                              ? "bg-blue-600 text-white"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* ── Unified Contracts ── */}
                {(contractFilter === "all" || contractFilter === "unified" || contractFilter === "active" || contractFilter === "inactive") && clientUnifiedContracts.filter(c => {
                  if (contractFilter === "active") return !!c.activeStatus;
                  if (contractFilter === "inactive") return !c.activeStatus;
                  return true;
                }).length > 0 && (
                  <div className="space-y-2 mb-3">
                    {clientUnifiedContracts.filter(c => {
                      if (contractFilter === "active") return !!c.activeStatus;
                      if (contractFilter === "inactive") return !c.activeStatus;
                      return true;
                    }).map((c: any) => {
                      const schedule = [
                        c.frequency, c.dayOfWeek,
                        c.weekOfMonth ? `Week ${c.weekOfMonth}` : undefined,
                        c.startTime ? `@ ${c.startTime}` : undefined,
                      ].filter(Boolean).join(" · ");
                      return (
                        <Card key={c.id} className="border-green-100">
                          <CardContent className="pt-3 pb-3">
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                              <div className="flex-1 min-w-0 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {c.contractNumber && (
                                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-green-50 text-green-700 border border-green-100">
                                      {c.contractNumber}
                                    </span>
                                  )}
                                  <Badge className="bg-green-100 text-green-800 text-xs">Contract</Badge>
                                  {c.department && <Badge className="bg-gray-100 text-gray-700 text-xs">{c.department}</Badge>}
                                  <Badge className={c.activeStatus ? "bg-green-100 text-green-800 text-xs" : "bg-gray-100 text-gray-600 text-xs"}>
                                    {c.activeStatus ? "Active" : "Inactive"}
                                  </Badge>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-0.5 text-xs text-muted-foreground mt-1">
                                  {schedule && <InfoPair label="Schedule" value={schedule} className="col-span-2" />}
                                  {(c.assignedTeamName || c.assignedTechnicianName) && (
                                    <InfoPair label="Assigned" value={c.assignedTeamName || c.assignedTechnicianName} className="col-span-2" />
                                  )}
                                  {c.contractStartDate && <InfoPair label="Start" value={c.contractStartDate} />}
                                  {c.contractEndDate && <InfoPair label="End" value={c.contractEndDate} />}
                                  {c.nextIncreaseDate && <InfoPair label="Next Increase" value={c.nextIncreaseDate} />}
                                </div>
                                {c.notes && <p className="text-xs text-muted-foreground border-t pt-1 mt-1">{c.notes}</p>}
                                {/* ── Contract Includes ── */}
                                {Array.isArray(c.lineItems) && c.lineItems.length > 0 && (
                                  <div className="border-t border-gray-100 pt-2 mt-1.5">
                                    <p className="text-xs font-medium text-gray-500 mb-1">Contract Includes:</p>
                                    <div className="space-y-1">
                                      {c.lineItems.map((li: any) => {
                                        const refillLabel = (() => {
                                          const a = li.consumableArrangement;
                                          if (!a || a === "Not Applicable") return null;
                                          const m: Record<string, string> = {
                                            "Consumables Included":             "Consumables included",
                                            "Consumables Charged Separately":   "Billed separately",
                                            "Client Supplies Own Consumables":  "Client supplies",
                                            "On Demand Consumables":            "On demand",
                                            "Consumable Only":                  "Consumable only",
                                          };
                                          return m[a] ?? a;
                                        })();
                                        const stdPrice   = li.standardSellingPrice ? Number(li.standardSellingPrice) : null;
                                        const discPct    = li.discountPercentage ? Number(li.discountPercentage) : 0;
                                        const finalPrice = li.finalUnitPrice ? Number(li.finalUnitPrice) : (li.unitPrice ? Number(li.unitPrice) : null);
                                        const qty        = Number(li.quantity) || 1;
                                        const lineTotal  = finalPrice ? (qty * finalPrice) : null;
                                        return (
                                          <div key={li.id} className="flex items-start gap-1.5 text-xs">
                                            <span className="text-gray-300 mt-0.5">•</span>
                                            <div className="flex-1">
                                              <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                                                <span className="text-gray-800 font-medium">{li.itemServiceName}</span>
                                                <span className="text-gray-500">× {qty}</span>
                                                <span className={`px-1 py-0.5 rounded text-xs font-medium ${
                                                  li.stockItemId ? "bg-blue-50 text-blue-600" : "bg-gray-50 text-gray-500"
                                                }`}>
                                                  {li.stockItemId ? "Inventory" : "Service"}
                                                </span>
                                                {refillLabel && (
                                                  <span className="px-1 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-600">
                                                    {refillLabel}
                                                  </span>
                                                )}
                                                {li.manualPriceOverride && (
                                                  <span className="px-1 py-0.5 rounded text-xs font-medium bg-orange-50 text-orange-600">
                                                    Manual price
                                                  </span>
                                                )}
                                              </div>
                                              {/* Pricing breakdown */}
                                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-gray-500">
                                                {stdPrice !== null && (
                                                  <span>Std: R{stdPrice.toFixed(2)}</span>
                                                )}
                                                {discPct > 0 && (
                                                  <span className="text-green-600">{discPct}% off</span>
                                                )}
                                                {finalPrice !== null && (
                                                  <span className="font-medium text-gray-700">Final: R{finalPrice.toFixed(2)}</span>
                                                )}
                                                {lineTotal !== null && (
                                                  <span className="font-semibold text-gray-800">Total: R{lineTotal.toFixed(2)}</span>
                                                )}
                                                {li.consumableItemName && li.consumableArrangement !== "Client Supplies Own Consumables" && (
                                                  <span className="italic text-gray-400">↳ {li.consumableItemName}</span>
                                                )}
                                                {li.separateConsumablePrice && Number(li.separateConsumablePrice) > 0 && (
                                                  <span>Consumable: R{Number(li.separateConsumablePrice).toFixed(2)}</span>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div className="flex gap-1.5 shrink-0">
                                <Button variant="outline" size="sm" className="text-xs"
                                  onClick={() => { setEditingUnified(c); setShowUnifiedForm(true); }}>
                                  <Edit className="mr-1 h-3 w-3" />Edit
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}

                {/* ── Legacy Service + Rental contracts ── */}
                {(() => {
                  const combined: Array<{ type: "service" | "rental"; data: any }> = [
                    ...clientContracts.map(c => ({ type: "service" as const, data: c })),
                    ...clientRentalContracts.map(c => ({ type: "rental" as const, data: c })),
                  ].filter(({ type, data }) => {
                    if (contractFilter === "unified") return false;
                    if (contractFilter === "service") return type === "service";
                    if (contractFilter === "rental")  return type === "rental";
                    const active = type === "service" ? data.activeStatus : (data.isActive ?? data.activeStatus);
                    if (contractFilter === "active")   return !!active;
                    if (contractFilter === "inactive") return !active;
                    return true;
                  });

                  if (combined.length === 0 && clientUnifiedContracts.length === 0 && contractFilter === "all") {
                    return (
                      <Card>
                        <CardContent className="py-8 text-center text-muted-foreground">
                          No contracts for this client yet.
                        </CardContent>
                      </Card>
                    );
                  }
                  if (combined.length === 0) return null;

                  return (
                    <div className="space-y-2">
                      {combined.map(({ type, data: c }) => {
                        const isService = type === "service";
                        const active = isService ? c.activeStatus : (c.isActive ?? c.activeStatus);
                        const schedule = [
                          c.frequency, c.dayOfWeek,
                          c.weekOfMonth ? `Week ${c.weekOfMonth}` : undefined,
                          c.startTime ? `@ ${c.startTime}` : undefined,
                        ].filter(Boolean).join(" · ");
                        const price = isService
                          ? (c.contractPrice ? `R${Number(c.contractPrice).toFixed(2)}` : null)
                          : (c.calculatedTotal ? `R${Number(c.calculatedTotal).toFixed(2)}` : c.monthlyPrice ? `R${Number(c.monthlyPrice).toFixed(2)}/mo` : null);

                        return (
                          <Card key={c.id} className={isService ? "" : "border-purple-100"}>
                            <CardContent className="pt-3 pb-3">
                              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                                <div className="flex-1 min-w-0 space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {c.contractNumber && (
                                      <span className={`font-mono text-xs px-2 py-0.5 rounded ${isService ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"}`}>
                                        {c.contractNumber}
                                      </span>
                                    )}
                                    <Badge className={isService
                                      ? "bg-blue-100 text-blue-800 text-xs"
                                      : "bg-purple-100 text-purple-800 text-xs"
                                    }>
                                      {isService ? "Legacy Service" : "Legacy Rental"}
                                    </Badge>
                                    <Badge className={active ? "bg-green-100 text-green-800 text-xs" : "bg-gray-100 text-gray-600 text-xs"}>
                                      {active ? "Active" : "Inactive"}
                                    </Badge>
                                    {isService && c.serviceType && (
                                      <span className="text-sm font-medium text-gray-800">{c.serviceType}</span>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-0.5 text-xs text-muted-foreground mt-1">
                                    {c.departmentId && <InfoPair label="Dept" value={getDeptName(c.departmentId)} />}
                                    {schedule && <InfoPair label="Schedule" value={schedule} className="col-span-2" />}
                                    {(c.assignedTeamName || c.assignedTechnicianName) && (
                                      <InfoPair label="Assigned" value={c.assignedTeamName || c.assignedTechnicianName} className="col-span-2" />
                                    )}
                                    {price && <InfoPair label="Price" value={price} />}
                                    {c.startDate && <InfoPair label="Start" value={format(new Date(c.startDate), "dd MMM yyyy")} />}
                                    {c.endDate && <InfoPair label="End" value={format(new Date(c.endDate), "dd MMM yyyy")} />}
                                  </div>
                                  {c.notes && <p className="text-xs text-muted-foreground border-t pt-1 mt-1">{c.notes}</p>}
                                </div>
                                <div className="flex gap-1.5 shrink-0">
                                  {!isService && (
                                    <Button variant="outline" size="sm" className="text-xs"
                                      onClick={() => { setEditingRental(c); setIsRentalFormOpen(true); }}>
                                      <Edit className="mr-1 h-3 w-3" />Edit
                                    </Button>
                                  )}
                                  <Link href="/contracts">
                                    <Button variant="outline" size="sm" className="text-xs">
                                      <ExternalLink className="mr-1 h-3 w-3" />View
                                    </Button>
                                  </Link>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* ── Unified Contract Form ── */}
                <Dialog open={showUnifiedForm} onOpenChange={open => { if (!open) { setShowUnifiedForm(false); setEditingUnified(null); } }}>
                  <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>{editingUnified ? "Edit Contract" : "New Contract"}</DialogTitle>
                      <DialogDescription>
                        {editingUnified ? "Update contract details, items, and schedule." : "Create a contract with services, rental items, or both."}
                      </DialogDescription>
                    </DialogHeader>
                    <UnifiedContractForm
                      contract={editingUnified}
                      defaultClientId={id}
                      onSuccess={() => {
                        setShowUnifiedForm(false); setEditingUnified(null);
                        qc.invalidateQueries({ queryKey: ["/api/unified-contracts", { clientId: id }] });
                      }}
                      onCancel={() => { setShowUnifiedForm(false); setEditingUnified(null); }}
                    />
                  </DialogContent>
                </Dialog>

                {/* ── Legacy Rental Contract Form ── */}
                <Dialog open={isRentalFormOpen} onOpenChange={open => { setIsRentalFormOpen(open); if (!open) setEditingRental(null); }}>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>{editingRental ? "Edit Legacy Rental Contract" : "Legacy Rental Contract"}</DialogTitle>
                    </DialogHeader>
                    <ContractForm
                      contract={editingRental}
                      defaultClientId={id}
                      onSuccess={() => { setIsRentalFormOpen(false); setEditingRental(null); }}
                      onCancel={() => { setIsRentalFormOpen(false); setEditingRental(null); }}
                    />
                  </DialogContent>
                </Dialog>
              </TabsContent>

              {/* ═══════════════════ INVOICES ════════════════════════════ */}
              <TabsContent value="invoices" className="mt-4">
                {clientInvoices.length === 0 ? (
                  <Card><CardContent className="py-8 text-center text-muted-foreground">No invoices for this client.</CardContent></Card>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Invoice #</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Due</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Linked Job</th>
                          <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                          <th className="px-3 py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {clientInvoices.map(inv => (
                          <tr key={inv.id} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="px-3 py-2.5 font-mono text-xs font-semibold">{inv.invoiceNumber}</td>
                            <td className="px-3 py-2.5 text-xs">{format(new Date(inv.issueDate), "dd MMM yyyy")}</td>
                            <td className="px-3 py-2.5 text-xs">{format(new Date(inv.dueDate), "dd MMM yyyy")}</td>
                            <td className="px-3 py-2.5 text-xs text-muted-foreground hidden md:table-cell">
                              {inv.linkedJobId ? (
                                <span className="font-mono">{getJobNum(inv.linkedJobId) ?? inv.linkedJobId}</span>
                              ) : "—"}
                            </td>
                            <td className="px-3 py-2.5 text-right font-semibold">R{Number(inv.total).toFixed(2)}</td>
                            <td className="px-3 py-2.5">
                              <Badge className={`text-xs ${invStatusColor(inv.status)}`}>{inv.status}</Badge>
                            </td>
                            <td className="px-3 py-2.5">
                              <Link href="/invoices">
                                <Button variant="ghost" size="sm" className="h-7 text-xs px-2">
                                  <ExternalLink className="h-3 w-3 mr-1" />Open
                                </Button>
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50 border-t">
                        <tr>
                          <td colSpan={4} className="px-3 py-2 text-xs text-muted-foreground font-medium">
                            {clientInvoices.length} invoice{clientInvoices.length !== 1 ? "s" : ""}
                          </td>
                          <td className="px-3 py-2 text-right text-xs font-bold">
                            R{clientInvoices.reduce((s, i) => s + Number(i.total), 0).toFixed(2)}
                          </td>
                          <td colSpan={2} />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </TabsContent>

              {/* ═══════════════════ TREATMENT REPORTS ══════════════════ */}
              <TabsContent value="treatment-reports" className="mt-4">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm text-muted-foreground">
                    {treatmentRpts.length} report{treatmentRpts.length !== 1 ? "s" : ""}
                  </span>
                  <Button size="sm" className="gap-1" onClick={() => {
                    setTrForm({
                      reportDate: format(new Date(), "yyyy-MM-dd"),
                      customerName: client.name,
                    });
                    setTrOpen(true);
                  }}>
                    <Plus className="h-3.5 w-3.5" />New Treatment Report
                  </Button>
                </div>
                {treatmentRpts.length === 0 ? (
                  <Card><CardContent className="py-8 text-center text-muted-foreground">No treatment reports for this client.</CardContent></Card>
                ) : (
                  <div className="space-y-2">
                    {treatmentRpts.map(r => {
                      const open = expandedTr === r.id;
                      return (
                        <Card key={r.id} className="overflow-hidden">
                          <button className="w-full text-left" onClick={() => setExpandedTr(open ? null : r.id)}>
                            <CardContent className="pt-3 pb-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-3 flex-wrap min-w-0">
                                  {open ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                                        : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />}
                                  {r.reportNumber && (
                                    <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{r.reportNumber}</span>
                                  )}
                                  <span className="font-medium text-sm">{format(new Date(r.reportDate), "dd MMM yyyy")}</span>
                                  {r.serviceType && <Badge variant="outline" className="text-xs">{r.serviceType}</Badge>}
                                  {r.pestType && <span className="text-xs text-muted-foreground">{r.pestType}</span>}
                                  {r.technicianName && (
                                    <span className="text-xs text-muted-foreground hidden sm:inline">· {r.technicianName}</span>
                                  )}
                                  {r.followUpRequired && (
                                    <Badge className="bg-amber-100 text-amber-800 text-xs">Follow-up required</Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <Button
                                    size="sm" variant="ghost"
                                    onClick={e => { e.stopPropagation(); window.print(); }}
                                    className="h-7 w-7 p-0"
                                    title="Print"
                                  >
                                    <Printer className="h-3.5 w-3.5 text-gray-400" />
                                  </Button>
                                  <Button
                                    size="sm" variant="ghost"
                                    onClick={e => { e.stopPropagation(); if (confirm("Delete this report?")) deleteTr.mutate(r.id); }}
                                    className="h-7 w-7 p-0"
                                    title="Delete"
                                  >
                                    <Trash2 className="h-3.5 w-3.5 text-red-400" />
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </button>
                          {open && (
                            <div className="border-t bg-gray-50 px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
                              <Row label="Service Type"      value={r.serviceType} />
                              <Row label="Pest Type"         value={r.pestType} />
                              <Row label="Treatment Type"    value={r.treatmentType} />
                              <Row label="Site Area"         value={r.siteArea} />
                              <Row label="Chemicals Used"    value={r.chemicalsUsed} />
                              <Row label="Quantity Used"     value={r.quantityUsed} />
                              <Row label="Batch Number"      value={r.batchNumber} />
                              <Row label="Active Ingredient" value={r.activeIngredient} />
                              <Row label="Technician"        value={r.technicianName} />
                              {r.jobId && <Row label="Job" value={getJobNum(r.jobId) ?? r.jobId} />}
                              {r.contractId && <Row label="Contract" value={r.contractId} />}
                              <Row label="Follow-up Required" value={r.followUpRequired ? "Yes" : "No"} />
                              {r.followUpDate && <Row label="Follow-up Date" value={format(new Date(r.followUpDate), "dd MMM yyyy")} />}
                              {r.treatmentNotes && (
                                <div className="col-span-2">
                                  <span className="text-muted-foreground">Treatment Notes: </span>
                                  <span className="whitespace-pre-line">{r.treatmentNotes}</span>
                                </div>
                              )}
                              {r.recommendations && (
                                <div className="col-span-2">
                                  <span className="text-muted-foreground">Recommendations: </span>
                                  <span className="whitespace-pre-line">{r.recommendations}</span>
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

              {/* ═══════════════════ COMM. NOTES ════════════════════════ */}
              <TabsContent value="comm-notes" className="mt-4">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm text-muted-foreground">
                    {commNotes.length} note{commNotes.length !== 1 ? "s" : ""}
                  </span>
                  <Button size="sm" className="gap-1" onClick={() => {
                    setCnForm({ type: "Phone", noteDate: format(new Date(), "yyyy-MM-dd") });
                    setCnOpen(true);
                  }}>
                    <Plus className="h-3.5 w-3.5" />Add Communication Note
                  </Button>
                </div>
                {commNotes.length === 0 ? (
                  <Card><CardContent className="py-8 text-center text-muted-foreground">No communication notes yet.</CardContent></Card>
                ) : (
                  <div className="space-y-2">
                    {commNotes.map(n => {
                      const open = expandedCn === n.id;
                      return (
                        <Card key={n.id} className="overflow-hidden">
                          <button className="w-full text-left" onClick={() => setExpandedCn(open ? null : n.id)}>
                            <CardContent className="pt-3 pb-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-3 flex-wrap min-w-0">
                                  {open ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                                        : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />}
                                  <span className="font-medium text-sm">{format(new Date(n.noteDate), "dd MMM yyyy")}</span>
                                  {n.noteTime && <span className="text-xs text-muted-foreground">{n.noteTime}</span>}
                                  <Badge variant="outline" className="text-xs">{n.type}</Badge>
                                  {n.contactPerson && (
                                    <span className="text-xs text-muted-foreground hidden sm:inline">{n.contactPerson}</span>
                                  )}
                                  {n.confirmationReceived && (
                                    <Badge className="bg-green-100 text-green-800 text-xs">Confirmed</Badge>
                                  )}
                                </div>
                                <Button
                                  size="sm" variant="ghost"
                                  onClick={e => { e.stopPropagation(); if (confirm("Delete this note?")) deleteCn.mutate(n.id); }}
                                  className="h-7 w-7 p-0 shrink-0"
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-red-400" />
                                </Button>
                              </div>
                              <p className="text-sm text-gray-700 mt-1 pl-7 line-clamp-2">{n.notes}</p>
                            </CardContent>
                          </button>
                          {open && (
                            <div className="border-t bg-gray-50 px-4 py-3 space-y-1.5 text-sm">
                              <Row label="Date"         value={`${n.noteDate}${n.noteTime ? " " + n.noteTime : ""}`} />
                              <Row label="Type"         value={n.type} />
                              <Row label="Contact"      value={n.contactPerson} />
                              <Row label="Confirmed"    value={n.confirmationReceived ? "Yes" : "No"} />
                              {n.jobId && <Row label="Linked Job" value={getJobNum(n.jobId) ?? n.jobId} />}
                              {n.contractId && <Row label="Linked Contract" value={n.contractId} />}
                              {n.createdBy && <Row label="Logged by" value={n.createdBy} />}
                              <div className="pt-1">
                                <span className="text-muted-foreground">Notes: </span>
                                <span className="whitespace-pre-line">{n.notes}</span>
                              </div>
                            </div>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              {/* ═══════════════════ STOCK USAGE ════════════════════════ */}
              <TabsContent value="stock-usage" className="mt-4">
                {clientStockUsage.length === 0 ? (
                  <Card><CardContent className="py-8 text-center text-muted-foreground">No stock usage recorded for this client's jobs.</CardContent></Card>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Date</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Job</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Technician</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Stock Item</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Qty</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Unit Price</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Type</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clientStockUsage.map(item => {
                          const jobDate   = getJobDate(item.jobId);
                          const techName  = getJobWorker(item.jobId);
                          return (
                            <tr key={item.id} className="border-b last:border-0 hover:bg-gray-50">
                              <td className="px-3 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">
                                {jobDate ? format(new Date(jobDate), "dd MMM yyyy") : "—"}
                              </td>
                              <td className="px-3 py-2.5 text-xs text-muted-foreground hidden md:table-cell">
                                {getJobNum(item.jobId) ?? "—"}
                              </td>
                              <td className="px-3 py-2.5 text-xs text-muted-foreground hidden lg:table-cell">
                                {techName ?? "—"}
                              </td>
                              <td className="px-3 py-2.5 font-medium">{getItemName(item.inventoryItemId)}</td>
                              <td className="px-3 py-2.5">{item.quantity}</td>
                              <td className="px-3 py-2.5 text-xs text-muted-foreground hidden md:table-cell">
                                {item.unitPrice ? `R${Number(item.unitPrice).toFixed(2)}` : "—"}
                              </td>
                              <td className="px-3 py-2.5 hidden md:table-cell">
                                {item.isRental
                                  ? <Badge className="bg-blue-100 text-blue-800 text-xs">Rental</Badge>
                                  : <Badge variant="outline" className="text-xs">Consumable</Badge>}
                              </td>
                              <td className="px-3 py-2.5 text-xs text-muted-foreground hidden lg:table-cell">
                                {item.notes ?? "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>

              {/* ═══════════════════ DOCUMENTS ══════════════════════════ */}
              <TabsContent value="documents" className="mt-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  {DOC_CATEGORIES.map(dc => (
                    <Card key={dc.label} className="hover:shadow-sm transition-shadow cursor-default">
                      <CardContent className="pt-4 pb-4 text-center">
                        <div className="text-3xl mb-2">{dc.icon}</div>
                        <div className="text-sm font-medium text-gray-800">{dc.label}</div>
                        <div className="text-xs text-muted-foreground mt-0.5 leading-tight">{dc.desc}</div>
                        <div className="text-xs text-muted-foreground italic mt-2">0 files</div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  <strong>File uploads coming soon.</strong> Once ready, you'll be able to upload Treatment Reports, Signed Worksheets, Photos, PODs and other documents directly to each client profile. Treatment reports can already be saved in the <button className="underline font-medium" onClick={() => setActiveTab("treatment-reports")}>Treatment Reports</button> tab.
                </div>
              </TabsContent>

              {/* ═══════════════════ QUOTES ══════════════════════════════ */}
              <TabsContent value="quotes" className="mt-4">
                {clientQuotes.length === 0 ? (
                  <Card><CardContent className="py-8 text-center text-muted-foreground">No quotes linked to this client.</CardContent></Card>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Quote #</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Date</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Sales Rep</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Service</th>
                          <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                          <th className="px-3 py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {clientQuotes.map(q => (
                          <tr key={q.id} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="px-3 py-2.5 font-mono text-xs font-semibold">{q.quoteNumber ?? "—"}</td>
                            <td className="px-3 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">
                              {q.submittedAt ? format(new Date(q.submittedAt), "dd MMM yyyy") : "—"}
                            </td>
                            <td className="px-3 py-2.5 text-xs text-muted-foreground hidden md:table-cell">
                              {q.assignedTo ? (getWorkerName(q.assignedTo) ?? q.assignedTo) : "—"}
                            </td>
                            <td className="px-3 py-2.5 text-xs hidden md:table-cell">{q.serviceType ?? "—"}</td>
                            <td className="px-3 py-2.5 text-right font-semibold">
                              {q.quoteAmount ? `R${Number(q.quoteAmount).toFixed(2)}` : "—"}
                            </td>
                            <td className="px-3 py-2.5">
                              <Badge variant="outline" className="text-xs">{q.status}</Badge>
                              {q.stage && (
                                <span className="ml-1 text-xs text-muted-foreground hidden sm:inline">
                                  {q.stage.replace(/_/g, " ")}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2.5">
                              <Link href="/leads">
                                <Button variant="ghost" size="sm" className="h-7 text-xs px-2">
                                  <ExternalLink className="h-3 w-3 mr-1" />Open
                                </Button>
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>

      {/* ═══ Edit Client Dialog ══════════════════════════════════════════ */}
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

      {/* ═══ New Treatment Report Dialog ════════════════════════════════ */}
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
              <Select value={trForm.technicianId ?? "_none"} onValueChange={v => {
                const w = allWorkers.find(w => w.id === v);
                setTrForm(f => ({ ...f, technicianId: v === "_none" ? undefined : v, technicianName: w?.name }));
              }}>
                <SelectTrigger><SelectValue placeholder="Select technician" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— None —</SelectItem>
                  {allWorkers.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Linked Job</Label>
              <Select value={trForm.jobId ?? "_none"} onValueChange={v => setTrForm(f => ({ ...f, jobId: v === "_none" ? undefined : v }))}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— None —</SelectItem>
                  {clientJobs.slice(0, 50).map(j => (
                    <SelectItem key={j.id} value={j.id}>
                      {j.jobNumber ? `${j.jobNumber} — ` : ""}{j.title}
                    </SelectItem>
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
              <Label className="font-normal cursor-pointer">Follow-up Required</Label>
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
            <Button onClick={() => createTr.mutate(trForm)} disabled={createTr.isPending || !trForm.reportDate}>
              {createTr.isPending ? "Saving…" : "Save Report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Add Communication Note Dialog ══════════════════════════════ */}
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
              <Label className="font-normal cursor-pointer">Confirmation Received</Label>
            </div>
            <div>
              <Label>Linked Job</Label>
              <Select value={cnForm.jobId ?? "_none"} onValueChange={v => setCnForm(f => ({ ...f, jobId: v === "_none" ? undefined : v }))}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— None —</SelectItem>
                  {clientJobs.slice(0, 50).map(j => (
                    <SelectItem key={j.id} value={j.id}>
                      {j.jobNumber ? `${j.jobNumber} — ` : ""}{j.title}
                    </SelectItem>
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
      </>
  );
}

// ── Shared helper components ───────────────────────────────────────────────

function CountBadge({ n }: { n: number }) {
  return (
    <Badge variant="secondary" className="ml-1 text-xs py-0 px-1.5">{n}</Badge>
  );
}

function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground shrink-0 w-36">{label}:</span>
      <span className="font-medium break-words min-w-0">{value}</span>
    </div>
  );
}

function InfoPair({ label, value, className }: { label: string; value?: string; className?: string }) {
  if (!value) return null;
  return (
    <span className={className}>
      <span className="font-medium text-gray-600">{label}: </span>{value}
    </span>
  );
}

function JobGroup({
  title, jobs, getDeptName, getWorkerName,
}: {
  title: string;
  jobs: Job[];
  getDeptName: (id: string) => string;
  getWorkerName: (id?: string) => string | undefined;
}) {
  if (jobs.length === 0) return null;
  return (
    <div>
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
        {title} ({jobs.length})
      </h3>
      <div className="space-y-2">
        {jobs.map(job => (
          <Card key={job.id} className="hover:shadow-sm transition-shadow">
            <CardContent className="pt-3 pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {job.jobNumber && (
                      <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{job.jobNumber}</span>
                    )}
                    <span className="font-semibold text-sm truncate">{job.title}</span>
                    <Badge className={`text-xs ${jobStatusColor(job.status)}`}>
                      {job.status.replace("_", " ")}
                    </Badge>
                    {job.invoiceStatus && job.invoiceStatus !== "not_invoiced" && (
                      <Badge className={`text-xs ${invJobStatusColor(job.invoiceStatus)}`}>
                        {invJobStatusLabel(job.invoiceStatus)}
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(job.scheduledDate), "dd MMM yyyy")}
                      {job.scheduledTime && ` · ${job.scheduledTime}`}
                    </span>
                    <span>{getDeptName(job.departmentId)}</span>
                    <span>{job.serviceType}</span>
                    {job.insects && <span>Pest: {job.insects}</span>}
                    {job.workerId && (
                      <span className="col-span-2 sm:col-span-1">
                        Tech: {getWorkerName(job.workerId) ?? job.workerId}
                      </span>
                    )}
                    {job.price && (
                      <span className="font-medium text-gray-700">
                        R{Number(job.price).toFixed(2)}
                      </span>
                    )}
                    {job.priority && job.priority !== "medium" && (
                      <span className={job.priority === "high" ? "text-red-600" : ""}>
                        Priority: {job.priority}
                      </span>
                    )}
                    {job.location && (
                      <span className="col-span-2 sm:col-span-4 flex items-center gap-1">
                        <MapPin className="h-3 w-3" />{job.location}
                      </span>
                    )}
                  </div>
                </div>
                <Link href="/jobs">
                  <Button variant="outline" size="sm" className="text-xs shrink-0">
                    <ExternalLink className="mr-1 h-3 w-3" />Open Job
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
}
