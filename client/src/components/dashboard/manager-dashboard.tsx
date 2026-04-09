import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DepartmentOverview } from "./department-overview";
import { WorkerJobsSummary } from "./worker-jobs-summary";
import {
  Users, Briefcase, ClipboardList, AlertTriangle, Package,
  ShoppingCart, CheckCircle, Clock, CalendarDays
} from "lucide-react";
import type { Job, Worker, Client, Department, PurchaseOrder, InventoryItem } from "@shared/schema";

export function ManagerDashboard() {
  const { data: jobs = [] } = useQuery<Job[]>({ queryKey: ["/api/jobs"] });
  const { data: workers = [] } = useQuery<Worker[]>({ queryKey: ["/api/workers"] });
  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: departments = [] } = useQuery<Department[]>({ queryKey: ["/api/departments"] });
  const { data: purchaseOrders = [] } = useQuery<PurchaseOrder[]>({ queryKey: ["/api/purchase-orders"] });
  const { data: inventory = [] } = useQuery<InventoryItem[]>({ queryKey: ["/api/inventory"] });

  const today = new Date().toDateString();

  const todaysJobs = jobs.filter(j => j.scheduledDate && new Date(j.scheduledDate).toDateString() === today);
  const pendingJobs = jobs.filter(j => j.status === "pending");
  const inProgressJobs = jobs.filter(j => j.status === "in_progress");
  const completedToday = todaysJobs.filter(j => j.status === "completed");
  const unassignedJobs = jobs.filter(j => !j.workerId && j.status === "pending");

  const activeWorkers = workers.filter(w => w.isActive !== false);
  const pendingPOs = purchaseOrders.filter(po => po.status === "pending");
  const lowStock = inventory.filter(i => i.quantity <= (i.minStockLevel ?? 0));

  const jobStatusColor: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800",
    in_progress: "bg-blue-100 text-blue-800",
    completed: "bg-green-100 text-green-800",
    cancelled: "bg-gray-100 text-gray-600",
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Operations Manager Dashboard</h2>
        <p className="text-gray-500 text-sm">Staff assignments, job scheduling, and operational overview</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Today's Jobs",
            value: todaysJobs.length,
            sub: `${completedToday.length} completed`,
            icon: CalendarDays,
            color: "bg-blue-50 text-blue-600",
          },
          {
            label: "Active Staff",
            value: activeWorkers.length,
            sub: `${departments.length} departments`,
            icon: Users,
            color: "bg-teal-50 text-teal-600",
          },
          {
            label: "Pending Approvals",
            value: pendingPOs.length,
            sub: "purchase orders",
            icon: ShoppingCart,
            color: pendingPOs.length > 0 ? "bg-amber-50 text-amber-600" : "bg-gray-50 text-gray-400",
          },
          {
            label: "Unassigned Jobs",
            value: unassignedJobs.length,
            sub: "need a worker",
            icon: ClipboardList,
            color: unassignedJobs.length > 0 ? "bg-red-50 text-red-600" : "bg-gray-50 text-gray-400",
          },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{label}</p>
                  <p className="text-xl font-bold text-gray-900 mt-1">{value}</p>
                  <p className="text-xs text-gray-400 mt-1">{sub}</p>
                </div>
                <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${color}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alerts */}
      {(unassignedJobs.length > 0 || pendingPOs.length > 0 || lowStock.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {unassignedJobs.length > 0 && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
              <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-700">{unassignedJobs.length} Unassigned Job{unassignedJobs.length > 1 ? "s" : ""}</p>
                <p className="text-xs text-red-500">Assign workers before the scheduled date</p>
              </div>
            </div>
          )}
          {pendingPOs.length > 0 && (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
              <ShoppingCart className="h-5 w-5 text-amber-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-700">{pendingPOs.length} PO{pendingPOs.length > 1 ? "s" : ""} Awaiting Approval</p>
                <p className="text-xs text-amber-500">Review and approve purchase orders</p>
              </div>
            </div>
          )}
          {lowStock.length > 0 && (
            <div className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-xl p-4">
              <Package className="h-5 w-5 text-orange-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-orange-700">{lowStock.length} Item{lowStock.length > 1 ? "s" : ""} Low on Stock</p>
                <p className="text-xs text-orange-500">Reorder before stock runs out</p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Jobs */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-blue-400" /> Today's Schedule
            </CardTitle>
          </CardHeader>
          <CardContent>
            {todaysJobs.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No jobs scheduled for today</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {todaysJobs.map(job => {
                  const worker = workers.find(w => w.id === job.workerId);
                  const client = clients.find(c => c.id === job.clientId);
                  return (
                    <div key={job.id} className="flex items-center justify-between border rounded-lg px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{client?.name ?? "Unknown Client"}</p>
                        <p className="text-xs text-gray-400 truncate">
                          {worker ? worker.name : <span className="text-red-400">Unassigned</span>}
                          {job.scheduledDate ? ` · ${new Date(job.scheduledDate).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}` : ""}
                        </p>
                      </div>
                      <Badge className={`text-xs ml-2 flex-shrink-0 ${jobStatusColor[job.status ?? "pending"] ?? "bg-gray-100 text-gray-600"}`}>
                        {job.status?.replace("_", " ")}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Purchase Orders */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-amber-400" /> Purchase Orders Pending Approval
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendingPOs.length === 0 ? (
              <div className="flex items-center gap-2 text-green-600 py-6 justify-center">
                <CheckCircle className="h-4 w-4" />
                <p className="text-sm">No pending approvals</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {pendingPOs.map(po => (
                  <div key={po.id} className="flex items-center justify-between border rounded-lg px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{po.poNumber}</p>
                      <p className="text-xs text-gray-400">
                        {po.requestDate ? new Date(po.requestDate).toLocaleDateString("en-ZA") : ""}
                        {po.notes ? ` · ${po.notes.substring(0, 40)}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                      <span className="text-sm font-semibold text-amber-700">
                        R{parseFloat(po.totalAmount ?? "0").toLocaleString()}
                      </span>
                      <Badge className="bg-amber-100 text-amber-800 text-xs">pending</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Job pipeline overview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-gray-400" /> All Jobs Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Pending", items: pendingJobs, color: "text-amber-600", bg: "bg-amber-50" },
              { label: "In Progress", items: inProgressJobs, color: "text-blue-600", bg: "bg-blue-50" },
              { label: "Completed", items: jobs.filter(j => j.status === "completed"), color: "text-green-600", bg: "bg-green-50" },
              { label: "Cancelled", items: jobs.filter(j => j.status === "cancelled"), color: "text-gray-500", bg: "bg-gray-50" },
            ].map(({ label, items, color, bg }) => (
              <div key={label} className={`rounded-xl p-4 ${bg} text-center`}>
                <p className={`text-2xl font-bold ${color}`}>{items.length}</p>
                <p className="text-xs text-gray-500 mt-1">{label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Department Overview */}
      <DepartmentOverview />

      {/* Worker Jobs Summary */}
      <WorkerJobsSummary />
    </div>
  );
}
