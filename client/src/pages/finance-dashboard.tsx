import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import MobileNavigation from "@/components/layout/mobile-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DollarSign, TrendingUp, AlertTriangle, CheckCircle2, Clock,
  Receipt, ArrowRight, Search, Ban, RefreshCw, FileText,
  HandCoins, Wallet, BarChart3, XCircle,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Invoice, Client, Job } from "@shared/schema";

const fmtR = (n: number) =>
  `R${Math.round(n).toLocaleString("en-ZA")}`;

function daysBetween(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / 86400000);
}

type Bucket = "current" | "b30" | "b60" | "b90" | "b90p";
function bucketFor(days: number): Bucket {
  if (days <= 30) return "current";
  if (days <= 60) return "b30";
  if (days <= 90) return "b60";
  if (days <= 120) return "b90";
  return "b90p";
}

const BUCKET_LABELS: Record<Bucket, string> = {
  current: "0–30 days",
  b30: "31–60 days",
  b60: "61–90 days",
  b90: "91–120 days",
  b90p: "120+ days",
};

const BUCKET_COLORS: Record<Bucket, string> = {
  current: "bg-emerald-50 border-emerald-200 text-emerald-700",
  b30: "bg-amber-50 border-amber-200 text-amber-700",
  b60: "bg-orange-50 border-orange-200 text-orange-700",
  b90: "bg-red-50 border-red-200 text-red-700",
  b90p: "bg-red-100 border-red-300 text-red-900",
};

