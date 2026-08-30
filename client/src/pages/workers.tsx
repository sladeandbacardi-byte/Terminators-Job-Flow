import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Search, Plus, Phone, Mail, Clock3, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { getInitials } from "@/lib/utils";
import WorkerForm from "@/components/forms/worker-form";
import { ExportButton } from "@/components/export-button";
import { exportWorkers } from "@/lib/data-export";
import { formatOvertimeMinutes } from "@shared/overtime";
import type { Worker, Department } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

const DEPT_BADGE: Record<string, string> = {
  "div-1": "bg-green-100 text-green-800",
  "div-2": "bg-purple-100 text-purple-800",
  "div-3": "bg-blue-100 text-blue-800",
  "div-4": "bg-orange-100 text-orange-800",
  "div-5": "bg-pink-100 text-pink-800",
  "div-6": "bg-indigo-100 text-indigo-800",
  "div-7": "bg-amber-100 text-amber-800",
};

const DEPT_HEADER: Record<string, string> = {
  "div-1": "border-green-200 bg-green-50",
  "div-2": "border-purple-200 bg-purple-50",
  "div-3": "border-blue-200 bg-blue-50",
  "div-4": "border-orange-200 bg-orange-50",
  "div-5": "border-pink-200 bg-pink-50",
  "div-6": "border-indigo-200 bg-indigo-50",
  "div-7": "border-amber-200 bg-amber-50",
  "none":  "border-gray-200 bg-gray-50",
};

type WorkerOvertimeSummary = {
  totalEntries: number;
  approvedMinutes: number;
  pendingMinutes: number;
  rejectedMinutes: number;
  thisMonth: {
    label: string;
    approvedMinutes: number;
    pendingMinutes: number;
    rejectedMinutes: number;
    totalRequests: number;
  };
  recentEntries: Array<{
    id: string;
    workDate: string;
    clientName: string;
    jobLabel: string | null;
    startTime: string;
    finishTime: string;
    overtimeMinutes: number;
    status: string;
  }>;
};

type WorkerTimeBalance = {
  selectedEmployee: {
    approvedOvertimeMinutes: number;
    approvedTimeOffMinutes: number;
    netMinutes: number;
  } | null;
};

