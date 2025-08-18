import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import MobileNavigation from "@/components/layout/mobile-nav";
import InventoryForm from "@/components/forms/inventory-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Search, Plus, Package, Settings, Edit, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { InventoryItem, Division } from "@shared/schema";

export default function Inventory() {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [divisionFilter, setDivisionFilter] = useState("all");
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery<InventoryItem[]>({
    queryKey: ['/api/inventory'],
  });

  const { data: divisions = [] } = useQuery<Division[]>({
    queryKey: ['/api/divisions'],
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

  const filteredItems = items.filter(item => {
    const matchesSearch = searchTerm === "" || 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = typeFilter === "all" || item.type === typeFilter;
    const matchesDivision = divisionFilter === "all" || item.divisionId === divisionFilter;
    
    return matchesSearch && matchesType && matchesDivision;
  });

  const getDivisionName = (divisionId: string | null) => {
    if (!divisionId) return "General";
    const division = divisions.find(d => d.id === divisionId);
    return division?.name || 'Unknown Division';
  };

  const getTypeBadgeColor = (type: string) => {
    return type === 'rental_equipment' 
      ? 'bg-blue-100 text-blue-800' 
      : 'bg-green-100 text-green-800';
  };

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
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Inventory Management" />
        
        <main className="flex-1 overflow-y-auto p-6 pb-20 lg:pb-6">
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
              <select
                value={divisionFilter}
                onChange={(e) => setDivisionFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                data-testid="filter-division"
              >
                <option value="all">All Divisions</option>
                {divisions.map(division => (
                  <option key={division.id} value={division.id}>{division.name}</option>
                ))}
              </select>
              <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-item">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Item
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                  {searchTerm || typeFilter !== "all" || divisionFilter !== "all"
                    ? "Try adjusting your search or filter criteria."
                    : "Get started by adding your first inventory item."
                  }
                </p>
                {(!searchTerm && typeFilter === "all" && divisionFilter === "all") && (
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
                      
                      <div className="space-y-3 text-sm text-gray-600 mb-4">
                        <div className="flex justify-between">
                          <span className="font-medium">SKU:</span>
                          <span data-testid={`item-sku-${item.id}`}>{item.sku}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-medium">Quantity:</span>
                          <span data-testid={`item-quantity-${item.id}`}>{item.quantity}</span>
                        </div>
                        {item.unitPrice && (
                          <div className="flex justify-between">
                            <span className="font-medium">Unit Price:</span>
                            <span data-testid={`item-price-${item.id}`}>{formatCurrency(Number(item.unitPrice))}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="font-medium">Division:</span>
                          <span data-testid={`item-division-${item.id}`}>{getDivisionName(item.divisionId)}</span>
                        </div>
                      </div>

                      {item.description && (
                        <p className="text-sm text-gray-600 mb-4" data-testid={`item-description-${item.id}`}>
                          {item.description}
                        </p>
                      )}
                      
                      <div className="flex justify-between pt-4 border-t border-gray-200">
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
