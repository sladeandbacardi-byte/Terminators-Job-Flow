import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import MobileNavigation from "@/components/layout/mobile-nav";
import JobForm from "@/components/forms/job-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Calendar, Search, Plus, Printer, Edit, X, CheckCircle2, Receipt, FileSignature } from "lucide-react";
import { formatDateTime, getStatusColor } from "@/lib/utils";
import { ExportButton } from "@/components/export-button";
import { exportJobs } from "@/lib/data-export";
import type { Job, QuoteSubmission, Worker, Client, Department, Team, TeamMember } from "@shared/schema";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { getDashboardRole } from "@/lib/dashboardRole";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Jobs() {
  const { user } = useAuth();
  const role = getDashboardRole({ departmentId: user?.departmentId, role: user?.role });
  const isTechnician = role === "service";
  // Only Admin/Coordinator/Accounts can move jobs into the invoicing pipeline (not manager)
  const canInvoice = role === "admin" || role === "coordinator" || role === "accounts";
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const markReady = useMutation({
    mutationFn: async (jobId: string) => {
      const r = await apiRequest("POST", `/api/jobs/${jobId}/mark-ready-to-invoice`);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      toast({ title: "Marked ready to invoice", description: "Finance will see this job in the invoicing queue." });
    },
    onError: () => toast({ title: "Could not update job", variant: "destructive" }),
  });

  const createInvoiceFromJob = useMutation({
    mutationFn: async (jobId: string) => {
      const r = await apiRequest("POST", `/api/jobs/${jobId}/create-invoice`);
      return r.json();
    },
    onSuccess: (inv: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      toast({
        title: "Invoice created",
        description: `${inv?.invoiceNumber ?? "Invoice"} created and linked. View it on the Invoices page.`,
      });
    },
    onError: () => toast({ title: "Could not create invoice", variant: "destructive" }),
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [addressFilter, setAddressFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [teamFilter, setTeamFilter] = useState("all");
  const [workerFilter, setWorkerFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [serviceTypeFilter, setServiceTypeFilter] = useState("all");
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [isJobFormOpen, setIsJobFormOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const { data: jobs = [], isLoading } = useQuery<Job[]>({ queryKey: ['/api/jobs'] });
  const { data: workers = [] } = useQuery<Worker[]>({ queryKey: ['/api/workers'] });
  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ['/api/clients'] });
  const { data: departments = [] } = useQuery<Department[]>({ queryKey: ['/api/departments'] });
  const { data: teams = [] } = useQuery<Team[]>({ queryKey: ['/api/teams'] });
  const { data: teamMembers = [] } = useQuery<TeamMember[]>({ queryKey: ['/api/team-members'] });
  const { data: quoteSubmissions = [] } = useQuery<QuoteSubmission[]>({ queryKey: ['/api/quote-submissions'] });

  const quoteMap = useMemo(() => new Map(quoteSubmissions.map(q => [q.id, q])), [quoteSubmissions]);
  const workerMap = useMemo(() => new Map(workers.map(w => [w.id, w])), [workers]);
  const clientMap = useMemo(() => new Map(clients.map(c => [c.id, c])), [clients]);
  const departmentMap = useMemo(() => new Map(departments.map(d => [d.id, d])), [departments]);

  // worker -> set of team ids (workers can be in multiple teams)
  const workerTeamsMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    teamMembers.forEach(tm => {
      const set = map.get(tm.workerId) ?? new Set<string>();
      set.add(tm.teamId);
      map.set(tm.workerId, set);
    });
    return map;
  }, [teamMembers]);

  // Resolve the logged-in technician's worker record
  const myWorker = useMemo(() => {
    if (!isTechnician) return null;
    const byEmail = workers.find(w => user?.email && w.email === user.email);
    if (byEmail) return byEmail;
    const inDept = workers
      .filter(w => w.departmentId === user?.departmentId && w.isActive !== false)
      .map(w => ({ w, count: jobs.filter(j => j.workerId === w.id).length }))
      .sort((a, b) => b.count - a.count);
    return inDept[0]?.w ?? null;
  }, [isTechnician, workers, jobs, user]);

  // Teams filtered by selected department
  const teamOptions = useMemo(() => {
    if (departmentFilter === "all") return teams;
    return teams.filter(t => t.departmentId === departmentFilter);
  }, [teams, departmentFilter]);

  // Workers filtered by selected department & team
  const workerOptions = useMemo(() => {
    return workers.filter(w => {
      if (departmentFilter !== "all" && w.departmentId !== departmentFilter) return false;
      if (teamFilter !== "all" && !(workerTeamsMap.get(w.id)?.has(teamFilter))) return false;
      return true;
    });
  }, [workers, departmentFilter, teamFilter, workerTeamsMap]);

  // Derive unique service types from jobs
  const serviceTypeOptions = useMemo(() => {
    const set = new Set(jobs.map(j => j.serviceType).filter(Boolean));
    return Array.from(set).sort();
  }, [jobs]);

  const filteredJobs = useMemo(() => jobs.filter(job => {
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch = term === "" ||
      job.title.toLowerCase().includes(term) ||
      job.location?.toLowerCase().includes(term) ||
      job.jobNumber?.toLowerCase().includes(term) ||
      job.serviceType?.toLowerCase().includes(term) ||
      job.insects?.toLowerCase().includes(term) ||
      job.contractNo?.toLowerCase().includes(term) ||
      (job as any).invoiceRef?.toLowerCase().includes(term) ||
      (job as any).otherPestType?.toLowerCase().includes(term) ||
      clientMap.get(job.clientId)?.name?.toLowerCase().includes(term);

    const addr = addressFilter.toLowerCase().trim();
    const matchesAddress = addr === "" ||
      job.location?.toLowerCase().includes(addr) ||
      (() => {
        const c = clientMap.get(job.clientId);
        if (!c) return false;
        return [c.streetNumber, c.streetName, c.suburb, c.city, c.province, c.postalCode, c.address]
          .filter(Boolean).join(" ").toLowerCase().includes(addr);
      })();

    const matchesStatus = statusFilter === "all" || job.status === statusFilter;
    const matchesDepartment = departmentFilter === "all" || job.departmentId === departmentFilter;
    const matchesTeam = teamFilter === "all" ||
      (job.workerId ? !!workerTeamsMap.get(job.workerId)?.has(teamFilter) : false);
    const matchesWorkerFilter = workerFilter === "all" ||
      (workerFilter === "unassigned" ? !job.workerId : job.workerId === workerFilter);
    const matchesClient = clientFilter === "all" || job.clientId === clientFilter;
    const matchesPriority = priorityFilter === "all" || job.priority === priorityFilter;
    const matchesServiceType = serviceTypeFilter === "all" || job.serviceType === serviceTypeFilter;
    const matchesInvoiceStatus = invoiceStatusFilter === "all" ||
      (invoiceStatusFilter === "not_invoiced" ? (!job.invoiceStatus || job.invoiceStatus === "not_invoiced") : job.invoiceStatus === invoiceStatusFilter);

    let matchesDateFrom = true;
    let matchesDateTo = true;
    if (dateFrom || dateTo) {
      const jobDate = job.scheduledDate ? new Date(job.scheduledDate) : null;
      if (jobDate) {
        if (dateFrom) matchesDateFrom = jobDate >= new Date(dateFrom);
        if (dateTo) {
          const end = new Date(dateTo);
          end.setHours(23, 59, 59, 999);
          matchesDateTo = jobDate <= end;
        }
      } else {
        matchesDateFrom = false;
      }
    }

    // Technicians only see their own assigned jobs
    const matchesWorker = !isTechnician || !myWorker || job.workerId === myWorker.id;

    return matchesSearch && matchesAddress && matchesStatus && matchesDepartment &&
      matchesTeam && matchesWorkerFilter && matchesClient && matchesPriority &&
      matchesServiceType && matchesInvoiceStatus && matchesDateFrom && matchesDateTo && matchesWorker;
  }), [
    jobs, searchTerm, addressFilter, statusFilter, departmentFilter, teamFilter,
    workerFilter, clientFilter, priorityFilter, serviceTypeFilter, invoiceStatusFilter,
    dateFrom, dateTo, clientMap, workerTeamsMap, isTechnician, myWorker,
  ]);

  const activeFilterCount = [
    addressFilter, statusFilter !== "all", departmentFilter !== "all",
    teamFilter !== "all", workerFilter !== "all", clientFilter !== "all",
    priorityFilter !== "all", serviceTypeFilter !== "all", invoiceStatusFilter !== "all",
    dateFrom, dateTo,
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setSearchTerm("");
    setAddressFilter("");
    setStatusFilter("all");
    setDepartmentFilter("all");
    setTeamFilter("all");
    setWorkerFilter("all");
    setClientFilter("all");
    setPriorityFilter("all");
    setServiceTypeFilter("all");
    setInvoiceStatusFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  // Reset team/worker if department changes and current team/worker no longer matches
  const onDepartmentChange = (val: string) => {
    setDepartmentFilter(val);
    if (val !== "all") {
      if (teamFilter !== "all" && !teams.find(t => t.id === teamFilter && t.departmentId === val)) {
        setTeamFilter("all");
      }
      if (workerFilter !== "all" && workerFilter !== "unassigned") {
        const w = workerMap.get(workerFilter);
        if (!w || w.departmentId !== val) setWorkerFilter("all");
      }
    }
  };

  const onTeamChange = (val: string) => {
    setTeamFilter(val);
    if (val !== "all" && workerFilter !== "all" && workerFilter !== "unassigned") {
      if (!workerTeamsMap.get(workerFilter)?.has(val)) setWorkerFilter("all");
    }
  };

  return (
    <div className="min-h-screen flex bg-gray-50" data-testid="jobs-page">
      <Sidebar />

      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="relative bg-white w-64 shadow-lg"><Sidebar /></div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title={isTechnician ? "My Jobs" : "Jobs"}
          onMobileMenuToggle={() => setIsMobileMenuOpen(true)}
        />

        <main className="flex-1 overflow-y-auto p-6 pb-20 lg:pb-6">
          {isTechnician && (
            <p className="text-sm text-muted-foreground mb-4">
              Your daily work sheet. Start, continue and complete assigned jobs.
            </p>
          )}

          {/* Top bar: search + create */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by job title, number, client or location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="search-jobs"
              />
            </div>
            <div className="flex gap-2">
              {!isTechnician && (
                <ExportButton
                  onExportCSV={() => exportJobs(filteredJobs)}
                  entityName="Jobs"
                  variant="outline"
                  size="sm"
                />
              )}
              {!isTechnician && (
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
                      onSuccess={() => { setIsJobFormOpen(false); setEditingJob(null); }}
                      onCancel={() => { setIsJobFormOpen(false); setEditingJob(null); }}
                    />
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>

          {/* Filters panel */}
          {!isTechnician && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-medium text-gray-700">
                  Filters {activeFilterCount > 0 && (
                    <span className="ml-2 text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full">
                      {activeFilterCount} active
                    </span>
                  )}
                </div>
                {activeFilterCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearAllFilters} data-testid="button-clear-filters">
                    <X className="h-3 w-3 mr-1" /> Clear all
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Address */}
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Address</label>
                  <Input
                    placeholder="Street, suburb, city..."
                    value={addressFilter}
                    onChange={(e) => setAddressFilter(e.target.value)}
                    data-testid="filter-address"
                  />
                </div>

                {/* Department */}
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Department</label>
                  <Select value={departmentFilter} onValueChange={onDepartmentChange}>
                    <SelectTrigger data-testid="filter-department"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      {departments.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Team */}
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Team</label>
                  <Select value={teamFilter} onValueChange={onTeamChange}>
                    <SelectTrigger data-testid="filter-team"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Teams</SelectItem>
                      {teamOptions.map(t => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}{departmentFilter === "all" && departmentMap.get(t.departmentId) ? ` (${departmentMap.get(t.departmentId)!.name})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Worker */}
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Worker</label>
                  <Select value={workerFilter} onValueChange={setWorkerFilter}>
                    <SelectTrigger data-testid="filter-worker"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Workers</SelectItem>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {workerOptions.map(w => (
                        <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Client */}
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Client</label>
                  <Select value={clientFilter} onValueChange={setClientFilter}>
                    <SelectTrigger data-testid="filter-client"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Clients</SelectItem>
                      {clients.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Status */}
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Status</label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger data-testid="filter-status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Priority */}
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Priority</label>
                  <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                    <SelectTrigger data-testid="filter-priority"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Priorities</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Service type */}
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Service Type</label>
                  <Select value={serviceTypeFilter} onValueChange={setServiceTypeFilter}>
                    <SelectTrigger data-testid="filter-service-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Service Types</SelectItem>
                      {serviceTypeOptions.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Invoice status */}
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Invoice Status</label>
                  <Select value={invoiceStatusFilter} onValueChange={setInvoiceStatusFilter}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Invoice Status</SelectItem>
                      <SelectItem value="not_invoiced">Not Ready</SelectItem>
                      <SelectItem value="ready_to_invoice">Ready to Invoice</SelectItem>
                      <SelectItem value="invoiced">Invoiced</SelectItem>
                      <SelectItem value="do_not_invoice">Do Not Invoice</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Date range */}
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Scheduled From</label>
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} data-testid="filter-date-from" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Scheduled To</label>
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} data-testid="filter-date-to" />
                </div>
              </div>
            </div>
          )}

          {/* Jobs List */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">{isTechnician ? "My Assigned Jobs" : "All Jobs"}</h3>
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
                  {activeFilterCount > 0 || searchTerm
                    ? "Try adjusting your search or filter criteria."
                    : "Get started by creating your first job."}
                </p>
                {activeFilterCount === 0 && !searchTerm && !isTechnician && (
                  <Button className="mt-4" onClick={() => setIsJobFormOpen(true)} data-testid="button-create-first-job">
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Job
                  </Button>
                )}
              </div>
            ) : (
              <div className="p-6">
                <div className="space-y-4">
                  {filteredJobs.map((job) => {
                    const worker = job.workerId ? workerMap.get(job.workerId) : null;
                    const client = clientMap.get(job.clientId);
                    const dept = departmentMap.get(job.departmentId);
                    return (
                      <div key={job.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors" data-testid={`job-item-${job.id}`}>
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            {(job.jobNumber || (job.linkedQuoteId && quoteMap.get(job.linkedQuoteId)?.quoteNumber)) && (
                              <div className="flex items-center gap-1.5 mb-1">
                                {job.jobNumber && (
                                  <span className="text-xs font-mono font-medium text-blue-700 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded">
                                    {job.jobNumber}
                                  </span>
                                )}
                                {job.linkedQuoteId && quoteMap.get(job.linkedQuoteId)?.quoteNumber && (
                                  <span className="text-xs font-mono text-purple-700 bg-purple-50 border border-purple-100 px-1.5 py-0.5 rounded">
                                    Linked Quote: {quoteMap.get(job.linkedQuoteId)!.quoteNumber}
                                  </span>
                                )}
                                {dept && (
                                  <span className="text-xs font-medium text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">
                                    {dept.name}
                                  </span>
                                )}
                              </div>
                            )}
                            <h4 className="font-semibold text-gray-900" data-testid={`job-title-${job.id}`}>{job.title}</h4>
                            {client && <p className="text-xs text-gray-500 mt-0.5">{client.name}</p>}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap justify-end">
                            <Badge variant="secondary" className={getStatusColor(job.status)} data-testid={`job-status-${job.id}`}>
                              {job.status.replace('_', ' ')}
                            </Badge>
                            {role !== "manager" && job.invoiceStatus && job.invoiceStatus !== 'not_invoiced' && (
                              <Badge
                                variant="outline"
                                className={
                                  job.invoiceStatus === 'invoiced'
                                    ? 'bg-green-50 text-green-700 border-green-200'
                                    : job.invoiceStatus === 'ready_to_invoice'
                                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                                      : 'bg-blue-50 text-blue-700 border-blue-200'
                                }
                                data-testid={`job-invoice-status-${job.id}`}
                              >
                                {job.invoiceStatus.replace(/_/g, ' ')}
                              </Badge>
                            )}
                            <div className="flex gap-1">
                              {/* Conversion actions on completed jobs — only for invoicing roles */}
                              {canInvoice && job.status === 'completed' && (job.invoiceStatus ?? 'not_invoiced') === 'not_invoiced' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => markReady.mutate(job.id)}
                                  disabled={markReady.isPending}
                                  data-testid={`button-mark-ready-${job.id}`}
                                  title="Mark this job ready for Finance to invoice"
                                >
                                  <CheckCircle2 className="h-3 w-3 mr-1" /> Mark Ready
                                </Button>
                              )}
                              {canInvoice && job.status === 'completed' &&
                                ((job.invoiceStatus ?? 'not_invoiced') === 'not_invoiced' ||
                                 job.invoiceStatus === 'ready_to_invoice') && (
                                <Button
                                  size="sm"
                                  onClick={() => createInvoiceFromJob.mutate(job.id)}
                                  disabled={createInvoiceFromJob.isPending}
                                  data-testid={`button-create-invoice-${job.id}`}
                                  title="Create an invoice from this job"
                                >
                                  <Receipt className="h-3 w-3 mr-1" /> Create Invoice
                                </Button>
                              )}
                              {/* Convert to Contract — visible on any completed job for admin/manager/coordinator */}
                              {(role === 'admin' || role === 'manager' || role === 'coordinator') && job.status === 'completed' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-purple-300 text-purple-700 hover:bg-purple-50"
                                  data-testid={`button-convert-contract-${job.id}`}
                                  title="Convert this job into a recurring contract"
                                  onClick={() => {
                                    const client = clientMap.get(job.clientId ?? "");
                                    const worker = workerMap.get(job.workerId ?? "");
                                    const params = new URLSearchParams({
                                      newContract: "1",
                                      ...(job.clientId && { clientId: job.clientId }),
                                      ...(client?.name && { clientName: client.name }),
                                      ...(job.serviceType && { serviceType: job.serviceType }),
                                      ...(job.departmentId && { departmentId: job.departmentId }),
                                      ...(job.location && { address: job.location }),
                                      ...(job.googleMapsLink && { googleMapsLink: job.googleMapsLink }),
                                      ...(job.description && { notes: job.description }),
                                      ...(worker && { workerId: worker.id, workerName: worker.name }),
                                    });
                                    navigate(`/service-contracts?${params.toString()}`);
                                  }}
                                >
                                  <FileSignature className="h-3 w-3 mr-1" /> Convert to Contract
                                </Button>
                              )}
                              {!isTechnician && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => { setEditingJob(job); setIsJobFormOpen(true); }}
                                  data-testid={`button-edit-job-${job.id}`}
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                              )}
                              <Link href={`/jobs/${job.id}/card`}>
                                <Button size="sm" variant="outline" data-testid={`button-print-job-${job.id}`}>
                                  <Printer className="h-3 w-3" />
                                </Button>
                              </Link>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-sm text-gray-600">
                          <div><span className="font-medium">Service:</span> {job.serviceType || '—'}</div>
                          <div><span className="font-medium">Location:</span> {job.location || 'Not specified'}</div>
                          <div><span className="font-medium">Scheduled:</span> {formatDateTime(job.scheduledDate)}</div>
                          <div><span className="font-medium">Worker:</span> {worker?.name || 'Unassigned'}</div>
                          {job.insects && (
                            <div><span className="font-medium">Pest:</span> {job.insects}</div>
                          )}
                          {(job.price || (job as any).pricePerUnit) && (
                            <div>
                              <span className="font-medium">Price:</span>{" "}
                              {job.price ? `R ${parseFloat(String(job.price)).toFixed(2)}` : `R ${parseFloat(String((job as any).pricePerUnit)).toFixed(2)}/unit`}
                            </div>
                          )}
                        </div>

                        {job.description && (
                          <p className="text-sm text-gray-600 mt-2" data-testid={`job-description-${job.id}`}>
                            {job.description}
                          </p>
                        )}
                      </div>
                    );
                  })}
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
