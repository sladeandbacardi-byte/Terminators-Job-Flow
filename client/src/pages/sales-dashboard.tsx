import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  format, isToday, isPast, parseISO, differenceInDays, isFuture,
  startOfMonth, endOfMonth, addMonths, isWithinInterval, startOfDay
} from "date-fns";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import MobileNavigation from "@/components/layout/mobile-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TrendingUp, Bell, AlertTriangle, CheckCircle, Clock, Users, FileText,
  ArrowRight, DollarSign, Target, Calendar, Megaphone, BarChart3,
  Phone, Mail, ChevronRight, ClipboardList, Briefcase, PenLine,
  CalendarCheck, UserCheck, Info, RefreshCw,
} from "lucide-react";
import type { QuoteSubmission, SalesFollowUp, Worker, SalesAppointment, AcceptedWorkflow } from "@shared/schema";
import { LEAD_STAGES, ORIGINATION_LABELS, SALES_APPT_TYPES } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// ─── Constants ───────────────────────────────────────────────────────────────

const STALE_DAYS: Record<string, number> = { high: 2, medium: 5, low: 7 };
const ACTIVE_STAGES = ["new","contacted","appointment_scheduled","site_assessment_done","quote_needed","quote_sent","follow_up_due"];
const WIN_STAGES = ["accepted","contract_pending","converted_contract","converted_job","installation_scheduled","invoiced","complete"];
const SERVICE_LABELS: Record<string, string> = {
  pest_control: "Pest Control", sanitary_bins: "Sanitary Bins",
  washroom: "Washroom", deep_cleaning: "Deep Cleaning",
};
const APPT_LABELS: Record<string, string> = Object.fromEntries(
  (SALES_APPT_TYPES ?? []).map((t: any) => [t.value, t.label])
);
const APPT_COLORS: Record<string, string> = {
  new_lead_meeting: "#3b82f6", site_visit: "#10b981", quote_followup: "#f59e0b",
  contract_signing: "#8b5cf6", after_sales: "#06b6d4", other: "#64748b",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function staleThreshold(p: string | null | undefined) { return STALE_DAYS[p ?? "medium"] ?? 5; }
function daysSince(date: any): number { return date ? differenceInDays(new Date(), new Date(date)) : 0; }
function daysUntil(date: any): number { return date ? differenceInDays(new Date(date), new Date()) : 0; }
function fmtDate(d: any) { try { return format(parseISO(d), "d MMM yyyy"); } catch { return d ?? "—"; } }
function fmtTime(t: string) { try { return format(parseISO(`2000-01-01T${t}`), "h:mm a"); } catch { return t; } }

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionTitle({ icon: Icon, label, count, color = "text-gray-500" }: { icon: any; label: string; count?: number; color?: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className={`h-5 w-5 ${color}`} />
      <h2 className="text-base font-bold text-gray-900">{label}</h2>
      {count !== undefined && count > 0 && (
        <Badge className="ml-1 bg-red-500 text-white text-xs">{count}</Badge>
      )}
    </div>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-2 py-4 px-3 text-sm text-gray-400 bg-gray-50 rounded-lg">
      <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
      {msg}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SalesDashboard() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const myWorkerId = (user as any)?.workerId as string | undefined;

  // diary filter
  const [diaryFilter, setDiaryFilter] = useState<"mine" | "all" | string>("mine");

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: leads = [] }            = useQuery<QuoteSubmission[]>({ queryKey: ["/api/quote-submissions"] });
  const { data: followUps = [] }        = useQuery<SalesFollowUp[]>({ queryKey: ["/api/sales-follow-ups"] });
  const { data: workers = [] }          = useQuery<Worker[]>({ queryKey: ["/api/workers"] });
  const { data: appointments = [] }     = useQuery<SalesAppointment[]>({ queryKey: ["/api/sales-appointments"] });
  const { data: acceptedWFs = [] }      = useQuery<AcceptedWorkflow[]>({ queryKey: ["/api/accepted-workflows"] });
  const { data: serviceContracts = [] } = useQuery<any[]>({ queryKey: ["/api/service-contracts"] });

  const salesWorkers = workers.filter(w => w.departmentId === "div-5" && w.isActive !== false);

  // ── Mark follow-up complete mutation ──────────────────────────────────────
  const completeFU = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/sales-follow-ups/${id}`, { status: "completed" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/sales-follow-ups"] }); toast({ title: "Follow-up marked complete" }); },
  });

  // ── Computed ───────────────────────────────────────────────────────────────
  const now = new Date();
  const monthStart = startOfMonth(now);

  const staleLeads = useMemo(() =>
    leads.filter(l => {
      const s = (l as any).stage || l.status;
      if (!ACTIVE_STAGES.includes(s)) return false;
      return daysSince(l.submittedAt) > staleThreshold((l as any).priority);
    }).sort((a, b) => daysSince(b.submittedAt) - daysSince(a.submittedAt)), [leads]);

  const todayFU   = useMemo(() => followUps.filter(f => f.status === "pending" && f.dueDate && isToday(parseISO(f.dueDate))), [followUps]);
  const overdueFU = useMemo(() => followUps.filter(f => f.status === "pending" && f.dueDate && isPast(parseISO(f.dueDate)) && !isToday(parseISO(f.dueDate))), [followUps]);

  const newLeadsThisMonth  = leads.filter(l => new Date(l.submittedAt ?? 0) >= monthStart);
  const winsThisMonth      = leads.filter(l => WIN_STAGES.includes((l as any).stage || l.status) && new Date(l.submittedAt ?? 0) >= monthStart);
  const activePipeline     = leads.filter(l => ACTIVE_STAGES.includes((l as any).stage || l.status));
  const totalWon           = leads.filter(l => WIN_STAGES.includes((l as any).stage || l.status));

  // Pending quotes (sent but not yet accepted/declined)
  const pendingQuotes = useMemo(() => leads.filter(l => {
    const s = (l as any).stage || l.status;
    return s === "quote_sent" || s === "follow_up_due" || s === "quoted";
  }).sort((a, b) => {
    const aOverdue = a.followUpDate && isPast(new Date(a.followUpDate as any)) ? 1 : 0;
    const bOverdue = b.followUpDate && isPast(new Date(b.followUpDate as any)) ? 1 : 0;
    return bOverdue - aOverdue;
  }), [leads]);

  // Accepted work pending (any incomplete step)
  const acceptedWorkPending = useMemo(() =>
    acceptedWFs.filter(w => w.workflowStatus !== "complete" && w.workflowStatus !== "invoiced"),
  [acceptedWFs]);

  // Price increases in next 60 days
  const priceIncreases = useMemo(() => serviceContracts.filter(c => {
    if (!c.increaseDate || !c.activeStatus) return false;
    try {
      const d = parseISO(c.increaseDate);
      const rangeEnd = addMonths(now, 2);
      return !isPast(d) && isFuture(d) && isWithinInterval(d, { start: startOfDay(now), end: rangeEnd });
    } catch { return false; }
  }), [serviceContracts]);

  // Needs Action Today — consolidated action items
  type ActionItem = { id: string; category: string; catColor: string; company: string; ref?: string; rep?: string; reason: string; daysOver?: number; href: string; btnLabel: string; btnAction?: () => void; };

  const actionItems = useMemo((): ActionItem[] => {
    const items: ActionItem[] = [];

    overdueFU.forEach(f => {
      const lead = leads.find(l => l.id === f.leadId);
      const rep  = workers.find(w => w.id === lead?.assignedTo);
      const days = daysSince(f.dueDate);
      items.push({ id: `ofu-${f.id}`, category: "Overdue Follow-up", catColor: "bg-red-100 text-red-700",
        company: lead?.companyName ?? "—", ref: lead?.quoteNumber ?? undefined, rep: rep?.name,
        reason: `${f.method ?? "Follow-up"} overdue`, daysOver: days,
        href: "/follow-ups", btnLabel: "Mark Complete",
        btnAction: () => completeFU.mutate(f.id) });
    });

    todayFU.forEach(f => {
      const lead = leads.find(l => l.id === f.leadId);
      const rep  = workers.find(w => w.id === lead?.assignedTo);
      items.push({ id: `tfu-${f.id}`, category: "Follow-up Due Today", catColor: "bg-amber-100 text-amber-700",
        company: lead?.companyName ?? "—", ref: lead?.quoteNumber ?? undefined, rep: rep?.name,
        reason: f.method ?? "Follow-up due today",
        href: "/follow-ups", btnLabel: "Add Note" });
    });

    staleLeads.slice(0, 10).forEach(l => {
      const rep  = workers.find(w => w.id === l.assignedTo);
      const days = daysSince(l.submittedAt) - staleThreshold((l as any).priority);
      items.push({ id: `stale-${l.id}`, category: "Stale Lead", catColor: "bg-orange-100 text-orange-700",
        company: l.companyName, ref: l.quoteNumber ?? undefined, rep: rep?.name,
        reason: `No activity for ${daysSince(l.submittedAt)} days`, daysOver: days,
        href: "/leads", btnLabel: "Open Lead" });
    });

    acceptedWFs.filter(w => !w.contractDrafted && w.workflowStatus !== "complete").forEach(w => {
      const rep = workers.find(wo => wo.id === w.salesRepId);
      items.push({ id: `nocon-${w.id}`, category: "No Contract Created", catColor: "bg-purple-100 text-purple-700",
        company: w.companyName, ref: w.quoteNumber ?? undefined, rep: rep?.name,
        reason: "Accepted quote — contract not yet drafted",
        href: "/accepted-work", btnLabel: "Create Contract" });
    });

    acceptedWFs.filter(w => w.contractSent && !w.contractSigned).forEach(w => {
      const rep  = workers.find(wo => wo.id === w.salesRepId);
      const days = w.contractSentAt ? daysSince(w.contractSentAt) : undefined;
      items.push({ id: `unsig-${w.id}`, category: "Contract Not Signed", catColor: "bg-blue-100 text-blue-700",
        company: w.companyName, ref: w.quoteNumber ?? undefined, rep: rep?.name,
        reason: `Contract sent${days !== undefined ? ` ${days} days ago` : ""} — awaiting signature`,
        daysOver: days,
        href: "/accepted-work", btnLabel: "Mark Signed" });
    });

    acceptedWFs.filter(w => !w.regComplete && w.workflowStatus !== "complete").forEach(w => {
      const rep = workers.find(wo => wo.id === w.salesRepId);
      items.push({ id: `reg-${w.id}`, category: "Registration Outstanding", catColor: "bg-teal-100 text-teal-700",
        company: w.companyName, ref: w.quoteNumber ?? undefined, rep: rep?.name,
        reason: !w.regFormSent ? "Registration form not yet sent" : "Registration form sent — awaiting return",
        href: "/accepted-work", btnLabel: !w.regFormSent ? "Send Reg Form" : "Mark Received" });
    });

    acceptedWFs.filter(w => w.serviceScheduled && !w.contractSigned).forEach(w => {
      const rep = workers.find(wo => wo.id === w.salesRepId);
      items.push({ id: `presig-${w.id}`, category: "Service Before Contract", catColor: "bg-pink-100 text-pink-700",
        company: w.companyName, ref: w.quoteNumber ?? undefined, rep: rep?.name,
        reason: "Service scheduled but contract not yet signed",
        href: "/accepted-work", btnLabel: "Open Record" });
    });

    priceIncreases.forEach(c => {
      const days = daysUntil(c.increaseDate);
      items.push({ id: `pri-${c.id}`, category: "Price Increase Due", catColor: "bg-yellow-100 text-yellow-700",
        company: c.customerName ?? c.clientId, reason: `Price increase on ${fmtDate(c.increaseDate)} — ${days} days away`,
        href: "/contracts", btnLabel: "View Contract" });
    });

    return items;
  }, [overdueFU, todayFU, staleLeads, acceptedWFs, priceIncreases, leads, workers]);

  // Today's appointments
  const todayStr = format(now, "yyyy-MM-dd");
  const todayAppts = useMemo(() => {
    let list = appointments.filter(a => a.date === todayStr);
    if (diaryFilter === "mine" && myWorkerId) list = list.filter(a => a.assignedToId === myWorkerId);
    else if (diaryFilter !== "all") list = list.filter(a => a.assignedToId === diaryFilter);
    return list.sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [appointments, diaryFilter, myWorkerId, todayStr]);

  // Origination counts
  const origCounts = useMemo(() => {
    const map: Record<string, number> = {};
    leads.forEach(l => { const o = l.origination ?? "other"; map[o] = (map[o] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [leads]);

  // Salesperson performance
  const repCounts = useMemo(() => {
    const map: Record<string, { name: string; active: number; won: number }> = {};
    leads.forEach(l => {
      const rep = l.assignedTo; if (!rep) return;
      if (!map[rep]) { const w = workers.find(w => w.id === rep); map[rep] = { name: w?.name ?? rep, active: 0, won: 0 }; }
      const s = (l as any).stage || l.status;
      if (ACTIVE_STAGES.includes(s)) map[rep].active++;
      if (WIN_STAGES.includes(s)) map[rep].won++;
    });
    return Object.values(map).sort((a, b) => b.active + b.won - (a.active + a.won));
  }, [leads, workers]);

  const stageCount = useMemo(() => {
    const map: Record<string, number> = {};
    leads.forEach(l => { const s = (l as any).stage || l.status || "new"; map[s] = (map[s] || 0) + 1; });
    return map;
  }, [leads]);
  const funnelStages = LEAD_STAGES.filter(s => ACTIVE_STAGES.includes(s.value));

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Sales Dashboard" />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-20 lg:pb-6">
          <div className="max-w-7xl mx-auto space-y-6">

            {/* ── Page heading ──────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Sales Dashboard</h1>
                <p className="text-sm text-gray-500 mt-0.5">{format(now, "EEEE, d MMMM yyyy")}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "Pipeline",   href: "/leads",             icon: TrendingUp },
                  { label: "Quotes",     href: "/quotes",            icon: FileText },
                  { label: "Follow-ups", href: "/follow-ups",        icon: Bell },
                  { label: "Diary",      href: "/sales-diary",       icon: Calendar },
                  { label: "Commission", href: "/commission-reports", icon: BarChart3 },
                ].map(item => (
                  <Button key={item.href} size="sm" variant="outline" onClick={() => navigate(item.href)} className="gap-1 text-xs">
                    <item.icon className="h-3.5 w-3.5" /> {item.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* ── 1. KPI cards ──────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <Card className="border-blue-100">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total Leads</span>
                    <TrendingUp className="h-4 w-4 text-blue-400" />
                  </div>
                  <p className="text-3xl font-bold text-blue-700">{leads.length}</p>
                  <p className="text-xs text-gray-400 mt-0.5">+{newLeadsThisMonth.length} this month</p>
                </CardContent>
              </Card>

              <Card className="border-orange-100">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Active Pipeline</span>
                    <Target className="h-4 w-4 text-orange-400" />
                  </div>
                  <p className="text-3xl font-bold text-orange-600">{activePipeline.length}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{staleLeads.length} stale</p>
                </CardContent>
              </Card>

              <Card className="border-green-100">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Won / Converted</span>
                    <CheckCircle className="h-4 w-4 text-green-400" />
                  </div>
                  <p className="text-3xl font-bold text-green-700">{totalWon.length}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{winsThisMonth.length} this month</p>
                </CardContent>
              </Card>

              <Card className="border-purple-100">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Follow-ups Due</span>
                    <Bell className="h-4 w-4 text-purple-400" />
                  </div>
                  <p className="text-3xl font-bold text-purple-700">{todayFU.length + overdueFU.length}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{todayFU.length} today · {overdueFU.length} overdue</p>
                </CardContent>
              </Card>

              <Card
                className="border-rose-100 cursor-pointer hover:bg-rose-50 transition-colors"
                onClick={() => navigate("/accepted-work")}
              >
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Accepted Work Pending</span>
                    <ClipboardList className="h-4 w-4 text-rose-400" />
                  </div>
                  <p className="text-3xl font-bold text-rose-600">{acceptedWorkPending.length}</p>
                  <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                    Steps outstanding <ChevronRight className="h-3 w-3" />
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* ── 2. Needs Action Today ─────────────────────────────────── */}
            <Card>
              <CardHeader className="pb-2 pt-4">
                <SectionTitle icon={AlertTriangle} label="Needs Action Today" count={actionItems.length} color="text-red-500" />
              </CardHeader>
              <CardContent className="pt-0">
                {actionItems.length === 0 ? (
                  <EmptyState msg="Nothing needs action today — great work!" />
                ) : (
                  <div className="space-y-1.5 max-h-[420px] overflow-y-auto">
                    {actionItems.map(item => (
                      <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-100 bg-white hover:bg-gray-50 transition-colors">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${item.catColor}`}>
                          {item.category}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-gray-900 truncate">{item.company}</span>
                            {item.ref && <span className="text-xs text-gray-400">#{item.ref}</span>}
                            {item.rep && <span className="text-xs text-gray-500">· {item.rep}</span>}
                          </div>
                          <p className="text-xs text-gray-500 truncate">{item.reason}</p>
                        </div>
                        {item.daysOver !== undefined && item.daysOver > 0 && (
                          <Badge variant="destructive" className="text-[10px] flex-shrink-0">{item.daysOver}d</Badge>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7 flex-shrink-0 gap-1"
                          onClick={() => { if (item.btnAction) item.btnAction(); else navigate(item.href); }}
                        >
                          {item.btnLabel}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── 3. Today's Sales Diary ────────────────────────────────── */}
            <Card>
              <CardHeader className="pb-2 pt-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <SectionTitle icon={Calendar} label="Today's Sales Diary" count={todayAppts.length} color="text-blue-500" />
                  <div className="flex gap-1 flex-wrap">
                    {[
                      { key: "mine", label: "My Diary" },
                      { key: "all",  label: "All Reps" },
                      ...salesWorkers.map(w => ({ key: w.id, label: w.name })),
                    ].map(opt => (
                      <button
                        key={opt.key}
                        onClick={() => setDiaryFilter(opt.key)}
                        className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all border ${
                          diaryFilter === opt.key
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {todayAppts.length === 0 ? (
                  <EmptyState msg={`No appointments scheduled for today${diaryFilter === "mine" ? " (you)" : ""}.`} />
                ) : (
                  <div className="space-y-2">
                    {todayAppts.map(appt => {
                      const rep = workers.find(w => w.id === appt.assignedToId);
                      const color = APPT_COLORS[appt.appointmentType] ?? "#64748b";
                      return (
                        <div key={appt.id} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 bg-white hover:bg-gray-50 transition-colors"
                          style={{ borderLeftColor: color, borderLeftWidth: 3 }}>
                          <div className="min-w-[80px] flex-shrink-0">
                            <p className="text-sm font-bold text-gray-800">{fmtTime(appt.startTime)}</p>
                            <p className="text-xs text-gray-400">{fmtTime(appt.endTime)}</p>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                              <span className="text-sm font-semibold text-gray-900">{appt.clientName}</span>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0" style={{ color }}>
                                {APPT_LABELS[appt.appointmentType] ?? appt.appointmentType}
                              </Badge>
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${appt.status === "completed" ? "bg-green-50 text-green-700" : appt.status === "cancelled" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"}`}>
                                {appt.status}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500">
                              {appt.contactPerson && <span className="flex items-center gap-1"><UserCheck className="h-3 w-3" />{appt.contactPerson}</span>}
                              {appt.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{appt.phone}</span>}
                              {appt.siteAddress && <span className="truncate max-w-[220px]">{appt.siteAddress}</span>}
                              {rep && <span className="flex items-center gap-1 text-blue-600 font-medium"><Users className="h-3 w-3" />{rep.name}</span>}
                            </div>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => navigate(`/sales-diary`)}>
                              Open
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <Button size="sm" variant="outline" className="w-full mt-3 text-xs h-7" onClick={() => navigate("/sales-diary")}>
                  Full Diary <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </CardContent>
            </Card>

            {/* ── 4. Pending Quotes ─────────────────────────────────────── */}
            <Card>
              <CardHeader className="pb-2 pt-4">
                <SectionTitle icon={FileText} label="Pending Quotes" count={pendingQuotes.length} color="text-purple-500" />
              </CardHeader>
              <CardContent className="pt-0">
                {pendingQuotes.length === 0 ? (
                  <EmptyState msg="No pending quotes right now." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b text-left">
                          {["Client","Contact","Quote #","Value","Monthly","Service","Status","Sent","Days","Follow-up","Rep","Action"].map(h => (
                            <th key={h} className="pb-2 pr-3 font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pendingQuotes.map(q => {
                          const rep = workers.find(w => w.id === q.assignedTo);
                          const daysSent = q.quoteSentAt ? daysSince(q.quoteSentAt) : q.submittedAt ? daysSince(q.submittedAt) : 0;
                          const fuDate = q.followUpDate ? new Date(q.followUpDate as any) : null;
                          const fuOverdue = fuDate && isPast(fuDate) && !isToday(fuDate);
                          const fuDaysOver = fuDate && fuOverdue ? differenceInDays(now, fuDate) : 0;
                          const stage = LEAD_STAGES.find(s => s.value === ((q as any).stage || q.status));
                          return (
                            <tr key={q.id} className="border-b border-gray-50 hover:bg-gray-50">
                              <td className="py-2 pr-3 font-semibold text-gray-900 whitespace-nowrap max-w-[140px] truncate">{q.companyName}</td>
                              <td className="py-2 pr-3 text-gray-600 whitespace-nowrap">{q.contactPerson}</td>
                              <td className="py-2 pr-3 font-mono text-gray-700">{q.quoteNumber ?? "—"}</td>
                              <td className="py-2 pr-3 font-semibold text-gray-800 whitespace-nowrap">{q.quoteAmount ? `R ${q.quoteAmount}` : "—"}</td>
                              <td className="py-2 pr-3 text-gray-500 whitespace-nowrap">{q.monthlyRecurring ? `R ${q.monthlyRecurring}/mo` : "—"}</td>
                              <td className="py-2 pr-3">
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 whitespace-nowrap">{SERVICE_LABELS[q.serviceType] ?? q.serviceType}</Badge>
                              </td>
                              <td className="py-2 pr-3">
                                {stage ? (
                                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${stage.color}`}>{stage.label}</span>
                                ) : (
                                  <span className="text-gray-400">{q.status}</span>
                                )}
                              </td>
                              <td className="py-2 pr-3 text-gray-500 whitespace-nowrap">{q.quoteSentAt ? format(new Date(q.quoteSentAt as any), "d MMM") : "—"}</td>
                              <td className="py-2 pr-3">
                                <span className={`font-semibold ${daysSent > 14 ? "text-red-600" : daysSent > 7 ? "text-amber-600" : "text-gray-700"}`}>{daysSent}d</span>
                              </td>
                              <td className="py-2 pr-3 whitespace-nowrap">
                                {fuDate ? (
                                  <span className={`font-medium ${fuOverdue ? "text-red-600" : "text-gray-600"}`}>
                                    {fuOverdue ? `${fuDaysOver}d overdue` : format(fuDate, "d MMM")}
                                  </span>
                                ) : "—"}
                              </td>
                              <td className="py-2 pr-3 text-gray-600 whitespace-nowrap">{rep?.name ?? "—"}</td>
                              <td className="py-2">
                                <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => navigate(`/quotes`)}>
                                  Open
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                <Button size="sm" variant="outline" className="w-full mt-3 text-xs h-7" onClick={() => navigate("/quotes")}>
                  All Quotes <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </CardContent>
            </Card>

            {/* ── 5 + 6. Origination + Salesperson ─────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Leads by Origination */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Megaphone className="h-4 w-4 text-indigo-400" />
                    Leads by Origination
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2.5">
                    {origCounts.length === 0 && <p className="text-xs text-gray-400 text-center py-4">No data yet</p>}
                    {origCounts.map(([orig, count]) => {
                      const pct = leads.length > 0 ? Math.round((count / leads.length) * 100) : 0;
                      return (
                        <div key={orig}>
                          <div className="flex justify-between text-xs mb-0.5">
                            <span className="text-gray-600 font-medium">{ORIGINATION_LABELS[orig] ?? orig}</span>
                            <span className="text-gray-400">{count} ({pct}%)</span>
                          </div>
                          <div className="bg-gray-100 rounded-full h-2">
                            <div className="bg-indigo-400 h-2 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Salesperson Performance */}
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Users className="h-4 w-4 text-teal-500" />
                    Salesperson Performance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {repCounts.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">No leads assigned to salespersons yet</p>
                  ) : (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="pb-1.5 font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                          <th className="pb-1.5 font-semibold text-gray-500 uppercase tracking-wide text-right">Active</th>
                          <th className="pb-1.5 font-semibold text-gray-500 uppercase tracking-wide text-right">Won</th>
                          <th className="pb-1.5 font-semibold text-gray-500 uppercase tracking-wide text-right">Win %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {repCounts.map(rep => {
                          const total = rep.active + rep.won;
                          const winPct = total > 0 ? Math.round((rep.won / total) * 100) : 0;
                          return (
                            <tr key={rep.name} className="border-b border-gray-50">
                              <td className="py-1.5 font-medium text-gray-800">{rep.name}</td>
                              <td className="py-1.5 text-right text-blue-600 font-semibold">{rep.active}</td>
                              <td className="py-1.5 text-right text-green-600 font-semibold">{rep.won}</td>
                              <td className="py-1.5 text-right">
                                <span className={`px-1.5 py-0.5 rounded-full font-semibold ${winPct >= 50 ? "bg-green-100 text-green-700" : winPct >= 25 ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"}`}>
                                  {winPct}%
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                  <Button size="sm" variant="outline" className="w-full mt-3 text-xs h-7" onClick={() => navigate("/commission-reports")}>
                    Commission Reports <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* ── 7. Pipeline Funnel + Service Type ─────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-blue-500" />
                    Pipeline Funnel
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {funnelStages.map(s => {
                      const count = stageCount[s.value] || 0;
                      const maxCount = Math.max(...funnelStages.map(fs => stageCount[fs.value] || 0), 1);
                      const pct = Math.round((count / maxCount) * 100);
                      return (
                        <div key={s.value} className="flex items-center gap-3">
                          <span className="text-xs text-gray-500 w-36 flex-shrink-0 truncate">{s.label}</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                            <div className={`h-5 rounded-full transition-all ${s.color.split(" ")[0].replace("text-", "bg-").replace("100", "300")} min-w-[2px]`}
                              style={{ width: count > 0 ? `${Math.max(pct, 4)}%` : "2px" }} />
                          </div>
                          <span className="text-xs font-semibold text-gray-700 w-6 text-right">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 pt-3 border-t flex items-center justify-between">
                    <span className="text-xs text-gray-400">Leads → Quotes → Contracts → Complete</span>
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => navigate("/leads")}>
                      Full Pipeline <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-gray-400" />
                    Service Type Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2.5">
                    {Object.entries(SERVICE_LABELS).map(([key, label]) => {
                      const count = leads.filter(l => l.serviceType === key).length;
                      const pct = leads.length > 0 ? Math.round((count / leads.length) * 100) : 0;
                      const colors: Record<string, string> = {
                        pest_control: "bg-green-400", sanitary_bins: "bg-purple-400",
                        washroom: "bg-blue-400", deep_cleaning: "bg-orange-400",
                      };
                      return (
                        <div key={key}>
                          <div className="flex justify-between text-xs mb-0.5">
                            <span className="text-gray-600 font-medium">{label}</span>
                            <span className="text-gray-400">{count} ({pct}%)</span>
                          </div>
                          <div className="bg-gray-100 rounded-full h-2">
                            <div className={`${colors[key]} h-2 rounded-full`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

          </div>
        </main>
      </div>
      <MobileNavigation />
    </div>
  );
}
