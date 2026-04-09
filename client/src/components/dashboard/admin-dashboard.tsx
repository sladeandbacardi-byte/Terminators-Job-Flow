import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DepartmentOverview } from "./department-overview";
import { WorkerJobsSummary } from "./worker-jobs-summary";
import { Users, Briefcase, DollarSign, FileText, TrendingUp, AlertTriangle, Package, ShoppingCart, TrendingDown, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import type { Job, Worker, Client, Invoice, RentalContract, InventoryItem, Department, PurchaseOrder } from "@shared/schema";

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

function prevRange(date: any, range: Range) {
  if (!date) return false;
  const d = new Date(date);
  const now = new Date();
  if (range === "today") {
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
    return d.toDateString() === yesterday.toDateString();
  } else if (range === "week") {
    const day = now.getDay(); const diff = day === 0 ? -6 : 1 - day;
    const thisStart = new Date(now); thisStart.setDate(now.getDate() + diff); thisStart.setHours(0,0,0,0);
    const prevEnd = new Date(thisStart); prevEnd.setMilliseconds(-1);
    const prevStart = new Date(prevEnd); prevStart.setDate(prevEnd.getDate() - 6); prevStart.setHours(0,0,0,0);
    return d >= prevStart && d <= prevEnd;
  } else {
    const pm = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const py = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    return d.getMonth() === pm && d.getFullYear() === py;
  }
}

function pct(current: number, prev: number) {
  if (prev === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - prev) / prev) * 100);
}

