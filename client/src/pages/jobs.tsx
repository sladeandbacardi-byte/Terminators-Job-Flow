import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import MobileNavigation from "@/components/layout/mobile-nav";
import JobForm from "@/components/forms/job-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Calendar, Search, Plus, Filter, Download, Printer, Edit } from "lucide-react";
import { formatDateTime, getStatusColor } from "@/lib/utils";
import { ExportButton } from "@/components/export-button";
import { exportJobs } from "@/lib/data-export";
import type { Job } from "@shared/schema";
import { Link } from "wouter";

export default function Jobs() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isJobFormOpen, setIsJobFormOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const { data: jobs = [], isLoading } = useQuery<Job[]>({
    queryKey: ['/api/jobs'],
  });

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = searchTerm === "" || 
      job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.location?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || job.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusBadgeVariant = (status: string) => {
    const color = getStatusColor(status);
    return color === 'green' ? 'default' : 'secondary';
  };

  return (
    <div className="min-h-screen flex bg-gray-50" data-testid="jobs-page">
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
          title="Job Scheduling" 
          onMobileMenuToggle={() => setIsMobileMenuOpen(true)}
        />
        
        <main className="flex-1 overflow-y-auto p-6 pb-20 lg:pb-6">
          {/* Header Actions */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search jobs by title or location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="search-jobs"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                data-testid="filter-status"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <ExportButton 
                onExportCSV={() => exportJobs(jobs)}
                entityName="Jobs"
                variant="outline"
                size="sm"
              />
              <Dialog open={isJobFormOpen} onOpenChange={setIsJobFormOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-create-job">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Job
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <JobForm
                    job={editingJob}
                    onSuccess={() => {
                      setIsJobFormOpen(false);
                      setEditingJob(null);
                    }}
                    onCancel={() => {
                      setIsJobFormOpen(false);
                      setEditingJob(null);
                    }}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Jobs List */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">All Jobs</h3>
              <p className="text-sm text-gray-600 mt-1">
                {filteredJobs.length} job{filteredJobs.length !== 1 ? 's' : ''} found
              </p>
            </div>
            
            {isLoading ? (
              <div className="p-6">
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="border border-gray-200 rounded-lg p-4 animate-pulse">
                      <div className="flex justify-between items-start mb-2">
                        <div className="h-5 bg-gray-200 rounded w-1/3"></div>
                        <div className="h-5 bg-gray-200 rounded w-20"></div>
                      </div>
                      <div className="space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                        <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                        <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="p-12 text-center">
                <Calendar className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No jobs found</h3>
                <p className="text-gray-600">
                  {searchTerm || statusFilter !== "all" 
                    ? "Try adjusting your search or filter criteria."
                    : "Get started by creating your first job."
                  }
                </p>
                {(!searchTerm && statusFilter === "all") && (
                  <Button className="mt-4" data-testid="button-create-first-job">
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Job
                  </Button>
                )}
              </div>
            ) : (
              <div className="p-6">
                <div className="space-y-4">
                  {filteredJobs.map((job) => (
                    <div key={job.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors" data-testid={`job-item-${job.id}`}>
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="font-semibold text-gray-900" data-testid={`job-title-${job.id}`}>
                          {job.title}
                        </h4>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={getStatusBadgeVariant(job.status)}
                            className={`${
                              getStatusColor(job.status) === 'green' ? 'bg-green-100 text-green-800' :
                              getStatusColor(job.status) === 'orange' ? 'bg-orange-100 text-orange-800' :
                              getStatusColor(job.status) === 'red' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}
                            data-testid={`job-status-${job.id}`}
                          >
                            {job.status.replace('_', ' ')}
                          </Badge>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingJob(job);
                                setIsJobFormOpen(true);
                              }}
                              data-testid={`button-edit-job-${job.id}`}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Link href={`/jobs/${job.id}/card`}>
                              <Button
                                size="sm"
                                variant="outline"
                                data-testid={`button-print-job-${job.id}`}
                              >
                                <Printer className="h-3 w-3" />
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-sm text-gray-600">
                        <div>
                          <span className="font-medium">Service:</span> {job.serviceType}
                        </div>
                        <div>
                          <span className="font-medium">Location:</span> {job.location || 'Not specified'}
                        </div>
                        <div>
                          <span className="font-medium">Scheduled:</span> {formatDateTime(job.scheduledDate)}
                        </div>
                        <div>
                          <span className="font-medium">Worker:</span> {job.workerId ? `Worker ${job.workerId.split('-')[1]}` : 'Unassigned'}
                        </div>
                      </div>
                      
                      {job.description && (
                        <p className="text-sm text-gray-600 mt-2" data-testid={`job-description-${job.id}`}>
                          {job.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
      
      <MobileNavigation />
    </div>
  );
}
