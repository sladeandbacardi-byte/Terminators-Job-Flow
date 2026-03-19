import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DepartmentFilter } from "@/components/filters/department-filter";
import { useDepartmentFilter } from "@/hooks/useDepartmentFilter";
import { useQuery } from "@tanstack/react-query";
import { Users, Briefcase, Package, TrendingUp, ChevronRight, Phone, Mail, MapPin, Calendar } from "lucide-react";
import type { Worker, Job, InventoryItem, Client, Department } from "@shared/schema";

interface DepartmentOverviewProps {
  className?: string;
}

interface DepartmentStats {
  id: string;
  name: string;
  colorCode: string;
  totalWorkers: number;
  activeJobs: number;
  totalClients: number;
  inventoryItems: number;
}

export function DepartmentOverview({ className = "" }: DepartmentOverviewProps) {
  const departmentFilter = useDepartmentFilter();
  const [selectedDept, setSelectedDept] = useState<DepartmentStats | null>(null);

  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  const { data: workers = [] } = useQuery<Worker[]>({
    queryKey: ["/api/workers"],
  });

  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: inventory = [] } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory"],
  });

  const getDepartmentStats = (): DepartmentStats[] => {
    const filtered = departmentFilter.isAllSelected
      ? departments
      : departments.filter(d => departmentFilter.selectedDepartments.includes(d.id));

    return filtered.map(department => ({
      id: department.id,
      name: department.name,
      colorCode: department.colorCode,
      totalWorkers: workers.filter(w => w.departmentId === department.id).length,
      activeJobs: jobs.filter(j => j.departmentId === department.id && j.status !== 'completed').length,
      totalClients: clients.filter(c => c.departmentId === department.id).length,
      inventoryItems: inventory.filter(i => i.departmentId === department.id).length,
    }));
  };

  const departmentStats = getDepartmentStats();

  const deptWorkers = selectedDept ? workers.filter(w => w.departmentId === selectedDept.id) : [];
  const deptJobs = selectedDept ? jobs.filter(j => j.departmentId === selectedDept.id) : [];
  const deptClients = selectedDept ? clients.filter(c => c.departmentId === selectedDept.id) : [];
  const deptInventory = selectedDept ? inventory.filter(i => i.departmentId === selectedDept.id) : [];

  const statusColor: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    in_progress: "bg-blue-100 text-blue-800",
    completed: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800",
  };

  return (
    <>
      <Card className={className} data-testid="department-overview">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">Department Overview</CardTitle>
            <div className="w-64">
              <DepartmentFilter
                selectedDepartments={departmentFilter.selectedDepartments}
                onSelectionChange={departmentFilter.setSelectedDepartments}
                showAllOption={true}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {departmentStats.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No departments selected</p>
            </div>
          ) : (
            <div className="space-y-4">
              {departmentStats.map((dept) => (
                <div
                  key={dept.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer group"
                  data-testid={`department-card-${dept.id}`}
                  onClick={() => setSelectedDept(dept)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: dept.colorCode }}
                      />
                      <h3 className="font-semibold text-gray-900">{dept.name}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" style={{ borderColor: dept.colorCode }}>
                        {departmentFilter.isAllSelected ? 'All Departments' : 'Selected'}
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="text-center" data-testid={`dept-workers-${dept.id}`}>
                      <div className="flex items-center justify-center mb-1">
                        <Users className="h-4 w-4 text-gray-400 mr-1" />
                        <span className="text-2xl font-bold text-gray-900">{dept.totalWorkers}</span>
                      </div>
                      <p className="text-xs text-gray-600">Workers</p>
                    </div>

                    <div className="text-center" data-testid={`dept-jobs-${dept.id}`}>
                      <div className="flex items-center justify-center mb-1">
                        <Briefcase className="h-4 w-4 text-gray-400 mr-1" />
                        <span className="text-2xl font-bold text-gray-900">{dept.activeJobs}</span>
                      </div>
                      <p className="text-xs text-gray-600">Active Jobs</p>
                    </div>

                    <div className="text-center" data-testid={`dept-clients-${dept.id}`}>
                      <div className="flex items-center justify-center mb-1">
                        <TrendingUp className="h-4 w-4 text-gray-400 mr-1" />
                        <span className="text-2xl font-bold text-gray-900">{dept.totalClients}</span>
                      </div>
                      <p className="text-xs text-gray-600">Clients</p>
                    </div>

                    <div className="text-center" data-testid={`dept-inventory-${dept.id}`}>
                      <div className="flex items-center justify-center mb-1">
                        <Package className="h-4 w-4 text-gray-400 mr-1" />
                        <span className="text-2xl font-bold text-gray-900">{dept.inventoryItems}</span>
                      </div>
                      <p className="text-xs text-gray-600">Items</p>
                    </div>
                  </div>
                </div>
              ))}

              {departmentStats.length > 1 && (
                <div className="border-t pt-4 mt-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-3">
                      {departmentFilter.isAllSelected ? 'Total Across All Departments' : 'Total for Selected Departments'}
                    </h4>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="text-center">
                        <span className="text-xl font-bold text-gray-900">
                          {departmentStats.reduce((sum, d) => sum + d.totalWorkers, 0)}
                        </span>
                        <p className="text-xs text-gray-600">Total Workers</p>
                      </div>
                      <div className="text-center">
                        <span className="text-xl font-bold text-gray-900">
                          {departmentStats.reduce((sum, d) => sum + d.activeJobs, 0)}
                        </span>
                        <p className="text-xs text-gray-600">Total Jobs</p>
                      </div>
                      <div className="text-center">
                        <span className="text-xl font-bold text-gray-900">
                          {departmentStats.reduce((sum, d) => sum + d.totalClients, 0)}
                        </span>
                        <p className="text-xs text-gray-600">Total Clients</p>
                      </div>
                      <div className="text-center">
                        <span className="text-xl font-bold text-gray-900">
                          {departmentStats.reduce((sum, d) => sum + d.inventoryItems, 0)}
                        </span>
                        <p className="text-xs text-gray-600">Total Items</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Department Detail Dialog */}
      <Dialog open={!!selectedDept} onOpenChange={() => setSelectedDept(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {selectedDept && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: selectedDept.colorCode }}
                  />
                  {selectedDept.name}
                </DialogTitle>
                <DialogDescription>
                  Workers, jobs, clients and stock items for this department.
                </DialogDescription>
              </DialogHeader>

              {/* Summary bar */}
              <div className="grid grid-cols-4 gap-3 py-2">
                {[
                  { icon: Users, label: "Workers", value: deptWorkers.length },
                  { icon: Briefcase, label: "Jobs", value: deptJobs.length },
                  { icon: TrendingUp, label: "Clients", value: deptClients.length },
                  { icon: Package, label: "Stock Items", value: deptInventory.length },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="text-center bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center justify-center mb-1">
                      <Icon className="h-4 w-4 text-gray-400 mr-1" />
                      <span className="text-2xl font-bold">{value}</span>
                    </div>
                    <p className="text-xs text-gray-500">{label}</p>
                  </div>
                ))}
              </div>

              {/* Workers */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Users className="h-4 w-4" /> Workers
                </h3>
                {deptWorkers.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No workers assigned</p>
                ) : (
                  <div className="space-y-2">
                    {deptWorkers.map(worker => (
                      <div key={worker.id} className="flex items-center justify-between border rounded-lg px-3 py-2">
                        <div>
                          <p className="font-medium text-sm">{worker.name}</p>
                          <p className="text-xs text-gray-500">{worker.role}</p>
                        </div>
                        <div className="flex gap-3 text-xs text-gray-400">
                          {worker.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" /> {worker.phone}
                            </span>
                          )}
                          {worker.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" /> {worker.email}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Jobs */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Briefcase className="h-4 w-4" /> Jobs
                </h3>
                {deptJobs.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No jobs found</p>
                ) : (
                  <div className="space-y-2">
                    {deptJobs.map(job => (
                      <div key={job.id} className="flex items-center justify-between border rounded-lg px-3 py-2">
                        <div>
                          <p className="font-medium text-sm">{job.title}</p>
                          {job.location && (
                            <p className="text-xs text-gray-500 flex items-center gap-1">
                              <MapPin className="h-3 w-3" /> {job.location}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {job.scheduledDate && (
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(job.scheduledDate).toLocaleDateString()}
                            </span>
                          )}
                          <Badge className={`text-xs ${statusColor[job.status] ?? "bg-gray-100 text-gray-700"}`}>
                            {job.status?.replace("_", " ")}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Clients */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> Clients
                </h3>
                {deptClients.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No clients assigned</p>
                ) : (
                  <div className="space-y-2">
                    {deptClients.map(client => (
                      <div key={client.id} className="flex items-center justify-between border rounded-lg px-3 py-2">
                        <div>
                          <p className="font-medium text-sm">{client.name}</p>
                          {client.address && (
                            <p className="text-xs text-gray-500 flex items-center gap-1">
                              <MapPin className="h-3 w-3" /> {client.address}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-3 text-xs text-gray-400">
                          {client.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" /> {client.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Stock Items */}
              {deptInventory.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <Package className="h-4 w-4" /> Stock Items
                  </h3>
                  <div className="space-y-2">
                    {deptInventory.map(item => (
                      <div key={item.id} className="flex items-center justify-between border rounded-lg px-3 py-2">
                        <p className="font-medium text-sm">{item.name}</p>
                        <span className="text-xs text-gray-500">Qty: {item.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
