import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import MobileNavigation from "@/components/layout/mobile-nav";
import ContractForm from "@/components/forms/contract-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Search, Plus, FileText, AlertTriangle, Edit, Trash2, History, Clock, User, Package } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { formatZAR } from "@/components/forms/contract-form";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ExportButton } from "@/components/export-button";
import { exportContracts } from "@/lib/data-export";
import { useAuth } from "@/hooks/useAuth";
import { getDashboardRole } from "@/lib/dashboardRole";
import type { RentalContract, Client, InventoryItem, ContractDeletionHistory } from "@shared/schema";
import { ServiceContractsContent } from "@/pages/service-contracts";

export default function Contracts() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingContract, setEditingContract] = useState<RentalContract | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deletingContract, setDeletingContract] = useState<RentalContract | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [showHistory, setShowHistory] = useState(false);

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

  const { data: deletionHistory = [] } = useQuery<ContractDeletionHistory[]>({
    queryKey: ['/api/contracts/deletion-history'],
    enabled: showHistory,
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, reason, clientName, itemName }: { id: string; reason: string; clientName: string; itemName: string }) =>
      apiRequest('DELETE', `/api/contracts/${id}`, { reason, clientName, itemName, deletedBy: (user as any)?.name ?? (user as any)?.username ?? "Unknown" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contracts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contracts/deletion-history'] });
      setDeletingContract(null);
      setDeleteReason("");
      toast({ title: "Contract deleted", description: "The deletion reason has been recorded." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete contract", variant: "destructive" });
    },
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

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    setEditingContract(null);
  };

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

  return (
    <div className="min-h-screen flex bg-gray-50" data-testid="contracts-page">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Contracts" />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-20 lg:pb-6">

          {/* ── Service Contracts ── */}
          <ServiceContractsContent />

          {/* ── Rental Contracts ── */}
          <div className="mt-8">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5 text-gray-500" />
              Rental Contracts
            </h2>
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
            <div className="flex gap-2 flex-wrap">
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHistory(!showHistory)}
                className={showHistory ? "bg-gray-100" : ""}
              >
                <History className="h-4 w-4 mr-2" />
                Deletion History
                {deletionHistory.length > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs">{deletionHistory.length}</Badge>
                )}
              </Button>
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

          {/* Deletion History Panel */}
          {showHistory && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
              <div className="p-5 border-b border-gray-200 flex items-center gap-2">
                <History className="h-5 w-5 text-gray-500" />
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Contract Deletion History</h3>
                  <p className="text-xs text-gray-500 mt-0.5">A permanent record of all deleted contracts and the reasons given</p>
                </div>
              </div>
              {deletionHistory.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <History className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No deleted contracts on record yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {deletionHistory.map((entry) => (
                    <div key={entry.id} className="p-4 hover:bg-gray-50">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            {entry.contractNumber && (
                              <span className="text-xs font-mono font-medium text-blue-700 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded">
                                {entry.contractNumber}
                              </span>
                            )}
                            <span className="font-semibold text-gray-900 text-sm">{entry.clientName}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                            <span className="flex items-center gap-1"><Package className="h-3 w-3" />{entry.itemName}</span>
                            {entry.monthlyPrice && (
                              <span>{formatZAR(Number(entry.monthlyPrice))}/mo</span>
                            )}
                            {entry.startDate && (
                              <span>{formatDate(entry.startDate)} – {entry.endDate ? formatDate(entry.endDate) : "open"}</span>
                            )}
                          </div>
                          <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-sm text-amber-900">
                            <span className="font-medium">Reason: </span>{entry.reason}
                          </div>
                          {entry.notes && (
                            <p className="text-xs text-gray-500 mt-1">Notes: {entry.notes}</p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0 text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(entry.deletedAt).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                          {entry.deletedBy && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />{entry.deletedBy}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

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
                      <ContractForm onSuccess={() => {}} onCancel={() => {}} />
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
                              <Link href={`/clients/${contract.clientId}`} className="text-blue-700 hover:text-blue-900 hover:underline">
                                {getClientName(contract.clientId)}
                              </Link>
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
                              onClick={() => { setDeletingContract(contract); setDeleteReason(""); }}
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
          </div>
        </main>
      </div>

      <MobileNavigation />

      {/* Delete with reason dialog */}
      <AlertDialog open={!!deletingContract} onOpenChange={(open) => { if (!open) { setDeletingContract(null); setDeleteReason(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete contract?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p className="mb-3">
                  You are about to permanently delete the contract for{" "}
                  <strong>{deletingContract ? getClientName(deletingContract.clientId) : ""}</strong>
                  {deletingContract && ` — ${getItemName(deletingContract.inventoryItemId)}`}.
                </p>
                <p className="mb-2 text-sm font-medium text-gray-700">Reason for deletion <span className="text-red-500">*</span></p>
                <Textarea
                  placeholder="e.g. Client cancelled service, contract expired, moved premises…"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  rows={3}
                  className="text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">This reason will be saved to the deletion history log.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!deletingContract) return;
                deleteMutation.mutate({
                  id: deletingContract.id,
                  reason: deleteReason.trim() || "No reason provided",
                  clientName: getClientName(deletingContract.clientId),
                  itemName: getItemName(deletingContract.inventoryItemId),
                });
              }}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete Contract"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
