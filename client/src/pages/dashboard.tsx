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

export default function Dashboard() {
  const { toast } = useToast();
  
  const { data: metrics, isLoading } = useQuery<DashboardMetrics>({
    queryKey: ['/api/dashboard/metrics'],
    refetchInterval: 30000, // Refresh every 30 seconds
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
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Dashboard" />
        
        <main className="flex-1 overflow-y-auto p-6 pb-20 lg:pb-6">
          <MetricsCards 
            data={metrics || { activeJobs: 0, activeWorkers: 0, expiringContracts: 0, monthlyRevenue: 0 }}
            isLoading={isLoading}
          />
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="lg:col-span-2">
              <DivisionPerformance 
                divisions={metrics?.divisions || []}
                isLoading={isLoading}
              />
            </div>
            <NotificationsPanel />
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <RecentJobs />
            <TodaysSchedule />
          </div>
          
          <QuickActions
            onCreateJob={handleCreateJob}
            onAssignWorker={handleAssignWorker}
            onManageInventory={handleManageInventory}
            onGenerateReport={handleGenerateReport}
          />
        </main>
      </div>
      
      <MobileNavigation />
    </div>
  );
}
