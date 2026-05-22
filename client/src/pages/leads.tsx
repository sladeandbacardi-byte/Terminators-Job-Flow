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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Phone, Mail, MapPin, Clock, ChevronRight, Briefcase,
  XCircle, ArrowRight, Calendar, User, Building2, AlertCircle,
  Send, Search, X, Megaphone, Download,
} from "lucide-react";
import DocumentForm from "@/components/forms/document-form";
import { type DocumentFormValues } from "@/components/forms/document-form-schema";
import type { QuoteSubmission, Worker, Department } from "@shared/schema";
import { ORIGINATION_OPTIONS, ORIGINATION_LABELS } from "@shared/schema";
import { exportLeads } from "@/lib/data-export";

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
];

// ─── schema ──────────────────────────────────────────────────────────────────


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
  const [quoteLead, setQuoteLead] = useState<QuoteSubmission | null>(null);
  const [notesLead, setNotesLead] = useState<QuoteSubmission | null>(null);
  const [notesText, setNotesText] = useState("");
  const [quotePreview, setQuotePreview] = useState(false);

  // Filters
  const [search, setSearch]             = useState("");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [salespersonFilter, setSalespersonFilter] = useState("all");
  const [originationFilter, setOriginationFilter] = useState("all");

  const { data: leads = [], isLoading } = useQuery<QuoteSubmission[]>({ queryKey: ["/api/quote-submissions"] });
  const { data: workers = [] } = useQuery<Worker[]>({ queryKey: ["/api/workers"] });
  const { data: departments = [] } = useQuery<Department[]>({ queryKey: ["/api/departments"] });

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

  const saveLeadEdits = useMutation({
    mutationFn: ({ id, notes, origination, originationOther }: { id: string; notes: string; origination: string; originationOther: string | null }) =>
      apiRequest("PATCH", `/api/quote-submissions/${id}`, { notes, origination, originationOther }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quote-submissions"] });
      setNotesLead(null);
      toast({ title: "Lead updated" });
    },
  });

  const [editOrigination, setEditOrigination] = useState<string>("other");
  const [editOriginationOther, setEditOriginationOther] = useState<string>("");

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

  // Only show active leads — quoted/converted/declined live on Quotes page
  const LEAD_STATUSES = ["new", "contacted"];

  const filteredLeads = useMemo(() => {
    const q = search.toLowerCase().trim();
    return leads.filter(l => {
      if (!LEAD_STATUSES.includes(l.status)) return false;
      if (q && !l.companyName.toLowerCase().includes(q) && !l.contactPerson.toLowerCase().includes(q)) return false;
      if (serviceFilter !== "all" && l.serviceType !== serviceFilter) return false;
      if (salespersonFilter !== "all" && l.assignedTo !== salespersonFilter) return false;
      if (originationFilter !== "all" && (l.origination ?? "other") !== originationFilter) return false;
      return true;
    });
  }, [leads, search, serviceFilter, salespersonFilter, originationFilter]);

  const totals = PIPELINE.reduce((acc, col) => {
    acc[col.status] = filteredLeads.filter(l => l.status === col.status).length;
    return acc;
  }, {} as Record<string, number>);

  const hasFilters = search || serviceFilter !== "all" || salespersonFilter !== "all" || originationFilter !== "all";
  const clearFilters = () => { setSearch(""); setServiceFilter("all"); setSalespersonFilter("all"); setOriginationFilter("all"); };

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
          { label: "New Lead", cls: "bg-blue-100 text-blue-700" },
          { label: "Contacted", cls: "bg-amber-100 text-amber-700" },
          { label: "Send Quote →  Quotes Page", cls: "bg-purple-100 text-purple-700" },
          { label: "Lost", cls: "bg-gray-100 text-gray-500" },
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
          {PIPELINE.map(col => {
            const colLeads = filteredLeads.filter(l => l.status === col.status)
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
                      onQuote={() => { setQuoteLead(lead); setQuotePreview(false); }}
                      onNotes={() => {
                        setNotesLead(lead);
                        setNotesText(lead.notes ?? "");
                        setEditOrigination(lead.origination ?? "other");
                        setEditOriginationOther(lead.originationOther ?? "");
                      }}
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
          <DialogTitle className="sr-only">New Lead</DialogTitle>
          <DocumentForm
            docType="lead"
            salesWorkers={salesWorkers}
            isPending={createLead.isPending}
            onSubmit={d => createLead.mutate(d)}
            onCancel={() => setShowNewLead(false)}
          />
        </DialogContent>
      </Dialog>

      {/* ── Send Quote dialog ── */}
      {quoteLead && (
        <Dialog open={!!quoteLead} onOpenChange={() => { setQuoteLead(null); setQuotePreview(false); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
            <DialogTitle className="sr-only">Send Quote</DialogTitle>
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

      {/* ── Edit Lead dialog (origination + notes) ── */}
      {notesLead && (
        <Dialog open={!!notesLead} onOpenChange={() => setNotesLead(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Lead — {notesLead.companyName}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
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
                  <Input
                    value={editOriginationOther}
                    onChange={e => setEditOriginationOther(e.target.value)}
                    placeholder="e.g. Trade show, magazine ad..."
                    className="h-9 text-sm"
                  />
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="text-sm font-medium block mb-1">Notes</label>
                <Textarea
                  rows={5}
                  value={notesText}
                  onChange={e => setNotesText(e.target.value)}
                  placeholder="Internal notes, call summary, quote amount, etc."
                />
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
  onQuote,
  onNotes,
  onDecline,
}: {
  lead: QuoteSubmission;
  workers: Worker[];
  onAdvance: (status: string) => void;
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

      {/* Origination */}
      <div>
        <Badge variant="secondary" className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-100">
          <Megaphone className="h-3 w-3 mr-1" />
          {ORIGINATION_LABELS[lead.origination ?? "other"] ?? "Other"}
          {lead.origination === "other" && lead.originationOther ? `: ${lead.originationOther}` : ""}
        </Badge>
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
          <Button size="sm" variant="outline" className="text-xs h-6 px-2 border-purple-300 text-purple-700 hover:bg-purple-50" onClick={onQuote}>
            <Send className="h-3 w-3 mr-0.5" /> Send Quote
          </Button>
        )}

        <Button size="sm" variant="ghost" className="text-xs h-6 px-2 text-gray-500" onClick={onNotes}>
          Notes
        </Button>

        <Button size="sm" variant="ghost" className="text-xs h-6 px-2 text-red-500 hover:text-red-700" onClick={onDecline}>
          <XCircle className="h-3 w-3" /> Lost
        </Button>
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
