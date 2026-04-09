import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DepartmentOverview } from "./department-overview";
import { WorkerJobsSummary } from "./worker-jobs-summary";
import { Users, Briefcase, DollarSign, FileText, TrendingUp, AlertTriangle, Package } from "lucide-react";
import type { Job, Worker, Client, Invoice, Contract, InventoryItem, Department } from "@shared/schema";

type Range = "today" | "week" | "month";

function inRange(date: any, range: Range) {
  if (!date) return false;
  const d = new Date(date);
  const now = new Date();
  if (range === "today") {
    return d.toDateString() === now.toDateString();
  } else if (range === "week") {
    const day = now.getDay(); const diff = day === 0 ? -6 : 1 - day;
    const start = new Date(now); start.setDate(now.getDate() + diff); start.setHours(0,0,0,0);
    const end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23,59,59,999);
    return d >= start && d <= end;
  } else {
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }
}

export function AdminDashboard() {
  const [range, setRange] = useState<Range>("week");

  const { data: jobs = [] } = useQuery<Job[]>({ queryKey: ["/api/jobs"] });
  const { data: workers = [] } = useQuery<Worker[]>({ queryKey: ["/api/workers"] });
  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: invoices = [] } = useQuery<Invoice[]>({ queryKey: ["/api/invoices"] });
  const { data: contracts = [] } = useQuery<Contract[]>({ queryKey: ["/api/contracts"] });
  const { data: inventory = [] } = useQuery<InventoryItem[]>({ queryKey: ["/api/inventory"] });
  const { data: departments = [] } = useQuery<Department[]>({ queryKey: ["/api/departments"] });

  const filteredJobs = jobs.filter(j => inRange(j.scheduledDate, range));
  const totalRevenue = invoices.filter(i => i.status === "paid").reduce((s, i) => s + parseFloat(i.amount ?? "0"), 0);
  const outstanding = invoices.filter(i => i.status === "sent" || i.status === "overdue").reduce((s, i) => s + parseFloat(i.amount ?? "0"), 0);
  const overdueCount = invoices.filter(i => i.status === "overdue").length;
  const lowStock = inventory.filter(i => i.quantity <= (i.minStockLevel ?? 0));
  const activeContracts = contracts.filter(c => c.status === "active");
  const monthlyRecurring = activeContracts.reduce((s, c) => s + parseFloat(c.monthlyValue ?? "0"), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Admin Dashboard</h2>
          <p className="text-gray-500 text-sm">Full business overview — operations, finance and staff</p>
        </div>
        <div className="flex gap-1">
          {(["today","week","month"] as Range[]).map(r => (
            <Button key={r} size="sm" variant={range === r ? "default" : "outline"}
              className="text-xs h-8 px-3" onClick={() => setRange(r)}>
              {r === "today" ? "Today" : r === "week" ? "This Week" : "This Month"}
            </Button>
          ))}
        </div>
      </div>

      {/* Top metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Active Staff", value: workers.filter(w=>w.isActive!==false).length, sub: `${departments.length} departments`, icon: Users, color: "bg-indigo-50 text-indigo-600" },
          { label: "Jobs This Period", value: filteredJobs.length, sub: `${filteredJobs.filter(j=>j.status==="completed").length} completed`, icon: Briefcase, color: "bg-green-50 text-green-600" },
          { label: "Revenue Collected", value: `R${totalRevenue.toLocaleString()}`, sub: `R${outstanding.toLocaleString()} outstanding`, icon: DollarSign, color: "bg-emerald-50 text-emerald-600" },
          { label: "Monthly Recurring", value: `R${monthlyRecurring.toLocaleString()}`, sub: `${activeContracts.length} active contracts`, icon: TrendingUp, color: "bg-blue-50 text-blue-600" },
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

      {/* Alerts row */}
      {(overdueCount > 0 || lowStock.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {overdueCount > 0 && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
              <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-700">{overdueCount} Overdue Invoice{overdueCount > 1 ? "s" : ""}</p>
                <p className="text-xs text-red-500">Requires immediate follow-up</p>
              </div>
            </div>
          )}
          {lowStock.length > 0 && (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
              <Package className="h-5 w-5 text-amber-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-700">{lowStock.length} Item{lowStock.length > 1 ? "s" : ""} Low on Stock</p>
                <p className="text-xs text-amber-500">Check stock levels and reorder</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Department Overview */}
      <DepartmentOverview />

      {/* Worker Jobs Summary */}
      <WorkerJobsSummary />

      {/* Finance snapshot */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-400" /> Invoice Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: "Paid", items: invoices.filter(i=>i.status==="paid"), color: "bg-green-500" },
                { label: "Sent / Outstanding", items: invoices.filter(i=>i.status==="sent"), color: "bg-amber-400" },
                { label: "Overdue", items: invoices.filter(i=>i.status==="overdue"), color: "bg-red-400" },
                { label: "Draft", items: invoices.filter(i=>i.status==="draft"), color: "bg-gray-300" },
              ].map(({ label, items, color }) => {
                const total = items.reduce((s, i) => s + parseFloat(i.amount ?? "0"), 0);
                return (
                  <div key={label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
                      <span className="text-sm text-gray-700">{label}</span>
                      <Badge variant="outline" className="text-xs">{items.length}</Badge>
                    </div>
                    <span className="text-sm font-semibold">R{total.toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-400" /> Staff by Department
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {departments.map(dept => {
                const deptWorkers = workers.filter(w => w.departmentId === dept.id);
                return (
                  <div key={dept.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: dept.colorCode }} />
                      <span className="text-sm text-gray-700">{dept.name}</span>
                    </div>
                    <span className="text-sm font-semibold">{deptWorkers.length} staff</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
