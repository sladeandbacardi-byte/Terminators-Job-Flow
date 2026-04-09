import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import type { Client, RentalContract, Invoice } from "@shared/schema";

export function AccountsDashboard() {
  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: contracts = [] } = useQuery<RentalContract[]>({ queryKey: ["/api/contracts"] });
  const { data: invoices = [] } = useQuery<Invoice[]>({ queryKey: ["/api/invoices"] });

  const paid = invoices.filter(i => i.status === "paid");
  const outstanding = invoices.filter(i => i.status === "sent");
  const overdue = invoices.filter(i => i.status === "overdue");
  const draft = invoices.filter(i => i.status === "draft");

  const totalPaid = paid.reduce((s, i) => s + parseFloat(i.total ?? "0"), 0);
  const totalOutstanding = outstanding.reduce((s, i) => s + parseFloat(i.total ?? "0"), 0);
  const totalOverdue = overdue.reduce((s, i) => s + parseFloat(i.total ?? "0"), 0);
  const totalRevenue = totalPaid + totalOutstanding + totalOverdue;

  const activeContracts = contracts.filter(c => c.isActive === true);
  const monthlyContractValue = activeContracts.reduce((s, c) => s + parseFloat(c.monthlyPrice ?? "0"), 0);

  // Collection rate
  const collectionRate = totalRevenue > 0 ? Math.round((totalPaid / totalRevenue) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Accounts Dashboard</h2>
        <p className="text-gray-500 text-sm">Revenue, debtors, creditors and financial overview</p>
      </div>

      {/* Summary cards */}
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

        {/* Recurring Revenue (Contracts) */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-400" /> Recurring Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-4 border-b mb-4">
              <p className="text-xs text-gray-500 mb-1">Monthly Contract Revenue</p>
              <p className="text-3xl font-bold text-green-600">R{monthlyContractValue.toLocaleString()}</p>
              <p className="text-xs text-gray-400">{activeContracts.length} active contracts</p>
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
      </div>

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
