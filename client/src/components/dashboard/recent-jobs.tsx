import { useQuery } from "@tanstack/react-query";
import { Bug, Sparkles } from "lucide-react";
import { formatDateTime, getStatusColor, getDivisionColor } from "@/lib/utils";
import type { Job } from "@shared/schema";

export default function RecentJobs() {
  const { data: jobs = [], isLoading } = useQuery<Job[]>({
    queryKey: ['/api/jobs'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Mock jobs for demo
  const mockJobs = [
    {
      id: "1",
      title: "Monthly Pest Control",
      clientId: "client-1",
      workerId: "worker-1", 
      divisionId: "div-1",
      serviceType: "Pest Control Inspection",
      status: "completed" as const,
      scheduledDate: new Date(),
      endTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
      location: "Pick n Pay Greenacres",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "2",
      title: "Sanitizer Refill & Maintenance", 
      clientId: "client-2",
      workerId: "worker-2",
      divisionId: "div-2", 
      serviceType: "Hand Sanitizer Service",
      status: "in_progress" as const,
      scheduledDate: new Date(),
      startTime: new Date(Date.now() - 45 * 60 * 1000),
      location: "Walmer Park Shopping",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "3",
      title: "Rodent Control Inspection",
      clientId: "client-3", 
      workerId: "worker-3",
      divisionId: "div-1",
      serviceType: "Rodent Control", 
      status: "pending" as const,
      scheduledDate: new Date(Date.now() + 60 * 60 * 1000),
      location: "Boardwalk Casino",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const displayJobs = jobs.length > 0 ? jobs.slice(-5) : mockJobs;

  const getJobIcon = (divisionId: string) => {
    return divisionId === "div-1" ? Bug : Sparkles;
  };

  const getStatusBadge = (status: string) => {
    const color = getStatusColor(status);
    const colorClasses = {
      green: "bg-green-100 text-green-800",
      orange: "bg-orange-100 text-orange-800", 
      gray: "bg-gray-100 text-gray-800",
      red: "bg-red-100 text-red-800",
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClasses[color as keyof typeof colorClasses]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
      </span>
    );
  };

  const getJobTime = (job: any) => {
    if (job.status === 'completed' && job.endTime) {
      return formatDateTime(job.endTime);
    }
    if (job.status === 'in_progress' && job.startTime) {
      return `Started: ${formatDateTime(job.startTime)}`;
    }
    return formatDateTime(job.scheduledDate);
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="h-6 bg-gray-200 rounded w-32 mb-4 animate-pulse"></div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg animate-pulse">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-gray-200 rounded-lg"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-32"></div>
                  <div className="h-3 bg-gray-200 rounded w-24"></div>
                  <div className="h-3 bg-gray-200 rounded w-28"></div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-5 bg-gray-200 rounded w-20"></div>
                <div className="h-3 bg-gray-200 rounded w-16"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6" data-testid="recent-jobs">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Recent Jobs</h3>
        <button className="text-sm text-primary-600 font-medium hover:text-primary-700" data-testid="view-all-jobs">
          View All
        </button>
      </div>
      
      <div className="space-y-4">
        {displayJobs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No recent jobs</p>
          </div>
        ) : (
          displayJobs.map((job) => {
            const Icon = getJobIcon(job.divisionId);
            const getDivisionColors = (divisionId: string) => {
              switch (divisionId) {
                case 'div-1': return { iconBg: 'bg-green-100', iconColor: 'text-green-600' };
                case 'div-2': return { iconBg: 'bg-purple-100', iconColor: 'text-purple-600' };
                case 'div-3': return { iconBg: 'bg-blue-100', iconColor: 'text-blue-600' };
                case 'div-4': return { iconBg: 'bg-orange-100', iconColor: 'text-orange-600' };
                default: return { iconBg: 'bg-gray-100', iconColor: 'text-gray-600' };
              }
            };
            const { iconBg, iconColor } = getDivisionColors(job.divisionId);
            
            return (
              <div key={job.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg" data-testid={`job-${job.id}`}>
                <div className="flex items-center space-x-4">
                  <div className={`w-10 h-10 ${iconBg} rounded-lg flex items-center justify-center`}>
                    <Icon className={`h-5 w-5 ${iconColor}`} />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900" data-testid={`job-location-${job.id}`}>{job.location}</p>
                    <p className="text-sm text-gray-600" data-testid={`job-service-${job.id}`}>{job.serviceType}</p>
                    <p className="text-xs text-gray-500" data-testid={`job-worker-${job.id}`}>
                      Assigned to: {job.workerId ? `Worker ${job.workerId.split('-')[1]}` : 'Unassigned'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  {getStatusBadge(job.status)}
                  <p className="text-xs text-gray-500 mt-1" data-testid={`job-time-${job.id}`}>
                    {getJobTime(job)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
