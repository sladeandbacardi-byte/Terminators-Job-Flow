import React, { useState } from "react";
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
  ChevronDown, ChevronRight, Printer, TrendingUp, Users, Landmark,
  DollarSign, AlertCircle, CheckCircle2, Clock, Activity, MapPinned,
  Star, Pencil, Lightbulb,
} from "lucide-react";
import { ClientForm } from "@/components/forms/client-form";
import ContractForm from "@/components/forms/contract-form";
import UnifiedContractForm from "@/components/forms/unified-contract-form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Client, Job, Invoice, Department } from "@shared/schema";

function hasStructuredAddress(c: any) {
  return !!(c.streetName || c.streetNumber || c.suburb || c.city || c.province || c.postalCode);
}

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
  role?: string; departmentId?: string;
};

type ClientOpportunity = {
  id: string;
  opportunityType: string;
  typeLabel: string;
  description: string;
  urgency: string;
  status: string;
  statusLabel: string;
  estimatedValue?: string | null;
  reporterName: string;
  createdAt: string;
  photos: Array<{ id: string; fileUrl: string }>;
};

type ServiceWalletItem = {
  serviceType: string;
  label: string;
  state: "active" | "previously_used" | "never_used";
  source: "manual" | "history";
};

type ServiceContract = {
  id: string; clientId: string; customerName: string; contractNumber?: string;
  serviceType: string; departmentId: string; frequency: string;
  assignedTeamId?: string; assignedTeamName?: string;
  assignedTechnicianId?: string; assignedTechnicianName?: string;
  startTime?: string; estimatedDuration?: number;
  startDate?: string | Date; endDate?: string | Date;
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

type ClientContact = {
  id: string; clientId: string; firstName: string; lastName?: string;
  jobTitle?: string; email?: string; phone?: string; mobile?: string;
  isPrimary: boolean; notes?: string; createdAt?: string;
};

type ClientSite = {
  id: string; clientId: string; siteName: string;
  streetNumber?: string; streetName?: string; suburb?: string;
  city?: string; province?: string; postalCode?: string;
  googleMapsLink?: string; contactName?: string; contactPhone?: string;
  contactEmail?: string; notes?: string; isActive: boolean; createdAt?: string;
};

type ClientPayment = {
  id: string; clientId: string; invoiceId?: string;
  paymentDate: string; amount: string; method: string;
  reference?: string; notes?: string; allocatedBy?: string; createdAt?: string;
};

type FieldDiary = {
  id: string; diaryNumber: string; jobId?: string; jobNumber?: string;
  clientId?: string; clientName?: string; workerId?: string; workerName?: string;
  departmentId?: string; serviceDate?: string; arrivalTime?: string;
  departureTime?: string; workCompleted?: string; productsUsed?: string;
  notes?: string; customerName?: string; status: string; createdAt?: string;
};

type LeadActivity = {
  id: string; leadId: string; type: string; description: string; createdAt?: string;
};

type AcceptedWorkflow = {
  id: string; quoteId: string; quoteNumber?: string; companyName: string;
  contactPerson?: string; serviceType?: string; quoteAmount?: string;
  workflowStatus: string; departmentId?: string;
  linkedContractId?: string; linkedJobId?: string; linkedInvoiceId?: string;
  serviceScheduled?: boolean; scheduledDate?: string;
  contractSigned?: boolean; notes?: string; createdAt?: string;
};

type FinancialSummary = {
  totalBilled: number; totalPaid: number; outstanding: number; overdue: number;
  aging: { current: number; days30: number; days60: number; days90plus: number };
  invoiceCount: number; paymentCount: number;
  invoiceBalances?: Record<string, number>; // invoiceId → amount paid
};

type ActivityLogEntry = {
  id: string; userId: string; clientId?: string; action: string;
  resource?: string; resourceId?: string; details?: string; timestamp?: string;
};

// ── Constants ──────────────────────────────────────────────────────────────

const NOTE_TYPES = ["WhatsApp", "Phone", "Email", "In Person", "Other"] as const;
const PAYMENT_METHODS = ["Bank Transfer", "EFT", "Cash", "Cheque", "Card", "Other"] as const;
const LEAD_STATUSES  = ["new", "follow_up", "appointment_booked", "quote_required", "quoted"];
const CLOSED_STATUSES = ["converted", "lost"];

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
  : "bg-amber-100 text-amber-800";

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

const fmt = (n: number) => `R${n.toFixed(2)}`;

// ── Shared helper components ───────────────────────────────────────────────

function CountBadge({ n }: { n: number }) {
  return <Badge variant="secondary" className="ml-1 text-xs py-0 px-1.5">{n}</Badge>;
}

function Row({ label, value, className }: { label: string; value?: React.ReactNode; className?: string }) {
  if (!value && value !== 0) return null;
  return (
    <div className={`flex gap-2 ${className ?? ""}`}>
      <span className="text-muted-foreground shrink-0 min-w-[110px]">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function InfoPair({ label, value, className }: { label: string; value?: string; className?: string }) {
  if (!value) return null;
  return (
    <div className={className}>
      <span className="text-muted-foreground">{label}: </span>
      <span>{value}</span>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <Card><CardContent className="py-10 text-center text-muted-foreground">{message}</CardContent></Card>
  );
}

function DebtorsCreditPanel({ client, updateMutation, financialSummary }: {
  client: Client | null | undefined;
  updateMutation: { mutate: (data: any) => void; isPending: boolean };
  financialSummary?: { outstanding: number; overdue: number; aging: { current: number; days30: number; days60: number; days90plus: number } };
}) {
  const [editing, setEditing] = React.useState(false);
  const [limitInput, setLimitInput] = React.useState("");
  const [statusEdit, setStatusEdit] = React.useState(false);
  const [statusValue, setStatusValue] = React.useState(client?.status ?? "active");

  const creditLimit = client?.creditLimit ? Number(client.creditLimit) : 0;
  const outstanding = financialSummary?.outstanding ?? 0;
  const overdue = financialSummary?.overdue ?? 0;
  const utilisation = creditLimit > 0 ? Math.min((outstanding / creditLimit) * 100, 100) : 0;

  const debtorStatus = overdue > 0 && creditLimit > 0 && outstanding >= creditLimit
    ? "OVER LIMIT"
    : overdue > 0
      ? "OVERDUE"
      : outstanding > 0
        ? "CURRENT"
        : "CLEAR";

  const debtorStatusColor: Record<string, string> = {
    "OVER LIMIT": "bg-red-100 text-red-700 border-red-200",
    "OVERDUE":    "bg-orange-100 text-orange-700 border-orange-200",
    "CURRENT":    "bg-amber-100 text-amber-700 border-amber-200",
    "CLEAR":      "bg-green-100 text-green-700 border-green-200",
  };

  const ACCOUNT_STATUSES = ["active", "on_hold", "suspended", "inactive", "blacklisted"];

  const handleSave = () => {
    const val = parseFloat(limitInput);
    if (!isNaN(val) && val >= 0) {
      updateMutation.mutate({ creditLimit: val.toFixed(2) });
    }
    setEditing(false);
  };

  const handleStatusSave = () => {
    updateMutation.mutate({ status: statusValue });
    setStatusEdit(false);
  };

  return (
    <div className="flex flex-wrap gap-6 items-start">
      {/* Debtors status (computed) */}
      <div className="flex flex-col gap-1 min-w-[120px]">
        <span className="text-xs text-muted-foreground">Debtors Status</span>
        <span className={`text-sm font-bold px-3 py-1.5 rounded-full border w-fit ${debtorStatusColor[debtorStatus] ?? ""}`}>
          {debtorStatus}
        </span>
      </div>

      {/* Explicit account status (editable) */}
      <div className="flex flex-col gap-1 min-w-[160px]">
        <span className="text-xs text-muted-foreground">Account Status</span>
        {statusEdit ? (
          <div className="flex gap-2 items-center">
            <select
              autoFocus
              className="border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={statusValue}
              onChange={e => setStatusValue(e.target.value)}
            >
              {ACCOUNT_STATUSES.map(s => <option key={s} value={s}>{s.replace("_", " ").toUpperCase()}</option>)}
            </select>
            <Button size="sm" className="h-7 px-2 text-xs" onClick={handleStatusSave} disabled={updateMutation.isPending}>Save</Button>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setStatusEdit(false)}>✕</Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`text-xs font-semibold ${
              client?.status === "suspended" || client?.status === "blacklisted" ? "border-red-300 text-red-700 bg-red-50" :
              client?.status === "on_hold" ? "border-orange-300 text-orange-700 bg-orange-50" :
              "border-green-300 text-green-700 bg-green-50"
            }`}>
              {(client?.status ?? "active").replace("_", " ").toUpperCase()}
            </Badge>
            <Button size="sm" variant="ghost" className="h-6 px-1.5 text-xs" onClick={() => { setStatusValue(client?.status ?? "active"); setStatusEdit(true); }}>
              <Pencil className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Credit limit with inline edit */}
      <div className="flex flex-col gap-1 min-w-[180px]">
        <span className="text-xs text-muted-foreground">Credit Limit</span>
        {editing ? (
          <div className="flex gap-2 items-center">
            <input
              autoFocus
              type="number"
              min="0"
              step="100"
              className="border rounded px-2 py-1 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-primary"
              value={limitInput}
              onChange={e => setLimitInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }}
            />
            <Button size="sm" className="h-7 px-2 text-xs" onClick={handleSave} disabled={updateMutation.isPending}>Save</Button>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditing(false)}>✕</Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">
              {creditLimit > 0 ? `R${creditLimit.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}` : "Not set"}
            </span>
            <Button size="sm" variant="ghost" className="h-6 px-1.5 text-xs" onClick={() => { setLimitInput(creditLimit > 0 ? String(creditLimit) : ""); setEditing(true); }}>
              <Pencil className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Utilisation bar */}
      {creditLimit > 0 && (
        <div className="flex-1 min-w-[160px] flex flex-col gap-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Used: R{outstanding.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</span>
            <span>{utilisation.toFixed(0)}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all ${utilisation >= 100 ? "bg-red-500" : utilisation >= 80 ? "bg-orange-400" : "bg-green-500"}`}
              style={{ width: `${utilisation}%` }}
            />
          </div>
          <div className="text-xs text-muted-foreground">
            Available: R{Math.max(0, creditLimit - outstanding).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
          </div>
        </div>
      )}
    </div>
  );
}

function JobGroup({ title, jobs, getDeptName, getWorkerName }: {
  title: string; jobs: Job[];
  getDeptName: (id?: string) => string;
  getWorkerName: (id?: string) => string | undefined;
}) {
  if (jobs.length === 0) return null;
  return (
    <div>
      <h3 className="text-sm font-semibold text-muted-foreground mb-2">{title} ({jobs.length})</h3>
      <div className="space-y-2">
        {jobs.map(j => (
          <Card key={j.id} className="overflow-hidden">
            <CardContent className="pt-3 pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {j.jobNumber && <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{j.jobNumber}</span>}
                    <span className="font-medium text-sm">{j.title}</span>
                    <Badge className={`text-xs ${jobStatusColor(j.status)}`}>{j.status.replace("_"," ")}</Badge>
                    {(j as any).invoiceStatus && (j as any).invoiceStatus !== "not_invoiced" && (
                      <Badge className={`text-xs ${invJobStatusColor((j as any).invoiceStatus)}`}>
                        {invJobStatusLabel((j as any).invoiceStatus)}
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                    <span>{getDeptName(j.departmentId)}</span>
                    {j.scheduledDate && <span>{format(new Date(j.scheduledDate), "dd MMM yyyy")}</span>}
                    {j.workerId && <span>{getWorkerName(j.workerId)}</span>}
                  </div>
                </div>
                <Link href="/job-scheduling">
                  <Button variant="ghost" size="sm" className="h-7 text-xs px-2 shrink-0">
                    <ExternalLink className="h-3 w-3 mr-1" />Open
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

// ── Main Page ──────────────────────────────────────────────────────────────

export default function ClientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const qc = useQueryClient();

  // ── Tab & UI state ───────────────────────────────────────────────────────

  const [activeTab, setActiveTab] = useState("overview");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [expandedTr, setExpandedTr] = useState<string | null>(null);
  const [expandedCn, setExpandedCn] = useState<string | null>(null);
  const [contractFilter, setContractFilter] = useState<"all"|"unified"|"service"|"rental"|"active"|"inactive">("all");
  const [showUnifiedForm, setShowUnifiedForm] = useState(false);
  const [editingUnified, setEditingUnified] = useState<any | null>(null);
  const [isRentalFormOpen, setIsRentalFormOpen] = useState(false);
  const [editingRental, setEditingRental] = useState<any | null>(null);

  // Treatment reports
  const [trOpen, setTrOpen] = useState(false);
  const [trForm, setTrForm] = useState<Partial<TreatmentReport>>({});

  // Comm notes
  const [cnOpen, setCnOpen] = useState(false);
  const [cnForm, setCnForm] = useState<Partial<CommunicationNote>>({
    type: "Phone", noteDate: format(new Date(), "yyyy-MM-dd"),
  });

  // Contacts
  const [contactOpen, setContactOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ClientContact | null>(null);
  const [contactForm, setContactForm] = useState<Partial<ClientContact>>({});

  // Sites
  const [siteOpen, setSiteOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<ClientSite | null>(null);
  const [siteForm, setSiteForm] = useState<Partial<ClientSite>>({ isActive: true });

  // Payments
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<ClientPayment | null>(null);
  const [paymentForm, setPaymentForm] = useState<Partial<ClientPayment>>({
    method: "Bank Transfer", paymentDate: format(new Date(), "yyyy-MM-dd"),
  });

  // ── Data queries ─────────────────────────────────────────────────────────

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
  const { data: clientStockUsage = [] } = useQuery<JobInventoryItem[]>({
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

  // New: contacts, sites, payments, field diaries, accepted workflows, financial summary
  const { data: contacts = [] } = useQuery<ClientContact[]>({
    queryKey: ["/api/clients", id, "contacts"],
    queryFn: () => fetch(`/api/clients/${id}/contacts`).then(r => r.json()),
    enabled: !!id,
  });
  const { data: sites = [] } = useQuery<ClientSite[]>({
    queryKey: ["/api/clients", id, "sites"],
    queryFn: () => fetch(`/api/clients/${id}/sites`).then(r => r.json()),
    enabled: !!id,
  });
  const { data: payments = [] } = useQuery<ClientPayment[]>({
    queryKey: ["/api/clients", id, "payments"],
    queryFn: () => fetch(`/api/clients/${id}/payments`).then(r => r.json()),
    enabled: !!id,
  });
  const { data: allFieldDiaries = [] } = useQuery<FieldDiary[]>({
    queryKey: ["/api/field-diaries"],
    queryFn: () => fetch(`/api/field-diaries`).then(r => r.json()),
  });
  const { data: allAcceptedWorkflows = [] } = useQuery<AcceptedWorkflow[]>({
    queryKey: ["/api/accepted-workflows"],
    queryFn: () => fetch(`/api/accepted-workflows`).then(r => r.json()),
  });
  const { data: financialSummary } = useQuery<FinancialSummary>({
    queryKey: ["/api/clients", id, "summary"],
    queryFn: () => fetch(`/api/clients/${id}/summary`).then(r => r.json()),
    enabled: !!id,
  });
  const { data: clientOpportunities = [] } = useQuery<ClientOpportunity[]>({
    queryKey: ["/api/clients", id, "opportunities"],
    queryFn: () => fetch(`/api/clients/${id}/opportunities`).then(r => r.ok ? r.json() : []),
    enabled: !!id,
  });
  const { data: serviceWallet = [] } = useQuery<ServiceWalletItem[]>({
    queryKey: ["/api/clients", id, "service-wallet"],
    queryFn: () => fetch(`/api/clients/${id}/service-wallet`).then(r => r.ok ? r.json() : []),
    enabled: !!id,
  });

  const { data: clientActivityLogs = [] } = useQuery<ActivityLogEntry[]>({
    queryKey: ["/api/clients", id, "activity"],
    queryFn: () => fetch(`/api/clients/${id}/activity`).then(r => r.ok ? r.json() : []),
    enabled: !!id,
  });

  // Lead activities — fetch per client's quotes (uses allQuotes, not derived clientQuotes)
  const { data: allLeadActivities = [] } = useQuery<LeadActivity[]>({
    queryKey: ["/api/lead-activities/client", id, allQuotes.length],
    queryFn: async () => {
      const relevantQuotes = allQuotes.filter(q =>
        q.clientId === id || (client && q.companyName?.toLowerCase() === client.name?.toLowerCase())
      ).slice(0, 20);
      if (!relevantQuotes.length) return [];
      const results = await Promise.all(
        relevantQuotes.map(q =>
          fetch(`/api/quote-submissions/${q.id}/activities`).then(r => r.ok ? r.json() : [])
        )
      );
      return results.flat();
    },
    enabled: !!id && allQuotes.length > 0,
  });

  // ── Derived lists ─────────────────────────────────────────────────────────

  const clientJobs           = allJobs.filter(j => j.clientId === id);
  const clientInvoices       = allInvoices.filter(i => i.clientId === id);
  const clientContracts      = allContracts.filter(c => c.clientId === id);
  const clientRentalContracts = allRentalContracts.filter((c: any) => c.clientId === id);
  const clientQuotes         = allQuotes.filter(q =>
    q.clientId === id ||
    (client && q.companyName?.toLowerCase() === client.name?.toLowerCase())
  );
  const clientLeads  = clientQuotes.filter(q => LEAD_STATUSES.includes(q.status));
  const clientClosedQuotes = clientQuotes.filter(q => CLOSED_STATUSES.includes(q.status));

  // Field diaries — filter by clientId or by job belonging to this client
  const clientJobIds = new Set(clientJobs.map(j => j.id));
  const clientFieldDiaries = allFieldDiaries.filter(d =>
    d.clientId === id || (d.jobId && clientJobIds.has(d.jobId))
  );

  // Accepted workflows — filter by quote belonging to this client
  const clientQuoteIds = new Set(clientQuotes.map(q => q.id));
  const clientAcceptedWorkflows = allAcceptedWorkflows.filter(w =>
    clientQuoteIds.has(w.quoteId)
  );

  // Job groups
  const inProgressJobs = clientJobs.filter(j => j.status === "in_progress");
  const upcomingJobs   = clientJobs.filter(j => j.status === "scheduled" && new Date(j.scheduledDate) >= new Date());
  const completedJobs  = clientJobs.filter(j => j.status === "completed");
  const otherJobs      = clientJobs.filter(j => !["in_progress","scheduled","completed"].includes(j.status));

  // Stats
  const activeContractCount = clientUnifiedContracts.filter((c: any) => c.activeStatus).length
    + clientContracts.filter(c => c.activeStatus).length
    + clientRentalContracts.filter((c: any) => c.isActive ?? c.activeStatus).length;
  const openInvoiceCount = clientInvoices.filter(i => i.status !== "paid" && i.status !== "cancelled").length;

  // Lookup helpers
  const getDeptName   = (dId?: string) => departments.find(d => d.id === dId)?.name ?? "—";
  const getWorkerName = (wId?: string) => wId ? (allWorkers.find(w => w.id === wId)?.name ?? wId) : undefined;
  const getJobNum     = (jId?: string) => jId ? (allJobs.find(j => j.id === jId)?.jobNumber ?? jId) : undefined;
  const getJobDate    = (jId: string)  => { const j = allJobs.find(x => x.id === jId); return j ? j.scheduledDate : undefined; };
  const getJobWorker  = (jId: string)  => { const j = allJobs.find(x => x.id === jId); return j?.workerId ? getWorkerName(j.workerId) : undefined; };
  const getItemName   = (iId: string)  => allInventory.find(i => i.id === iId)?.name ?? iId;

  // ── Mutations — existing ─────────────────────────────────────────────────

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

  // ── Mutations — new (contacts, sites, payments) ──────────────────────────

  const createContact = useMutation({
    mutationFn: async (data: any) =>
      (await apiRequest("POST", `/api/clients/${id}/contacts`, data)).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/clients", id, "contacts"] });
      setContactOpen(false); setContactForm({}); setEditingContact(null);
      toast({ description: "Contact saved" });
    },
    onError: () => toast({ description: "Failed to save contact", variant: "destructive" }),
  });

  const updateContact = useMutation({
    mutationFn: async ({ cid, data }: { cid: string; data: any }) =>
      (await apiRequest("PATCH", `/api/clients/${id}/contacts/${cid}`, data)).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/clients", id, "contacts"] });
      setContactOpen(false); setContactForm({}); setEditingContact(null);
      toast({ description: "Contact updated" });
    },
    onError: () => toast({ description: "Failed to update contact", variant: "destructive" }),
  });

  const deleteContact = useMutation({
    mutationFn: (cid: string) => apiRequest("DELETE", `/api/clients/${id}/contacts/${cid}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/clients", id, "contacts"] }); toast({ description: "Contact deleted" }); },
  });

  const createSite = useMutation({
    mutationFn: async (data: any) =>
      (await apiRequest("POST", `/api/clients/${id}/sites`, data)).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/clients", id, "sites"] });
      setSiteOpen(false); setSiteForm({ isActive: true }); setEditingSite(null);
      toast({ description: "Site saved" });
    },
    onError: () => toast({ description: "Failed to save site", variant: "destructive" }),
  });

  const updateSite = useMutation({
    mutationFn: async ({ sid, data }: { sid: string; data: any }) =>
      (await apiRequest("PATCH", `/api/clients/${id}/sites/${sid}`, data)).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/clients", id, "sites"] });
      setSiteOpen(false); setSiteForm({ isActive: true }); setEditingSite(null);
      toast({ description: "Site updated" });
    },
    onError: () => toast({ description: "Failed to update site", variant: "destructive" }),
  });

  const deleteSite = useMutation({
    mutationFn: (sid: string) => apiRequest("DELETE", `/api/clients/${id}/sites/${sid}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/clients", id, "sites"] }); toast({ description: "Site deleted" }); },
  });

  const createPayment = useMutation({
    mutationFn: async (data: any) =>
      (await apiRequest("POST", `/api/clients/${id}/payments`, data)).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/clients", id, "payments"] });
      qc.invalidateQueries({ queryKey: ["/api/clients", id, "summary"] });
      setPaymentOpen(false);
      setPaymentForm({ method: "Bank Transfer", paymentDate: format(new Date(), "yyyy-MM-dd") });
      setEditingPayment(null);
      toast({ description: "Payment recorded" });
    },
    onError: () => toast({ description: "Failed to record payment", variant: "destructive" }),
  });

  const updatePayment = useMutation({
    mutationFn: async ({ pid, data }: { pid: string; data: any }) =>
      (await apiRequest("PATCH", `/api/client-payments/${pid}`, data)).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/clients", id, "payments"] });
      qc.invalidateQueries({ queryKey: ["/api/clients", id, "summary"] });
      setPaymentOpen(false);
      setPaymentForm({ method: "Bank Transfer", paymentDate: format(new Date(), "yyyy-MM-dd") });
      setEditingPayment(null);
      toast({ description: "Payment updated" });
    },
    onError: () => toast({ description: "Failed to update payment", variant: "destructive" }),
  });

  const deletePayment = useMutation({
    mutationFn: (pid: string) => apiRequest("DELETE", `/api/client-payments/${pid}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/clients", id, "payments"] });
      qc.invalidateQueries({ queryKey: ["/api/clients", id, "summary"] });
      toast({ description: "Payment deleted" });
    },
  });

  // ── Loading / not found ───────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[300px]">
        <div className="text-muted-foreground">Loading client profile…</div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-6">
        <Link href="/clients"><Button variant="ghost" size="sm"><ArrowLeft className="mr-1 h-4 w-4" />Back to Clients</Button></Link>
        <div className="mt-4 text-center text-muted-foreground">Client not found.</div>
      </div>
    );
  }

  // ── Helpers for contact/site/payment form dialogs ────────────────────────

  const openNewContact = () => { setEditingContact(null); setContactForm({}); setContactOpen(true); };
  const openEditContact = (c: ClientContact) => { setEditingContact(c); setContactForm({ ...c }); setContactOpen(true); };

  const openNewSite = () => { setEditingSite(null); setSiteForm({ isActive: true }); setSiteOpen(true); };
  const openEditSite = (s: ClientSite) => { setEditingSite(s); setSiteForm({ ...s }); setSiteOpen(true); };

  const openNewPayment = () => { setEditingPayment(null); setPaymentForm({ method: "Bank Transfer", paymentDate: format(new Date(), "yyyy-MM-dd") }); setPaymentOpen(true); };
  const openEditPayment = (p: ClientPayment) => { setEditingPayment(p); setPaymentForm({ ...p }); setPaymentOpen(true); };

  const submitContact = () => {
    if (!contactForm.firstName) return toast({ description: "First name is required", variant: "destructive" });
    if (editingContact) {
      updateContact.mutate({ cid: editingContact.id, data: contactForm });
    } else {
      createContact.mutate(contactForm);
    }
  };

  const submitSite = () => {
    if (!siteForm.siteName) return toast({ description: "Site name is required", variant: "destructive" });
    if (editingSite) {
      updateSite.mutate({ sid: editingSite.id, data: siteForm });
    } else {
      createSite.mutate(siteForm);
    }
  };

  const submitPayment = () => {
    if (!paymentForm.amount || !paymentForm.paymentDate) return toast({ description: "Amount and date are required", variant: "destructive" });
    if (editingPayment) {
      updatePayment.mutate({ pid: editingPayment.id, data: paymentForm });
    } else {
      createPayment.mutate(paymentForm);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="p-6 pb-20 lg:pb-6">
        <div className="max-w-6xl mx-auto space-y-5">

          {/* Back */}
          <Link href="/clients">
            <Button variant="ghost" size="sm"><ArrowLeft className="mr-1 h-4 w-4" />Clients</Button>
          </Link>

          {/* ── Client Header Card ── */}
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
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mt-4 pt-4 border-t">
                {[
                  { label: "Jobs",         value: clientJobs.length,          tab: "jobs",          color: "text-blue-600" },
                  { label: "Contracts",    value: activeContractCount,         tab: "contracts",     color: "text-green-600" },
                  { label: "Open Inv.",    value: openInvoiceCount,            tab: "invoices",      color: "text-orange-600" },
                  { label: "Leads",        value: clientLeads.length,          tab: "leads",         color: "text-purple-600" },
                  { label: "Contacts",     value: contacts.length,             tab: "contacts",      color: "text-teal-600" },
                  { label: "Sites",        value: sites.length,                tab: "sites",         color: "text-indigo-600" },
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

          {/* ── Tabs ── */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="flex flex-wrap h-auto gap-1">
              <TabsTrigger value="overview"><TrendingUp className="mr-1 h-3.5 w-3.5" />Overview</TabsTrigger>
              <TabsTrigger value="contacts"><Users className="mr-1 h-3.5 w-3.5" />Contacts{contacts.length > 0 && <CountBadge n={contacts.length} />}</TabsTrigger>
              <TabsTrigger value="sites"><MapPinned className="mr-1 h-3.5 w-3.5" />Sites{sites.length > 0 && <CountBadge n={sites.length} />}</TabsTrigger>
              <TabsTrigger value="leads"><Star className="mr-1 h-3.5 w-3.5" />Leads{clientLeads.length > 0 && <CountBadge n={clientLeads.length} />}</TabsTrigger>
              <TabsTrigger value="quotes"><FileText className="mr-1 h-3.5 w-3.5" />Quotes{clientQuotes.length > 0 && <CountBadge n={clientQuotes.length} />}</TabsTrigger>
              <TabsTrigger value="accepted-work"><CheckCircle2 className="mr-1 h-3.5 w-3.5" />Accepted Work{clientAcceptedWorkflows.length > 0 && <CountBadge n={clientAcceptedWorkflows.length} />}</TabsTrigger>
              <TabsTrigger value="jobs"><Briefcase className="mr-1 h-3.5 w-3.5" />Jobs{clientJobs.length > 0 && <CountBadge n={clientJobs.length} />}</TabsTrigger>
              <TabsTrigger value="contracts"><ClipboardList className="mr-1 h-3.5 w-3.5" />Contracts{clientContracts.length > 0 && <CountBadge n={clientContracts.length} />}</TabsTrigger>
              <TabsTrigger value="field-diaries"><FlaskConical className="mr-1 h-3.5 w-3.5" />Field Diaries{(clientFieldDiaries.length + treatmentRpts.length) > 0 && <CountBadge n={clientFieldDiaries.length + treatmentRpts.length} />}</TabsTrigger>
              <TabsTrigger value="invoices"><Receipt className="mr-1 h-3.5 w-3.5" />Invoices{clientInvoices.length > 0 && <CountBadge n={clientInvoices.length} />}</TabsTrigger>
              <TabsTrigger value="payments"><CreditCard className="mr-1 h-3.5 w-3.5" />Payments{payments.length > 0 && <CountBadge n={payments.length} />}</TabsTrigger>
              <TabsTrigger value="debtors"><DollarSign className="mr-1 h-3.5 w-3.5" />Debtors</TabsTrigger>
              <TabsTrigger value="documents"><FolderOpen className="mr-1 h-3.5 w-3.5" />Documents</TabsTrigger>
              <TabsTrigger value="opportunities"><Lightbulb className="mr-1 h-3.5 w-3.5" />Opportunities{clientOpportunities.length > 0 && <CountBadge n={clientOpportunities.length} />}</TabsTrigger>
              <TabsTrigger value="activity"><Activity className="mr-1 h-3.5 w-3.5" />Activity{(commNotes.length + allLeadActivities.length) > 0 && <CountBadge n={commNotes.length + allLeadActivities.length} />}</TabsTrigger>
            </TabsList>

            {/* ═══════════════════════ 1. OVERVIEW ═══════════════════════════════ */}
            <TabsContent value="overview" className="space-y-4 mt-4">
              {/* Financial Summary */}
              {financialSummary && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Card className="border-blue-100">
                    <CardContent className="pt-4 pb-4">
                      <div className="text-xs text-muted-foreground mb-1">Total Billed</div>
                      <div className="text-xl font-bold text-blue-700">{fmt(financialSummary.totalBilled)}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{financialSummary.invoiceCount} invoices</div>
                    </CardContent>
                  </Card>
                  <Card className="border-green-100">
                    <CardContent className="pt-4 pb-4">
                      <div className="text-xs text-muted-foreground mb-1">Total Paid</div>
                      <div className="text-xl font-bold text-green-700">{fmt(financialSummary.totalPaid)}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{financialSummary.paymentCount} payments</div>
                    </CardContent>
                  </Card>
                  <Card className="border-amber-100">
                    <CardContent className="pt-4 pb-4">
                      <div className="text-xs text-muted-foreground mb-1">Outstanding</div>
                      <div className="text-xl font-bold text-amber-700">{fmt(financialSummary.outstanding)}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{openInvoiceCount} open invoices</div>
                    </CardContent>
                  </Card>
                  <Card className={`${financialSummary.overdue > 0 ? "border-red-200" : "border-gray-100"}`}>
                    <CardContent className="pt-4 pb-4">
                      <div className="text-xs text-muted-foreground mb-1">Overdue</div>
                      <div className={`text-xl font-bold ${financialSummary.overdue > 0 ? "text-red-700" : "text-gray-500"}`}>{fmt(financialSummary.overdue)}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">past due date</div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Client Details */}
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
                      <MapPin className="h-4 w-4" />Address
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-1.5">
                    {hasStructuredAddress(client) ? (
                      <>
                        <Row label="Street"       value={[client.streetNumber, client.streetName].filter(Boolean).join(" ")} />
                        <Row label="Suburb"       value={client.suburb} />
                        <Row label="City"         value={client.city} />
                        <Row label="Province"     value={client.province} />
                        <Row label="Postal Code"  value={client.postalCode} />
                      </>
                    ) : (
                      <Row label="Address"        value={client.address} />
                    )}
                    {client.googleMapsLink && (
                      <a href={client.googleMapsLink} target="_blank" rel="noopener noreferrer"
                         className="flex items-center gap-1 text-blue-600 hover:underline text-xs pt-1">
                        <MapPin className="h-3.5 w-3.5" />Open in Google Maps
                      </a>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Landmark className="h-4 w-4" />Billing & Finance
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-1.5">
                    {(client.billingName || client.billingEmail || client.billingPhone) && (
                      <>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Billing Contact</p>
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

              {/* Operational summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: "Active Jobs",         value: clientJobs.filter(j => !["completed","cancelled"].includes(j.status)).length, icon: "🔧", color: "text-blue-700" },
                  { label: "Open Quotes",         value: clientLeads.length, icon: "📄", color: "text-purple-700" },
                  { label: "Active Contracts",    value: clientContracts.filter(c => !["inactive","cancelled","expired"].includes((c as any).status ?? "")).length, icon: "📋", color: "text-teal-700" },
                  { label: "Jobs This Year",      value: clientJobs.filter(j => new Date(j.scheduledDate ?? j.createdAt ?? "").getFullYear() === new Date().getFullYear()).length, icon: "📆", color: "text-gray-700" },
                  { label: "Sales Rep",           value: client.salesperson ?? client.contactPerson ?? "—", icon: "👤", color: "text-gray-700" },
                  {
                    label: "Next Scheduled",
                    value: (() => {
                      const upcoming = clientJobs
                        .filter(j => j.status === "scheduled" && j.scheduledDate && new Date(j.scheduledDate) >= new Date())
                        .sort((a,b) => new Date(a.scheduledDate!).getTime() - new Date(b.scheduledDate!).getTime());
                      return upcoming[0]?.scheduledDate ? format(new Date(upcoming[0].scheduledDate), "dd MMM yyyy") : "None";
                    })(),
                    icon: "🗓️", color: "text-green-700",
                  },
                ].map(card => (
                  <Card key={card.label}>
                    <CardContent className="pt-4 pb-4">
                      <div className="text-xs text-muted-foreground mb-1">{card.icon} {card.label}</div>
                      <div className={`text-sm font-bold ${card.color}`}>{typeof card.value === "number" ? card.value : card.value}</div>
                    </CardContent>
                  </Card>
                ))}
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

            {/* ═══════════════════════ ADDITIONAL OPPORTUNITIES ═══════════════════════ */}
            <TabsContent value="opportunities" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2"><Lightbulb className="h-4 w-4 text-amber-500" />Service Wallet</CardTitle>
                  <p className="text-xs text-muted-foreground">Services currently active or historically discussed for this client.</p>
                </CardHeader>
                <CardContent>
                  {serviceWallet.length === 0 ? <p className="text-sm text-muted-foreground">No Service Wallet history yet.</p> : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {serviceWallet.map(item => (
                        <div key={item.serviceType} className="flex items-center justify-between rounded-lg border px-3 py-2">
                          <span className="text-sm font-medium">{item.label}</span>
                          <Badge className={item.state === "active" ? "bg-green-100 text-green-800 hover:bg-green-100" : item.state === "previously_used" ? "bg-amber-100 text-amber-800 hover:bg-amber-100" : "bg-gray-100 text-gray-600 hover:bg-gray-100"}>
                            {item.state === "active" ? "Active" : item.state === "previously_used" ? "Previously used" : "Not used"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2"><Lightbulb className="h-4 w-4 text-amber-500" />Opportunity history</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {clientOpportunities.length === 0 ? <p className="py-5 text-center text-sm text-muted-foreground">No additional opportunities have been reported for this client.</p> :
                    clientOpportunities.map(item => (
                      <article key={item.id} className="rounded-lg border p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div><p className="font-semibold text-sm">{item.typeLabel}</p><p className="text-xs text-muted-foreground">Reported by {item.reporterName} · {format(new Date(item.createdAt), "dd MMM yyyy")}</p></div>
                          <div className="flex gap-1"><Badge variant="outline">{item.statusLabel}</Badge>{item.urgency !== "normal" && <Badge className={item.urgency === "urgent" ? "bg-red-100 text-red-700 hover:bg-red-100" : "bg-amber-100 text-amber-700 hover:bg-amber-100"}>{item.urgency}</Badge>}</div>
                        </div>
                        <p className="mt-2 text-sm text-gray-600 whitespace-pre-wrap">{item.description}</p>
                        {item.estimatedValue && <p className="mt-2 text-xs font-medium text-green-700">Estimated value: R {Number(item.estimatedValue).toLocaleString("en-ZA")}</p>}
                        {item.photos.length > 0 && <div className="mt-3 flex gap-2 overflow-x-auto">{item.photos.map(photo => <img key={photo.id} src={photo.fileUrl} alt="Opportunity evidence" className="h-16 w-20 rounded object-cover" />)}</div>}
                      </article>
                    ))}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ═══════════════════════ 2. CONTACTS ══════════════════════════════ */}
            <TabsContent value="contacts" className="mt-4">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm text-muted-foreground">{contacts.length} contact{contacts.length !== 1 ? "s" : ""}</span>
                <Button size="sm" className="gap-1" onClick={openNewContact}>
                  <Plus className="h-3.5 w-3.5" />Add Contact
                </Button>
              </div>
              {contacts.length === 0 ? (
                <EmptyState message="No contacts added yet. Add key people at this account." />
              ) : (
                <div className="space-y-2">
                  {contacts.map(c => (
                    <Card key={c.id}>
                      <CardContent className="pt-3 pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium">{c.firstName} {c.lastName}</span>
                              {c.isPrimary && <Badge className="bg-blue-100 text-blue-800 text-xs">Primary</Badge>}
                              {c.jobTitle && <span className="text-sm text-muted-foreground">{c.jobTitle}</span>}
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground mt-1">
                              {c.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                              {c.mobile && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.mobile} (mobile)</span>}
                              {c.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>}
                            </div>
                            {c.notes && <p className="text-xs text-muted-foreground mt-1 italic">{c.notes}</p>}
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openEditContact(c)}>
                              <Edit className="h-3 w-3 mr-1" />Edit
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                              onClick={() => { if (confirm("Delete this contact?")) deleteContact.mutate(c.id); }}>
                              <Trash2 className="h-3.5 w-3.5 text-red-400" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ═══════════════════════ 3. SITES ═════════════════════════════════ */}
            <TabsContent value="sites" className="mt-4">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm text-muted-foreground">{sites.length} site{sites.length !== 1 ? "s" : ""}</span>
                <Button size="sm" className="gap-1" onClick={openNewSite}>
                  <Plus className="h-3.5 w-3.5" />Add Site
                </Button>
              </div>
              {sites.length === 0 ? (
                <EmptyState message="No service sites added yet." />
              ) : (
                <div className="space-y-2">
                  {sites.map(s => (
                    <Card key={s.id}>
                      <CardContent className="pt-3 pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium">{s.siteName}</span>
                              {!s.isActive && <Badge className="bg-gray-100 text-gray-600 text-xs">Inactive</Badge>}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {[s.streetNumber, s.streetName, s.suburb, s.city].filter(Boolean).join(", ")}
                            </div>
                            {(s.contactName || s.contactPhone) && (
                              <div className="text-xs text-muted-foreground mt-0.5">
                                Site contact: {[s.contactName, s.contactPhone].filter(Boolean).join(" · ")}
                              </div>
                            )}
                            {s.googleMapsLink && (
                              <a href={s.googleMapsLink} target="_blank" rel="noopener noreferrer"
                                 className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-0.5">
                                <MapPin className="h-3 w-3" />Maps
                              </a>
                            )}
                            {s.notes && <p className="text-xs text-muted-foreground mt-1 italic">{s.notes}</p>}
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openEditSite(s)}>
                              <Edit className="h-3 w-3 mr-1" />Edit
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                              onClick={() => { if (confirm("Delete this site?")) deleteSite.mutate(s.id); }}>
                              <Trash2 className="h-3.5 w-3.5 text-red-400" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ═══════════════════════ 4. LEADS ═════════════════════════════════ */}
            <TabsContent value="leads" className="mt-4">
              {clientLeads.length === 0 ? (
                <EmptyState message="No open leads for this client." />
              ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Quote #</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Date</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Service</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientLeads.map(q => (
                        <tr key={q.id} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="px-3 py-2.5 font-mono text-xs font-semibold">{q.quoteNumber ?? "—"}</td>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">
                            {q.submittedAt ? format(new Date(q.submittedAt), "dd MMM yyyy") : "—"}
                          </td>
                          <td className="px-3 py-2.5 text-xs hidden md:table-cell">{q.serviceType ?? "—"}</td>
                          <td className="px-3 py-2.5 text-right font-semibold">
                            {q.quoteAmount ? `R${Number(q.quoteAmount).toFixed(2)}` : "—"}
                          </td>
                          <td className="px-3 py-2.5">
                            <Badge variant="outline" className="text-xs">{q.status.replace(/_/g," ")}</Badge>
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

            {/* ═══════════════════════ 5. QUOTES ════════════════════════════════ */}
            <TabsContent value="quotes" className="mt-4">
              {clientQuotes.length === 0 ? (
                <EmptyState message="No quotes for this client." />
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
                            <Badge variant="outline" className={`text-xs ${CLOSED_STATUSES.includes(q.status) ? "border-green-300 text-green-700" : ""}`}>
                              {q.status.replace(/_/g, " ")}
                            </Badge>
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
                    <tfoot className="bg-gray-50 border-t">
                      <tr>
                        <td colSpan={4} className="px-3 py-2 text-xs text-muted-foreground">
                          {clientLeads.length} open · {clientClosedQuotes.length} closed
                        </td>
                        <td className="px-3 py-2 text-right text-xs font-bold">
                          R{clientQuotes.reduce((s,q) => s + (q.quoteAmount ? Number(q.quoteAmount) : 0), 0).toFixed(2)}
                        </td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </TabsContent>

            {/* ═══════════════════════ 6. ACCEPTED WORK ════════════════════════ */}
            <TabsContent value="accepted-work" className="mt-4">
              {clientAcceptedWorkflows.length === 0 ? (
                <EmptyState message="No accepted work workflows linked to this client." />
              ) : (
                <div className="space-y-2">
                  {clientAcceptedWorkflows.map(w => (
                    <Card key={w.id}>
                      <CardContent className="pt-3 pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {w.quoteNumber && <span className="font-mono text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded border border-green-100">{w.quoteNumber}</span>}
                              <span className="font-medium text-sm">{w.companyName}</span>
                              <Badge variant="outline" className="text-xs">{w.workflowStatus.replace(/_/g," ")}</Badge>
                              {w.serviceType && <span className="text-xs text-muted-foreground">{w.serviceType}</span>}
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                              {w.departmentId && <InfoPair label="Dept" value={getDeptName(w.departmentId)} />}
                              {w.quoteAmount && <InfoPair label="Value" value={`R${Number(w.quoteAmount).toFixed(2)}`} />}
                              {w.scheduledDate && <InfoPair label="Scheduled" value={w.scheduledDate} />}
                              {w.contractSigned && <span className="text-green-600">✓ Contract signed</span>}
                              {w.linkedJobId && <InfoPair label="Job" value={getJobNum(w.linkedJobId) ?? w.linkedJobId} />}
                            </div>
                            {w.notes && <p className="text-xs text-muted-foreground border-t pt-1 mt-1">{w.notes}</p>}
                          </div>
                          <Link href="/accepted-work">
                            <Button variant="ghost" size="sm" className="h-7 text-xs px-2 shrink-0">
                              <ExternalLink className="h-3 w-3 mr-1" />Open
                            </Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ═══════════════════════ 7. JOBS ══════════════════════════════════ */}
            <TabsContent value="jobs" className="space-y-4 mt-4">
              {clientJobs.length === 0 ? (
                <EmptyState message="No jobs for this client." />
              ) : (
                <>
                  <JobGroup title="In Progress"           jobs={inProgressJobs} getDeptName={getDeptName} getWorkerName={getWorkerName} />
                  <JobGroup title="Upcoming / Scheduled"  jobs={upcomingJobs}   getDeptName={getDeptName} getWorkerName={getWorkerName} />
                  <JobGroup title="Completed"             jobs={completedJobs}  getDeptName={getDeptName} getWorkerName={getWorkerName} />
                  <JobGroup title="Cancelled / Other"     jobs={otherJobs}      getDeptName={getDeptName} getWorkerName={getWorkerName} />
                </>
              )}
            </TabsContent>

            {/* ═══════════════════════ 8. CONTRACTS ════════════════════════════ */}
            <TabsContent value="contracts" className="mt-4">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm text-muted-foreground">
                  {clientUnifiedContracts.length + clientContracts.length + clientRentalContracts.length} contract{(clientUnifiedContracts.length + clientContracts.length + clientRentalContracts.length) !== 1 ? "s" : ""}
                  {activeContractCount > 0 && ` · ${activeContractCount} active`}
                </span>
                <Button size="sm" variant="outline" className="gap-1" onClick={() => { setEditingUnified(null); setShowUnifiedForm(true); }}>
                  <Plus className="h-3.5 w-3.5" />New Contract
                </Button>
              </div>

              {(clientUnifiedContracts.length + clientContracts.length + clientRentalContracts.length) > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {(["all","unified","service","rental","active","inactive"] as const).map(f => {
                    const total = clientUnifiedContracts.length + clientContracts.length + clientRentalContracts.length;
                    const label = f === "all" ? `All (${total})`
                      : f === "unified" ? `Contracts (${clientUnifiedContracts.length})`
                      : f === "service" ? `Legacy Service (${clientContracts.length})`
                      : f === "rental"  ? `Legacy Rental (${clientRentalContracts.length})`
                      : f === "active"  ? `Active (${activeContractCount})`
                      : `Inactive (${total - activeContractCount})`;
                    return (
                      <button key={f} onClick={() => setContractFilter(f)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                          contractFilter === f ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Unified contracts */}
              {(contractFilter === "all" || contractFilter === "unified" || contractFilter === "active" || contractFilter === "inactive") &&
                clientUnifiedContracts.filter(c => {
                  if (contractFilter === "active") return !!c.activeStatus;
                  if (contractFilter === "inactive") return !c.activeStatus;
                  return true;
                }).length > 0 && (
                <div className="space-y-2 mb-3">
                  {clientUnifiedContracts.filter(c => {
                    if (contractFilter === "active") return !!c.activeStatus;
                    if (contractFilter === "inactive") return !c.activeStatus;
                    return true;
                  }).map((c: any) => (
                    <Card key={c.id} className="border-green-100">
                      <CardContent className="pt-3 pb-3">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {c.contractNumber && <span className="font-mono text-xs px-2 py-0.5 rounded bg-green-50 text-green-700 border border-green-100">{c.contractNumber}</span>}
                              <Badge className="bg-green-100 text-green-800 text-xs">Contract</Badge>
                              {c.department && <Badge className="bg-gray-100 text-gray-700 text-xs">{c.department}</Badge>}
                              <Badge className={c.activeStatus ? "bg-green-100 text-green-800 text-xs" : "bg-gray-100 text-gray-600 text-xs"}>
                                {c.activeStatus ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-0.5 text-xs text-muted-foreground mt-1">
                              {[c.frequency, c.dayOfWeek, c.startTime ? `@ ${c.startTime}` : undefined].filter(Boolean).join(" · ") &&
                                <InfoPair label="Schedule" value={[c.frequency, c.dayOfWeek, c.startTime ? `@ ${c.startTime}` : undefined].filter(Boolean).join(" · ")} className="col-span-2" />}
                              {c.contractStartDate && <InfoPair label="Start" value={c.contractStartDate} />}
                            </div>
                          </div>
                          <Button variant="outline" size="sm" className="text-xs shrink-0"
                            onClick={() => { setEditingUnified(c); setShowUnifiedForm(true); }}>
                            <Edit className="mr-1 h-3 w-3" />Edit
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Legacy contracts */}
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
                  return <EmptyState message="No contracts for this client yet." />;
                }
                if (combined.length === 0) return null;
                return (
                  <div className="space-y-2">
                    {combined.map(({ type, data: c }) => {
                      const isService = type === "service";
                      const active = isService ? c.activeStatus : (c.isActive ?? c.activeStatus);
                      return (
                        <Card key={c.id} className={isService ? "" : "border-purple-100"}>
                          <CardContent className="pt-3 pb-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {c.contractNumber && (
                                    <span className={`font-mono text-xs px-2 py-0.5 rounded ${isService ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"}`}>
                                      {c.contractNumber}
                                    </span>
                                  )}
                                  <Badge className={isService ? "bg-blue-100 text-blue-800 text-xs" : "bg-purple-100 text-purple-800 text-xs"}>
                                    {isService ? "Legacy Service" : "Legacy Rental"}
                                  </Badge>
                                  <Badge className={active ? "bg-green-100 text-green-800 text-xs" : "bg-gray-100 text-gray-600 text-xs"}>
                                    {active ? "Active" : "Inactive"}
                                  </Badge>
                                  {isService && c.serviceType && <span className="text-sm font-medium text-gray-800">{c.serviceType}</span>}
                                </div>
                              </div>
                              <div className="flex gap-1 shrink-0">
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

              <Dialog open={showUnifiedForm} onOpenChange={open => { if (!open) { setShowUnifiedForm(false); setEditingUnified(null); } }}>
                <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingUnified ? "Edit Contract" : "New Contract"}</DialogTitle>
                    <DialogDescription>{editingUnified ? "Update contract details." : "Create a contract."}</DialogDescription>
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

            {/* ═══════════════════════ 9. FIELD DIARIES ═══════════════════════ */}
            <TabsContent value="field-diaries" className="mt-4 space-y-4">
              {/* Field diaries section */}
              {clientFieldDiaries.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">Field Diaries ({clientFieldDiaries.length})</h3>
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Diary #</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Technician</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Work Done</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clientFieldDiaries.map(d => (
                          <tr key={d.id} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="px-3 py-2.5 font-mono text-xs font-semibold">{d.diaryNumber}</td>
                            <td className="px-3 py-2.5 text-xs">
                              {d.serviceDate ? format(new Date(d.serviceDate), "dd MMM yyyy") : "—"}
                            </td>
                            <td className="px-3 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">{d.workerName ?? "—"}</td>
                            <td className="px-3 py-2.5 text-xs text-muted-foreground hidden md:table-cell line-clamp-1 max-w-[200px]">
                              {d.workCompleted ?? "—"}
                            </td>
                            <td className="px-3 py-2.5">
                              <Badge variant="outline" className="text-xs">{d.status}</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Treatment reports section */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-sm font-semibold text-muted-foreground">Treatment Reports ({treatmentRpts.length})</h3>
                  <Button size="sm" className="gap-1" onClick={() => {
                    setTrForm({ reportDate: format(new Date(), "yyyy-MM-dd"), customerName: client.name });
                    setTrOpen(true);
                  }}>
                    <Plus className="h-3.5 w-3.5" />New Treatment Report
                  </Button>
                </div>
                {treatmentRpts.length === 0 ? (
                  <EmptyState message="No treatment reports for this client." />
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
                                  {open ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />}
                                  {r.reportNumber && <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{r.reportNumber}</span>}
                                  <span className="font-medium text-sm">{format(new Date(r.reportDate), "dd MMM yyyy")}</span>
                                  {r.serviceType && <Badge variant="outline" className="text-xs">{r.serviceType}</Badge>}
                                  {r.pestType && <span className="text-xs text-muted-foreground">{r.pestType}</span>}
                                  {r.followUpRequired && <Badge className="bg-amber-100 text-amber-800 text-xs">Follow-up</Badge>}
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                                    onClick={e => { e.stopPropagation(); if (confirm("Delete this report?")) deleteTr.mutate(r.id); }}>
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
                              <Row label="Technician"        value={r.technicianName} />
                              {r.followUpRequired && r.followUpDate && <Row label="Follow-up Date" value={r.followUpDate} />}
                              {r.treatmentNotes && <div className="col-span-2"><span className="text-muted-foreground">Notes: </span><span className="whitespace-pre-line">{r.treatmentNotes}</span></div>}
                            </div>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>

              {clientFieldDiaries.length === 0 && treatmentRpts.length === 0 && (
                <EmptyState message="No field diaries or treatment reports for this client." />
              )}
            </TabsContent>

            {/* ═══════════════════════ 10. INVOICES ════════════════════════════ */}
            <TabsContent value="invoices" className="mt-4">
              {clientInvoices.length === 0 ? (
                <EmptyState message="No invoices for this client." />
              ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Invoice #</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Date</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Due</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Paid</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Balance</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientInvoices.map(inv => {
                        const paid = financialSummary?.invoiceBalances?.[inv.id] ?? 0;
                        const balance = Math.max(0, Number(inv.total) - paid);
                        return (
                          <tr key={inv.id} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="px-3 py-2.5 font-mono text-xs font-semibold">{inv.invoiceNumber}</td>
                            <td className="px-3 py-2.5 text-xs hidden sm:table-cell">{format(new Date(inv.issueDate), "dd MMM yyyy")}</td>
                            <td className="px-3 py-2.5 text-xs hidden sm:table-cell">{format(new Date(inv.dueDate), "dd MMM yyyy")}</td>
                            <td className="px-3 py-2.5 text-right font-semibold">R{Number(inv.total).toFixed(2)}</td>
                            <td className="px-3 py-2.5 text-right text-green-700 hidden md:table-cell">
                              {paid > 0 ? `R${paid.toFixed(2)}` : "—"}
                            </td>
                            <td className="px-3 py-2.5 text-right hidden md:table-cell">
                              <span className={balance > 0 ? "text-amber-700 font-semibold" : "text-gray-400"}>
                                {balance > 0 ? `R${balance.toFixed(2)}` : "✓ Paid"}
                              </span>
                            </td>
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
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t">
                      <tr>
                        <td colSpan={3} className="px-3 py-2 text-xs text-muted-foreground font-medium hidden sm:table-cell">
                          {clientInvoices.length} invoice{clientInvoices.length !== 1 ? "s" : ""}
                        </td>
                        <td colSpan={3} className="px-3 py-2 text-xs sm:hidden text-muted-foreground font-medium">
                          {clientInvoices.length} invoice{clientInvoices.length !== 1 ? "s" : ""}
                        </td>
                        <td className="px-3 py-2 text-right text-xs font-bold">
                          R{clientInvoices.reduce((s, i) => s + Number(i.total), 0).toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right text-xs font-bold text-green-700 hidden md:table-cell">
                          R{(financialSummary?.totalPaid ?? 0).toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right text-xs font-bold text-amber-700 hidden md:table-cell">
                          R{(financialSummary?.outstanding ?? 0).toFixed(2)}
                        </td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </TabsContent>

            {/* ═══════════════════════ 11. PAYMENTS ════════════════════════════ */}
            <TabsContent value="payments" className="mt-4">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm text-muted-foreground">{payments.length} payment{payments.length !== 1 ? "s" : ""}</span>
                <Button size="sm" className="gap-1" onClick={openNewPayment}>
                  <Plus className="h-3.5 w-3.5" />Record Payment
                </Button>
              </div>
              {payments.length === 0 ? (
                <EmptyState message="No payments recorded for this client." />
              ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Method</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Reference</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Notes</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map(p => (
                        <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="px-3 py-2.5 text-xs">{format(new Date(p.paymentDate), "dd MMM yyyy")}</td>
                          <td className="px-3 py-2.5 text-right font-semibold text-green-700">R{Number(p.amount).toFixed(2)}</td>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">{p.method}</td>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground hidden md:table-cell">{p.reference ?? "—"}</td>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground hidden lg:table-cell">{p.notes ?? "—"}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEditPayment(p)}>
                                <Edit className="h-3.5 w-3.5 text-gray-400" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                                onClick={() => { if (confirm("Delete this payment?")) deletePayment.mutate(p.id); }}>
                                <Trash2 className="h-3.5 w-3.5 text-red-400" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t">
                      <tr>
                        <td className="px-3 py-2 text-xs text-muted-foreground font-medium">{payments.length} payment{payments.length !== 1 ? "s" : ""}</td>
                        <td className="px-3 py-2 text-right text-xs font-bold text-green-700">
                          R{payments.reduce((s, p) => s + Number(p.amount), 0).toFixed(2)}
                        </td>
                        <td colSpan={4} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </TabsContent>

            {/* ═══════════════════════ 12. DEBTORS ═════════════════════════════ */}
            <TabsContent value="debtors" className="mt-4 space-y-4">
              {/* Credit limit & account status control panel */}
              <Card>
                <CardContent className="pt-4 pb-4">
                  <DebtorsCreditPanel client={client} updateMutation={updateMutation} financialSummary={financialSummary} />
                </CardContent>
              </Card>

              {financialSummary ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "Current (not yet due)", value: financialSummary.aging.current, color: "text-green-700", border: "border-green-100" },
                      { label: "1–30 days overdue",    value: financialSummary.aging.days30,  color: "text-amber-700",  border: "border-amber-100" },
                      { label: "31–60 days overdue",   value: financialSummary.aging.days60,  color: "text-orange-700", border: "border-orange-100" },
                      { label: "60+ days overdue",     value: financialSummary.aging.days90plus, color: "text-red-700", border: "border-red-100" },
                    ].map(b => (
                      <Card key={b.label} className={b.border}>
                        <CardContent className="pt-4 pb-4">
                          <div className="text-xs text-muted-foreground mb-1 leading-tight">{b.label}</div>
                          <div className={`text-xl font-bold ${b.color}`}>{fmt(b.value)}</div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Unpaid invoices breakdown */}
                  {clientInvoices.filter(i => i.status !== "paid" && i.status !== "cancelled").length > 0 ? (
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Invoice #</th>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Due Date</th>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Days Old</th>
                            <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {clientInvoices
                            .filter(i => i.status !== "paid" && i.status !== "cancelled")
                            .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
                            .map(inv => {
                              const daysOld = Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / 86400000);
                              return (
                                <tr key={inv.id} className="border-b last:border-0 hover:bg-gray-50">
                                  <td className="px-3 py-2.5 font-mono text-xs font-semibold">{inv.invoiceNumber}</td>
                                  <td className="px-3 py-2.5 text-xs">{format(new Date(inv.dueDate), "dd MMM yyyy")}</td>
                                  <td className="px-3 py-2.5 text-xs">
                                    <span className={`font-medium ${daysOld > 60 ? "text-red-700" : daysOld > 30 ? "text-orange-700" : daysOld > 0 ? "text-amber-700" : "text-green-700"}`}>
                                      {daysOld <= 0 ? "Current" : `${daysOld}d overdue`}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2.5 text-right font-semibold">R{Number(inv.total).toFixed(2)}</td>
                                  <td className="px-3 py-2.5">
                                    <Badge className={`text-xs ${invStatusColor(inv.status)}`}>{inv.status}</Badge>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                        <tfoot className="bg-gray-50 border-t">
                          <tr>
                            <td colSpan={3} className="px-3 py-2 text-xs font-medium text-muted-foreground">Total Outstanding</td>
                            <td className="px-3 py-2 text-right text-xs font-bold text-amber-700">
                              {fmt(financialSummary.outstanding)}
                            </td>
                            <td />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ) : (
                    <EmptyState message="All invoices paid — no outstanding balance." />
                  )}
                </>
              ) : (
                <EmptyState message="No financial data available." />
              )}
            </TabsContent>

            {/* ═══════════════════════ 13. DOCUMENTS ═══════════════════════════ */}
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
                <strong>File uploads coming soon.</strong> Once ready, you'll be able to upload Treatment Reports, Signed Worksheets, Photos, PODs and other documents directly to each client profile.
              </div>
            </TabsContent>

            {/* ═══════════════════════ 14. ACTIVITY ════════════════════════════ */}
            <TabsContent value="activity" className="mt-4">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm text-muted-foreground">
                  {commNotes.length + treatmentRpts.length + allLeadActivities.length + clientActivityLogs.length} activity items
                </span>
                <Button size="sm" className="gap-1" onClick={() => {
                  setCnForm({ type: "Phone", noteDate: format(new Date(), "yyyy-MM-dd") });
                  setCnOpen(true);
                }}>
                  <Plus className="h-3.5 w-3.5" />Log Activity
                </Button>
              </div>

              {commNotes.length === 0 && treatmentRpts.length === 0 && allLeadActivities.length === 0 && clientActivityLogs.length === 0 ? (
                <EmptyState message="No activity recorded for this client yet." />
              ) : (
                <div className="space-y-2">
                  {/* Merge and sort: comm notes + treatment reports + lead activities + system activity logs */}
                  {[
                    ...commNotes.map(n => ({ type: "note" as const, date: n.noteDate, sortKey: new Date(n.noteDate).getTime(), data: n })),
                    ...treatmentRpts.map(r => ({ type: "report" as const, date: r.reportDate, sortKey: new Date(r.reportDate).getTime(), data: r })),
                    ...allLeadActivities.map(a => ({ type: "lead_activity" as const, date: a.createdAt ?? "", sortKey: new Date(a.createdAt ?? 0).getTime(), data: a })),
                    ...clientActivityLogs.map(l => ({ type: "system_log" as const, date: l.timestamp ?? "", sortKey: new Date(l.timestamp ?? 0).getTime(), data: l })),
                  ]
                    .sort((a, b) => b.sortKey - a.sortKey)
                    .map(item => {
                      if (item.type === "lead_activity") {
                        const a = item.data as LeadActivity;
                        const relatedQuote = clientQuotes.find(q => q.id === a.leadId);
                        return (
                          <Card key={`la-${a.id}`} className="overflow-hidden border-purple-100">
                            <CardContent className="pt-3 pb-3">
                              <div className="flex items-center gap-3 flex-wrap">
                                <Star className="h-4 w-4 text-purple-400 shrink-0" />
                                <span className="font-medium text-sm">
                                  {a.createdAt ? format(new Date(a.createdAt), "dd MMM yyyy") : "—"}
                                </span>
                                <Badge className="bg-purple-100 text-purple-800 text-xs capitalize">
                                  {a.type.replace(/_/g, " ")}
                                </Badge>
                                {relatedQuote?.quoteNumber && (
                                  <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">
                                    {relatedQuote.quoteNumber}
                                  </span>
                                )}
                                <span className="text-sm text-gray-700">{a.description}</span>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      } else if (item.type === "note") {
                        const n = item.data as CommunicationNote;
                        const open = expandedCn === n.id;
                        return (
                          <Card key={`cn-${n.id}`} className="overflow-hidden">
                            <button className="w-full text-left" onClick={() => setExpandedCn(open ? null : n.id)}>
                              <CardContent className="pt-3 pb-3">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-3 flex-wrap min-w-0">
                                    {open ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />}
                                    <span className="font-medium text-sm">{format(new Date(n.noteDate), "dd MMM yyyy")}</span>
                                    {n.noteTime && <span className="text-xs text-muted-foreground">{n.noteTime}</span>}
                                    <Badge variant="outline" className="text-xs"><MessageSquare className="h-2.5 w-2.5 mr-1 inline" />{n.type}</Badge>
                                    {n.contactPerson && <span className="text-xs text-muted-foreground hidden sm:inline">{n.contactPerson}</span>}
                                    {n.confirmationReceived && <Badge className="bg-green-100 text-green-800 text-xs">Confirmed</Badge>}
                                  </div>
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0"
                                    onClick={e => { e.stopPropagation(); if (confirm("Delete this note?")) deleteCn.mutate(n.id); }}>
                                    <Trash2 className="h-3.5 w-3.5 text-red-400" />
                                  </Button>
                                </div>
                                <p className="text-sm text-gray-700 mt-1 pl-7 line-clamp-2">{n.notes}</p>
                              </CardContent>
                            </button>
                            {open && (
                              <div className="border-t bg-gray-50 px-4 py-3 space-y-1.5 text-sm">
                                <Row label="Date"      value={`${n.noteDate}${n.noteTime ? " " + n.noteTime : ""}`} />
                                <Row label="Type"      value={n.type} />
                                <Row label="Contact"   value={n.contactPerson} />
                                <Row label="Confirmed" value={n.confirmationReceived ? "Yes" : "No"} />
                                {n.createdBy && <Row label="Logged by" value={n.createdBy} />}
                                <div className="pt-1"><span className="text-muted-foreground">Notes: </span><span className="whitespace-pre-line">{n.notes}</span></div>
                              </div>
                            )}
                          </Card>
                        );
                      } else if (item.type === "system_log") {
                        const l = item.data as ActivityLogEntry;
                        return (
                          <Card key={`al-${l.id}`} className="overflow-hidden border-gray-100 bg-gray-50/50">
                            <CardContent className="pt-3 pb-3">
                              <div className="flex items-center gap-3 flex-wrap">
                                <span className="text-base">🔔</span>
                                <span className="font-medium text-sm text-gray-700">{l.action}</span>
                                {l.resource && <Badge variant="outline" className="text-xs capitalize">{l.resource}</Badge>}
                                {l.details && <span className="text-xs text-muted-foreground">{l.details}</span>}
                                {l.timestamp && (
                                  <span className="text-xs text-muted-foreground ml-auto">
                                    {format(new Date(l.timestamp), "dd MMM yyyy HH:mm")}
                                  </span>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      } else {
                        const r = item.data as TreatmentReport;
                        return (
                          <Card key={`tr-${r.id}`} className="overflow-hidden border-teal-100">
                            <CardContent className="pt-3 pb-3">
                              <div className="flex items-center gap-3 flex-wrap">
                                <FlaskConical className="h-4 w-4 text-teal-500 shrink-0" />
                                <span className="font-medium text-sm">{format(new Date(r.reportDate), "dd MMM yyyy")}</span>
                                <Badge className="bg-teal-100 text-teal-800 text-xs">Treatment Report</Badge>
                                {r.reportNumber && <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{r.reportNumber}</span>}
                                {r.serviceType && <span className="text-xs text-muted-foreground">{r.serviceType}</span>}
                                {r.pestType && <span className="text-xs text-muted-foreground">· {r.pestType}</span>}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      }
                    })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* ═══ Edit Client Dialog ══════════════════════════════════════════════ */}
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

      {/* ═══ Contact Dialog ══════════════════════════════════════════════════ */}
      <Dialog open={contactOpen} onOpenChange={o => { setContactOpen(o); if (!o) { setContactForm({}); setEditingContact(null); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingContact ? "Edit Contact" : "Add Contact"}</DialogTitle>
            <DialogDescription>{editingContact ? "Update contact details." : `Add a contact for ${client.name}`}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-1">
            <div>
              <Label>First Name *</Label>
              <Input value={contactForm.firstName ?? ""} onChange={e => setContactForm(f => ({ ...f, firstName: e.target.value }))} />
            </div>
            <div>
              <Label>Last Name</Label>
              <Input value={contactForm.lastName ?? ""} onChange={e => setContactForm(f => ({ ...f, lastName: e.target.value }))} />
            </div>
            <div>
              <Label>Job Title</Label>
              <Input value={contactForm.jobTitle ?? ""} onChange={e => setContactForm(f => ({ ...f, jobTitle: e.target.value }))} placeholder="e.g. Facilities Manager" />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={contactForm.email ?? ""} onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={contactForm.phone ?? ""} onChange={e => setContactForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <Label>Mobile</Label>
              <Input value={contactForm.mobile ?? ""} onChange={e => setContactForm(f => ({ ...f, mobile: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <Label>Notes</Label>
              <Textarea rows={2} value={contactForm.notes ?? ""} onChange={e => setContactForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <Label>Preferred Contact Method</Label>
              <select
                className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={contactForm.preferredContact ?? "Email"}
                onChange={e => setContactForm(f => ({ ...f, preferredContact: e.target.value }))}
              >
                {["Email","Phone","Mobile","WhatsApp"].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Switch checked={!!contactForm.isPrimary} onCheckedChange={v => setContactForm(f => ({ ...f, isPrimary: v }))} />
              <Label className="font-normal cursor-pointer">Primary Contact</Label>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Switch checked={!!contactForm.isBilling} onCheckedChange={v => setContactForm(f => ({ ...f, isBilling: v }))} />
              <Label className="font-normal cursor-pointer">Billing Contact</Label>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Switch checked={!!contactForm.isSite} onCheckedChange={v => setContactForm(f => ({ ...f, isSite: v }))} />
              <Label className="font-normal cursor-pointer">Site Contact</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContactOpen(false)}>Cancel</Button>
            <Button onClick={submitContact} disabled={createContact.isPending || updateContact.isPending}>
              {(createContact.isPending || updateContact.isPending) ? "Saving…" : "Save Contact"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Site Dialog ═════════════════════════════════════════════════════ */}
      <Dialog open={siteOpen} onOpenChange={o => { setSiteOpen(o); if (!o) { setSiteForm({ isActive: true }); setEditingSite(null); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSite ? "Edit Site" : "Add Site"}</DialogTitle>
            <DialogDescription>{editingSite ? "Update site details." : `Add a service site for ${client.name}`}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-1">
            <div className="col-span-2">
              <Label>Site Name *</Label>
              <Input value={siteForm.siteName ?? ""} onChange={e => setSiteForm(f => ({ ...f, siteName: e.target.value }))} placeholder="e.g. Head Office, Warehouse, Branch 1" />
            </div>
            <div>
              <Label>Street Number</Label>
              <Input value={siteForm.streetNumber ?? ""} onChange={e => setSiteForm(f => ({ ...f, streetNumber: e.target.value }))} />
            </div>
            <div>
              <Label>Street Name</Label>
              <Input value={siteForm.streetName ?? ""} onChange={e => setSiteForm(f => ({ ...f, streetName: e.target.value }))} />
            </div>
            <div>
              <Label>Suburb</Label>
              <Input value={siteForm.suburb ?? ""} onChange={e => setSiteForm(f => ({ ...f, suburb: e.target.value }))} />
            </div>
            <div>
              <Label>City</Label>
              <Input value={siteForm.city ?? ""} onChange={e => setSiteForm(f => ({ ...f, city: e.target.value }))} />
            </div>
            <div>
              <Label>Province</Label>
              <Input value={siteForm.province ?? ""} onChange={e => setSiteForm(f => ({ ...f, province: e.target.value }))} />
            </div>
            <div>
              <Label>Postal Code</Label>
              <Input value={siteForm.postalCode ?? ""} onChange={e => setSiteForm(f => ({ ...f, postalCode: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <Label>GPS / Maps Link</Label>
              <Input value={siteForm.gpsLink ?? siteForm.googleMapsLink ?? ""} onChange={e => setSiteForm(f => ({ ...f, gpsLink: e.target.value, googleMapsLink: e.target.value }))} placeholder="https://maps.google.com/..." />
            </div>
            <div>
              <Label>Site Contact Name</Label>
              <Input value={siteForm.contactName ?? ""} onChange={e => setSiteForm(f => ({ ...f, contactName: e.target.value }))} />
            </div>
            <div>
              <Label>Site Contact Phone</Label>
              <Input value={siteForm.contactPhone ?? ""} onChange={e => setSiteForm(f => ({ ...f, contactPhone: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <Label>Notes</Label>
              <Textarea rows={2} value={siteForm.notes ?? ""} onChange={e => setSiteForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Switch checked={!!siteForm.isPrimary} onCheckedChange={v => setSiteForm(f => ({ ...f, isPrimary: v }))} />
              <Label className="font-normal cursor-pointer">Primary Site</Label>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Switch checked={siteForm.isActive !== false} onCheckedChange={v => setSiteForm(f => ({ ...f, isActive: v }))} />
              <Label className="font-normal cursor-pointer">Active Site</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSiteOpen(false)}>Cancel</Button>
            <Button onClick={submitSite} disabled={createSite.isPending || updateSite.isPending}>
              {(createSite.isPending || updateSite.isPending) ? "Saving…" : "Save Site"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Payment Dialog ══════════════════════════════════════════════════ */}
      <Dialog open={paymentOpen} onOpenChange={o => { setPaymentOpen(o); if (!o) { setPaymentForm({ method: "Bank Transfer", paymentDate: format(new Date(), "yyyy-MM-dd") }); setEditingPayment(null); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPayment ? "Edit Payment" : "Record Payment"}</DialogTitle>
            <DialogDescription>{editingPayment ? "Update payment details." : `Record a payment from ${client.name}`}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-1">
            <div>
              <Label>Payment Date *</Label>
              <Input type="date" value={paymentForm.paymentDate ?? ""} onChange={e => setPaymentForm(f => ({ ...f, paymentDate: e.target.value }))} />
            </div>
            <div>
              <Label>Amount (R) *</Label>
              <Input type="number" step="0.01" min="0" value={paymentForm.amount ?? ""} onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div>
              <Label>Payment Method *</Label>
              <Select value={paymentForm.method ?? "Bank Transfer"} onValueChange={v => setPaymentForm(f => ({ ...f, method: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reference / Proof of Payment</Label>
              <Input value={paymentForm.reference ?? ""} onChange={e => setPaymentForm(f => ({ ...f, reference: e.target.value }))} placeholder="e.g. EFT ref #" />
            </div>
            <div>
              <Label>Linked Invoice</Label>
              <Select value={paymentForm.invoiceId ?? "_none"} onValueChange={v => setPaymentForm(f => ({ ...f, invoiceId: v === "_none" ? undefined : v }))}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— None —</SelectItem>
                  {clientInvoices.filter(i => i.status !== "paid").map(i => (
                    <SelectItem key={i.id} value={i.id}>{i.invoiceNumber} — R{Number(i.total).toFixed(2)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Allocated By</Label>
              <Input value={paymentForm.allocatedBy ?? ""} onChange={e => setPaymentForm(f => ({ ...f, allocatedBy: e.target.value }))} placeholder="Name of person recording" />
            </div>
            <div className="col-span-2">
              <Label>Notes</Label>
              <Textarea rows={2} value={paymentForm.notes ?? ""} onChange={e => setPaymentForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentOpen(false)}>Cancel</Button>
            <Button onClick={submitPayment} disabled={createPayment.isPending || updatePayment.isPending}>
              {(createPayment.isPending || updatePayment.isPending) ? "Saving…" : "Save Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ New Treatment Report Dialog ════════════════════════════════════ */}
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
              <Input value={trForm.serviceType ?? ""} onChange={e => setTrForm(f => ({ ...f, serviceType: e.target.value }))} />
            </div>
            <div>
              <Label>Pest Type</Label>
              <Input value={trForm.pestType ?? ""} onChange={e => setTrForm(f => ({ ...f, pestType: e.target.value }))} placeholder="e.g. Cockroach, Rodent" />
            </div>
            <div>
              <Label>Treatment Type</Label>
              <Input value={trForm.treatmentType ?? ""} onChange={e => setTrForm(f => ({ ...f, treatmentType: e.target.value }))} placeholder="e.g. Spray, Bait" />
            </div>
            <div>
              <Label>Site Area</Label>
              <Input value={trForm.siteArea ?? ""} onChange={e => setTrForm(f => ({ ...f, siteArea: e.target.value }))} />
            </div>
            <div>
              <Label>Chemicals Used</Label>
              <Input value={trForm.chemicalsUsed ?? ""} onChange={e => setTrForm(f => ({ ...f, chemicalsUsed: e.target.value }))} />
            </div>
            <div>
              <Label>Quantity Used</Label>
              <Input value={trForm.quantityUsed ?? ""} onChange={e => setTrForm(f => ({ ...f, quantityUsed: e.target.value }))} placeholder="e.g. 500ml" />
            </div>
            <div>
              <Label>Technician</Label>
              <Select value={trForm.technicianId ?? "_none"} onValueChange={v => {
                const w = allWorkers.find(w => w.id === v);
                setTrForm(f => ({ ...f, technicianId: v === "_none" ? undefined : v, technicianName: w?.name }));
              }}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
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

      {/* ═══ Comm Note Dialog ════════════════════════════════════════════════ */}
      <Dialog open={cnOpen} onOpenChange={o => { setCnOpen(o); if (!o) setCnForm({ type: "Phone", noteDate: format(new Date(), "yyyy-MM-dd") }); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Log Activity / Communication Note</DialogTitle>
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
