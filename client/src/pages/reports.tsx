import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import MobileNavigation from "@/components/layout/mobile-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, DateRange } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { BarChart3, TrendingUp, FileText, Download, Calendar as CalendarIcon, DollarSign } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Job, RentalContract, Worker, Division } from "@shared/schema";

export default function Reports() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date(),
  });

  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: ['/api/jobs'],
  });

  const { data: contracts = [] } = useQuery<RentalContract[]>({
    queryKey: ['/api/contracts'],
  });

  const { data: workers = [] } = useQuery<Worker[]>({
    queryKey: ['/api/workers'],
  });

  const { data: divisions = [] } = useQuery<Division[]>({
    queryKey: ['/api/divisions'],
  });

  // Filter jobs by date range
  const filteredJobs = jobs.filter(job => {
    if (!dateRange?.from || !dateRange?.to) return true;
    const jobDate = new Date(job.scheduledDate);
    return jobDate >= dateRange.from && jobDate <= dateRange.to;
  });

  // Calculate job statistics
  const jobStats = {
    total: filteredJobs.length,
    completed: filteredJobs.filter(j => j.status === 'completed').length,
    inProgress: filteredJobs.filter(j => j.status === 'in_progress').length,
    pending: filteredJobs.filter(j => j.status === 'pending').length,
    cancelled: filteredJobs.filter(j => j.status === 'cancelled').length,
  };

  // Calculate division performance
  const divisionStats = divisions.map(division => {
    const divisionJobs = filteredJobs.filter(j => j.divisionId === division.id);
    const divisionWorkers = workers.filter(w => w.divisionId === division.id && w.isActive);
    
    return {
      division,
      jobCount: divisionJobs.length,
      completedJobs: divisionJobs.filter(j => j.status === 'completed').length,
      activeWorkers: divisionWorkers.length,
      completionRate: divisionJobs.length > 0 ? 
        Math.round((divisionJobs.filter(j => j.status === 'completed').length / divisionJobs.length) * 100) : 0,
    };
  });

  // Calculate worker performance
  const workerStats = workers.map(worker => {
    const workerJobs = filteredJobs.filter(j => j.workerId === worker.id);
    const division = divisions.find(d => d.id === worker.divisionId);
    
    return {
      worker,
      division,
      jobCount: workerJobs.length,
      completedJobs: workerJobs.filter(j => j.status === 'completed').length,
      completionRate: workerJobs.length > 0 ? 
        Math.round((workerJobs.filter(j => j.status === 'completed').length / workerJobs.length) * 100) : 0,
    };
  }).sort((a, b) => b.jobCount - a.jobCount);

  // Calculate contract statistics
  const activeContracts = contracts.filter(c => c.isActive);
  const expiringContracts = contracts.filter(c => {
    if (!c.endDate || !c.isActive) return false;
    const endDate = new Date(c.endDate);
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return endDate <= thirtyDaysFromNow;
  });

  const totalMonthlyRevenue = activeContracts.reduce((sum, contract) => 
    sum + Number(contract.monthlyPrice), 0
  );

  const handleExportReport = () => {
    // This would implement actual PDF/Excel export
    alert("Export functionality would be implemented here");
  };

  return (
    <div className="min-h-screen flex bg-gray-50" data-testid="reports-page">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Reports & Analytics" />
        
        <main className="flex-1 overflow-y-auto p-6 pb-20 lg:pb-6">
          {/* Date Range Selector */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Business Reports</h3>
              <p className="text-sm text-gray-600">
                Analyze performance and generate insights for your business
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[260px] justify-start text-left font-normal",
                      !dateRange && "text-muted-foreground"
                    )}
                    data-testid="date-range-picker"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {formatDate(dateRange.from)} - {formatDate(dateRange.to)}
                        </>
                      ) : (
                        formatDate(dateRange.from)
                      )
                    ) : (
                      <span>Pick a date range</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
              <Button onClick={handleExportReport} data-testid="button-export-report">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>

          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
              <TabsTrigger value="jobs" data-testid="tab-jobs">Job Analytics</TabsTrigger>
              <TabsTrigger value="workers" data-testid="tab-workers">Worker Performance</TabsTrigger>
              <TabsTrigger value="contracts" data-testid="tab-contracts">Contract Reports</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="metric-total-jobs">{jobStats.total}</div>
                    <p className="text-xs text-muted-foreground">
                      In selected period
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="metric-completion-rate">
                      {jobStats.total > 0 ? Math.round((jobStats.completed / jobStats.total) * 100) : 0}%
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {jobStats.completed} of {jobStats.total} jobs completed
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Contracts</CardTitle>
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="metric-active-contracts">{activeContracts.length}</div>
                    <p className="text-xs text-muted-foreground">
                      {expiringContracts.length} expiring soon
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="metric-monthly-revenue">
                      {formatCurrency(totalMonthlyRevenue)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      From rental contracts
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Division Performance */}
              <Card>
                <CardHeader>
                  <CardTitle>Division Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {divisionStats.map((stat) => (
                      <div key={stat.division.id} className="flex items-center justify-between p-4 border rounded-lg" data-testid={`division-stat-${stat.division.id}`}>
                        <div className="flex items-center space-x-4">
                          <div 
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: stat.division.colorCode }}
                          ></div>
                          <div>
                            <h4 className="font-medium">{stat.division.name}</h4>
                            <p className="text-sm text-gray-600">{stat.activeWorkers} active workers</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold">{stat.jobCount} jobs</p>
                          <Badge variant="secondary">
                            {stat.completionRate}% complete
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="jobs" className="space-y-6">
              {/* Job Status Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg text-green-600">Completed</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold" data-testid="jobs-completed">{jobStats.completed}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg text-orange-600">In Progress</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold" data-testid="jobs-in-progress">{jobStats.inProgress}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg text-gray-600">Pending</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold" data-testid="jobs-pending">{jobStats.pending}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg text-red-600">Cancelled</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold" data-testid="jobs-cancelled">{jobStats.cancelled}</div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="workers" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Worker Performance Rankings</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {workerStats.slice(0, 10).map((stat, index) => (
                      <div key={stat.worker.id} className="flex items-center justify-between p-4 border rounded-lg" data-testid={`worker-stat-${stat.worker.id}`}>
                        <div className="flex items-center space-x-4">
                          <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                            <span className="text-sm font-bold text-primary-700">#{index + 1}</span>
                          </div>
                          <div>
                            <h4 className="font-medium">{stat.worker.name}</h4>
                            <p className="text-sm text-gray-600">{stat.division?.name || 'Unknown Division'}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold">{stat.jobCount} jobs</p>
                          <Badge variant="secondary">
                            {stat.completionRate}% complete
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="contracts" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Contract Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between">
                      <span>Total Contracts:</span>
                      <span className="font-semibold" data-testid="contracts-total">{contracts.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Active Contracts:</span>
                      <span className="font-semibold text-green-600" data-testid="contracts-active">{activeContracts.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Expiring Soon:</span>
                      <span className="font-semibold text-orange-600" data-testid="contracts-expiring">{expiringContracts.length}</span>
                    </div>
                    <div className="flex justify-between border-t pt-4">
                      <span>Monthly Revenue:</span>
                      <span className="font-bold text-lg" data-testid="contracts-revenue">{formatCurrency(totalMonthlyRevenue)}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Expiring Contracts</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {expiringContracts.length === 0 ? (
                      <p className="text-gray-600">No contracts expiring in the next 30 days</p>
                    ) : (
                      <div className="space-y-3">
                        {expiringContracts.slice(0, 5).map((contract) => (
                          <div key={contract.id} className="flex justify-between items-center p-3 border rounded" data-testid={`expiring-contract-${contract.id}`}>
                            <div>
                              <p className="font-medium">Contract #{contract.id.slice(-6)}</p>
                              <p className="text-sm text-gray-600">{formatCurrency(Number(contract.monthlyPrice))}/month</p>
                            </div>
                            <Badge variant="destructive">
                              {contract.endDate && formatDate(contract.endDate)}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>
      
      <MobileNavigation />
    </div>
  );
}
