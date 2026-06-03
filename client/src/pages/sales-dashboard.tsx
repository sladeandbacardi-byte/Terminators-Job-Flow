import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format, isToday, isPast, parseISO, differenceInDays, addDays } from "date-fns";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import MobileNavigation from "@/components/layout/mobile-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TrendingUp, Bell, AlertTriangle, CheckCircle, Clock, Users, FileText,
  ArrowRight, DollarSign, Target, Calendar, Megaphone, BarChart3,
} from "lucide-react";
import type { QuoteSubmission, SalesFollowUp, Worker } from "@shared/schema";
import { LEAD_STAGES, ORIGINATION_LABELS } from "@shared/schema";

// Stale-lead thresholds (days without stage advancement)
const STALE_DAYS: Record<string, number> = { high: 2, medium: 5, low: 7 };

const ACTIVE_STAGES = [
  "new","contacted","appointment_scheduled","site_assessment_done",
  "quote_needed","quote_sent","follow_up_due",
];

const WIN_STAGES = ["accepted","contract_pending","converted_contract","converted_job","installation_scheduled","invoiced","complete"];

const SERVICE_LABELS: Record<string, string> = {
  pest_control: "Pest Control",
  sanitary_bins: "Sanitary Bins",
  washroom: "Washroom",
  deep_cleaning: "Deep Cleaning",
};

function staleThreshold(priority: string | null | undefined) {
  return STALE_DAYS[priority ?? "medium"] ?? 5;
}

function daysSince(date: any): number {
  if (!date) return 0;
  return differenceInDays(new Date(), new Date(date));
}