export default function FinanceDashboard() {
  const { toast } = useToast();
  const [period, setPeriod] = useState<"mtd" | "ytd" | "all">("mtd");
  const [jobSearch, setJobSearch] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  const { data: invoices = [] } = useQuery<Invoice[]>({ queryKey: ["/api/invoices"] });
  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: jobs = [] } = useQuery<Job[]>({ queryKey: ["/api/jobs"] });

  const clientMap = useMemo(() => new Map(clients.map(c => [c.id, c])), [clients]);

  const today = new Date();
  const periodStart = useMemo(() => {
    if (period === "mtd") return new Date(today.getFullYear(), today.getMonth(), 1);
    if (period === "ytd") return new Date(today.getFullYear(), 0, 1);
    return new Date(2000, 0, 1);
  }, [period]);

  const periodInvoices = useMemo(
    () => invoices.filter(i => new Date(i.issueDate) >= periodStart),
    [invoices, periodStart]
  );

  const totalInvoiced = periodInvoices.reduce((s, i) => s + parseFloat(String(i.total)), 0);
  const totalPaid = periodInvoices.filter(i => i.status === "paid").reduce((s, i) => s + parseFloat(String(i.total)), 0);
  const totalOutstanding = invoices
    .filter(i => i.status !== "paid" && i.status !== "cancelled")
    .reduce((s, i) => {
      const t = parseFloat(String(i.total));
      const p = parseFloat(String(i.paidAmount ?? 0));
      return s + Math.max(0, t - p);
    }, 0);
  const totalOverdue = invoices
    .filter(i => i.status !== "paid" && i.status !== "cancelled" && new Date(i.dueDate) < today)
    .reduce((s, i) => {
      const t = parseFloat(String(i.total));
      const p = parseFloat(String(i.paidAmount ?? 0));
      return s + Math.max(0, t - p);
    }, 0);
  const collectionRate = totalInvoiced > 0 ? Math.round((totalPaid / totalInvoiced) * 100) : 0;

  // Aged debt
  const outstandingInvoices = useMemo(() => {
    return invoices
      .filter(i => i.status !== "paid" && i.status !== "cancelled")
      .map(inv => {
        const total = parseFloat(String(inv.total));
        const paid = parseFloat(String(inv.paidAmount ?? 0));
        const outstanding = +(total - paid).toFixed(2);
        const daysOverdue = Math.max(0, daysBetween(new Date(inv.dueDate), today));
        return { inv, outstanding, daysOverdue, bucket: bucketFor(daysOverdue) };
      })
      .filter(x => x.outstanding > 0.01);
  }, [invoices]);

  const bucketTotals = useMemo(() => {
    const out: Record<Bucket, number> = { current: 0, b30: 0, b60: 0, b90: 0, b90p: 0 };
    for (const x of outstandingInvoices) out[x.bucket] += x.outstanding;
    return out;
  }, [outstandingInvoices]);

  // Completed jobs not yet invoiced
  const notInvoicedJobs = useMemo(() =>
    jobs.filter(j =>
      j.status === "completed" &&
      (j.invoiceStatus === "not_invoiced" || !j.invoiceStatus) &&
      (jobSearch === "" ||
        j.title.toLowerCase().includes(jobSearch.toLowerCase()) ||
        (clientMap.get(j.clientId)?.name ?? "").toLowerCase().includes(jobSearch.toLowerCase()))
    ).sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime()),
    [jobs, jobSearch, clientMap]
  );

  const readyJobs = useMemo(() =>
    jobs.filter(j => j.invoiceStatus === "ready_to_invoice"),
    [jobs]
  );

  // Suspended clients
  const suspendedClients = useMemo(
    () => clients.filter(c => c.status === "suspended"),
    [clients]
  );

  // Per-client outstanding
  const perClientOutstanding = useMemo(() => {
    const map = new Map<string, number>();
    for (const x of outstandingInvoices) {
      map.set(x.inv.clientId, (map.get(x.inv.clientId) ?? 0) + x.outstanding);
    }
    return map;
  }, [outstandingInvoices]);

  const markReadyMut = useMutation({
    mutationFn: async (jobId: string) => {
      const r = await apiRequest("POST", `/api/jobs/${jobId}/mark-ready-to-invoice`);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Marked ready to invoice" });
    },
    onError: () => toast({ title: "Failed", variant: "destructive" }),
  });

  const reactivateMut = useMutation({
    mutationFn: async (clientId: string) => {
      const r = await apiRequest("PUT", `/api/clients/${clientId}`, { status: "active" });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Account reactivated" });
    },
    onError: () => toast({ title: "Failed", variant: "destructive" }),
  });

  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Finance Dashboard" />
        <main className="flex-1 overflow-y-auto p-6 pb-20 lg:pb-6 space-y-6">

          {/* Page header + period selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Finance Overview</h1>
              <p className="text-sm text-gray-500 mt-0.5">Revenue, collections, outstanding debt and invoicing queue</p>
            </div>
            <div className="flex gap-2 items-center">
              <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
                <SelectTrigger className="w-36 h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mtd">This Month</SelectItem>
                  <SelectItem value="ytd">This Year</SelectItem>
                  <SelectItem value="all">All Time</SelectItem>
                </SelectContent>
              </Select>
              <Link href="/invoices">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Receipt className="h-3.5 w-3.5" /> Invoices
                </Button>
              </Link>
              <Link href="/debtors">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <HandCoins className="h-3.5 w-3.5" /> Debtors
                </Button>
              </Link>
            </div>
          </div>

          {/* KPI tiles */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <KpiCard
              label="Invoiced"
              sub={period === "mtd" ? "This month" : period === "ytd" ? "This year" : "All time"}
              value={fmtR(totalInvoiced)}
              icon={TrendingUp}
              color="bg-blue-50 border-blue-200 text-blue-800"
            />
            <KpiCard
              label="Collected"
              sub={period === "mtd" ? "This month" : period === "ytd" ? "This year" : "All time"}
              value={fmtR(totalPaid)}
              icon={CheckCircle2}
              color="bg-emerald-50 border-emerald-200 text-emerald-800"
            />
            <KpiCard
              label="Outstanding"
              sub="All open invoices"
              value={fmtR(totalOutstanding)}
              icon={DollarSign}
              color="bg-amber-50 border-amber-200 text-amber-800"
            />
            <KpiCard
              label="Overdue"
              sub="Past due date"
              value={fmtR(totalOverdue)}
              icon={AlertTriangle}
              color="bg-red-50 border-red-200 text-red-800"
            />
            <KpiCard
              label="Collection Rate"
              sub={period === "mtd" ? "This month" : period === "ytd" ? "This year" : "All time"}
              value={`${collectionRate}%`}
              icon={BarChart3}
              color={collectionRate >= 80 ? "bg-green-50 border-green-200 text-green-800" : "bg-orange-50 border-orange-200 text-orange-800"}
            />
          </div>

          {/* Tabs: Overview / Invoice Queue / Suspended Accounts */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-3 w-full max-w-lg">
              <TabsTrigger value="overview">Aged Debt</TabsTrigger>
              <TabsTrigger value="queue">
                Invoice Queue
                {(notInvoicedJobs.length + readyJobs.length) > 0 && (
                  <span className="ml-1.5 bg-orange-500 text-white text-[10px] rounded-full px-1.5 py-0.5 font-bold">
                    {notInvoicedJobs.length + readyJobs.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="suspended">
                Suspended
                {suspendedClients.length > 0 && (
                  <span className="ml-1.5 bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5 font-bold">
                    {suspendedClients.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Aged Debt tab */}
            <TabsContent value="overview" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {(["current", "b30", "b60", "b90", "b90p"] as Bucket[]).map(b => (
                  <div key={b} className={`border rounded-xl p-3 ${BUCKET_COLORS[b]}`}>
                    <p className="text-[11px] uppercase tracking-wide opacity-70 font-semibold">{BUCKET_LABELS[b]}</p>
                    <p className="text-xl font-bold mt-1">{fmtR(bucketTotals[b])}</p>
                    <p className="text-[11px] opacity-60 mt-0.5">
                      {outstandingInvoices.filter(x => x.bucket === b).length} invoice(s)
                    </p>
                  </div>
                ))}
              </div>

              {/* Top debtors */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700">Top Outstanding Accounts</h3>
                  <Link href="/debtors">
                    <Button variant="ghost" size="sm" className="text-xs gap-1">
                      Full Debtors Report <ArrowRight className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
                {outstandingInvoices.length === 0 ? (
                  <p className="p-6 text-sm text-gray-400 italic text-center">No outstanding balances — great!</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="text-left px-4 py-2">Client</th>
                        <th className="text-left px-4 py-2">Invoice</th>
                        <th className="text-left px-4 py-2">Due Date</th>
                        <th className="text-right px-4 py-2">Outstanding</th>
                        <th className="text-left px-4 py-2">Age</th>
                        <th className="text-left px-4 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {outstandingInvoices.slice(0, 10).map(x => {
                        const c = clientMap.get(x.inv.clientId);
                        const isSuspended = c?.status === "suspended";
                        return (
                          <tr key={x.inv.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2 font-medium text-gray-900">
                              <div className="flex items-center gap-1.5">
                                {c?.name ?? "—"}
                                {isSuspended && <Ban className="h-3.5 w-3.5 text-red-500" />}
                              </div>
                            </td>
                            <td className="px-4 py-2 font-mono text-xs text-blue-700">{x.inv.invoiceNumber}</td>
                            <td className="px-4 py-2 text-gray-500 text-xs">{new Date(x.inv.dueDate).toLocaleDateString()}</td>
                            <td className="px-4 py-2 text-right font-semibold text-rose-700">{fmtR(x.outstanding)}</td>
                            <td className="px-4 py-2">
                              <Badge variant="outline" className={BUCKET_COLORS[x.bucket]}>
                                {x.daysOverdue > 0 ? `${x.daysOverdue}d` : "Current"}
                              </Badge>
                            </td>
                            <td className="px-4 py-2">
                              {isSuspended
                                ? <Badge className="bg-red-100 text-red-800 text-xs">Suspended</Badge>
                                : <Badge className="bg-green-100 text-green-800 text-xs">Active</Badge>
                              }
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </TabsContent>

            {/* Invoice Queue tab */}
            <TabsContent value="queue" className="space-y-4 mt-4">
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex flex-col sm:flex-row gap-2 sm:items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700">Completed Jobs — Not Yet Invoiced</h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {notInvoicedJobs.length} job{notInvoicedJobs.length !== 1 ? "s" : ""} awaiting invoice creation
                    </p>
                  </div>
                  <div className="relative w-56">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                    <Input
                      placeholder="Search jobs or clients…"
                      value={jobSearch}
                      onChange={e => setJobSearch(e.target.value)}
                      className="pl-8 h-8 text-sm"
                    />
                  </div>
                </div>
                {notInvoicedJobs.length === 0 ? (
                  <div className="p-8 text-center text-sm text-gray-400">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-400" />
                    All completed jobs have been invoiced.
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="text-left px-4 py-2">Job</th>
                        <th className="text-left px-4 py-2">Client</th>
                        <th className="text-left px-4 py-2">Completed</th>
                        <th className="text-right px-4 py-2">Value</th>
                        <th className="text-right px-4 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {notInvoicedJobs.map(j => {
                        const c = clientMap.get(j.clientId);
                        return (
                          <tr key={j.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2">
                              <p className="font-medium text-gray-900 truncate max-w-[180px]">{j.title}</p>
                              <p className="text-xs text-gray-400 font-mono">{j.jobNumber ?? j.id.slice(0, 8)}</p>
                            </td>
                            <td className="px-4 py-2 text-gray-700">{c?.name ?? "—"}</td>
                            <td className="px-4 py-2 text-gray-500 text-xs">
                              {new Date(j.scheduledDate).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-2 text-right text-gray-700 font-medium">
                              {j.price ? fmtR(parseFloat(String(j.price))) : "—"}
                            </td>
                            <td className="px-4 py-2 text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-7 gap-1"
                                onClick={() => markReadyMut.mutate(j.id)}
                                disabled={markReadyMut.isPending}
                              >
                                <Receipt className="h-3 w-3" /> Mark Ready
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {readyJobs.length > 0 && (
                <div className="bg-white border border-green-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-green-100 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-green-800">Ready to Invoice</h3>
                      <p className="text-xs text-green-600 mt-0.5">{readyJobs.length} job{readyJobs.length !== 1 ? "s" : ""} approved by service team</p>
                    </div>
                    <Link href="/invoices">
                      <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white gap-1.5 text-xs">
                        <Receipt className="h-3.5 w-3.5" /> Create Invoices
                      </Button>
                    </Link>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-green-50 text-[11px] uppercase tracking-wide text-green-600">
                      <tr>
                        <th className="text-left px-4 py-2">Job</th>
                        <th className="text-left px-4 py-2">Client</th>
                        <th className="text-right px-4 py-2">Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-green-50">
                      {readyJobs.map(j => (
                        <tr key={j.id} className="hover:bg-green-50/50">
                          <td className="px-4 py-2 font-medium text-gray-900">{j.title}</td>
                          <td className="px-4 py-2 text-gray-700">{clientMap.get(j.clientId)?.name ?? "—"}</td>
                          <td className="px-4 py-2 text-right font-semibold text-green-700">
                            {j.price ? fmtR(parseFloat(String(j.price))) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            {/* Suspended Accounts tab */}
            <TabsContent value="suspended" className="space-y-4 mt-4">
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-700">Suspended Customer Accounts</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Accounts suspended due to non-payment or other reasons</p>
                </div>
                {suspendedClients.length === 0 ? (
                  <div className="p-8 text-center text-sm text-gray-400">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-400" />
                    No accounts are currently suspended.
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="text-left px-4 py-2">Client</th>
                        <th className="text-left px-4 py-2">Contact</th>
                        <th className="text-right px-4 py-2">Outstanding</th>
                        <th className="text-right px-4 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {suspendedClients.map(c => (
                        <tr key={c.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              <Ban className="h-4 w-4 text-red-500 flex-shrink-0" />
                              <div>
                                <p className="font-medium text-gray-900">{c.name}</p>
                                <p className="text-xs text-gray-400">{c.businessType ?? "Client"}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-2 text-gray-600 text-xs">
                            <p>{c.contactPerson ?? "—"}</p>
                            <p>{c.phone ?? "—"}</p>
                          </td>
                          <td className="px-4 py-2 text-right font-semibold text-rose-700">
                            {fmtR(perClientOutstanding.get(c.id) ?? 0)}
                          </td>
                          <td className="px-4 py-2 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7 gap-1 text-green-700 border-green-300 hover:bg-green-50"
                              onClick={() => reactivateMut.mutate(c.id)}
                              disabled={reactivateMut.isPending}
                            >
                              <RefreshCw className="h-3 w-3" /> Reactivate
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </TabsContent>
          </Tabs>

        </main>
        <MobileNavigation />
      </div>
    </div>
  );
}

function KpiCard({ label, sub, value, icon: Icon, color }: {
  label: string; sub: string; value: string; icon: any; color: string;
}) {
  return (
    <div className={`border rounded-xl p-4 ${color}`}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-[11px] uppercase tracking-wide opacity-70 font-semibold">{label}</p>
        <Icon className="h-4 w-4 opacity-60" />
      </div>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-[11px] opacity-60 mt-0.5">{sub}</p>
    </div>
  );
}
