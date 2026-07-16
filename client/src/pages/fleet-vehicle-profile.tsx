import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ArrowLeft, Car, User, Gauge, Fuel, ClipboardCheck, AlertTriangle,
  CheckCircle, Wrench, Calendar, DollarSign, FileText, MapPin,
  Edit, TrendingUp, Shield, Clock, Hammer,
} from "lucide-react";
import { format, differenceInDays, startOfMonth, subMonths } from "date-fns";

// ─── Status helpers ─────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  active:      { label: "Active",        color: "text-green-700",  bg: "bg-green-100",  dot: "bg-green-500"  },
  due_service: { label: "Due Service",   color: "text-orange-700", bg: "bg-orange-100", dot: "bg-orange-500" },
  workshop:    { label: "Workshop",      color: "text-gray-700",   bg: "bg-gray-200",   dot: "bg-gray-500"   },
  unsafe:      { label: "Unsafe",        color: "text-red-700",    bg: "bg-red-100",    dot: "bg-red-500"    },
  spare:       { label: "Spare Vehicle", color: "text-blue-700",   bg: "bg-blue-100",   dot: "bg-blue-500"   },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.active;
  return (
  <>
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  </>
  );
}

// ─── Workshop job helpers ─────────────────────────────────────────────────────

const WJ_STATUS_COLOR: Record<string, string> = {
  open:          "bg-red-100 text-red-700",
  booked:        "bg-blue-100 text-blue-700",
  in_progress:   "bg-amber-100 text-amber-700",
  waiting_parts: "bg-purple-100 text-purple-700",
  completed:     "bg-green-100 text-green-700",
  cancelled:     "bg-gray-100 text-gray-500",
};
const WJ_PRIORITY_COLOR: Record<string, string> = {
  low:    "bg-gray-100 text-gray-600",
  medium: "bg-amber-100 text-amber-700",
  high:   "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};
const WJ_SOURCE_LABEL: Record<string, string> = {
  manual:       "Manual",
  inspection:   "Failed Inspection",
  issue_report: "Issue Report",
};

// ─── Issue / urgency helpers ─────────────────────────────────────────────────

const URGENCY_COLOR: Record<string, string> = {
  low:      "bg-gray-100 text-gray-600",
  medium:   "bg-amber-100 text-amber-700",
  high:     "bg-orange-100 text-orange-700",
  not_safe: "bg-red-100 text-red-700",
};
const ISSUE_STATUS_COLOR: Record<string, string> = {
  open:         "bg-red-100 text-red-700",
  in_progress:  "bg-amber-100 text-amber-700",
  booked:       "bg-blue-100 text-blue-700",
  completed:    "bg-green-100 text-green-700",
  not_required: "bg-gray-100 text-gray-500",
};

// ─── Health score ─────────────────────────────────────────────────────────────

function calcHealthScore(vehicleStatus: string, vIssues: any[], vInspections: any[], latestSvc: any): number {
  let score = 100;
  const openIssues = vIssues.filter((i: any) => ["open", "in_progress", "booked", "waiting_parts"].includes(i.status));
  score -= openIssues.length * 5;
  const failedInsp = vInspections.filter((i: any) => i.overallResult === "fail" && !i.reviewedAt);
  score -= failedInsp.length * 10;
  if (latestSvc?.nextServiceDate && new Date(latestSvc.nextServiceDate) < new Date()) score -= 15;
  if (vehicleStatus === "unsafe") score -= 20;
  const catCounts: Record<string, number> = {};
  openIssues.forEach((i: any) => { catCounts[i.category] = (catCounts[i.category] || 0) + 1; });
  Object.values(catCounts).forEach(cnt => { if (cnt > 1) score -= (cnt - 1) * 5; });
  return Math.max(0, Math.min(100, Math.round(score)));
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function fmt(date: any) {
  if (!date) return "—";
  try { return format(new Date(date), "dd MMM yyyy"); } catch { return "—"; }
}
function fmtFull(date: any) {
  if (!date) return "—";
  try { return format(new Date(date), "dd MMM yyyy HH:mm"); } catch { return "—"; }
}
function randAmount(date: any, list: any[]): number {
  return list
    .filter((x: any) => {
      const d = new Date(x.fillDate ?? x.serviceDate ?? x.createdAt);
      const ms = startOfMonth(new Date(date));
      const me = new Date(ms.getFullYear(), ms.getMonth() + 1, 1);
      return d >= ms && d < me;
    })
    .reduce((s: number, x: any) => s + parseFloat(x.cost || "0"), 0);
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function FleetVehicleProfile() {
  const [, params] = useRoute("/fleet/vehicles/:id");
  const [, navigate] = useLocation();
  const vehicleId = params?.id ?? "";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [wjStatusDialog, setWjStatusDialog] = useState<{ open: boolean; job: any | null }>({ open: false, job: null });
  const [wjNewStatus, setWjNewStatus] = useState("");
  const { toast } = useToast();

  const { data: vehicle, isLoading } = useQuery<any>({
    queryKey: ["/api/fleet/vehicles", vehicleId],
    queryFn: async () => {
      const res = await fetch(`/api/fleet/vehicles/${vehicleId}`);
      if (!res.ok) throw new Error("Vehicle not found");
      return res.json();
    },
    enabled: !!vehicleId,
  });

  const { data: workers = [] } = useQuery<any[]>({ queryKey: ["/api/workers"] });
  const { data: departments = [] } = useQuery<any[]>({ queryKey: ["/api/departments"] });
  const { data: assignments = [] } = useQuery<any[]>({ queryKey: ["/api/fleet/assignments"] });

  const { data: allKmLogs = [] } = useQuery<any[]>({ queryKey: ["/api/fleet/km-logs"] });
  const { data: allFuel = [] } = useQuery<any[]>({ queryKey: ["/api/fleet/fuel-fillups"] });
  const { data: allInspections = [] } = useQuery<any[]>({ queryKey: ["/api/fleet/inspections"] });
  const { data: allIssues = [] } = useQuery<any[]>({
    queryKey: ["/api/fleet/issues"],
    queryFn: async () => {
      const res = await fetch("/api/fleet/issues");
      const d = await res.json();
      return Array.isArray(d) ? d : [];
    },
  });
  const { data: allServiceRecords = [] } = useQuery<any[]>({
    queryKey: ["/api/fleet/service-records"],
    queryFn: async () => {
      const res = await fetch("/api/fleet/service-records");
      const d = await res.json();
      return Array.isArray(d) ? d : [];
    },
  });
  const { data: allWorkshopJobs = [] } = useQuery<any[]>({
    queryKey: ["/api/fleet/workshop-jobs", vehicleId],
    queryFn: async () => {
      const res = await fetch(`/api/fleet/workshop-jobs?vehicleId=${vehicleId}`);
      const d = await res.json();
      return Array.isArray(d) ? d : [];
    },
    enabled: !!vehicleId,
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) =>
      apiRequest("PATCH", `/api/fleet/vehicles/${vehicleId}`, { vehicleStatus: status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fleet/vehicles", vehicleId] });
      queryClient.invalidateQueries({ queryKey: ["/api/fleet/vehicles"] });
      setStatusDialogOpen(false);
    },
  });

  const wjUpdateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/fleet/workshop-jobs/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fleet/workshop-jobs", vehicleId] });
      queryClient.invalidateQueries({ queryKey: ["/api/fleet/workshop-jobs"] });
      setWjStatusDialog({ open: false, job: null });
      toast({ title: "Workshop job updated" });
    },
  });

  if (isLoading) {
    return (
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header title="Vehicle Profile" onMobileMenuToggle={() => setMobileMenuOpen(o => !o)} />
        <div className="flex flex-1"><Sidebar />
          <main className="flex-1 flex items-center justify-center">
            <p className="text-gray-500">Vehicle not found.</p>
          </main>
        </div>
      </div>
    );
  }

  const workerName = (id: string | null) => id ? (workers.find((w: any) => w.id === id)?.name ?? id) : "—";
  const deptName = (id: string) => departments.find((d: any) => d.id === id)?.name ?? id;

  // Per-vehicle data
  const vKmLogs = allKmLogs.filter((l: any) => l.vehicleId === vehicleId)
    .sort((a: any, b: any) => new Date(b.logDate).getTime() - new Date(a.logDate).getTime());
  const vFuel = allFuel.filter((f: any) => f.vehicleId === vehicleId)
    .sort((a: any, b: any) => new Date(b.fillDate).getTime() - new Date(a.fillDate).getTime());
  const vInspections = allInspections.filter((i: any) => i.vehicleId === vehicleId)
    .sort((a: any, b: any) => new Date(b.inspectionDate).getTime() - new Date(a.inspectionDate).getTime());
  const vIssues = allIssues.filter((i: any) => i.vehicleId === vehicleId)
    .sort((a: any, b: any) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime());
  const vServiceRecords = allServiceRecords.filter((r: any) => r.vehicleId === vehicleId)
    .sort((a: any, b: any) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime());
  const vWorkshopJobs = allWorkshopJobs;

  const assignment = assignments.find((a: any) => a.vehicleId === vehicleId && a.isActive);
  const currentOdometer = vKmLogs[0]?.endOdometer ?? null;
  const latestService = vServiceRecords[0] ?? null;
  const lastInspection = vInspections[0] ?? null;
  const openIssues = vIssues.filter((i: any) => i.status === "open" || i.status === "in_progress");
  const openWorkshopJobs = vWorkshopJobs.filter((w: any) => !["completed", "cancelled"].includes(w.status));

  const totalFuelCost = vFuel.reduce((s: number, f: any) => s + parseFloat(f.cost || "0"), 0);
  const totalServiceCost = vServiceRecords.reduce((s: number, r: any) => s + parseFloat(r.cost || "0"), 0);
  const totalKm = vKmLogs.reduce((s: number, l: any) => s + (l.totalKm || 0), 0);
  const costPerKm = totalKm > 0 ? (totalFuelCost + totalServiceCost) / totalKm : 0;

  const nextServiceDays = latestService?.nextServiceDate
    ? differenceInDays(new Date(latestService.nextServiceDate), new Date())
    : null;

  // Monthly cost tracking — last 4 months
  const now = new Date();
  const monthlyData = [0, 1, 2, 3].map(offset => {
    const mo = subMonths(now, offset);
    const label = format(mo, "MMM yy");
    const ms = startOfMonth(mo);
    const me = new Date(ms.getFullYear(), ms.getMonth() + 1, 1);
    const fuel = vFuel.filter((f: any) => { const d = new Date(f.fillDate); return d >= ms && d < me; }).reduce((s: number, f: any) => s + parseFloat(f.cost || "0"), 0);
    const svc  = vServiceRecords.filter((r: any) => { const d = new Date(r.serviceDate); return d >= ms && d < me; }).reduce((s: number, r: any) => s + parseFloat(r.cost || "0"), 0);
    return { label, fuel, svc, total: fuel + svc };
  }).reverse();

  // Health score
  const healthScore = calcHealthScore(vehicle.vehicleStatus, vIssues, vInspections, latestService);
  const healthIsGood = healthScore >= 80, healthIsMed = healthScore >= 60;
  const healthBg   = healthIsGood ? "bg-green-50 border-green-200" : healthIsMed ? "bg-orange-50 border-orange-200" : "bg-red-50 border-red-200";
  const healthText = healthIsGood ? "text-green-700" : healthIsMed ? "text-orange-600" : "text-red-700";
  const healthBar  = healthIsGood ? "bg-green-500" : healthIsMed ? "bg-orange-400" : "bg-red-500";
  const healthLabel = healthIsGood ? "Vehicle Healthy" : healthIsMed ? "Needs Attention" : "High Risk";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header title="Vehicle Profile" onMobileMenuToggle={() => setMobileMenuOpen(o => !o)} />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          <div className="max-w-5xl mx-auto space-y-6">

            {/* Back + header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={() => navigate("/fleet")} className="gap-1.5">
                  <ArrowLeft className="h-4 w-4" /> Fleet
                </Button>
                <div>
                  <div className="flex items-center gap-2.5">
                    <Car className="h-5 w-5 text-blue-600" />
                    <h1 className="text-xl font-bold text-gray-900">{vehicle.name}</h1>
                    <StatusBadge status={vehicle.vehicleStatus} />
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5 ml-7">
                    {vehicle.registration} · {vehicle.make} {vehicle.model} · {vehicle.year}
                  </p>
                </div>
              </div>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setNewStatus(vehicle.vehicleStatus); setStatusDialogOpen(true); }}>
                <Edit className="h-4 w-4" /> Update Status
              </Button>
            </div>

            {/* Key stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Gauge className="h-4 w-4 text-blue-500" />
                    <span className="text-xs text-gray-500 font-medium">Odometer</span>
                  </div>
                  <p className="text-xl font-bold text-gray-900">
                    {currentOdometer ? currentOdometer.toLocaleString() : "—"}
                    {currentOdometer && <span className="text-sm font-normal text-gray-500 ml-1">km</span>}
                  </p>
                </CardContent>
              </Card>

              {/* Health Score card */}
              <Card className={`border ${healthBg}`}>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Shield className={`h-4 w-4 ${healthText}`} />
                    <span className={`text-xs font-medium ${healthText}`}>Health Score</span>
                  </div>
                  <div className="flex items-end gap-2 mb-1.5">
                    <span className={`text-2xl font-bold ${healthText}`}>{healthScore}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${healthBar}`} style={{ width: `${healthScore}%` }} />
                  </div>
                  <p className={`text-xs mt-1 font-medium ${healthText}`}>{healthLabel}</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className={`h-4 w-4 ${openIssues.length > 0 ? "text-red-500" : "text-gray-400"}`} />
                    <span className="text-xs text-gray-500 font-medium">Open Issues</span>
                  </div>
                  <p className={`text-xl font-bold ${openIssues.length > 0 ? "text-red-600" : "text-gray-400"}`}>
                    {openIssues.length}
                    <span className="text-sm font-normal text-gray-400 ml-1">issues</span>
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Wrench className="h-4 w-4 text-amber-500" />
                    <span className="text-xs text-gray-500 font-medium">Last Service</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">{latestService ? fmt(latestService.serviceDate) : "No records"}</p>
                  {latestService && <p className="text-xs text-gray-400 truncate">{latestService.serviceProvider}</p>}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className={`h-4 w-4 ${nextServiceDays !== null && nextServiceDays <= 30 ? "text-orange-500" : "text-green-500"}`} />
                    <span className="text-xs text-gray-500 font-medium">Next Service</span>
                  </div>
                  {latestService?.nextServiceDate ? (
                      <p className="text-sm font-semibold text-gray-900">{fmt(latestService.nextServiceDate)}</p>
                      <p className={`text-xs font-medium ${nextServiceDays !== null && nextServiceDays <= 0 ? "text-red-600" : nextServiceDays !== null && nextServiceDays <= 30 ? "text-orange-600" : "text-gray-400"}`}>
                        {nextServiceDays !== null && nextServiceDays <= 0 ? "Overdue" : nextServiceDays !== null ? `${nextServiceDays}d` : ""}
                        {latestService.nextServiceOdometer ? ` · ${latestService.nextServiceOdometer.toLocaleString()} km` : ""}
                      </p>
                  ) : <p className="text-sm text-gray-400">Not scheduled</p>}
                </CardContent>
              </Card>
            </div>

            {/* Main tabs */}
            <Tabs defaultValue="overview">
              <TabsList className="flex-wrap h-auto gap-1">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="workshop">
                  Workshop
                  {openWorkshopJobs.length > 0 && (
                    <span className="ml-1.5 bg-orange-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">{openWorkshopJobs.length}</span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="issues">
                  Issues
                  {openIssues.length > 0 && (
                    <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">{openIssues.length}</span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="inspections">Inspections</TabsTrigger>
                <TabsTrigger value="service">Service Records</TabsTrigger>
                <TabsTrigger value="fuel">Fuel</TabsTrigger>
                <TabsTrigger value="km">KM Logs</TabsTrigger>
              </TabsList>

              {/* OVERVIEW */}
              <TabsContent value="overview" className="mt-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Vehicle Details */}
                  <Card>
                    <CardHeader className="pb-2 pt-4">
                      <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <Car className="h-4 w-4" /> Vehicle Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 pb-4">
                      {[
                        ["Make", vehicle.make],
                        ["Model", vehicle.model],
                        ["Year", vehicle.year],
                        ["Registration", vehicle.registration],
                        ["Department", deptName(vehicle.departmentId)],
                        ["Status", <StatusBadge status={vehicle.vehicleStatus} />],
                      ].map(([label, val]) => (
                        <div key={String(label)} className="flex justify-between items-center py-1 border-b border-gray-50 last:border-0">
                          <span className="text-xs text-gray-500">{String(label)}</span>
                          <span className="text-sm font-medium text-gray-900">{val}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Assigned Driver */}
                  <Card>
                    <CardHeader className="pb-2 pt-4">
                      <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <User className="h-4 w-4" /> Assigned Driver
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-4">
                      {assignment ? (
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <User className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{workerName(assignment.workerId)}</p>
                            <p className="text-xs text-gray-400">Assigned since {fmt(assignment.assignedAt)}</p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400 py-2">No driver currently assigned</p>
                      )}
                      {vehicle.notes && (
                        <div className="mt-3 p-2.5 bg-amber-50 rounded-lg border border-amber-100">
                          <p className="text-xs text-amber-800">{vehicle.notes}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Monthly Cost Tracking */}
                  <Card>
                    <CardHeader className="pb-2 pt-4">
                      <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <DollarSign className="h-4 w-4" /> Cost Tracking
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-4">
                      <div className="space-y-1 mb-3">
                        {[
                          ["Total Fuel", `R ${totalFuelCost.toFixed(2)}`],
                          ["Total Service", `R ${totalServiceCost.toFixed(2)}`],
                          ["Total Fleet Cost", `R ${(totalFuelCost + totalServiceCost).toFixed(2)}`],
                          ["Cost per km", costPerKm > 0 ? `R ${costPerKm.toFixed(2)}/km` : "—"],
                        ].map(([label, val]) => (
                          <div key={String(label)} className="flex justify-between items-center py-1 border-b border-gray-50 last:border-0">
                            <span className="text-xs text-gray-500">{String(label)}</span>
                            <span className={`text-sm font-semibold ${String(label).includes("Total Fleet") ? "text-blue-700" : "text-gray-900"}`}>{String(val)}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs font-semibold text-gray-500 mb-2 mt-3">Monthly breakdown (last 4 months)</p>
                      <div className="space-y-1.5">
                        {monthlyData.map(m => {
                          const maxVal = Math.max(...monthlyData.map(x => x.total), 1);
                          const pct = Math.round((m.total / maxVal) * 100);
                          return (
                            <div key={m.label}>
                              <div className="flex justify-between items-center mb-0.5">
                                <span className="text-xs text-gray-500">{m.label}</span>
                                <span className="text-xs font-semibold text-gray-700">R {m.total.toFixed(0)}</span>
                              </div>
                              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-blue-400 transition-all"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <div className="flex gap-3 mt-0.5">
                                <span className="text-[10px] text-amber-600">Fuel: R {m.fuel.toFixed(0)}</span>
                                <span className="text-[10px] text-blue-600">Service: R {m.svc.toFixed(0)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Activity Summary */}
                  <Card>
                    <CardHeader className="pb-2 pt-4">
                      <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" /> Activity Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 pb-4">
                      {[
                        ["KM Logs Recorded", `${vKmLogs.length}`],
                        ["Total KMs Logged", `${totalKm.toLocaleString()} km`],
                        ["Inspections Done", `${vInspections.length}`],
                        ["Failed Inspections", `${vInspections.filter((i: any) => i.overallResult === "fail").length}`],
                        ["Issues Reported", `${vIssues.length}`],
                        ["Open / In Progress", `${openIssues.length}`],
                        ["Workshop Jobs", `${vWorkshopJobs.length} (${openWorkshopJobs.length} open)`],
                        ["Fuel Fill-ups", `${vFuel.length}`],
                      ].map(([label, val]) => (
                        <div key={String(label)} className="flex justify-between items-center py-1 border-b border-gray-50 last:border-0">
                          <span className="text-xs text-gray-500">{String(label)}</span>
                          <span className="text-sm font-semibold text-gray-900">{String(val)}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* WORKSHOP JOBS */}
              <TabsContent value="workshop" className="mt-4">
                <Card>
                  <CardHeader className="pb-2 pt-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <Hammer className="h-4 w-4" /> Workshop Jobs
                      </CardTitle>
                      <span className="text-xs text-gray-400">{vWorkshopJobs.length} total</span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {vWorkshopJobs.length === 0 ? (
                      <div className="px-4 py-8 text-center text-gray-400">
                        <Hammer className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No workshop jobs for this vehicle</p>
                      </div>
                    ) : (
                      <div className="divide-y">
                        {vWorkshopJobs.map((job: any) => (
                          <div key={job.id} className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${WJ_STATUS_COLOR[job.status] ?? "bg-gray-100 text-gray-600"}`}>
                                    {job.status.replace(/_/g, " ")}
                                  </span>
                                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${WJ_PRIORITY_COLOR[job.priority] ?? "bg-gray-100 text-gray-600"}`}>
                                    {job.priority}
                                  </span>
                                  <span className="text-xs bg-gray-50 text-gray-500 px-2 py-0.5 rounded-full">
                                    {WJ_SOURCE_LABEL[job.issueSource] ?? job.issueSource}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-800">{job.description}</p>
                                {job.serviceProvider && (
                                  <p className="text-xs text-blue-700 mt-1">Provider: {job.serviceProvider}</p>
                                )}
                                {job.notes && (
                                  <p className="text-xs text-gray-500 mt-1 italic">{job.notes}</p>
                                )}
                                <div className="flex items-center gap-3 mt-2 flex-wrap">
                                  {job.scheduledDate && (
                                    <span className="text-xs text-gray-400 flex items-center gap-1">
                                      <Calendar className="h-3 w-3" />Scheduled: {fmt(job.scheduledDate)}
                                    </span>
                                  )}
                                  {job.cost && (
                                    <span className="text-xs text-green-700 flex items-center gap-1">
                                      <DollarSign className="h-3 w-3" />R {parseFloat(job.cost).toFixed(2)}
                                    </span>
                                  )}
                                  {job.completedAt && (
                                    <span className="text-xs text-green-600 flex items-center gap-1">
                                      <CheckCircle className="h-3 w-3" />Completed {fmt(job.completedAt)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="shrink-0 text-right">
                                <p className="text-xs text-gray-400 mb-2">{fmt(job.createdAt)}</p>
                                {!["completed", "cancelled"].includes(job.status) && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs"
                                    onClick={() => { setWjNewStatus(job.status); setWjStatusDialog({ open: true, job }); }}
                                  >
                                    Update Status
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ISSUES */}
              <TabsContent value="issues" className="mt-4">
                <Card>
                  <CardContent className="p-0">
                    {vIssues.length === 0 ? (
                      <p className="text-center text-gray-400 py-8">No issues reported for this vehicle</p>
                    ) : (
                      <div className="divide-y">
                        {vIssues.map((issue: any) => (
                          <div key={issue.id} className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${URGENCY_COLOR[issue.urgency] ?? "bg-gray-100 text-gray-600"}`}>
                                    {issue.urgency.replace("_", " ")}
                                  </span>
                                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${ISSUE_STATUS_COLOR[issue.status] ?? "bg-gray-100 text-gray-600"}`}>
                                    {issue.status.replace("_", " ")}
                                  </span>
                                  <span className="text-xs text-gray-400 capitalize bg-gray-50 px-2 py-0.5 rounded-full">{issue.category}</span>
                                </div>
                                <p className="text-sm text-gray-800 mt-1.5">{issue.description}</p>
                                {issue.managerNotes && (
                                  <p className="text-xs text-blue-700 bg-blue-50 rounded px-2 py-1 mt-1.5">
                                    Manager: {issue.managerNotes}
                                  </p>
                                )}
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-xs text-gray-400">{workerName(issue.workerId)}</p>
                                <p className="text-xs text-gray-400">{fmt(issue.reportedAt)}</p>
                                {issue.resolvedAt && <p className="text-xs text-green-600">Resolved {fmt(issue.resolvedAt)}</p>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* INSPECTIONS */}
              <TabsContent value="inspections" className="mt-4">
                <Card>
                  <CardContent className="p-0">
                    {vInspections.length === 0 ? (
                      <p className="text-center text-gray-400 py-8">No inspections recorded</p>
                    ) : (
                      <div className="divide-y">
                        {vInspections.map((ins: any) => {
                          const items = ins.itemsJson ? JSON.parse(ins.itemsJson) : [];
                          const failedItems = items.filter((it: any) => it.result === "fail");
                          return (
                            <div key={ins.id} className="p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {ins.overallResult === "pass"
                                      ? <Badge className="bg-green-100 text-green-700 gap-1"><CheckCircle className="h-3 w-3" /> Pass</Badge>
                                      : <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> Fail</Badge>
                                    }
                                    <span className="text-sm font-medium text-gray-700">{workerName(ins.workerId)}</span>
                                    {ins.reviewedAt && (
                                      <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full">Reviewed</span>
                                    )}
                                  </div>
                                  {failedItems.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1">
                                      {failedItems.map((it: any, i: number) => (
                                        <span key={i} className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">{it.name}</span>
                                      ))}
                                    </div>
                                  )}
                                  {ins.comments && <p className="text-xs text-gray-500 mt-1">{ins.comments}</p>}
                                </div>
                                <p className="text-xs text-gray-400 shrink-0">{fmtFull(ins.inspectionDate)}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* SERVICE RECORDS */}
              <TabsContent value="service" className="mt-4">
                <Card>
                  <CardContent className="p-0">
                    {vServiceRecords.length === 0 ? (
                      <p className="text-center text-gray-400 py-8">No service records found</p>
                    ) : (
                      <div className="divide-y">
                        {vServiceRecords.map((rec: any) => (
                          <div key={rec.id} className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold text-sm text-gray-900">{fmt(rec.serviceDate)}</span>
                                  <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">{rec.serviceProvider}</span>
                                  {rec.invoiceNumber && (
                                    <span className="text-xs text-gray-400 flex items-center gap-1">
                                      <FileText className="h-3 w-3" />{rec.invoiceNumber}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-700 mt-1.5">{rec.workDone}</p>
                                {rec.issuesFixed && (
                                  <p className="text-xs text-green-700 bg-green-50 rounded px-2 py-1 mt-1">Issues fixed: {rec.issuesFixed}</p>
                                )}
                                {rec.notes && <p className="text-xs text-gray-500 mt-1">{rec.notes}</p>}
                                <div className="flex items-center gap-4 mt-2">
                                  {rec.odometer && (
                                    <span className="text-xs text-gray-400 flex items-center gap-1">
                                      <Gauge className="h-3 w-3" />{rec.odometer.toLocaleString()} km
                                    </span>
                                  )}
                                  {rec.nextServiceDate && (
                                    <span className="text-xs text-gray-400 flex items-center gap-1">
                                      <Calendar className="h-3 w-3" />Next: {fmt(rec.nextServiceDate)}
                                      {rec.nextServiceOdometer ? ` / ${rec.nextServiceOdometer.toLocaleString()} km` : ""}
                                    </span>
                                  )}
                                  {rec.invoiceUrl && (
                                    <a href={rec.invoiceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline flex items-center gap-1">
                                      <FileText className="h-3 w-3" /> Invoice
                                    </a>
                                  )}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                {rec.cost && (
                                  <p className="text-base font-bold text-gray-900">R {parseFloat(rec.cost).toFixed(2)}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* FUEL HISTORY */}
              <TabsContent value="fuel" className="mt-4">
                <Card>
                  <CardContent className="p-0">
                    {vFuel.length === 0 ? (
                      <p className="text-center text-gray-400 py-8">No fuel records for this vehicle</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                            <th className="text-left px-4 py-3 font-medium text-gray-600">Driver</th>
                            <th className="text-left px-4 py-3 font-medium text-gray-600">Station</th>
                            <th className="text-right px-4 py-3 font-medium text-gray-600">Odometer</th>
                            <th className="text-right px-4 py-3 font-medium text-gray-600">Litres</th>
                            <th className="text-right px-4 py-3 font-medium text-gray-600">Cost</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {vFuel.map((f: any) => (
                            <tr key={f.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-gray-600">{fmt(f.fillDate)}</td>
                              <td className="px-4 py-3">{workerName(f.workerId)}</td>
                              <td className="px-4 py-3 text-gray-500">{f.fuelStation || "—"}</td>
                              <td className="px-4 py-3 text-right text-gray-500">{f.odometer ? f.odometer.toLocaleString() : "—"}</td>
                              <td className="px-4 py-3 text-right">{parseFloat(f.litres || "0").toFixed(1)} L</td>
                              <td className="px-4 py-3 text-right font-semibold text-amber-700">R {parseFloat(f.cost || "0").toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-50 border-t">
                          <tr>
                            <td colSpan={4} className="px-4 py-2 text-xs text-gray-500 font-medium">Total ({vFuel.length} fill-ups)</td>
                            <td className="px-4 py-2 text-right text-xs font-semibold">
                              {vFuel.reduce((s: number, f: any) => s + parseFloat(f.litres || "0"), 0).toFixed(1)} L
                            </td>
                            <td className="px-4 py-2 text-right text-xs font-semibold text-amber-700">R {totalFuelCost.toFixed(2)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* KM HISTORY */}
              <TabsContent value="km" className="mt-4">
                <Card>
                  <CardContent className="p-0">
                    {vKmLogs.length === 0 ? (
                      <p className="text-center text-gray-400 py-8">No KM logs for this vehicle</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                            <th className="text-left px-4 py-3 font-medium text-gray-600">Driver</th>
                            <th className="text-right px-4 py-3 font-medium text-gray-600">Start</th>
                            <th className="text-right px-4 py-3 font-medium text-gray-600">End</th>
                            <th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
                            <th className="text-right px-4 py-3 font-medium text-gray-600">Business</th>
                            <th className="text-right px-4 py-3 font-medium text-gray-600">Private</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {vKmLogs.map((l: any) => (
                            <tr key={l.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-gray-600">{fmt(l.logDate)}</td>
                              <td className="px-4 py-3">{workerName(l.workerId)}</td>
                              <td className="px-4 py-3 text-right text-gray-500">{l.startOdometer?.toLocaleString()}</td>
                              <td className="px-4 py-3 text-right text-gray-500">{l.endOdometer?.toLocaleString()}</td>
                              <td className="px-4 py-3 text-right font-semibold">{l.totalKm?.toLocaleString()} km</td>
                              <td className="px-4 py-3 text-right text-green-600">{l.businessKm} km</td>
                              <td className="px-4 py-3 text-right text-gray-400">{l.privateKm} km</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-50 border-t">
                          <tr>
                            <td colSpan={4} className="px-4 py-2 text-xs text-gray-500 font-medium">Total ({vKmLogs.length} logs)</td>
                            <td className="px-4 py-2 text-right text-xs font-semibold">{totalKm.toLocaleString()} km</td>
                            <td className="px-4 py-2 text-right text-xs font-semibold text-green-600">
                              {vKmLogs.reduce((s: number, l: any) => s + (l.businessKm || 0), 0).toLocaleString()} km
                            </td>
                            <td className="px-4 py-2 text-right text-xs font-semibold text-gray-400">
                              {vKmLogs.reduce((s: number, l: any) => s + (l.privateKm || 0), 0).toLocaleString()} km
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>

      {/* Change Vehicle Status Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Update Vehicle Status</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Select status..." />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>
                    <span className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={() => statusMutation.mutate(newStatus)}
                disabled={!newStatus || statusMutation.isPending}
              >
                {statusMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Update Workshop Job Status Dialog */}
      <Dialog open={wjStatusDialog.open} onOpenChange={open => setWjStatusDialog(s => ({ ...s, open }))}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Update Workshop Job Status</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {wjStatusDialog.job && (
              <p className="text-xs text-gray-500 bg-gray-50 rounded p-2 line-clamp-2">
                {wjStatusDialog.job.description}
              </p>
            )}
            <Select value={wjNewStatus} onValueChange={setWjNewStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Select status..." />
              </SelectTrigger>
              <SelectContent>
                {["open", "booked", "in_progress", "waiting_parts", "completed", "cancelled"].map(s => (
                  <SelectItem key={s} value={s}>
                    <span className="capitalize">{s.replace(/_/g, " ")}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setWjStatusDialog({ open: false, job: null })}>Cancel</Button>
              <Button
                onClick={() => wjUpdateMutation.mutate({ id: wjStatusDialog.job!.id, status: wjNewStatus })}
                disabled={!wjNewStatus || wjUpdateMutation.isPending}
              >
                {wjUpdateMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
