import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus, Search, Pencil, Trash2, Receipt, Filter, CalendarDays,
  CheckCircle2, Clock, AlertTriangle, TrendingDown,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Expense, Department } from "@shared/schema";
import { EXPENSE_CATEGORIES } from "@shared/schema";
import { FinanceBreadcrumb } from "@/components/layout/finance-breadcrumb";

const fmtR = (n: number) => `R${Math.round(n).toLocaleString("en-ZA")}`;

const STATUS_STYLES: Record<string, string> = {
  unpaid:    "bg-red-50 text-red-700 border-red-200",
  paid:      "bg-emerald-50 text-emerald-700 border-emerald-200",
  part_paid: "bg-amber-50 text-amber-700 border-amber-200",
};
const STATUS_LABELS: Record<string, string> = {
  unpaid: "Unpaid", paid: "Paid", part_paid: "Part Paid",
};

const EMPTY_FORM = {
  date: format(new Date(), "yyyy-MM-dd"),
  supplier: "",
  category: "Other" as string,
  description: "",
  amount: "",
  vatIncluded: false,
  departmentId: "",
  paymentStatus: "unpaid" as string,
  notes: "",
};

export default function Expenses() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState(format(new Date(), "yyyy-MM"));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: expenses = [], isLoading } = useQuery<Expense[]>({ queryKey: ["/api/expenses"] });
  const { data: departments = [] } = useQuery<Department[]>({ queryKey: ["/api/departments"] });

  const filtered = useMemo(() => {
    return expenses.filter(e => {
      if (monthFilter && !e.date.startsWith(monthFilter)) return false;
      if (catFilter !== "all" && e.category !== catFilter) return false;
      if (statusFilter !== "all" && e.paymentStatus !== statusFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!e.supplier.toLowerCase().includes(s) &&
            !e.description.toLowerCase().includes(s) &&
            !e.category.toLowerCase().includes(s)) return false;
      }
      return true;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [expenses, monthFilter, catFilter, statusFilter, search]);

  const totalFiltered     = filtered.reduce((s, e) => s + parseFloat(String(e.amount)), 0);
  const paidFiltered      = filtered.filter(e => e.paymentStatus === "paid").reduce((s, e) => s + parseFloat(String(e.amount)), 0);
  const unpaidFiltered    = filtered.filter(e => e.paymentStatus === "unpaid").reduce((s, e) => s + parseFloat(String(e.amount)), 0);

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, date: format(new Date(), "yyyy-MM-dd") });
    setDialogOpen(true);
  };

  const openEdit = (e: Expense) => {
    setEditingId(e.id);
    setForm({
      date: e.date,
      supplier: e.supplier,
      category: e.category,
      description: e.description,
      amount: String(e.amount),
      vatIncluded: e.vatIncluded,
      departmentId: e.departmentId ?? "",
      paymentStatus: e.paymentStatus,
      notes: e.notes ?? "",
    });
    setDialogOpen(true);
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        amount: parseFloat(form.amount) || 0,
        departmentId: form.departmentId || null,
        notes: form.notes || null,
      };
      if (editingId) {
        const r = await apiRequest("PUT", `/api/expenses/${editingId}`, payload);
        return r.json();
      } else {
        const r = await apiRequest("POST", "/api/expenses", payload);
        return r.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      setDialogOpen(false);
      toast({ title: editingId ? "Expense updated" : "Expense captured" });
    },
    onError: (e: any) => toast({ title: "Failed to save expense", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/expenses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      setDeleteId(null);
      toast({ title: "Expense deleted" });
    },
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  const f = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [field]: e.target.value }));

  return (
      <>
        <div className="p-6 pb-20 lg:pb-6 space-y-5">
          <div>
            <FinanceBreadcrumb section="Expenses" current="Expense Capture" />
            <h1 className="text-3xl font-bold text-gray-900" data-testid="page-title">Expense Capture</h1>
            <p className="text-sm text-gray-600 mt-1">Capture and manage business expenses</p>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-start gap-3">
              <div className="p-2 bg-gray-100 rounded-lg"><TrendingDown className="h-4 w-4 text-gray-600" /></div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">Total (filtered)</p>
                <p className="text-xl font-bold text-gray-900">{fmtR(totalFiltered)}</p>
              </div>
            </div>
            <div className="bg-white border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
              <div className="p-2 bg-emerald-50 rounded-lg"><CheckCircle2 className="h-4 w-4 text-emerald-600" /></div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-emerald-500 font-semibold">Paid</p>
                <p className="text-xl font-bold text-emerald-700">{fmtR(paidFiltered)}</p>
              </div>
            </div>
            <div className="bg-white border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <div className="p-2 bg-red-50 rounded-lg"><AlertTriangle className="h-4 w-4 text-red-500" /></div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-red-400 font-semibold">Unpaid</p>
                <p className="text-xl font-bold text-red-700">{fmtR(unpaidFiltered)}</p>
              </div>
            </div>
          </div>

          {/* Filters + Add button */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <div className="flex flex-wrap gap-2 items-center">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <Input
                    placeholder="Search expenses…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-8 h-8 text-sm w-48"
                  />
                </div>
                <Input
                  type="month"
                  value={monthFilter}
                  onChange={e => setMonthFilter(e.target.value)}
                  className="h-8 text-sm w-36"
                />
                <Select value={catFilter} onValueChange={setCatFilter}>
                  <SelectTrigger className="h-8 text-xs w-44"><SelectValue placeholder="All categories" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {EXPENSE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-8 text-xs w-32"><SelectValue placeholder="All statuses" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="unpaid">Unpaid</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="part_paid">Part Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={openAdd} className="bg-green-600 hover:bg-green-700 text-white gap-1.5 h-8 text-sm shrink-0">
                <Plus className="h-3.5 w-3.5" /> Capture Expense
              </Button>
            </div>
          </div>

          {/* Expenses table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {isLoading ? (
              <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="p-10 text-center">
                <Receipt className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                <p className="text-sm text-gray-400">No expenses found for the selected filters.</p>
                <Button onClick={openAdd} variant="outline" className="mt-3 gap-1.5 text-sm">
                  <Plus className="h-3.5 w-3.5" /> Capture first expense
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="text-left px-4 py-2.5">Date</th>
                      <th className="text-left px-4 py-2.5">Supplier</th>
                      <th className="text-left px-4 py-2.5">Category</th>
                      <th className="text-left px-4 py-2.5">Description</th>
                      <th className="text-right px-4 py-2.5">Amount</th>
                      <th className="text-center px-4 py-2.5">VAT</th>
                      <th className="text-left px-4 py-2.5">Status</th>
                      <th className="text-left px-4 py-2.5">Dept</th>
                      <th className="px-4 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filtered.map(e => {
                      const dept = departments.find(d => d.id === e.departmentId);
                      return (
                        <tr key={e.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <CalendarDays className="h-3.5 w-3.5 text-gray-300" />
                              {e.date}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 font-medium text-gray-900 max-w-[140px] truncate">{e.supplier}</td>
                          <td className="px-4 py-2.5">
                            <Badge variant="outline" className="text-[11px] whitespace-nowrap">{e.category}</Badge>
                          </td>
                          <td className="px-4 py-2.5 text-gray-600 max-w-[200px] truncate">{e.description}</td>
                          <td className="px-4 py-2.5 text-right font-semibold text-gray-900 whitespace-nowrap">{fmtR(parseFloat(String(e.amount)))}</td>
                          <td className="px-4 py-2.5 text-center">
                            {e.vatIncluded ? (
                              <span className="text-[11px] bg-blue-50 text-blue-700 border border-blue-200 rounded px-1.5 py-0.5">Incl.</span>
                            ) : (
                              <span className="text-[11px] text-gray-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge variant="outline" className={`text-[11px] ${STATUS_STYLES[e.paymentStatus] ?? ""}`}>
                              {STATUS_LABELS[e.paymentStatus] ?? e.paymentStatus}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-gray-400">{dept?.name ?? "—"}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex gap-1 justify-end">
                              <button
                                onClick={() => openEdit(e)}
                                className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => setDeleteId(e.id)}
                                className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t border-gray-200">
                    <tr>
                      <td colSpan={4} className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        {filtered.length} expense{filtered.length !== 1 ? "s" : ""}
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-gray-900">{fmtR(totalFiltered)}</td>
                      <td colSpan={4}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

        </div>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={open => { if (!open) setDialogOpen(false); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-green-600" />
              {editingId ? "Edit Expense" : "Capture Expense"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Date *</label>
                <Input type="date" value={form.date} onChange={f("date")} className="text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Amount (R) *</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={f("amount")}
                  className="text-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Supplier / Vendor *</label>
              <Input placeholder="e.g. Petro SA, Telkom, Landlord..." value={form.supplier} onChange={f("supplier")} className="text-sm" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Category *</label>
                <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Payment Status</label>
                <Select value={form.paymentStatus} onValueChange={v => setForm(p => ({ ...p, paymentStatus: v }))}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unpaid">Unpaid</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="part_paid">Part Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Description *</label>
              <Input
                placeholder="Brief description of the expense…"
                value={form.description}
                onChange={f("description")}
                className="text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Department</label>
                <Select value={form.departmentId || "none"} onValueChange={v => setForm(p => ({ ...p, departmentId: v === "none" ? "" : v }))}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="All / General" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">All / General</SelectItem>
                    {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer pb-1">
                  <input
                    type="checkbox"
                    checked={form.vatIncluded}
                    onChange={e => setForm(p => ({ ...p, vatIncluded: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-300 text-green-600"
                  />
                  <span className="text-sm font-medium text-gray-700">VAT included in amount</span>
                </label>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Notes (optional)</label>
              <Textarea
                placeholder="Any additional notes or reference numbers…"
                value={form.notes}
                onChange={f("notes")}
                rows={2}
                className="text-sm"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => saveMut.mutate()}
              disabled={saveMut.isPending || !form.supplier || !form.description || !form.amount || !form.date}
            >
              {saveMut.isPending ? "Saving…" : editingId ? "Save Changes" : "Capture Expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={open => { if (!open) setDeleteId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-700">Delete Expense?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">This will permanently remove the expense record. This cannot be undone.</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => deleteId && deleteMut.mutate(deleteId)}
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </>
  );
}
