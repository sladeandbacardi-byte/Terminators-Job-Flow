import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import MobileNavigation from "@/components/layout/mobile-nav";
import InventoryForm from "@/components/forms/inventory-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Search, Plus, Package, Settings, Edit, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ExportButton } from "@/components/export-button";
import { exportInventory } from "@/lib/data-export";
import { DepartmentFilter } from "@/components/filters/department-filter";
import { useDepartmentFilter } from "@/hooks/useDepartmentFilter";
import type { InventoryItem, Department } from "@shared/schema";

interface StockAlerts {
  lowStock: InventoryItem[];
  reorderRequired: InventoryItem[];
  overstocked: InventoryItem[];
}

export default function Inventory() {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [alertsFilter, setAlertsFilter] = useState("all");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const departmentFilter = useDepartmentFilter();

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery<InventoryItem[]>({
    queryKey: ['/api/inventory'],
  });

  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ['/api/departments'],
  });

  const { data: stockAlerts } = useQuery<StockAlerts>({
    queryKey: ['/api/inventory/alerts/stock'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/inventory/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory'] });
      toast({
        title: "Success",
        description: "Inventory item deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete inventory item",
        variant: "destructive",
      });
    },
  });

  const filteredItems = departmentFilter.filteredData(
    items.filter(item => {
      const matchesSearch = searchTerm === "" || 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesType = typeFilter === "all" || item.type === typeFilter;
      
      // Stock alerts filter
      let matchesAlerts = true;
      if (alertsFilter === "critical") {
        matchesAlerts = item.quantity <= item.minStockLevel;
      } else if (alertsFilter === "low") {
        matchesAlerts = item.quantity <= item.reorderPoint && item.quantity > item.minStockLevel;
      } else if (alertsFilter === "reorder") {
        matchesAlerts = item.quantity <= item.reorderPoint;
      } else if (alertsFilter === "overstocked") {
        matchesAlerts = item.quantity >= item.maxStockLevel;
      }
      
      return matchesSearch && matchesType && matchesAlerts;
    })
  );

  const getDepartmentName = (departmentId: string | null) => {
    if (!departmentId) return "General";
    const department = departments.find(d => d.id === departmentId);
    return department?.name || 'Unknown Department';
  };

  const getTypeBadgeColor = (type: string) => {
    return type === 'rental_equipment' 
      ? 'bg-blue-100 text-blue-800' 
      : 'bg-green-100 text-green-800';
  };

  const getStockStatus = (item: InventoryItem) => {
    if (item.quantity <= item.minStockLevel) {
      return { status: 'critical', color: 'bg-red-100 text-red-800', label: 'Critical' };
    } else if (item.quantity <= item.reorderPoint) {
      return { status: 'low', color: 'bg-yellow-100 text-yellow-800', label: 'Low Stock' };
    } else if (item.quantity >= item.maxStockLevel) {
      return { status: 'overstocked', color: 'bg-purple-100 text-purple-800', label: 'Overstocked' };
    }
    return { status: 'normal', color: 'bg-green-100 text-green-800', label: 'Normal' };
  };

  const updateQuantityMutation = useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) => 
      apiRequest('PUT', `/api/inventory/${id}/quantity`, { quantity }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/alerts/stock'] });
      toast({
        title: "Success",
        description: "Inventory quantity updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update inventory quantity",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setIsFormOpen(true);
  };

  const handleDelete = (item: InventoryItem) => {
    if (confirm(`Are you sure you want to delete "${item.name}"?`)) {
      deleteMutation.mutate(item.id);
    }
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    setEditingItem(null);
  };

  return (
    <div className="min-h-screen flex bg-gray-50" data-testid="inventory-page">
      <Sidebar />
      
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="relative bg-white w-64 shadow-lg">
            <Sidebar />
          </div>
        </div>
      )}
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          title="Stock Management" 
          onMobileMenuToggle={() => setIsMobileMenuOpen(true)}
        />
        
        <main className="flex-1 overflow-y-auto p-6 pb-20 lg:pb-6">
          {/* Stock Alerts Summary */}
          {stockAlerts && (stockAlerts.lowStock.length > 0 || stockAlerts.reorderRequired.length > 0 || stockAlerts.overstocked.length > 0) && (
            <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              {stockAlerts.lowStock.length > 0 && (
                <button
                  onClick={() => setAlertsFilter(alertsFilter === "critical" ? "all" : "critical")}
                  className={`${
                    alertsFilter === "critical"
                      ? "bg-red-100 border-red-300 ring-2 ring-red-400"
                      : "bg-red-50 border-red-200"
                  } border rounded-lg p-4 text-left hover:bg-red-100 hover:border-red-300 transition-all cursor-pointer`}
                  data-testid="alert-critical-stock"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-red-500 rounded-full mr-3"></div>
                      <div>
                        <h3 className="font-semibold text-red-800">Critical Stock</h3>
                        <p className="text-sm text-red-600">{stockAlerts.lowStock.length} items below minimum</p>
                      </div>
                    </div>
                    {alertsFilter === "critical" && (
                      <span className="text-red-600 text-xs font-medium">Filtered</span>
                    )}
                  </div>
                </button>
              )}
              {stockAlerts.reorderRequired.length > 0 && (
                <button
                  onClick={() => setAlertsFilter(alertsFilter === "reorder" ? "all" : "reorder")}
                  className={`${
                    alertsFilter === "reorder"
                      ? "bg-yellow-100 border-yellow-300 ring-2 ring-yellow-400"
                      : "bg-yellow-50 border-yellow-200"
                  } border rounded-lg p-4 text-left hover:bg-yellow-100 hover:border-yellow-300 transition-all cursor-pointer`}
                  data-testid="alert-reorder-required"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-yellow-500 rounded-full mr-3"></div>
                      <div>
                        <h3 className="font-semibold text-yellow-800">Reorder Required</h3>
                        <p className="text-sm text-yellow-600">{stockAlerts.reorderRequired.length} items need restocking</p>
                      </div>
                    </div>
                    {alertsFilter === "reorder" && (
                      <span className="text-yellow-600 text-xs font-medium">Filtered</span>
                    )}
                  </div>
                </button>
              )}
              {stockAlerts.overstocked.length > 0 && (
                <button
                  onClick={() => setAlertsFilter(alertsFilter === "overstocked" ? "all" : "overstocked")}
                  className={`${
                    alertsFilter === "overstocked"
                      ? "bg-purple-100 border-purple-300 ring-2 ring-purple-400"
                      : "bg-purple-50 border-purple-200"
                  } border rounded-lg p-4 text-left hover:bg-purple-100 hover:border-purple-300 transition-all cursor-pointer`}
                  data-testid="alert-overstocked"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-purple-500 rounded-full mr-3"></div>
                      <div>
                        <h3 className="font-semibold text-purple-800">Overstocked</h3>
                        <p className="text-sm text-purple-600">{stockAlerts.overstocked.length} items above maximum</p>
                      </div>
                    </div>
                    {alertsFilter === "overstocked" && (
                      <span className="text-purple-600 text-xs font-medium">Filtered</span>
                    )}
                  </div>
                </button>
              )}
            </div>
          )}

          {/* Header Actions */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search inventory by name or SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="search-inventory"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                data-testid="filter-type"
              >
                <option value="all">All Types</option>
                <option value="product">Products</option>
                <option value="rental_equipment">Rental Equipment</option>
              </select>
              <div className="min-w-64">
                <DepartmentFilter
                  selectedDepartments={departmentFilter.selectedDepartments}
                  onSelectionChange={departmentFilter.setSelectedDepartments}
                />
              </div>
              <select
                value={alertsFilter}
                onChange={(e) => setAlertsFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                data-testid="filter-alerts"
              >
                <option value="all">All Stock Levels</option>
                <option value="critical">Critical Stock</option>
                <option value="low">Low Stock</option>
                <option value="reorder">Need Reorder</option>
                <option value="overstocked">Overstocked</option>
              </select>
              <ExportButton 
                onExportCSV={() => exportInventory(items)}
                entityName="Inventory"
                variant="outline"
                size="sm"
              />
              <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-item">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Item
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {editingItem ? "Edit Item" : "Add New Item"}
                    </DialogTitle>
                    <DialogDescription>
                      {editingItem ? "Update the inventory item details below." : "Fill in the details to add a new inventory item."}
                    </DialogDescription>
                  </DialogHeader>
                  <InventoryForm
                    item={editingItem}
                    onSuccess={handleFormSuccess}
                    onCancel={() => setIsFormOpen(false)}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Inventory Grid */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Inventory Items</h3>
              <p className="text-sm text-gray-600 mt-1">
                {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''} found
              </p>
            </div>
            
            {isLoading ? (
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="border border-gray-200 rounded-lg p-6 animate-pulse">
                      <div className="flex justify-between items-start mb-4">
                        <div className="h-5 bg-gray-200 rounded w-2/3"></div>
                        <div className="h-5 bg-gray-200 rounded w-16"></div>
                      </div>
                      <div className="space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                        <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                        <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="p-12 text-center">
                <Package className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No inventory items found</h3>
                <p className="text-gray-600">
                  {searchTerm || typeFilter !== "all" || !departmentFilter.isAllSelected
                    ? "Try adjusting your search or filter criteria."
                    : "Get started by adding your first inventory item."
                  }
                </p>
                {(!searchTerm && typeFilter === "all" && departmentFilter.isAllSelected) && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button className="mt-4" data-testid="button-add-first-item">
                        <Plus className="h-4 w-4 mr-2" />
                        Add First Item
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <InventoryForm
                        onSuccess={() => {}}
                        onCancel={() => {}}
                      />
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            ) : (
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredItems.map((item) => (
                    <div key={item.id} className="border border-gray-200 rounded-lg p-6 hover:bg-gray-50 transition-colors" data-testid={`inventory-item-${item.id}`}>
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="font-semibold text-gray-900 text-lg" data-testid={`item-name-${item.id}`}>
                          {item.name}
                        </h4>
                        <Badge 
                          className={getTypeBadgeColor(item.type)}
                          data-testid={`item-type-${item.id}`}
                        >
                          {item.type === 'rental_equipment' ? 'Rental' : 'Product'}
                        </Badge>
                      </div>
                      
                      {/* Stock Status Badge */}
                      <div className="mb-4">
                        <Badge className={getStockStatus(item).color} data-testid={`stock-status-${item.id}`}>
                          {getStockStatus(item).label}
                        </Badge>
                      </div>

                      <div className="space-y-3 text-sm text-gray-600 mb-4">
                        <div className="flex justify-between">
                          <span className="font-medium">SKU:</span>
                          <span data-testid={`item-sku-${item.id}`}>{item.sku}</span>
                        </div>
                        
                        {/* Current Stock with Visual Indicator */}
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="font-medium">Current Stock:</span>
                            <span className="font-semibold" data-testid={`item-quantity-${item.id}`}>{item.quantity}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full transition-all ${
                                item.quantity <= item.minStockLevel ? 'bg-red-500' :
                                item.quantity <= item.reorderPoint ? 'bg-yellow-500' :
                                item.quantity >= item.maxStockLevel ? 'bg-purple-500' : 'bg-green-500'
                              }`}
                              style={{ 
                                width: `${Math.min((item.quantity / item.maxStockLevel) * 100, 100)}%` 
                              }}
                            />
                          </div>
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>Min: {item.minStockLevel}</span>
                            <span>Reorder: {item.reorderPoint}</span>
                            <span>Max: {item.maxStockLevel}</span>
                          </div>
                        </div>

                        {item.unitPrice && (
                          <div className="flex justify-between">
                            <span className="font-medium">Unit Price:</span>
                            <span data-testid={`item-price-${item.id}`}>{formatCurrency(Number(item.unitPrice))}</span>
                          </div>
                        )}
                        
                        <div className="flex justify-between">
                          <span className="font-medium">Location:</span>
                          <span data-testid={`item-location-${item.id}`}>{item.location || 'Not specified'}</span>
                        </div>
                        
                        <div className="flex justify-between">
                          <span className="font-medium">Supplier:</span>
                          <span data-testid={`item-supplier-${item.id}`}>{item.supplier || 'Not specified'}</span>
                        </div>
                        
                        <div className="flex justify-between">
                          <span className="font-medium">Department:</span>
                          <span data-testid={`item-department-${item.id}`}>{getDepartmentName(item.departmentId)}</span>
                        </div>
                        
                        {item.lastRestocked && (
                          <div className="flex justify-between">
                            <span className="font-medium">Last Restocked:</span>
                            <span data-testid={`item-restocked-${item.id}`}>
                              {new Date(item.lastRestocked).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>

                      {item.description && (
                        <p className="text-sm text-gray-600 mb-4" data-testid={`item-description-${item.id}`}>
                          {item.description}
                        </p>
                      )}
                      
                      <div className="flex flex-col gap-2 pt-4 border-t border-gray-200">
                        {/* Quick quantity update */}
                        {item.quantity <= item.reorderPoint && (
                          <div className="flex items-center gap-2 mb-2">
                            <input
                              type="number"
                              min="0"
                              placeholder="New quantity"
                              className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const newQuantity = parseInt((e.target as HTMLInputElement).value);
                                  if (newQuantity >= 0) {
                                    updateQuantityMutation.mutate({ id: item.id, quantity: newQuantity });
                                    (e.target as HTMLInputElement).value = '';
                                  }
                                }
                              }}
                              data-testid={`input-quantity-${item.id}`}
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                const input = e.currentTarget.parentElement?.querySelector('input') as HTMLInputElement;
                                const newQuantity = parseInt(input.value);
                                if (newQuantity >= 0) {
                                  updateQuantityMutation.mutate({ id: item.id, quantity: newQuantity });
                                  input.value = '';
                                }
                              }}
                              data-testid={`button-update-quantity-${item.id}`}
                            >
                              Update
                            </Button>
                          </div>
                        )}
                        
                        <div className="flex justify-between">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(item)}
                            data-testid={`button-edit-${item.id}`}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(item)}
                            className="text-red-600 hover:text-red-700"
                            data-testid={`button-delete-${item.id}`}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
      
      <MobileNavigation />
    </div>
  );
}
