import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import MobileNavigation from "@/components/layout/mobile-nav";
import InventoryForm from "@/components/forms/inventory-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Search, Plus, Package, Edit, Trash2, Upload, MapPin, ArrowLeftRight, ClipboardList, CheckSquare, BarChart2, AlertTriangle, TrendingDown, Warehouse, Eye, CheckCircle, XCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ExportButton } from "@/components/export-button";
import { exportInventory } from "@/lib/data-export";
import { DepartmentFilter } from "@/components/filters/department-filter";
import { useDepartmentFilter } from "@/hooks/useDepartmentFilter";
import { format } from "date-fns";
import type { InventoryItem, Department, StockLocation, StockMovement, PickingList, StockCheck } from "@shared/schema";

interface StockAlerts { lowStock: InventoryItem[]; reorderRequired: InventoryItem[]; overstocked: InventoryItem[]; }

const MOVEMENT_TYPES = [
  "Received from Supplier", "Issued to Technician", "Issued to Vehicle",
  "Used on Job", "Returned to Store", "Transferred Between Locations",
  "Adjustment", "Damaged / Lost", "Stock Check Correction",
];

const LOCATION_TYPES = ["Warehouse", "Vehicle", "Technician", "Team", "Other"];

function locBadge(type: string) {
  const m: Record<string, string> = {
    Warehouse: "bg-blue-100 text-blue-800", Vehicle: "bg-green-100 text-green-800",
    Technician: "bg-purple-100 text-purple-800", Team: "bg-orange-100 text-orange-800",
  };
  return m[type] ?? "bg-gray-100 text-gray-700";
}

function statusBadge(status: string) {
  const m: Record<string, string> = {
    Draft: "bg-gray-100 text-gray-700", "Ready to Pick": "bg-blue-100 text-blue-800",
    Picked: "bg-yellow-100 text-yellow-800", Issued: "bg-green-100 text-green-800",
    "In Progress": "bg-yellow-100 text-yellow-800", "Pending Approval": "bg-orange-100 text-orange-800",
    Approved: "bg-green-100 text-green-800", Cancelled: "bg-red-100 text-red-800",
  };
  return m[status] ?? "bg-gray-100 text-gray-700";
}

