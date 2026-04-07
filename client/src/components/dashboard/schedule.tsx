import { useQuery } from "@tanstack/react-query";
import { formatDateTime, getInitials, getDepartmentColor } from "@/lib/utils";
import type { Job, Worker } from "@shared/schema";

export default function TodaysSchedule() {
  const { data: todaysJobs = [], isLoading } = useQuery<Job[]>({
    queryKey: ['/api/jobs'],
    select: (jobs) => jobs.filter(job => {
      const jobDate = new Date(job.scheduledDate);
      const today = new Date();
      return jobDate.toDateString() === today.toDateString();
    }),
    refetchInterval: 60000, // Refresh every minute
  });

  const { data: workers = [] } = useQuery<Worker[]>({
    queryKey: ['/api/workers'],
  });

  // Mock schedule for demo
  const mockSchedule = [
    {
      id: "1",
      workerId: "worker-1",
      workerName: "John Smith",
      departmentId: "div-1",
      location: "Baywest Mall",
      serviceType: "Pest Control",
      scheduledDate: new Date(new Date().setHours(8, 0)),
    },
    {
      id: "2", 
      workerId: "worker-2",
      workerName: "Sarah Williams",
      departmentId: "div-2",
      location: "Greenacres Hospital", 
      serviceType: "Hygiene",
      scheduledDate: new Date(new Date().setHours(9, 30)),
    },
    {
      id: "3",
      workerId: "worker-3", 
      workerName: "David Brown",
      departmentId: "div-1",
      location: "Newton Park Library",
      serviceType: "Pest Control",
      scheduledDate: new Date(new Date().setHours(11, 0)),
    },
    {
      id: "4",
      workerId: "worker-4",
      workerName: "Lisa Johnson", 
      departmentId: "div-2",
      location: "Walmer Park",
      serviceType: "Sanitizer Service",
      scheduledDate: new Date(new Date().setHours(14, 0)),
    },
    {
      id: "5",
      workerId: "worker-5",
      workerName: "Mike Johnson",
      departmentId: "div-1", 
      location: "Shoprite Checkers",
      serviceType: "Follow-up",
      scheduledDate: new Date(new Date().setHours(16, 0)),
    },
  ];

  const displaySchedule = todaysJobs.length > 0 ? todaysJobs : mockSchedule;

  const getWorkerName = (workerId: string) => {
    const worker = workers.find(w => w.id === workerId);
    return worker?.name || `Worker ${workerId.split('-')[1]}`;
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="h-6 bg-gray-200 rounded w-40 mb-4 animate-pulse"></div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-r-lg animate-pulse">
              <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
              <div className="flex-1 space-y-1">
                <div className="h-4 bg-gray-200 rounded w-24"></div>
                <div className="h-3 bg-gray-200 rounded w-32"></div>
              </div>
              <div className="h-3 bg-gray-200 rounded w-12"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6" data-testid="todays-schedule">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Today's Schedule</h3>
        <button className="text-sm text-primary-600 font-medium hover:text-primary-700" data-testid="manage-schedule">
          Manage Schedule
        </button>
      </div>
      
      <div className="space-y-3">
        {displaySchedule.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No jobs scheduled for today</p>
          </div>
        ) : (
          displaySchedule.slice(0, 6).map((item) => {
            const getDepartmentColors = (departmentId: string) => {
              switch (departmentId) {
                case 'div-1': return { borderColor: 'border-green-500', bgColor: 'bg-green-50', avatarBg: 'bg-green-600' };
                case 'div-2': return { borderColor: 'border-purple-500', bgColor: 'bg-purple-50', avatarBg: 'bg-purple-600' };
                case 'div-3': return { borderColor: 'border-blue-500', bgColor: 'bg-blue-50', avatarBg: 'bg-blue-600' };
                case 'div-4': return { borderColor: 'border-orange-500', bgColor: 'bg-orange-50', avatarBg: 'bg-orange-600' };
                default: return { borderColor: 'border-gray-500', bgColor: 'bg-gray-50', avatarBg: 'bg-gray-600' };
              }
            };
            const { borderColor, bgColor, avatarBg } = getDepartmentColors(item.departmentId);
            const workerName = 'workerName' in item ? item.workerName : getWorkerName(item.workerId || '');
            
            return (
              <div 
                key={item.id} 
                className={`flex items-center space-x-3 p-3 border-l-4 ${borderColor} ${bgColor} rounded-r-lg`}
                data-testid={`schedule-item-${item.id}`}
              >
                <div className="flex-shrink-0">
                  <div className={`w-8 h-8 ${avatarBg} rounded-full flex items-center justify-center`}>
                    <span className="text-white text-xs font-bold">
                      {getInitials(workerName)}
                    </span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900" data-testid={`schedule-worker-${item.id}`}>
                    {workerName}
                  </p>
                  <p className="text-xs text-gray-600" data-testid={`schedule-location-${item.id}`}>
                    {'location' in item ? item.location : (item as any).title} - {'serviceType' in item ? item.serviceType : 'Service'}
                  </p>
                </div>
                <div className="text-xs text-gray-500" data-testid={`schedule-time-${item.id}`}>
                  {formatDateTime(item.scheduledDate).split(',')[1]?.trim() || ''}
                </div>
              </div>
            );
          })
        )}
      </div>
      
      {displaySchedule.length > 6 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-600">
            <span className="font-medium text-gray-900">{displaySchedule.length - 6} more jobs</span> scheduled for today
          </p>
        </div>
      )}
    </div>
  );
}
