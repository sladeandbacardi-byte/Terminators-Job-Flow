import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import MobileNavigation from "@/components/layout/mobile-nav";
import ContractForm from "@/components/forms/contract-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Search, Plus, FileText, AlertTriangle, Edit, Trash2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { formatZAR } from "@/components/forms/contract-form";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ExportButton } from "@/components/export-button";
import { exportContracts } from "@/lib/data-export";
import { useAuth } from "@/hooks/useAuth";
import { getDashboardRole } from "@/lib/dashboardRole";
import type { RentalContract, Client, InventoryItem } from "@shared/schema";

export default function Contracts() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingContract, setEditingContract] = useState<RentalContract | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const { user } = useAuth();
  const role = getDashboardRole(user ?? {});
  const isSales = role === "sales";

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: contracts = [], isLoading } = useQuery<RentalContract[]>({
    queryKey: ['/api/contracts'],
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
  });

  const { data: inventoryItems = [] } = useQuery<InventoryItem[]>({
    queryKey: ['/api/inventory'],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/contracts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contracts'] });
      toast({
        title: "Success",
        description: "Contract deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete contract",
        variant: "destructive",
      });
    },
  });

  const filteredContracts = contracts.filter(contract => {
    const client = clients.find(c => c.id === contract.clientId);
    const item = inventoryItems.find(i => i.id === contract.inventoryItemId);
    
    const matchesSearch = searchTerm === "" || 
      client?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contract.contractNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || 
      (statusFilter === "active" && contract.isActive) ||
      (statusFilter === "inactive" && !contract.isActive);
    
    return matchesSearch && matchesStatus;
  });

  const getClientName = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return client?.name || 'Unknown Client';
  };

  const getItemName = (itemId: string) => {
    const item = inventoryItems.find(i => i.id === itemId);
    return item?.name || 'Unknown Item';
  };

  const isExpiringSoon = (contract: RentalContract) => {
    if (!contract.endDate) return false;
    const endDate = new Date(contract.endDate);
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return endDate <= thirtyDaysFromNow;
  };

  const getDaysUntilExpiry = (contract: RentalContract) => {
    if (!contract.endDate) return null;
    const endDate = new Date(contract.endDate);
    const today = new Date();
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const handleEdit = (contract: RentalContract) => {
    setEditingContract(contract);
    setIsFormOpen(true);
  };

  const handleDelete = (contract: RentalContract) => {
    if (confirm(`Are you sure you want to delete this contract?`)) {
      deleteMutation.mutate(contract.id);
    }
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    setEditingContract(null);
  };

  return (
    <div className="min-h-screen flex bg-gray-50" data-testid="contracts-page">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Rental Contracts" />
        
        <main className="flex-1 overflow-y-auto p-6 pb-20 lg:pb-6">
          {/* Header Actions */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search contracts by client or equipment..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="search-contracts"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                data-testid="filter-status"
              >
                <option value="all">All Contracts</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <ExportButton 
                onExportCSV={() => exportContracts(contracts)}
                entityName="Contracts"
                variant="outline"
                size="sm"
              />
              {!isSales && (
                <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-create-contract">
                      <Plus className="h-4 w-4 mr-2" />
                      Create Contract
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>
                        {editingContract ? "Edit Contract" : "Create New Contract"}
                      </DialogTitle>
                      <DialogDescription>
                        {editingContract ? "Update the rental contract details below." : "Fill in the details to create a new rental contract."}
                      </DialogDescription>
                    </DialogHeader>
                    <ContractForm
                      contract={editingContract}
                      onSuccess={handleFormSuccess}
                      onCancel={() => setIsFormOpen(false)}
                    />
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>

          {/* Contracts List */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Rental Contracts</h3>
              <p className="text-sm text-gray-600 mt-1">
                {filteredContracts.length} contract{filteredContracts.length !== 1 ? 's' : ''} found
              </p>
            </div>
            
            {isLoading ? (
              <div className="p-6">
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="border border-gray-200 rounded-lg p-6 animate-pulse">
                      <div className="flex justify-between items-start mb-4">
                        <div className="space-y-2">
                          <div className="h-5 bg-gray-200 rounded w-48"></div>
                          <div className="h-4 bg-gray-200 rounded w-32"></div>
                        </div>
                        <div className="h-5 bg-gray-200 rounded w-16"></div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {[...Array(4)].map((_, j) => (
                          <div key={j} className="space-y-1">
                            <div className="h-3 bg-gray-200 rounded w-16"></div>
                            <div className="h-4 bg-gray-200 rounded w-20"></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : filteredContracts.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No contracts found</h3>
                <p className="text-gray-600">
                  {searchTerm || statusFilter !== "all"
                    ? "Try adjusting your search or filter criteria."
                    : "Get started by creating your first rental contract."
                  }
                </p>
                {(!searchTerm && statusFilter === "all") && !isSales && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button className="mt-4" data-testid="button-create-first-contract">
                        <Plus className="h-4 w-4 mr-2" />
                        Create First Contract
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <ContractForm
                        onSuccess={() => {}}
                        onCancel={() => {}}
                      />
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            ) : (
              <div className="p-6">
                <div className="space-y-4">
                  {filteredContracts.map((contract) => {
                    const expiringSoon = isExpiringSoon(contract);
                    const daysUntilExpiry = getDaysUntilExpiry(contract);
                    
                    return (
                      <div key={contract.id} className="border border-gray-200 rounded-lg p-6 hover:bg-gray-50 transition-colors" data-testid={`contract-${contract.id}`}>
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            {contract.contractNumber && (
                              <span className="inline-block text-xs font-mono font-medium text-blue-700 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded mb-1">
                                {contract.contractNumber}
                              </span>
                            )}
                            <h4 className="font-semibold text-gray-900 text-lg" data-testid={`contract-client-${contract.id}`}>
                              {getClientName(contract.clientId)}
                            </h4>
                            <p className="text-gray-600" data-testid={`contract-item-${contract.id}`}>
                              {getItemName(contract.inventoryItemId)}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            {expiringSoon && contract.isActive && (
                              <Badge className="bg-orange-100 text-orange-800" data-testid={`contract-expiry-warning-${contract.id}`}>
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Expires in {daysUntilExpiry} days
                              </Badge>
                            )}
                            <Badge 
                              className={contract.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
                              data-testid={`contract-status-${contract.id}`}
                            >
                              {contract.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                        </div>
                        
                        {/* Pricing summary row */}
                        {(() => {
                          const hasNew = contract.unitPrice && contract.quantity && contract.billingFrequency;
                          const qty = Number(contract.quantity ?? 1);
                          const up  = Number(contract.unitPrice ?? contract.monthlyPrice ?? 0);
                          const tot = Number(contract.calculatedTotal ?? (up * qty));
                          const freqSuffixMap: Record<string, string> = {
                            weekly: "per week", monthly: "per month", quarterly: "per quarter",
                            annually: "per year", "once-off": "once-off",
                          };
                          const freq = contract.billingFrequency ?? "monthly";
                          const suffix = freqSuffixMap[freq] ?? freq;
                          return (
                            <div className="mb-4" data-testid={`contract-price-${contract.id}`}>
                              {hasNew ? (
                                <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
                                  <p className="text-sm font-semibold text-blue-900">
                                    {qty} {qty === 1 ? "unit" : "units"} x {formatZAR(up)} {freq} = {" "}
                                    <span className="text-blue-700">{formatZAR(tot)}</span>{" "}
                                    <span className="font-normal text-blue-600">{suffix}</span>
                                  </p>
                                </div>
                              ) : (
                                <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
                                  <p className="text-sm font-semibold text-gray-700">
                                    {formatZAR(Number(contract.monthlyPrice ?? 0))}{" "}
                                    <span className="font-normal text-gray-500">per month</span>
                                  </p>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm text-gray-600 mb-4">
                          <div>
                            <span className="font-medium text-gray-500 text-xs uppercase tracking-wide block mb-0.5">Start Date</span>
                            <p className="text-gray-900" data-testid={`contract-start-${contract.id}`}>{formatDate(contract.startDate)}</p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-500 text-xs uppercase tracking-wide block mb-0.5">End Date</span>
                            <p className="text-gray-900" data-testid={`contract-end-${contract.id}`}>
                              {contract.endDate ? formatDate(contract.endDate) : "Indefinite"}
                            </p>
                          </div>
                          {contract.billingFrequency && (
                            <div>
                              <span className="font-medium text-gray-500 text-xs uppercase tracking-wide block mb-0.5">Frequency</span>
                              <p className="text-gray-900 capitalize">{contract.billingFrequency}</p>
                            </div>
                          )}
                          <div>
                            <span className="font-medium text-gray-500 text-xs uppercase tracking-wide block mb-0.5">Last Price Increase</span>
                            <p className="text-gray-900" data-testid={`contract-increase-${contract.id}`}>
                              {contract.lastPriceIncrease ? formatDate(contract.lastPriceIncrease) : "Never"}
                            </p>
                          </div>
                        </div>

                        {contract.notes && (
                          <p className="text-sm text-gray-600 mb-4" data-testid={`contract-notes-${contract.id}`}>
                            <span className="font-medium">Notes:</span> {contract.notes}
                          </p>
                        )}
                        
                        {!isSales && (
                          <div className="flex justify-between pt-4 border-t border-gray-200">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(contract)}
                              data-testid={`button-edit-contract-${contract.id}`}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(contract)}
                              className="text-red-600 hover:text-red-700"
                              data-testid={`button-delete-contract-${contract.id}`}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Delete
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
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
