import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Phone, Mail, MapPin, Clock, ChevronRight, Briefcase,
  XCircle, ArrowRight, Calendar, User, Building2, AlertCircle,
  Send, Search, X, Megaphone, Download, BookOpen, Flag,
  PhoneCall, CalendarClock, ClipboardCheck, FileText, UserCheck, Link2,
} from "lucide-react";
import { useLocation } from "wouter";
import DocumentForm from "@/components/forms/document-form";
import { type DocumentFormValues } from "@/components/forms/document-form-schema";
import type { QuoteSubmission, Worker, Department } from "@shared/schema";
import {
  ORIGINATION_OPTIONS, ORIGINATION_LABELS,
  LEAD_STATUSES, LEAD_STATUS_LABELS, NEEDS_REVIEW_STATUS, normalizeLeadStatus,
} from "@shared/schema";
import type { LeadStatus } from "@shared/schema";
import { exportLeads } from "@/lib/data-export";

// ─── types ───────────────────────────────────────────────────────────────────

const SERVICE_LABELS: Record<string, string> = {
  pest_control: "Pest Control",
  sanitary_bins: "Sanitary Bins",
  washroom: "Washroom",
  deep_cleaning: "Deep Cleaning",
};

const LEAD_TYPE_OPTIONS = ["Once-off","Contract","Rental","Outright Purchase","Unknown"];
const PRIORITY_OPTIONS = [
  { value: "low",    label: "Low",    cls: "bg-gray-100 text-gray-600" },
  { value: "medium", label: "Medium", cls: "bg-blue-100 text-blue-700" },
  { value: "high",   label: "High",   cls: "bg-red-100 text-red-700" },
];

// The 7 canonical board columns, in pipeline order.
const PIPELINE: { status: LeadStatus; label: string; color: string; dotColor: string }[] = [
  { status: "new",                label: "New",                color: "bg-blue-50 border-blue-200",     dotColor: "bg-blue-500"   },
  { status: "contacted",          label: "Contacted",          color: "bg-indigo-50 border-indigo-200", dotColor: "bg-indigo-500" },
  { status: "appointment_booked", label: "Appointment Booked", color: "bg-purple-50 border-purple-200", dotColor: "bg-purple-500" },
  { status: "quote_required",     label: "Quote Required",     color: "bg-amber-50 border-amber-200",   dotColor: "bg-amber-500"  },
  { status: "quoted",             label: "Quoted",              color: "bg-yellow-50 border-yellow-200", dotColor: "bg-yellow-500" },
  { status: "lost",               label: "Lost",                color: "bg-red-50 border-red-200",       dotColor: "bg-red-500"    },
  { status: "converted",          label: "Converted",           color: "bg-green-50 border-green-200",   dotColor: "bg-green-500"  },
];

// Statuses still "in play" for staleness warnings — lost/converted are terminal.
const STALE_STATUSES = new Set(["new","contacted","appointment_booked","quote_required","quoted"]);

// Stale-lead thresholds: days without advancement triggers a warning
const STALE_DAYS: Record<string, number> = { high: 2, medium: 5, low: 7 };

function getLeadStatus(l: QuoteSubmission): LeadStatus | "needs_review" {
  return normalizeLeadStatus(l.status, (l as any).stage);
}

function isStale(lead: QuoteSubmission): boolean {
  const status = getLeadStatus(lead);
  if (!STALE_STATUSES.has(status)) return false;
  const days = Math.floor((Date.now() - new Date(lead.submittedAt ?? 0).getTime()) / 86400000);
  const threshold = STALE_DAYS[(lead as any).priority ?? "medium"] ?? 5;
  return days > threshold;
}

const YES_NO_OPTIONS = [
  { value: "yes",     label: "Yes" },
  { value: "no",      label: "No" },
  { value: "unknown", label: "Unknown / Not asked" },
];

