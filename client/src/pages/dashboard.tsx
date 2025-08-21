import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import MobileNavigation from "@/components/layout/mobile-nav";
import MetricsCards from "@/components/dashboard/metrics-cards";
import DivisionPerformance from "@/components/dashboard/division-performance";
import NotificationsPanel from "@/components/dashboard/notifications";
import RecentJobs from "@/components/dashboard/recent-jobs";
import TodaysSchedule from "@/components/dashboard/schedule";
import QuickActions from "@/components/dashboard/quick-actions";
import SalesPerformance from "@/components/dashboard/sales-performance";
import { DepartmentOverview } from "@/components/dashboard/department-overview";
import { TerminatorsLogo } from "@/components/terminators-logo";
import { useToast } from "@/hooks/use-toast";

interface DashboardMetrics {
  activeJobs: number;
  activeWorkers: number;
  expiringContracts: number;
  monthlyRevenue: number;
  divisions: Array<{
    division: {
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month'>('today');
  
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
          title="Dashboard" 
          onMobileMenuToggle={() => setIsMobileMenuOpen(true)}
        />
        
        <main className="flex-1 overflow-y-auto p-6 pb-20 lg:pb-6">
          <div className="space-y-6">
            {/* Company Logo Header */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <TerminatorsLogo size="lg" className="mx-auto" data-testid="company-logo" />
            </div>

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

            {/* Sales Performance Dashboard */}
            <SalesPerformance className="mb-6" />

            {/* Division Performance and Quick Actions */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2">
                <DivisionPerformance
                  divisions={metrics?.divisions || []}
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
          </div>
        </main>
      </div>
      
      <MobileNavigation />
    </div>
  );
}
