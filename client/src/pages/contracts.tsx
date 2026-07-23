import { useState, useMemo, useEffect } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import UnifiedContractForm from "@/components/forms/unified-contract-form";
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
  User, Package, Wrench, ChevronRight, Calendar, TrendingUp, ListOrdered,
  Settings, Save, Loader2,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/utils";
import { formatZAR } from "@/components/forms/contract-form";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ExportButton } from "@/components/export-button";
import { exportContracts } from "@/lib/data-export";
import { useAuth } from "@/hooks/useAuth";
import { getDashboardRole } from "@/lib/dashboardRole";
import type { RentalContract, ServiceContract, Client, ContractDeletionHistory } from "@shared/schema";

type StatusFilter = "all" | "active" | "inactive" | "ending" | "increase";
type TypeFilter = "all" | "unified" | "service" | "rental";

type UnifiedLegacy =
  | (ServiceContract & { contractType: "service" })
  | (RentalContract & { contractType: "rental" });

function scheduleLabel(c: any) {
  return [
    c.frequency,
    c.weekOfMonth ? `Week ${c.weekOfMonth}` : null,
    c.dayOfWeek,
    c.startTime ? `@ ${c.startTime}` : null,
  ].filter(Boolean).join(" · ");
}

function isActiveLegacy(c: UnifiedLegacy) {
  if (c.contractType === "service") return !!(c as ServiceContract).activeStatus;
  const rc = c as RentalContract;
  return !!(rc.activeStatus ?? rc.isActive);
}

function priceDisplay(c: UnifiedLegacy) {
  if (c.contractType === "service") return c.contractPrice ? Number(c.contractPrice) : null;
  const rc = c as RentalContract;
  return rc.calculatedTotal ? Number(rc.calculatedTotal) : rc.monthlyPrice ? Number(rc.monthlyPrice) : null;
}

function nextIncreaseDate(c: UnifiedLegacy) {
  if (c.contractType === "service") return (c as ServiceContract).increaseDate ?? null;
  return (c as RentalContract).nextIncreaseDate ? String((c as RentalContract).nextIncreaseDate) : null;
}

