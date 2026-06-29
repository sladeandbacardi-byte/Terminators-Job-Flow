import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import MobileNavigation from "@/components/layout/mobile-nav";
import ContractForm from "@/components/forms/contract-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Search, Plus, FileText, AlertTriangle, Edit, Trash2, History, Clock,
  User, Package, Wrench, ChevronRight, Calendar, TrendingUp,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { formatZAR } from "@/components/forms/contract-form";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ExportButton } from "@/components/export-button";
import { exportContracts } from "@/lib/data-export";
import { useAuth } from "@/hooks/useAuth";
import { getDashboardRole } from "@/lib/dashboardRole";
import type { RentalContract, ServiceContract, Client, ContractDeletionHistory } from "@shared/schema";

type ContractType = "service" | "rental";
type StatusFilter = "all" | "active" | "inactive" | "ending" | "increase";
type TypeFilter = "all" | "service" | "rental";

type UnifiedContract =
  | (ServiceContract & { contractType: "service" })
  | (RentalContract   & { contractType: "rental" });

function scheduleLabel(c: any) {
  const parts = [
    c.frequency,
    c.weekOfMonth ? `Week ${c.weekOfMonth}` : null,
    c.dayOfWeek,
    c.startTime ? `@ ${c.startTime}` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

function isActiveFn(c: UnifiedContract) {
  if (c.contractType === "service") return !!(c as ServiceContract).activeStatus;
  const rc = c as RentalContract;
  return !!(rc.activeStatus ?? rc.isActive);
}

function priceDisplay(c: UnifiedContract) {
  if (c.contractType === "service") {
    const sc = c as ServiceContract;
    return sc.contractPrice ? Number(sc.contractPrice) : null;
  }
  const rc = c as RentalContract;
  return rc.calculatedTotal
    ? Number(rc.calculatedTotal)
    : rc.monthlyPrice
    ? Number(rc.monthlyPrice)
    : null;
}

function nextIncreaseDateFn(c: UnifiedContract) {
  if (c.contractType === "service") return (c as ServiceContract).increaseDate ?? null;
  return (c as RentalContract).nextIncreaseDate
    ? String((c as RentalContract).nextIncreaseDate)
    : null;
}

export default function Contracts() {
  const [searchTerm, setSearchTerm]     = useState("");
  const [typeFilter, setTypeFilter]     = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [isRentalFormOpen, setIsRentalFormOpen] = useState(false);
  const [editingRental, setEditingRental] = useState<RentalContract | null>(null);
  const [deletingContract, setDeletingContract] = useState<RentalContract | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [showHistory, setShowHistory]   = useState(false);

  const { user }   = useAuth();
  const role       = getDashboardRole(user ?? {});
  const isSales    = role === "sales";
  const [, navigate] = useLocation();

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: serviceContracts = [], isLoading: scLoading } = useQuery<ServiceContract[]>({
    queryKey: ["/api/service-contracts"],
  });
  const { data: rentalContracts = [], isLoading: rcLoading } = useQuery<RentalContract[]>({
    queryKey: ["/api/contracts"],
  });
  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: deletionHistory = [] } = useQuery<ContractDeletionHistory[]>({
    queryKey: ["/api/contracts/deletion-history"],
    enabled: showHistory,
  });

  const isLoading = scLoading || rcLoading;

  const allContracts: UnifiedContract[] = useMemo(() => {
    const scs = serviceContracts.map(sc => ({ ...sc, contractType: "service" as const }));
    const rcs = rentalContracts.map(rc => ({ ...rc, contractType: "rental" as const }));
    return [...scs, ...rcs].sort((a, b) => {
      const aActive = isActiveFn(a) ? 0 : 1;
      const bActive = isActiveFn(b) ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      return (a.contractNumber ?? "").localeCompare(b.contractNumber ?? "");
    });
  }, [serviceContracts, rentalContracts]);

  const filtered = useMemo(() => {
    const today = new Date();
    const in30  = new Date(); in30.setDate(in30.getDate() + 30);
    const in90  = new Date(); in90.setDate(in90.getDate() + 90);

    return allContracts.filter(c => {
      if (typeFilter === "service" && c.contractType !== "service") return false;
      if (typeFilter === "rental"  && c.contractType !== "rental")  return false;

      const active = isActiveFn(c);
      if (statusFilter === "active"   && !active) return false;
      if (statusFilter === "inactive" && active)  return false;
      if (statusFilter === "ending") {
        if (!c.endDate) return false;
        const end = new Date(c.endDate);
        if (!(end >= today && end <= in30)) return false;
      }
      if (statusFilter === "increase") {
        const nd = nextIncreaseDateFn(c);
        if (!nd) return false;
        try { const d = new Date(nd); if (!(d >= today && d <= in90)) return false; }
        catch { return false; }
      }

      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const client = clients.find(cl => cl.id === c.clientId);
        const hit =
          (client?.name ?? "").toLowerCase().includes(q) ||
          (c.contractNumber ?? "").toLowerCase().includes(q) ||
          (c.contractType === "service"
            ? (c as ServiceContract).serviceType.toLowerCase().includes(q)
            : false) ||
          (c.frequency ?? "").toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [allContracts, typeFilter, statusFilter, searchTerm, clients]);

  const deleteMutation = useMutation({
    mutationFn: ({ id, reason, clientName, itemName }: { id: string; reason: string; clientName: string; itemName: string }) =>
      apiRequest("DELETE", `/api/contracts/${id}`, {
        reason, clientName, itemName,
        deletedBy: (user as any)?.name ?? (user as any)?.username ?? "Unknown",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/deletion-history"] });
      setDeletingContract(null);
      setDeleteReason("");
      toast({ title: "Contract deleted", description: "The deletion reason has been recorded." });
    },
    onError: () => toast({ title: "Error", description: "Failed to delete contract", variant: "destructive" }),
  });

  const getClientName = (clientId: string) => clients.find(c => c.id === clientId)?.name ?? "Unknown Client";

  const handleNewContractType = (type: ContractType) => {
    setShowTypePicker(false);
    if (type === "service") {
      navigate("/service-contracts?newContract=1");
    } else {
      setEditingRental(null);
      setIsRentalFormOpen(true);
    }
  };

  const handleEditRental = (rc: RentalContract) => {
    setEditingRental(rc);
    setIsRentalFormOpen(true);
  };

  const counts = useMemo(() => ({
    all:      allContracts.length,
    service:  allContracts.filter(c => c.contractType === "service").length,
    rental:   allContracts.filter(c => c.contractType === "rental").length,
    active:   allContracts.filter(isActiveFn).length,
    inactive: allContracts.filter(c => !isActiveFn(c)).length,
  }), [allContracts]);

  const filterChips: Array<{ key: TypeFilter | StatusFilter; label: string; count?: number; icon?: any }> = [
    { key: "all",      label: "All Contracts",      count: counts.all },
    { key: "service",  label: "Service Contracts",   count: counts.service,  icon: Wrench },
    { key: "rental",   label: "Rental Contracts",    count: counts.rental,   icon: Package },
    { key: "active",   label: "Active",              count: counts.active },
    { key: "inactive", label: "Inactive",            count: counts.inactive },
    { key: "ending",   label: "Contracts Ending",    icon: Calendar },
    { key: "increase", label: "Increase Dates Due",  icon: TrendingUp },
  ];

  return (
    <div className="min-h-screen flex bg-gray-50" data-testid="contracts-page">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Contracts" />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-20 lg:pb-6">

          {/* ── Top bar ── */}
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by client, contract number, service type…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <ExportButton
                onExportCSV={() => exportContracts(rentalContracts)}
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
                History
                {deletionHistory.length > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs">{deletionHistory.length}</Badge>
                )}
              </Button>
              {!isSales && (
                <Button onClick={() => setShowTypePicker(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Contract
                </Button>
              )}
            </div>
          </div>

          {/* ── Filter chips ── */}
          <div className="flex flex-wrap gap-2 mb-5">
            {filterChips.map(chip => {
              const isTypeChip   = ["all","service","rental"].includes(chip.key);
              const isStatusChip = ["all","active","inactive","ending","increase"].includes(chip.key);
              const isActive =
                (isTypeChip   && typeFilter   === chip.key) ||
                (isStatusChip && statusFilter === chip.key && !isTypeChip) ||
                (chip.key === "all" && typeFilter === "all" && statusFilter === "all");

              const active2 =
                chip.key === "all"      ? typeFilter === "all" && statusFilter === "all"
                : chip.key === "service"? typeFilter === "service"
                : chip.key === "rental" ? typeFilter === "rental"
                : statusFilter === chip.key;

              const Icon = chip.icon;
              return (
                <button
                  key={chip.key}
                  onClick={() => {
                    if (chip.key === "all")     { setTypeFilter("all"); setStatusFilter("all"); }
                    else if (["service","rental"].includes(chip.key)) { setTypeFilter(chip.key as TypeFilter); setStatusFilter("all"); }
                    else                        { setTypeFilter("all"); setStatusFilter(chip.key as StatusFilter); }
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    active2
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {Icon && <Icon className="h-3.5 w-3.5" />}
                  {chip.label}
                  {chip.count !== undefined && (
                    <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${active2 ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600"}`}>
                      {chip.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Deletion History ── */}
          {showHistory && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
              <div className="p-5 border-b border-gray-200 flex items-center gap-2">
                <History className="h-5 w-5 text-gray-500" />
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Contract Deletion History</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Permanent record of all deleted contracts with reasons</p>
                </div>
              </div>
              {deletionHistory.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <History className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No deleted contracts on record yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {deletionHistory.map(entry => (
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
                            {entry.monthlyPrice && <span>{formatZAR(Number(entry.monthlyPrice))}/mo</span>}
                            {entry.startDate && <span>{formatDate(entry.startDate)} – {entry.endDate ? formatDate(entry.endDate) : "open"}</span>}
                          </div>
                          <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-sm text-amber-900">
                            <span className="font-medium">Reason: </span>{entry.reason}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0 text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(entry.deletedAt).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                          {entry.deletedBy && <span className="flex items-center gap-1"><User className="h-3 w-3" />{entry.deletedBy}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Combined Contracts List ── */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900">All Contracts</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {filtered.length} contract{filtered.length !== 1 ? "s" : ""} found
                  {typeFilter !== "all" && ` · ${typeFilter === "service" ? "Service" : "Rental"} only`}
                  {statusFilter !== "all" && ` · ${statusFilter}`}
                </p>
              </div>
            </div>

            {isLoading ? (
              <div className="p-6 space-y-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="border border-gray-100 rounded-lg p-5 animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-40 mb-3" />
                    <div className="grid grid-cols-4 gap-4">
                      {[...Array(4)].map((_, j) => <div key={j} className="h-3 bg-gray-100 rounded" />)}
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No contracts found</h3>
                <p className="text-gray-500 text-sm">
                  {searchTerm || typeFilter !== "all" || statusFilter !== "all"
                    ? "Try adjusting your search or filter."
                    : "Create your first contract using the New Contract button above."}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filtered.map(contract => {
                  const isService = contract.contractType === "service";
                  const sc        = isService ? (contract as ServiceContract) : null;
                  const rc        = !isService ? (contract as RentalContract) : null;
                  const active    = isActiveFn(contract);
                  const price     = priceDisplay(contract);
                  const nextInc   = nextIncreaseDateFn(contract);
                  const clientName = getClientName(contract.clientId);
                  const schedule  = scheduleLabel(contract);

                  const today = new Date();
                  const endDate = contract.endDate ? new Date(contract.endDate) : null;
                  const daysLeft = endDate ? Math.ceil((endDate.getTime() - today.getTime()) / 86400000) : null;
                  const endingSoon = daysLeft !== null && daysLeft <= 30 && daysLeft >= 0;

                  return (
                    <div key={contract.id} className="p-5 hover:bg-gray-50 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          {/* Header row */}
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            {contract.contractNumber && (
                              <span className={`font-mono text-xs px-2 py-0.5 rounded font-medium ${
                                isService ? "bg-blue-50 text-blue-700 border border-blue-100"
                                           : "bg-purple-50 text-purple-700 border border-purple-100"
                              }`}>
                                {contract.contractNumber}
                              </span>
                            )}
                            <Badge className={isService
                              ? "bg-blue-100 text-blue-800 text-xs font-medium"
                              : "bg-purple-100 text-purple-800 text-xs font-medium"
                            }>
                              {isService ? <Wrench className="h-3 w-3 mr-1 inline" /> : <Package className="h-3 w-3 mr-1 inline" />}
                              {isService ? "Service Contract" : "Rental Contract"}
                            </Badge>
                            <Badge className={active
                              ? "bg-green-100 text-green-800 text-xs"
                              : "bg-gray-100 text-gray-600 text-xs"
                            }>
                              {active ? "Active" : "Inactive"}
                            </Badge>
                            {endingSoon && (
                              <Badge className="bg-orange-100 text-orange-800 text-xs">
                                <AlertTriangle className="h-3 w-3 mr-1 inline" />
                                Ends in {daysLeft}d
                              </Badge>
                            )}
                          </div>

                          {/* Client + service/items */}
                          <Link href={`/clients/${contract.clientId}`}>
                            <span className="font-semibold text-gray-900 hover:text-blue-700 hover:underline cursor-pointer">
                              {clientName}
                            </span>
                          </Link>
                          <p className="text-sm text-gray-600 mt-0.5">
                            {isService ? sc!.serviceType : "Rental Items"}
                          </p>

                          {/* Detail grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1.5 mt-3 text-xs text-gray-500">
                            {schedule && (
                              <div className="col-span-2">
                                <span className="font-medium text-gray-400 uppercase tracking-wide block mb-0.5">Schedule</span>
                                <span className="text-gray-700">{schedule}</span>
                              </div>
                            )}
                            {price !== null && (
                              <div>
                                <span className="font-medium text-gray-400 uppercase tracking-wide block mb-0.5">Price</span>
                                <span className="text-gray-700 font-medium">{formatZAR(price)}</span>
                                {isService ? null : <span className="text-gray-400">/mo</span>}
                              </div>
                            )}
                            {contract.startDate && (
                              <div>
                                <span className="font-medium text-gray-400 uppercase tracking-wide block mb-0.5">Start</span>
                                <span className="text-gray-700">{formatDate(contract.startDate)}</span>
                              </div>
                            )}
                            {contract.endDate && (
                              <div>
                                <span className="font-medium text-gray-400 uppercase tracking-wide block mb-0.5">End</span>
                                <span className={endingSoon ? "text-orange-600 font-medium" : "text-gray-700"}>
                                  {formatDate(contract.endDate)}
                                </span>
                              </div>
                            )}
                            {nextInc && (
                              <div>
                                <span className="font-medium text-gray-400 uppercase tracking-wide block mb-0.5">Next Increase</span>
                                <span className="text-gray-700">{formatDate(nextInc)}</span>
                              </div>
                            )}
                            {(isService ? sc!.increasePercentage : rc!.increasePercentage) && (
                              <div>
                                <span className="font-medium text-gray-400 uppercase tracking-wide block mb-0.5">Increase %</span>
                                <span className="text-gray-700">
                                  {isService ? sc!.increasePercentage : rc!.increasePercentage}%
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        {!isSales && (
                          <div className="flex sm:flex-col gap-2 shrink-0">
                            {isService ? (
                              <Link href={`/service-contracts`}>
                                <Button variant="outline" size="sm" className="text-xs w-full">
                                  <Edit className="h-3.5 w-3.5 mr-1" />View / Edit
                                </Button>
                              </Link>
                            ) : (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs"
                                  onClick={() => handleEditRental(contract as RentalContract)}
                                >
                                  <Edit className="h-3.5 w-3.5 mr-1" />Edit
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs text-red-600 hover:text-red-700"
                                  onClick={() => { setDeletingContract(contract as RentalContract); setDeleteReason(""); }}
                                >
                                  <Trash2 className="h-3.5 w-3.5 mr-1" />Delete
                                </Button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </main>
      </div>
      <MobileNavigation />

      {/* ── Type Picker Dialog ── */}
      <Dialog open={showTypePicker} onOpenChange={setShowTypePicker}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Contract</DialogTitle>
            <DialogDescription>Choose the type of contract to create.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 pt-2">
            <button
              onClick={() => handleNewContractType("service")}
              className="flex items-center gap-4 p-4 border-2 border-blue-100 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-colors text-left group"
            >
              <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                <Wrench className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Service Contract</p>
                <p className="text-xs text-gray-500 mt-0.5">Recurring visits — pest control, washroom, hygiene services</p>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-400 ml-auto" />
            </button>
            <button
              onClick={() => handleNewContractType("rental")}
              className="flex items-center gap-4 p-4 border-2 border-purple-100 rounded-xl hover:border-purple-400 hover:bg-purple-50 transition-colors text-left group"
            >
              <div className="p-2 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
                <Package className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Rental Contract</p>
                <p className="text-xs text-gray-500 mt-0.5">Equipment rentals — aerosol units, sanitary bins, dispensers</p>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-400 ml-auto" />
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Rental Contract Form Dialog ── */}
      <Dialog open={isRentalFormOpen} onOpenChange={open => { setIsRentalFormOpen(open); if (!open) setEditingRental(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRental ? "Edit Rental Contract" : "New Rental Contract"}</DialogTitle>
            <DialogDescription>
              {editingRental ? "Update the rental contract details." : "Fill in the details to create a new rental contract."}
            </DialogDescription>
          </DialogHeader>
          <ContractForm
            contract={editingRental}
            onSuccess={() => { setIsRentalFormOpen(false); setEditingRental(null); }}
            onCancel={() => { setIsRentalFormOpen(false); setEditingRental(null); }}
          />
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ── */}
      <AlertDialog open={!!deletingContract} onOpenChange={open => { if (!open) { setDeletingContract(null); setDeleteReason(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rental Contract</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the rental contract for{" "}
              <strong>{deletingContract ? getClientName(deletingContract.clientId) : ""}</strong>.
              Please provide a reason.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Reason for deletion (required)…"
            value={deleteReason}
            onChange={e => setDeleteReason(e.target.value)}
            className="my-2"
            rows={3}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!deleteReason.trim() || deleteMutation.isPending}
              onClick={() => {
                if (!deletingContract || !deleteReason.trim()) return;
                deleteMutation.mutate({
                  id: deletingContract.id,
                  reason: deleteReason.trim(),
                  clientName: getClientName(deletingContract.clientId),
                  itemName: deletingContract.contractNumber ?? "Rental Contract",
                });
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
