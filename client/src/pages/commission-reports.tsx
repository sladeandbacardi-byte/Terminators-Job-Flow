import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, BarChart3, DollarSign, Users, TrendingUp, CheckCircle } from "lucide-react";
import type { QuoteSubmission, Worker } from "@shared/schema";
import { LEAD_STAGES } from "@shared/schema";
import { escapeCSVValue } from "@/lib/data-export";

// Stages that count as "closed won"
const WON_STAGES = [
  "accepted","contract_pending","converted_contract","converted_job",
  "installation_scheduled","invoiced","complete",
];

const SERVICE_LABELS: Record<string, string> = {
  pest_control: "Pest Control",
  sanitary_bins: "Sanitary Bins",
  washroom: "Washroom",
  deep_cleaning: "Deep Cleaning",
};

// Default commission rate per lead type
const DEFAULT_COMMISSION_PCT = 5; // 5% of quoted amount

function parseAmount(v: string | null | undefined): number {
  if (!v) return 0;
  const cleaned = v.replace(/[^0-9.]/g, "");
  return parseFloat(cleaned) || 0;
}

function formatR(n: number) {
  return `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function CommissionReportsPage() {
  const now = new Date();

  const [repFilter, setRepFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState(format(now, "yyyy-MM"));
  const [commissionPct, setCommissionPct] = useState(DEFAULT_COMMISSION_PCT.toString());
  const [showAll, setShowAll] = useState(false);

  const { data: leads = [], isLoading } = useQuery<QuoteSubmission[]>({ queryKey: ["/api/quote-submissions"] });
  const { data: workers = [] } = useQuery<Worker[]>({ queryKey: ["/api/workers"] });

  const salesWorkers = workers.filter(w => w.departmentId === "div-5" && w.isActive !== false);

  // Build month options (last 12 months)
  const monthOptions = useMemo(() => {
    const opts = [];
    for (let i = 0; i < 12; i++) {
      const d = subMonths(now, i);
      opts.push({ value: format(d, "yyyy-MM"), label: format(d, "MMMM yyyy") });
    }
    opts.unshift({ value: "all", label: "All Time" });
    return opts;
  }, []);

  // Filter leads to closed-won within the selected month range
  const closedLeads = useMemo(() => {
    const pct = parseFloat(commissionPct) || DEFAULT_COMMISSION_PCT;
    return leads
      .filter(l => {
        const stage = (l as any).stage || l.status;
        if (!WON_STAGES.includes(stage)) return false;
        if (repFilter !== "all" && l.assignedTo !== repFilter) return false;
        if (serviceFilter !== "all" && l.serviceType !== serviceFilter) return false;
        if (monthFilter !== "all") {
          const d = new Date(l.submittedAt ?? 0);
          const start = startOfMonth(parseISO(`${monthFilter}-01`));
          const end = endOfMonth(start);
          if (d < start || d > end) return false;
        }
        return true;
      })
      .map(l => {
        const amount = parseAmount(l.quoteAmount ?? l.monthlyRecurring);
        const commission = (amount * pct) / 100;
        const rep = l.assignedTo ? workers.find(w => w.id === l.assignedTo) : null;
        return { ...l, parsedAmount: amount, commission, repName: rep?.name ?? "Unassigned" };
      })
      .sort((a, b) => new Date(b.submittedAt ?? 0).getTime() - new Date(a.submittedAt ?? 0).getTime());
  }, [leads, workers, repFilter, serviceFilter, monthFilter, commissionPct]);

  // Totals
  const totalRevenue = closedLeads.reduce((s, l) => s + l.parsedAmount, 0);
  const totalCommission = closedLeads.reduce((s, l) => s + l.commission, 0);

  // Per-rep summary
  const repSummary = useMemo(() => {
    const map: Record<string, { name: string; count: number; revenue: number; commission: number }> = {};
    closedLeads.forEach(l => {
      const key = l.assignedTo ?? "unassigned";
      if (!map[key]) map[key] = { name: l.repName, count: 0, revenue: 0, commission: 0 };
      map[key].count++;
      map[key].revenue += l.parsedAmount;
      map[key].commission += l.commission;
    });
    return Object.values(map).sort((a, b) => b.commission - a.commission);
  }, [closedLeads]);

  // Export CSV
  function exportCSV() {
    const pct = parseFloat(commissionPct) || DEFAULT_COMMISSION_PCT;
    const rows = [
      ["Date","Company","Contact","Service","Stage","Quote Amount (R)","Monthly Recurring (R)",`Commission @ ${pct}% (R)`,"Sales Rep"],
      ...closedLeads.map(l => [
        format(new Date(l.submittedAt ?? 0), "yyyy-MM-dd"),
        l.companyName,
        l.contactPerson,
        SERVICE_LABELS[l.serviceType] ?? l.serviceType,
        LEAD_STAGES.find(s => s.value === ((l as any).stage || l.status))?.label ?? l.status,
        parseAmount(l.quoteAmount).toFixed(2),
        parseAmount(l.monthlyRecurring).toFixed(2),
        l.commission.toFixed(2),
        l.repName,
      ]),
    ];
    const csv = rows.map(r => r.map(escapeCSVValue).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `commission-report-${monthFilter}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const displayed = showAll ? closedLeads : closedLeads.slice(0, 50);

  return (
        <div className="p-4 sm:p-6 pb-20 lg:pb-6">
          <div className="max-w-6xl mx-auto space-y-6">

            {/* Heading */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Commission Reports</h1>
                <p className="text-sm text-gray-500 mt-0.5">Closed-won leads and commission calculations for your sales team</p>
              </div>
              <Button size="sm" variant="outline" onClick={exportCSV} className="gap-1.5 text-xs self-start sm:self-auto">
                <Download className="h-3.5 w-3.5" /> Export CSV
              </Button>
            </div>

            {/* Filters */}
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                  <div>
                    <Label className="text-xs text-gray-500 mb-1 block">Period</Label>
                    <Select value={monthFilter} onValueChange={setMonthFilter}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {monthOptions.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 mb-1 block">Sales Rep</Label>
                    <Select value={repFilter} onValueChange={setRepFilter}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Reps</SelectItem>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {salesWorkers.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 mb-1 block">Service</Label>
                    <Select value={serviceFilter} onValueChange={setServiceFilter}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Services</SelectItem>
                        {Object.entries(SERVICE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 mb-1 block">Commission %</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={commissionPct}
                      onChange={e => setCommissionPct(e.target.value)}
                      className="h-9 text-sm"
                      placeholder="e.g. 5"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card className="border-green-100">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Closed Deals</span>
                    <CheckCircle className="h-4 w-4 text-green-400" />
                  </div>
                  <p className="text-3xl font-bold text-green-700">{closedLeads.length}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Won leads in period</p>
                </CardContent>
              </Card>
              <Card className="border-blue-100">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total Revenue</span>
                    <DollarSign className="h-4 w-4 text-blue-400" />
                  </div>
                  <p className="text-xl font-bold text-blue-700">{formatR(totalRevenue)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Quoted amounts</p>
                </CardContent>
              </Card>
              <Card className="border-purple-100">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total Commission</span>
                    <TrendingUp className="h-4 w-4 text-purple-400" />
                  </div>
                  <p className="text-xl font-bold text-purple-700">{formatR(totalCommission)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">@ {commissionPct}% rate</p>
                </CardContent>
              </Card>
              <Card className="border-teal-100">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Avg Deal Size</span>
                    <BarChart3 className="h-4 w-4 text-teal-400" />
                  </div>
                  <p className="text-xl font-bold text-teal-700">
                    {closedLeads.length > 0 ? formatR(totalRevenue / closedLeads.length) : "R 0"}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">Per closed deal</p>
                </CardContent>
              </Card>
            </div>

            {/* Per-rep summary */}
            {repSummary.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Users className="h-4 w-4 text-teal-500" />
                    Commission by Sales Rep
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Rep</th>
                        <th className="pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Deals</th>
                        <th className="pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Revenue</th>
                        <th className="pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Commission</th>
                      </tr>
                    </thead>
                    <tbody>
                      {repSummary.map(rep => (
                        <tr key={rep.name} className="border-b border-gray-50">
                          <td className="py-2 font-medium text-gray-800">{rep.name}</td>
                          <td className="py-2 text-right text-gray-600">{rep.count}</td>
                          <td className="py-2 text-right text-gray-700">{formatR(rep.revenue)}</td>
                          <td className="py-2 text-right font-semibold text-green-700">{formatR(rep.commission)}</td>
                        </tr>
                      ))}
                      {repSummary.length > 1 && (
                        <tr className="bg-gray-50 font-semibold">
                          <td className="py-2 text-gray-800">Total</td>
                          <td className="py-2 text-right text-gray-700">{closedLeads.length}</td>
                          <td className="py-2 text-right text-gray-700">{formatR(totalRevenue)}</td>
                          <td className="py-2 text-right text-green-700">{formatR(totalCommission)}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}

            {/* Deals table */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Closed Deals Detail
                  <Badge variant="outline" className="ml-auto text-xs">{closedLeads.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="text-center py-12 text-gray-400 text-sm">Loading…</div>
                ) : closedLeads.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 text-sm">
                    <CheckCircle className="h-10 w-10 mx-auto mb-3 text-gray-200" />
                    No closed deals match the current filters.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="border-b bg-gray-50">
                        <tr>
                          <th className="px-4 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                          <th className="px-4 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wide">Company</th>
                          <th className="px-4 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Service</th>
                          <th className="px-4 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Stage</th>
                          <th className="px-4 py-2.5 text-right font-semibold text-gray-500 uppercase tracking-wide">Amount (R)</th>
                          <th className="px-4 py-2.5 text-right font-semibold text-gray-500 uppercase tracking-wide">Commission</th>
                          <th className="px-4 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Rep</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayed.map(l => {
                          const stage = LEAD_STAGES.find(s => s.value === ((l as any).stage || l.status));
                          return (
                            <tr key={l.id} className="border-t border-gray-50 hover:bg-gray-50/60">
                              <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">
                                {format(new Date(l.submittedAt ?? 0), "d MMM yyyy")}
                              </td>
                              <td className="px-4 py-2.5">
                                <p className="font-medium text-gray-900">{l.companyName}</p>
                                <p className="text-gray-400">{l.contactPerson}</p>
                              </td>
                              <td className="px-4 py-2.5 hidden md:table-cell text-gray-500">
                                {SERVICE_LABELS[l.serviceType] ?? l.serviceType}
                              </td>
                              <td className="px-4 py-2.5 hidden lg:table-cell">
                                {stage && (
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${stage.color}`}>
                                    {stage.label}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-right font-semibold text-gray-800">
                                {l.parsedAmount > 0 ? `R ${l.parsedAmount.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}` : "—"}
                              </td>
                              <td className="px-4 py-2.5 text-right font-semibold text-green-700">
                                {l.commission > 0 ? `R ${l.commission.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}` : "—"}
                              </td>
                              <td className="px-4 py-2.5 hidden sm:table-cell text-gray-500">{l.repName}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {!showAll && closedLeads.length > 50 && (
                      <div className="text-center py-3 border-t">
                        <Button size="sm" variant="ghost" className="text-xs" onClick={() => setShowAll(true)}>
                          Show all {closedLeads.length} records
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
  );
}
