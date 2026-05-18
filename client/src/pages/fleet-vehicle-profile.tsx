import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ArrowLeft, Car, User, Gauge, Fuel, ClipboardCheck, AlertTriangle,
  CheckCircle, Wrench, Calendar, DollarSign, FileText, MapPin,
  Edit, TrendingUp, Shield, Clock,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";

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
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

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

function fmt(date: any) {
  if (!date) return "—";
  try { return format(new Date(date), "dd MMM yyyy"); } catch { return "—"; }
}
function fmtFull(date: any) {
  if (!date) return "—";
  try { return format(new Date(date), "dd MMM yyyy HH:mm"); } catch { return "—"; }
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function FleetVehicleProfile() {
  const [, params] = useRoute("/fleet/vehicles/:id");
  const [, navigate] = useLocation();
  const vehicleId = params?.id ?? "";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState("");

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

  const statusMutation = useMutation({
    mutationFn: (status: string) =>
      apiRequest("PATCH", `/api/fleet/vehicles/${vehicleId}`, { vehicleStatus: status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fleet/vehicles", vehicleId] });
      queryClient.invalidateQueries({ queryKey: ["/api/fleet/vehicles"] });
      setStatusDialogOpen(false);
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header title="Vehicle Profile" onMobileMenuToggle={() => setMobileMenuOpen(o => !o)} />
        <div className="flex flex-1"><Sidebar />
          <main className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </main>
        </div>
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

  const workerName = (id: string) => workers.find((w: any) => w.id === id)?.name ?? id;
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

  const assignment = assignments.find((a: any) => a.vehicleId === vehicleId && a.isActive);
  const currentOdometer = vKmLogs[0]?.endOdometer ?? null;
  const latestService = vServiceRecords[0] ?? null;
  const lastInspection = vInspections[0] ?? null;
  const openIssues = vIssues.filter((i: any) => i.status === "open" || i.status === "in_progress");

  const totalFuelCost = vFuel.reduce((s: number, f: any) => s + parseFloat(f.cost || "0"), 0);
  const totalServiceCost = vServiceRecords.reduce((s: number, r: any) => s + parseFloat(r.cost || "0"), 0);
  const totalKm = vKmLogs.reduce((s: number, l: any) => s + (l.totalKm || 0), 0);

  const nextServiceDays = latestService?.nextServiceDate
    ? differenceInDays(new Date(latestService.nextServiceDate), new Date())
    : null;

  const statusCfg = STATUS_CONFIG[vehicle.vehicleStatus] ?? STATUS_CONFIG.active;

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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Gauge className="h-4 w-4 text-blue-500" />
                    <span className="text-xs text-gray-500 font-medium">Current Odometer</span>
                  </div>
                  <p className="text-xl font-bold text-gray-900">
                    {currentOdometer ? currentOdometer.toLocaleString() : "—"}
                    {currentOdometer && <span className="text-sm font-normal text-gray-500 ml-1">km</span>}
                  </p>
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
                    <span className="text-xs text-gray-500 font-medium">Next Service Due</span>
                  </div>
                  {latestService?.nextServiceDate ? (
                    <>
                      <p className="text-sm font-semibold text-gray-900">{fmt(latestService.nextServiceDate)}</p>
                      <p className={`text-xs font-medium ${nextServiceDays !== null && nextServiceDays <= 0 ? "text-red-600" : nextServiceDays !== null && nextServiceDays <= 30 ? "text-orange-600" : "text-gray-400"}`}>
                        {nextServiceDays !== null && nextServiceDays <= 0 ? "Overdue" : nextServiceDays !== null ? `${nextServiceDays} days` : ""}
                        {latestService.nextServiceOdometer ? ` · ${latestService.nextServiceOdometer.toLocaleString()} km` : ""}
                      </p>
                    </>
                  ) : <p className="text-sm text-gray-400">Not scheduled</p>}
                </CardContent>
              </Card>
            </div>

            {/* Main tabs */}
            <Tabs defaultValue="overview">
              <TabsList className="flex-wrap h-auto gap-1">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="issues">
                  Issues
                  {openIssues.length > 0 && (
                    <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">{openIssues.length}</span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="inspections">Inspections</TabsTrigger>
                <TabsTrigger value="service">Service Records</TabsTrigger>
                <TabsTrigger value="fuel">Fuel History</TabsTrigger>
                <TabsTrigger value="km">KM History</TabsTrigger>
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

                  {/* Cost Summary */}
                  <Card>
                    <CardHeader className="pb-2 pt-4">
                      <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <DollarSign className="h-4 w-4" /> Cost Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 pb-4">
                      {[
                        ["Total Fuel Cost", `R ${totalFuelCost.toFixed(2)}`],
                        ["Total Service Cost", `R ${totalServiceCost.toFixed(2)}`],
                        ["Combined Fleet Cost", `R ${(totalFuelCost + totalServiceCost).toFixed(2)}`],
                        ["Service Records", `${vServiceRecords.length} records`],
                        ["Fuel Fill-ups", `${vFuel.length} fill-ups`],
                      ].map(([label, val]) => (
                        <div key={String(label)} className="flex justify-between items-center py-1 border-b border-gray-50 last:border-0">
                          <span className="text-xs text-gray-500">{String(label)}</span>
                          <span className={`text-sm font-semibold ${String(label).includes("Combined") ? "text-blue-700" : "text-gray-900"}`}>{String(val)}</span>
                        </div>
                      ))}
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
                                  <div className="flex items-center gap-2">
                                    {ins.overallResult === "pass"
                                      ? <Badge className="bg-green-100 text-green-700 gap-1"><CheckCircle className="h-3 w-3" /> Pass</Badge>
                                      : <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> Fail</Badge>
                                    }
                                    <span className="text-sm font-medium text-gray-700">{workerName(ins.workerId)}</span>
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

      {/* Change Status Dialog */}
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
    </div>
  );
}
