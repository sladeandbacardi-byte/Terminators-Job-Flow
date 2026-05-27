import { useState } from "react";
import { format, startOfMonth } from "date-fns";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import MobileNavigation from "@/components/layout/mobile-nav";
import { ServiceDashboard } from "@/components/dashboard/service-dashboard";
import { SalesDashboard } from "@/components/dashboard/sales-dashboard";
import { AccountsDashboard } from "@/components/dashboard/accounts-dashboard";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";
import { ManagerDashboard } from "@/components/dashboard/manager-dashboard";
import { CoordinatorDashboard } from "@/components/dashboard/coordinator-dashboard";
import { SuspendedServices } from "@/components/dashboard/suspended-services";
import { TerminatorsLogo } from "@/components/terminators-logo";
import { useAuth } from "@/hooks/useAuth";
import { getDashboardRole, dashboardRoleLabels, dashboardRoleColors, type DashboardRole } from "@/lib/dashboardRole";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, TrendingUp, TrendingDown, Minus, ArrowUpRight, ArrowDownRight, ArrowRight } from "lucide-react";
import type { Worker, QuoteSubmission, Invoice, Job, Expense } from "@shared/schema";

interface DashboardMetrics {
  activeJobs: number;
  activeWorkers: number;
  expiringContracts: number;
  monthlyRevenue: number;
}

const rolePageTitles: Record<DashboardRole, string> = {
  admin:       "Managing Member Dashboard",
  manager:     "Service Manager Dashboard",
  sales:       "Sales Dashboard",
  service:     "My Jobs Dashboard",
  accounts:    "Finance Dashboard",
  coordinator: "Service Coordinator Dashboard",
};

const roleSubtitles: Record<DashboardRole, string> = {
  admin:       "Business overview, jobs, finance and performance",
  manager:     "Operations, jobs, staff workload and service performance",
  sales:       "Leads, quotes, follow-ups and sales performance",
  service:     "Today's jobs, field diaries and assigned work",
  accounts:    "Invoices, debtors, creditors and financial performance",
  coordinator: "Today's jobs, workers, departments and field progress",
};

const roleSnapshotLabels: Record<DashboardRole, string> = {
  admin:       "Live Business Snapshot",
  manager:     "Operations Snapshot",
  sales:       "Sales Pipeline Snapshot",
  service:     "My Jobs Snapshot",
  accounts:    "Finance Snapshot",
  coordinator: "Today's Service Snapshot",
};

