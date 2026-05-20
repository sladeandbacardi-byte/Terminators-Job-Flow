import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  TrendingUp, TrendingDown, ShoppingCart, Building2, CheckCircle,
  AlertTriangle, DollarSign, Percent, FileText, Clock, RefreshCw,
  ChevronRight,
} from "lucide-react";
import type { Client, RentalContract, Invoice, PurchaseOrder, Supplier } from "@shared/schema";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return `R${Math.round(n).toLocaleString("en-ZA")}`;
}

function fmtDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SnapCard({
  label, value, sub, icon: Icon, color, valueColor,
}: {
  label: string; value: string; sub: string;
  icon: React.ElementType; color: string; valueColor: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-gray-500 mb-0.5">{label}</p>
            <p className={`text-xl font-bold leading-tight ${valueColor}`}>{value}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>
          </div>
          <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ml-2 ${color}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SectionHeader({
  title, href, linkLabel,
}: {
  title: string; href: string; linkLabel: string;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      <Link href={href}>
        <Button variant="outline" size="sm" className="text-xs h-7 px-2.5">
          {linkLabel} <ChevronRight className="h-3 w-3 ml-1" />
        </Button>
      </Link>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AccountsDashboard() {
  const { data: clients      = [] } = useQuery<Client[]>       ({ queryKey: ["/api/clients"]         });
  const { data: contracts    = [] } = useQuery<RentalContract[]>({ queryKey: ["/api/contracts"]      });
  const { data: invoices     = [] } = useQuery<Invoice[]>      ({ queryKey: ["/api/invoices"]        });
  const { data: purchaseOrders=[]}  = useQuery<PurchaseOrder[]>({ queryKey: ["/api/purchase-orders"] });
  const { data: suppliers    = [] } = useQuery<Supplier[]>     ({ queryKey: ["/api/suppliers"]       });

  // ── Invoice buckets ──
  const paid        = invoices.filter(i => i.status === "paid");
  const outstanding = invoices.filter(i => i.status === "sent");
  const overdue     = invoices.filter(i => i.status === "overdue");

  const totalPaid        = paid.reduce((s, i)        => s + parseFloat(i.total ?? "0"), 0);
  const totalOutstanding = outstanding.reduce((s, i) => s + parseFloat(i.total ?? "0"), 0);
  const totalOverdue     = overdue.reduce((s, i)     => s + parseFloat(i.total ?? "0"), 0);
  const totalDebtors     = totalOutstanding + totalOverdue;
  const totalRevenue     = totalPaid + totalOutstanding + totalOverdue;

  const now        = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const salesMonth = invoices
    .filter(i => new Date(i.issueDate) >= monthStart)
    .reduce((s, i) => s + parseFloat(i.total ?? "0"), 0);
  const paidMonth  = invoices
    .filter(i => new Date(i.issueDate) >= monthStart && i.status === "paid")
    .reduce((s, i) => s + parseFloat(i.total ?? "0"), 0);
  const collectionRate = salesMonth > 0 ? Math.round((paidMonth / salesMonth) * 100) : 0;

  // ── PO / creditor buckets ──
  const owedStatuses = ["pending", "approved", "sent"];
  const creditorPOs  = purchaseOrders.filter(po => owedStatuses.includes(po.status));
  const receivedPOs  = purchaseOrders.filter(po => po.status === "received");
  const pendingApprovalPOs = purchaseOrders.filter(po => po.status === "pending");
  const totalOwed    = creditorPOs.reduce((s, po) => s + parseFloat(po.totalAmount ?? "0"), 0);
  const totalPOPaid  = receivedPOs.reduce((s, po) => s + parseFloat(po.totalAmount ?? "0"), 0);

  const creditorsBySupplier = suppliers
    .map(sup => {
      const pos     = creditorPOs.filter(po => po.supplierId === sup.id);
      const totalDue = pos.reduce((s, po) => s + parseFloat(po.totalAmount ?? "0"), 0);
      return { supplier: sup, pos, totalDue };
    })
    .filter(e => e.pos.length > 0)
    .sort((a, b) => b.totalDue - a.totalDue);

  // ── Contracts ──
  const activeContracts   = contracts.filter(c => c.isActive === true);
  const monthlyContractValue = activeContracts.reduce((s, c) => s + parseFloat(c.monthlyPrice ?? "0"), 0);
  const thirtyDays        = new Date(now.getTime() + 30 * 86_400_000);
  const expiringSoon      = activeContracts.filter(c => {
    if (!c.endDate) return false;
    const end = new Date(c.endDate);
    return end >= now && end <= thirtyDays;
  });

  // ── Alerts ──
  const LARGE_DEBTOR = 5000;
  const largeDebtors = [...overdue, ...outstanding].filter(
    i => parseFloat(i.total ?? "0") >= LARGE_DEBTOR,
  );

  const alerts: { msg: string; color: string; icon: React.ElementType }[] = [];
  if (overdue.length > 0)
    alerts.push({ msg: `${overdue.length} overdue invoice${overdue.length > 1 ? "s" : ""} — ${fmt(totalOverdue)} outstanding`, color: "border-red-200 bg-red-50 text-red-800", icon: AlertTriangle });
  if (largeDebtors.length > 0)
    alerts.push({ msg: `${largeDebtors.length} debtor balance${largeDebtors.length > 1 ? "s" : ""} above R5 000`, color: "border-orange-200 bg-orange-50 text-orange-800", icon: TrendingDown });
  if (pendingApprovalPOs.length > 0)
    alerts.push({ msg: `${pendingApprovalPOs.length} purchase order${pendingApprovalPOs.length > 1 ? "s" : ""} awaiting approval`, color: "border-amber-200 bg-amber-50 text-amber-800", icon: ShoppingCart });
  if (creditorsBySupplier.length > 0)
    alerts.push({ msg: `${creditorsBySupplier.length} supplier${creditorsBySupplier.length > 1 ? "s" : ""} with outstanding payments — ${fmt(totalOwed)} owed`, color: "border-purple-200 bg-purple-50 text-purple-800", icon: Building2 });
  if (expiringSoon.length > 0)
    alerts.push({ msg: `${expiringSoon.length} contract${expiringSoon.length > 1 ? "s" : ""} expiring within 30 days`, color: "border-blue-200 bg-blue-50 text-blue-800", icon: Clock });
  if (salesMonth > 0 && collectionRate < 60)
    alerts.push({ msg: `Low collection rate — only ${collectionRate}% of revenue collected this month`, color: "border-red-200 bg-red-50 text-red-800", icon: Percent });

  // ── Lists (capped at 5) ──
  const topDebtors      = [...overdue, ...outstanding]
    .sort((a, b) => parseFloat(b.total ?? "0") - parseFloat(a.total ?? "0"))
    .slice(0, 5);
  const topCreditors    = creditorsBySupplier.slice(0, 5);
  const recentInvoices  = [...invoices]
    .sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime())
    .slice(0, 8);

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      paid:     "bg-green-100 text-green-800",
      overdue:  "bg-red-100 text-red-800",
      sent:     "bg-amber-100 text-amber-800",
      draft:    "bg-gray-100 text-gray-600",
      pending:  "bg-amber-100 text-amber-800",
      approved: "bg-blue-100 text-blue-800",
      received: "bg-green-100 text-green-800",
    };
    return map[status] ?? "bg-gray-100 text-gray-600";
  };

  return (
    <div className="space-y-6">

      {/* ── 1. Finance Snapshot ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <SnapCard label="Debtors Outstanding" value={fmt(totalDebtors)}    sub={`${outstanding.length + overdue.length} invoices`}        icon={TrendingDown}  color="bg-red-50 text-red-500"    valueColor="text-red-600" />
        <SnapCard label="Revenue This Month"   value={fmt(salesMonth)}       sub={`${invoices.filter(i => new Date(i.issueDate) >= monthStart).length} invoices issued`} icon={DollarSign} color="bg-blue-50 text-blue-500"   valueColor="text-blue-600" />
        <SnapCard label="Collection Rate"     value={`${collectionRate}%`}  sub="of revenue collected"                                      icon={Percent}       color="bg-green-50 text-green-500" valueColor={collectionRate >= 75 ? "text-green-600" : "text-amber-600"} />
        <SnapCard label="Outstanding POs"     value={fmt(totalOwed)}        sub={`${creditorPOs.length} purchase orders`}                   icon={ShoppingCart}  color="bg-orange-50 text-orange-500" valueColor="text-orange-600" />
        <SnapCard label="Suppliers Owed"      value={`${creditorsBySupplier.length}`} sub="with open balances"                             icon={Building2}     color="bg-purple-50 text-purple-500" valueColor="text-purple-600" />
        <SnapCard label="POs Received / Paid" value={fmt(totalPOPaid)}      sub={`${receivedPOs.length} orders fulfilled`}                  icon={CheckCircle}   color="bg-teal-50 text-teal-500"   valueColor="text-teal-600" />
      </div>

      {/* ── 2. Revenue Breakdown ────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-700">Revenue Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {totalRevenue > 0 ? (
            <div>
              <div className="flex rounded-full overflow-hidden h-4 mb-3 gap-px">
                {totalPaid > 0 && (
                  <div className="bg-green-500 rounded-l-full" style={{ width: `${(totalPaid / totalRevenue) * 100}%` }}
                    title={`Paid: ${fmt(totalPaid)}`} />
                )}
                {totalOutstanding > 0 && (
                  <div className="bg-amber-400" style={{ width: `${(totalOutstanding / totalRevenue) * 100}%` }}
                    title={`Outstanding: ${fmt(totalOutstanding)}`} />
                )}
                {totalOverdue > 0 && (
                  <div className="bg-red-400 rounded-r-full" style={{ width: `${(totalOverdue / totalRevenue) * 100}%` }}
                    title={`Overdue: ${fmt(totalOverdue)}`} />
                )}
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-gray-600">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-green-500 rounded-full inline-block"/>Paid {fmt(totalPaid)}</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-amber-400 rounded-full inline-block"/>Outstanding {fmt(totalOutstanding)}</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-red-400 rounded-full inline-block"/>Overdue {fmt(totalOverdue)}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-3">No invoice data available</p>
          )}
        </CardContent>
      </Card>

      {/* ── 3. Finance Alerts ───────────────────────────────────────────────── */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-700">Finance Alerts</h3>
          {alerts.map((a, i) => {
            const Icon = a.icon;
            return (
              <div key={i} className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm font-medium ${a.color}`}>
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span>{a.msg}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 4 & 5. Debtors + Creditors (side by side on large screens) ─────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Debtors Summary */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <SectionHeader title="Debtors Summary" href="/invoices" linkLabel="View All Debtors" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {topDebtors.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No outstanding invoices</p>
            ) : (
              <div className="space-y-2">
                {topDebtors.map(inv => {
                  const client = clients.find(c => c.id === inv.clientId);
                  return (
                    <div key={inv.id} className="flex items-center justify-between border rounded-lg px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{client?.name ?? "Unknown"}</p>
                        <p className="text-xs text-gray-400">
                          {inv.invoiceNumber}
                          {inv.dueDate ? ` · Due ${fmtDate(inv.dueDate)}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                        <span className="text-sm font-bold">{fmt(parseFloat(inv.total ?? "0"))}</span>
                        <Badge className={`text-xs ${statusBadge(inv.status)}`}>{inv.status}</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Creditors Summary */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <SectionHeader title="Creditors Summary" href="/purchase-orders" linkLabel="View All Creditors" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {topCreditors.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No outstanding supplier balances</p>
            ) : (
              <div className="space-y-2">
                {topCreditors.map(({ supplier, pos, totalDue }) => (
                  <div key={supplier.id} className="border rounded-lg px-3 py-2">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium truncate">{supplier.name}</p>
                      <span className="text-sm font-bold text-orange-600 ml-2 flex-shrink-0">{fmt(totalDue)}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {pos.map(po => (
                        <span key={po.id} className="inline-flex items-center gap-1 text-xs">
                          <span className="text-gray-400">{po.poNumber}</span>
                          <Badge className={`text-xs py-0 px-1.5 ${statusBadge(po.status)}`}>{po.status}</Badge>
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

      {/* ── 6. Recurring Revenue / Active Contracts ─────────────────────────── */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <SectionHeader title="Recurring Revenue — Active Contracts" href="/contracts" linkLabel="View All Contracts" />
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-green-50 rounded-lg p-3">
              <p className="text-xl font-bold text-green-600">{fmt(monthlyContractValue)}</p>
              <p className="text-xs text-gray-500 mt-0.5">Monthly recurring revenue</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-xl font-bold text-blue-600">{activeContracts.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Active contracts</p>
            </div>
            <div className={`${expiringSoon.length > 0 ? "bg-amber-50" : "bg-gray-50"} rounded-lg p-3`}>
              <p className={`text-xl font-bold ${expiringSoon.length > 0 ? "text-amber-600" : "text-gray-400"}`}>{expiringSoon.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Expiring within 30 days</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── 7. Recent Invoices ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <SectionHeader title="Recent Invoices" href="/invoices" linkLabel="View All Invoices" />
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {recentInvoices.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No invoices yet</p>
          ) : (
            <div className="divide-y">
              {recentInvoices.map(inv => {
                const client = clients.find(c => c.id === inv.clientId);
                return (
                  <div key={inv.id} className="flex items-center justify-between py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{inv.invoiceNumber}</p>
                      <p className="text-xs text-gray-400">
                        {client?.name ?? "Unknown"}
                        {inv.issueDate ? ` · ${fmtDate(inv.issueDate)}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 ml-2 flex-shrink-0">
                      <span className="text-sm font-semibold">{fmt(parseFloat(inv.total ?? "0"))}</span>
                      <Badge className={`text-xs ${statusBadge(inv.status)}`}>{inv.status}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
