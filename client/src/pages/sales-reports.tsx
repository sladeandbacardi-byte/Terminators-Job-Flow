import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format, parseISO, startOfMonth, endOfMonth, subMonths, differenceInDays, isPast, isToday } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart3, TrendingUp, FileText, CheckCircle, XCircle, Users,
  Building2, RefreshCw, ClipboardList, PenLine, Bell, ArrowRight,
  DollarSign, PieChart, Calendar,
} from "lucide-react";
import type { QuoteSubmission, SalesFollowUp, Worker, AcceptedWorkflow } from "@shared/schema";
import { ORIGINATION_LABELS } from "@shared/schema";

// ─── Constants ────────────────────────────────────────────────────────────────

const ACTIVE_STAGES = ["new","contacted","appointment_scheduled","site_assessment_done","quote_needed","quote_sent","follow_up_due"];
const WIN_STAGES    = ["accepted","contract_pending","converted_contract","converted_job","installation_scheduled","invoiced","complete"];
const LOST_STAGES   = ["declined","lost","no_response","not_qualified"];
const QUOTE_STAGES  = ["quote_sent","follow_up_due","quoted"];

const SERVICE_LABELS: Record<string, string> = {
  pest_control: "Pest Control", sanitary_bins: "Sanitary Bins",
  washroom: "Washroom", deep_cleaning: "Deep Cleaning",
};

const REPORT_TABS = [
  { id: "overview",           icon: BarChart3,     label: "Sales Report"               },
  { id: "origination",        icon: PieChart,      label: "Leads by Origination"       },
  { id: "quotes_sent",        icon: FileText,      label: "Quotes Sent"                },
  { id: "quotes_accepted",    icon: CheckCircle,   label: "Quotes Accepted"            },
  { id: "quotes_lost",        icon: XCircle,       label: "Quotes Declined / Lost"     },
  { id: "sales_by_rep",       icon: Users,         label: "Sales by Rep"               },
  { id: "sales_by_dept",      icon: Building2,     label: "Sales by Department"        },
  { id: "monthly_recurring",  icon: RefreshCw,     label: "Monthly Recurring Added"    },
  { id: "outstanding",        icon: ClipboardList, label: "Outstanding Contracts"      },
  { id: "unsigned",           icon: PenLine,       label: "Unsigned Contracts"         },
  { id: "followup_perf",      icon: Bell,          label: "Follow-up Performance"      },
  { id: "commission",         icon: DollarSign,    label: "Commission Report"          },
];

function parseNum(v: any): number {
  const n = parseFloat(String(v ?? "0").replace(/[^\d.]/g, ""));
  return isNaN(n) ? 0 : n;
}
function fmtR(v: number) { return `R ${v.toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`; }
function fmtDate(d: any) { try { return format(parseISO(d), "d MMM yyyy"); } catch { return d ?? "—"; } }
function daysSince(d: any) { return d ? differenceInDays(new Date(), new Date(d)) : 0; }

// ─── Sub-components ───────────────────────────────────────────────────────────

function Stat({ label, value, sub, color = "text-gray-900" }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
  <>
    <div className="bg-white rounded-lg border p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  </>
  );
}