export default function Contracts() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [editingUnified, setEditingUnified] = useState<any | null>(null);
  const [deletingUnified, setDeletingUnified] = useState<any | null>(null);
  const [isRentalFormOpen, setIsRentalFormOpen] = useState(false);
  const [editingRental, setEditingRental] = useState<RentalContract | null>(null);
  const [deletingRental, setDeletingRental] = useState<RentalContract | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [showDefaults, setShowDefaults] = useState(false);
  const [defaultsDraft, setDefaultsDraft] = useState<Record<string, { defaultTeamName: string; defaultTechnicianName: string }>>({});
  const [savingDefault, setSavingDefault] = useState<string | null>(null);

  const { user } = useAuth();
  const role = getDashboardRole(user ?? {});
  const isSales = role === "sales";
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: unifiedContracts = [], isLoading: ucLoading } = useQuery<any[]>({
    queryKey: ["/api/unified-contracts"],
  });
  const { data: serviceContracts = [], isLoading: scLoading } = useQuery<ServiceContract[]>({
    queryKey: ["/api/service-contracts"],
  });
  const { data: rentalContracts = [], isLoading: rcLoading } = useQuery<RentalContract[]>({
    queryKey: ["/api/contracts"],
  });
  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: departments = [] } = useQuery<any[]>({ queryKey: ["/api/departments"] });
  const { data: deptDefaults = [], refetch: refetchDefaults } = useQuery<any[]>({
    queryKey: ["/api/department-defaults"],
    enabled: showDefaults,
  });
  const { data: deletionHistory = [] } = useQuery<ContractDeletionHistory[]>({
    queryKey: ["/api/contracts/deletion-history"],
    enabled: showHistory,
  });

  const isLoading = ucLoading || scLoading || rcLoading;
  const getClientName = (clientId: string) => clients.find(c => c.id === clientId)?.name ?? "Unknown";

  const searchParams = useSearch();
  const openContractId = new URLSearchParams(searchParams).get('open');
  useEffect(() => {
    if (!openContractId || unifiedContracts.length === 0) return;
    const found = unifiedContracts.find((c: any) => c.id === openContractId);
    if (found) {
      setEditingUnified(found);
      setIsNewOpen(true);
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [unifiedContracts, openContractId]);

  // ── Department defaults helpers ─────────────────────────────────────────────
  const getDraftForDept = (deptName: string) => {
    if (defaultsDraft[deptName] !== undefined) return defaultsDraft[deptName];
    const existing = deptDefaults.find((d: any) => d.department === deptName);
    return { defaultTeamName: existing?.defaultTeamName ?? "", defaultTechnicianName: existing?.defaultTechnicianName ?? "" };
  };

  const saveDeptDefault = async (deptName: string) => {
    const draft = getDraftForDept(deptName);
    setSavingDefault(deptName);
    try {
      await apiRequest("PUT", `/api/department-defaults/${encodeURIComponent(deptName)}`, {
        department: deptName,
        defaultTeamName: draft.defaultTeamName || null,
        defaultTechnicianName: draft.defaultTechnicianName || null,
      });
      await refetchDefaults();
      setDefaultsDraft(prev => { const n = { ...prev }; delete n[deptName]; return n; });
      toast({ title: "Saved", description: `Default team for ${deptName} updated.` });
    } catch {
      toast({ title: "Error", description: "Failed to save department default.", variant: "destructive" });
    } finally {
      setSavingDefault(null);
    }
  };

  // ── Delete mutations ────────────────────────────────────────────────────────
  const deleteUnifiedMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/unified-contracts/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/unified-contracts"] });
      setDeletingUnified(null);
      toast({ title: "Contract deleted" });
    },
    onError: () => toast({ title: "Error", description: "Failed to delete contract", variant: "destructive" }),
  });

  const deleteRentalMutation = useMutation({
    mutationFn: ({ id, reason, clientName, itemName }: any) =>
      apiRequest("DELETE", `/api/contracts/${id}`, {
        reason, clientName, itemName,
        deletedBy: (user as any)?.name ?? (user as any)?.username ?? "Unknown",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/contracts"] });
      qc.invalidateQueries({ queryKey: ["/api/contracts/deletion-history"] });
      setDeletingRental(null);
      setDeleteReason("");
      toast({ title: "Contract deleted", description: "Deletion reason recorded." });
    },
    onError: () => toast({ title: "Error", description: "Failed to delete contract", variant: "destructive" }),
  });

  // ── Unified contracts ───────────────────────────────────────────────────────
  const filteredUnified = useMemo(() => {
    return unifiedContracts.filter(c => {
      if (typeFilter === "service" || typeFilter === "rental") return false;
      if (statusFilter === "active" && !c.activeStatus) return false;
      if (statusFilter === "inactive" && c.activeStatus) return false;
      if (statusFilter === "ending") {
        if (!c.contractEndDate) return false;
        const daysLeft = Math.ceil((new Date(c.contractEndDate).getTime() - Date.now()) / 86400000);
        if (!(daysLeft >= 0 && daysLeft <= 30)) return false;
      }
      if (statusFilter === "increase") {
        if (!c.nextIncreaseDate) return false;
        const daysLeft = Math.ceil((new Date(c.nextIncreaseDate).getTime() - Date.now()) / 86400000);
        if (!(daysLeft >= 0 && daysLeft <= 90)) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const clientName = getClientName(c.clientId).toLowerCase();
        if (!clientName.includes(q) && !(c.contractNumber ?? "").toLowerCase().includes(q)
          && !(c.department ?? "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [unifiedContracts, typeFilter, statusFilter, search, clients]);

  // ── Legacy contracts ────────────────────────────────────────────────────────
  const legacyAll: UnifiedLegacy[] = useMemo(() => [
    ...serviceContracts.map(sc => ({ ...sc, contractType: "service" as const })),
    ...rentalContracts.map(rc => ({ ...rc, contractType: "rental" as const })),
  ], [serviceContracts, rentalContracts]);

  const filteredLegacy = useMemo(() => {
    const today = new Date();
    const in30 = new Date(today.getTime() + 30 * 86400000);
    const in90 = new Date(today.getTime() + 90 * 86400000);

    return legacyAll.filter(c => {
      if (typeFilter === "unified") return false;
      if (typeFilter === "service" && c.contractType !== "service") return false;
      if (typeFilter === "rental" && c.contractType !== "rental") return false;
      const active = isActiveLegacy(c);
      if (statusFilter === "active" && !active) return false;
      if (statusFilter === "inactive" && active) return false;
      if (statusFilter === "ending") {
        if (!c.endDate) return false;
        const end = new Date(c.endDate);
        if (!(end >= today && end <= in30)) return false;
      }
      if (statusFilter === "increase") {
        const nd = nextIncreaseDate(c);
        if (!nd) return false;
        try { const d = new Date(nd); if (!(d >= today && d <= in90)) return false; }
        catch { return false; }
      }
      if (search) {
        const q = search.toLowerCase();
        const hit = getClientName(c.clientId).toLowerCase().includes(q)
          || (c.contractNumber ?? "").toLowerCase().includes(q)
          || (c.contractType === "service" ? (c as ServiceContract).serviceType.toLowerCase().includes(q) : false)
          || (c.frequency ?? "").toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [legacyAll, typeFilter, statusFilter, search, clients]);

  // ── Counts ─────────────────────────────────────────────────────────────────
  const counts = useMemo(() => ({
    all: unifiedContracts.length + legacyAll.length,
    unified: unifiedContracts.length,
    service: legacyAll.filter(c => c.contractType === "service").length,
    rental: legacyAll.filter(c => c.contractType === "rental").length,
    active: unifiedContracts.filter(c => c.activeStatus).length + legacyAll.filter(isActiveLegacy).length,
    inactive: unifiedContracts.filter(c => !c.activeStatus).length + legacyAll.filter(c => !isActiveLegacy(c)).length,
  }), [unifiedContracts, legacyAll]);

  return (
      <>
        <div className="p-4 sm:p-6 pb-20 lg:pb-6">

          {/* ── Top bar ── */}
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by client, contract number, department…"
                value={search}
                onChange={e => setSearch(e.target.value)}
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDefaults(!showDefaults)}
                  className={showDefaults ? "bg-gray-100" : ""}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Dept Defaults
                </Button>
              )}
              {!isSales && (
                <Button onClick={() => { setEditingUnified(null); setIsNewOpen(true); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Contract
                </Button>
              )}
            </div>
          </div>

          {/* ── Filter chips ── */}
          <div className="flex flex-wrap gap-2 mb-5">
            {([
              { key: "all",     label: "All Contracts",     count: counts.all },
              { key: "unified", label: "Contracts",         count: counts.unified, icon: ListOrdered },
              { key: "service", label: "Service",    count: counts.service, icon: Wrench },
              { key: "rental",  label: "Rental",     count: counts.rental,  icon: Package },
              { key: "active",  label: "Active",            count: counts.active },
              { key: "inactive",label: "Inactive",          count: counts.inactive },
              { key: "ending",  label: "Ending Soon",       icon: Calendar },
              { key: "increase",label: "Increase Due",      icon: TrendingUp },
            ] as any[]).map(chip => {
              const isType = ["all","unified","service","rental"].includes(chip.key);
              const active2 =
                chip.key === "all"     ? typeFilter === "all" && statusFilter === "all"
                : chip.key === "unified"? typeFilter === "unified"
                : chip.key === "service"? typeFilter === "service"
                : chip.key === "rental" ? typeFilter === "rental"
                : statusFilter === chip.key;
              const Icon = chip.icon;
              return (
                <button key={chip.key}
                  onClick={() => {
                    if (chip.key === "all")     { setTypeFilter("all"); setStatusFilter("all"); }
                    else if (isType)            { setTypeFilter(chip.key); setStatusFilter("all"); }
                    else                        { setTypeFilter("all"); setStatusFilter(chip.key); }
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    active2 ? "bg-blue-600 text-white shadow-sm" : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
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

          {/* ── Department Defaults Panel ── */}
          {showDefaults && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
              <div className="p-5 border-b border-gray-200 flex items-center gap-2">
                <Settings className="h-5 w-5 text-gray-500" />
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Department Defaults</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Set default team/technician that auto-fills when creating contracts for each department
                  </p>
                </div>
              </div>
              {departments.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-sm">No departments configured.</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {departments.map((dept: any) => {
                    const draft = getDraftForDept(dept.name);
                    const isDirty = defaultsDraft[dept.name] !== undefined;
                    const isSaving = savingDefault === dept.name;
                    return (
                      <div key={dept.id} className="p-4">
                        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                          <div className="flex items-center gap-2 w-40 shrink-0">
                            <div
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ background: dept.color ?? "#6b7280" }}
                            />
                            <span className="font-medium text-sm text-gray-800">{dept.name}</span>
                          </div>
                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs text-gray-500 mb-1 block">Default Team Name</Label>
                              <Input
                                placeholder="e.g. Team A, Pest Control Team"
                                value={draft.defaultTeamName}
                                onChange={e => setDefaultsDraft(prev => ({
                                  ...prev,
                                  [dept.name]: { ...getDraftForDept(dept.name), defaultTeamName: e.target.value },
                                }))}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-gray-500 mb-1 block">Default Technician Name</Label>
                              <Input
                                placeholder="e.g. John Smith"
                                value={draft.defaultTechnicianName}
                                onChange={e => setDefaultsDraft(prev => ({
                                  ...prev,
                                  [dept.name]: { ...getDraftForDept(dept.name), defaultTechnicianName: e.target.value },
                                }))}
                                className="h-8 text-sm"
                              />
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant={isDirty ? "default" : "outline"}
                            disabled={!isDirty || isSaving}
                            onClick={() => saveDeptDefault(dept.name)}
                            className="shrink-0 h-8 text-xs"
                          >
                            {isSaving
                              ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Saving…</>
                              : <><Save className="h-3 w-3 mr-1" />Save</>
                            }
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Deletion history ── */}
          {showHistory && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
              <div className="p-5 border-b border-gray-200 flex items-center gap-2">
                <History className="h-5 w-5 text-gray-500" />
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Contract Deletion History</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Permanent record of all deleted contracts</p>
                </div>
              </div>
              {deletionHistory.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <History className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No deleted contracts on record.</p>
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
                          <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-sm text-amber-900 mt-1">
                            <span className="font-medium">Reason: </span>{entry.reason}
                          </div>
                        </div>
                        <div className="text-xs text-gray-400 shrink-0">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(entry.deletedAt).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                          {entry.deletedBy && <span className="flex items-center gap-1 mt-0.5"><User className="h-3 w-3" />{entry.deletedBy}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Contracts List ── */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900">All Contracts</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {filteredUnified.length + filteredLegacy.length} contract{(filteredUnified.length + filteredLegacy.length) !== 1 ? "s" : ""} found
                </p>
              </div>
            </div>

            {isLoading ? (
              <div className="p-6 space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="border border-gray-100 rounded-lg p-5 animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-40 mb-3" />
                    <div className="grid grid-cols-4 gap-4">
                      {[...Array(4)].map((_, j) => <div key={j} className="h-3 bg-gray-100 rounded" />)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (filteredUnified.length + filteredLegacy.length === 0) ? (
              <div className="p-12 text-center">
                <FileText className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No contracts found</h3>
                <p className="text-gray-500 text-sm">
                  {search || typeFilter !== "all" || statusFilter !== "all"
                    ? "Try adjusting your search or filter."
                    : "Click \"New Contract\" to create your first contract."}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">

                {/* ── Unified contracts ── */}
                {filteredUnified.map(c => {
                  const active = c.activeStatus;
                  const endDate = c.contractEndDate ? new Date(c.contractEndDate) : null;
                  const daysLeft = endDate ? Math.ceil((endDate.getTime() - Date.now()) / 86400000) : null;
                  const endingSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 30;
                  const schedule = scheduleLabel(c);
                  return (
                    <div key={c.id} className="p-5 hover:bg-gray-50 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            {c.contractNumber && (
                              <span className="font-mono text-xs px-2 py-0.5 rounded font-medium bg-green-50 text-green-700 border border-green-100">
                                {c.contractNumber}
                              </span>
                            )}
                            <Badge className="bg-green-100 text-green-800 text-xs font-medium">
                              <ListOrdered className="h-3 w-3 mr-1 inline" />
                              Contract
                            </Badge>
                            {c.department && (
                              <Badge className="bg-gray-100 text-gray-700 text-xs">{c.department}</Badge>
                            )}
                            <Badge className={active ? "bg-green-100 text-green-800 text-xs" : "bg-gray-100 text-gray-600 text-xs"}>
                              {active ? "Active" : "Inactive"}
                            </Badge>
                            {endingSoon && (
                              <Badge className="bg-orange-100 text-orange-800 text-xs">
                                <AlertTriangle className="h-3 w-3 mr-1 inline" />Ends in {daysLeft}d
                              </Badge>
                            )}
                          </div>
                          <Link href={`/clients/${c.clientId}`}>
                            <span className="font-semibold text-gray-900 hover:text-blue-700 hover:underline cursor-pointer">
                              {getClientName(c.clientId)}
                            </span>
                          </Link>
                          {(c.assignedTeamName || c.assignedTechnicianName) && (
                            <p className="text-sm text-gray-500 mt-0.5">
                              {c.assignedTeamName || c.assignedTechnicianName}
                            </p>
                          )}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1.5 mt-3 text-xs text-gray-500">
                            {schedule && (
                              <div className="col-span-2">
                                <span className="font-medium text-gray-400 uppercase tracking-wide block mb-0.5">Schedule</span>
                                <span className="text-gray-700">{schedule}</span>
                              </div>
                            )}
                            {c.contractStartDate && (
                              <div>
                                <span className="font-medium text-gray-400 uppercase tracking-wide block mb-0.5">Start</span>
                                <span className="text-gray-700">{c.contractStartDate}</span>
                              </div>
                            )}
                            {c.contractEndDate && (
                              <div>
                                <span className="font-medium text-gray-400 uppercase tracking-wide block mb-0.5">End</span>
                                <span className={endingSoon ? "text-orange-600 font-medium" : "text-gray-700"}>{c.contractEndDate}</span>
                              </div>
                            )}
                            {c.nextIncreaseDate && (
                              <div>
                                <span className="font-medium text-gray-400 uppercase tracking-wide block mb-0.5">Next Increase</span>
                                <span className="text-gray-700">{c.nextIncreaseDate}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        {!isSales && (
                          <div className="flex sm:flex-col gap-2 shrink-0">
                            <Button
                              variant="outline" size="sm" className="text-xs"
                              onClick={() => { setEditingUnified(c); setIsNewOpen(true); }}
                            >
                              <Edit className="h-3.5 w-3.5 mr-1" />Edit
                            </Button>
                            <Button
                              variant="outline" size="sm" className="text-xs text-red-600 hover:text-red-700"
                              onClick={() => setDeletingUnified(c)}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-1" />Delete
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* ── Legacy contracts (read-mostly) ── */}
                {filteredLegacy.map(contract => {
                  const isService = contract.contractType === "service";
                  const sc = isService ? (contract as ServiceContract) : null;
                  const rc = !isService ? (contract as RentalContract) : null;
                  const active = isActiveLegacy(contract);
                  const price = priceDisplay(contract);
                  const nextInc = nextIncreaseDate(contract);
                  const schedule = scheduleLabel(contract);
                  const today = new Date();
                  const endDate = contract.endDate ? new Date(contract.endDate) : null;
                  const daysLeft = endDate ? Math.ceil((endDate.getTime() - today.getTime()) / 86400000) : null;
                  const endingSoon = daysLeft !== null && daysLeft <= 30 && daysLeft >= 0;

                  return (
                    <div key={contract.id} className="p-5 hover:bg-gray-50 transition-colors opacity-80">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            {contract.contractNumber && (
                              <span className={`font-mono text-xs px-2 py-0.5 rounded font-medium ${
                                isService ? "bg-blue-50 text-blue-700 border border-blue-100" : "bg-purple-50 text-purple-700 border border-purple-100"
                              }`}>
                                {contract.contractNumber}
                              </span>
                            )}
                            <Badge className={isService
                              ? "bg-blue-100 text-blue-800 text-xs font-medium"
                              : "bg-purple-100 text-purple-800 text-xs font-medium"
                            }>
                              {isService ? <Wrench className="h-3 w-3 mr-1 inline" /> : <Package className="h-3 w-3 mr-1 inline" />}
                              {isService ? "Legacy Service" : "Legacy Rental"}
                            </Badge>
                            <Badge className={active ? "bg-green-100 text-green-800 text-xs" : "bg-gray-100 text-gray-600 text-xs"}>
                              {active ? "Active" : "Inactive"}
                            </Badge>
                            {endingSoon && (
                              <Badge className="bg-orange-100 text-orange-800 text-xs">
                                <AlertTriangle className="h-3 w-3 mr-1 inline" />Ends in {daysLeft}d
                              </Badge>
                            )}
                          </div>
                          <Link href={`/clients/${contract.clientId}`}>
                            <span className="font-semibold text-gray-900 hover:text-blue-700 hover:underline cursor-pointer">
                              {getClientName(contract.clientId)}
                            </span>
                          </Link>
                          <p className="text-sm text-gray-600 mt-0.5">
                            {isService ? sc!.serviceType : "Rental Items"}
                          </p>
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
                                <span className={endingSoon ? "text-orange-600 font-medium" : "text-gray-700"}>{formatDate(contract.endDate)}</span>
                              </div>
                            )}
                            {nextInc && (
                              <div>
                                <span className="font-medium text-gray-400 uppercase tracking-wide block mb-0.5">Next Increase</span>
                                <span className="text-gray-700">{formatDate(nextInc)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        {!isSales && (
                          <div className="flex sm:flex-col gap-2 shrink-0">
                            {isService ? (
                              <Link href="/contracts">
                                <Button variant="outline" size="sm" className="text-xs w-full">
                                  <Edit className="h-3.5 w-3.5 mr-1" />View/Edit
                                </Button>
                              </Link>
                            ) : (
                                <Button variant="outline" size="sm" className="text-xs"
                                  onClick={() => { setEditingRental(contract as RentalContract); setIsRentalFormOpen(true); }}>
                                  <Edit className="h-3.5 w-3.5 mr-1" />Edit
                                </Button>
                                <Button variant="outline" size="sm" className="text-xs text-red-600 hover:text-red-700"
                                  onClick={() => { setDeletingRental(contract as RentalContract); setDeleteReason(""); }}>
                                  <Trash2 className="h-3.5 w-3.5 mr-1" />Delete
                                </Button>
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

        </div>

      {/* ── New / Edit Unified Contract Dialog ── */}
      <Dialog open={isNewOpen} onOpenChange={open => { if (!open) { setIsNewOpen(false); setEditingUnified(null); } }}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingUnified ? "Edit Contract" : "New Contract"}</DialogTitle>
            <DialogDescription>
              {editingUnified
                ? "Update this contract's details, items, and schedule."
                : "Create a contract with services, rental items, or both combined."}
            </DialogDescription>
          </DialogHeader>
          <UnifiedContractForm
            contract={editingUnified}
            onSuccess={() => { setIsNewOpen(false); setEditingUnified(null); }}
            onCancel={() => { setIsNewOpen(false); setEditingUnified(null); }}
          />
        </DialogContent>
      </Dialog>

      {/* ── Delete Unified Contract ── */}
      <AlertDialog open={!!deletingUnified} onOpenChange={open => { if (!open) setDeletingUnified(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contract</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the contract for{" "}
              <strong>{deletingUnified ? getClientName(deletingUnified.clientId) : ""}</strong>.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingUnified && deleteUnifiedMutation.mutate(deletingUnified.id)}
              disabled={deleteUnifiedMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteUnifiedMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Legacy Rental Form Dialog ── */}
      <Dialog open={isRentalFormOpen} onOpenChange={open => { setIsRentalFormOpen(open); if (!open) setEditingRental(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRental ? "Edit Legacy Rental Contract" : "Legacy Rental Contract"}</DialogTitle>
          </DialogHeader>
          <ContractForm
            contract={editingRental}
            onSuccess={() => { setIsRentalFormOpen(false); setEditingRental(null); }}
            onCancel={() => { setIsRentalFormOpen(false); setEditingRental(null); }}
          />
        </DialogContent>
      </Dialog>

      {/* ── Delete Legacy Rental ── */}
      <AlertDialog open={!!deletingRental} onOpenChange={open => { if (!open) { setDeletingRental(null); setDeleteReason(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rental Contract</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete the rental contract for{" "}
              <strong>{deletingRental ? getClientName(deletingRental.clientId) : ""}</strong>. Please provide a reason.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea placeholder="Reason for deletion (required)…" value={deleteReason} onChange={e => setDeleteReason(e.target.value)} className="my-2" rows={3} />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!deleteReason.trim() || deleteRentalMutation.isPending}
              onClick={() => {
                if (!deletingRental || !deleteReason.trim()) return;
                deleteRentalMutation.mutate({
                  id: deletingRental.id,
                  reason: deleteReason.trim(),
                  clientName: getClientName(deletingRental.clientId),
                  itemName: deletingRental.contractNumber ?? "Rental Contract",
                });
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteRentalMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </>
  );
}
