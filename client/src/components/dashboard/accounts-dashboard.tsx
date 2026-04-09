import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Clock, ShoppingCart, Building2 } from "lucide-react";
import type { Client, RentalContract, Invoice, PurchaseOrder, Supplier } from "@shared/schema";

export function AccountsDashboard() {
  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: contracts = [] } = useQuery<RentalContract[]>({ queryKey: ["/api/contracts"] });
  const { data: invoices = [] } = useQuery<Invoice[]>({ queryKey: ["/api/invoices"] });
  const { data: purchaseOrders = [] } = useQuery<PurchaseOrder[]>({ queryKey: ["/api/purchase-orders"] });
  const { data: suppliers = [] } = useQuery<Supplier[]>({ queryKey: ["/api/suppliers"] });

  const paid = invoices.filter(i => i.status === "paid");
  const outstanding = invoices.filter(i => i.status === "sent");
  const overdue = invoices.filter(i => i.status === "overdue");

  const totalPaid = paid.reduce((s, i) => s + parseFloat(i.total ?? "0"), 0);
  const totalOutstanding = outstanding.reduce((s, i) => s + parseFloat(i.total ?? "0"), 0);
  const totalOverdue = overdue.reduce((s, i) => s + parseFloat(i.total ?? "0"), 0);
  const totalRevenue = totalPaid + totalOutstanding + totalOverdue;

  const activeContracts = contracts.filter(c => c.isActive === true);
  const monthlyContractValue = activeContracts.reduce((s, c) => s + parseFloat(c.monthlyPrice ?? "0"), 0);

  const collectionRate = totalRevenue > 0 ? Math.round((totalPaid / totalRevenue) * 100) : 0;

  // Creditors: POs that are pending, approved, or sent (money owed to suppliers)
  const owedStatuses = ["pending", "approved", "sent"];
  const creditorPOs = purchaseOrders.filter(po => owedStatuses.includes(po.status));
  const receivedPOs = purchaseOrders.filter(po => po.status === "received");
  const totalOwed = creditorPOs.reduce((s, po) => s + parseFloat(po.totalAmount ?? "0"), 0);
  const totalPOPaid = receivedPOs.reduce((s, po) => s + parseFloat(po.totalAmount ?? "0"), 0);

  // Group creditor POs by supplier
  const creditorsBySupplier = suppliers
    .map(sup => {
      const pos = creditorPOs.filter(po => po.supplierId === sup.id);
      const totalDue = pos.reduce((s, po) => s + parseFloat(po.totalAmount ?? "0"), 0);
      return { supplier: sup, pos, totalDue };
    })
    .filter(entry => entry.pos.length > 0)
    .sort((a, b) => b.totalDue - a.totalDue);

  const poStatusColor: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800",
    approved: "bg-blue-100 text-blue-800",
    sent: "bg-purple-100 text-purple-800",
    received: "bg-green-100 text-green-800",
    cancelled: "bg-gray-100 text-gray-600",
    rejected: "bg-red-100 text-red-800",
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Accounts Dashboard</h2>
        <p className="text-gray-500 text-sm">Revenue, debtors, creditors and financial overview</p>
      </div>

      {/* Summary cards — Debtors */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Debtors (Money Owed to Us)</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Invoiced", value: `R${totalRevenue.toLocaleString()}`, sub: `${invoices.length} invoices`, icon: DollarSign, color: "bg-blue-50 text-blue-600" },
            { label: "Collected (Paid)", value: `R${totalPaid.toLocaleString()}`, sub: `${collectionRate}% collection rate`, icon: CheckCircle, color: "bg-green-50 text-green-600" },
            { label: "Outstanding", value: `R${totalOutstanding.toLocaleString()}`, sub: `${outstanding.length} invoices`, icon: Clock, color: "bg-amber-50 text-amber-600" },
            { label: "Overdue", value: `R${totalOverdue.toLocaleString()}`, sub: `${overdue.length} invoices`, icon: AlertTriangle, color: "bg-red-50 text-red-600" },
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
      </div>

      {/* Summary cards — Creditors */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Creditors (Money We Owe)</h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { label: "Total Outstanding POs", value: `R${totalOwed.toLocaleString()}`, sub: `${creditorPOs.length} purchase orders`, icon: ShoppingCart, color: "bg-orange-50 text-orange-600" },
            { label: "Suppliers Owed", value: `${creditorsBySupplier.length}`, sub: "with outstanding balances", icon: Building2, color: "bg-purple-50 text-purple-600" },
            { label: "POs Received (Paid)", value: `R${totalPOPaid.toLocaleString()}`, sub: `${receivedPOs.length} orders fulfilled`, icon: CheckCircle, color: "bg-green-50 text-green-600" },
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
      </div>

      {/* Revenue bar */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Revenue Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {totalRevenue > 0 ? (
            <div>
              <div className="flex rounded-full overflow-hidden h-5 mb-3">
                {totalPaid > 0 && <div className="bg-green-500" style={{ width: `${(totalPaid/totalRevenue)*100}%` }} title={`Paid: R${totalPaid}`} />}
                {totalOutstanding > 0 && <div className="bg-amber-400" style={{ width: `${(totalOutstanding/totalRevenue)*100}%` }} title={`Outstanding: R${totalOutstanding}`} />}
                {totalOverdue > 0 && <div className="bg-red-400" style={{ width: `${(totalOverdue/totalRevenue)*100}%` }} title={`Overdue: R${totalOverdue}`} />}
              </div>
              <div className="flex gap-6 text-sm">
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-green-500 rounded"/><span>Paid R{totalPaid.toLocaleString()}</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-amber-400 rounded"/><span>Outstanding R{totalOutstanding.toLocaleString()}</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-red-400 rounded"/><span>Overdue R{totalOverdue.toLocaleString()}</span></div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">No invoice data available</p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Debtors - Outstanding & Overdue */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-400" /> Debtors (Outstanding)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {[...overdue, ...outstanding].length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No outstanding invoices</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {[...overdue, ...outstanding].map(inv => {
                  const client = clients.find(c => c.id === inv.clientId);
                  return (
                    <div key={inv.id} className="flex items-center justify-between border rounded-lg px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{client?.name ?? "Unknown"}</p>
                        <p className="text-xs text-gray-400">{inv.invoiceNumber}
                          {inv.dueDate ? ` · Due ${new Date(inv.dueDate).toLocaleDateString("en-ZA")}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <span className="text-sm font-semibold">R{parseFloat(inv.total ?? "0").toLocaleString()}</span>
                        <Badge className={inv.status === "overdue" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}>
                          {inv.status}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Creditors - Suppliers with outstanding POs */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-orange-400" /> Creditors (Amounts Owed)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {creditorsBySupplier.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No outstanding supplier balances</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {creditorsBySupplier.map(({ supplier, pos, totalDue }) => (
                  <div key={supplier.id} className="border rounded-lg px-3 py-2">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium truncate">{supplier.name}</p>
                      <span className="text-sm font-bold text-orange-600 ml-2 flex-shrink-0">R{totalDue.toLocaleString()}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {pos.map(po => (
                        <span key={po.id} className="inline-flex items-center gap-1 text-xs">
                          <span className="text-gray-400">{po.poNumber}</span>
                          <Badge className={`text-xs py-0 px-1.5 ${poStatusColor[po.status] ?? "bg-gray-100 text-gray-600"}`}>
                            {po.status}
                          </Badge>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recurring Revenue (Contracts) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-400" /> Recurring Revenue (Active Contracts)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6 border-b pb-4 mb-4">
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-1">Monthly Contract Revenue</p>
              <p className="text-3xl font-bold text-green-600">R{monthlyContractValue.toLocaleString()}</p>
              <p className="text-xs text-gray-400">{activeContracts.length} active contracts</p>
            </div>
          </div>
          <div className="space-y-2 max-h-52 overflow-y-auto">
            {activeContracts.map(contract => {
              const client = clients.find(c => c.id === contract.clientId);
              return (
                <div key={contract.id} className="flex items-center justify-between">
                  <p className="text-sm text-gray-700 truncate">{client?.name ?? "Unknown"}</p>
                  <p className="text-sm font-semibold text-green-600">R{parseFloat(contract.monthlyPrice ?? "0").toLocaleString()}/mo</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* All invoices table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {invoices.map(inv => {
              const client = clients.find(c => c.id === inv.clientId);
              return (
                <div key={inv.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium">{inv.invoiceNumber}</p>
                    <p className="text-xs text-gray-400">{client?.name ?? "Unknown"}
                      {inv.issueDate ? ` · ${new Date(inv.issueDate).toLocaleDateString("en-ZA")}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold">R{parseFloat(inv.total ?? "0").toLocaleString()}</span>
                    <Badge className={
                      inv.status === "paid" ? "bg-green-100 text-green-800" :
                      inv.status === "overdue" ? "bg-red-100 text-red-800" :
                      inv.status === "sent" ? "bg-blue-100 text-blue-800" :
                      "bg-gray-100 text-gray-600"
                    }>{inv.status}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
