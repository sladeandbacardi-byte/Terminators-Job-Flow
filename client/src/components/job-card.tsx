import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { MapPin, Clock, User, Phone, Mail, FileText, Package, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getStatusColor, formatDateTime } from "@/lib/utils";
import { formatClientAddress, type Job, type Client, type Worker, type Department, type JobInventoryItem, type InventoryItem } from "@shared/schema";
import termLogoPath from "@assets/termlogobig_1755598359265.jpg";

interface JobCardData extends Job {
  client: Client;
  worker: Worker;
  department: Department;
  inventoryItems: (JobInventoryItem & { inventoryItem: InventoryItem })[];
}

interface JobCardProps {
  jobId: string;
  className?: string;
}

export function JobCard({ jobId, className = "" }: JobCardProps) {
  const { data: jobData, isLoading } = useQuery<JobCardData>({
    queryKey: ['/api/jobs', jobId, 'card'],
  });

  if (isLoading) {
    return (
      <div className={`bg-white p-8 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4"></div>
          <div className="h-4 bg-gray-200 rounded mb-2"></div>
          <div className="h-4 bg-gray-200 rounded mb-2"></div>
          <div className="h-4 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!jobData) {
    return (
      <div className={`bg-white p-8 ${className}`}>
        <div className="text-center text-gray-500">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
          <p>Job not found</p>
        </div>
      </div>
    );
  }

  const priorityColor = jobData.priority === 'urgent' ? 'red' : 
                       jobData.priority === 'high' ? 'orange' : 
                       jobData.priority === 'medium' ? 'blue' : 'gray';

  return (
    <div className={`bg-white p-8 max-w-4xl mx-auto print:shadow-none ${className}`} data-testid="job-card">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-4">
          <img 
            src={termLogoPath} 
            alt="The Terminators Logo" 
            className="h-16 w-auto"
          />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">JOB CARD</h1>
            <p className="text-gray-600">Field Service Management</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-600">Job ID</p>
          <p className="text-lg font-mono font-semibold">{jobData.id}</p>
          <p className="text-xs text-gray-500 mt-1">
            Created: {format(new Date(jobData.createdAt), 'dd/MM/yyyy')}
          </p>
        </div>
      </div>

      <hr className="mb-6 border-gray-200" />

      {/* Job Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Job Information</h2>
            <div className="space-y-2">
              <div>
                <p className="text-sm font-medium text-gray-700">Title</p>
                <p className="text-base">{jobData.title}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Service Type</p>
                <p className="text-base">{jobData.serviceType}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Department</p>
                <Badge 
                  style={{ backgroundColor: jobData.department.colorCode }}
                  className="text-white"
                >
                  {jobData.department.name}
                </Badge>
              </div>
              <div className="flex gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-700">Status</p>
                  <Badge
                    variant="secondary"
                    className={`capitalize ${getStatusColor(jobData.status)}`}
                  >
                    {jobData.status.replace('_', ' ')}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Priority</p>
                  <Badge 
                    variant={priorityColor === 'red' ? 'destructive' : 'secondary'}
                    className="capitalize"
                  >
                    {jobData.priority}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Schedule & Location</h2>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-500" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Scheduled Date & Time</p>
                  <p className="text-base">
                    {format(new Date(jobData.scheduledDate), 'EEEE, dd MMMM yyyy')}
                    {jobData.scheduledTime && ` at ${jobData.scheduledTime}`}
                  </p>
                </div>
              </div>
              {jobData.estimatedDuration && (
                <div>
                  <p className="text-sm font-medium text-gray-700">Estimated Duration</p>
                  <p className="text-base">{jobData.estimatedDuration} minutes</p>
                </div>
              )}
              {jobData.location && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-gray-500 mt-1" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">Location</p>
                    <p className="text-base">{jobData.location}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <hr className="mb-6 border-gray-200" />

      {/* Client Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Client Information</h2>
          <div className="space-y-2">
            <div>
              <p className="text-sm font-medium text-gray-700">Company Name</p>
              <p className="text-base font-medium">{jobData.client.name}</p>
            </div>
            {jobData.client.contactPerson && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-500" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Contact Person</p>
                  <p className="text-base">{jobData.client.contactPerson}</p>
                </div>
              </div>
            )}
            {jobData.client.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-gray-500" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Phone</p>
                  <p className="text-base">{jobData.client.phone}</p>
                </div>
              </div>
            )}
            {jobData.client.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-gray-500" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Email</p>
                  <p className="text-base">{jobData.client.email}</p>
                </div>
              </div>
            )}
            {formatClientAddress(jobData.client) && (
              <div>
                <p className="text-sm font-medium text-gray-700">Address</p>
                <p className="text-base whitespace-pre-line">{formatClientAddress(jobData.client)}</p>
                {jobData.client.googleMapsLink && (
                  <a
                    href={jobData.client.googleMapsLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-green-700 hover:underline"
                  >
                    Open in Google Maps
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Assigned Worker</h2>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-gray-500" />
              <div>
                <p className="text-sm font-medium text-gray-700">Name</p>
                <p className="text-base font-medium">{jobData.worker.name}</p>
              </div>
            </div>
            {jobData.worker.employeeId && (
              <div>
                <p className="text-sm font-medium text-gray-700">Employee ID</p>
                <p className="text-base font-mono">{jobData.worker.employeeId}</p>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-gray-500" />
              <div>
                <p className="text-sm font-medium text-gray-700">Phone</p>
                <p className="text-base">{jobData.worker.phone}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-gray-500" />
              <div>
                <p className="text-sm font-medium text-gray-700">Email</p>
                <p className="text-base">{jobData.worker.email}</p>
              </div>
            </div>
            {jobData.worker.role && (
              <div>
                <p className="text-sm font-medium text-gray-700">Role</p>
                <p className="text-base capitalize">{jobData.worker.role}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Job Description */}
      {jobData.description && (
        <>
          <hr className="mb-6 border-gray-200" />
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Job Description
            </h2>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-base leading-relaxed whitespace-pre-wrap">{jobData.description}</p>
            </div>
          </div>
        </>
      )}

      {/* Required Items */}
      {jobData.inventoryItems && jobData.inventoryItems.length > 0 && (
        <>
          <hr className="mb-6 border-gray-200" />
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Package className="h-5 w-5" />
              Required Items
            </h2>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2">Item</th>
                      <th className="text-left py-2">SKU</th>
                      <th className="text-center py-2">Quantity</th>
                      <th className="text-left py-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobData.inventoryItems.map((item) => (
                      <tr key={item.id} className="border-b border-gray-100">
                        <td className="py-2 font-medium">{item.inventoryItem.name}</td>
                        <td className="py-2 font-mono text-xs">{item.inventoryItem.sku}</td>
                        <td className="py-2 text-center">{item.quantity}</td>
                        <td className="py-2 text-gray-600">{item.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Notes */}
      {jobData.notes && (
        <>
          <hr className="mb-6 border-gray-200" />
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Additional Notes</h2>
            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
              <p className="text-base leading-relaxed whitespace-pre-wrap">{jobData.notes}</p>
            </div>
          </div>
        </>
      )}

      {/* Completion Section */}
      <hr className="mb-6 border-gray-200" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Job Completion</h2>
          <div className="space-y-4">
            <div className="border border-gray-300 p-3 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-1">Start Time</p>
              <p className="text-base">_________________</p>
            </div>
            <div className="border border-gray-300 p-3 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-1">End Time</p>
              <p className="text-base">_________________</p>
            </div>
            <div className="border border-gray-300 p-3 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-1">Worker Signature</p>
              <div className="h-12 border-b border-gray-300 mt-2"></div>
            </div>
          </div>
        </div>
        
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Client Acknowledgment</h2>
          <div className="space-y-4">
            <div className="border border-gray-300 p-3 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-1">Client Name</p>
              <p className="text-base">_________________</p>
            </div>
            <div className="border border-gray-300 p-3 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-1">Date</p>
              <p className="text-base">_________________</p>
            </div>
            <div className="border border-gray-300 p-3 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-1">Client Signature</p>
              <div className="h-12 border-b border-gray-300 mt-2"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Completion Notes Section */}
      <div className="mt-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Work Completed / Notes</h2>
        <div className="border border-gray-300 p-4 rounded-lg min-h-[120px]">
          <div className="space-y-4">
            <div className="border-b border-gray-200 pb-2">
              <span className="text-sm text-gray-600">Use this space to describe work completed, any issues encountered, and recommendations:</span>
            </div>
            <div className="space-y-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="border-b border-gray-200 h-5"></div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 pt-4 border-t border-gray-200 text-center text-sm text-gray-500">
        <p>The Terminators Field Service Management | Generated on {format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
      </div>
    </div>
  );
}

export function PrintableJobCard({ jobId }: { jobId: string }) {
  return (
    <div className="print:block">
      <style>{`
        @media print {
          body { margin: 0; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:block { display: block !important; }
          @page { 
            margin: 0.5in; 
            size: A4;
          }
        }
      `}</style>
      <JobCard jobId={jobId} className="print:text-black print:bg-white" />
    </div>
  );
}