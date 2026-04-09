import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, FileText, TrendingUp, DollarSign, Phone, Calendar, ClipboardList, AlertCircle, Clock, CheckCircle2 } from "lucide-react";
import type { Client, RentalContract, Invoice, Job, QuoteSubmission } from "@shared/schema";

function thisMonth(date: any) {
  if (!date) return false;
  const d = new Date(date);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

const serviceTypeLabel: Record<string, string> = {
  pest_control: "Pest Control",
  sanitary_bins: "Sanitary Bins",
  washroom: "Washroom",
  deep_cleaning: "Deep Cleaning",
};

const quoteStatusConfig: Record<string, { label: string; className: string; icon: any }> = {
  new:       { label: "New",       className: "bg-blue-100 text-blue-800",   icon: AlertCircle },
  contacted: { label: "Contacted", className: "bg-amber-100 text-amber-800", icon: Clock },
  quoted:    { label: "Quoted",    className: "bg-purple-100 text-purple-800", icon: FileText },
  converted: { label: "Won",       className: "bg-green-100 text-green-800", icon: CheckCircle2 },
  declined:  { label: "Declined",  className: "bg-gray-100 text-gray-600",   icon: AlertCircle },
};

export function SalesDashboard() {
  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: contracts = [] } = useQuery<RentalContract[]>({ queryKey: ["/api/contracts"] });
  const { data: invoices = [] } = useQuery<Invoice[]>({ queryKey: ["/api/invoices"] });
  const { data: jobs = [] } = useQuery<Job[]>({ queryKey: ["/api/jobs"] });
  const { data: quotes = [] } = useQuery<QuoteSubmission[]>({ queryKey: ["/api/quote-submissions"] });

  const activeClients = clients.filter(c => c.status === "active");
  const newClientsThisMonth = clients.filter(c => thisMonth(c.createdAt));
  const activeContracts = contracts.filter(c => c.isActive === true);
  const expiringContracts = contracts.filter(c => {
    if (!c.endDate) return false;
    const end = new Date(c.endDate);
    const now = new Date();
    const diff = (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 30;
  });
  const totalMonthlyRevenue = activeContracts.reduce((sum, c) => sum + parseFloat(c.monthlyPrice ?? "0"), 0);

  // Quotes
  const openQuotes = quotes.filter(q => q.status === "new" || q.status === "contacted" || q.status === "quoted");
  const newQuotes = quotes.filter(q => q.status === "new");
  const overdueFollowUp = openQuotes.filter(q => q.followUpDate && new Date(q.followUpDate) < new Date());

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Sales Dashboard</h2>
        <p className="text-gray-500 text-sm">Client pipeline, quotes, contracts and revenue overview</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Active Clients",
            value: activeClients.length,
            sub: newClientsThisMonth.length > 0 ? `+${newClientsThisMonth.length} new this month` : "No new this month",
            icon: Users,
            color: "bg-blue-50 text-blue-600",
            subColor: newClientsThisMonth.length > 0 ? "text-green-600" : "text-gray-400",
          },
          {
            label: "Open Quotes",
            value: openQuotes.length,
            sub: newQuotes.length > 0 ? `${newQuotes.length} new, needs action` : "All quotes contacted",
            icon: ClipboardList,
            color: "bg-purple-50 text-purple-600",
            subColor: newQuotes.length > 0 ? "text-orange-600" : "text-gray-400",
          },
          {
            label: "Active Contracts",
            value: activeContracts.length,
            sub: expiringContracts.length > 0 ? `${expiringContracts.length} expiring soon` : "All contracts current",
            icon: FileText,
            color: "bg-green-50 text-green-600",
            subColor: expiringContracts.length > 0 ? "text-orange-600" : "text-gray-400",
          },
          {
            label: "Monthly Revenue",
            value: `R${totalMonthlyRevenue.toLocaleString()}`,
            sub: "From active contracts",
            icon: TrendingUp,
            color: "bg-emerald-50 text-emerald-600",
            subColor: "text-gray-400",
          },
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

      {/* Pending Quotes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-gray-400" /> Pending Quotes
            </span>
            {overdueFollowUp.length > 0 && (
              <Badge className="bg-red-100 text-red-700 text-xs">
                {overdueFollowUp.length} overdue follow-up{overdueFollowUp.length > 1 ? "s" : ""}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {openQuotes.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No open quotes at the moment</p>
          ) : (
            <div className="space-y-3">
              {openQuotes
                .sort((a, b) => {
                  // Sort: overdue first, then by status (new → contacted → quoted)
                  const aOverdue = a.followUpDate && new Date(a.followUpDate) < new Date() ? 0 : 1;
                  const bOverdue = b.followUpDate && new Date(b.followUpDate) < new Date() ? 0 : 1;
                  if (aOverdue !== bOverdue) return aOverdue - bOverdue;
                  const order = { new: 0, contacted: 1, quoted: 2 };
                  return (order[a.status as keyof typeof order] ?? 3) - (order[b.status as keyof typeof order] ?? 3);
                })
                .map(quote => {
                  const cfg = quoteStatusConfig[quote.status] ?? quoteStatusConfig.new;
                  const StatusIcon = cfg.icon;
                  const followUpDue = quote.followUpDate ? new Date(quote.followUpDate) : null;
                  const followUpOverdue = followUpDue && followUpDue < new Date();
                  const daysToFollowUp = followUpDue
                    ? Math.ceil((followUpDue.getTime() - Date.now()) / 86400000)
                    : null;

                  return (
                    <div key={quote.id} className={`border rounded-xl p-3 ${followUpOverdue ? "border-red-200 bg-red-50" : "border-gray-200"}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold truncate">{quote.companyName}</p>
                            <Badge className={`text-xs ${cfg.className}`}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {cfg.label}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {serviceTypeLabel[quote.serviceType] ?? quote.serviceType}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{quote.contactPerson}</p>
                          <p className="text-xs text-gray-400 mt-1 line-clamp-2">{quote.description}</p>
                          {quote.notes && (
                            <p className="text-xs text-indigo-600 mt-1 italic">{quote.notes}</p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          {followUpDue && (
                            <span className={`text-xs font-medium flex items-center gap-1 ${followUpOverdue ? "text-red-600" : "text-gray-500"}`}>
                              <Calendar className="h-3 w-3" />
                              {followUpOverdue
                                ? `${Math.abs(daysToFollowUp!)}d overdue`
                                : daysToFollowUp === 0
                                  ? "Follow up today"
                                  : `Follow up in ${daysToFollowUp}d`}
                            </span>
                          )}
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {quote.phone}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Clients */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-400" /> Recent Clients
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {clients.slice(0, 8).map(client => (
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

        {/* Active Contracts */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-400" /> Active Contracts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeContracts.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No active contracts</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {activeContracts.map(contract => {
                  const client = clients.find(c => c.id === contract.clientId);
                  const daysLeft = contract.endDate
                    ? Math.ceil((new Date(contract.endDate).getTime() - Date.now()) / 86400000)
                    : null;
                  return (
                    <div key={contract.id} className="flex items-center justify-between border rounded-lg px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{client?.name ?? "Unknown Client"}</p>
                        <p className="text-xs text-gray-400 flex items-center gap-1">
                          <Calendar className="h-3 w-3"/>
                          R{parseFloat(contract.monthlyPrice ?? "0").toLocaleString()}/mo
                          {daysLeft !== null && (
                            <span className={daysLeft <= 30 ? "text-orange-500 ml-1" : "ml-1"}>
                              · {daysLeft}d left
                            </span>
                          )}
                        </p>
                      </div>
                      <Badge className={daysLeft !== null && daysLeft <= 30 ? "bg-orange-100 text-orange-800" : "bg-green-100 text-green-800"}>
                        {daysLeft !== null && daysLeft <= 30 ? "Expiring" : "Active"}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Invoice Pipeline */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-gray-400" /> Invoice Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 mb-4">
            {[
              { label: "Sent / Outstanding", count: invoices.filter(i=>i.status==="sent").length, amount: invoices.filter(i=>i.status==="sent").reduce((s,i)=>s+parseFloat(i.total??'0'),0), color: "text-blue-600" },
              { label: "Paid", count: invoices.filter(i=>i.status==="paid").length, amount: invoices.filter(i=>i.status==="paid").reduce((s,i)=>s+parseFloat(i.total??'0'),0), color: "text-green-600" },
              { label: "Overdue", count: invoices.filter(i=>i.status==="overdue").length, amount: invoices.filter(i=>i.status==="overdue").reduce((s,i)=>s+parseFloat(i.total??'0'),0), color: "text-red-600" },
            ].map(({ label, count, amount, color }) => (
              <div key={label} className="text-center border rounded-lg p-3">
                <p className="text-xs text-gray-500">{label}</p>
                <p className={`text-xl font-bold ${color}`}>{count}</p>
                <p className="text-xs text-gray-400">R{amount.toLocaleString()}</p>
              </div>
            ))}
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {invoices.slice(0, 8).map(inv => {
              const client = clients.find(c => c.id === inv.clientId);
              return (
                <div key={inv.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{inv.invoiceNumber}</p>
                    <p className="text-xs text-gray-400">{client?.name ?? "Unknown"}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold">R{parseFloat(inv.total ?? "0").toLocaleString()}</span>
                    <Badge className={
                      inv.status === "paid" ? "bg-green-100 text-green-800" :
                      inv.status === "overdue" ? "bg-red-100 text-red-800" :
                      "bg-blue-100 text-blue-800"
                    }>
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
