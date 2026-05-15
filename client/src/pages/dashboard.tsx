import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import MobileNavigation from "@/components/layout/mobile-nav";
import MetricsCards from "@/components/dashboard/metrics-cards";
import DepartmentPerformance from "@/components/dashboard/department-performance";
import NotificationsPanel from "@/components/dashboard/notifications";
import RecentJobs from "@/components/dashboard/recent-jobs";
import TodaysSchedule from "@/components/dashboard/schedule";
import QuickActions from "@/components/dashboard/quick-actions";
import SalesPerformance from "@/components/dashboard/sales-performance";
import { WorkerJobsSummary } from "@/components/dashboard/worker-jobs-summary";
import { DepartmentOverview } from "@/components/dashboard/department-overview";
import { ServiceDashboard } from "@/components/dashboard/service-dashboard";
import { SalesDashboard } from "@/components/dashboard/sales-dashboard";
import { AccountsDashboard } from "@/components/dashboard/accounts-dashboard";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";
import { ManagerDashboard } from "@/components/dashboard/manager-dashboard";
import { SuspendedServices } from "@/components/dashboard/suspended-services";
import { TerminatorsLogo } from "@/components/terminators-logo";
import { useAuth } from "@/hooks/useAuth";
import { getDashboardRole, dashboardRoleLabels, dashboardRoleColors } from "@/lib/dashboardRole";
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
  departments: Array<{
    department: {
      id: string;
      name: string;
      colorCode: string;
    };
    activeWorkers: number;
    jobsToday: number;
    completed: number;
    inProgress: number;
    pending: number;
  }>;
}

interface DashboardAnalytics {
  customers: { count: number; new: number };
  jobs: { total: number; completed: number; inProgress: number; pending: number };
  revenue: { total: number; invoiced: number; paid: number };
  contracts: { active: number; expiring: number };
  inventory: { totalItems: number; lowStock: number; criticalStock: number };
}

interface RevenueChartData {
  date: string;
  revenue: number;
  jobs: number;
}

