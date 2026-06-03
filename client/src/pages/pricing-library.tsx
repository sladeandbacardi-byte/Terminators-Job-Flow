import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import MobileNavigation from "@/components/layout/mobile-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, BookOpen, Search, Tag } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getDashboardRole } from "@/lib/dashboardRole";
import type { PricingLibraryItem, Department } from "@shared/schema";

const CATEGORIES = [
  { value: "sanitary_bins",  label: "Sanitary Bins" },
  { value: "washroom",       label: "Washroom" },
  { value: "pest_control",   label: "Pest Control" },
  { value: "deep_cleaning",  label: "Deep Cleaning" },
  { value: "dustmats",       label: "Dustmats" },
  { value: "installation",   label: "Installation" },
  { value: "other",          label: "Other" },
];

const UNITS = ["per month", "per visit", "each", "per sqm", "per hour", "once-off", "per kg", "per litre"];

const VAT_STATUS_OPTIONS = [
  { value: "inclusive", label: "VAT Inclusive" },
  { value: "exclusive", label: "VAT Exclusive" },
  { value: "exempt",    label: "VAT Exempt" },
];

type ItemForm = {
  name: string; description: string; category: string; serviceType: string;
  unit: string; unitPrice: string; departmentId: string; isActive: boolean;
  cost: string; itemCode: string; vatStatus: string; notes: string;
};

const BLANK: ItemForm = {
  name: "", description: "", category: "sanitary_bins", serviceType: "",
  unit: "per month", unitPrice: "", departmentId: "", isActive: true,
  cost: "", itemCode: "", vatStatus: "inclusive", notes: "",
};

