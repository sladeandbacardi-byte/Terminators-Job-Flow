import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  HandCoins, Search, AlertTriangle, CheckCircle2, FileText,
  TrendingDown, Mail, Calendar as CalIcon, Ban, RefreshCw, ShieldAlert,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Invoice, Client } from "@shared/schema";

const fmtR = (n: number) =>
  `R${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")}`;

type Bucket = "current" | "b30" | "b60" | "b90" | "b90p";
const BUCKETS: { key: Bucket; label: string; cls: string }[] = [
  { key: "current", label: "Current (0–30)",  cls: "bg-emerald-50 border-emerald-200 text-emerald-700" },
  { key: "b30",     label: "31–60 days",      cls: "bg-amber-50 border-amber-200 text-amber-700" },
  { key: "b60",     label: "61–90 days",      cls: "bg-orange-50 border-orange-200 text-orange-700" },
  { key: "b90",     label: "91–120 days",     cls: "bg-red-50 border-red-200 text-red-700" },
  { key: "b90p",    label: "120+ days",       cls: "bg-red-100 border-red-300 text-red-800" },
];

function daysBetween(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function bucketFor(daysOverdue: number): Bucket {
  if (daysOverdue <= 30) return "current";
  if (daysOverdue <= 60) return "b30";
  if (daysOverdue <= 90) return "b60";
  if (daysOverdue <= 120) return "b90";
  return "b90p";
}

export default function Debtors() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [bucketFilter, setBucketFilter] = useState<"all" | Bucket>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [suspendDialogClient, setSuspendDialogClient] = useState<Client | null>(null);
  const [suspendReason, setSuspendReason] = useState("");

  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({ queryKey: ["/api/invoices"] });
  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["/api/clients"] });

  const clientMap = useMemo(() => new Map(clients.map(c => [c.id, c])), [clients]);

  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  // Outstanding = total - paid, and only invoices not paid/cancelled
  const outstandingInvoices = useMemo(() => {
    return invoices
      .filter(i => i.status !== "paid" && i.status !== "cancelled")
      .map(inv => {
        const total = parseFloat(String(inv.total)) || 0;
        const paid  = parseFloat(String(inv.paidAmount ?? "0")) || 0;
        const outstanding = +(total - paid).toFixed(2);
        const due = new Date(inv.dueDate);
        const daysOverdue = Math.max(0, daysBetween(due, today));
        return { inv, outstanding, daysOverdue, bucket: bucketFor(daysOverdue) };
      })
      .filter(x => x.outstanding > 0.001);
  }, [invoices]);

  // KPI tiles
  const totalOutstanding = outstandingInvoices.reduce((s, x) => s + x.outstanding, 0);
  const overdueAmount    = outstandingInvoices.filter(x => x.daysOverdue > 0).reduce((s, x) => s + x.outstanding, 0);
  const clientsWithDebt  = new Set(outstandingInvoices.map(x => x.inv.clientId)).size;

  const salesThisMonth = invoices
    .filter(i => new Date(i.issueDate) >= monthStart)
    .reduce((s, i) => s + parseFloat(String(i.total)), 0);
  const collectedThisMonth = invoices
    .filter(i => new Date(i.issueDate) >= monthStart && i.status === "paid")
    .reduce((s, i) => s + parseFloat(String(i.total)), 0);
  const collectedPct = salesThisMonth > 0 ? Math.round((collectedThisMonth / salesThisMonth) * 100) : 0;

  // Aged-bucket totals
  const bucketTotals = useMemo(() => {
    const out: Record<Bucket, number> = { current: 0, b30: 0, b60: 0, b90: 0, b90p: 0 };
    for (const x of outstandingInvoices) out[x.bucket] += x.outstanding;
    return out;
  }, [outstandingInvoices]);

  // Per-client rollup
  const perClient = useMemo(() => {
    const map = new Map<string, { clientId: string; balance: number; count: number; oldest: number }>();
    for (const x of outstandingInvoices) {
      const cur = map.get(x.inv.clientId) ?? { clientId: x.inv.clientId, balance: 0, count: 0, oldest: 0 };
      cur.balance += x.outstanding;
      cur.count += 1;
      cur.oldest = Math.max(cur.oldest, x.daysOverdue);
      map.set(x.inv.clientId, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.balance - a.balance);
  }, [outstandingInvoices]);

  // Filtered invoice list
  const filteredInvoices = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return outstandingInvoices
      .filter(x => bucketFilter === "all" || x.bucket === bucketFilter)
      .filter(x => clientFilter === "all" || x.inv.clientId === clientFilter)
      .filter(x => {
        if (!term) return true;
        const c = clientMap.get(x.inv.clientId);
        return (
          x.inv.invoiceNumber.toLowerCase().includes(term) ||
          (c?.name ?? "").toLowerCase().includes(term)
        );
      })
      .sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [outstandingInvoices, searchTerm, bucketFilter, clientFilter, clientMap]);

  const markPaid = useMutation({
    mutationFn: async (invoice: typeof outstandingInvoices[number]) => {
      const r = await apiRequest("PUT", `/api/invoices/${invoice.inv.id}`, {
        status: "paid",
        paidAmount: invoice.inv.total,
        paymentDate: new Date().toISOString(),
      });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Invoice marked paid" });
    },
    onError: () => toast({ title: "Could not update invoice", variant: "destructive" }),
  });

  const suspendMut = useMutation({
    mutationFn: async ({ clientId }: { clientId: string }) => {
      const r = await apiRequest("PUT", `/api/clients/${clientId}`, { status: "suspended" });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setSuspendDialogClient(null);
      setSuspendReason("");
      toast({ title: "Account suspended", description: "Client account has been suspended." });
    },
    onError: () => toast({ title: "Failed to suspend account", variant: "destructive" }),
  });

  const reactivateMut = useMutation({
    mutationFn: async (clientId: string) => {
      const r = await apiRequest("PUT", `/api/clients/${clientId}`, { status: "active" });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Account reactivated", description: "Client account is now active." });
    },
    onError: () => toast({ title: "Failed to reactivate account", variant: "destructive" }),
  });

  const suspendedClients = clients.filter(c => c.status === "suspended");

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Debtors" />
        <main className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* KPI tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="Total Outstanding" value={fmtR(totalOutstanding)} icon={HandCoins}      color="text-rose-600 bg-rose-50 border-rose-100" />
            <Kpi label="Overdue"           value={fmtR(overdueAmount)}    icon={AlertTriangle}  color="text-red-700 bg-red-50 border-red-100" />
            <Kpi label="Clients in Debt"   value={String(clientsWithDebt)} icon={FileText}      color="text-blue-700 bg-blue-50 border-blue-100" />
            <Kpi label="Collected / Month" value={`${collectedPct}%`}      icon={TrendingDown}  color="text-emerald-700 bg-emerald-50 border-emerald-100" />
          </div>

          {/* Aged debt bands */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Aged debt</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {BUCKETS.map(b => (
                <button
                  key={b.key}
                  onClick={() => setBucketFilter(bucketFilter === b.key ? "all" : b.key)}
                  className={`border rounded-lg px-3 py-2.5 text-left transition ${b.cls} ${bucketFilter === b.key ? "ring-2 ring-offset-1 ring-current" : "hover:opacity-90"}`}
                  data-testid={`bucket-${b.key}`}
                >
                  <p className="text-[11px] uppercase tracking-wide opacity-70">{b.label}</p>
                  <p className="text-lg font-bold mt-0.5">{fmtR(bucketTotals[b.key])}</p>
                </button>
              ))}
            </div>
            {bucketFilter !== "all" && (
              <p className="text-xs text-gray-500 mt-2">
                Showing invoices in <b>{BUCKETS.find(b => b.key === bucketFilter)?.label}</b>.{" "}
                <button className="underline" onClick={() => setBucketFilter("all")}>Clear</button>
              </p>
            )}
          </div>

          {/* Two-column: per-client + outstanding invoices */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

            {/* Per-client rollup */}
            <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700">Top debtors</h3>
                <p className="text-xs text-gray-400 mt-0.5">Click a client to filter the invoice list</p>
              </div>
              <div className="max-h-[480px] overflow-y-auto divide-y divide-gray-50">
                {perClient.length === 0 ? (
                  <p className="p-6 text-sm text-gray-400 italic">No outstanding balances.</p>
                ) : perClient.slice(0, 50).map(p => {
                  const c = clientMap.get(p.clientId);
                  const isActive = clientFilter === p.clientId;
                  const isSuspended = c?.status === "suspended";
                  return (
                    <div
                      key={p.clientId}
                      className={`px-4 py-2.5 ${isActive ? "bg-blue-50" : isSuspended ? "bg-red-50" : ""}`}
                      data-testid={`client-row-${p.clientId}`}
                    >
                      <button
                        onClick={() => setClientFilter(isActive ? "all" : p.clientId)}
                        className="w-full text-left flex items-center justify-between gap-3 hover:opacity-80"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            {isSuspended && <Ban className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />}
                            <p className="text-sm font-medium text-gray-900 truncate">{c?.name ?? p.clientId}</p>
                          </div>
                          <p className="text-xs text-gray-500">
                            {p.count} invoice{p.count !== 1 ? "s" : ""}
                            {p.oldest > 0 && <span className="text-red-600 ml-2">· oldest {p.oldest}d</span>}
                            {isSuspended && <span className="text-red-600 ml-2 font-semibold">· SUSPENDED</span>}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-rose-700 shrink-0">{fmtR(p.balance)}</p>
                      </button>
                      {c && (
                        <div className="mt-1.5 flex gap-1.5">
                          {isSuspended ? (
                            <button
                              onClick={() => reactivateMut.mutate(p.clientId)}
                              disabled={reactivateMut.isPending}
                              className="text-[11px] flex items-center gap-1 text-green-700 bg-green-50 border border-green-200 rounded px-2 py-0.5 hover:bg-green-100 transition"
                            >
                              <RefreshCw className="h-2.5 w-2.5" /> Reactivate
                            </button>
                          ) : (
                            <button
                              onClick={() => { setSuspendDialogClient(c); setSuspendReason(""); }}
                              className="text-[11px] flex items-center gap-1 text-red-700 bg-red-50 border border-red-200 rounded px-2 py-0.5 hover:bg-red-100 transition"
                            >
                              <Ban className="h-2.5 w-2.5" /> Suspend
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Invoice list */}
            <div className="lg:col-span-3 bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700">Outstanding invoices</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? "s" : ""}
                    {clientFilter !== "all" && clientMap.get(clientFilter)?.name && ` · ${clientMap.get(clientFilter)!.name}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                    <Input
                      placeholder="Search invoice or client…"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="pl-8 h-8 text-sm w-56"
                      data-testid="search-debtors"
                    />
                  </div>
                  <Select value={clientFilter} onValueChange={setClientFilter}>
                    <SelectTrigger className="h-8 text-xs w-40" data-testid="filter-client"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All clients</SelectItem>
                      {perClient.map(p => (
                        <SelectItem key={p.clientId} value={p.clientId}>
                          {clientMap.get(p.clientId)?.name ?? p.clientId}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {isLoading ? (
                <div className="p-6 text-sm text-gray-400">Loading…</div>
              ) : filteredInvoices.length === 0 ? (
                <div className="p-10 text-center text-sm text-gray-400">No invoices match the current filters.</div>
              ) : (
                <div className="max-h-[480px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="text-left px-4 py-2">Invoice</th>
                        <th className="text-left px-4 py-2">Client</th>
                        <th className="text-left px-4 py-2">Due</th>
                        <th className="text-right px-4 py-2">Outstanding</th>
                        <th className="text-left px-4 py-2">Aged</th>
                        <th className="text-right px-4 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredInvoices.map(x => {
                        const c = clientMap.get(x.inv.clientId);
                        const overdueLbl = x.daysOverdue > 0 ? `${x.daysOverdue}d overdue` : "Current";
                        return (
                          <tr key={x.inv.id} className="hover:bg-gray-50" data-testid={`debtor-row-${x.inv.id}`}>
                            <td className="px-4 py-2 font-mono text-xs text-blue-700">{x.inv.invoiceNumber}</td>
                            <td className="px-4 py-2 text-gray-800">{c?.name ?? "—"}</td>
                            <td className="px-4 py-2 text-gray-600 flex items-center gap-1.5">
                              <CalIcon className="h-3 w-3 text-gray-400" />
                              {new Date(x.inv.dueDate).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-2 text-right font-semibold text-rose-700">{fmtR(x.outstanding)}</td>
                            <td className="px-4 py-2">
                              <Badge
                                variant="outline"
                                className={
                                  x.daysOverdue === 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : x.daysOverdue <= 30 ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : x.daysOverdue <= 60 ? "bg-orange-50 text-orange-700 border-orange-200"
                                  : "bg-red-50 text-red-700 border-red-200"
                                }
                              >
                                {overdueLbl}
                              </Badge>
                            </td>
                            <td className="px-4 py-2 text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => markPaid.mutate(x)}
                                disabled={markPaid.isPending}
                                data-testid={`button-mark-paid-${x.inv.id}`}
                              >
                                <CheckCircle2 className="h-3 w-3 mr-1" /> Mark Paid
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Suspend Account Dialog */}
      <Dialog open={!!suspendDialogClient} onOpenChange={open => { if (!open) { setSuspendDialogClient(null); setSuspendReason(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <ShieldAlert className="h-5 w-5" /> Suspend Account
            </DialogTitle>
            <DialogDescription>
              This will mark <strong>{suspendDialogClient?.name}</strong> as suspended.
              Service coordinators and sales staff will see this status.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              <p className="font-medium">Outstanding balance: {fmtR(
                outstandingInvoices
                  .filter(x => x.inv.clientId === suspendDialogClient?.id)
                  .reduce((s, x) => s + x.outstanding, 0)
              )}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">
                Reason for suspension (optional)
              </label>
              <Textarea
                placeholder="e.g. Non-payment of invoices over 90 days…"
                value={suspendReason}
                onChange={e => setSuspendReason(e.target.value)}
                rows={3}
                className="text-sm"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setSuspendDialogClient(null); setSuspendReason(""); }}>
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white gap-1.5"
              onClick={() => suspendMut.mutate({ clientId: suspendDialogClient!.id })}
              disabled={suspendMut.isPending}
            >
              <Ban className="h-4 w-4" />
              {suspendMut.isPending ? "Suspending…" : "Suspend Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({ label, value, icon: Icon, color }: { label: string; value: string; icon: any; color: string }) {
  return (
    <div className={`border rounded-xl p-4 flex items-start justify-between ${color}`}>
      <div>
        <p className="text-[11px] uppercase tracking-wide opacity-70 font-semibold">{label}</p>
        <p className="text-xl font-bold mt-1">{value}</p>
      </div>
      <Icon className="h-5 w-5 opacity-60" />
    </div>
  );
}
