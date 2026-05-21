import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Wallet, Search, FileText, Calendar as CalIcon, Building2, PackageCheck,
} from "lucide-react";
import type { PurchaseOrder, Supplier } from "@shared/schema";

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
function bucketFor(daysOld: number): Bucket {
  if (daysOld <= 30) return "current";
  if (daysOld <= 60) return "b30";
  if (daysOld <= 90) return "b60";
  if (daysOld <= 120) return "b90";
  return "b90p";
}

const STATUS_COLOR: Record<string, string> = {
  pending:   "bg-amber-50 text-amber-700 border-amber-200",
  approved:  "bg-blue-50 text-blue-700 border-blue-200",
  sent:      "bg-indigo-50 text-indigo-700 border-indigo-200",
  received:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected:  "bg-rose-50 text-rose-700 border-rose-200",
  cancelled: "bg-gray-100 text-gray-600 border-gray-200",
};

export default function Creditors() {
  const [searchTerm, setSearchTerm] = useState("");
  const [bucketFilter, setBucketFilter] = useState<"all" | Bucket>("all");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");

  const { data: pos = [], isLoading } = useQuery<PurchaseOrder[]>({ queryKey: ["/api/purchase-orders"] });
  const { data: suppliers = [] } = useQuery<Supplier[]>({ queryKey: ["/api/suppliers"] });

  const supplierMap = useMemo(() => new Map(suppliers.map(s => [s.id, s])), [suppliers]);
  const today = new Date();

  // Money we owe = POs that have been sent or received but not yet cancelled/rejected.
  // (No "paid" status on PO; treat all non-terminal POs with totalAmount > 0 as owed.)
  const owed = useMemo(() => {
    return pos
      .filter(p => p.status !== "cancelled" && p.status !== "rejected")
      .map(po => {
        const amount = parseFloat(String(po.totalAmount ?? "0")) || 0;
        const refDate = new Date(po.sentDate ?? po.requestDate ?? po.createdAt ?? today);
        const daysOld = Math.max(0, daysBetween(refDate, today));
        return { po, amount, daysOld, bucket: bucketFor(daysOld) };
      })
      .filter(x => x.amount > 0.001);
  }, [pos]);

  const totalOwed       = owed.reduce((s, x) => s + x.amount, 0);
  const suppliersOwed   = new Set(owed.map(x => x.po.supplierId)).size;
  const pendingApproval = owed.filter(x => x.po.status === "pending").length;
  const awaitingDelivery = owed.filter(x => x.po.status === "sent" || x.po.status === "approved").length;

  const bucketTotals = useMemo(() => {
    const out: Record<Bucket, number> = { current: 0, b30: 0, b60: 0, b90: 0, b90p: 0 };
    for (const x of owed) out[x.bucket] += x.amount;
    return out;
  }, [owed]);

  const perSupplier = useMemo(() => {
    const map = new Map<string, { supplierId: string; balance: number; count: number; oldest: number }>();
    for (const x of owed) {
      const cur = map.get(x.po.supplierId) ?? { supplierId: x.po.supplierId, balance: 0, count: 0, oldest: 0 };
      cur.balance += x.amount;
      cur.count += 1;
      cur.oldest = Math.max(cur.oldest, x.daysOld);
      map.set(x.po.supplierId, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.balance - a.balance);
  }, [owed]);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return owed
      .filter(x => bucketFilter === "all" || x.bucket === bucketFilter)
      .filter(x => supplierFilter === "all" || x.po.supplierId === supplierFilter)
      .filter(x => {
        if (!term) return true;
        const s = supplierMap.get(x.po.supplierId);
        return (
          x.po.poNumber.toLowerCase().includes(term) ||
          (s?.name ?? "").toLowerCase().includes(term)
        );
      })
      .sort((a, b) => b.daysOld - a.daysOld);
  }, [owed, searchTerm, bucketFilter, supplierFilter, supplierMap]);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Creditors" />
        <main className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* KPI tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="Total Owed"          value={fmtR(totalOwed)}              icon={Wallet}        color="text-rose-700 bg-rose-50 border-rose-100" />
            <Kpi label="Suppliers"           value={String(suppliersOwed)}        icon={Building2}     color="text-blue-700 bg-blue-50 border-blue-100" />
            <Kpi label="Pending Approval"    value={String(pendingApproval)}      icon={FileText}      color="text-amber-700 bg-amber-50 border-amber-100" />
            <Kpi label="Awaiting Delivery"   value={String(awaitingDelivery)}     icon={PackageCheck}  color="text-emerald-700 bg-emerald-50 border-emerald-100" />
          </div>

          {/* Aged bands */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Aged creditors</h3>
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
                Showing POs in <b>{BUCKETS.find(b => b.key === bucketFilter)?.label}</b>.{" "}
                <button className="underline" onClick={() => setBucketFilter("all")}>Clear</button>
              </p>
            )}
          </div>

          {/* Two-column */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

            {/* Per-supplier */}
            <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700">Top creditors</h3>
                <p className="text-xs text-gray-400 mt-0.5">Click a supplier to filter the PO list</p>
              </div>
              <div className="max-h-[480px] overflow-y-auto divide-y divide-gray-50">
                {perSupplier.length === 0 ? (
                  <p className="p-6 text-sm text-gray-400 italic">No outstanding purchase orders.</p>
                ) : perSupplier.slice(0, 50).map(p => {
                  const s = supplierMap.get(p.supplierId);
                  const isActive = supplierFilter === p.supplierId;
                  return (
                    <button
                      key={p.supplierId}
                      onClick={() => setSupplierFilter(isActive ? "all" : p.supplierId)}
                      className={`w-full text-left px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-gray-50 ${isActive ? "bg-blue-50" : ""}`}
                      data-testid={`supplier-row-${p.supplierId}`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{s?.name ?? p.supplierId}</p>
                        <p className="text-xs text-gray-500">
                          {p.count} PO{p.count !== 1 ? "s" : ""}
                          {p.oldest > 30 && <span className="text-red-600 ml-2">· oldest {p.oldest}d</span>}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-rose-700 shrink-0">{fmtR(p.balance)}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* PO list */}
            <div className="lg:col-span-3 bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700">Outstanding purchase orders</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {filtered.length} PO{filtered.length !== 1 ? "s" : ""}
                    {supplierFilter !== "all" && supplierMap.get(supplierFilter)?.name && ` · ${supplierMap.get(supplierFilter)!.name}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                    <Input
                      placeholder="Search PO or supplier…"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="pl-8 h-8 text-sm w-56"
                      data-testid="search-creditors"
                    />
                  </div>
                  <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                    <SelectTrigger className="h-8 text-xs w-40" data-testid="filter-supplier"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All suppliers</SelectItem>
                      {perSupplier.map(p => (
                        <SelectItem key={p.supplierId} value={p.supplierId}>
                          {supplierMap.get(p.supplierId)?.name ?? p.supplierId}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {isLoading ? (
                <div className="p-6 text-sm text-gray-400">Loading…</div>
              ) : filtered.length === 0 ? (
                <div className="p-10 text-center text-sm text-gray-400">No POs match the current filters.</div>
              ) : (
                <div className="max-h-[480px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="text-left px-4 py-2">PO</th>
                        <th className="text-left px-4 py-2">Supplier</th>
                        <th className="text-left px-4 py-2">Status</th>
                        <th className="text-left px-4 py-2">Date</th>
                        <th className="text-right px-4 py-2">Amount</th>
                        <th className="text-left px-4 py-2">Aged</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filtered.map(x => {
                        const s = supplierMap.get(x.po.supplierId);
                        const refDate = new Date(x.po.sentDate ?? x.po.requestDate ?? x.po.createdAt ?? today);
                        return (
                          <tr key={x.po.id} className="hover:bg-gray-50" data-testid={`creditor-row-${x.po.id}`}>
                            <td className="px-4 py-2 font-mono text-xs text-blue-700">{x.po.poNumber}</td>
                            <td className="px-4 py-2 text-gray-800">{s?.name ?? "—"}</td>
                            <td className="px-4 py-2">
                              <Badge variant="outline" className={STATUS_COLOR[x.po.status] ?? "bg-gray-50"}>
                                {x.po.status}
                              </Badge>
                            </td>
                            <td className="px-4 py-2 text-gray-600 flex items-center gap-1.5">
                              <CalIcon className="h-3 w-3 text-gray-400" />
                              {refDate.toLocaleDateString()}
                            </td>
                            <td className="px-4 py-2 text-right font-semibold text-rose-700">{fmtR(x.amount)}</td>
                            <td className="px-4 py-2 text-gray-600">{x.daysOld}d</td>
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
