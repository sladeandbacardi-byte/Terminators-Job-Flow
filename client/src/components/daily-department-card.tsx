import { useQuery } from "@tanstack/react-query";
import { format, startOfDay, endOfDay } from "date-fns";
import { MapPin, Clock, User, Phone, Mail, FileText, Package, AlertTriangle, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getStatusColor } from "@/lib/utils";
import type { Job, Client, Worker, Division, JobInventoryItem, InventoryItem } from "@shared/schema";
import termLogoPath from "@assets/termlogobig_1755598359265.jpg";

interface JobWithDetails extends Job {
  client: Client;
  worker: Worker;
  inventoryItems: (JobInventoryItem & { inventoryItem: InventoryItem })[];
}

interface DailyDepartmentCardProps {
  divisionId: string;
  date: Date;
  className?: string;
}

export function DailyDepartmentCard({ divisionId, date, className = "" }: DailyDepartmentCardProps) {
  // Fetch division details
  const { data: division } = useQuery<Division>({
    queryKey: [`/api/divisions/${divisionId}`],
  });

  // Fetch jobs for the specific division and date
  const { data: jobs = [], isLoading } = useQuery<JobWithDetails[]>({
    queryKey: [`/api/jobs/daily/${divisionId}/${format(date, 'yyyy-MM-dd')}`],
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

  if (!division) {
    return (
      <div className={`bg-white p-8 ${className}`}>
        <div className="text-center text-gray-500">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
          <p>Division not found</p>
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
      {/* Header */}
      <div className="bg-gray-50 p-6 border-b">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-4">
            <img 
              src={termLogoPath} 
              alt="The Terminators Logo" 
              className="h-16 w-auto"
            />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">DAILY DEPARTMENT SCHEDULE</h1>
              <p className="text-gray-600">Field Service Management</p>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-5 w-5 text-gray-600" />
              <p className="text-lg font-semibold">{format(date, 'EEEE, dd MMMM yyyy')}</p>
            </div>
            <Badge 
              style={{ backgroundColor: division.colorCode }}
              className="text-white text-sm px-3 py-1"
            >
              {division.name}
            </Badge>
          </div>
        </div>
      </div>

      {/* Jobs Grid - Landscape Layout */}
      <div className="p-6">
        {sortedJobs.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Calendar className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">No jobs scheduled for this day</p>
            <p className="text-sm">Check other days or create new jobs</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sortedJobs.map((job, index) => (
              <Card key={job.id} className="border-l-4 hover:shadow-md transition-shadow" 
                    style={{ borderLeftColor: division.colorCode }}>
                <CardContent className="p-4">
                  {/* Job Header */}
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <div className="bg-gray-100 text-gray-700 text-xs font-mono px-2 py-1 rounded">
                        #{index + 1}
                      </div>
                      <Badge 
                        variant={getStatusColor(job.status) === 'green' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {job.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="text-right">
                      {job.scheduledTime && (
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <Clock className="h-3 w-3" />
                          <span>{job.scheduledTime}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Job Title */}
                  <h3 className="font-semibold text-sm mb-2 line-clamp-2">{job.title}</h3>

                  {/* Client Info */}
                  <div className="space-y-1 mb-3">
                    <div className="flex items-center gap-1 text-xs text-gray-600">
                      <User className="h-3 w-3" />
                      <span className="truncate">{job.client?.name || 'Unknown Client'}</span>
                    </div>
                    {job.location && (
                      <div className="flex items-center gap-1 text-xs text-gray-600">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">{job.location}</span>
                      </div>
                    )}
                    {job.client?.phone && (
                      <div className="flex items-center gap-1 text-xs text-gray-600">
                        <Phone className="h-3 w-3" />
                        <span>{job.client.phone}</span>
                      </div>
                    )}
                  </div>

                  {/* Worker Assignment */}
                  {job.worker && (
                    <div className="bg-blue-50 p-2 rounded text-xs mb-3">
                      <div className="font-medium text-blue-900">Assigned to:</div>
                      <div className="text-blue-700">{job.worker.name}</div>
                      {job.worker.phone && (
                        <div className="text-blue-600">{job.worker.phone}</div>
                      )}
                    </div>
                  )}

                  {/* Service Type & Duration */}
                  <div className="flex justify-between text-xs text-gray-500 mb-2">
                    <span className="truncate">{job.serviceType}</span>
                    {job.estimatedDuration && (
                      <span>{job.estimatedDuration}min</span>
                    )}
                  </div>

                  {/* Priority */}
                  {job.priority && job.priority !== 'low' && (
                    <Badge 
                      variant={job.priority === 'urgent' ? 'destructive' : 'secondary'}
                      className="text-xs"
                    >
                      {job.priority} priority
                    </Badge>
                  )}

                  {/* Description Preview */}
                  {job.description && (
                    <div className="mt-2 text-xs text-gray-600 line-clamp-2">
                      {job.description}
                    </div>
                  )}

                  {/* Inventory Items Count */}
                  {job.inventoryItems && job.inventoryItems.length > 0 && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                      <Package className="h-3 w-3" />
                      <span>{job.inventoryItems.length} items required</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Summary Footer */}
        {sortedJobs.length > 0 && (
          <div className="mt-8 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="bg-blue-50 p-3 rounded">
                <div className="text-2xl font-bold text-blue-600">{sortedJobs.length}</div>
                <div className="text-xs text-blue-700">Total Jobs</div>
              </div>
              <div className="bg-green-50 p-3 rounded">
                <div className="text-2xl font-bold text-green-600">
                  {sortedJobs.filter(j => j.status === 'completed').length}
                </div>
                <div className="text-xs text-green-700">Completed</div>
              </div>
              <div className="bg-yellow-50 p-3 rounded">
                <div className="text-2xl font-bold text-yellow-600">
                  {sortedJobs.filter(j => j.status === 'in_progress').length}
                </div>
                <div className="text-xs text-yellow-700">In Progress</div>
              </div>
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-2xl font-bold text-gray-600">
                  {sortedJobs.filter(j => j.status === 'scheduled').length}
                </div>
                <div className="text-xs text-gray-700">Scheduled</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Print Footer */}
      <div className="mt-8 pt-4 border-t border-gray-200 text-center text-sm text-gray-500 px-6 pb-6">
        <p>The Terminators - {division.name} Department | {format(date, 'dd/MM/yyyy')} | Generated on {format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
      </div>
    </div>
  );
}

export function PrintableDailyDepartmentCard({ divisionId, date }: { divisionId: string; date: Date }) {
  return (
    <div className="print:block">
      <style>{`
        @media print {
          body { margin: 0; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:block { display: block !important; }
          @page { 
            margin: 0.5in; 
            size: A4 landscape;
          }
        }
      `}</style>
      <DailyDepartmentCard 
        divisionId={divisionId} 
        date={date} 
        className="print:text-black print:bg-white" 
      />
    </div>
  );
}