function fmt(n: number) {
  return `R${n.toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function AdminDashboard() {
  const [range, setRange] = useState<Range>("month");

  const { data: jobs = [] } = useQuery<Job[]>({ queryKey: ["/api/jobs"] });
  const { data: workers = [] } = useQuery<Worker[]>({ queryKey: ["/api/workers"] });
  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: invoices = [] } = useQuery<Invoice[]>({ queryKey: ["/api/invoices"] });
  const { data: contracts = [] } = useQuery<RentalContract[]>({ queryKey: ["/api/contracts"] });
  const { data: inventory = [] } = useQuery<InventoryItem[]>({ queryKey: ["/api/inventory"] });
  const { data: departments = [] } = useQuery<Department[]>({ queryKey: ["/api/departments"] });
  const { data: purchaseOrders = [] } = useQuery<PurchaseOrder[]>({ queryKey: ["/api/purchase-orders"] });

  const filteredJobs = jobs.filter(j => inRange(j.scheduledDate, range));
  const activeContracts = contracts.filter(c => c.isActive === true);
  const monthlyRecurring = activeContracts.reduce((s, c) => s + parseFloat(c.monthlyPrice ?? "0"), 0);
  const lowStock = inventory.filter(i => i.quantity <= (i.minStockLevel ?? 0));
  const overdueCount = invoices.filter(i => i.status === "overdue").length;

  // P&L calculations — current period
  const paidInvoices = invoices.filter(i => i.status === "paid" && inRange(i.paymentDate ?? i.issueDate, range));
  const sales = paidInvoices.reduce((s, i) => s + parseFloat(i.total ?? "0"), 0);
  // Add pro-rated contract recurring for month view
  const contractRevenue = range === "month" ? monthlyRecurring : range === "week" ? monthlyRecurring / 4.33 : monthlyRecurring / 30;
  const totalSales = sales + contractRevenue;

  // Expenses = POs (excluding rejected/cancelled) in the period
  const activePOs = purchaseOrders.filter(po =>
    po.status !== "rejected" && po.status !== "cancelled" && inRange(po.requestDate, range)
  );
  const expenses = activePOs.reduce((s, po) => s + parseFloat(po.totalAmount ?? "0"), 0);

  const grossProfit = totalSales - expenses;
  const margin = totalSales > 0 ? Math.round((grossProfit / totalSales) * 100) : 0;

  // Previous period for comparison
  const prevPaidInvoices = invoices.filter(i => i.status === "paid" && prevRange(i.paymentDate ?? i.issueDate, range));
  const prevSales = prevPaidInvoices.reduce((s, i) => s + parseFloat(i.total ?? "0"), 0) + contractRevenue;
  const prevPOs = purchaseOrders.filter(po =>
    po.status !== "rejected" && po.status !== "cancelled" && prevRange(po.requestDate, range)
  );
  const prevExpenses = prevPOs.reduce((s, po) => s + parseFloat(po.totalAmount ?? "0"), 0);
  const prevProfit = prevSales - prevExpenses;

  const salesPct = pct(totalSales, prevSales);
  const expPct = pct(expenses, prevExpenses);
  const profitPct = pct(grossProfit, prevProfit);

  const rangeLabel = range === "today" ? "Today" : range === "week" ? "This Week" : "This Month";
  const prevLabel = range === "today" ? "yesterday" : range === "week" ? "last week" : "last month";

  // Outstanding / all-time revenue for top cards
  const allTimePaid = invoices.filter(i => i.status === "paid").reduce((s, i) => s + parseFloat(i.total ?? "0"), 0);
  const outstanding = invoices.filter(i => i.status === "sent" || i.status === "overdue").reduce((s, i) => s + parseFloat(i.total ?? "0"), 0);

  return (
    <div className="space-y-6">
      {/* Header with range toggle */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Owner Dashboard</h2>
          <p className="text-gray-500 text-sm">Full business overview — P&L, operations and staff</p>
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

      {/* P&L Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Sales */}
        <Card className="border-green-200 bg-gradient-to-br from-green-50 to-white">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-green-700 uppercase tracking-wide">Sales — {rangeLabel}</p>
                <p className="text-3xl font-bold text-green-800 mt-1">{fmt(totalSales)}</p>
                <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                  <p>Invoices paid: {fmt(sales)}</p>
                  <p>Contract recurring: {fmt(contractRevenue)}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="h-10 w-10 rounded-xl bg-green-100 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <CompBadge pct={salesPct} label={prevLabel} positive />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Expenses */}
        <Card className="border-red-200 bg-gradient-to-br from-red-50 to-white">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-red-700 uppercase tracking-wide">Expenses — {rangeLabel}</p>
                <p className="text-3xl font-bold text-red-800 mt-1">{fmt(expenses)}</p>
                <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                  <p>{activePOs.length} purchase order{activePOs.length !== 1 ? "s" : ""}</p>
                  <p>{purchaseOrders.filter(po => po.status === "pending" && inRange(po.requestDate, range)).length} awaiting approval</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="h-10 w-10 rounded-xl bg-red-100 flex items-center justify-center">
                  <ShoppingCart className="h-5 w-5 text-red-600" />
                </div>
                <CompBadge pct={expPct} label={prevLabel} positive={false} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profit */}
        <Card className={`border-2 ${grossProfit >= 0 ? "border-emerald-300 bg-gradient-to-br from-emerald-50 to-white" : "border-orange-300 bg-gradient-to-br from-orange-50 to-white"}`}>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className={`text-xs font-medium uppercase tracking-wide ${grossProfit >= 0 ? "text-emerald-700" : "text-orange-700"}`}>Gross Profit — {rangeLabel}</p>
                <p className={`text-3xl font-bold mt-1 ${grossProfit >= 0 ? "text-emerald-800" : "text-orange-700"}`}>{fmt(grossProfit)}</p>
                <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                  <p>Margin: <span className={`font-semibold ${margin >= 50 ? "text-green-600" : margin >= 30 ? "text-amber-600" : "text-red-600"}`}>{margin}%</span></p>
                  <p>Outstanding: {fmt(outstanding)}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${grossProfit >= 0 ? "bg-emerald-100" : "bg-orange-100"}`}>
                  <DollarSign className={`h-5 w-5 ${grossProfit >= 0 ? "text-emerald-600" : "text-orange-600"}`} />
                </div>
                <CompBadge pct={profitPct} label={prevLabel} positive />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* P&L breakdown bar */}
      {(totalSales > 0 || expenses > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600 font-medium">P&L Breakdown — {rangeLabel}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: "Sales", value: totalSales, max: Math.max(totalSales, expenses), color: "bg-green-500", textColor: "text-green-700" },
                { label: "Expenses", value: expenses, max: Math.max(totalSales, expenses), color: "bg-red-400", textColor: "text-red-700" },
                { label: "Profit", value: grossProfit, max: Math.max(totalSales, expenses), color: grossProfit >= 0 ? "bg-emerald-500" : "bg-orange-400", textColor: grossProfit >= 0 ? "text-emerald-700" : "text-orange-700" },
              ].map(({ label, value, max, color, textColor }) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-16 text-right">{label}</span>
                  <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${color} rounded-full transition-all duration-500 flex items-center justify-end pr-2`}
                      style={{ width: max > 0 ? `${Math.max(Math.abs(value) / max * 100, 2)}%` : "2%" }}
                    />
                  </div>
                  <span className={`text-sm font-semibold w-24 ${textColor}`}>{fmt(value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Operations summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Active Staff", value: workers.filter(w=>w.isActive!==false).length, sub: `${departments.length} departments`, icon: Users, color: "bg-indigo-50 text-indigo-600" },
          { label: "Jobs This Period", value: filteredJobs.length, sub: `${filteredJobs.filter(j=>j.status==="completed").length} completed`, icon: Briefcase, color: "bg-green-50 text-green-600" },
          { label: "Monthly Recurring", value: fmt(monthlyRecurring), sub: `${activeContracts.length} active contracts`, icon: TrendingUp, color: "bg-blue-50 text-blue-600" },
          { label: "All-time Paid", value: fmt(allTimePaid), sub: `${invoices.filter(i=>i.status==="paid").length} invoices`, icon: FileText, color: "bg-emerald-50 text-emerald-600" },
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
      {(overdueCount > 0 || lowStock.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {overdueCount > 0 && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
              <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-700">{overdueCount} Overdue Invoice{overdueCount > 1 ? "s" : ""}</p>
                <p className="text-xs text-red-500">Requires immediate follow-up — {fmt(invoices.filter(i=>i.status==="overdue").reduce((s,i)=>s+parseFloat(i.total??"0"),0))} at risk</p>
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

      {/* Finance + Staff split */}
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
                const total = items.reduce((s, i) => s + parseFloat(i.total ?? "0"), 0);
                return (
                  <div key={label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
                      <span className="text-sm text-gray-700">{label}</span>
                      <Badge variant="outline" className="text-xs">{items.length}</Badge>
                    </div>
                    <span className="text-sm font-semibold">{fmt(total)}</span>
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

function CompBadge({ pct: p, label, positive }: { pct: number; label: string; positive: boolean }) {
  const up = p > 0;
  const neutral = p === 0;
  const good = positive ? up : !up;
  if (neutral) return <span className="text-xs text-gray-400 flex items-center gap-0.5"><Minus className="h-3 w-3" /> same as {label}</span>;
  return (
    <span className={`text-xs font-medium flex items-center gap-0.5 ${good ? "text-green-600" : "text-red-600"}`}>
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(p)}% vs {label}
    </span>
  );
}
