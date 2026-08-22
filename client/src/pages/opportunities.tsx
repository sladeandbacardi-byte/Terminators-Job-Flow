import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import {
  Search, Filter, AlertTriangle, Clock, CheckCircle, XCircle,
  Users, FileText, Briefcase, DollarSign, ChevronRight, User,
  Building2, Star, Trophy, ArrowRight, Image, ExternalLink,
  PlusCircle, BarChart3,
} from "lucide-react";
import type { Worker } from "@shared/schema";
import {
  OPPORTUNITY_STATUSES, OPPORTUNITY_STATUS_LABELS,
  OPPORTUNITY_TYPE_LABELS, OPPORTUNITY_URGENCIES,
} from "@shared/opportunities";
import type { OpportunityStatus } from "@shared/opportunities";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OpportunityPhoto {
  id: string;
  opportunityId: string;
  fileUrl: string;
  fileName: string | null;
  uploadedByWorkerId: string;
  createdAt: string;
}

interface Opportunity {
  id: string;
  clientId: string;
  siteId: string | null;
  sourceJobId: string | null;
  reportedByWorkerId: string;
  assignedToWorkerId: string | null;
  opportunityType: string;
  customType: string | null;
  description: string;
  urgency: string;
  status: string;
  estimatedValue: string | null;
  quoteId: string | null;
  jobId: string | null;
  invoiceId: string | null;
  wonAt: string | null;
  lostReason: string | null;
  createdAt: string;
  updatedAt: string;
  // Enriched fields
  clientName: string;
  reporterName: string;
  assigneeName: string;
  typeLabel: string;
  statusLabel: string;
  photos: OpportunityPhoto[];
}

interface StaffReport {
  workerId: string;
  workerName: string;
  generated: number;
  active: number;
  won: number;
  estimatedValue: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: any) {
  try { return format(parseISO(d), "d MMM yyyy"); } catch { return d ?? "—"; }
}