export default function SalesDashboard() {
  const [, navigate] = useLocation();

  const { data: leads = [] } = useQuery<QuoteSubmission[]>({ queryKey: ["/api/quote-submissions"] });
  const { data: followUps = [] } = useQuery<SalesFollowUp[]>({ queryKey: ["/api/sales-follow-ups"] });
  const { data: workers = [] } = useQuery<Worker[]>({ queryKey: ["/api/workers"] });

  const salesWorkers = workers.filter(w => w.departmentId === "div-5" && w.isActive !== false);

  // ── Pipeline counts by stage ──────────────────────────────────────────────
  const stageCount = useMemo(() => {
    const map: Record<string, number> = {};
    leads.forEach(l => {
      const s = (l as any).stage || l.status || "new";
      map[s] = (map[s] || 0) + 1;
    });
    return map;
  }, [leads]);

  // ── Stale leads ───────────────────────────────────────────────────────────
  const staleLeads = useMemo(() =>
    leads.filter(l => {
      const s = (l as any).stage || l.status;
      if (!ACTIVE_STAGES.includes(s)) return false;
      const days = daysSince(l.submittedAt);
      const threshold = staleThreshold((l as any).priority);
      return days > threshold;
    }).sort((a, b) => daysSince(b.submittedAt) - daysSince(a.submittedAt)),
    [leads]
  );

  // ── Today's follow-ups ────────────────────────────────────────────────────
  const todayFU = useMemo(() =>
    followUps.filter(f => f.status === "pending" && f.dueDate && isToday(parseISO(f.dueDate))),
    [followUps]
  );
  const overdueFU = useMemo(() =>
    followUps.filter(f => f.status === "pending" && f.dueDate && isPast(parseISO(f.dueDate)) && !isToday(parseISO(f.dueDate))),
    [followUps]
  );

  // ── Wins this month ───────────────────────────────────────────────────────
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const winsThisMonth = leads.filter(l => {
    const s = (l as any).stage || l.status;
    return WIN_STAGES.includes(s) && new Date(l.submittedAt ?? 0) >= monthStart;
  });
  const newLeadsThisMonth = leads.filter(l => new Date(l.submittedAt ?? 0) >= monthStart);

  // ── Origination breakdown ─────────────────────────────────────────────────
  const origCounts = useMemo(() => {
    const map: Record<string, number> = {};
    leads.forEach(l => {
      const o = l.origination ?? "other";
      map[o] = (map[o] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [leads]);

  // ── Salesperson pipeline breakdown ────────────────────────────────────────
  const repCounts = useMemo(() => {
    const map: Record<string, { name: string; active: number; won: number }> = {};
    leads.forEach(l => {
      const rep = l.assignedTo;
      if (!rep) return;
      if (!map[rep]) {
        const w = workers.find(w => w.id === rep);
        map[rep] = { name: w?.name ?? rep, active: 0, won: 0 };
      }
      const s = (l as any).stage || l.status;
      if (ACTIVE_STAGES.includes(s)) map[rep].active++;
      if (WIN_STAGES.includes(s)) map[rep].won++;
    });
    return Object.values(map).sort((a, b) => b.active + b.won - (a.active + a.won));
  }, [leads, workers]);

  // ── Pipeline funnel data ──────────────────────────────────────────────────
  const funnelStages = LEAD_STAGES.filter(s => ACTIVE_STAGES.includes(s.value));

  // ── Price increase warnings: contracts with increaseDate in next 30 days ──
  // (stored in service_contracts table — query via jobs or rental contracts)

  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Sales Dashboard" />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-20 lg:pb-6">
          <div className="max-w-7xl mx-auto space-y-6">

            {/* ── Page heading ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Sales Dashboard</h1>
                <p className="text-sm text-gray-500 mt-0.5">Live pipeline overview for {format(now, "MMMM yyyy")}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => navigate("/leads")} className="gap-1 text-xs">
                  <TrendingUp className="h-3.5 w-3.5" /> Pipeline
                </Button>
                <Button size="sm" variant="outline" onClick={() => navigate("/follow-ups")} className="gap-1 text-xs">
                  <Bell className="h-3.5 w-3.5" /> Follow-ups
                </Button>
                <Button size="sm" variant="outline" onClick={() => navigate("/commission-reports")} className="gap-1 text-xs">
                  <BarChart3 className="h-3.5 w-3.5" /> Commission Reports
                </Button>
              </div>
            </div>

            {/* ── Alert strip ── */}
            {(staleLeads.length > 0 || overdueFU.length > 0) && (
              <div className="flex flex-wrap gap-3">
                {staleLeads.length > 0 && (
                  <div
                    onClick={() => navigate("/leads")}
                    className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 cursor-pointer hover:bg-red-100 transition-colors flex-1 min-w-[200px]"
                  >
                    <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-red-800">{staleLeads.length} Stale Lead{staleLeads.length !== 1 ? "s" : ""}</p>
                      <p className="text-xs text-red-600">No activity past threshold — click to review</p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-red-400 ml-auto" />
                  </div>
                )}
                {overdueFU.length > 0 && (
                  <div
                    onClick={() => navigate("/follow-ups")}
                    className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 cursor-pointer hover:bg-amber-100 transition-colors flex-1 min-w-[200px]"
                  >
                    <Bell className="h-4 w-4 text-amber-500 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-amber-800">{overdueFU.length} Overdue Follow-up{overdueFU.length !== 1 ? "s" : ""}</p>
                      <p className="text-xs text-amber-600">These needed attention before today</p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-amber-400 ml-auto" />
                  </div>
                )}
              </div>
            )}

            {/* ── KPI row ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
                  <p className="text-3xl font-bold text-orange-600">
                    {leads.filter(l => ACTIVE_STAGES.includes((l as any).stage || l.status)).length}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{staleLeads.length} stale</p>
                </CardContent>
              </Card>
              <Card className="border-green-100">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Won / Converted</span>
                    <CheckCircle className="h-4 w-4 text-green-400" />
                  </div>
                  <p className="text-3xl font-bold text-green-700">
                    {leads.filter(l => WIN_STAGES.includes((l as any).stage || l.status)).length}
                  </p>
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
                  <p className="text-xs text-gray-400 mt-0.5">{todayFU.length} today, {overdueFU.length} overdue</p>
                </CardContent>
              </Card>
            </div>

            {/* ── Main content grid ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* ── Pipeline funnel ── */}
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
                            <div
                              className={`h-5 rounded-full transition-all ${s.color.split(" ")[0].replace("text-", "bg-").replace("100", "300")} min-w-[2px]`}
                              style={{ width: count > 0 ? `${Math.max(pct, 4)}%` : "2px" }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-gray-700 w-6 text-right">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 pt-3 border-t flex items-center justify-between">
                    <span className="text-xs text-gray-400">All stages: Leads → Contracts → Complete</span>
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => navigate("/leads")}>
                      View Full Pipeline <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* ── Today's agenda ── */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-purple-500" />
                    Today's Agenda
                    {(todayFU.length + overdueFU.length) > 0 && (
                      <Badge className="ml-auto text-xs bg-red-500 text-white">{todayFU.length + overdueFU.length}</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {todayFU.length === 0 && overdueFU.length === 0 ? (
                    <div className="text-center py-6 text-gray-400 text-sm">
                      <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-300" />
                      All clear — no follow-ups due today
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[280px] overflow-y-auto">
                      {[...overdueFU, ...todayFU].map(fu => {
                        const lead = leads.find(l => l.id === fu.leadId);
                        const isOverdue = fu.dueDate && isPast(parseISO(fu.dueDate)) && !isToday(parseISO(fu.dueDate));
                        return (
                          <div key={fu.id} className={`flex items-start gap-2 p-2 rounded-lg border text-xs ${isOverdue ? "bg-red-50 border-red-100" : "bg-amber-50 border-amber-100"}`}>
                            <Clock className={`h-3.5 w-3.5 mt-0.5 flex-shrink-0 ${isOverdue ? "text-red-400" : "text-amber-400"}`} />
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-800 truncate">{lead?.companyName ?? "Unknown lead"}</p>
                              <p className="text-gray-500">{fu.method ?? "Follow-up"} · {fu.dueDate ? format(parseISO(fu.dueDate), "d MMM") : ""}</p>
                              {isOverdue && <p className="text-red-500 font-medium">Overdue</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <Button size="sm" variant="outline" className="w-full mt-3 text-xs h-7" onClick={() => navigate("/follow-ups")}>
                    All Follow-ups <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </CardContent>
              </Card>

              {/* ── Stale leads ── */}
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-400" />
                    Stale Leads
                    <span className="text-xs font-normal text-gray-400 ml-1">— High &gt;{STALE_DAYS.high}d, Medium &gt;{STALE_DAYS.medium}d, Low &gt;{STALE_DAYS.low}d</span>
                    {staleLeads.length > 0 && (
                      <Badge variant="destructive" className="ml-auto text-xs">{staleLeads.length}</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {staleLeads.length === 0 ? (
                    <div className="text-center py-6 text-gray-400 text-sm">
                      <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-300" />
                      No stale leads — pipeline is moving well!
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-[260px] overflow-y-auto">
                      {staleLeads.map(l => {
                        const days = daysSince(l.submittedAt);
                        const threshold = staleThreshold((l as any).priority);
                        const daysOver = days - threshold;
                        const rep = l.assignedTo ? workers.find(w => w.id === l.assignedTo) : null;
                        const stage = LEAD_STAGES.find(s => s.value === ((l as any).stage || l.status));
                        return (
                          <div key={l.id} className="flex items-center gap-3 p-2 rounded-lg bg-red-50 border border-red-100 text-xs">
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-gray-900 truncate">{l.companyName}</p>
                              <div className="flex items-center gap-2 text-gray-500 flex-wrap">
                                <span>{stage?.label ?? l.status}</span>
                                {rep && <span>· {rep.name}</span>}
                                <span className="text-red-600 font-medium">· {daysOver}d over threshold ({days}d ago)</span>
                              </div>
                            </div>
                            <Badge
                              variant="outline"
                              className={`flex-shrink-0 text-[10px] ${(l as any).priority === "high" ? "border-red-300 text-red-600" : (l as any).priority === "low" ? "border-gray-300 text-gray-500" : "border-blue-300 text-blue-600"}`}
                            >
                              {((l as any).priority ?? "medium").charAt(0).toUpperCase() + ((l as any).priority ?? "medium").slice(1)}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <Button size="sm" variant="outline" className="w-full mt-3 text-xs h-7" onClick={() => navigate("/leads")}>
                    View Pipeline <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </CardContent>
              </Card>

              {/* ── Origination breakdown ── */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Megaphone className="h-4 w-4 text-indigo-400" />
                    Lead Sources
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

              {/* ── Salesperson table ── */}
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Users className="h-4 w-4 text-teal-500" />
                    Salesperson Activity
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

              {/* ── Service type breakdown ── */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4 text-gray-400" />
                    By Service
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2.5">
                    {Object.entries(SERVICE_LABELS).map(([key, label]) => {
                      const count = leads.filter(l => l.serviceType === key).length;
                      const pct = leads.length > 0 ? Math.round((count / leads.length) * 100) : 0;
                      const colors: Record<string, string> = {
                        pest_control: "bg-green-400",
                        sanitary_bins: "bg-purple-400",
                        washroom: "bg-blue-400",
                        deep_cleaning: "bg-orange-400",
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

              {/* ── Quick links ── */}
              <Card className="lg:col-span-3">
                <CardContent className="pt-4 pb-3">
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: "Lead Pipeline",       href: "/leads",             icon: TrendingUp,  cls: "border-blue-200 text-blue-700 hover:bg-blue-50" },
                      { label: "Quotes",              href: "/quotes",            icon: FileText,    cls: "border-purple-200 text-purple-700 hover:bg-purple-50" },
                      { label: "Follow-ups",          href: "/follow-ups",        icon: Bell,        cls: "border-amber-200 text-amber-700 hover:bg-amber-50" },
                      { label: "Contracts Pending",   href: "/contracts-pending", icon: Clock,       cls: "border-teal-200 text-teal-700 hover:bg-teal-50" },
                      { label: "Clients",             href: "/clients",           icon: Users,       cls: "border-gray-200 text-gray-700 hover:bg-gray-50" },
                      { label: "Sales Diary",         href: "/sales-diary",       icon: Calendar,    cls: "border-green-200 text-green-700 hover:bg-green-50" },
                      { label: "Pricing Library",     href: "/pricing-library",   icon: DollarSign,  cls: "border-indigo-200 text-indigo-700 hover:bg-indigo-50" },
                      { label: "Commission Reports",  href: "/commission-reports",icon: BarChart3,   cls: "border-rose-200 text-rose-700 hover:bg-rose-50" },
                    ].map(item => (
                      <Button
                        key={item.href}
                        variant="outline"
                        size="sm"
                        className={`gap-1.5 text-xs ${item.cls}`}
                        onClick={() => navigate(item.href)}
                      >
                        <item.icon className="h-3.5 w-3.5" />
                        {item.label}
                      </Button>
                    ))}
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