export default function Dashboard() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showAddRep, setShowAddRep] = useState(false);
  const [newRep, setNewRep] = useState({ name: "", email: "", phone: "", role: "Sales Consultant" });

  const dashboardRole = getDashboardRole(user ?? {});

  const { data: salesWorkers = [] } = useQuery<Worker[]>({ queryKey: ["/api/workers"] });
  const { data: allQuotes = [] } = useQuery<QuoteSubmission[]>({ queryKey: ["/api/quote-submissions"] });
  const { data: allInvoices = [] } = useQuery<Invoice[]>({ queryKey: ["/api/invoices"] });
  const { data: allJobs = [] } = useQuery<Job[]>({ queryKey: ["/api/jobs"] });
  const { data: allExpenses = [] } = useQuery<Expense[]>({ queryKey: ["/api/expenses"] });

  const { data: metrics } = useQuery<DashboardMetrics>({
    queryKey: ["/api/dashboard/metrics"],
    refetchInterval: 30000,
  });

  // Sales rep stats — div-5 only
  const salesReps = salesWorkers.filter(w => w.departmentId === "div-5" && w.isActive !== false);
  const salesRepStats = salesReps.map(rep => {
    const repQuotes = allQuotes.filter(q => q.assignedTo === rep.id);
    const totalQuoted = repQuotes.reduce((s, q) => s + (parseFloat(q.quoteAmount ?? "0") || 0), 0);
    const won = repQuotes.filter(q => q.status === "converted").length;
    const wonValue = repQuotes
      .filter(q => q.status === "converted")
      .reduce((s, q) => s + (parseFloat(q.quoteAmount ?? "0") || 0), 0);
    const lost = repQuotes.filter(q => q.status === "declined").length;
    return { rep, total: repQuotes.length, totalQuoted, won, wonValue, lost };
  });

  // Finance stats
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const debtors = allInvoices
    .filter(i => i.status === "sent" || i.status === "overdue")
    .reduce((s, i) => s + (parseFloat(String(i.total)) - parseFloat(String(i.paidAmount ?? "0"))), 0);
  const salesThisMonth = allInvoices
    .filter(i => new Date(i.issueDate) >= monthStart)
    .reduce((s, i) => s + parseFloat(String(i.total)), 0);
  const paidThisMonth = allInvoices
    .filter(i => new Date(i.issueDate) >= monthStart && i.status === "paid")
    .reduce((s, i) => s + parseFloat(String(i.total)), 0);
  const collectedPct = salesThisMonth > 0 ? Math.round((paidThisMonth / salesThisMonth) * 100) : 0;

  // ── Profit Position & Cash Flow cards ─────────────────────────────────────
  const thisMonthStr = format(now, "yyyy-MM");

  // Profitability: invoiced sales vs ALL captured expenses this month
  const profitSales    = allInvoices
    .filter(i => format(new Date(i.issueDate), "yyyy-MM") === thisMonthStr)
    .reduce((s, i) => s + parseFloat(String(i.total || 0)), 0);
  const profitExpenses = allExpenses
    .filter(e => e.date.startsWith(thisMonthStr))
    .reduce((s, e) => s + parseFloat(String(e.amount || 0)), 0);
  const profitNet   = profitSales - profitExpenses;
  const profitRatio = profitExpenses === 0
    ? (profitSales > 0 ? 100 : 0)
    : Math.min(100, Math.round((profitSales / (profitSales + profitExpenses)) * 100));
  const profitStatus = profitNet > 0 ? "ahead" : profitNet < 0 ? "behind" : "breakeven";

  // Cash Flow: receipts collected vs PAID expenses this month
  const cashReceipts  = allInvoices
    .filter(i => i.status === "paid" && format(new Date(i.paymentDate ?? i.issueDate), "yyyy-MM") === thisMonthStr)
    .reduce((s, i) => s + parseFloat(String(i.paidAmount || i.total || 0)), 0);
  const cashExpenses  = allExpenses
    .filter(e => e.paymentStatus === "paid" && e.date.startsWith(thisMonthStr))
    .reduce((s, e) => s + parseFloat(String(e.amount || 0)), 0);
  const cashNet    = cashReceipts - cashExpenses;
  const cashRatio  = cashExpenses === 0
    ? (cashReceipts > 0 ? 100 : 0)
    : Math.min(100, Math.round((cashReceipts / (cashReceipts + cashExpenses)) * 100));
  const cashStatus = cashNet > 0 ? "ahead" : cashNet < 0 ? "behind" : "breakeven";

  const fmtR = (n: number) => `R${Math.round(n).toLocaleString("en-ZA")}`;

  // Service stats
  const jobsCompletedThisMonth = allJobs.filter(j => {
    const d = j.scheduledDate ? new Date(j.scheduledDate) : null;
    return j.status === "completed" && d && d >= monthStart;
  }).length;
  const invoicesSentThisMonth = allInvoices.filter(i => {
    const d = new Date(i.issueDate);
    return d >= monthStart && (i.status === "sent" || i.status === "paid");
  }).length;

  const addSalesRep = useMutation({
    mutationFn: () => apiRequest("POST", "/api/workers", {
      ...newRep,
      departmentId: "div-5",
      isActive: true,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workers"] });
      setShowAddRep(false);
      setNewRep({ name: "", email: "", phone: "", role: "Sales Consultant" });
      toast({ title: "Sales rep added", description: `${newRep.name} has been added to the sales team.` });
    },
    onError: () => toast({ title: "Error", description: "Failed to add sales rep.", variant: "destructive" }),
  });

  return (
    <div className="min-h-screen flex bg-gray-50" data-testid="dashboard-page">
      <Sidebar />

      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="relative bg-white w-64 shadow-lg">
            <Sidebar />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title={rolePageTitles[dashboardRole]}
          onMobileMenuToggle={() => setIsMobileMenuOpen(true)}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-20 lg:pb-6">
          <div className="space-y-4 max-w-screen-xl mx-auto">

            {/* ── Company identity strip ─────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">

              {/* Logo row */}
              <div className="flex items-center justify-between px-4 pt-3 pb-2.5">
                <TerminatorsLogo size="sm" data-testid="company-logo" />
                <div className="flex flex-col items-end gap-0.5">
                  <span className={`px-3 py-1 rounded-full text-white text-xs font-bold ${dashboardRoleColors[dashboardRole]}`}>
                    {dashboardRoleLabels[dashboardRole]} View
                  </span>
                  <span className="text-[11px] text-gray-400 italic hidden sm:block">
                    {roleSubtitles[dashboardRole]}
                  </span>
                </div>
              </div>

              {/* Stats strip */}
              <div className="border-t border-gray-100 px-4 pt-2.5 pb-0.5">
                <p className="text-[10px] font-semibold text-gray-300 uppercase tracking-widest mb-2">
                  {roleSnapshotLabels[dashboardRole]}
                </p>
              </div>
              <div className="px-4 pb-3">

                {/* SALES role */}
                {dashboardRole === "sales" && (
                  <div className="flex gap-2 flex-wrap">
                    {salesRepStats.map(({ rep, total, totalQuoted, won, wonValue, lost }) => (
                      <div key={rep.id} className="bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5">
                        <p className="text-xs font-semibold text-gray-800">{rep.name.split(" ")[0]}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          <span className="text-purple-600 font-medium">{total}</span> quoted
                          {totalQuoted > 0 && <span className="text-gray-400"> · R{totalQuoted.toLocaleString()}</span>}
                        </p>
                        <p className="text-xs text-gray-500">
                          <span className="text-green-600 font-medium">{won}</span> won
                          {wonValue > 0 && <span className="text-gray-400"> · R{wonValue.toLocaleString()}</span>}
                          <span className="mx-1 text-gray-300">·</span>
                          <span className="text-red-500 font-medium">{lost}</span> lost
                        </p>
                      </div>
                    ))}
                    {salesReps.length === 0 && <p className="text-xs text-gray-400 italic">No sales reps yet.</p>}
                  </div>
                )}

                {/* MANAGER / ADMIN: three-column strip */}
                {(dashboardRole === "manager" || dashboardRole === "admin") && (
                  <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-0">

                    {/* Sales column */}
                    <div className="sm:flex-shrink-0 sm:pr-4">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Sales Department</p>
                        <button
                          onClick={() => setShowAddRep(true)}
                          className="flex items-center gap-0.5 text-[10px] text-gray-400 hover:text-gray-600 border border-gray-200 rounded px-1.5 py-0.5 hover:border-gray-300 transition-colors"
                        >
                          <UserPlus className="h-2.5 w-2.5" /> Add
                        </button>
                      </div>
                      <div className="flex gap-1.5 flex-wrap">
                        {salesRepStats.map(({ rep, total, won, lost }) => (
                          <div key={rep.id} className="bg-gray-50 border border-gray-200 rounded-md px-2 py-1">
                            <p className="text-[11px] font-semibold text-gray-700">{rep.name.split(" ")[0]}</p>
                            <p className="text-[10px] text-gray-400 leading-tight">
                              <span className="text-purple-600 font-medium">{total}</span> quoted ·{" "}
                              <span className="text-green-600 font-medium">{won}</span> won ·{" "}
                              <span className="text-red-500 font-medium">{lost}</span> lost
                            </p>
                          </div>
                        ))}
                        {salesReps.length === 0 && <p className="text-[10px] text-gray-400 italic">None</p>}
                      </div>
                    </div>

                    <div className="hidden sm:block w-px bg-gray-200 self-stretch flex-shrink-0" />
                    <div className="sm:hidden h-px bg-gray-100 w-full" />

                    {/* Service column */}
                    <div className="sm:flex-shrink-0 sm:px-4">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Service Department</p>
                      <div className="flex gap-1.5 flex-wrap">
                        {[
                          { label: "active jobs",  value: metrics?.activeJobs ?? "—",    cls: "bg-blue-50 border-blue-100", val: "text-blue-600" },
                          { label: "workers",      value: metrics?.activeWorkers ?? "—",  cls: "bg-teal-50 border-teal-100", val: "text-teal-600" },
                          { label: "done / month", value: jobsCompletedThisMonth,         cls: "bg-purple-50 border-purple-100", val: "text-purple-600" },
                          { label: "invoiced",     value: invoicesSentThisMonth,           cls: "bg-indigo-50 border-indigo-100", val: "text-indigo-600" },
                        ].map(({ label, value, cls, val }) => (
                          <div key={label} className={`border rounded-md px-2 py-1 text-center min-w-[52px] ${cls}`}>
                            <p className={`text-sm font-bold leading-tight ${val}`}>{value}</p>
                            <p className="text-[10px] text-gray-400">{label}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="hidden sm:block w-px bg-gray-200 self-stretch flex-shrink-0" />
                    <div className="sm:hidden h-px bg-gray-100 w-full" />

                    {/* Finance column */}
                    <div className="sm:flex-shrink-0 sm:pl-4">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Finance Department</p>
                      <div className="flex gap-1.5 flex-wrap">
                        {[
                          { label: "revenue",   value: `R${Math.round(metrics?.monthlyRevenue ?? 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")}`, cls: "bg-green-50 border-green-100", val: "text-green-600", minW: "min-w-[72px]" },
                          { label: "debtors",   value: `R${Math.round(debtors).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")}`,                    cls: "bg-red-50 border-red-100",   val: "text-red-600",   minW: "min-w-[72px]" },
                          { label: "expiring",  value: metrics?.expiringContracts ?? "—",                                                              cls: "bg-amber-50 border-amber-100", val: "text-amber-600", minW: "min-w-[52px]" },
                        ].map(({ label, value, cls, val, minW }) => (
                          <div key={label} className={`border rounded-md px-2 py-1 text-center ${minW} ${cls}`}>
                            <p className={`text-sm font-bold leading-tight ${val}`}>{value}</p>
                            <p className="text-[10px] text-gray-400">{label}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                )}

                {/* ACCOUNTS role */}
                {dashboardRole === "accounts" && (
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { label: "Debtors",   sub: "outstanding",  value: `R${Math.round(debtors).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")}`,         cls: "bg-red-50 border-red-100",   val: "text-red-600" },
                      { label: "Sales",     sub: "this month",   value: `R${Math.round(salesThisMonth).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")}`, cls: "bg-blue-50 border-blue-100", val: "text-blue-600" },
                      { label: "Collected", sub: "of sales",     value: `${collectedPct}%`,                                                              cls: "bg-green-50 border-green-100", val: "text-green-600" },
                    ].map(({ label, sub, value, cls, val }) => (
                      <div key={label} className={`border rounded-md px-2.5 py-1.5 min-w-[90px] ${cls}`}>
                        <p className="text-[10px] text-gray-500">{label}</p>
                        <p className={`text-sm font-bold ${val}`}>{value}</p>
                        <p className="text-[10px] text-gray-400">{sub}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* COORDINATOR role — compact 6-stat grid inside the top card */}
                {dashboardRole === "coordinator" && (() => {
                  const todayStr = format(new Date(), "yyyy-MM-dd");
                  const todayJobs = allJobs.filter(j => {
                    if (!j.scheduledDate) return false;
                    const d = new Date(j.scheduledDate);
                    return format(d, "yyyy-MM-dd") === todayStr;
                  });
                  const coordStats = [
                    { label: "Jobs Done Today",    value: todayJobs.filter(j => j.status === "completed").length,                                   cls: "bg-green-50 border-green-100",   val: "text-green-600" },
                    { label: "In Progress",         value: todayJobs.filter(j => j.status === "in-progress" || j.status === "in_progress").length,   cls: "bg-blue-50 border-blue-100",     val: "text-blue-600" },
                    { label: "Scheduled/Pending",   value: todayJobs.filter(j => j.status === "scheduled" || j.status === "pending").length,         cls: "bg-orange-50 border-orange-100", val: "text-orange-600" },
                    { label: "Unassigned",          value: todayJobs.filter(j => !j.workerId).length,                                               cls: todayJobs.filter(j => !j.workerId).length > 0 ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-100", val: todayJobs.filter(j => !j.workerId).length > 0 ? "text-red-600" : "text-gray-400" },
                    { label: "Workers Active",      value: metrics?.activeWorkers ?? "—",                                                           cls: "bg-cyan-50 border-cyan-100",     val: "text-cyan-700" },
                    { label: "Awaiting Review",     value: todayJobs.filter(j => j.status === "completed" && !j.notes).length,                      cls: todayJobs.filter(j => j.status === "completed" && !j.notes).length > 0 ? "bg-amber-50 border-amber-200" : "bg-gray-50 border-gray-100", val: todayJobs.filter(j => j.status === "completed" && !j.notes).length > 0 ? "text-amber-600" : "text-gray-400" },
                  ];
                  return (
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {coordStats.map(({ label, value, cls, val }) => (
                        <div key={label} className={`border rounded-lg px-2 py-2 text-center ${cls}`}>
                          <p className={`text-xl font-bold leading-tight ${val}`}>{value}</p>
                          <p className="text-[10px] text-gray-500 font-medium mt-0.5 leading-tight">{label}</p>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* SERVICE role — 4 stat cards, filtered to the matched worker */}
                {dashboardRole === "service" && (() => {
                  const todayStr = format(new Date(), "yyyy-MM-dd");

                  // Same worker-finding logic as ServiceDashboard
                  const serviceDepts = new Set(["div-1","div-2","div-3","div-4"]);
                  const myWorker =
                    salesWorkers.find(w => w.id === (user as any)?.id || w.email === (user as any)?.email) ??
                    salesWorkers
                      .filter(w => serviceDepts.has(w.departmentId ?? "") && w.isActive !== false)
                      .map(w => ({ w, count: allJobs.filter(j => j.workerId === w.id).length }))
                      .sort((a, b) => b.count - a.count)[0]?.w;

                  const myJobs  = myWorker ? allJobs.filter(j => j.workerId === myWorker.id) : [];
                  const myToday = myJobs.filter(j => {
                    if (!j.scheduledDate) return false;
                    return format(new Date(j.scheduledDate), "yyyy-MM-dd") === todayStr;
                  });

                  const stats = [
                    { label: "Jobs Today",        value: myToday.length,                                                                           cls: "bg-blue-50 border-blue-100",   val: "text-blue-700"   },
                    { label: "Completed Today",   value: myToday.filter(j => j.status === "completed").length,                                     cls: "bg-green-50 border-green-100", val: "text-green-700"  },
                    { label: "In Progress",       value: myToday.filter(j => j.status === "in-progress" || j.status === "in_progress").length,      cls: myToday.filter(j => j.status === "in-progress" || j.status === "in_progress").length > 0 ? "bg-indigo-50 border-indigo-200" : "bg-gray-50 border-gray-100", val: myToday.filter(j => j.status === "in-progress" || j.status === "in_progress").length > 0 ? "text-indigo-600" : "text-gray-400" },
                    { label: "Field Diaries Due", value: myJobs.filter(j => j.status === "completed" && !j.notes).length,                          cls: myJobs.filter(j => j.status === "completed" && !j.notes).length > 0 ? "bg-amber-50 border-amber-200" : "bg-gray-50 border-gray-100", val: myJobs.filter(j => j.status === "completed" && !j.notes).length > 0 ? "text-amber-600" : "text-gray-400" },
                  ];

                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {stats.map(({ label, value, cls, val }) => (
                        <div key={label} className={`border rounded-lg px-2 py-2 text-center ${cls}`}>
                          <p className={`text-xl font-bold leading-tight ${val}`}>{value}</p>
                          <p className="text-[10px] text-gray-500 font-medium mt-0.5 leading-tight">{label}</p>
                        </div>
                      ))}
                    </div>
                  );
                })()}

              </div>

            </div>
            {/* ── End company strip ──────────────────────────────── */}

            {/* ── Profit Position + Cash Flow summary cards ──────── */}
            {(dashboardRole === "admin" || dashboardRole === "accounts" || dashboardRole === "manager") && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                {/* Profit Position card */}
                <Link href="/finance-dashboard">
                  <div className={`rounded-2xl border-2 p-4 cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 ${
                    profitStatus === "ahead"     ? "bg-emerald-50 border-emerald-300"
                    : profitStatus === "behind"  ? "bg-red-50 border-red-300"
                    :                              "bg-amber-50 border-amber-300"
                  }`}>
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-1.5">
                        {profitStatus === "ahead"
                          ? <TrendingUp className="h-4 w-4 text-emerald-600" />
                          : profitStatus === "behind"
                          ? <TrendingDown className="h-4 w-4 text-red-600" />
                          : <Minus className="h-4 w-4 text-amber-600" />}
                        <span className="text-sm font-bold text-gray-800">Profit Position</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-gray-400 font-medium">{format(now, "MMMM yyyy")}</span>
                        <ArrowRight className="h-3 w-3 text-gray-400" />
                      </div>
                    </div>

                    {/* Net figure */}
                    <p className={`text-3xl font-extrabold tracking-tight mb-1 ${
                      profitStatus === "ahead"  ? "text-emerald-700"
                      : profitStatus === "behind" ? "text-red-700"
                      :                             "text-amber-700"
                    }`}>
                      {profitNet >= 0 ? "+" : ""}{fmtR(profitNet)}
                    </p>

                    {/* Sales / Expenses row */}
                    <div className="flex gap-3 mb-3 text-xs text-gray-500">
                      <span><span className="font-semibold text-gray-700">{fmtR(profitSales)}</span> invoiced</span>
                      <span className="text-gray-300">·</span>
                      <span><span className="font-semibold text-gray-700">{fmtR(profitExpenses)}</span> expenses</span>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full h-2 bg-white/70 rounded-full overflow-hidden mb-2">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          profitStatus === "ahead"  ? "bg-emerald-500"
                          : profitStatus === "behind" ? "bg-red-500"
                          :                             "bg-amber-500"
                        }`}
                        style={{ width: `${profitRatio}%` }}
                      />
                    </div>

                    {/* Status badge */}
                    <div className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                      profitStatus === "ahead"  ? "bg-emerald-200 text-emerald-800"
                      : profitStatus === "behind" ? "bg-red-200 text-red-800"
                      :                             "bg-amber-200 text-amber-800"
                    }`}>
                      {profitStatus === "ahead"
                        ? <><ArrowUpRight className="h-3 w-3" /> Ahead</>
                        : profitStatus === "behind"
                        ? <><ArrowDownRight className="h-3 w-3" /> Behind</>
                        : <><Minus className="h-3 w-3" /> Break-even</>}
                    </div>
                  </div>
                </Link>

                {/* Cash Flow card */}
                <Link href="/finance-dashboard">
                  <div className={`rounded-2xl border-2 p-4 cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 ${
                    cashStatus === "ahead"    ? "bg-emerald-50 border-emerald-300"
                    : cashStatus === "behind" ? "bg-red-50 border-red-300"
                    :                           "bg-amber-50 border-amber-300"
                  }`}>
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-1.5">
                        {cashStatus === "ahead"
                          ? <TrendingUp className="h-4 w-4 text-emerald-600" />
                          : cashStatus === "behind"
                          ? <TrendingDown className="h-4 w-4 text-red-600" />
                          : <Minus className="h-4 w-4 text-amber-600" />}
                        <span className="text-sm font-bold text-gray-800">Cash Flow Position</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-gray-400 font-medium">{format(now, "MMMM yyyy")}</span>
                        <ArrowRight className="h-3 w-3 text-gray-400" />
                      </div>
                    </div>

                    {/* Net figure */}
                    <p className={`text-3xl font-extrabold tracking-tight mb-1 ${
                      cashStatus === "ahead"  ? "text-emerald-700"
                      : cashStatus === "behind" ? "text-red-700"
                      :                           "text-amber-700"
                    }`}>
                      {cashNet >= 0 ? "+" : ""}{fmtR(cashNet)}
                    </p>

                    {/* Receipts / Paid expenses row */}
                    <div className="flex gap-3 mb-3 text-xs text-gray-500">
                      <span><span className="font-semibold text-gray-700">{fmtR(cashReceipts)}</span> collected</span>
                      <span className="text-gray-300">·</span>
                      <span><span className="font-semibold text-gray-700">{fmtR(cashExpenses)}</span> paid out</span>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full h-2 bg-white/70 rounded-full overflow-hidden mb-2">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          cashStatus === "ahead"  ? "bg-emerald-500"
                          : cashStatus === "behind" ? "bg-red-500"
                          :                           "bg-amber-500"
                        }`}
                        style={{ width: `${cashRatio}%` }}
                      />
                    </div>

                    {/* Status badge */}
                    <div className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                      cashStatus === "ahead"  ? "bg-emerald-200 text-emerald-800"
                      : cashStatus === "behind" ? "bg-red-200 text-red-800"
                      :                           "bg-amber-200 text-amber-800"
                    }`}>
                      {cashStatus === "ahead"
                        ? <><ArrowUpRight className="h-3 w-3" /> Ahead</>
                        : cashStatus === "behind"
                        ? <><ArrowDownRight className="h-3 w-3" /> Behind</>
                        : <><Minus className="h-3 w-3" /> Break-even</>}
                    </div>
                  </div>
                </Link>

              </div>
            )}
            {/* ── End Profit / Cash Flow cards ───────────────────── */}

            {/* Suspended services — its own standalone alert card */}
            <SuspendedServices />

            {/* ── Role-specific dashboard sections ──────────────── */}
            {dashboardRole === "service"     && <ServiceDashboard />}
            {dashboardRole === "coordinator" && <CoordinatorDashboard />}
            {dashboardRole === "sales"       && <SalesDashboard />}
            {dashboardRole === "accounts"    && <AccountsDashboard />}
            {dashboardRole === "manager"     && <ManagerDashboard />}
            {dashboardRole === "admin"       && <AdminDashboard />}

          </div>
        </main>
      </div>

      <MobileNavigation />

      {/* Add Sales Rep dialog */}
      <Dialog open={showAddRep} onOpenChange={setShowAddRep}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Sales Rep</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {[
              { id: "rep-name",  label: "Name",  placeholder: "Full name",     key: "name"  as const },
              { id: "rep-email", label: "Email", placeholder: "Email address", key: "email" as const },
              { id: "rep-phone", label: "Phone", placeholder: "Phone number",  key: "phone" as const },
            ].map(({ id, label, placeholder, key }) => (
              <div key={id}>
                <Label htmlFor={id}>{label}</Label>
                <Input
                  id={id}
                  placeholder={placeholder}
                  value={newRep[key]}
                  onChange={e => setNewRep(p => ({ ...p, [key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddRep(false)}>Cancel</Button>
            <Button
              onClick={() => addSalesRep.mutate()}
              disabled={addSalesRep.isPending || !newRep.name}
              className="bg-[#1a3a8f] hover:bg-[#142d72] text-white"
            >
              {addSalesRep.isPending ? "Adding…" : "Add Rep"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