export default function Inventory() {
  const [activeTab, setActiveTab] = useState("items");
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [alertsFilter, setAlertsFilter] = useState("all");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [movTypeFilter, setMovTypeFilter] = useState("all");
  const [movSearch, setMovSearch] = useState("");
  const [showLocationForm, setShowLocationForm] = useState(false);
  const [editingLocation, setEditingLocation] = useState<StockLocation | null>(null);
  const [showMovementForm, setShowMovementForm] = useState(false);
  const [showPickingForm, setShowPickingForm] = useState(false);
  const [showStockCheckForm, setShowStockCheckForm] = useState(false);
  const [selectedPL, setSelectedPL] = useState<PickingList | null>(null);
  const [selectedSC, setSelectedSC] = useState<StockCheck | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const departmentFilter = useDepartmentFilter();

  const { data: items = [], isLoading } = useQuery<InventoryItem[]>({ queryKey: ["/api/inventory"] });
  const { data: departments = [] } = useQuery<Department[]>({ queryKey: ["/api/departments"] });
  const { data: stockAlerts } = useQuery<StockAlerts>({ queryKey: ["/api/inventory/alerts/stock"], refetchInterval: 30000 });
  const { data: locations = [] } = useQuery<StockLocation[]>({ queryKey: ["/api/stock-locations"] });
  const { data: movements = [] } = useQuery<StockMovement[]>({ queryKey: ["/api/stock-movements"] });
  const { data: pickingLists = [] } = useQuery<PickingList[]>({ queryKey: ["/api/picking-lists"] });
  const { data: stockChecks = [] } = useQuery<StockCheck[]>({ queryKey: ["/api/stock-checks"] });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/inventory/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/inventory"] }); toast({ title: "Item deleted" }); },
    onError: () => toast({ title: "Error", description: "Failed to delete item", variant: "destructive" }),
  });

  const deleteAllMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/inventory"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/alerts/stock"] });
      setShowDeleteAllConfirm(false);
      toast({ title: "All stock items deleted" });
    },
  });

  const deleteLocationMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/stock-locations/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/stock-locations"] }); toast({ title: "Location deleted" }); },
  });

  const issuePLMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/picking-lists/${id}/issue`, { issuedBy: "Admin" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/picking-lists"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stock-movements"] });
      setSelectedPL(null);
      toast({ title: "Picking list issued", description: "Stock movements created and balances updated." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const approveSCMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/stock-checks/${id}/approve`, { approvedBy: "Admin" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stock-checks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stock-movements"] });
      setSelectedSC(null);
      toast({ title: "Stock check approved", description: "Corrections applied to stock balances." });
    },
  });

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setIsImporting(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const r = await fetch("/api/inventory/import", { method: "POST", body: fd });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error ?? "Import failed");
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      toast({ title: "Import complete", description: `${result.results?.successful ?? 0} items imported` });
    } catch (err: any) {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const filteredItems = departmentFilter.filteredData(
    items.filter(item => {
      const q = searchTerm.toLowerCase();
      const matchSearch = !q || item.name.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q);
      const matchType = typeFilter === "all" || item.type === typeFilter;
      let matchAlert = true;
      if (alertsFilter === "critical") matchAlert = item.quantity <= item.minStockLevel;
      else if (alertsFilter === "low") matchAlert = item.quantity <= item.reorderPoint && item.quantity > item.minStockLevel;
      else if (alertsFilter === "reorder") matchAlert = item.quantity <= item.reorderPoint;
      else if (alertsFilter === "overstocked") matchAlert = item.quantity >= item.maxStockLevel;
      return matchSearch && matchType && matchAlert;
    })
  );

  const filteredMovements = movements.filter(m => {
    const matchType = movTypeFilter === "all" || m.movementType === movTypeFilter;
    const q = movSearch.toLowerCase();
    const matchSearch = !q || m.stockItemName.toLowerCase().includes(q) ||
      (m.fromLocationName ?? "").toLowerCase().includes(q) ||
      (m.toLocationName ?? "").toLowerCase().includes(q);
    return matchType && matchSearch;
  });

  const getDeptName = (id: string | null) => departments.find(d => d.id === id)?.name ?? "General";
  const getLocName = (id: string | null | undefined) => locations.find(l => l.id === id)?.name ?? id ?? "—";
  const lowStockCount = (stockAlerts?.lowStock?.length ?? 0) + (stockAlerts?.reorderRequired?.length ?? 0);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Stock Management" setIsMobileMenuOpen={setIsMobileMenuOpen} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">

          {lowStockCount > 0 && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2.5 text-sm text-orange-800">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span><strong>{lowStockCount}</strong> item{lowStockCount !== 1 ? "s" : ""} need{lowStockCount === 1 ? "s" : ""} restocking.</span>
              <button className="ml-auto text-xs underline" onClick={() => { setActiveTab("items"); setAlertsFilter("reorder"); }}>View</button>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {[
              { label: "Total Items", value: items.length, icon: Package, col: "blue" },
              { label: "Locations", value: locations.length, icon: MapPin, col: "green" },
              { label: "Low Stock", value: stockAlerts?.lowStock?.length ?? 0, icon: TrendingDown, col: "orange" },
              { label: "Open Picks", value: pickingLists.filter(p => p.status !== "Issued" && p.status !== "Cancelled").length, icon: ClipboardList, col: "purple" },
            ].map(({ label, value, icon: Icon, col }) => (
              <Card key={label} className="border-0 shadow-sm">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-${col}-100`}><Icon className={`h-5 w-5 text-${col}-600`} /></div>
                  <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-bold">{value}</p></div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4 flex-wrap h-auto gap-1">
              <TabsTrigger value="items"><Package className="h-3.5 w-3.5 mr-1.5" />Items</TabsTrigger>
              <TabsTrigger value="locations"><MapPin className="h-3.5 w-3.5 mr-1.5" />Locations</TabsTrigger>
              <TabsTrigger value="movements"><ArrowLeftRight className="h-3.5 w-3.5 mr-1.5" />Movements</TabsTrigger>
              <TabsTrigger value="picking"><ClipboardList className="h-3.5 w-3.5 mr-1.5" />Picking Lists</TabsTrigger>
              <TabsTrigger value="checks"><CheckSquare className="h-3.5 w-3.5 mr-1.5" />Stock Checks</TabsTrigger>
              <TabsTrigger value="reports"><BarChart2 className="h-3.5 w-3.5 mr-1.5" />Reports</TabsTrigger>
            </TabsList>

            {/* ── Items ── */}
            <TabsContent value="items">
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input placeholder="Search name or SKU…" className="pl-9" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
                <select className="border rounded-md px-3 py-2 text-sm" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                  <option value="all">All Types</option>
                  <option value="product">Product</option>
                  <option value="rental_equipment">Rental Equipment</option>
                </select>
                <select className="border rounded-md px-3 py-2 text-sm" value={alertsFilter} onChange={e => setAlertsFilter(e.target.value)}>
                  <option value="all">All Levels</option>
                  <option value="critical">Critical</option>
                  <option value="reorder">Needs Reorder</option>
                  <option value="overstocked">Overstocked</option>
                </select>
                <DepartmentFilter {...departmentFilter} />
              </div>
              <div className="flex gap-2 mb-4 flex-wrap">
                <Button onClick={() => { setEditingItem(null); setIsFormOpen(true); }} size="sm">
                  <Plus className="h-4 w-4 mr-1" />Add Item
                </Button>
                <input type="file" ref={fileInputRef} accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileImport} />
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
                  <Upload className="h-4 w-4 mr-1" />{isImporting ? "Importing…" : "Import"}
                </Button>
                <ExportButton onExport={() => exportInventory(filteredItems)} label="Export" />
                {items.length > 0 && (
                  <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50 ml-auto" onClick={() => setShowDeleteAllConfirm(true)}>
                    <Trash2 className="h-4 w-4 mr-1" />Clear All
                  </Button>
                )}
              </div>

              {isLoading ? (
                <div className="text-center py-12 text-muted-foreground">Loading…</div>
              ) : filteredItems.length === 0 ? (
                <Card><CardContent className="py-12 text-center text-muted-foreground"><Package className="h-10 w-10 mx-auto mb-3 opacity-30" /><p>No items found.</p></CardContent></Card>
              ) : (
                <div className="grid gap-3">
                  {filteredItems.map(item => {
                    const stockPct = item.maxStockLevel > 0 ? Math.min(100, (item.quantity / item.maxStockLevel) * 100) : 0;
                    const isCritical = item.quantity <= item.minStockLevel;
                    const isLow = item.quantity <= item.reorderPoint && !isCritical;
                    return (
                      <Card key={item.id} className={`border-l-4 shadow-sm ${isCritical ? "border-l-red-500" : isLow ? "border-l-orange-400" : "border-l-green-500"}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold">{item.name}</span>
                                <Badge variant="outline" className="text-xs">{item.sku}</Badge>
                                {(item as any).category && <Badge className="text-xs bg-gray-100 text-gray-700">{(item as any).category}</Badge>}
                                {item.type === "rental_equipment" && <Badge className="text-xs bg-blue-100 text-blue-800">Rental</Badge>}
                                {isCritical && <Badge className="text-xs bg-red-100 text-red-800"><AlertTriangle className="h-3 w-3 mr-0.5" />Critical</Badge>}
                                {isLow && !isCritical && <Badge className="text-xs bg-orange-100 text-orange-800">Low Stock</Badge>}
                              </div>
                              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
                                <span>Qty: <strong className={isCritical ? "text-red-600" : isLow ? "text-orange-600" : "text-green-700"}>{item.quantity}</strong> {(item as any).unitOfMeasure ?? "units"}</span>
                                <span>Min: {item.minStockLevel}</span>
                                <span>Reorder pt: {item.reorderPoint}</span>
                                <span>Max: {item.maxStockLevel}</span>
                                {(item as any).costPrice && <span className="text-gray-500">Cost: <strong className="text-gray-700">{formatCurrency(Number((item as any).costPrice))}</strong></span>}
                                {(item as any).sellingPrice && <span className="text-green-700">Selling: <strong>{formatCurrency(Number((item as any).sellingPrice))}</strong></span>}
                                {!(item as any).costPrice && !(item as any).sellingPrice && item.unitPrice && <span>Price: {formatCurrency(Number(item.unitPrice))}</span>}
                                <span className="hidden sm:inline">{getDeptName(item.departmentId ?? null)}</span>
                              </div>
                              <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden w-full max-w-xs">
                                <div className={`h-full rounded-full ${isCritical ? "bg-red-500" : isLow ? "bg-orange-400" : "bg-green-500"}`} style={{ width: `${stockPct}%` }} />
                              </div>
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                              <Button size="sm" variant="outline" onClick={() => { setEditingItem(item); setIsFormOpen(true); }}><Edit className="h-3.5 w-3.5" /></Button>
                              <Button size="sm" variant="outline" className="text-red-500 hover:bg-red-50" onClick={() => deleteMutation.mutate(item.id)} disabled={deleteMutation.isPending}><Trash2 className="h-3.5 w-3.5" /></Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* ── Locations ── */}
            <TabsContent value="locations">
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-muted-foreground">{locations.length} location{locations.length !== 1 ? "s" : ""}</p>
                <Button size="sm" onClick={() => { setEditingLocation(null); setShowLocationForm(true); }}><Plus className="h-4 w-4 mr-1" />Add Location</Button>
              </div>
              {locations.length === 0 ? (
                <Card><CardContent className="py-12 text-center text-muted-foreground"><Warehouse className="h-10 w-10 mx-auto mb-3 opacity-30" /><p>No locations yet.</p></CardContent></Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {locations.map(loc => (
                    <Card key={loc.id} className="shadow-sm">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold">{loc.name}</p>
                            <Badge className={`text-xs mt-1 ${locBadge(loc.locationType)}`}>{loc.locationType}</Badge>
                            {loc.vehicleRegistration && <p className="text-xs text-muted-foreground mt-1">Reg: {loc.vehicleRegistration}</p>}
                            {loc.assignedTechnicianName && <p className="text-xs text-muted-foreground mt-1">Tech: {loc.assignedTechnicianName}</p>}
                            {loc.notes && <p className="text-xs text-muted-foreground mt-1 italic">{loc.notes}</p>}
                          </div>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => { setEditingLocation(loc); setShowLocationForm(true); }}><Edit className="h-3.5 w-3.5" /></Button>
                            <Button size="sm" variant="ghost" className="text-red-500" onClick={() => deleteLocationMutation.mutate(loc.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </div>
                        {!loc.activeStatus && <Badge className="text-xs bg-gray-100 text-gray-500 mt-2">Inactive</Badge>}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ── Movements ── */}
            <TabsContent value="movements">
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input placeholder="Search item or location…" className="pl-9" value={movSearch} onChange={e => setMovSearch(e.target.value)} />
                </div>
                <select className="border rounded-md px-3 py-2 text-sm" value={movTypeFilter} onChange={e => setMovTypeFilter(e.target.value)}>
                  <option value="all">All Types</option>
                  {MOVEMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <Button size="sm" onClick={() => setShowMovementForm(true)}><Plus className="h-4 w-4 mr-1" />Record Movement</Button>
              </div>
              {filteredMovements.length === 0 ? (
                <Card><CardContent className="py-12 text-center text-muted-foreground"><ArrowLeftRight className="h-10 w-10 mx-auto mb-3 opacity-30" /><p>No movements recorded yet.</p></CardContent></Card>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase">Date</th>
                        <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase">Type</th>
                        <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase">Item</th>
                        <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase">Qty</th>
                        <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">From</th>
                        <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">To</th>
                        <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMovements.map(m => (
                        <tr key={m.id} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{format(new Date(m.createdAt), "dd MMM yy")}</td>
                          <td className="px-3 py-2.5"><Badge className="text-xs bg-blue-50 text-blue-700 whitespace-nowrap">{m.movementType}</Badge></td>
                          <td className="px-3 py-2.5 font-medium">{m.stockItemName}</td>
                          <td className="px-3 py-2.5 font-semibold">{Number(m.quantity)}{m.unitOfMeasure ? ` ${m.unitOfMeasure}` : ""}</td>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground hidden md:table-cell">{m.fromLocationName ?? "—"}</td>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground hidden md:table-cell">{m.toLocationName ?? "—"}</td>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground hidden lg:table-cell">{m.createdBy}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            {/* ── Picking Lists ── */}
            <TabsContent value="picking">
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-muted-foreground">{pickingLists.length} picking list{pickingLists.length !== 1 ? "s" : ""}</p>
                <Button size="sm" onClick={() => setShowPickingForm(true)}><Plus className="h-4 w-4 mr-1" />New Picking List</Button>
              </div>
              {pickingLists.length === 0 ? (
                <Card><CardContent className="py-12 text-center text-muted-foreground"><ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" /><p>No picking lists yet.</p></CardContent></Card>
              ) : (
                <div className="grid gap-3">
                  {pickingLists.map(pl => (
                    <Card key={pl.id} className="shadow-sm">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold">{pl.pickingListNumber ?? pl.id.slice(0, 8)}</span>
                              <Badge className={`text-xs ${statusBadge(pl.status)}`}>{pl.status}</Badge>
                            </div>
                            <div className="flex gap-4 mt-1.5 text-sm text-muted-foreground flex-wrap">
                              {pl.clientName && <span>Client: {pl.clientName}</span>}
                              {pl.assignedTechnicianName && <span>Tech: {pl.assignedTechnicianName}</span>}
                              {pl.requiredDate && <span>Required: {format(new Date(pl.requiredDate), "dd MMM yyyy")}</span>}
                              <span className="text-xs">{format(new Date(pl.createdAt), "dd MMM yyyy")}</span>
                            </div>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <Button size="sm" variant="outline" onClick={() => setSelectedPL(pl)}><Eye className="h-3.5 w-3.5 mr-1" />View</Button>
                            {pl.status === "Picked" && (
                              <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => issuePLMutation.mutate(pl.id)} disabled={issuePLMutation.isPending}>
                                <CheckCircle className="h-3.5 w-3.5 mr-1" />Issue
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ── Stock Checks ── */}
            <TabsContent value="checks">
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-muted-foreground">{stockChecks.length} stock check{stockChecks.length !== 1 ? "s" : ""}</p>
                <Button size="sm" onClick={() => setShowStockCheckForm(true)}><Plus className="h-4 w-4 mr-1" />New Stock Check</Button>
              </div>
              {stockChecks.length === 0 ? (
                <Card><CardContent className="py-12 text-center text-muted-foreground"><CheckSquare className="h-10 w-10 mx-auto mb-3 opacity-30" /><p>No stock checks yet.</p></CardContent></Card>
              ) : (
                <div className="grid gap-3">
                  {stockChecks.map(sc => (
                    <Card key={sc.id} className="shadow-sm">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold">{sc.checkNumber ?? sc.id.slice(0, 8)}</span>
                              <Badge className={`text-xs ${statusBadge(sc.status)}`}>{sc.status}</Badge>
                            </div>
                            <div className="flex gap-4 mt-1.5 text-sm text-muted-foreground flex-wrap">
                              <span>Location: {sc.locationName ?? getLocName(sc.locationId)}</span>
                              <span>By: {sc.checkedBy}</span>
                              <span>{format(new Date(sc.checkDate), "dd MMM yyyy")}</span>
                            </div>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <Button size="sm" variant="outline" onClick={() => setSelectedSC(sc)}><Eye className="h-3.5 w-3.5 mr-1" />View</Button>
                            {sc.status === "Pending Approval" && (
                              <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => approveSCMutation.mutate(sc.id)} disabled={approveSCMutation.isPending}>
                                <CheckCircle className="h-3.5 w-3.5 mr-1" />Approve
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ── Reports ── */}
            <TabsContent value="reports">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2"><TrendingDown className="h-4 w-4 text-orange-500" />Low Stock Report</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(stockAlerts?.lowStock?.length ?? 0) === 0 && (stockAlerts?.reorderRequired?.length ?? 0) === 0 ? (
                      <p className="text-sm text-green-700 flex items-center gap-2"><CheckCircle className="h-4 w-4" />All items adequately stocked.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {[...(stockAlerts?.lowStock ?? []), ...(stockAlerts?.reorderRequired ?? [])].map(item => (
                          <div key={item.id} className="flex items-center justify-between py-1.5 border-b last:border-0 text-sm">
                            <span>{item.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-red-600 font-semibold">{item.quantity}</span>
                              <span className="text-muted-foreground text-xs">/ {item.reorderPoint} reorder pt</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2"><BarChart2 className="h-4 w-4 text-blue-500" />Overstocked Items</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(stockAlerts?.overstocked?.length ?? 0) === 0 ? (
                      <p className="text-sm text-muted-foreground">No overstocked items.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {(stockAlerts?.overstocked ?? []).map(item => (
                          <div key={item.id} className="flex items-center justify-between py-1.5 border-b last:border-0 text-sm">
                            <span>{item.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-blue-600 font-semibold">{item.quantity}</span>
                              <span className="text-muted-foreground text-xs">/ {item.maxStockLevel} max</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="shadow-sm md:col-span-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2"><ArrowLeftRight className="h-4 w-4 text-purple-500" />Movement Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {movements.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No movements recorded yet.</p>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {MOVEMENT_TYPES.map(type => {
                          const count = movements.filter(m => m.movementType === type).length;
                          return count > 0 ? (
                            <div key={type} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                              <span className="text-muted-foreground truncate">{type}</span>
                              <Badge variant="outline">{count}</Badge>
                            </div>
                          ) : null;
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>

      <MobileNavigation />

      {/* Item Form */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Stock Item" : "Add Stock Item"}</DialogTitle>
            <DialogDescription>Fill in the details for this stock item.</DialogDescription>
          </DialogHeader>
          <InventoryForm
            item={editingItem ?? undefined}
            onSuccess={() => { setIsFormOpen(false); setEditingItem(null); queryClient.invalidateQueries({ queryKey: ["/api/inventory"] }); }}
            onCancel={() => { setIsFormOpen(false); setEditingItem(null); }}
          />
        </DialogContent>
      </Dialog>

      <LocationFormDialog open={showLocationForm} onClose={() => { setShowLocationForm(false); setEditingLocation(null); }} location={editingLocation}
        onSaved={() => { queryClient.invalidateQueries({ queryKey: ["/api/stock-locations"] }); setShowLocationForm(false); setEditingLocation(null); }} />

      <MovementFormDialog open={showMovementForm} onClose={() => setShowMovementForm(false)} items={items} locations={locations}
        onSaved={() => { queryClient.invalidateQueries({ queryKey: ["/api/stock-movements"] }); queryClient.invalidateQueries({ queryKey: ["/api/stock-balances"] }); setShowMovementForm(false); }} />

      <PickingListFormDialog open={showPickingForm} onClose={() => setShowPickingForm(false)} items={items} locations={locations}
        onSaved={() => { queryClient.invalidateQueries({ queryKey: ["/api/picking-lists"] }); setShowPickingForm(false); }} />

      {selectedPL && (
        <PLDetailDialog pl={selectedPL} items={items} locations={locations} onClose={() => setSelectedPL(null)}
          onStatusChange={(status) => {
            apiRequest("PUT", `/api/picking-lists/${selectedPL.id}`, { status })
              .then(() => { queryClient.invalidateQueries({ queryKey: ["/api/picking-lists"] }); setSelectedPL({ ...selectedPL, status }); });
          }} />
      )}

      <StockCheckFormDialog open={showStockCheckForm} onClose={() => setShowStockCheckForm(false)} items={items} locations={locations}
        onSaved={() => { queryClient.invalidateQueries({ queryKey: ["/api/stock-checks"] }); setShowStockCheckForm(false); }} />

      {selectedSC && <SCDetailDialog sc={selectedSC} items={items} onClose={() => setSelectedSC(null)} />}

      <AlertDialog open={showDeleteAllConfirm} onOpenChange={setShowDeleteAllConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all stock items?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete all {items.length} stock items. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteAllMutation.mutate()} className="bg-red-600 hover:bg-red-700" disabled={deleteAllMutation.isPending}>
              {deleteAllMutation.isPending ? "Deleting…" : "Yes, delete all"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Location Form ─────────────────────────────────────────────────────────────
function LocationFormDialog({ open, onClose, location, onSaved }: {
  open: boolean; onClose: () => void; location: StockLocation | null; onSaved: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(location?.name ?? "");
  const [locationType, setLocationType] = useState(location?.locationType ?? "Warehouse");
  const [vehicleReg, setVehicleReg] = useState(location?.vehicleRegistration ?? "");
  const [notes, setNotes] = useState(location?.notes ?? "");

  const save = async () => {
    if (!name.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    try {
      if (location) await apiRequest("PUT", `/api/stock-locations/${location.id}`, { name, locationType, vehicleRegistration: vehicleReg, notes });
      else await apiRequest("POST", "/api/stock-locations", { name, locationType, vehicleRegistration: vehicleReg, notes, activeStatus: true });
      onSaved(); toast({ title: location ? "Location updated" : "Location created" });
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{location ? "Edit Location" : "Add Stock Location"}</DialogTitle><DialogDescription>Where stock is physically stored.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Main Store" /></div>
          <div><Label>Type</Label>
            <select className="w-full border rounded-md px-3 py-2 text-sm mt-1" value={locationType} onChange={e => setLocationType(e.target.value)}>
              {LOCATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {locationType === "Vehicle" && <div><Label>Vehicle Registration</Label><Input value={vehicleReg} onChange={e => setVehicleReg(e.target.value)} placeholder="e.g. CA 123-456" /></div>}
          <div><Label>Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} /></div>
        </div>
        <div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save}>{location ? "Update" : "Create"}</Button></div>
      </DialogContent>
    </Dialog>
  );
}

// ── Manual Movement Form ────────────────────────────────────────────────────
function MovementFormDialog({ open, onClose, items, locations, onSaved }: {
  open: boolean; onClose: () => void; items: InventoryItem[]; locations: StockLocation[]; onSaved: () => void;
}) {
  const { toast } = useToast();
  const [stockItemId, setStockItemId] = useState("");
  const [movementType, setMovementType] = useState("Adjustment");
  const [fromLocationId, setFromLocationId] = useState("");
  const [toLocationId, setToLocationId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");

  const save = async () => {
    if (!stockItemId || !quantity || Number(quantity) <= 0) { toast({ title: "Item and quantity required", variant: "destructive" }); return; }
    const item = items.find(i => i.id === stockItemId);
    try {
      await apiRequest("POST", "/api/stock-movements", {
        stockItemId, stockItemName: item?.name ?? "Unknown", movementType,
        fromLocationId: fromLocationId || undefined, fromLocationName: locations.find(l => l.id === fromLocationId)?.name,
        toLocationId: toLocationId || undefined, toLocationName: locations.find(l => l.id === toLocationId)?.name,
        quantity, unitOfMeasure: (item as any)?.unitOfMeasure ?? "units", notes, createdBy: "Admin",
      });
      onSaved(); toast({ title: "Movement recorded" });
      setStockItemId(""); setMovementType("Adjustment"); setFromLocationId(""); setToLocationId(""); setQuantity(""); setNotes("");
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Record Stock Movement</DialogTitle><DialogDescription>Manually log a movement and update location balances.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div><Label>Item *</Label>
            <select className="w-full border rounded-md px-3 py-2 text-sm mt-1" value={stockItemId} onChange={e => setStockItemId(e.target.value)}>
              <option value="">Select item…</option>
              {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>
          <div><Label>Movement Type</Label>
            <select className="w-full border rounded-md px-3 py-2 text-sm mt-1" value={movementType} onChange={e => setMovementType(e.target.value)}>
              {MOVEMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>From Location</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm mt-1" value={fromLocationId} onChange={e => setFromLocationId(e.target.value)}>
                <option value="">— None —</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div><Label>To Location</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm mt-1" value={toLocationId} onChange={e => setToLocationId(e.target.value)}>
                <option value="">— None —</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          </div>
          <div><Label>Quantity *</Label><Input type="number" min="0.01" step="0.01" value={quantity} onChange={e => setQuantity(e.target.value)} /></div>
          <div><Label>Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} /></div>
        </div>
        <div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save}>Record</Button></div>
      </DialogContent>
    </Dialog>
  );
}

// ── Picking List Form ─────────────────────────────────────────────────────────
function PickingListFormDialog({ open, onClose, items, locations, onSaved }: {
  open: boolean; onClose: () => void; items: InventoryItem[]; locations: StockLocation[]; onSaved: () => void;
}) {
  const { toast } = useToast();
  const [clientName, setClientName] = useState("");
  const [techName, setTechName] = useState("");
  const [reqDate, setReqDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState([{ stockItemId: "", qty: "", fromLocationId: "", toLocationId: "" }]);

  const addLine = () => setLines(l => [...l, { stockItemId: "", qty: "", fromLocationId: "", toLocationId: "" }]);
  const rmLine = (i: number) => setLines(l => l.filter((_, idx) => idx !== i));
  const setLine = (i: number, k: string, v: string) => setLines(l => l.map((li, idx) => idx === i ? { ...li, [k]: v } : li));

  const save = async () => {
    if (lines.every(l => !l.stockItemId)) { toast({ title: "Add at least one item", variant: "destructive" }); return; }
    try {
      const pl: any = await apiRequest("POST", "/api/picking-lists", {
        clientName: clientName || undefined, assignedTechnicianName: techName || undefined,
        requiredDate: reqDate ? new Date(reqDate) : undefined, notes: notes || undefined, status: "Draft",
      });
      for (const li of lines) {
        if (!li.stockItemId || !li.qty) continue;
        const it = items.find(i => i.id === li.stockItemId);
        await apiRequest("POST", `/api/picking-lists/${pl.id}/items`, {
          stockItemId: li.stockItemId, itemName: it?.name ?? "Unknown",
          unitOfMeasure: (it as any)?.unitOfMeasure ?? "units",
          quantityRequired: li.qty, quantityPicked: "0",
          fromLocationId: li.fromLocationId || undefined, fromLocationName: locations.find(l => l.id === li.fromLocationId)?.name,
          toLocationId: li.toLocationId || undefined, toLocationName: locations.find(l => l.id === li.toLocationId)?.name,
        });
      }
      onSaved(); toast({ title: "Picking list created" });
      setClientName(""); setTechName(""); setReqDate(""); setNotes("");
      setLines([{ stockItemId: "", qty: "", fromLocationId: "", toLocationId: "" }]);
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New Picking List</DialogTitle><DialogDescription>Prepare stock for a job or technician.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Client</Label><Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Client name" /></div>
            <div><Label>Technician</Label><Input value={techName} onChange={e => setTechName(e.target.value)} placeholder="Technician name" /></div>
          </div>
          <div><Label>Required Date</Label><Input type="date" value={reqDate} onChange={e => setReqDate(e.target.value)} className="w-48" /></div>
          <div><Label>Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} /></div>
          <div className="border rounded-lg p-3">
            <div className="flex justify-between items-center mb-3">
              <Label className="text-sm font-semibold">Items to Pick</Label>
              <Button size="sm" variant="outline" onClick={addLine}><Plus className="h-3.5 w-3.5 mr-1" />Add Line</Button>
            </div>
            {lines.map((li, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 mb-2 items-center">
                <div className="col-span-4">
                  <select className="w-full border rounded px-2 py-1.5 text-sm" value={li.stockItemId} onChange={e => setLine(idx, "stockItemId", e.target.value)}>
                    <option value="">Select item…</option>
                    {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                </div>
                <div className="col-span-2"><Input placeholder="Qty" type="number" value={li.qty} onChange={e => setLine(idx, "qty", e.target.value)} className="h-8 text-sm" /></div>
                <div className="col-span-3">
                  <select className="w-full border rounded px-2 py-1.5 text-sm" value={li.fromLocationId} onChange={e => setLine(idx, "fromLocationId", e.target.value)}>
                    <option value="">From…</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <select className="w-full border rounded px-2 py-1.5 text-sm" value={li.toLocationId} onChange={e => setLine(idx, "toLocationId", e.target.value)}>
                    <option value="">To…</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <div className="col-span-1">
                  <Button size="sm" variant="ghost" className="text-red-500 h-8 w-8 p-0" onClick={() => rmLine(idx)}><XCircle className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save}>Create Picking List</Button></div>
      </DialogContent>
    </Dialog>
  );
}

// ── Picking List Detail ───────────────────────────────────────────────────────
function PLDetailDialog({ pl, items, locations, onClose, onStatusChange }: {
  pl: PickingList; items: InventoryItem[]; locations: StockLocation[];
  onClose: () => void; onStatusChange: (s: string) => void;
}) {
  const { data: plItems = [] } = useQuery<any[]>({
    queryKey: ["/api/picking-lists", pl.id, "items"],
    queryFn: () => fetch(`/api/picking-lists/${pl.id}/items`).then(r => r.json()),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{pl.pickingListNumber} — Detail</DialogTitle>
          <DialogDescription><Badge className={`text-xs ${statusBadge(pl.status)}`}>{pl.status}</Badge></DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            {pl.clientName && <div><span className="text-muted-foreground">Client:</span> {pl.clientName}</div>}
            {pl.assignedTechnicianName && <div><span className="text-muted-foreground">Tech:</span> {pl.assignedTechnicianName}</div>}
            {pl.requiredDate && <div><span className="text-muted-foreground">Required:</span> {format(new Date(pl.requiredDate), "dd MMM yyyy")}</div>}
          </div>
          <div className="overflow-x-auto rounded border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b"><tr>
                <th className="text-left px-3 py-2 text-xs font-semibold uppercase text-gray-500">Item</th>
                <th className="text-left px-3 py-2 text-xs font-semibold uppercase text-gray-500">Required</th>
                <th className="text-left px-3 py-2 text-xs font-semibold uppercase text-gray-500">Picked</th>
                <th className="text-left px-3 py-2 text-xs font-semibold uppercase text-gray-500">From</th>
                <th className="text-left px-3 py-2 text-xs font-semibold uppercase text-gray-500">To</th>
              </tr></thead>
              <tbody>
                {plItems.length === 0 && <tr><td colSpan={5} className="px-3 py-4 text-center text-sm text-muted-foreground">No items added.</td></tr>}
                {plItems.map((li: any) => (
                  <tr key={li.id} className="border-b last:border-0">
                    <td className="px-3 py-2">{li.itemName}</td>
                    <td className="px-3 py-2">{Number(li.quantityRequired)} {li.unitOfMeasure}</td>
                    <td className="px-3 py-2 text-green-700 font-semibold">{Number(li.quantityPicked)}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{li.fromLocationName ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{li.toLocationName ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {["Draft", "Ready to Pick"].includes(pl.status) && (
            <div className="flex gap-2 justify-end">
              {pl.status === "Draft" && <Button size="sm" variant="outline" onClick={() => onStatusChange("Ready to Pick")}>Mark Ready to Pick</Button>}
              {pl.status === "Ready to Pick" && <Button size="sm" onClick={() => onStatusChange("Picked")}>Mark as Picked</Button>}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Stock Check Form ──────────────────────────────────────────────────────────
function StockCheckFormDialog({ open, onClose, items, locations, onSaved }: {
  open: boolean; onClose: () => void; items: InventoryItem[]; locations: StockLocation[]; onSaved: () => void;
}) {
  const { toast } = useToast();
  const [locationId, setLocationId] = useState("");
  const [checkedBy, setCheckedBy] = useState("");
  const [notes, setNotes] = useState("");

  const save = async () => {
    if (!locationId || !checkedBy.trim()) { toast({ title: "Location and checker required", variant: "destructive" }); return; }
    const loc = locations.find(l => l.id === locationId);
    try {
      await apiRequest("POST", "/api/stock-checks", {
        locationId, locationName: loc?.name, checkedBy: checkedBy.trim(),
        notes: notes || undefined, checkDate: new Date(), status: "In Progress",
      });
      onSaved(); toast({ title: "Stock check created" });
      setLocationId(""); setCheckedBy(""); setNotes("");
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>New Stock Check</DialogTitle><DialogDescription>Count physical stock at a location.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div><Label>Location *</Label>
            <select className="w-full border rounded-md px-3 py-2 text-sm mt-1" value={locationId} onChange={e => setLocationId(e.target.value)}>
              <option value="">Select location…</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div><Label>Checked By *</Label><Input value={checkedBy} onChange={e => setCheckedBy(e.target.value)} placeholder="Your name" /></div>
          <div><Label>Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} /></div>
        </div>
        <div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save}>Start Check</Button></div>
      </DialogContent>
    </Dialog>
  );
}

// ── Stock Check Detail ────────────────────────────────────────────────────────
function SCDetailDialog({ sc, items, onClose }: { sc: StockCheck; items: InventoryItem[]; onClose: () => void }) {
  const { data: scItems = [], refetch } = useQuery<any[]>({
    queryKey: ["/api/stock-checks", sc.id, "items"],
    queryFn: () => fetch(`/api/stock-checks/${sc.id}/items`).then(r => r.json()),
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selItemId, setSelItemId] = useState("");
  const [expected, setExpected] = useState("");
  const [counted, setCounted] = useState("");

  const addItem = async () => {
    if (!selItemId || counted === "") { toast({ title: "Item and counted qty required", variant: "destructive" }); return; }
    const it = items.find(i => i.id === selItemId);
    const exp = expected || it?.quantity?.toString() || "0";
    await apiRequest("POST", `/api/stock-checks/${sc.id}/items`, {
      stockItemId: selItemId, itemName: it?.name ?? "Unknown",
      unitOfMeasure: (it as any)?.unitOfMeasure ?? "units",
      expectedQuantity: exp, countedQuantity: counted,
      variance: String(Number(counted) - Number(exp)),
    });
    refetch();
    toast({ title: "Item added to check" });
    setSelItemId(""); setExpected(""); setCounted("");
  };

  const submitForApproval = async () => {
    await apiRequest("PUT", `/api/stock-checks/${sc.id}`, { status: "Pending Approval" });
    queryClient.invalidateQueries({ queryKey: ["/api/stock-checks"] });
    onClose();
    toast({ title: "Submitted for approval" });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{sc.checkNumber} — Stock Count</DialogTitle>
          <DialogDescription>Location: {sc.locationName} · By: {sc.checkedBy} · <Badge className={`text-xs ${statusBadge(sc.status)}`}>{sc.status}</Badge></DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="overflow-x-auto rounded border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b"><tr>
                <th className="text-left px-3 py-2 text-xs font-semibold uppercase text-gray-500">Item</th>
                <th className="text-left px-3 py-2 text-xs font-semibold uppercase text-gray-500">Expected</th>
                <th className="text-left px-3 py-2 text-xs font-semibold uppercase text-gray-500">Counted</th>
                <th className="text-left px-3 py-2 text-xs font-semibold uppercase text-gray-500">Variance</th>
              </tr></thead>
              <tbody>
                {scItems.length === 0 && <tr><td colSpan={4} className="px-3 py-4 text-center text-sm text-muted-foreground">No items counted yet.</td></tr>}
                {scItems.map((i: any) => {
                  const v = i.countedQuantity !== null ? Number(i.countedQuantity) - Number(i.expectedQuantity) : null;
                  return (
                    <tr key={i.id} className="border-b last:border-0">
                      <td className="px-3 py-2">{i.itemName}</td>
                      <td className="px-3 py-2">{Number(i.expectedQuantity)}</td>
                      <td className="px-3 py-2">{i.countedQuantity !== null ? Number(i.countedQuantity) : "—"}</td>
                      <td className={`px-3 py-2 font-semibold ${v === null ? "" : v < 0 ? "text-red-600" : v > 0 ? "text-blue-600" : "text-green-600"}`}>
                        {v === null ? "—" : v > 0 ? `+${v}` : String(v)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {sc.status === "In Progress" && (
            <>
              <div className="border rounded-lg p-3 space-y-2">
                <Label className="text-sm font-semibold">Add Item Count</Label>
                <div className="grid grid-cols-3 gap-2">
                  <select className="border rounded px-2 py-1.5 text-sm" value={selItemId} onChange={e => setSelItemId(e.target.value)}>
                    <option value="">Select item…</option>
                    {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                  <Input placeholder="Expected" type="number" value={expected} onChange={e => setExpected(e.target.value)} className="h-8 text-sm" />
                  <Input placeholder="Counted" type="number" value={counted} onChange={e => setCounted(e.target.value)} className="h-8 text-sm" />
                </div>
                <Button size="sm" onClick={addItem}><Plus className="h-3.5 w-3.5 mr-1" />Add</Button>
              </div>
              {scItems.length > 0 && (
                <div className="flex justify-end">
                  <Button size="sm" variant="outline" onClick={submitForApproval}>Submit for Approval</Button>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
