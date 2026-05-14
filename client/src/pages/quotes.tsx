import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format, parseISO } from "date-fns";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  FileText, Phone, Mail, MapPin, Calendar, User,
  MessageSquare, ChevronDown, ChevronUp, Building2, Briefcase,
} from "lucide-react";
import type { QuoteSubmission, Worker, Client } from "@shared/schema";

// ── constants ─────────────────────────────────────────────────────────────────

// Quotes page only shows entries that have reached the "quoted" stage or beyond.
// "new" and "contacted" are leads still in the pipeline — they live on the Leads page.
const STATUS_OPTIONS = [
  { value: "quoted",    label: "Quoted",    class: "bg-purple-100 text-purple-700" },
  { value: "converted", label: "Accepted",  class: "bg-green-100 text-green-700" },
  { value: "declined",  label: "Declined",  class: "bg-red-100 text-red-600" },
];

const SERVICE_LABELS: Record<string, string> = {
  pest_control:  "Pest Control",
  sanitary_bins: "Sanitary Bins",
  washroom:      "Washroom",
  deep_cleaning: "Deep Cleaning",
};

// Maps quote serviceType → department ID for job creation
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
}

function QuoteCard({ quote, salesWorkers, allWorkers, clients }: QuoteCardProps) {
  const [, navigate] = useLocation();
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(quote.notes ?? "");
  const [editingNotes, setEditingNotes] = useState(false);

  // Decline dialog
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");

  // Accept / Convert-to-Job dialog
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [jobClientId, setJobClientId] = useState("");
  const [jobWorkerId, setJobWorkerId] = useState("");
  const [jobDate, setJobDate] = useState("");
  const [jobTime, setJobTime] = useState("08:00");
  const [jobNotes, setJobNotes] = useState("");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Workers filtered to the matching service department
  const deptId = SERVICE_TO_DEPT[quote.serviceType] ?? "";
  const deptWorkers = allWorkers.filter(w => w.departmentId === deptId && w.isActive !== false);

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
    mutationFn: async () => {
      // Create the job
      const jobRes = await apiRequest("POST", "/api/jobs", {
        title: `${SERVICE_LABELS[quote.serviceType] ?? quote.serviceType} — ${quote.companyName}`,
        description: quote.description,
        clientId: jobClientId,
        workerId: jobWorkerId || undefined,
        departmentId: deptId || "div-1",
        serviceType: SERVICE_LABELS[quote.serviceType] ?? quote.serviceType,
        status: "scheduled",
        scheduledDate: new Date(jobDate).toISOString(),
        scheduledTime: jobTime || undefined,
        location: quote.address || undefined,
        notes: jobNotes || undefined,
        price: quote.quoteAmount || undefined,
      });
      if (!jobRes.ok) throw new Error("Failed to create job");
      // Mark quote as converted
      await apiRequest("PATCH", `/api/quote-submissions/${quote.id}`, { status: "converted" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quote-submissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Job created!", description: "The quote has been converted and the job is now scheduled." });
      setAcceptOpen(false);
      navigate("/jobs");
    },
    onError: () => toast({ title: "Failed to create job", variant: "destructive" }),
  });

  const handleStatusChange = (status: string) => {
    if (status === "declined") {
      setDeclineReason("");
      setDeclineOpen(true);
    } else if (status === "converted") {
      // Pre-fill client if a name match exists
      const match = clients.find(c =>
        c.name.toLowerCase().includes(quote.companyName.toLowerCase()) ||
        quote.companyName.toLowerCase().includes(c.name.toLowerCase())
      );
      setJobClientId(match?.id ?? "");
      setJobWorkerId("");
      setJobDate("");
      setJobTime("08:00");
      setJobNotes("");
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

  const handleConvertConfirm = () => {
    if (!jobClientId || !jobDate) return;
    convertMutation.mutate();
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
              <p className="font-semibold text-base leading-tight truncate">{quote.companyName}</p>
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
            <Select value={quote.status} onValueChange={handleStatusChange} disabled={updateMutation.isPending || convertMutation.isPending}>
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
      </CardContent>
    </Card>

    {/* ── Decline reason dialog ── */}
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
            <Briefcase className="h-4 w-4 text-green-600" />
            Convert to Job
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">

          {/* ── Client details from quote (read-only) ── */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Client Details (from quote)</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <div>
                <p className="text-xs text-blue-500 font-medium">Company</p>
                <p className="font-semibold text-blue-900">{quote.companyName}</p>
              </div>
              <div>
                <p className="text-xs text-blue-500 font-medium">Contact Person</p>
                <p className="text-blue-900">{quote.contactPerson || "—"}</p>
              </div>
              {quote.email && (
                <div>
                  <p className="text-xs text-blue-500 font-medium">Email</p>
                  <p className="text-blue-900 truncate">{quote.email}</p>
                </div>
              )}
              {quote.phone && (
                <div>
                  <p className="text-xs text-blue-500 font-medium">Phone</p>
                  <p className="text-blue-900">{quote.phone}</p>
                </div>
              )}
              {quote.address && (
                <div className="col-span-2">
                  <p className="text-xs text-blue-500 font-medium">Address / Location</p>
                  <p className="text-blue-900">{quote.address}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-blue-500 font-medium">Service</p>
                <p className="text-blue-900 font-medium">{SERVICE_LABELS[quote.serviceType] ?? quote.serviceType}</p>
              </div>
              {quote.quoteAmount && (
                <div>
                  <p className="text-xs text-blue-500 font-medium">Quoted Amount</p>
                  <p className="text-blue-900 font-semibold">R {parseFloat(quote.quoteAmount).toFixed(2)}</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Client account (auto-matched or manual pick) ── */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Link to Client Account <span className="text-red-500">*</span>
            </label>
            {jobClientId && clients.find(c => c.id === jobClientId) ? (
              <div className="flex items-center justify-between rounded-md border border-green-300 bg-green-50 px-3 py-2">
                <div className="flex items-center gap-2 text-sm text-green-800">
                  <Building2 className="h-4 w-4 text-green-600 shrink-0" />
                  <span className="font-medium">{clients.find(c => c.id === jobClientId)?.name}</span>
                  <span className="text-xs text-green-500">(auto-matched)</span>
                </div>
                <button
                  onClick={() => setJobClientId("")}
                  className="text-xs text-green-600 hover:text-green-800 underline"
                >
                  Change
                </button>
              </div>
            ) : (
              <>
                <Select value={jobClientId} onValueChange={setJobClientId}>
                  <SelectTrigger className={!jobClientId ? "border-amber-400" : ""}>
                    <SelectValue placeholder="Select the matching client account..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.filter(c => c.status !== "suspended").map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-amber-600">
                  No exact match found for "{quote.companyName}". Select the right account or create one first.
                </p>
              </>
            )}
          </div>

          {/* ── Service person ── */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Assign Service Person <span className="text-red-500">*</span>
            </label>
            <Select value={jobWorkerId} onValueChange={setJobWorkerId}>
              <SelectTrigger className={!jobWorkerId ? "border-red-300" : ""}>
                <SelectValue placeholder="Select field worker..." />
              </SelectTrigger>
              <SelectContent>
                {(deptWorkers.length > 0 ? deptWorkers : allWorkers.filter(w => w.isActive !== false)).map(w => (
                  <SelectItem key={w.id} value={w.id}>{w.name} — {w.role ?? "Field Worker"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {deptWorkers.length > 0 && (
              <p className="text-xs text-muted-foreground">Showing {SERVICE_LABELS[quote.serviceType]} workers only.</p>
            )}
          </div>

          {/* ── Date + Time ── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Job Date <span className="text-red-500">*</span></label>
              <Input
                type="date"
                value={jobDate}
                onChange={e => setJobDate(e.target.value)}
                className={!jobDate ? "border-red-300" : ""}
                min={new Date().toISOString().split("T")[0]}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Start Time</label>
              <Input
                type="time"
                value={jobTime}
                onChange={e => setJobTime(e.target.value)}
              />
            </div>
          </div>

          {/* ── Notes ── */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Additional Notes <span className="text-xs text-gray-400 font-normal">(optional)</span>
            </label>
            <Textarea
              rows={2}
              placeholder="Any special instructions for the service team..."
              value={jobNotes}
              onChange={e => setJobNotes(e.target.value)}
              className="resize-none text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setAcceptOpen(false)}>Cancel</Button>
          <Button
            className="bg-green-600 hover:bg-green-700 text-white"
            disabled={!jobClientId || !jobWorkerId || !jobDate || convertMutation.isPending}
            onClick={handleConvertConfirm}
          >
            <Briefcase className="h-4 w-4 mr-1.5" />
            {convertMutation.isPending ? "Creating Job..." : "Create Job & Schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

// ── QuotesPage ────────────────────────────────────────────────────────────────

export default function QuotesPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");

  const { data: quotes = [], isLoading } = useQuery<QuoteSubmission[]>({
    queryKey: ["/api/quote-submissions"],
  });
  const { data: workers = [] } = useQuery<Worker[]>({ queryKey: ["/api/workers"] });
  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["/api/clients"] });

  const salesWorkers = workers.filter(w => w.departmentId === "div-5" && w.isActive !== false);

  // Only show entries that have reached the quoting stage
  const QUOTE_STATUSES = ["quoted", "converted", "declined"];
  const filtered = quotes.filter(q => {
    if (!QUOTE_STATUSES.includes(q.status)) return false;
    const matchStatus = statusFilter === "all" || q.status === statusFilter;
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
              <div className="text-sm text-muted-foreground">
                <strong>{filtered.length}</strong> shown · <strong>{countByStatus("quoted")}</strong> pending · <strong>{countByStatus("converted")}</strong> accepted
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
                    />
                  ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