function SectionEmpty({ msg }: { msg: string }) {
  return <p className="text-sm text-gray-400 text-center py-8">{msg}</p>;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SalesReports() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("overview");
  const [monthRange, setMonthRange] = useState(3);

  const { data: leads = []      } = useQuery<QuoteSubmission[]>({ queryKey: ["/api/quote-submissions"] });
  const { data: followUps = []  } = useQuery<SalesFollowUp[]>({ queryKey: ["/api/sales-follow-ups"] });
  const { data: workers = []    } = useQuery<Worker[]>({ queryKey: ["/api/workers"] });
  const { data: accepted = []   } = useQuery<AcceptedWorkflow[]>({ queryKey: ["/api/accepted-workflows"] });

  const now = new Date();

  // Month buckets for last N months
  const months = useMemo(() => {
    const result: { label: string; start: Date; end: Date }[] = [];
    for (let i = monthRange - 1; i >= 0; i--) {
      const d = subMonths(now, i);
      result.push({ label: format(d, "MMM yyyy"), start: startOfMonth(d), end: endOfMonth(d) });
    }
    return result;
  }, [monthRange]);

  function inMonth(date: any, m: { start: Date; end: Date }) {
    if (!date) return false;
    const d = new Date(date);
    return d >= m.start && d <= m.end;
  }

  // ── Per-tab derived data ──────────────────────────────────────────────────

  // Overview
  const activeLeads   = leads.filter(l => ACTIVE_STAGES.includes((l as any).stage || l.status));
  const wonLeads      = leads.filter(l => WIN_STAGES.includes((l as any).stage || l.status));
  const lostLeads     = leads.filter(l => LOST_STAGES.includes((l as any).stage || l.status));
  const conversionRate = leads.length > 0 ? Math.round((wonLeads.length / leads.length) * 100) : 0;
  const totalOnceOff  = wonLeads.reduce((s, l) => s + parseNum(l.quoteAmount), 0);
  const totalMonthly  = wonLeads.reduce((s, l) => s + parseNum(l.monthlyRecurring), 0);

  // Quotes sent
  const quotesSent = useMemo(() =>
    leads.filter(l => {
      const s = (l as any).stage || l.status;
      return QUOTE_STAGES.includes(s) || s === "accepted";
    }).sort((a, b) => new Date(b.quoteSentAt ?? b.submittedAt ?? 0).getTime() - new Date(a.quoteSentAt ?? a.submittedAt ?? 0).getTime()),
  [leads]);

  // Quotes accepted
  const quotesAccepted = useMemo(() =>
    leads.filter(l => WIN_STAGES.includes((l as any).stage || l.status))
      .sort((a, b) => new Date(b.submittedAt ?? 0).getTime() - new Date(a.submittedAt ?? 0).getTime()),
  [leads]);

  // Quotes lost
  const quotesLost = useMemo(() =>
    leads.filter(l => LOST_STAGES.includes((l as any).stage || l.status))
      .sort((a, b) => new Date(b.submittedAt ?? 0).getTime() - new Date(a.submittedAt ?? 0).getTime()),
  [leads]);

  // Sales by rep
  const salesByRep = useMemo(() => {
    const map: Record<string, { name: string; active: number; won: number; lost: number; onceOff: number; monthly: number }> = {};
    leads.forEach(l => {
      const repId = l.assignedTo; if (!repId) return;
      if (!map[repId]) {
        const w = workers.find(w => w.id === repId);
        map[repId] = { name: w?.name ?? repId, active: 0, won: 0, lost: 0, onceOff: 0, monthly: 0 };
      }
      const s = (l as any).stage || l.status;
      if (ACTIVE_STAGES.includes(s)) map[repId].active++;
      if (WIN_STAGES.includes(s)) { map[repId].won++; map[repId].onceOff += parseNum(l.quoteAmount); map[repId].monthly += parseNum(l.monthlyRecurring); }
      if (LOST_STAGES.includes(s)) map[repId].lost++;
    });
    return Object.values(map).sort((a, b) => b.won - a.won);
  }, [leads, workers]);

  // Sales by department/service type
  const salesByDept = useMemo(() => {
    return Object.entries(SERVICE_LABELS).map(([key, label]) => {
      const deptLeads = leads.filter(l => l.serviceType === key);
      const won  = deptLeads.filter(l => WIN_STAGES.includes((l as any).stage || l.status));
      const lost = deptLeads.filter(l => LOST_STAGES.includes((l as any).stage || l.status));
      return {
        key, label,
        total: deptLeads.length,
        won: won.length,
        lost: lost.length,
        onceOff: won.reduce((s, l) => s + parseNum(l.quoteAmount), 0),
        monthly: won.reduce((s, l) => s + parseNum(l.monthlyRecurring), 0),
      };
    }).sort((a, b) => b.total - a.total);
  }, [leads]);

  // Monthly recurring added (by month)
  const monthlyRecurringByMonth = useMemo(() =>
    months.map(m => ({
      label: m.label,
      count: leads.filter(l => WIN_STAGES.includes((l as any).stage || l.status) && inMonth(l.submittedAt, m)).length,
      value: leads.filter(l => WIN_STAGES.includes((l as any).stage || l.status) && inMonth(l.submittedAt, m))
        .reduce((s, l) => s + parseNum(l.monthlyRecurring), 0),
    })),
  [leads, months]);

  // Outstanding contracts (accepted, contract not yet signed)
  const outstandingContracts = useMemo(() =>
    accepted.filter(w => !w.contractSigned && w.workflowStatus !== "complete"),
  [accepted]);

  // Unsigned contracts (sent but not signed)
  const unsignedContracts = useMemo(() =>
    accepted.filter(w => w.contractSent && !w.contractSigned),
  [accepted]);

  // Follow-up performance
  const fuCompleted = followUps.filter(f => f.status === "completed");
  const fuOverdue   = followUps.filter(f => f.status === "pending" && f.dueDate && isPast(parseISO(f.dueDate)) && !isToday(parseISO(f.dueDate)));
  const fuPending   = followUps.filter(f => f.status === "pending");

  // Origination counts
  const origCounts = useMemo(() => {
    const map: Record<string, number> = {};
    leads.forEach(l => { const o = l.origination ?? "other"; map[o] = (map[o] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [leads]);

  // ── Common table helpers ──────────────────────────────────────────────────

  function repName(id: string | null | undefined) {
    return workers.find(w => w.id === id)?.name ?? "—";
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const activeTabCfg = REPORT_TABS.find(t => t.id === activeTab);

  return (
        <div className="pb-20 lg:pb-6">
          <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-4">

            {/* Heading */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Sales Reports</h1>
                <p className="text-sm text-gray-500 mt-0.5">{format(now, "EEEE, d MMMM yyyy")}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => navigate("/commission-reports")} className="gap-1 text-xs">
                <DollarSign className="h-3.5 w-3.5" /> Commission Reports
              </Button>
            </div>

            {/* Tab bar */}
            <div className="flex flex-wrap gap-1.5">
              {REPORT_TABS.map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                      activeTab === tab.id
                        ? "bg-gray-900 text-white border-gray-900"
                        : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* ── Sales Report (overview) ───────────────────────────────── */}
            {activeTab === "overview" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <Stat label="Total Leads"      value={leads.length} />
                  <Stat label="Active Pipeline"  value={activeLeads.length} color="text-blue-700" />
                  <Stat label="Won / Converted"  value={wonLeads.length} color="text-green-700" />
                  <Stat label="Lost"             value={lostLeads.length} color="text-red-600" />
                  <Stat label="Conversion Rate"  value={`${conversionRate}%`} color={conversionRate >= 30 ? "text-green-700" : "text-amber-600"} />
                  <Stat label="Accepted MRR"     value={fmtR(totalMonthly)} sub={`${fmtR(totalOnceOff)} once-off`} color="text-purple-700" />
                </div>

                {/* Monthly trend */}
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">Monthly Trend</CardTitle>
                      <div className="flex gap-1">
                        {[3, 6, 12].map(n => (
                          <button key={n} onClick={() => setMonthRange(n)}
                            className={`text-xs px-2 py-0.5 rounded border ${monthRange === n ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 text-gray-500"}`}>
                            {n}m
                          </button>
                        ))}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b">
                            <th className="pb-1.5 text-left font-semibold text-gray-500 uppercase tracking-wide">Month</th>
                            <th className="pb-1.5 text-right font-semibold text-gray-500 uppercase tracking-wide">New Leads</th>
                            <th className="pb-1.5 text-right font-semibold text-gray-500 uppercase tracking-wide">Won</th>
                            <th className="pb-1.5 text-right font-semibold text-gray-500 uppercase tracking-wide">Lost</th>
                            <th className="pb-1.5 text-right font-semibold text-gray-500 uppercase tracking-wide">Once-off Value</th>
                            <th className="pb-1.5 text-right font-semibold text-gray-500 uppercase tracking-wide">Monthly Recurring</th>
                          </tr>
                        </thead>
                        <tbody>
                          {months.map(m => {
                            const mLeads = leads.filter(l => inMonth(l.submittedAt, m));
                            const mWon   = mLeads.filter(l => WIN_STAGES.includes((l as any).stage || l.status));
                            const mLost  = mLeads.filter(l => LOST_STAGES.includes((l as any).stage || l.status));
                            return (
                              <tr key={m.label} className="border-b border-gray-50">
                                <td className="py-1.5 font-medium text-gray-800">{m.label}</td>
                                <td className="py-1.5 text-right text-gray-600">{mLeads.length}</td>
                                <td className="py-1.5 text-right text-green-600 font-semibold">{mWon.length}</td>
                                <td className="py-1.5 text-right text-red-500">{mLost.length}</td>
                                <td className="py-1.5 text-right text-gray-700">{fmtR(mWon.reduce((s, l) => s + parseNum(l.quoteAmount), 0))}</td>
                                <td className="py-1.5 text-right text-purple-600 font-semibold">{fmtR(mWon.reduce((s, l) => s + parseNum(l.monthlyRecurring), 0))}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ── Leads by Origination ─────────────────────────────────── */}
            {activeTab === "origination" && (
              <Card>
                <CardContent className="pt-4">
                  {origCounts.length === 0 ? <SectionEmpty msg="No leads recorded yet." /> : (
                    <div className="space-y-3 max-w-lg">
                      {origCounts.map(([orig, count]) => {
                        const pct = leads.length > 0 ? Math.round((count / leads.length) * 100) : 0;
                        return (
                          <div key={orig}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="font-medium text-gray-700">{ORIGINATION_LABELS[orig] ?? orig}</span>
                              <span className="text-gray-400">{count} · {pct}%</span>
                            </div>
                            <div className="bg-gray-100 rounded-full h-3">
                              <div className="bg-indigo-500 h-3 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ── Quotes Sent ──────────────────────────────────────────── */}
            {activeTab === "quotes_sent" && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{quotesSent.length} quotes sent</CardTitle>
                </CardHeader>
                <CardContent>
                  {quotesSent.length === 0 ? <SectionEmpty msg="No quotes sent yet." /> : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b text-left">
                            {["Client","Quote #","Value","Monthly","Service","Stage","Rep","Sent","Days Out"].map(h => (
                              <th key={h} className="pb-2 pr-3 font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {quotesSent.map(q => {
                            const days = q.quoteSentAt ? daysSince(q.quoteSentAt) : daysSince(q.submittedAt);
                            return (
                              <tr key={q.id} className="border-b border-gray-50 hover:bg-gray-50">
                                <td className="py-1.5 pr-3 font-semibold text-gray-900 whitespace-nowrap">{q.companyName}</td>
                                <td className="py-1.5 pr-3 font-mono text-gray-600">{q.quoteNumber ?? "—"}</td>
                                <td className="py-1.5 pr-3 text-gray-800">{q.quoteAmount ? `R ${q.quoteAmount}` : "—"}</td>
                                <td className="py-1.5 pr-3 text-gray-600">{q.monthlyRecurring ? `R ${q.monthlyRecurring}/mo` : "—"}</td>
                                <td className="py-1.5 pr-3 capitalize text-gray-600">{(q.serviceType ?? "—").replace(/_/g, " ")}</td>
                                <td className="py-1.5 pr-3">
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">{(q as any).stage || q.status}</Badge>
                                </td>
                                <td className="py-1.5 pr-3 text-gray-600 whitespace-nowrap">{repName(q.assignedTo)}</td>
                                <td className="py-1.5 pr-3 text-gray-500 whitespace-nowrap">{q.quoteSentAt ? fmtDate(q.quoteSentAt) : "—"}</td>
                                <td className="py-1.5">
                                  <span className={`font-semibold ${days > 14 ? "text-red-600" : days > 7 ? "text-amber-600" : "text-gray-700"}`}>{days}d</span>
                                </td>
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

            {/* ── Quotes Accepted ──────────────────────────────────────── */}
            {activeTab === "quotes_accepted" && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{quotesAccepted.length} quotes accepted · {fmtR(totalOnceOff)} once-off · {fmtR(totalMonthly)}/mo recurring</CardTitle>
                </CardHeader>
                <CardContent>
                  {quotesAccepted.length === 0 ? <SectionEmpty msg="No accepted quotes yet." /> : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b text-left">
                            {["Client","Quote #","Once-off","Monthly","Service","Stage","Rep","Date"].map(h => (
                              <th key={h} className="pb-2 pr-3 font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {quotesAccepted.map(q => (
                            <tr key={q.id} className="border-b border-gray-50 hover:bg-gray-50">
                              <td className="py-1.5 pr-3 font-semibold text-gray-900 whitespace-nowrap">{q.companyName}</td>
                              <td className="py-1.5 pr-3 font-mono text-gray-600">{q.quoteNumber ?? "—"}</td>
                              <td className="py-1.5 pr-3 font-semibold text-green-700">{q.quoteAmount ? `R ${q.quoteAmount}` : "—"}</td>
                              <td className="py-1.5 pr-3 text-purple-600 font-semibold">{q.monthlyRecurring ? `R ${q.monthlyRecurring}/mo` : "—"}</td>
                              <td className="py-1.5 pr-3 capitalize text-gray-600">{(q.serviceType ?? "—").replace(/_/g, " ")}</td>
                              <td className="py-1.5 pr-3">
                                <Badge className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700">{(q as any).stage || q.status}</Badge>
                              </td>
                              <td className="py-1.5 pr-3 text-gray-600 whitespace-nowrap">{repName(q.assignedTo)}</td>
                              <td className="py-1.5 pr-3 text-gray-500 whitespace-nowrap">{fmtDate(q.submittedAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ── Quotes Declined / Lost ───────────────────────────────── */}
            {activeTab === "quotes_lost" && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{quotesLost.length} quotes declined or lost</CardTitle>
                </CardHeader>
                <CardContent>
                  {quotesLost.length === 0 ? <SectionEmpty msg="No lost quotes." /> : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b text-left">
                            {["Client","Quote #","Value","Monthly","Service","Reason / Stage","Rep","Date"].map(h => (
                              <th key={h} className="pb-2 pr-3 font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {quotesLost.map(q => (
                            <tr key={q.id} className="border-b border-gray-50 hover:bg-gray-50">
                              <td className="py-1.5 pr-3 font-semibold text-gray-900 whitespace-nowrap">{q.companyName}</td>
                              <td className="py-1.5 pr-3 font-mono text-gray-600">{q.quoteNumber ?? "—"}</td>
                              <td className="py-1.5 pr-3 text-gray-600">{q.quoteAmount ? `R ${q.quoteAmount}` : "—"}</td>
                              <td className="py-1.5 pr-3 text-gray-500">{q.monthlyRecurring ? `R ${q.monthlyRecurring}/mo` : "—"}</td>
                              <td className="py-1.5 pr-3 capitalize text-gray-600">{(q.serviceType ?? "—").replace(/_/g, " ")}</td>
                              <td className="py-1.5 pr-3">
                                <Badge className="text-[10px] px-1.5 py-0 bg-red-100 text-red-600">{(q as any).stage || q.status}</Badge>
                              </td>
                              <td className="py-1.5 pr-3 text-gray-600 whitespace-nowrap">{repName(q.assignedTo)}</td>
                              <td className="py-1.5 pr-3 text-gray-500 whitespace-nowrap">{fmtDate(q.submittedAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ── Sales by Rep ─────────────────────────────────────────── */}
            {activeTab === "sales_by_rep" && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{salesByRep.length} active reps</CardTitle>
                </CardHeader>
                <CardContent>
                  {salesByRep.length === 0 ? <SectionEmpty msg="No leads assigned to reps yet." /> : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b text-left">
                            {["Rep","Active","Won","Lost","Win %","Once-off Value","Monthly Recurring"].map(h => (
                              <th key={h} className="pb-2 pr-4 font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {salesByRep.map(rep => {
                            const total = rep.active + rep.won + rep.lost;
                            const pct = total > 0 ? Math.round((rep.won / total) * 100) : 0;
                            return (
                              <tr key={rep.name} className="border-b border-gray-50 hover:bg-gray-50">
                                <td className="py-2 pr-4 font-semibold text-gray-900 whitespace-nowrap">{rep.name}</td>
                                <td className="py-2 pr-4 text-blue-600 font-semibold">{rep.active}</td>
                                <td className="py-2 pr-4 text-green-600 font-semibold">{rep.won}</td>
                                <td className="py-2 pr-4 text-red-500">{rep.lost}</td>
                                <td className="py-2 pr-4">
                                  <span className={`px-2 py-0.5 rounded-full font-semibold ${pct >= 50 ? "bg-green-100 text-green-700" : pct >= 25 ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"}`}>
                                    {pct}%
                                  </span>
                                </td>
                                <td className="py-2 pr-4 text-gray-700 font-semibold">{fmtR(rep.onceOff)}</td>
                                <td className="py-2 text-purple-600 font-semibold">{fmtR(rep.monthly)}/mo</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <Button size="sm" variant="outline" className="w-full mt-3 text-xs h-7" onClick={() => navigate("/commission-reports")}>
                    Full Commission Reports <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* ── Sales by Department ──────────────────────────────────── */}
            {activeTab === "sales_by_dept" && (
              <Card>
                <CardContent className="pt-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b text-left">
                          {["Department","Total Leads","Won","Lost","Win %","Once-off Value","Monthly Recurring"].map(h => (
                            <th key={h} className="pb-2 pr-4 font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {salesByDept.map(d => {
                          const total = d.won + d.lost;
                          const pct = total > 0 ? Math.round((d.won / total) * 100) : 0;
                          const deptColors: Record<string, string> = {
                            pest_control: "bg-green-400", sanitary_bins: "bg-purple-400",
                            washroom: "bg-blue-400", deep_cleaning: "bg-orange-400",
                          };
                          return (
                            <tr key={d.key} className="border-b border-gray-50 hover:bg-gray-50">
                              <td className="py-2 pr-4">
                                <div className="flex items-center gap-2">
                                  <div className={`w-2.5 h-2.5 rounded-full ${deptColors[d.key] ?? "bg-gray-400"}`} />
                                  <span className="font-semibold text-gray-900">{d.label}</span>
                                </div>
                              </td>
                              <td className="py-2 pr-4 text-gray-600">{d.total}</td>
                              <td className="py-2 pr-4 text-green-600 font-semibold">{d.won}</td>
                              <td className="py-2 pr-4 text-red-500">{d.lost}</td>
                              <td className="py-2 pr-4">
                                <span className={`px-2 py-0.5 rounded-full font-semibold ${pct >= 50 ? "bg-green-100 text-green-700" : pct >= 25 ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"}`}>
                                  {pct}%
                                </span>
                              </td>
                              <td className="py-2 pr-4 text-gray-700 font-semibold">{fmtR(d.onceOff)}</td>
                              <td className="py-2 text-purple-600 font-semibold">{fmtR(d.monthly)}/mo</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── Monthly Recurring Sales Added ────────────────────────── */}
            {activeTab === "monthly_recurring" && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  {[3, 6, 12].map(n => (
                    <button key={n} onClick={() => setMonthRange(n)}
                      className={`text-xs px-3 py-1.5 rounded-lg border font-medium ${monthRange === n ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 text-gray-500 hover:border-gray-400"}`}>
                      Last {n} months
                    </button>
                  ))}
                </div>
                <Card>
                  <CardContent className="pt-4">
                    <div className="space-y-3">
                      {monthlyRecurringByMonth.map(m => {
                        const maxVal = Math.max(...monthlyRecurringByMonth.map(x => x.value), 1);
                        const pct = Math.round((m.value / maxVal) * 100);
                        return (
                          <div key={m.label} className="flex items-center gap-3">
                            <span className="text-xs text-gray-500 w-20 flex-shrink-0">{m.label}</span>
                            <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                              <div className="bg-purple-400 h-5 rounded-full flex items-center px-2 transition-all"
                                style={{ width: `${Math.max(pct, m.value > 0 ? 8 : 0)}%` }}>
                                {m.value > 0 && <span className="text-white text-[10px] font-semibold">{fmtR(m.value)}</span>}
                              </div>
                            </div>
                            <span className="text-xs text-gray-500 w-12 text-right">{m.count} won</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-4 pt-3 border-t text-xs text-gray-500">
                      Total MRR added this period: <strong className="text-purple-700">{fmtR(monthlyRecurringByMonth.reduce((s, m) => s + m.value, 0))}/mo</strong>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ── Outstanding Contracts ────────────────────────────────── */}
            {activeTab === "outstanding" && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{outstandingContracts.length} outstanding contracts</CardTitle>
                </CardHeader>
                <CardContent>
                  {outstandingContracts.length === 0 ? <SectionEmpty msg="All contracts signed." /> : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b text-left">
                            {["Client","Quote #","Status","Contract Drafted","Contract Sent","Signed","Days Pending","Rep"].map(h => (
                              <th key={h} className="pb-2 pr-3 font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {outstandingContracts.map(w => (
                            <tr key={w.id} className="border-b border-gray-50 hover:bg-gray-50">
                              <td className="py-1.5 pr-3 font-semibold text-gray-900 whitespace-nowrap">{w.companyName}</td>
                              <td className="py-1.5 pr-3 font-mono text-gray-600">{w.quoteNumber ?? "—"}</td>
                              <td className="py-1.5 pr-3">
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">{w.workflowStatus.replace(/_/g, " ")}</Badge>
                              </td>
                              <td className="py-1.5 pr-3">{w.contractDrafted ? <CheckCircle className="h-3.5 w-3.5 text-green-500" /> : <XCircle className="h-3.5 w-3.5 text-gray-300" />}</td>
                              <td className="py-1.5 pr-3">{w.contractSent ? <CheckCircle className="h-3.5 w-3.5 text-green-500" /> : <XCircle className="h-3.5 w-3.5 text-gray-300" />}</td>
                              <td className="py-1.5 pr-3">{w.contractSigned ? <CheckCircle className="h-3.5 w-3.5 text-green-500" /> : <XCircle className="h-3.5 w-3.5 text-red-400" />}</td>
                              <td className="py-1.5 pr-3">
                                {w.contractSentAt
                                  ? <span className={`font-semibold ${daysSince(w.contractSentAt) > 7 ? "text-red-600" : "text-gray-700"}`}>{daysSince(w.contractSentAt)}d</span>
                                  : "—"}
                              </td>
                              <td className="py-1.5 text-gray-600 whitespace-nowrap">{repName(w.salesRepId)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <Button size="sm" variant="outline" className="w-full mt-3 text-xs h-7" onClick={() => navigate("/accepted-work")}>
                    View in Accepted Work <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* ── Unsigned Contracts ───────────────────────────────────── */}
            {activeTab === "unsigned" && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{unsignedContracts.length} contracts sent but not yet signed</CardTitle>
                </CardHeader>
                <CardContent>
                  {unsignedContracts.length === 0 ? <SectionEmpty msg="All sent contracts have been signed." /> : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b text-left">
                            {["Client","Quote #","Sent Date","Days Waiting","Rep"].map(h => (
                              <th key={h} className="pb-2 pr-3 font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {unsignedContracts.map(w => {
                            const days = w.contractSentAt ? daysSince(w.contractSentAt) : 0;
                            return (
                              <tr key={w.id} className="border-b border-gray-50 hover:bg-gray-50">
                                <td className="py-1.5 pr-3 font-semibold text-gray-900 whitespace-nowrap">{w.companyName}</td>
                                <td className="py-1.5 pr-3 font-mono text-gray-600">{w.quoteNumber ?? "—"}</td>
                                <td className="py-1.5 pr-3 text-gray-500 whitespace-nowrap">{w.contractSentAt ? fmtDate(w.contractSentAt) : "—"}</td>
                                <td className="py-1.5 pr-3">
                                  <span className={`font-bold ${days > 14 ? "text-red-600" : days > 7 ? "text-amber-600" : "text-gray-700"}`}>{days}d</span>
                                </td>
                                <td className="py-1.5 text-gray-600 whitespace-nowrap">{repName(w.salesRepId)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <Button size="sm" variant="outline" className="w-full mt-3 text-xs h-7" onClick={() => navigate("/accepted-work")}>
                    View in Accepted Work <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* ── Follow-up Performance ────────────────────────────────── */}
            {activeTab === "followup_perf" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Stat label="Total Follow-ups"  value={followUps.length} />
                  <Stat label="Completed"          value={fuCompleted.length} color="text-green-700" />
                  <Stat label="Pending"            value={fuPending.length}   color="text-blue-700" />
                  <Stat label="Overdue"            value={fuOverdue.length}   color="text-red-600" />
                </div>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Follow-ups by Method</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {followUps.length === 0 ? <SectionEmpty msg="No follow-ups recorded yet." /> : (() => {
                      const byMethod: Record<string, { total: number; done: number }> = {};
                      followUps.forEach(f => {
                        const m = f.method ?? "other";
                        if (!byMethod[m]) byMethod[m] = { total: 0, done: 0 };
                        byMethod[m].total++;
                        if (f.status === "completed") byMethod[m].done++;
                      });
                      return (
                        <div className="space-y-2.5 max-w-sm">
                          {Object.entries(byMethod).sort((a, b) => b[1].total - a[1].total).map(([method, d]) => {
                            const pct = d.total > 0 ? Math.round((d.done / d.total) * 100) : 0;
                            return (
                              <div key={method}>
                                <div className="flex justify-between text-xs mb-0.5">
                                  <span className="capitalize text-gray-600 font-medium">{method.replace(/_/g, " ")}</span>
                                  <span className="text-gray-400">{d.done}/{d.total} completed ({pct}%)</span>
                                </div>
                                <div className="bg-gray-100 rounded-full h-2.5">
                                  <div className="bg-blue-400 h-2.5 rounded-full" style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Overdue Follow-ups</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {fuOverdue.length === 0 ? (
                      <div className="flex items-center gap-2 text-sm text-green-600 py-4">
                        <CheckCircle className="h-4 w-4" /> No overdue follow-ups — great work!
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b text-left">
                              {["Client","Method","Due Date","Days Overdue","Notes"].map(h => (
                                <th key={h} className="pb-2 pr-3 font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {fuOverdue.map(f => {
                              const lead = leads.find(l => l.id === f.leadId);
                              const days = daysSince(f.dueDate);
                              return (
                                <tr key={f.id} className="border-b border-gray-50 hover:bg-gray-50">
                                  <td className="py-1.5 pr-3 font-semibold text-gray-900">{lead?.companyName ?? "—"}</td>
                                  <td className="py-1.5 pr-3 capitalize text-gray-600">{f.method ?? "—"}</td>
                                  <td className="py-1.5 pr-3 text-gray-500">{f.dueDate ? fmtDate(f.dueDate) : "—"}</td>
                                  <td className="py-1.5 pr-3">
                                    <span className="font-bold text-red-600">{days}d</span>
                                  </td>
                                  <td className="py-1.5 text-gray-500 max-w-xs truncate">{f.notes ?? "—"}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ── Commission Report (link-out) ─────────────────────────── */}
            {activeTab === "commission" && (
              <Card>
                <CardContent className="pt-6 pb-6 text-center">
                  <DollarSign className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-gray-700 mb-1">Commission Reports</p>
                  <p className="text-xs text-gray-400 mb-4">
                    Detailed commission calculations by rep, date range, and service type.
                  </p>
                  <Button onClick={() => navigate("/commission-reports")}>
                    Open Commission Reports <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </CardContent>
              </Card>
            )}

          </div>
        </div>
  );
}
