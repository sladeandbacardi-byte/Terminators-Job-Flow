import { useQuery } from "@tanstack/react-query";
import { format, startOfDay, endOfDay } from "date-fns";
import { MapPin, Clock, User, Phone, Mail, FileText, Package, AlertTriangle, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getStatusColor } from "@/lib/utils";
import type { Job, Client, Worker, Department, JobInventoryItem, InventoryItem } from "@shared/schema";
import termLogoPath from "@assets/termlogobig_1755598359265.jpg";

interface JobWithDetails extends Job {
  client: Client;
  worker: Worker;
  inventoryItems: (JobInventoryItem & { inventoryItem: InventoryItem })[];
}

interface DailyDepartmentCardProps {
  departmentId: string;
  date: Date;
  className?: string;
}

export function DailyDepartmentCard({ departmentId, date, className = "" }: DailyDepartmentCardProps) {
  // Fetch department details
  const { data: department } = useQuery<Department>({
    queryKey: [`/api/departments/${departmentId}`],
  });

  // Fetch jobs for the specific department and date
  const { data: jobs = [], isLoading } = useQuery<JobWithDetails[]>({
    queryKey: [`/api/jobs/daily/${departmentId}/${format(date, 'yyyy-MM-dd')}`],
  });

  // Fetch all workers to get details
  const { data: workers = [] } = useQuery<Worker[]>({
    queryKey: ['/api/workers'],
  });

  // Fetch all clients to get details
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
  });

  if (isLoading) {
    return (
      <div className={`bg-white p-8 ${className}`}>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded mb-6"></div>
          <div className="grid grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!department) {
    return (
      <div className={`bg-white p-8 ${className}`}>
        <div className="text-center text-gray-500">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
          <p>Department not found</p>
        </div>
      </div>
    );
  }

  // Enrich jobs with full client and worker details
  const enrichedJobs = jobs.map(job => ({
    ...job,
    client: clients.find(c => c.id === job.clientId) || job.client,
    worker: workers.find(w => w.id === job.workerId) || job.worker,
  }));

  // Sort jobs by scheduled time
  const sortedJobs = enrichedJobs.sort((a, b) => {
    const timeA = a.scheduledTime ? new Date(`1970-01-01T${a.scheduledTime}`).getTime() : 0;
    const timeB = b.scheduledTime ? new Date(`1970-01-01T${b.scheduledTime}`).getTime() : 0;
    return timeA - timeB;
  });

  return (
    <div className={`bg-white ${className}`} data-testid="daily-department-card">
      {/* Compact Header */}
      <div className="bg-gray-50 p-3 print:p-1 border-b">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3 print:gap-2">
            <img 
              src={termLogoPath} 
              alt="The Terminators Logo" 
              className="h-10 w-auto print:h-6"
            />
            <div>
              <h1 className="text-lg print:text-sm font-bold text-gray-900">DAILY SCHEDULE</h1>
              <p className="text-xs print:text-xs text-gray-600">{format(date, 'EEEE, dd MMMM yyyy')}</p>
            </div>
          </div>
          <Badge 
            style={{ backgroundColor: department.colorCode }}
            className="text-white text-sm print:text-xs px-3 py-1 print:px-2 print:py-0.5"
          >
            {department.name}
          </Badge>
        </div>
      </div>

      {/* Compact Jobs Table - Horizontal Layout */}
      <div className="p-3 print:p-1">
        {sortedJobs.length === 0 ? (
          <div className="text-center py-8 print:py-4 text-gray-500">
            <Calendar className="h-12 w-12 print:h-8 print:w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm print:text-xs">No jobs scheduled for this day</p>
          </div>
        ) : (
          <div className="space-y-2 print:space-y-1">
            {/* Table Header */}
            <div className="grid grid-cols-8 gap-2 print:gap-1 p-2 print:p-1 bg-gray-100 rounded text-xs print:text-xs font-semibold border-2" 
                 style={{ borderColor: department.colorCode }}>
              <div className="text-center">#</div>
              <div>Time</div>
              <div className="col-span-2">Job & Client</div>
              <div>Worker</div>
              <div>Location</div>
              <div>Status</div>
              <div>Notes</div>
            </div>

            {/* Job Rows */}
            {sortedJobs.map((job, index) => (
              <div key={job.id} className="grid grid-cols-8 gap-2 print:gap-1 p-2 print:p-1 border rounded hover:bg-gray-50 text-xs print:text-xs print:break-inside-avoid"
                   style={{ borderLeftColor: department.colorCode, borderLeftWidth: '3px' }}>
                {/* Job Number */}
                <div className="text-center font-mono font-bold">
                  {index + 1}
                </div>

                {/* Time */}
                <div className="flex items-center">
                  {job.scheduledTime ? (
                    <span className="font-medium">{job.scheduledTime}</span>
                  ) : (
                    <span className="text-gray-400">TBD</span>
                  )}
                  {job.estimatedDuration && (
                    <span className="text-gray-500 ml-1 print:ml-0.5">({job.estimatedDuration}m)</span>
                  )}
                </div>

                {/* Job & Client */}
                <div className="col-span-2">
                  <div className="font-semibold truncate">{job.title}</div>
                  <div className="text-gray-600 truncate">{job.client?.name || 'Unknown Client'}</div>
                  {job.client?.phone && (
                    <div className="text-gray-500">{job.client.phone}</div>
                  )}
                </div>

                {/* Worker */}
                <div>
                  <div className="font-medium truncate">{job.worker?.name || 'Unassigned'}</div>
                  {job.worker?.phone && (
                    <div className="text-gray-500">{job.worker.phone}</div>
                  )}
                </div>

                {/* Location */}
                <div className="truncate">
                  {job.location || job.client?.address || '-'}
                </div>

                {/* Status */}
                <div className="flex flex-col gap-1 print:gap-0.5">
                  <Badge
                    variant="secondary"
                    className={`text-xs print:text-xs w-fit ${getStatusColor(job.status)}`}
                  >
                    {job.status.replace('_', ' ')}
                  </Badge>
                  {job.priority && job.priority !== 'low' && (
                    <Badge 
                      variant={job.priority === 'urgent' ? 'destructive' : 'secondary'}
                      className="text-xs print:text-xs w-fit"
                    >
                      {job.priority}
                    </Badge>
                  )}
                </div>

                {/* Notes */}
                <div className="text-gray-600 text-xs print:text-xs">
                  {job.description && (
                    <div className="truncate">{job.description}</div>
                  )}
                  {job.inventoryItems && job.inventoryItems.length > 0 && (
                    <div className="flex items-center gap-1 print:gap-0.5 text-gray-500">
                      <Package className="h-3 w-3" />
                      <span>{job.inventoryItems.length} items</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Compact Summary Footer */}
        {sortedJobs.length > 0 && (
          <div className="mt-4 print:mt-2 pt-3 print:pt-1 border-t border-gray-200">
            <div className="flex justify-between items-center text-xs print:text-xs">
              <div className="flex gap-6 print:gap-3">
                <span><strong>Total:</strong> {sortedJobs.length} jobs</span>
                <span className="text-green-600"><strong>Completed:</strong> {sortedJobs.filter(j => j.status === 'completed').length}</span>
                <span className="text-yellow-600"><strong>In Progress:</strong> {sortedJobs.filter(j => j.status === 'in_progress').length}</span>
                <span className="text-gray-600"><strong>Scheduled:</strong> {sortedJobs.filter(j => j.status === 'scheduled').length}</span>
              </div>
              <div className="text-gray-500">
                Generated: {format(new Date(), 'dd/MM/yyyy HH:mm')}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function PrintableDailyDepartmentCard({ departmentId, date }: { departmentId: string; date: Date }) {
  return (
    <div className="print:block">
      <style>{`
        @media print {
          body { margin: 0; font-size: 12px; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:block { display: block !important; }
          @page { 
            margin: 0.3in; 
            size: A4 landscape;
          }
          /* Ensure table rows don't break across pages */
          .print\\:break-inside-avoid { break-inside: avoid; }
          /* Adjust font sizes for print */
          .print\\:text-xs { font-size: 0.65rem !important; }
          .print\\:text-sm { font-size: 0.75rem !important; }
          .print\\:p-1 { padding: 0.15rem !important; }
          .print\\:p-2 { padding: 0.25rem !important; }
          .print\\:gap-1 { gap: 0.15rem !important; }
          .print\\:space-y-1 > * + * { margin-top: 0.15rem !important; }
        }
      `}</style>
      <DailyDepartmentCard 
        departmentId={departmentId} 
        date={date} 
        className="print:text-black print:bg-white print:text-xs" 
      />
    </div>
  );
}