export default function PricingLibraryPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const role = getDashboardRole({ departmentId: (user as any)?.departmentId, role: (user as any)?.role });
  const canEdit = ["admin", "manager"].includes(role);

  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PricingLibraryItem | null>(null);
  const [form, setForm] = useState<ItemForm>({ ...BLANK });

  const { data: items = [], isLoading } = useQuery<PricingLibraryItem[]>({ queryKey: ["/api/pricing-library"] });
  const { data: departments = [] } = useQuery<Department[]>({ queryKey: ["/api/departments"] });

  const save = useMutation({
    mutationFn: () => editing
      ? apiRequest("PUT", `/api/pricing-library/${editing.id}`, form)
      : apiRequest("POST", "/api/pricing-library", form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricing-library"] });
      setOpen(false);
      toast({ title: editing ? "Item updated" : "Item added to pricing library" });
    },
    onError: () => toast({ title: "Save failed", variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/pricing-library/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricing-library"] });
      toast({ title: "Item removed" });
    },
  });

  const filtered = useMemo(() => items.filter(i => {
    if (catFilter !== "all" && i.category !== catFilter) return false;
    if (search && !i.name.toLowerCase().includes(search.toLowerCase()) &&
        !(i.description ?? "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [items, catFilter, search]);

  const grouped = useMemo(() => {
    const map: Record<string, PricingLibraryItem[]> = {};
    filtered.forEach(i => { if (!map[i.category]) map[i.category] = []; map[i.category].push(i); });
    return map;
  }, [filtered]);

  function openNew() { setEditing(null); setForm({ ...BLANK }); setOpen(true); }
  function openEdit(item: PricingLibraryItem) {
    setEditing(item);
    setForm({
      name: item.name, description: item.description ?? "", category: item.category,
      serviceType: item.serviceType ?? "", unit: item.unit ?? "per month",
      unitPrice: item.unitPrice, departmentId: item.departmentId ?? "", isActive: item.isActive,
      cost: (item as any).cost ?? "",
      itemCode: (item as any).itemCode ?? "",
      vatStatus: (item as any).vatStatus ?? "inclusive",
      notes: (item as any).notes ?? "",
    });
    setOpen(true);
  }

  const f = (v: string) => setForm(p => ({ ...p, ...Object.fromEntries([[v.split(":")[0], v.split(":")[1]]]) }));

  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Pricing Library" />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-20 lg:pb-6">
          <div className="max-w-5xl mx-auto space-y-4">

            <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <Input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 w-44 text-sm" />
                </div>
                <Select value={catFilter} onValueChange={setCatFilter}>
                  <SelectTrigger className="h-9 w-44 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <span className="text-sm text-gray-400">{filtered.length} item{filtered.length !== 1 ? "s" : ""}</span>
              </div>
              {canEdit && (
                <Button onClick={openNew} className="h-9 gap-1 text-sm self-start sm:self-auto">
                  <Plus className="h-4 w-4" /> Add Item
                </Button>
              )}
            </div>

            {!canEdit && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
                View-only. Managers and admins can add or edit pricing items.
              </div>
            )}

            {isLoading && <div className="text-center py-12 text-gray-400">Loading…</div>}

            {!isLoading && Object.keys(grouped).length === 0 && (
              <div className="text-center py-14 text-gray-400">
                <BookOpen className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                <div className="font-medium">No pricing items found.</div>
                {canEdit && <div className="text-sm mt-1">Click <strong>Add Item</strong> to build your pricing library.</div>}
              </div>
            )}

            {CATEGORIES.filter(c => (grouped[c.value]?.length ?? 0) > 0).map(cat => (
              <div key={cat.value} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-50 border-b flex items-center gap-2">
                  <Tag className="h-3.5 w-3.5 text-gray-400" />
                  <h3 className="font-semibold text-gray-800 text-sm">{cat.label}</h3>
                  <span className="ml-auto text-xs text-gray-400">{grouped[cat.value].length} item{grouped[cat.value].length !== 1 ? "s" : ""}</span>
                </div>
                <table className="w-full text-sm">
                  <thead className="border-b bg-gray-50/50 text-left">
                    <tr>
                      <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                      <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Description</th>
                      <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Code</th>
                      <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Unit</th>
                      <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Price</th>
                      {canEdit && <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right hidden sm:table-cell">Cost</th>}
                      <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">Active</th>
                      {canEdit && <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {grouped[cat.value].map(item => (
                      <tr key={item.id} className="border-t border-gray-50 hover:bg-gray-50/40">
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-gray-900">{item.name}</div>
                          {item.serviceType && <div className="text-xs text-gray-400">{item.serviceType}</div>}
                        </td>
                        <td className="px-4 py-2.5 hidden md:table-cell text-xs text-gray-500 max-w-[200px] truncate">{item.description || "—"}</td>
                        <td className="px-4 py-2.5 hidden lg:table-cell text-xs text-gray-400">{(item as any).itemCode || "—"}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">{item.unit || "—"}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-gray-900">R {item.unitPrice}</td>
                        {canEdit && (
                          <td className="px-4 py-2.5 text-right text-xs text-gray-500 hidden sm:table-cell">
                            {(item as any).cost ? `R ${(item as any).cost}` : "—"}
                          </td>
                        )}
                        <td className="px-4 py-2.5 text-center">
                          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${item.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                            {item.isActive ? "Active" : "Hidden"}
                          </span>
                        </td>
                        {canEdit && (
                          <td className="px-4 py-2.5 text-right whitespace-nowrap">
                            <Button size="sm" variant="ghost" onClick={() => openEdit(item)} className="h-7 w-7 p-0">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost"
                              onClick={() => { if (confirm(`Delete "${item.name}"?`)) remove.mutate(item.id); }}
                              className="h-7 w-7 p-0">
                              <Trash2 className="h-3.5 w-3.5 text-red-400" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </main>
      </div>
      <MobileNavigation />

      <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) { setEditing(null); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Pricing Item" : "Add Pricing Item"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="col-span-2">
              <Label>Item Name *</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Standard Sanitary Bin — Monthly Service" />
            </div>
            <div>
              <Label>Category *</Label>
              <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Service Type</Label>
              <Input value={form.serviceType} onChange={e => setForm(p => ({ ...p, serviceType: e.target.value }))}
                placeholder="e.g. Monthly Service, Once-off" />
            </div>
            <div>
              <Label>Item Code</Label>
              <Input value={form.itemCode} onChange={e => setForm(p => ({ ...p, itemCode: e.target.value }))}
                placeholder="e.g. SB-STANDARD-01" />
            </div>
            <div>
              <Label>VAT Status</Label>
              <Select value={form.vatStatus} onValueChange={v => setForm(p => ({ ...p, vatStatus: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{VAT_STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sell Price (R) *</Label>
              <Input value={form.unitPrice} onChange={e => setForm(p => ({ ...p, unitPrice: e.target.value }))} placeholder="e.g. 85.00" />
            </div>
            {canEdit && (
              <div>
                <Label>Cost Price (R) <span className="text-xs text-gray-400 font-normal">Admin only</span></Label>
                <Input value={form.cost} onChange={e => setForm(p => ({ ...p, cost: e.target.value }))} placeholder="e.g. 45.00" />
              </div>
            )}
            <div>
              <Label>Unit</Label>
              <Select value={form.unit} onValueChange={v => setForm(p => ({ ...p, unit: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Department</Label>
              <Select value={form.departmentId || "_all"} onValueChange={v => setForm(p => ({ ...p, departmentId: v === "_all" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="All departments" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All departments</SelectItem>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pt-4">
              <Switch checked={form.isActive} onCheckedChange={v => setForm(p => ({ ...p, isActive: v }))} />
              <Label className="font-normal text-sm">Active (visible when quoting)</Label>
            </div>
            <div className="col-span-2">
              <Label>Description</Label>
              <Textarea rows={2} value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Brief description — what does this item include?" />
            </div>
            <div className="col-span-2">
              <Label>Internal Notes</Label>
              <Textarea rows={2} value={form.notes}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="Supplier info, margin notes, conditions..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name || !form.unitPrice}>
              {save.isPending ? "Saving…" : editing ? "Save Changes" : "Add Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