function fmtR(v: number | string | null | undefined) {
  const n = typeof v === "string" ? parseFloat(v) : (v ?? 0);
  if (isNaN(n as number)) return "—";
  return `R ${(n as number).toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function urgencyColor(urgency: string) {
  if (urgency === "urgent")    return "bg-red-100 text-red-700 border-red-200";
  if (urgency === "important") return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-gray-100 text-gray-600 border-gray-200";
}

function urgencyLabel(urgency: string) {
  if (urgency === "urgent")    return "Urgent";
  if (urgency === "important") return "Important";
  return "Normal";
}

function statusColor(status: string) {
  if (status === "won" || status === "accepted" || status === "job_created") return "bg-green-100 text-green-700";
  if (status === "lost" || status === "not_applicable") return "bg-red-100 text-red-600";
  if (status === "quote_sent" || status === "quote_required") return "bg-blue-100 text-blue-700";
  if (status === "new") return "bg-purple-100 text-purple-700";
  return "bg-gray-100 text-gray-600";
}

const TERMINAL_STATUSES = new Set(["won", "lost", "not_applicable", "job_created"]);
const WIN_STATUSES = new Set(["won", "accepted", "job_created"]);

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OpportunitiesPage() {
  const { toast } = useToast();
  const [location] = useLocation();
  const contextualFilters = useMemo(() => new URLSearchParams(location.split("?")[1] ?? ""), [location]);

  // ── Filters ────────────────────────────────────────────────────────────────
  const [search, setSearch]           = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [urgencyFilter, setUrgencyFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter]   = useState<string>("all");
  const [activeTab, setActiveTab]     = useState<"list" | "leaderboard">("list");

  // ── Selected opportunity for detail dialog ─────────────────────────────────
  const [selected, setSelected] = useState<Opportunity | null>(null);

  // ── Local edit state inside the dialog ────────────────────────────────────
  const [editStatus, setEditStatus]   = useState<string>("");
  const [editAssignee, setEditAssignee] = useState<string>("");
  const [editValue, setEditValue]     = useState<string>("");
  const [editLostReason, setEditLostReason] = useState<string>("");
  const [photoIndex, setPhotoIndex]   = useState(0);

  // ── Data queries ───────────────────────────────────────────────────────────
  const { data: opportunities = [], isLoading } = useQuery<Opportunity[]>({
    queryKey: ["/api/opportunities"],
  });

  const { data: workers = [] } = useQuery<Worker[]>({
    queryKey: ["/api/workers"],
  });

  const { data: staffReport = [] } = useQuery<StaffReport[]>({
    queryKey: ["/api/opportunities/report/staff"],
    enabled: activeTab === "leaderboard",
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const patchMutation = useMutation({
    mutationFn: (data: { id: string; body: Record<string, any> }) =>
      apiRequest("PATCH", `/api/opportunities/${data.id}`, data.body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
      toast({ description: "Opportunity updated." });
    },
    onError: (err: Error) => {
      toast({ description: err.message || "Failed to update.", variant: "destructive" });
    },
  });

  const createQuoteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("POST", `/api/opportunities/${id}/create-quote`),
    onSuccess: async (res) => {
      const data = await res.json();
      await queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/quote-submissions"] });
      toast({ description: `Quote created. Quote ID: ${data.quoteId}` });
      setSelected(null);
    },
    onError: (err: Error) => {
      toast({ description: err.message || "Failed to create quote.", variant: "destructive" });
    },
  });

  // ── Derived data ───────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const requestedType = contextualFilters.get("type");
    const requestedJob = contextualFilters.get("job");
    return opportunities.filter(opp => {
      // Status group filter
      if (statusFilter === "active") {
        if (TERMINAL_STATUSES.has(opp.status)) return false;
      } else if (statusFilter === "won") {
        if (!WIN_STATUSES.has(opp.status)) return false;
      } else if (statusFilter === "lost") {
        if (opp.status !== "lost" && opp.status !== "not_applicable") return false;
      } else if (statusFilter !== "all") {
        if (opp.status !== statusFilter) return false;
      }

      // Urgency filter
      if (urgencyFilter !== "all" && opp.urgency !== urgencyFilter) return false;

      // Type filter
      const effectiveType = typeFilter !== "all" ? typeFilter : requestedType;
      if (effectiveType && opp.opportunityType !== effectiveType) return false;

      // The job card can open the inbox in the context of a source job or
      // the fulfilment job generated by an accepted opportunity.
      if (requestedJob && opp.sourceJobId !== requestedJob && opp.jobId !== requestedJob) return false;

      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        if (
          !opp.clientName.toLowerCase().includes(q) &&
          !opp.typeLabel.toLowerCase().includes(q) &&
          !opp.description.toLowerCase().includes(q) &&
          !opp.reporterName.toLowerCase().includes(q) &&
          !opp.assigneeName.toLowerCase().includes(q)
        ) return false;
      }

      return true;
    });
  }, [opportunities, statusFilter, urgencyFilter, typeFilter, search, contextualFilters]);

  // Stats
  const stats = useMemo(() => {
    const active = opportunities.filter(o => !TERMINAL_STATUSES.has(o.status)).length;
    const won    = opportunities.filter(o => WIN_STATUSES.has(o.status)).length;
    const lost   = opportunities.filter(o => o.status === "lost" || o.status === "not_applicable").length;
    const urgent = opportunities.filter(o => o.urgency === "urgent" && !TERMINAL_STATUSES.has(o.status)).length;
    const totalValue = opportunities
      .filter(o => WIN_STATUSES.has(o.status))
      .reduce((sum, o) => sum + (o.estimatedValue ? parseFloat(o.estimatedValue) : 0), 0);
    return { active, won, lost, urgent, total: opportunities.length, totalValue };
  }, [opportunities]);

  // Unique types for filter
  const usedTypes = useMemo(() => {
    const set = new Set(opportunities.map(o => o.opportunityType));
    return Array.from(set);
  }, [opportunities]);

  // ── Dialog open ───────────────────────────────────────────────────────────
  function openDetail(opp: Opportunity) {
    setSelected(opp);
    setEditStatus(opp.status);
    setEditAssignee(opp.assignedToWorkerId ?? "");
    setEditValue(opp.estimatedValue ?? "");
    setEditLostReason(opp.lostReason ?? "");
    setPhotoIndex(0);
  }

  // ── Save patch ────────────────────────────────────────────────────────────
  function saveChanges() {
    if (!selected) return;
    if (editStatus === "lost" && !editLostReason.trim()) {
      toast({ description: "Please provide a reason for marking this opportunity lost.", variant: "destructive" });
      return;
    }
    const body: Record<string, any> = {
      status: editStatus,
      assignedToWorkerId: editAssignee || null,
      estimatedValue: editValue ? parseFloat(editValue) : null,
      lostReason: editLostReason || null,
    };
    patchMutation.mutate({ id: selected.id, body });
    setSelected(null);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="pb-20 lg:pb-6">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-4">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Additional Opportunities</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Opportunities spotted by field staff — review, assign, and convert to quotes.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("list")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                activeTab === "list"
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
              }`}
            >
              <Briefcase className="h-3.5 w-3.5" /> Inbox
            </button>
            <button
              onClick={() => setActiveTab("leaderboard")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                activeTab === "leaderboard"
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
              }`}
            >
              <Trophy className="h-3.5 w-3.5" /> Staff Leaderboard
            </button>
          </div>
        </div>

        {/* ── Stats ──────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Total" value={stats.total} />
          <StatCard label="Active" value={stats.active} color="text-blue-700" />
          <StatCard label="Won" value={stats.won} color="text-green-700" />
          <StatCard label="Lost" value={stats.lost} color="text-red-600" />
          <StatCard label="Urgent (Active)" value={stats.urgent} color="text-amber-600" />
          <StatCard label="Won Value" value={fmtR(stats.totalValue)} color="text-purple-700" />
        </div>

        {/* ── List Tab ───────────────────────────────────────────────────── */}
        {activeTab === "list" && (
          <>
            {/* Filters */}
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by client, type, description, staff…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8 h-9 text-sm"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px] h-9 text-sm">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="won">Won</SelectItem>
                  <SelectItem value="lost">Lost / N/A</SelectItem>
                  {OPPORTUNITY_STATUSES.map(s => (
                    <SelectItem key={s} value={s}>{OPPORTUNITY_STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
                <SelectTrigger className="w-[140px] h-9 text-sm">
                  <SelectValue placeholder="Urgency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Urgency</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="important">Important</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[180px] h-9 text-sm">
                  <SelectValue placeholder="Service Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {usedTypes.map(t => (
                    <SelectItem key={t} value={t}>
                      {OPPORTUNITY_TYPE_LABELS[t as keyof typeof OPPORTUNITY_TYPE_LABELS] ?? t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Table */}
            <Card>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="py-12 text-center text-sm text-gray-400">Loading opportunities…</div>
                ) : filtered.length === 0 ? (
                  <div className="py-12 text-center text-sm text-gray-400">No opportunities match your filters.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          {["Client", "Type", "Description", "Urgency", "Status", "Est. Value", "Reporter", "Assignee", "Photos", "Date", ""].map(h => (
                            <th key={h} className="py-2 px-3 text-left font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map(opp => (
                          <tr
                            key={opp.id}
                            className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                            onClick={() => openDetail(opp)}
                          >
                            <td className="py-2 px-3 whitespace-nowrap">
                              <Link
                                href={`/clients/${opp.clientId}`}
                                className="font-semibold text-blue-700 hover:underline"
                                onClick={e => e.stopPropagation()}
                              >
                                {opp.clientName}
                              </Link>
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap text-gray-700">{opp.typeLabel}</td>
                            <td className="py-2 px-3 max-w-[220px]">
                              <p className="truncate text-gray-600" title={opp.description}>{opp.description}</p>
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap">
                              <Badge className={`text-[10px] px-1.5 py-0 border ${urgencyColor(opp.urgency)}`}>
                                {urgencyLabel(opp.urgency)}
                              </Badge>
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap">
                              <Badge className={`text-[10px] px-1.5 py-0 ${statusColor(opp.status)}`}>
                                {opp.statusLabel}
                              </Badge>
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap text-gray-700">
                              {opp.estimatedValue ? fmtR(opp.estimatedValue) : <span className="text-gray-400">—</span>}
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap text-gray-600">{opp.reporterName}</td>
                            <td className="py-2 px-3 whitespace-nowrap text-gray-600">
                              {opp.assignedToWorkerId ? opp.assigneeName : <span className="text-gray-400 italic">Unassigned</span>}
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap text-gray-400">
                              {opp.photos.length > 0 ? (
                                <span className="flex items-center gap-1 text-blue-500">
                                  <Image className="h-3 w-3" />{opp.photos.length}
                                </span>
                              ) : "—"}
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap text-gray-400">{fmtDate(opp.createdAt)}</td>
                            <td className="py-2 px-3">
                              <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* ── Leaderboard Tab ────────────────────────────────────────────── */}
        {activeTab === "leaderboard" && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-500" />
                Staff Recognition — Opportunity Leaderboard
              </CardTitle>
            </CardHeader>
            <CardContent>
              {staffReport.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No staff report data yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b">
                        <th className="pb-2 pr-4 text-left font-semibold text-gray-500 uppercase tracking-wide">Rank</th>
                        <th className="pb-2 pr-4 text-left font-semibold text-gray-500 uppercase tracking-wide">Staff Member</th>
                        <th className="pb-2 pr-4 text-right font-semibold text-gray-500 uppercase tracking-wide">Generated</th>
                        <th className="pb-2 pr-4 text-right font-semibold text-gray-500 uppercase tracking-wide">Active</th>
                        <th className="pb-2 pr-4 text-right font-semibold text-gray-500 uppercase tracking-wide">Won</th>
                        <th className="pb-2 pr-4 text-right font-semibold text-gray-500 uppercase tracking-wide">Win Rate</th>
                        <th className="pb-2 text-right font-semibold text-gray-500 uppercase tracking-wide">Est. Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staffReport.map((row, i) => {
                        const winRate = row.generated > 0 ? Math.round((row.won / row.generated) * 100) : 0;
                        return (
                          <tr key={row.workerId} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-2 pr-4">
                              {i === 0 && <Trophy className="h-4 w-4 text-amber-400" />}
                              {i === 1 && <Trophy className="h-4 w-4 text-gray-400" />}
                              {i === 2 && <Trophy className="h-4 w-4 text-amber-700" />}
                              {i > 2 && <span className="text-gray-400 font-semibold">{i + 1}</span>}
                            </td>
                            <td className="py-2 pr-4 font-semibold text-gray-900 whitespace-nowrap">{row.workerName}</td>
                            <td className="py-2 pr-4 text-right text-gray-700 font-semibold">{row.generated}</td>
                            <td className="py-2 pr-4 text-right text-blue-600">{row.active}</td>
                            <td className="py-2 pr-4 text-right text-green-600 font-semibold">{row.won}</td>
                            <td className="py-2 pr-4 text-right">
                              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                                winRate >= 50 ? "bg-green-100 text-green-700"
                                : winRate >= 25 ? "bg-amber-100 text-amber-700"
                                : "bg-gray-100 text-gray-500"
                              }`}>{winRate}%</span>
                            </td>
                            <td className="py-2 text-right text-purple-600 font-semibold">{fmtR(row.estimatedValue)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Detail Dialog ────────────────────────────────────────────────────── */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 flex-wrap">
                  <Building2 className="h-5 w-5 text-gray-400 flex-shrink-0" />
                  <Link
                    href={`/clients/${selected.clientId}`}
                    className="text-blue-700 hover:underline font-bold"
                    onClick={() => setSelected(null)}
                  >
                    {selected.clientName}
                  </Link>
                  <span className="text-gray-400 font-normal">—</span>
                  <span className="font-normal text-gray-700">{selected.typeLabel}</span>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-5">
                {/* Description & metadata */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Description</p>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{selected.description}</p>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex gap-2 items-center">
                      <span className="text-gray-400 w-24 flex-shrink-0">Status</span>
                      <Badge className={`text-[10px] px-1.5 py-0 ${statusColor(selected.status)}`}>{selected.statusLabel}</Badge>
                    </div>
                    <div className="flex gap-2 items-center">
                      <span className="text-gray-400 w-24 flex-shrink-0">Urgency</span>
                      <Badge className={`text-[10px] px-1.5 py-0 border ${urgencyColor(selected.urgency)}`}>{urgencyLabel(selected.urgency)}</Badge>
                    </div>
                    <div className="flex gap-2 items-center">
                      <span className="text-gray-400 w-24 flex-shrink-0">Reported by</span>
                      <span className="font-medium text-gray-700">{selected.reporterName}</span>
                    </div>
                    <div className="flex gap-2 items-center">
                      <span className="text-gray-400 w-24 flex-shrink-0">Reported on</span>
                      <span className="text-gray-600">{fmtDate(selected.createdAt)}</span>
                    </div>
                    {selected.sourceJobId && (
                      <div className="flex gap-2 items-center">
                        <span className="text-gray-400 w-24 flex-shrink-0">Source Job</span>
                        <Link
                          href={`/jobs`}
                          className="text-blue-600 hover:underline text-xs flex items-center gap-1"
                          onClick={() => setSelected(null)}
                        >
                          View Jobs <ExternalLink className="h-3 w-3" />
                        </Link>
                      </div>
                    )}
                  </div>
                </div>

                {/* Lifecycle links */}
                {(selected.quoteId || selected.jobId || selected.invoiceId || selected.wonAt) && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">Lifecycle Links</p>
                    <div className="flex flex-wrap gap-3">
                      {selected.quoteId && (
                        <Link
                          href={`/quotes`}
                          className="text-xs flex items-center gap-1 text-blue-700 hover:underline"
                          onClick={() => setSelected(null)}
                        >
                          <FileText className="h-3.5 w-3.5" /> View Quote <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                      {selected.jobId && (
                        <Link
                          href={`/jobs`}
                          className="text-xs flex items-center gap-1 text-blue-700 hover:underline"
                          onClick={() => setSelected(null)}
                        >
                          <Briefcase className="h-3.5 w-3.5" /> View Job <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                      {selected.invoiceId && (
                        <Link
                          href={`/invoices`}
                          className="text-xs flex items-center gap-1 text-blue-700 hover:underline"
                          onClick={() => setSelected(null)}
                        >
                          <DollarSign className="h-3.5 w-3.5" /> View Invoice <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                      {selected.wonAt && (
                        <span className="text-xs flex items-center gap-1 text-green-700">
                          <CheckCircle className="h-3.5 w-3.5" /> Won on {fmtDate(selected.wonAt)}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Photo gallery */}
                {selected.photos.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                      Photos ({selected.photos.length})
                    </p>
                    <div className="relative">
                      <img
                        src={selected.photos[photoIndex]?.fileUrl}
                        alt={selected.photos[photoIndex]?.fileName ?? "Opportunity photo"}
                        className="w-full max-h-64 object-contain rounded-lg bg-gray-100 border"
                      />
                      {selected.photos.length > 1 && (
                        <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
                          {selected.photos.map((photo, idx) => (
                            <button
                              key={photo.id}
                              onClick={() => setPhotoIndex(idx)}
                              className={`flex-shrink-0 w-16 h-16 rounded border-2 overflow-hidden transition-colors ${
                                idx === photoIndex ? "border-blue-500" : "border-gray-200"
                              }`}
                            >
                              <img src={photo.fileUrl} alt={photo.fileName ?? ""} className="w-full h-full object-cover" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Controls */}
                <div className="border-t pt-4 space-y-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Update Opportunity</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Status */}
                    <div className="space-y-1">
                      <Label className="text-xs">Status</Label>
                      <Select value={editStatus} onValueChange={setEditStatus}>
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {OPPORTUNITY_STATUSES.map(s => (
                            <SelectItem key={s} value={s}>{OPPORTUNITY_STATUS_LABELS[s]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Assign to worker */}
                    <div className="space-y-1">
                      <Label className="text-xs">Assign To</Label>
                      <Select value={editAssignee || "unassigned"} onValueChange={v => setEditAssignee(v === "unassigned" ? "" : v)}>
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {workers.map(w => (
                            <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Estimated value */}
                    <div className="space-y-1">
                      <Label className="text-xs">Estimated Value (R)</Label>
                      <Input
                        type="number"
                        min={0}
                        placeholder="0"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        className="h-9 text-sm"
                      />
                    </div>
                  </div>

                  {/* Lost reason */}
                  {editStatus === "lost" && (
                    <div className="space-y-1">
                      <Label className="text-xs">Lost Reason <span className="text-red-500">*</span></Label>
                      <Textarea
                        placeholder="Why was this opportunity lost?"
                        value={editLostReason}
                        onChange={e => setEditLostReason(e.target.value)}
                        rows={2}
                        className="text-sm resize-none"
                      />
                    </div>
                  )}
                  {selected.lostReason && editStatus !== "lost" && (
                    <div className="text-xs text-gray-500 italic">
                      Previous lost reason: {selected.lostReason}
                    </div>
                  )}
                </div>

                {/* Quote conversion */}
                {!selected.quoteId && !TERMINAL_STATUSES.has(selected.status) && (
                  <div className="border border-blue-200 bg-blue-50 rounded-lg p-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-blue-800">Convert to Quote</p>
                      <p className="text-xs text-blue-600 mt-0.5">
                        Create a sales lead / quote from this opportunity and link it for tracking.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => createQuoteMutation.mutate(selected.id)}
                      disabled={createQuoteMutation.isPending}
                      className="bg-blue-600 hover:bg-blue-700 text-white flex-shrink-0"
                    >
                      <PlusCircle className="h-3.5 w-3.5 mr-1.5" />
                      Create Quote
                    </Button>
                  </div>
                )}
                {selected.quoteId && (
                  <div className="border border-green-200 bg-green-50 rounded-lg p-3 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <span className="text-sm text-green-700">Quote already created for this opportunity.</span>
                    <Link
                      href="/quotes"
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1 ml-auto"
                      onClick={() => setSelected(null)}
                    >
                      View Quotes <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                )}
              </div>

              <DialogFooter className="mt-2 gap-2">
                <Button variant="outline" size="sm" onClick={() => setSelected(null)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={saveChanges}
                  disabled={patchMutation.isPending}
                >
                  Save Changes
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Stat Card sub-component ──────────────────────────────────────────────────

function StatCard({ label, value, color = "text-gray-900" }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-white rounded-lg border p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
