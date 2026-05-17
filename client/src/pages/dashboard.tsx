import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import MobileNavigation from "@/components/layout/mobile-nav";
import { ServiceDashboard } from "@/components/dashboard/service-dashboard";
import { SalesDashboard } from "@/components/dashboard/sales-dashboard";
import { AccountsDashboard } from "@/components/dashboard/accounts-dashboard";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";
import { ManagerDashboard } from "@/components/dashboard/manager-dashboard";
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
import { UserPlus } from "lucide-react";
import type { Worker, QuoteSubmission, Invoice, Job } from "@shared/schema";

interface DashboardMetrics {
  activeJobs: number;
  activeWorkers: number;
  expiringContracts: number;
  monthlyRevenue: number;
}

const rolePageTitles: Record<DashboardRole, string> = {
  admin:    "Managing Member Dashboard",
  manager:  "Service Manager Dashboard",
  sales:    "Sales Dashboard",
  service:  "My Jobs Dashboard",
  accounts: "Finance Dashboard",
};

const roleSubtitles: Record<DashboardRole, string> = {
  admin:    "Full business overview — sales, service, and finance",
  manager:  "Operations, jobs, staff workload and performance",
  sales:    "Leads, quotes, pipeline and client activity",
  service:  "Your assigned jobs, schedule and field activity",
  accounts: "Invoices, debtors, creditors and recurring revenue",
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
          <div className="space-y-6 max-w-screen-xl mx-auto">

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
              <div className="border-t border-gray-100 px-4 pt-3 pb-3">

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
                          { label: "revenue",   value: `R${(metrics?.monthlyRevenue ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, cls: "bg-green-50 border-green-100", val: "text-green-600", minW: "min-w-[72px]" },
                          { label: "debtors",   value: `R${debtors.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,                          cls: "bg-red-50 border-red-100",   val: "text-red-600",   minW: "min-w-[72px]" },
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
                      { label: "Debtors",   sub: "outstanding",  value: `R${debtors.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,          cls: "bg-red-50 border-red-100",   val: "text-red-600" },
                      { label: "Sales",     sub: "this month",   value: `R${salesThisMonth.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,    cls: "bg-blue-50 border-blue-100", val: "text-blue-600" },
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

                {/* SERVICE role */}
                {dashboardRole === "service" && (
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { label: "Jobs Done",  sub: "this month", value: jobsCompletedThisMonth, cls: "bg-green-50 border-green-100", val: "text-green-600" },
                      { label: "Invoiced",   sub: "this month", value: invoicesSentThisMonth,  cls: "bg-blue-50 border-blue-100",  val: "text-blue-600"  },
                      { label: "Active Jobs", sub: "right now", value: metrics?.activeJobs ?? "—", cls: "bg-orange-50 border-orange-100", val: "text-orange-600" },
                    ].map(({ label, sub, value, cls, val }) => (
                      <div key={label} className={`border rounded-md px-2.5 py-1.5 min-w-[90px] ${cls}`}>
                        <p className="text-[10px] text-gray-500">{label}</p>
                        <p className={`text-lg font-bold ${val}`}>{value}</p>
                        <p className="text-[10px] text-gray-400">{sub}</p>
                      </div>
                    ))}
                  </div>
                )}

              </div>

            </div>
            {/* ── End company strip ──────────────────────────────── */}

            {/* Suspended services — its own standalone alert card */}
            <SuspendedServices />

            {/* ── Role-specific dashboard sections ──────────────── */}
            {dashboardRole === "service"  && <ServiceDashboard />}
            {dashboardRole === "sales"    && <SalesDashboard />}
            {dashboardRole === "accounts" && <AccountsDashboard />}
            {dashboardRole === "manager"  && <ManagerDashboard />}
            {dashboardRole === "admin"    && <AdminDashboard />}

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