export default function Workers() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showWorkerForm, setShowWorkerForm] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [overtimeWorker, setOvertimeWorker] = useState<Worker | null>(null);
  const [, navigate] = useLocation();

  const { data: workers = [], isLoading } = useQuery<Worker[]>({
    queryKey: ["/api/workers"],
  });

  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  const { data: workerOvertime, isLoading: loadingOvertime } = useQuery<WorkerOvertimeSummary>({
    queryKey: [`/api/overtime/worker/${overtimeWorker?.id}`],
    enabled: Boolean(overtimeWorker),
  });
  const monthStart = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  })();
  const monthEnd = new Date().toISOString().slice(0, 10);
  const { data: workerTimeBalance } = useQuery<WorkerTimeBalance>({
    queryKey: ["time-balance", monthStart, monthEnd, overtimeWorker?.id || ""],
    queryFn: async () => (await apiRequest("GET", `/api/reports/time-balance?from=${monthStart}&to=${monthEnd}&employeeId=${overtimeWorker?.id || ""}`)).json(),
    enabled: Boolean(overtimeWorker),
    refetchOnMount: "always",
  });

  const search = useSearch();
  const openWorkerId = new URLSearchParams(search).get('open');
  useEffect(() => {
    if (!openWorkerId || workers.length === 0) return;
    const found = workers.find(w => w.id === openWorkerId);
    if (found) {
      setSelectedWorker(found);
      setShowWorkerForm(true);
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [workers, openWorkerId]);

  const getDeptName = (id: string | null) => {
    if (!id) return "Office / Management";
    return departments.find(d => d.id === id)?.name ?? "Unknown Department";
  };

  const filtered = workers.filter(w =>
    searchTerm === "" ||
    w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    w.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group workers by department; null → "none"
  const grouped: Record<string, Worker[]> = {};
  for (const w of filtered) {
    const key = w.departmentId || "none";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(w);
  }

  // Ordered sections: defined departments first, then "none"
  const orderedDeptIds = [
    ...departments.map(d => d.id).filter(id => grouped[id]),
    ...(grouped["none"] ? ["none"] : []),
  ];

  const handleAddWorker = () => { setSelectedWorker(null); setShowWorkerForm(true); };
  const handleEditWorker = (w: Worker) => { setSelectedWorker(w); setShowWorkerForm(true); };
  const handleFormSuccess = () => { setShowWorkerForm(false); setSelectedWorker(null); };
  const handleFormCancel  = () => { setShowWorkerForm(false); setSelectedWorker(null); };

  return (
      <>
        <div className="p-6 pb-20 lg:pb-6">
          {/* Top bar */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search workers by name or email..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="search-workers"
              />
            </div>
            <div className="flex gap-2">
              <ExportButton
                onExportCSV={() => exportWorkers(workers)}
                entityName="Workers"
                variant="outline"
                size="sm"
              />
              <Button onClick={handleAddWorker} data-testid="button-add-worker">
                <Plus className="h-4 w-4 mr-2" />
                Add Worker
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="border border-gray-200 rounded-lg p-6 animate-pulse bg-white">
                  <div className="flex items-center space-x-4 mb-4">
                    <div className="w-12 h-12 bg-gray-200 rounded-full" />
                    <div className="space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-24" />
                      <div className="h-3 bg-gray-200 rounded w-20" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-gray-200">
              <Search className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">No workers found</h3>
              <p className="text-gray-500 text-sm">Try adjusting your search criteria.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {orderedDeptIds.map(deptId => {
                const deptWorkers = grouped[deptId];
                const headerClass = DEPT_HEADER[deptId] ?? DEPT_HEADER["none"];
                const badgeClass  = DEPT_BADGE[deptId]  ?? "bg-gray-100 text-gray-800";
                const deptName = deptId === "none" ? "Unassigned / Mobile Staff" : getDeptName(deptId);

                return (
                  <div key={deptId} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    {/* Section header */}
                    <div className={`px-6 py-3 border-b flex items-center justify-between ${headerClass}`}>
                      <div className="flex items-center gap-3">
                        <span className={`inline-block w-3 h-3 rounded-full`}
                          style={{ background: departments.find(d => d.id === deptId)?.colorCode ?? "#9ca3af" }} />
                        <h3 className="font-semibold text-gray-900">{deptName}</h3>
                      </div>
                      <span className="text-xs text-gray-500">{deptWorkers.length} staff</span>
                    </div>

                    {/* Worker cards */}
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {deptWorkers.map(worker => (
                        <div key={worker.id}
                          className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                          data-testid={`worker-card-${worker.id}`}>
                          <div className="flex items-center space-x-3 mb-3">
                            <Avatar className="h-11 w-11">
                              <AvatarFallback className="bg-primary-100 text-primary-700 font-semibold text-sm">
                                {getInitials(worker.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-gray-900 truncate text-sm" data-testid={`worker-name-${worker.id}`}>
                                {worker.name}
                              </h4>
                              {worker.role && (
                                <p className="text-xs text-gray-500 truncate">{worker.role}</p>
                              )}
                               {worker.mobileAccessEnabled && (
                                 <Badge className="mt-1 ml-1 bg-emerald-100 text-emerald-800 text-xs">Mobile access</Badge>
                               )}
                              <Badge className={`mt-1 text-xs ${badgeClass}`} data-testid={`worker-department-${worker.id}`}>
                                {deptName}
                              </Badge>
                            </div>
                          </div>

                          <div className="space-y-1 text-xs text-gray-600">
                            <div className="flex items-center gap-2">
                              <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                              <span className="truncate" data-testid={`worker-email-${worker.id}`}>{worker.email}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                              <span data-testid={`worker-phone-${worker.id}`}>{worker.phone}</span>
                            </div>
                          </div>

                          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              worker.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                            }`} data-testid={`worker-status-${worker.id}`}>
                              {worker.isActive ? "Active" : "Inactive"}
                            </span>
                            <div className="flex gap-1.5">
                              <Button variant="ghost" size="sm" onClick={() => setOvertimeWorker(worker)} title="View overtime">
                                <Clock3 className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="outline" size="sm"
                                onClick={() => handleEditWorker(worker)}
                                data-testid={`button-edit-worker-${worker.id}`}>
                                Edit
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>


      <Dialog open={showWorkerForm} onOpenChange={setShowWorkerForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedWorker ? "Edit Worker" : "Add New Worker"}</DialogTitle>
            <DialogDescription>
              {selectedWorker ? "Update the staff member's information below." : "Enter the details for the new staff member."}
            </DialogDescription>
          </DialogHeader>
          <WorkerForm
            worker={selectedWorker}
            onSuccess={handleFormSuccess}
            onCancel={handleFormCancel}
          />
        </DialogContent>
      </Dialog>

      {/* Worker overtime summary dialog */}
      <Dialog open={Boolean(overtimeWorker)} onOpenChange={open => !open && setOvertimeWorker(null)}>
        <DialogContent className="max-w-lg" onInteractOutside={e => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock3 className="h-5 w-5 text-red-600" />
              {overtimeWorker?.name} — Overtime
            </DialogTitle>
            <DialogDescription>
              All-time and monthly overtime summary.
            </DialogDescription>
          </DialogHeader>

          {loadingOvertime ? (
            <div className="py-8 text-center text-sm text-gray-500">Loading overtime summary…</div>
          ) : workerOvertime ? (
            <div className="space-y-4">
               {workerTimeBalance?.selectedEmployee && (
                 <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                   <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                     <div>
                       <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Current-month time balance</p>
                       <p className={`mt-1 text-2xl font-bold ${workerTimeBalance.selectedEmployee.netMinutes > 0 ? "text-emerald-700" : workerTimeBalance.selectedEmployee.netMinutes < 0 ? "text-red-700" : "text-slate-700"}`}>
                         {workerTimeBalance.selectedEmployee.netMinutes > 0 ? "+" : workerTimeBalance.selectedEmployee.netMinutes < 0 ? "−" : ""}{formatOvertimeMinutes(Math.abs(workerTimeBalance.selectedEmployee.netMinutes))}
                       </p>
                       <p className="mt-1 text-xs text-red-800">Approved Overtime less approved Time Off</p>
                     </div>
                     <Button variant="outline" onClick={() => { setOvertimeWorker(null); navigate(`/time-balance?employeeId=${overtimeWorker?.id}`); }}>
                       View Time Details <ChevronRight className="ml-1 h-4 w-4" />
                     </Button>
                   </div>
                 </div>
               )}
              {/* This month */}
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">{workerOvertime.thisMonth.label}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-emerald-700 font-semibold uppercase tracking-wide">Approved</p>
                    <p className="text-lg font-bold text-emerald-900">{formatOvertimeMinutes(workerOvertime.thisMonth.approvedMinutes)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-amber-700 font-semibold uppercase tracking-wide">Pending</p>
                    <p className="text-lg font-bold text-amber-900">{formatOvertimeMinutes(workerOvertime.thisMonth.pendingMinutes)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-red-700 font-semibold uppercase tracking-wide">Rejected</p>
                    <p className="text-lg font-bold text-red-900">{formatOvertimeMinutes(workerOvertime.thisMonth.rejectedMinutes)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 font-semibold uppercase tracking-wide">Total requests</p>
                    <p className="text-lg font-bold text-gray-900">{workerOvertime.thisMonth.totalRequests}</p>
                  </div>
                </div>
              </div>

              {/* All-time totals */}
              <div className="flex gap-4 text-sm">
                <div><span className="text-gray-500">All-time approved:</span> <span className="font-semibold text-emerald-700">{formatOvertimeMinutes(workerOvertime.approvedMinutes)}</span></div>
                <div><span className="text-gray-500">Total entries:</span> <span className="font-semibold text-gray-900">{workerOvertime.totalEntries}</span></div>
              </div>

              {/* Recent entries */}
              {workerOvertime.recentEntries.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-2">Recent entries</p>
                  <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white overflow-hidden">
                    {workerOvertime.recentEntries.slice(0, 5).map(entry => (
                      <div key={entry.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900">{format(new Date(`${entry.workDate}T12:00:00`), "dd MMM yyyy")}</p>
                          <p className="text-xs text-gray-500">{entry.clientName || "No client"}{entry.jobLabel ? ` · ${entry.jobLabel}` : ""} · {entry.startTime}–{entry.finishTime}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sm font-bold text-gray-900">{formatOvertimeMinutes(entry.overtimeMinutes)}</span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            entry.status === "approved" ? "bg-emerald-100 text-emerald-800" :
                            entry.status === "rejected" ? "bg-red-100 text-red-800" :
                            "bg-amber-100 text-amber-800"
                          }`}>{entry.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {workerOvertime.recentEntries.length > 5 && (
                    <p className="mt-1.5 text-xs text-gray-500 text-right">{workerOvertime.totalEntries - 5} more entries in Overtime Approval</p>
                  )}
                </div>
              )}

              {workerOvertime.totalEntries === 0 && (
                <p className="py-4 text-center text-sm text-gray-500">No overtime entries recorded yet.</p>
              )}
            </div>
          ) : null}

          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => setOvertimeWorker(null)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
      </>
  );
}