export default function Dashboard() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [showAddRep, setShowAddRep] = useState(false);
  const [newRep, setNewRep] = useState({ name: "", email: "", phone: "", role: "Sales Consultant" });

  const dashboardRole = getDashboardRole(user ?? {});

  const { data: salesWorkers = [] } = useQuery<Worker[]>({ queryKey: ["/api/workers"] });
  const { data: allQuotes = [] } = useQuery<QuoteSubmission[]>({ queryKey: ["/api/quote-submissions"] });
  const { data: allInvoices = [] } = useQuery<Invoice[]>({ queryKey: ["/api/invoices"] });
  const { data: allJobs = [] } = useQuery<Job[]>({ queryKey: ["/api/jobs"] });

  // Sales rep totals — only div-5 (Sales dept) workers
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

  // Accounts panel stats
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const debtors = allInvoices
    .filter(i => i.status === "sent" || i.status === "overdue")
    .reduce((s, i) => s + (parseFloat(String(i.total)) - parseFloat(String(i.paidAmount ?? "0"))), 0);
  const salesThisMonth = allInvoices
    .filter(i => new Date(i.issueDate) >= monthStart)
    .reduce((s, i) => s + parseFloat(String(i.total)), 0);
  const paidThisMonth = allInvoices
    .filter(i => new Date(i.issueDate) >= monthStart && (i.status === "paid"))
    .reduce((s, i) => s + parseFloat(String(i.total)), 0);
  const collectedPct = salesThisMonth > 0 ? Math.round((paidThisMonth / salesThisMonth) * 100) : 0;

  // Service panel stats
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

  const { data: metrics, isLoading } = useQuery<DashboardMetrics>({
    queryKey: ['/api/dashboard/metrics'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery<DashboardAnalytics>({
    queryKey: ['/api/dashboard/analytics', selectedPeriod],
    refetchInterval: 30000,
  });

  const { data: revenueChart } = useQuery<RevenueChartData[]>({
    queryKey: ['/api/dashboard/revenue-chart', 'daily', 7],
    refetchInterval: 30000,
  });

  const handleCreateJob = () => {
    toast({
      title: "Create Job",
      description: "Job creation feature coming soon!",
    });
  };

  const handleAssignWorker = () => {
    toast({
      title: "Assign Worker", 
      description: "Worker assignment feature coming soon!",
    });
  };

  const handleManageInventory = () => {
    toast({
      title: "Manage Inventory",
      description: "Inventory management feature coming soon!",
    });
  };

  const handleGenerateReport = () => {
    toast({
      title: "Generate Report",
      description: "Report generation feature coming soon!",
    });
  };

  return (
    <div className="min-h-screen flex bg-gray-50" data-testid="dashboard-page">
      <Sidebar />
      
      {/* Mobile Sidebar Overlay */}
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
          title=""
          onMobileMenuToggle={() => setIsMobileMenuOpen(true)}
          badge={`${dashboardRoleLabels[dashboardRole]} View`}
          badgeColor={dashboardRoleColors[dashboardRole]}
          tagline="Let's see how it goes"
        />

        <main className="flex-1 overflow-y-auto p-6 pb-20 lg:pb-6">
          <div className="space-y-6">
            {/* Unified card: Logo + Panels + Role Dashboard */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              {/* TOP: logo + title */}
              <div className="flex items-center gap-4 px-4 pt-4 pb-3">
                <TerminatorsLogo size="lg" data-testid="company-logo" />
                <div>
                  <p className="text-2xl font-bold text-gray-800 tracking-tight leading-tight">Job Flow</p>
                  <p className="text-xs text-gray-400 mt-0.5">Field Service Management</p>
                </div>
              </div>

              {/* Performance panels */}
              <div className="border-t border-gray-100 px-4 py-3">

                {/* SALES */}
                {dashboardRole === "sales" && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Sales</p>
                    <div className="flex gap-3 flex-wrap">
                      {salesRepStats.map(({ rep, total, totalQuoted, won, wonValue, lost }) => {
                        const firstName = rep.name.split(" ")[0];
                        return (
                          <div key={rep.id} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 min-w-[120px]">
                            <p className="text-xs font-semibold text-gray-800 truncate">{firstName}</p>
                            <div className="mt-1 space-y-0.5">
                              <p className="text-xs text-gray-500">
                                <span className="font-medium text-purple-600">{total}</span> quote{total !== 1 ? "s" : ""}
                                {totalQuoted > 0 && <span className="text-gray-400"> · R{totalQuoted.toLocaleString()}</span>}
                              </p>
                              <p className="text-xs text-gray-500">
                                <span className="font-medium text-green-600">{won}</span> won
                                {wonValue > 0 && <span className="text-gray-400"> · R{wonValue.toLocaleString()}</span>}
                              </p>
                              <p className="text-xs text-gray-500">
                                <span className="font-medium text-red-500">{lost}</span> lost
                              </p>
                            </div>
                          </div>
                        );
                      })}
                      {salesReps.length === 0 && <p className="text-xs text-gray-400 italic">No sales reps yet.</p>}
                    </div>
                  </div>
                )}

                {/* MANAGER / ADMIN — Sales | Service | Finance on one line */}
                {(dashboardRole === "manager" || dashboardRole === "admin") && (
                  <div className="flex gap-6 flex-wrap">

                    {/* Sales */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Sales</p>
                        <Button size="sm" variant="outline" className="text-xs h-6 px-2 gap-1" onClick={() => setShowAddRep(true)}>
                          <UserPlus className="h-3 w-3" /> Add Rep
                        </Button>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {salesRepStats.map(({ rep, total, won, lost }) => {
                          const firstName = rep.name.split(" ")[0];
                          return (
                            <div key={rep.id} className="bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 min-w-[100px]">
                              <p className="text-xs font-semibold text-gray-800 truncate">{firstName}</p>
                              <div className="mt-0.5 space-y-0.5">
                                <p className="text-xs text-gray-400"><span className="text-purple-600 font-medium">{total}</span> quoted</p>
                                <p className="text-xs text-gray-400"><span className="text-green-600 font-medium">{won}</span> won · <span className="text-red-500 font-medium">{lost}</span> lost</p>
                              </div>
                            </div>
                          );
                        })}
                        {salesReps.length === 0 && <p className="text-xs text-gray-400 italic">No sales reps yet.</p>}
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="w-px bg-gray-200 self-stretch" />

                    {/* Service */}
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Service</p>
                      <div className="flex gap-2 flex-wrap">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1.5 min-w-[80px]">
                          <p className="text-xs text-gray-500">Active Jobs</p>
                          <p className="text-base font-bold text-blue-600">{metrics?.activeJobs ?? "—"}</p>
                        </div>
                        <div className="bg-teal-50 border border-teal-200 rounded-lg px-2.5 py-1.5 min-w-[80px]">
                          <p className="text-xs text-gray-500">Workers</p>
                          <p className="text-base font-bold text-teal-600">{metrics?.activeWorkers ?? "—"}</p>
                        </div>
                        <div className="bg-purple-50 border border-purple-200 rounded-lg px-2.5 py-1.5 min-w-[80px]">
                          <p className="text-xs text-gray-500">Jobs Done</p>
                          <p className="text-base font-bold text-purple-600">{jobsCompletedThisMonth}</p>
                          <p className="text-xs text-gray-400">this month</p>
                        </div>
                        <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-2.5 py-1.5 min-w-[80px]">
                          <p className="text-xs text-gray-500">Invoiced</p>
                          <p className="text-base font-bold text-indigo-600">{invoicesSentThisMonth}</p>
                          <p className="text-xs text-gray-400">this month</p>
                        </div>
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="w-px bg-gray-200 self-stretch" />

                    {/* Finance */}
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Finance</p>
                      <div className="flex gap-2 flex-wrap">
                        <div className="bg-green-50 border border-green-200 rounded-lg px-2.5 py-1.5 min-w-[100px]">
                          <p className="text-xs text-gray-500">Revenue</p>
                          <p className="text-base font-bold text-green-600">R{(metrics?.monthlyRevenue ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                          <p className="text-xs text-gray-400">this month</p>
                        </div>
                        <div className="bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5 min-w-[100px]">
                          <p className="text-xs text-gray-500">Debtors</p>
                          <p className="text-base font-bold text-red-600">R{debtors.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                          <p className="text-xs text-gray-400">outstanding</p>
                        </div>
                        <div className="bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 min-w-[80px]">
                          <p className="text-xs text-gray-500">Expiring</p>
                          <p className="text-base font-bold text-amber-600">{metrics?.expiringContracts ?? "—"}</p>
                          <p className="text-xs text-gray-400">contracts</p>
                        </div>
                      </div>
                    </div>

                  </div>
                )}

                {/* ACCOUNTS */}
                {dashboardRole === "accounts" && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Finance</p>
                    <div className="flex gap-3 flex-wrap">
                      <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 min-w-[110px]">
                        <p className="text-xs text-gray-500 mb-0.5">Debtors</p>
                        <p className="text-sm font-bold text-red-600">R{debtors.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                        <p className="text-xs text-gray-400">outstanding</p>
                      </div>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 min-w-[110px]">
                        <p className="text-xs text-gray-500 mb-0.5">Sales (month)</p>
                        <p className="text-sm font-bold text-blue-600">R{salesThisMonth.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                        <p className="text-xs text-gray-400">invoiced</p>
                      </div>
                      <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 min-w-[90px]">
                        <p className="text-xs text-gray-500 mb-0.5">Collected</p>
                        <p className="text-sm font-bold text-green-600">{collectedPct}%</p>
                        <p className="text-xs text-gray-400">of month sales</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* SERVICE */}
                {dashboardRole === "service" && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Service</p>
                    <div className="flex gap-3 flex-wrap">
                      <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 min-w-[120px]">
                        <p className="text-xs text-gray-500 mb-0.5">Jobs Completed</p>
                        <p className="text-2xl font-bold text-green-600">{jobsCompletedThisMonth}</p>
                        <p className="text-xs text-gray-400">this month</p>
                      </div>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 min-w-[120px]">
                        <p className="text-xs text-gray-500 mb-0.5">Invoices Sent</p>
                        <p className="text-2xl font-bold text-blue-600">{invoicesSentThisMonth}</p>
                        <p className="text-xs text-gray-400">this month</p>
                      </div>
                    </div>
                  </div>
                )}

              </div>

              {/* Suspended services alert */}
              <div className="px-4">
                <SuspendedServices />
              </div>

              {/* Role-based dashboard content */}
              <div className="border-t border-gray-100 px-4 py-4">
                {dashboardRole === "service" && <ServiceDashboard />}
                {dashboardRole === "sales" && <SalesDashboard />}
                {dashboardRole === "accounts" && <AccountsDashboard />}
                {dashboardRole === "manager" && <ManagerDashboard />}
                {dashboardRole === "admin" && <AdminDashboard />}
              </div>
            </div>

            {/* Legacy full overview — hidden, kept for reference */}
            {false && <div className="hidden">

            {/* Period Selection and Overview */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Business Overview</h2>
                <p className="text-gray-600">Track your business performance and key metrics</p>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Time Period:</label>
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value as 'today' | 'week' | 'month')}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  data-testid="period-selector"
                >
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                </select>
              </div>
            </div>

            {/* Department Overview - New comprehensive filtering */}
            <DepartmentOverview className="mb-6" />

            {/* Enhanced Analytics Cards */}
            {analytics && !analyticsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Customers Card */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Customers</p>
                      <p className="text-3xl font-bold text-gray-900">{analytics.customers.count}</p>
                      {analytics.customers.new > 0 && (
                        <p className="text-sm text-green-600">+{analytics.customers.new} new {selectedPeriod === 'today' ? 'today' : `this ${selectedPeriod}`}</p>
                      )}
                    </div>
                    <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Jobs Card */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Jobs {selectedPeriod === 'today' ? 'Today' : `This ${selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1)}`}</p>
                      <p className="text-3xl font-bold text-gray-900">{analytics.jobs.total}</p>
                      <div className="flex gap-4 mt-2 text-xs">
                        <span className="text-green-600">{analytics.jobs.completed} completed</span>
                        <span className="text-yellow-600">{analytics.jobs.inProgress} in progress</span>
                        <span className="text-gray-500">{analytics.jobs.pending} pending</span>
                      </div>
                    </div>
                    <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                      <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Revenue Card */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Revenue {selectedPeriod === 'today' ? 'Today' : `This ${selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1)}`}</p>
                      <p className="text-3xl font-bold text-gray-900">R{analytics.revenue.total.toLocaleString()}</p>
                      <div className="flex gap-4 mt-2 text-xs">
                        <span className="text-blue-600">R{analytics.revenue.invoiced.toLocaleString()} invoiced</span>
                        <span className="text-green-600">R{analytics.revenue.paid.toLocaleString()} paid</span>
                      </div>
                    </div>
                    <div className="h-12 w-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                      <svg className="h-6 w-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Inventory Card */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Inventory Status</p>
                      <p className="text-3xl font-bold text-gray-900">{analytics.inventory.totalItems}</p>
                      <div className="flex gap-4 mt-2 text-xs">
                        {analytics.inventory.criticalStock > 0 && (
                          <span className="text-red-600">{analytics.inventory.criticalStock} critical</span>
                        )}
                        {analytics.inventory.lowStock > 0 && (
                          <span className="text-yellow-600">{analytics.inventory.lowStock} low stock</span>
                        )}
                        {analytics.inventory.criticalStock === 0 && analytics.inventory.lowStock === 0 && (
                          <span className="text-green-600">All items in stock</span>
                        )}
                      </div>
                    </div>
                    <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                      <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                    <div className="h-8 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                  </div>
                ))}
              </div>
            )}

            {/* Revenue Chart */}
            {revenueChart && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Trend (Last 7 Days)</h3>
                <div className="h-64 flex items-end justify-between space-x-2">
                  {revenueChart.map((data, index) => {
                    const maxRevenue = Math.max(...revenueChart.map(d => d.revenue));
                    const height = maxRevenue > 0 ? (data.revenue / maxRevenue) * 200 : 0;
                    return (
                      <div key={index} className="flex flex-col items-center flex-1">
                        <div className="mb-2 text-center">
                          <div className="text-xs font-medium text-gray-900">R{data.revenue.toLocaleString()}</div>
                          <div className="text-xs text-gray-500">{data.jobs} jobs</div>
                        </div>
                        <div 
                          className="bg-blue-500 rounded-t w-full min-h-[20px] transition-all"
                          style={{ height: `${Math.max(height, 20)}px` }}
                        />
                        <div className="text-xs text-gray-500 mt-2 text-center">
                          {new Date(data.date).toLocaleDateString('en-US', { weekday: 'short' })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Worker Jobs Summary */}
            <WorkerJobsSummary />

            {/* Sales Performance Dashboard */}
            <SalesPerformance className="mb-6" />

            {/* Department Performance and Quick Actions */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2">
                <DepartmentPerformance
                  departments={metrics?.departments || []}
                  isLoading={isLoading}
                />
              </div>
              <QuickActions
                onCreateJob={handleCreateJob}
                onAssignWorker={handleAssignWorker}
                onManageInventory={handleManageInventory}
                onGenerateReport={handleGenerateReport}
              />
            </div>

            {/* Notifications and Schedule */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <NotificationsPanel />
              <TodaysSchedule />
            </div>

            {/* Recent Jobs */}
            <RecentJobs />
            </div>}

          </div>
        </main>
      </div>
      
      <MobileNavigation />

      {/* Add Sales Rep Dialog */}
      <Dialog open={showAddRep} onOpenChange={setShowAddRep}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Sales Rep</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="rep-name">Full Name</Label>
              <Input
                id="rep-name"
                placeholder="e.g. Jane Smith"
                value={newRep.name}
                onChange={e => setNewRep(r => ({ ...r, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rep-email">Email</Label>
              <Input
                id="rep-email"
                type="email"
                placeholder="jane@company.com"
                value={newRep.email}
                onChange={e => setNewRep(r => ({ ...r, email: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rep-phone">Phone</Label>
              <Input
                id="rep-phone"
                placeholder="0821234567"
                value={newRep.phone}
                onChange={e => setNewRep(r => ({ ...r, phone: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rep-role">Role / Title</Label>
              <Input
                id="rep-role"
                placeholder="Sales Consultant"
                value={newRep.role}
                onChange={e => setNewRep(r => ({ ...r, role: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAddRep(false)}>Cancel</Button>
            <Button
              disabled={!newRep.name.trim() || addSalesRep.isPending}
              onClick={() => addSalesRep.mutate()}
            >
              {addSalesRep.isPending ? "Adding…" : "Add Rep"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