const CLIENT_FLAG_OPTIONS = [
  { value: "bad_payer",         label: "Bad Payer" },
  { value: "high_profile",      label: "High Profile" },
  { value: "price_sensitive",   label: "Price Sensitive" },
  { value: "vip",               label: "VIP" },
  { value: "requires_approval", label: "Requires Management Approval" },
  { value: "competitor_risk",   label: "Competitor Risk" },
  { value: "do_not_contact",    label: "Do Not Contact" },
];

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
  const [, navigate] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showNewLead, setShowNewLead] = useState(false);
  const [quoteLead, setQuoteLead] = useState<QuoteSubmission | null>(null);
  const [notesLead, setNotesLead] = useState<QuoteSubmission | null>(null);
  const [notesText, setNotesText] = useState("");
  const [quotePreview, setQuotePreview] = useState(false);

  // Filters
  const [search, setSearch]             = useState("");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [salespersonFilter, setSalespersonFilter] = useState("all");
  const [originationFilter, setOriginationFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: leads = [], isLoading } = useQuery<QuoteSubmission[]>({ queryKey: ["/api/quote-submissions"] });
  const { data: workers = [] } = useQuery<Worker[]>({ queryKey: ["/api/workers"] });
  const { data: departments = [] } = useQuery<Department[]>({ queryKey: ["/api/departments"] });
  const { data: clients = [] } = useQuery<any[]>({ queryKey: ["/api/clients"] });

  // ── mutations ──
  const createLead = useMutation({
    mutationFn: (data: DocumentFormValues) => apiRequest("POST", "/api/quote-submissions", {
      status: "new",
      companyName: data.companyName,
      contactPerson: data.contactPerson,
      email: data.email,
      phone: data.phone,
      serviceType: data.serviceType || "pest_control",
      description: data.lineItems.map(i => `${i.description} (x${i.quantity})`).join("; ") || "See line items",
      address: [data.streetNumber, data.streetName, data.area, data.town].filter(Boolean).join(", "),
      preferredContactMethod: data.preferredContactMethod || "phone",
      notes: data.notes,
      assignedTo: data.assignedTo && data.assignedTo !== "unassigned" ? data.assignedTo : null,
      lineItemsJson: JSON.stringify(data.lineItems),
      quoteAmount: data.totalAmount,
      origination: data.origination,
      originationOther: data.origination === "other" ? (data.originationOther || null) : null,
      clientId: data.clientId || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quote-submissions"] });
      setShowNewLead(false);
      toast({ title: "Lead created", description: "New lead added to the pipeline." });
    },
    onError: (error: any) => {
      let description = "Failed to create lead.";
      try {
        const raw = String(error?.message ?? "");
        // apiRequest throws "STATUS: <details>" — strip the status prefix
        const body = raw.replace(/^\d+:\s*/, "");
        // Try to parse Zod-style errors
        const parsed = JSON.parse(body);
        if (Array.isArray(parsed) && parsed[0]?.message) {
          const field = parsed[0].path?.join(".") || "field";
          description = `${parsed[0].message} (${field})`;
        } else if (parsed?.details) {
          description = parsed.details;
        } else if (parsed?.error) {
          description = parsed.error;
        }
      } catch {
        if (error?.message) description = error.message;
      }
      console.error("[createLead] error:", error?.message);
      toast({ title: "Error creating lead", description, variant: "destructive" });
    },
  });

  const advanceLead = useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: string; notes?: string }) =>
      apiRequest("PATCH", `/api/quote-submissions/${id}`, { status, ...(notes ? { notes } : {}) }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/quote-submissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accepted-workflows"] });
      if (variables.status === "converted") {
        toast({
          title: "Lead converted! 🎉",
          description: "Workflow created — go to Accepted Work to manage the next steps.",
        });
      } else {
        toast({ title: "Lead updated" });
      }
    },
    onError: () => toast({ title: "Error", description: "Failed to update lead.", variant: "destructive" }),
  });

  const markSiteVisitDone = useMutation({
    mutationFn: (id: string) =>
      apiRequest("PATCH", `/api/quote-submissions/${id}`, { siteVisitDone: true, status: "quote_required" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quote-submissions"] });
      toast({ title: "Site visit marked done", description: "Lead moved to Quote Required." });
    },
    onError: () => toast({ title: "Error", description: "Failed to update lead.", variant: "destructive" }),
  });

  // State for the duplicate-client dialog
  const [dupDialog, setDupDialog] = useState<{
    open: boolean;
    leadId: string;
    duplicates: Array<{ id: string; name: string; email: string | null; phone: string | null }>;
  }>({ open: false, leadId: "", duplicates: [] });

  const createClientProfile = useMutation({
    mutationFn: async ({ id, body }: { id: string; body?: Record<string, any> }) => {
      const res = await fetch(`/api/quote-submissions/${id}/convert-to-client`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      if (res.status === 409) {
        const data = await res.json();
        if (data.code === "DUPLICATE_FOUND") return { _dupFound: true, leadId: id, duplicates: data.duplicates };
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Failed to create client profile");
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data?._dupFound) {
        setDupDialog({ open: true, leadId: data.leadId, duplicates: data.duplicates });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/quote-submissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      if (data?.alreadyLinked) {
        toast({ title: "Already linked", description: "This lead is already linked to a client profile." });
      } else {
        toast({ title: "Client profile created", description: "The lead stays in the pipeline. Create a quote to move it forward." });
      }
    },
    onError: (err: any) => toast({ title: "Error", description: err?.message ?? "Failed to create client profile.", variant: "destructive" }),
  });

  const saveLeadEdits = useMutation({
    mutationFn: (payload: Record<string, any>) =>
      apiRequest("PATCH", `/api/quote-submissions/${payload.id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quote-submissions"] });
      setNotesLead(null);
      toast({ title: "Lead updated" });
    },
  });

  const [editOrigination, setEditOrigination] = useState<string>("other");
  const [editOriginationOther, setEditOriginationOther] = useState<string>("");
  const [editStatus, setEditStatus] = useState<string>("");
  const [editPriority, setEditPriority] = useState<string>("");
  const [editLeadType, setEditLeadType] = useState<string>("");
  const [editTradingName, setEditTradingName] = useState<string>("");
  const [editInternalNotes, setEditInternalNotes] = useState<string>("");
  // New site detail fields
  const [editAfterHours, setEditAfterHours] = useState<string>("");
  const [editExistingContract, setEditExistingContract] = useState<string>("");
  const [editCompetitorName, setEditCompetitorName] = useState<string>("");
  const [editCancellationNotice, setEditCancellationNotice] = useState<string>("");
  const [editNoticePeriod, setEditNoticePeriod] = useState<string>("");
  const [editEarliestStartDate, setEditEarliestStartDate] = useState<string>("");
  const [editExpectedServiceTime, setEditExpectedServiceTime] = useState<string>("");
  const [editClientFlags, setEditClientFlags] = useState<string[]>([]);

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

  const salesWorkers = workers.filter(w => w.departmentId === "div-5" && w.isActive !== false);

  const filteredLeads = useMemo(() => {
    const q = search.toLowerCase().trim();
    return leads.filter(l => {
      const status = getLeadStatus(l);
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (q && !l.companyName.toLowerCase().includes(q) && !(l.contactPerson ?? "").toLowerCase().includes(q) && !((l as any).tradingName ?? "").toLowerCase().includes(q)) return false;
      if (serviceFilter !== "all" && l.serviceType !== serviceFilter) return false;
      if (salespersonFilter !== "all" && l.assignedTo !== salespersonFilter) return false;
      if (originationFilter !== "all" && (l.origination ?? "other") !== originationFilter) return false;
      return true;
    });
  }, [leads, search, serviceFilter, salespersonFilter, originationFilter, statusFilter]);

  // Board columns: the 7 canonical statuses, plus a fallback "Needs Review"
  // column whenever any lead has an unrecognised status — so nothing is ever
  // silently hidden.
  const hasNeedsReview = filteredLeads.some(l => getLeadStatus(l) === NEEDS_REVIEW_STATUS);
  const pipelineColumns = useMemo(() => {
    const base = statusFilter === "all" ? PIPELINE : PIPELINE.filter(c => c.status === statusFilter);
    if (hasNeedsReview && (statusFilter === "all" || statusFilter === NEEDS_REVIEW_STATUS)) {
      return [...base, { status: NEEDS_REVIEW_STATUS as any, label: "Other / Needs Review", color: "bg-gray-100 border-gray-300", dotColor: "bg-gray-500" }];
    }
    return base;
  }, [statusFilter, hasNeedsReview]);

  const hasFilters = search || serviceFilter !== "all" || salespersonFilter !== "all" || originationFilter !== "all" || statusFilter !== "all";
  const clearFilters = () => { setSearch(""); setServiceFilter("all"); setSalespersonFilter("all"); setOriginationFilter("all"); setStatusFilter("all"); };

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
        {[
          { label: "Lead", cls: "bg-blue-100 text-blue-700" },
          { label: "Quote", cls: "bg-yellow-100 text-yellow-700" },
          { label: "Job", cls: "bg-green-100 text-green-700" },
          { label: "Invoice", cls: "bg-teal-100 text-teal-700" },
        ].map((step, i, arr) => (
          <span key={step.label} className="flex items-center gap-1 whitespace-nowrap">
            <span className={`px-2 py-0.5 rounded-full font-medium ${step.cls}`}>{step.label}</span>
            {i < arr.length - 1 && <ArrowRight className="h-3 w-3 text-gray-400" />}
          </span>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search company or contact..."
            className="pl-8 h-8 text-sm"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Service type */}
        <Select value={serviceFilter} onValueChange={setServiceFilter}>
          <SelectTrigger className="h-8 text-sm w-40">
            <SelectValue placeholder="All Services" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Services</SelectItem>
            {Object.entries(SERVICE_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Salesperson */}
        <Select value={salespersonFilter} onValueChange={setSalespersonFilter}>
          <SelectTrigger className="h-8 text-sm w-44">
            <SelectValue placeholder="All Salespersons" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Salespersons</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {workers.filter(w => w.departmentId === "div-5" && w.isActive !== false).map(w => (
              <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Origination */}
        <Select value={originationFilter} onValueChange={setOriginationFilter}>
          <SelectTrigger className="h-8 text-sm w-44">
            <SelectValue placeholder="All Originations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Originations</SelectItem>
            {ORIGINATION_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 text-sm w-48">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {LEAD_STATUSES.map(s => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
            {hasNeedsReview && <SelectItem value={NEEDS_REVIEW_STATUS}>Other / Needs Review</SelectItem>}
          </SelectContent>
        </Select>

        {/* Export */}
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1"
          onClick={() => {
            try {
              exportLeads(filteredLeads);
              toast({ title: "Leads exported", description: `${filteredLeads.length} lead(s) downloaded as CSV.` });
            } catch (e: any) {
              toast({ title: "Nothing to export", description: e?.message ?? "No leads match the current filters.", variant: "destructive" });
            }
          }}
        >
          <Download className="h-3.5 w-3.5" /> Export
        </Button>

        {/* Clear filters */}
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded border border-red-200 hover:border-red-300 bg-red-50"
          >
            <X className="h-3 w-3" /> Clear filters
          </button>
        )}

        <span className="text-xs text-gray-400 ml-auto">
          {filteredLeads.length} lead{filteredLeads.length !== 1 ? "s" : ""}{hasFilters ? " (filtered)" : ""}
        </span>
      </div>

      {/* Kanban columns */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading pipeline...</div>
      ) : (
        <div className={`grid gap-4 items-start ${pipelineColumns.length <= 2 ? "grid-cols-1 sm:grid-cols-2" : pipelineColumns.length === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"}`}>
          {pipelineColumns.map(col => {
            const colLeads = filteredLeads.filter(l => getLeadStatus(l) === col.status)
              .sort((a, b) => new Date(b.submittedAt ?? 0).getTime() - new Date(a.submittedAt ?? 0).getTime());
            return (
              <div key={col.status} className={`rounded-xl border ${col.color} p-3 min-h-[200px]`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${col.dotColor}`} />
                    <span className="text-sm font-semibold text-gray-700">{col.label}</span>
                    {col.status === NEEDS_REVIEW_STATUS && <AlertCircle className="h-3.5 w-3.5 text-gray-500" />}
                  </div>
                  <Badge variant="outline" className="text-xs">{colLeads.length}</Badge>
                </div>
                <div className="space-y-2">
                  {colLeads.map(lead => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      workers={workers}
                      onMarkContacted={() => advanceLead.mutate({ id: lead.id, status: "contacted" })}
                      onBookAppointment={() => {
                        const p = new URLSearchParams({
                          clientName: lead.companyName,
                          contactPerson: lead.contactPerson,
                          phone: lead.phone,
                          siteAddress: lead.address || "",
                          leadId: lead.id,
                          appointmentType: "site_visit",
                        });
                        navigate(`/sales-diary?${p.toString()}`);
                      }}
                      onMarkSiteVisitDone={() => markSiteVisitDone.mutate(lead.id)}
                      onCreateQuote={() => { setQuoteLead(lead); setQuotePreview(false); }}
                      onMarkLost={() => advanceLead.mutate({ id: lead.id, status: "lost" })}
                      onCreateClientProfile={() => createClientProfile.mutate({ id: lead.id })}
                      onNotes={() => {
                        setNotesLead(lead);
                        setNotesText(lead.notes ?? "");
                        setEditOrigination(lead.origination ?? "other");
                        setEditOriginationOther((lead as any).originationOther ?? "");
                        setEditStatus(getLeadStatus(lead));
                        setEditPriority((lead as any).priority ?? "medium");
                        setEditLeadType((lead as any).leadType ?? "");
                        setEditTradingName((lead as any).tradingName ?? "");
                        setEditInternalNotes((lead as any).internalNotes ?? "");
                        setEditAfterHours((lead as any).afterHoursRequired ?? "");
                        setEditExistingContract((lead as any).existingCompetitorContract ?? "");
                        setEditCompetitorName((lead as any).competitorName ?? "");
                        setEditCancellationNotice((lead as any).cancellationNoticeRequired ?? "");
                        setEditNoticePeriod((lead as any).noticePeriod ?? "");
                        setEditEarliestStartDate((lead as any).earliestStartDate ?? "");
                        setEditExpectedServiceTime((lead as any).expectedServiceTime ?? "");
                        try { setEditClientFlags(JSON.parse((lead as any).clientFlags ?? "[]") ?? []); } catch { setEditClientFlags([]); }
                      }}
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
          <DialogTitle className="sr-only">New Lead</DialogTitle>
          <DocumentForm
            docType="lead"
            salesWorkers={salesWorkers}
            clients={clients}
            isPending={createLead.isPending}
            onSubmit={d => createLead.mutate(d)}
            onCancel={() => setShowNewLead(false)}
          />
        </DialogContent>
      </Dialog>

      {/* ── Create Quote dialog ── */}
      {quoteLead && (
        <Dialog open={!!quoteLead} onOpenChange={() => { setQuoteLead(null); setQuotePreview(false); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
            <DialogTitle className="sr-only">Create Quote</DialogTitle>
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
              defaultValues={(() => {
                try {
                  const items = quoteLead.lineItemsJson ? JSON.parse(quoteLead.lineItemsJson) : null;
                  if (items && items.length > 0) return { lineItems: items };
                } catch {}
                return undefined;
              })()}
              isPending={sendQuote.isPending}
              submitLabel={`Send Quote to ${quoteLead.contactPerson}`}
              onSubmit={d => sendQuote.mutate(d)}
              onCancel={() => { setQuoteLead(null); setQuotePreview(false); }}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* ── Edit Lead dialog ── */}
      {notesLead && (
        <Dialog open={!!notesLead} onOpenChange={() => setNotesLead(null)}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Lead — {notesLead.companyName}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Trading name */}
              <div>
                <label className="text-sm font-medium block mb-1">Trading Name <span className="text-xs text-gray-400">(if different from company)</span></label>
                <Input value={editTradingName} onChange={e => setEditTradingName(e.target.value)} placeholder="e.g. The Corner Café t/a ABC Holdings" className="h-9 text-sm" />
              </div>

              {/* Status + Priority row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium block mb-1">Status</label>
                  <Select value={editStatus} onValueChange={setEditStatus}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select status" /></SelectTrigger>
                    <SelectContent>
                      {LEAD_STATUSES.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">Priority</label>
                  <Select value={editPriority} onValueChange={setEditPriority}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Priority" /></SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map(p => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Lead type */}
              <div>
                <label className="text-sm font-medium block mb-1">Lead Type</label>
                <Select value={editLeadType} onValueChange={setEditLeadType}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {LEAD_TYPE_OPTIONS.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Origination */}
              <div>
                <label className="text-sm font-medium block mb-1">
                  Origination <span className="text-red-500">*</span>
                </label>
                <Select value={editOrigination} onValueChange={setEditOrigination}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="How did they find us?" />
                  </SelectTrigger>
                  <SelectContent>
                    {ORIGINATION_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {editOrigination === "other" && (
                <div>
                  <label className="text-sm font-medium block mb-1">Other Origination Details</label>
                  <Input value={editOriginationOther} onChange={e => setEditOriginationOther(e.target.value)} placeholder="e.g. Trade show, magazine ad..." className="h-9 text-sm" />
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="text-sm font-medium block mb-1">Client-facing Notes</label>
                <Textarea rows={3} value={notesText} onChange={e => setNotesText(e.target.value)} placeholder="Call summary, requirements, etc." />
              </div>

              {/* Internal notes */}
              <div>
                <label className="text-sm font-medium block mb-1">Internal Notes <span className="text-xs text-gray-400">(staff only)</span></label>
                <Textarea rows={2} value={editInternalNotes} onChange={e => setEditInternalNotes(e.target.value)} placeholder="Margin notes, concerns, strategy..." />
              </div>

              {/* ── Site & Competitor Details ── */}
              <div className="border-t pt-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Site & Competitor Details</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium block mb-1">After-hours Required?</label>
                    <Select value={editAfterHours || "_none"} onValueChange={v => setEditAfterHours(v === "_none" ? "" : v)}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select…" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Not specified</SelectItem>
                        {YES_NO_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1">Existing Competitor Contract?</label>
                    <Select value={editExistingContract || "_none"} onValueChange={v => setEditExistingContract(v === "_none" ? "" : v)}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select…" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Not specified</SelectItem>
                        {YES_NO_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {(editExistingContract === "yes") && (
                    <>
                      <div>
                        <label className="text-sm font-medium block mb-1">Competitor Name</label>
                        <Input value={editCompetitorName} onChange={e => setEditCompetitorName(e.target.value)} className="h-9 text-sm" placeholder="e.g. ABC Services" />
                      </div>
                      <div>
                        <label className="text-sm font-medium block mb-1">Cancellation Notice Required?</label>
                        <Select value={editCancellationNotice || "_none"} onValueChange={v => setEditCancellationNotice(v === "_none" ? "" : v)}>
                          <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select…" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">Not specified</SelectItem>
                            {YES_NO_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      {editCancellationNotice === "yes" && (
                        <div className="col-span-2">
                          <label className="text-sm font-medium block mb-1">Notice Period</label>
                          <Input value={editNoticePeriod} onChange={e => setEditNoticePeriod(e.target.value)} className="h-9 text-sm" placeholder="e.g. 30 days, 1 month, 3 months" />
                        </div>
                      )}
                    </>
                  )}
                  <div>
                    <label className="text-sm font-medium block mb-1">Earliest Start Date</label>
                    <Input type="date" value={editEarliestStartDate} onChange={e => setEditEarliestStartDate(e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1">Expected Service Frequency</label>
                    <Input value={editExpectedServiceTime} onChange={e => setEditExpectedServiceTime(e.target.value)} className="h-9 text-sm" placeholder="e.g. Monthly, Bi-weekly" />
                  </div>
                </div>
              </div>

              {/* ── Client Flags ── */}
              <div className="border-t pt-3">
                <label className="text-sm font-medium block mb-2">
                  <Flag className="inline h-3.5 w-3.5 mr-1 text-amber-500" />Client Flags
                </label>
                <div className="flex flex-wrap gap-2">
                  {CLIENT_FLAG_OPTIONS.map(f => {
                    const active = editClientFlags.includes(f.value);
                    return (
                      <button
                        key={f.value}
                        type="button"
                        onClick={() => setEditClientFlags(prev =>
                          active ? prev.filter(x => x !== f.value) : [...prev, f.value]
                        )}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${active ? "bg-amber-100 border-amber-400 text-amber-800 font-semibold" : "bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-400"}`}
                      >
                        {f.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setNotesLead(null)}>Cancel</Button>
              <Button
                onClick={() => {
                  const validValues = ORIGINATION_OPTIONS.map(o => o.value) as string[];
                  if (!editOrigination || !validValues.includes(editOrigination)) {
                    toast({ title: "Origination required", description: "Please select how this lead came in.", variant: "destructive" });
                    return;
                  }
                  if (editOrigination === "other" && !editOriginationOther.trim()) {
                    toast({ title: "Details required", description: "Please describe the origination.", variant: "destructive" });
                    return;
                  }
                  saveLeadEdits.mutate({
                    id: notesLead.id,
                    notes: notesText,
                    origination: editOrigination,
                    originationOther: editOrigination === "other" ? editOriginationOther.trim() : null,
                    status: editStatus || undefined,
                    priority: editPriority || undefined,
                    leadType: editLeadType || undefined,
                    tradingName: editTradingName || undefined,
                    internalNotes: editInternalNotes || undefined,
                    afterHoursRequired: editAfterHours || null,
                    existingCompetitorContract: editExistingContract || null,
                    competitorName: editCompetitorName || null,
                    cancellationNoticeRequired: editCancellationNotice || null,
                    noticePeriod: editNoticePeriod || null,
                    earliestStartDate: editEarliestStartDate || null,
                    expectedServiceTime: editExpectedServiceTime || null,
                    clientFlags: editClientFlags.length > 0 ? JSON.stringify(editClientFlags) : null,
                  });
                }}
                disabled={saveLeadEdits.isPending}
              >
                {saveLeadEdits.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Duplicate Client dialog ── */}
      <Dialog open={dupDialog.open} onOpenChange={open => !open && setDupDialog(d => ({ ...d, open: false }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Possible existing client found
            </DialogTitle>
            <DialogDescription>
              A client with a similar name, email, or phone already exists. What would you like to do?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 my-2">
            {dupDialog.duplicates.map(dup => (
              <div key={dup.id} className="border rounded-lg p-3 space-y-1">
                <p className="font-medium text-sm">{dup.name}</p>
                {dup.email && <p className="text-xs text-gray-500 flex items-center gap-1"><Mail className="h-3 w-3" />{dup.email}</p>}
                {dup.phone && <p className="text-xs text-gray-500 flex items-center gap-1"><Phone className="h-3 w-3" />{dup.phone}</p>}
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs mt-1 border-blue-300 text-blue-700 hover:bg-blue-50"
                  onClick={() => {
                    setDupDialog(d => ({ ...d, open: false }));
                    createClientProfile.mutate({ id: dupDialog.leadId, body: { linkToExistingId: dup.id } });
                  }}
                >
                  <Link2 className="h-3 w-3 mr-1" /> Link this lead to {dup.name}
                </Button>
              </div>
            ))}
          </div>
          <DialogFooter className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDupDialog(d => ({ ...d, open: false }));
                createClientProfile.mutate({ id: dupDialog.leadId, body: { forceCreate: true } });
              }}
            >
              Create new client anyway
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDupDialog(d => ({ ...d, open: false }))}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
  onMarkContacted,
  onBookAppointment,
  onMarkSiteVisitDone,
  onCreateQuote,
  onMarkLost,
  onCreateClientProfile,
  onNotes,
}: {
  lead: QuoteSubmission;
  workers: Worker[];
  onMarkContacted: () => void;
  onBookAppointment: () => void;
  onMarkSiteVisitDone: () => void;
  onCreateQuote: () => void;
  onMarkLost: () => void;
  onCreateClientProfile: () => void;
  onNotes: () => void;
}) {
  const fu = followUpLabel(lead.followUpDate);
  const assignedWorker = lead.assignedTo ? workers.find(w => w.id === lead.assignedTo) : null;
  const status = getLeadStatus(lead);
  const priority = (lead as any).priority as string | undefined;
  const leadType = (lead as any).leadType as string | undefined;
  const tradingName = (lead as any).tradingName as string | undefined;
  const siteVisitDone = (lead as any).siteVisitDone as boolean | undefined;

  const priorityCls = priority === "high" ? "bg-red-100 text-red-700" : priority === "low" ? "bg-gray-100 text-gray-500" : "bg-blue-50 text-blue-600";

  const isTerminal = status === "lost" || status === "converted";

  const stale = isStale(lead);
  const clientFlagsList: string[] = (() => {
    try { return JSON.parse((lead as any).clientFlags ?? "[]") ?? []; } catch { return []; }
  })();

  return (
    <div className={`bg-white rounded-lg border shadow-sm p-3 space-y-2 ${stale ? "border-red-300 ring-1 ring-red-200" : "border-gray-200"}`}>
      {/* Stale warning strip */}
      {stale && (
        <div className="flex items-center gap-1 text-[10px] font-semibold text-red-600 bg-red-50 rounded px-2 py-1 -mx-1 -mt-1">
          <AlertCircle className="h-3 w-3 flex-shrink-0" />
          Stale — no activity in {Math.floor((Date.now() - new Date(lead.submittedAt ?? 0).getTime()) / 86400000)}d
        </div>
      )}
      {/* Needs-review warning */}
      {status === NEEDS_REVIEW_STATUS && (
        <div className="flex items-center gap-1 text-[10px] font-semibold text-gray-700 bg-gray-100 rounded px-2 py-1 -mx-1 -mt-1">
          <AlertCircle className="h-3 w-3 flex-shrink-0" />
          Unrecognised status: "{lead.status}" — please review and re-assign
        </div>
      )}
      {/* Competitor warning */}
      {(lead as any).existingCompetitorContract === "yes" && (
        <div className="flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 rounded px-2 py-1 -mx-1">
          <AlertCircle className="h-3 w-3 flex-shrink-0" />
          Has competitor contract{(lead as any).competitorName ? `: ${(lead as any).competitorName}` : ""}
          {(lead as any).cancellationNoticeRequired === "yes" && (lead as any).noticePeriod ? ` · ${(lead as any).noticePeriod} notice` : ""}
        </div>
      )}
      {/* Client flags */}
      {clientFlagsList.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {clientFlagsList.map((f: string) => {
            const flagLabel = CLIENT_FLAG_OPTIONS.find(o => o.value === f)?.label ?? f;
            const dangerous = ["bad_payer","do_not_contact"].includes(f);
            return (
              <span key={f} className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${dangerous ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                <Flag className="inline h-2.5 w-2.5 mr-0.5" />{flagLabel}
              </span>
            );
          })}
        </div>
      )}
      {/* Company + service + priority */}
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 truncate">{lead.companyName}</p>
          {tradingName && <p className="text-xs text-gray-400 truncate italic">t/a {tradingName}</p>}
          <p className="text-xs text-gray-500 flex items-center gap-1"><User className="h-3 w-3" />{lead.contactPerson}</p>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <Badge variant="outline" className="text-xs">{SERVICE_LABELS[lead.serviceType] ?? lead.serviceType}</Badge>
          {priority && <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${priorityCls}`}>{priority.charAt(0).toUpperCase() + priority.slice(1)}</span>}
        </div>
      </div>

      {/* Lead type + origination badges */}
      <div className="flex flex-wrap gap-1">
        {leadType && (
          <Badge variant="secondary" className="text-xs bg-teal-50 text-teal-700 border border-teal-100">{leadType}</Badge>
        )}
        <Badge variant="secondary" className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-100">
          <Megaphone className="h-3 w-3 mr-1" />
          {ORIGINATION_LABELS[lead.origination ?? "other"] ?? "Other"}
          {lead.origination === "other" && (lead as any).originationOther ? `: ${(lead as any).originationOther}` : ""}
        </Badge>
        {siteVisitDone && (
          <Badge variant="secondary" className="text-xs bg-purple-50 text-purple-700 border border-purple-100">
            <ClipboardCheck className="h-3 w-3 mr-1" />Site visit done
          </Badge>
        )}
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

      {/* Actions — primary pipeline actions + secondary optional actions */}
      {!isTerminal && (
        <div className="flex flex-wrap gap-1 pt-1 border-t border-gray-100">
          {/* ── Primary actions ── */}
          <Button size="sm" variant="outline" className="text-xs h-6 px-2" onClick={onMarkContacted}>
            <PhoneCall className="h-3 w-3 mr-0.5" /> Mark Contacted
          </Button>
          <Button size="sm" variant="outline" className="text-xs h-6 px-2 border-blue-300 text-blue-700 hover:bg-blue-50" onClick={onBookAppointment}>
            <CalendarClock className="h-3 w-3 mr-0.5" /> Book Appointment
          </Button>
          <Button size="sm" variant="outline" className="text-xs h-6 px-2 border-purple-300 text-purple-700 hover:bg-purple-50" onClick={onMarkSiteVisitDone} disabled={!!siteVisitDone}>
            <ClipboardCheck className="h-3 w-3 mr-0.5" /> {siteVisitDone ? "Site Done ✓" : "Site Done → Quote Needed"}
          </Button>
          <Button size="sm" variant="outline" className="text-xs h-6 px-2 border-amber-300 text-amber-700 hover:bg-amber-50" onClick={onCreateQuote}>
            <FileText className="h-3 w-3 mr-0.5" /> Create Quote
          </Button>
          {/* ── Secondary actions ── */}
          <Button size="sm" variant="ghost" className="text-xs h-6 px-2 text-teal-600 hover:text-teal-800 hover:bg-teal-50" onClick={onCreateClientProfile} title="Save the prospect details as a client record (optional — does not win the work)">
            <UserCheck className="h-3 w-3 mr-0.5" /> Create Client Profile
          </Button>
          <Button size="sm" variant="ghost" className="text-xs h-6 px-2 text-gray-500" onClick={onNotes}>
            Notes
          </Button>
          <Button size="sm" variant="ghost" className="text-xs h-6 px-2 text-red-500 hover:text-red-700" onClick={onMarkLost}>
            <XCircle className="h-3 w-3" /> Lost
          </Button>
        </div>
      )}
      {isTerminal && (
        <div className="flex flex-wrap gap-1 pt-1 border-t border-gray-100">
          <Button size="sm" variant="ghost" className="text-xs h-6 px-2 text-gray-500" onClick={onNotes}>
            Notes
          </Button>
        </div>
      )}
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
