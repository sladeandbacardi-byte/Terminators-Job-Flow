import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, FileText, TrendingUp, DollarSign, Phone, Mail, Calendar } from "lucide-react";
import type { Client, Contract, Invoice, Job } from "@shared/schema";

function thisMonth(date: any) {
  if (!date) return false;
  const d = new Date(date);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

export function SalesDashboard() {
  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: contracts = [] } = useQuery<Contract[]>({ queryKey: ["/api/contracts"] });
  const { data: invoices = [] } = useQuery<Invoice[]>({ queryKey: ["/api/invoices"] });
  const { data: jobs = [] } = useQuery<Job[]>({ queryKey: ["/api/jobs"] });

  const activeClients = clients.filter(c => c.status === "active");
  const newClientsThisMonth = clients.filter(c => thisMonth(c.createdAt));
  const activeContracts = contracts.filter(c => c.status === "active");
  const expiringContracts = contracts.filter(c => {
    if (!c.endDate) return false;
    const end = new Date(c.endDate);
    const now = new Date();
    const diff = (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 30;
  });
  const totalMonthlyRevenue = activeContracts.reduce((sum, c) => sum + parseFloat(c.monthlyValue ?? "0"), 0);
  const pendingJobs = jobs.filter(j => j.status === "pending" || j.status === "scheduled");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Sales Dashboard</h2>
        <p className="text-gray-500 text-sm">Client pipeline, contracts and revenue overview</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Active Clients", value: activeClients.length, sub: newClientsThisMonth.length > 0 ? `+${newClientsThisMonth.length} new this month` : "No new this month", icon: Users, color: "bg-blue-50 text-blue-600", subColor: "text-green-600" },
          { label: "Active Contracts", value: activeContracts.length, sub: `${expiringContracts.length} expiring soon`, icon: FileText, color: "bg-purple-50 text-purple-600", subColor: expiringContracts.length > 0 ? "text-orange-600" : "text-gray-400" },
          { label: "Monthly Revenue", value: `R${totalMonthlyRevenue.toLocaleString()}`, sub: "From active contracts", icon: TrendingUp, color: "bg-green-50 text-green-600", subColor: "text-gray-400" },
          { label: "Jobs Pending", value: pendingJobs.length, sub: "Awaiting assignment", icon: DollarSign, color: "bg-amber-50 text-amber-600", subColor: "text-gray-400" },
        ].map(({ label, value, sub, icon: Icon, color, subColor }) => (
          <Card key={label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
                  <p className={`text-xs mt-1 ${subColor}`}>{sub}</p>
                </div>
                <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${color}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Clients */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-400" /> Recent Clients
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {clients.slice(0, 10).map(client => (
                <div key={client.id} className="flex items-center justify-between border rounded-lg px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{client.name}</p>
                    <div className="flex gap-3 text-xs text-gray-400 mt-0.5">
                      {client.contactPerson && <span>{client.contactPerson}</span>}
                      {client.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3"/>{client.phone}</span>}
                    </div>
                  </div>
                  <Badge className={client.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}>
                    {client.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Contracts */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-400" /> Active Contracts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {activeContracts.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No active contracts</p>
              ) : (
                activeContracts.map(contract => {
                  const client = clients.find(c => c.id === contract.clientId);
                  const daysLeft = contract.endDate ? Math.ceil((new Date(contract.endDate).getTime() - Date.now()) / 86400000) : null;
                  return (
                    <div key={contract.id} className="flex items-center justify-between border rounded-lg px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{client?.name ?? "Unknown Client"}</p>
                        <p className="text-xs text-gray-400 flex items-center gap-1">
                          <Calendar className="h-3 w-3"/>
                          R{parseFloat(contract.monthlyValue ?? "0").toLocaleString()}/mo
                          {daysLeft !== null && <span className={daysLeft <= 30 ? "text-orange-500 ml-1" : "ml-1"}> · {daysLeft}d left</span>}
                        </p>
                      </div>
                      <Badge className={daysLeft !== null && daysLeft <= 30 ? "bg-orange-100 text-orange-800" : "bg-green-100 text-green-800"}>
                        {daysLeft !== null && daysLeft <= 30 ? "Expiring" : "Active"}
                      </Badge>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invoices summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-gray-400" /> Invoice Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 mb-4">
            {[
              { label: "Sent / Outstanding", count: invoices.filter(i=>i.status==="sent").length, amount: invoices.filter(i=>i.status==="sent").reduce((s,i)=>s+parseFloat(i.amount??'0'),0), color: "text-blue-600" },
              { label: "Paid", count: invoices.filter(i=>i.status==="paid").length, amount: invoices.filter(i=>i.status==="paid").reduce((s,i)=>s+parseFloat(i.amount??'0'),0), color: "text-green-600" },
              { label: "Overdue", count: invoices.filter(i=>i.status==="overdue").length, amount: invoices.filter(i=>i.status==="overdue").reduce((s,i)=>s+parseFloat(i.amount??'0'),0), color: "text-red-600" },
            ].map(({ label, count, amount, color }) => (
              <div key={label} className="text-center border rounded-lg p-3">
                <p className="text-xs text-gray-500">{label}</p>
                <p className={`text-xl font-bold ${color}`}>{count}</p>
                <p className="text-xs text-gray-400">R{amount.toLocaleString()}</p>
              </div>
            ))}
          </div>
          <div className="space-y-1">
            {invoices.map(inv => {
              const client = clients.find(c => c.id === inv.clientId);
              return (
                <div key={inv.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{inv.invoiceNumber}</p>
                    <p className="text-xs text-gray-400">{client?.name ?? "Unknown"}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold">R{parseFloat(inv.amount ?? "0").toLocaleString()}</span>
                    <Badge className={inv.status === "paid" ? "bg-green-100 text-green-800" : inv.status === "overdue" ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800"}>
                      {inv.status}
                    </Badge>
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
