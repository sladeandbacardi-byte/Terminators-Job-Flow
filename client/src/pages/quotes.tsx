import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import MobileNavigation from "@/components/layout/mobile-nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  FileText, Phone, Mail, MapPin, Calendar, User,
  MessageSquare, ChevronDown, ChevronUp, Building2,
} from "lucide-react";
import type { QuoteSubmission } from "@shared/schema";

const STATUS_OPTIONS = [
  { value: "new",       label: "New",       class: "bg-blue-100 text-blue-700" },
  { value: "contacted", label: "Contacted", class: "bg-yellow-100 text-yellow-700" },
  { value: "quoted",    label: "Quoted",    class: "bg-purple-100 text-purple-700" },
  { value: "converted", label: "Converted", class: "bg-green-100 text-green-700" },
  { value: "declined",  label: "Declined",  class: "bg-red-100 text-red-600" },
];

const SERVICE_LABELS: Record<string, string> = {
  pest_control:  "Pest Control",
  sanitary_bins: "Sanitary Bins",
  washroom:      "Washroom",
  deep_cleaning: "Deep Cleaning",
};

const CONTACT_LABELS: Record<string, string> = {
  email:  "Email",
  phone:  "Phone",
  either: "Either",
};

function statusConfig(status: string) {
  return STATUS_OPTIONS.find(s => s.value === status) ?? STATUS_OPTIONS[0];
}

function QuoteCard({ quote }: { quote: QuoteSubmission }) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(quote.notes ?? "");
  const [editingNotes, setEditingNotes] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: (data: Partial<QuoteSubmission>) =>
      apiRequest("PATCH", `/api/quote-submissions/${quote.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quote-submissions"] });
      toast({ title: "Quote updated" });
    },
    onError: () => toast({ title: "Update failed", variant: "destructive" }),
  });

  const handleStatusChange = (status: string) => updateMutation.mutate({ status });
  const handleSaveNotes = () => {
    updateMutation.mutate({ notes });
    setEditingNotes(false);
  };

  const cfg = statusConfig(quote.status);

  return (
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
            <Select value={quote.status} onValueChange={handleStatusChange} disabled={updateMutation.isPending}>
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
        {/* Contact details row */}
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

        {/* Expand/collapse for description + notes */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary font-medium"
        >
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {expanded ? "Hide details" : "Show details"}
        </button>

        {expanded && (
          <div className="space-y-3 pt-1 border-t">
            {/* Description */}
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">Request Description</p>
              <p className="text-sm text-gray-700 bg-gray-50 rounded p-3 leading-relaxed">{quote.description}</p>
            </div>

            {/* Internal notes */}
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
                    <Button size="sm" onClick={handleSaveNotes} disabled={updateMutation.isPending}>
                      Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setNotes(quote.notes ?? ""); setEditingNotes(false); }}>
                      Cancel
                    </Button>
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
  );
}

export default function QuotesPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");

  const { data: quotes = [], isLoading } = useQuery<QuoteSubmission[]>({
    queryKey: ["/api/quote-submissions"],
  });

  const filtered = quotes.filter(q => {
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
                <strong>{quotes.length}</strong> total · <strong>{countByStatus("new")}</strong> new · <strong>{countByStatus("converted")}</strong> converted
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
                  .map(q => <QuoteCard key={q.id} quote={q} />)}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
