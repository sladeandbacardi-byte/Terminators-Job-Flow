import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { getDashboardRole } from "@/lib/dashboardRole";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link, useLocation } from "wouter";
import {
  Truck, Gauge, Fuel, ClipboardCheck, AlertTriangle, CheckCircle,
  Car, User, Search, ChevronRight, Wrench, Calendar, Shield,
  TriangleAlert, Activity, Mail,
} from "lucide-react";
import { format, addMonths, differenceInDays } from "date-fns";

// ── Service interval defaults ─────────────────────────────────────────────────
const SERVICE_KM_INTERVAL   = 10_000;  // km
const SERVICE_MONTH_INTERVAL = 6;      // months

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  active:      { label: "Active",        color: "text-green-700",  bg: "bg-green-100",  dot: "bg-green-500"  },
  due_service: { label: "Due Service",   color: "text-orange-700", bg: "bg-orange-100", dot: "bg-orange-500" },
  workshop:    { label: "Workshop",      color: "text-gray-600",   bg: "bg-gray-200",   dot: "bg-gray-500"   },
  unsafe:      { label: "Unsafe",        color: "text-red-700",    bg: "bg-red-100",    dot: "bg-red-500"    },
  spare:       { label: "Spare Vehicle", color: "text-blue-700",   bg: "bg-blue-100",   dot: "bg-blue-500"   },
};

function VehicleStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.active;
  return (
  <>
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  </>
  );
}

// ── Service due colour logic ──────────────────────────────────────────────────
type ServiceDue = { daysLeft: number | null; kmLeft: number | null; label: string; urgency: "ok" | "warn" | "soon" | "overdue" };

function calcServiceDue(lastSvc: any, currentOdometer: number | null): ServiceDue {
  if (!lastSvc) return { daysLeft: null, kmLeft: null, label: "No service record", urgency: "ok" };

  const now = new Date();
  const svcDate = new Date(lastSvc.serviceDate);
  const nextByTime = lastSvc.nextServiceDate ? new Date(lastSvc.nextServiceDate) : addMonths(svcDate, SERVICE_MONTH_INTERVAL);
  const daysLeft = differenceInDays(nextByTime, now);

  let kmLeft: number | null = null;
  if (currentOdometer !== null && lastSvc.odometer) {
    const kmSince = currentOdometer - lastSvc.odometer;
    const nextKm = lastSvc.nextServiceOdometer ?? (lastSvc.odometer + SERVICE_KM_INTERVAL);
    kmLeft = nextKm - currentOdometer;
  }

  // Urgency = worst of time and km
  const timeUrgency = daysLeft <= 0 ? "overdue" : daysLeft <= 30 ? "soon" : daysLeft <= 60 ? "warn" : "ok";
  const kmUrgency   = kmLeft === null ? "ok" : kmLeft <= 0 ? "overdue" : kmLeft <= 1000 ? "soon" : kmLeft <= 2000 ? "warn" : "ok";
  const urgencyRank: Record<string, number> = { ok: 0, warn: 1, soon: 2, overdue: 3 };
  const urgency = urgencyRank[timeUrgency] >= urgencyRank[kmUrgency] ? timeUrgency : kmUrgency;

  const parts: string[] = [];
  if (daysLeft !== null) parts.push(daysLeft <= 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d`);
  if (kmLeft !== null) parts.push(kmLeft <= 0 ? `${Math.abs(kmLeft).toLocaleString()}km overdue` : `${kmLeft.toLocaleString()}km`);
  const label = parts.join(" / ") || "—";

  return { daysLeft, kmLeft, label, urgency };
}

function ServiceDueCell({ due, nextSvcDate }: { due: ServiceDue; nextSvcDate?: string }) {
  if (!nextSvcDate && due.daysLeft === null) return <span className="text-gray-300 text-xs">—</span>;

  const dateStr = nextSvcDate ? format(new Date(nextSvcDate), "dd MMM yy") : "—";

  const colorClass = {
    ok:      "text-green-700",
    warn:    "text-orange-600",
    soon:    "text-red-600",
    overdue: "text-red-700",
  }[due.urgency];

  const bgClass = {
    ok:      "",
    warn:    "bg-orange-50 rounded px-1",
    soon:    "bg-red-50 rounded px-1",
    overdue: "bg-red-100 rounded px-1 animate-pulse",
  }[due.urgency];

  return (
    <div>
      <div className={`text-xs font-semibold ${colorClass} ${bgClass}`}>{dateStr}</div>
      <div className={`text-xs mt-0.5 ${colorClass} opacity-80`}>{due.label}</div>
    </div>
  );
}

// ── Summary card ──────────────────────────────────────────────────────────────
function SummaryCard({
  title, value, sub, icon: Icon, iconColor, bgColor, onClick, badge,
}: {
  title: string; value: string | number; sub?: string;
  icon: any; iconColor: string; bgColor: string;
  onClick?: () => void; badge?: number;
}) {
  const inner = (
    <CardContent className="pt-4 pb-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide truncate">{title}</p>
          <p className="text-2xl font-bold mt-0.5 text-gray-900">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5 truncate">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${bgColor}`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
      </div>
      {badge !== undefined && badge > 0 && (
        <div className="mt-2">
          <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
            {badge} need attention
          </span>
        </div>
      )}
    </CardContent>
  );
  if (onClick) {
    return (
      <Card className="cursor-pointer hover:shadow-md hover:border-blue-200 transition-all" onClick={onClick}>
        {inner}
      </Card>
    );
  }
  return <Card>{inner}</Card>;
}

// ── Health Score ──────────────────────────────────────────────────────────────
function calcHealthScore(v: any, vIssues: any[], vInspections: any[], latestSvc: any): number {
  let score = 100;
  const openIssues = vIssues.filter((i: any) => ["open", "in_progress", "booked", "waiting_parts"].includes(i.status));
  score -= openIssues.length * 5;
  const failedInsp = vInspections.filter((i: any) => i.overallResult === "fail" && !i.reviewedAt);
  score -= failedInsp.length * 10;
  if (latestSvc?.nextServiceDate && new Date(latestSvc.nextServiceDate) < new Date()) score -= 15;
  if (v?.vehicleStatus === "unsafe") score -= 20;
  const catCounts: Record<string, number> = {};
  openIssues.forEach((i: any) => { catCounts[i.category] = (catCounts[i.category] || 0) + 1; });
  Object.values(catCounts).forEach(cnt => { if (cnt > 1) score -= (cnt - 1) * 5; });
  return Math.max(0, Math.min(100, Math.round(score)));
}

function HealthScoreCell({ score }: { score: number }) {
  const isGood = score >= 80, isMed = score >= 60;
  const bg    = isGood ? "bg-green-50 text-green-700" : isMed ? "bg-orange-50 text-orange-600" : "bg-red-100 text-red-700";
  const bar   = isGood ? "bg-green-500" : isMed ? "bg-orange-400" : "bg-red-500";
  const label = isGood ? "Healthy" : isMed ? "Attention" : "High Risk";
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${bg}`}>{score}%</span>
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${bar}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function FleetPage() {
  const { user } = useAuth();
  const role = user ? getDashboardRole(user) : "service";
  const isAdmin = ["admin", "manager", "coordinator"].includes(role);

  const { toast } = useToast();
  const qc = useQueryClient();

  const [search, setSearch]             = useState("");
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const [activeTab, setActiveTab]       = useState(isAdmin ? "vehicles" : "km");
  const [, navigate]                    = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [creatingJob, setCreatingJob]   = useState<Record<string, boolean>>({});

  const sendWeeklySummaryMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/fleet/send-weekly-summary", {}),
    onSuccess: () => toast({ title: "Weekly report sent", description: "Fleet summary emailed to info@terminators.co.za" }),
    onError: () => toast({ title: "Failed to send", description: "Could not send weekly fleet report.", variant: "destructive" }),
  });

  // ── Inspection action mutations ──────────────────────────────────────────────
  const markReviewedMutation = useMutation({
    mutationFn: async (insId: string) => {
      const r = await apiRequest("PATCH", `/api/fleet/inspections/${insId}`, {
        reviewedAt: new Date().toISOString(),
      });
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/fleet/inspections"] });
      toast({ title: "Marked as reviewed", description: "Inspection removed from alert strip." });
    },
    onError: () => toast({ title: "Error", description: "Could not mark as reviewed.", variant: "destructive" }),
  });

  const createWorkshopJobMutation = useMutation({
    mutationFn: async ({ ins, vName }: { ins: any; vName: string }) => {
      const items = ins.itemsJson ? JSON.parse(ins.itemsJson) : [];
      const failed = items.filter((it: any) => it.result === "fail").map((it: any) => it.name).join(", ");
      const body = {
        vehicleId: ins.vehicleId,
        issueSource: "inspection",
        sourceInspectionId: ins.id,
        description: `Failed inspection: ${failed || "see inspection"}. ${ins.comments || ""}`.trim(),
        reportedByWorkerId: ins.workerId,
        priority: "high",
        status: "open",
        notes: `Auto-created from failed inspection on ${new Date(ins.inspectionDate).toLocaleDateString("en-ZA")}`,
      };
      const r = await apiRequest("POST", "/api/fleet/workshop-jobs", body);
      return r.json();
    },
    onSuccess: (_data, { vName, ins }) => {
      qc.invalidateQueries({ queryKey: ["/api/fleet/workshop-jobs"] });
      qc.invalidateQueries({ queryKey: ["/api/fleet/issues"] });
      setCreatingJob(prev => ({ ...prev, [ins.id]: false }));
      toast({ title: "Workshop job created", description: `Maintenance request booked for ${vName}.` });
    },
    onError: (_e, { ins }) => {
      setCreatingJob(prev => ({ ...prev, [ins.id]: false }));
      toast({ title: "Error", description: "Could not create workshop job.", variant: "destructive" });
    },
  });

  // ── Data queries ────────────────────────────────────────────────────────────
  const { data: vehicles = [] }     = useQuery<any[]>({ queryKey: ["/api/fleet/vehicles"] });
  const { data: assignments = [] }  = useQuery<any[]>({ queryKey: ["/api/fleet/assignments"] });
  const { data: workers = [] }      = useQuery<any[]>({ queryKey: ["/api/workers"] });
  const { data: kmLogs = [] }       = useQuery<any[]>({
    queryKey: ["/api/fleet/km-logs", isAdmin ? undefined : user?.id],
    queryFn: async () => {
      const url = isAdmin ? "/api/fleet/km-logs" : `/api/fleet/km-logs?workerId=${user?.id}`;
      return asArray(await (await fetch(url, { credentials: "include" })).json());
    },
  });
  const { data: fuelFillups = [] }  = useQuery<any[]>({
    queryKey: ["/api/fleet/fuel-fillups", isAdmin ? undefined : user?.id],
    queryFn: async () => {
      const url = isAdmin ? "/api/fleet/fuel-fillups" : `/api/fleet/fuel-fillups?workerId=${user?.id}`;
      return asArray(await (await fetch(url, { credentials: "include" })).json());
    },
  });
  const { data: inspections = [] }  = useQuery<any[]>({
    queryKey: ["/api/fleet/inspections", isAdmin ? undefined : user?.id],
    queryFn: async () => {
      const url = isAdmin ? "/api/fleet/inspections" : `/api/fleet/inspections?workerId=${user?.id}`;
      return asArray(await (await fetch(url, { credentials: "include" })).json());
    },
  });
  const { data: issues = [] }       = useQuery<any[]>({
    queryKey: ["/api/fleet/issues"],
    queryFn: async () => { const r = await fetch("/api/fleet/issues"); const d = await r.json(); return Array.isArray(d) ? d : []; },
  });
  const { data: serviceRecords = [] } = useQuery<any[]>({
    queryKey: ["/api/fleet/service-records"],
    queryFn: async () => { const r = await fetch("/api/fleet/service-records"); const d = await r.json(); return Array.isArray(d) ? d : []; },
  });

  // ── Computed helpers ────────────────────────────────────────────────────────
  const now        = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const vehicleName = (id: string) => vehicles.find((v: any) => v.id === id)?.name ?? id;
  const workerName  = (id: string) => workers.find((w: any) => w.id === id)?.name ?? id;

  const kmThisMonth       = kmLogs.filter((l: any) => new Date(l.logDate) >= monthStart).reduce((s: number, l: any) => s + (l.totalKm || 0), 0);
  const fuelCostThisMonth = fuelFillups.filter((f: any) => new Date(f.fillDate) >= monthStart).reduce((s: number, f: any) => s + parseFloat(f.cost || "0"), 0);
  const failedInspections = inspections.filter((i: any) => i.overallResult === "fail");
  const openIssues        = issues.filter((i: any) => i.status === "open" || i.status === "in_progress");

  // Per-vehicle computed data (keyed by vehicleId)
  const vehicleStats = vehicles.reduce((acc: any, v: any) => {
    const vKm = kmLogs.filter((l: any) => l.vehicleId === v.id).sort((a: any, b: any) => new Date(b.logDate).getTime() - new Date(a.logDate).getTime());
    const vSvc = serviceRecords.filter((r: any) => r.vehicleId === v.id).sort((a: any, b: any) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime());
    const vInsp = inspections.filter((i: any) => i.vehicleId === v.id).sort((a: any, b: any) => new Date(b.inspectionDate).getTime() - new Date(a.inspectionDate).getTime());
    const currentOdo = vKm[0]?.endOdometer ?? null;
    const lastSvc = vSvc[0] ?? null;
    const due = calcServiceDue(lastSvc, currentOdo);
    acc[v.id] = { vKm, vSvc, vInsp, currentOdo, lastSvc, due };
    return acc;
  }, {} as Record<string, any>);

  // Fleet summary counts
  const totalVehicles    = vehicles.length;
  const activeVehicles   = vehicles.filter((v: any) => v.vehicleStatus === "active").length;
  const dueServiceCount  = vehicles.filter((v: any) => v.vehicleStatus === "due_service" || vehicleStats[v.id]?.due.urgency === "overdue" || vehicleStats[v.id]?.due.urgency === "soon").length;
  const workshopCount    = vehicles.filter((v: any) => v.vehicleStatus === "workshop").length;
  const unsafeCount      = vehicles.filter((v: any) => v.vehicleStatus === "unsafe").length;

  // Alert strip counts (alert strip only shows unreviewed failures)
  const today0 = new Date(); today0.setHours(0, 0, 0, 0);
  const resolvedToday = inspections.filter((i: any) =>
    i.overallResult === "fail" && i.reviewedAt && new Date(i.reviewedAt) >= today0
  ).length;

  // ── Filtered lists for other tabs ───────────────────────────────────────────
  const filteredKm = kmLogs.filter((l: any) => {
    const mv = vehicleFilter === "all" || l.vehicleId === vehicleFilter;
    const ms = !search || workerName(l.workerId).toLowerCase().includes(search.toLowerCase()) || vehicleName(l.vehicleId).toLowerCase().includes(search.toLowerCase());
    return mv && ms;
  });
  const filteredFuel = fuelFillups.filter((f: any) => {
    const mv = vehicleFilter === "all" || f.vehicleId === vehicleFilter;
    const ms = !search || vehicleName(f.vehicleId).toLowerCase().includes(search.toLowerCase());
    return mv && ms;
  });
  const filteredInspections = inspections.filter((i: any) => {
    const mv = vehicleFilter === "all" || i.vehicleId === vehicleFilter;
    const ms = !search || workerName(i.workerId).toLowerCase().includes(search.toLowerCase()) || vehicleName(i.vehicleId).toLowerCase().includes(search.toLowerCase());
    return mv && ms;
  });
  const filteredVehicles = vehicles.filter((v: any) => {
    if (!search) return true;
    const asgn = assignments.find((a: any) => a.vehicleId === v.id && a.isActive);
    const driver = asgn ? workerName(asgn.workerId) : "";
    return v.name.toLowerCase().includes(search.toLowerCase()) ||
           v.registration.toLowerCase().includes(search.toLowerCase()) ||
           driver.toLowerCase().includes(search.toLowerCase());
  });

  return (
        <div className="p-4 sm:p-6">
          <div className="max-w-7xl mx-auto space-y-5">

            {/* ── Page header ─────────────────────────────────────────────── */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <Truck className="h-6 w-6 text-blue-600" />
                  Fleet Dashboard
                </h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  {isAdmin ? "All vehicles & drivers" : "My fleet activity"}
                  <span className="ml-2 text-xs text-gray-400">
                    Service interval: {SERVICE_KM_INTERVAL.toLocaleString()} km or {SERVICE_MONTH_INTERVAL} months
                  </span>
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Link href="/fleet/km-log">
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <Gauge className="h-4 w-4" /> Log KMs
                  </Button>
                </Link>
                <Link href="/fleet/inspection">
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <ClipboardCheck className="h-4 w-4" /> Inspection
                  </Button>
                </Link>
                <Link href="/fleet/report-issue">
                  <Button size="sm" variant="outline" className="gap-1.5 border-orange-300 text-orange-700 hover:bg-orange-50">
                    <AlertTriangle className="h-4 w-4" /> Report Issue
                  </Button>
                </Link>
                <Link href="/fleet/fuel">
                  <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white">
                    <Fuel className="h-4 w-4" /> Fuel Fill-up
                  </Button>
                </Link>
                {isAdmin && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 border-purple-300 text-purple-700 hover:bg-purple-50"
                    onClick={() => sendWeeklySummaryMutation.mutate()}
                    disabled={sendWeeklySummaryMutation.isPending}
                  >
                    <Mail className="h-4 w-4" />
                    {sendWeeklySummaryMutation.isPending ? "Sending…" : "Weekly Report"}
                  </Button>
                )}
              </div>
            </div>

            {/* ── 6 summary cards ─────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <SummaryCard
                title="Total Vehicles" value={totalVehicles} sub="in fleet"
                icon={Truck} iconColor="text-blue-600" bgColor="bg-blue-100"
              />
              <SummaryCard
                title="Active" value={activeVehicles} sub="on the road"
                icon={CheckCircle} iconColor="text-green-600" bgColor="bg-green-100"
              />
              <SummaryCard
                title="Due Service" value={dueServiceCount} sub="km or time"
                icon={Wrench} iconColor="text-orange-600" bgColor="bg-orange-100"
                badge={dueServiceCount}
              />
              <SummaryCard
                title="Workshop" value={workshopCount} sub="off road"
                icon={Shield} iconColor="text-gray-600" bgColor="bg-gray-200"
              />
              <SummaryCard
                title="Unsafe" value={unsafeCount} sub="grounded"
                icon={TriangleAlert} iconColor="text-red-600" bgColor="bg-red-100"
                badge={unsafeCount}
              />
              <SummaryCard
                title="Open Issues" value={openIssues.length} sub="tap to review"
                icon={Activity} iconColor="text-purple-600" bgColor="bg-purple-100"
                badge={openIssues.length}
                onClick={() => { setActiveTab("vehicles"); navigate("/fleet/maintenance"); }}
              />
            </div>

            {/* ── Legend row ──────────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs text-gray-500 font-medium">Vehicle status:</span>
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                <span key={key} className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                  {cfg.label}
                </span>
              ))}
              <span className="text-xs text-gray-400 ml-2">Service due:</span>
              <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">● &gt;60 days</span>
              <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">● 30–60 days</span>
              <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">● &lt;30 days</span>
              <span className="text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded-full animate-pulse">● overdue</span>
            </div>

            {/* ── Failed inspection alert strip ────────────────────────────── */}
            {failedInspections.length > 0 && (
              <Card className="border-red-200 bg-red-50">
                <CardHeader className="pb-2 pt-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-sm text-red-800 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Failed Inspection Alerts
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-red-200 text-red-800 font-semibold px-2 py-0.5 rounded-full">
                        {failedInspections.length} active
                      </span>
                      {resolvedToday > 0 && (
                        <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">
                          {resolvedToday} resolved today
                        </span>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 pb-3">
                  {failedInspections.map((ins: any) => {
                    const items = ins.itemsJson ? JSON.parse(ins.itemsJson) : [];
                    const failedItems = items.filter((it: any) => it.result === "fail");
                    const vName = vehicleName(ins.vehicleId);
                    const isReviewing = markReviewedMutation.isPending && markReviewedMutation.variables === ins.id;
                    const isCreating = creatingJob[ins.id] || (createWorkshopJobMutation.isPending && createWorkshopJobMutation.variables?.ins?.id === ins.id);
                    return (
                      <div key={ins.id} className="bg-white rounded-lg border border-red-200 p-3 space-y-2.5">
                        {/* Top row: badge, vehicle, driver, date */}
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="destructive" className="text-xs">FAIL</Badge>
                            <span className="font-medium text-sm">{vName}</span>
                            <span className="text-gray-500 text-sm">· {workerName(ins.workerId)}</span>
                          </div>
                          <span className="text-xs text-gray-400 shrink-0">{format(new Date(ins.inspectionDate), "dd MMM yy HH:mm")}</span>
                        </div>

                        {/* Failed items chips */}
                        {failedItems.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {failedItems.map((it: any, i: number) => (
                              <span key={i} className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">{it.name}</span>
                            ))}
                          </div>
                        )}
                        {ins.comments && <p className="text-xs text-gray-500">{ins.comments}</p>}

                        {/* ── Action buttons ── */}
                        <div className="flex items-center gap-2 flex-wrap pt-0.5 border-t border-red-100">
                          {/* Open Vehicle */}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1.5 border-gray-300 hover:bg-gray-50"
                            onClick={() => navigate(`/fleet/vehicles/${ins.vehicleId}`)}
                          >
                            <Car className="h-3.5 w-3.5" />
                            Open Vehicle
                          </Button>

                          {/* Create Workshop Job */}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1.5 border-orange-300 text-orange-700 hover:bg-orange-50"
                            disabled={isCreating}
                            onClick={() => {
                              setCreatingJob(prev => ({ ...prev, [ins.id]: true }));
                              createWorkshopJobMutation.mutate({ ins, vName });
                            }}
                          >
                            <Wrench className="h-3.5 w-3.5" />
                            {isCreating ? "Creating…" : "Create Workshop Job"}
                          </Button>

                          {/* Mark Reviewed */}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1.5 border-green-300 text-green-700 hover:bg-green-50"
                            disabled={isReviewing}
                            onClick={() => markReviewedMutation.mutate(ins.id)}
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                            {isReviewing ? "Saving…" : "Mark Reviewed"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* ── Search + vehicle filter ──────────────────────────────────── */}
            <div className="flex gap-3 items-center flex-wrap">
              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input placeholder="Search driver or vehicle..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
              {isAdmin && (
                <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="All vehicles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Vehicles</SelectItem>
                    {vehicles.map((v: any) => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* ── Tabs ────────────────────────────────────────────────────── */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                {isAdmin && <TabsTrigger value="vehicles">Vehicles</TabsTrigger>}
                <TabsTrigger value="km">KM Logs</TabsTrigger>
                <TabsTrigger value="fuel">Fuel</TabsTrigger>
                <TabsTrigger value="inspections">Inspections</TabsTrigger>
              </TabsList>

              {/* ── VEHICLES TABLE ─────────────────────────────────────────── */}
              {isAdmin && (
                <TabsContent value="vehicles" className="mt-4">
                  <Card>
                    <CardContent className="p-0 overflow-x-auto">
                      <table className="w-full text-sm min-w-[1100px]">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="text-left px-4 py-3 font-medium text-gray-600">Vehicle</th>
                            <th className="text-left px-4 py-3 font-medium text-gray-600">Registration</th>
                            <th className="text-left px-4 py-3 font-medium text-gray-600">Driver</th>
                            <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                            <th className="text-right px-4 py-3 font-medium text-gray-600">Odometer</th>
                            <th className="text-left px-4 py-3 font-medium text-gray-600">Health</th>
                            <th className="text-left px-4 py-3 font-medium text-gray-600">Last Inspection</th>
                            <th className="text-center px-4 py-3 font-medium text-gray-600">Issues</th>
                            <th className="text-left px-4 py-3 font-medium text-gray-600">Last Service</th>
                            <th className="text-left px-4 py-3 font-medium text-gray-600">Next Service Due</th>
                            <th className="text-center px-4 py-3 font-medium text-gray-600">Quick Actions</th>
                            <th className="px-2 py-3" />
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {filteredVehicles.map((v: any) => {
                            const stats = vehicleStats[v.id] ?? {};
                            const { currentOdo, lastSvc, due, vInsp } = stats;
                            const lastInsp = vInsp?.[0] ?? null;
                            const assignment = assignments.find((a: any) => a.vehicleId === v.id && a.isActive);
                            const openCount = issues.filter((i: any) => i.vehicleId === v.id && (i.status === "open" || i.status === "in_progress")).length;
                            const vIssuesAll = issues.filter((i: any) => i.vehicleId === v.id);
                            const healthScore = calcHealthScore(v, vIssuesAll, vInsp ?? [], lastSvc);

                            return (
                              <tr
                                key={v.id}
                                className="hover:bg-blue-50 cursor-pointer transition-colors group"
                                onClick={() => navigate(`/fleet/vehicles/${v.id}`)}
                              >
                                {/* Vehicle name */}
                                <td className="px-4 py-3 font-medium">
                                  <span className="flex items-center gap-2">
                                    <Car className="h-4 w-4 text-blue-500 shrink-0" />
                                    <span className="group-hover:text-blue-700 transition-colors">{v.name}</span>
                                  </span>
                                </td>

                                {/* Registration */}
                                <td className="px-4 py-3 font-mono text-xs text-gray-600">{v.registration}</td>

                                {/* Driver */}
                                <td className="px-4 py-3">
                                  {assignment
                                    ? <span className="flex items-center gap-1 text-gray-700"><User className="h-3.5 w-3.5 shrink-0 text-gray-400" />{workerName(assignment.workerId)}</span>
                                    : <span className="text-gray-400 text-xs">Unassigned</span>}
                                </td>

                                {/* Status */}
                                <td className="px-4 py-3">
                                  <VehicleStatusBadge status={v.vehicleStatus ?? "active"} />
                                </td>

                                {/* Odometer */}
                                <td className="px-4 py-3 text-right">
                                  {currentOdo != null
                                    ? <span className="font-medium text-gray-800">{currentOdo.toLocaleString()} <span className="text-xs text-gray-400">km</span></span>
                                    : <span className="text-gray-300">—</span>}
                                </td>

                                {/* Health Score */}
                                <td className="px-4 py-3">
                                  <HealthScoreCell score={healthScore} />
                                </td>

                                {/* Last inspection */}
                                <td className="px-4 py-3">
                                  {lastInsp ? (
                                    <span className="flex items-center gap-1.5">
                                      {lastInsp.overallResult === "pass"
                                        ? <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                                        : <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                                      <span className="text-xs text-gray-600">{format(new Date(lastInsp.inspectionDate), "dd MMM yy")}</span>
                                    </span>
                                  ) : <span className="text-gray-300 text-xs">—</span>}
                                </td>

                                {/* Open issues */}
                                <td className="px-4 py-3 text-center">
                                  {openCount > 0
                                    ? <span
                                        className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-700 text-xs font-bold cursor-pointer hover:bg-red-200"
                                        onClick={e => { e.stopPropagation(); navigate(`/fleet/vehicles/${v.id}`); }}
                                      >{openCount}</span>
                                    : <span className="text-gray-300 text-xs">—</span>}
                                </td>

                                {/* Last service */}
                                <td className="px-4 py-3">
                                  {lastSvc ? (
                                    <span className="flex items-center gap-1">
                                      <Wrench className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                      <span className="text-xs text-gray-600">{format(new Date(lastSvc.serviceDate), "dd MMM yy")}</span>
                                    </span>
                                  ) : <span className="text-gray-300 text-xs">—</span>}
                                </td>

                                {/* Next service due — colour-coded */}
                                <td className="px-4 py-3">
                                  <ServiceDueCell due={due} nextSvcDate={lastSvc?.nextServiceDate} />
                                </td>

                                {/* Quick actions */}
                                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                                  <div className="flex items-center gap-1">
                                    <button
                                      title="Inspect"
                                      className="p-1.5 rounded-lg hover:bg-green-100 text-gray-400 hover:text-green-700 transition-colors"
                                      onClick={e => { e.stopPropagation(); navigate(`/fleet/inspection?vehicleId=${v.id}`); }}
                                    >
                                      <ClipboardCheck className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      title="Log Fuel"
                                      className="p-1.5 rounded-lg hover:bg-amber-100 text-gray-400 hover:text-amber-700 transition-colors"
                                      onClick={e => { e.stopPropagation(); navigate(`/fleet/fuel?vehicleId=${v.id}`); }}
                                    >
                                      <Fuel className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      title="Report Issue"
                                      className="p-1.5 rounded-lg hover:bg-red-100 text-gray-400 hover:text-red-700 transition-colors"
                                      onClick={e => { e.stopPropagation(); navigate(`/fleet/report-issue?vehicleId=${v.id}`); }}
                                    >
                                      <AlertTriangle className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </td>

                                {/* Arrow */}
                                <td className="px-2 py-3">
                                  <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-blue-400" />
                                </td>
                              </tr>
                            );
                          })}
                          {filteredVehicles.length === 0 && (
                            <tr><td colSpan={11} className="px-4 py-10 text-center text-gray-400">No vehicles found</td></tr>
                          )}
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>
                </TabsContent>
              )}

              {/* ── KM LOGS ──────────────────────────────────────────────────── */}
              <TabsContent value="km" className="mt-4">
                <Card>
                  <CardContent className="p-0">
                    <table className="w-full min-w-[760px] text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">Driver</th>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">Vehicle</th>
                          <th className="text-right px-4 py-3 font-medium text-gray-600">Start</th>
                          <th className="text-right px-4 py-3 font-medium text-gray-600">End</th>
                          <th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
                          <th className="text-right px-4 py-3 font-medium text-gray-600">Business</th>
                          <th className="text-right px-4 py-3 font-medium text-gray-600">Private</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {filteredKm.map((l: any) => (
                          <tr key={l.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-gray-600">{format(new Date(l.logDate), "dd MMM yyyy")}</td>
                            <td className="px-4 py-3 font-medium">{workerName(l.workerId)}</td>
                            <td className="px-4 py-3 text-gray-600">{vehicleName(l.vehicleId)}</td>
                            <td className="px-4 py-3 text-right">{l.startOdometer?.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right">{l.endOdometer?.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right font-medium">{l.totalKm?.toLocaleString()} km</td>
                            <td className="px-4 py-3 text-right text-green-600">{l.businessKm == null ? <span className="text-amber-700">Review</span> : `${l.businessKm} km`}</td>
                            <td className="px-4 py-3 text-right text-gray-500" title={l.odometerCalculation?.previousPmDate ? `Prior PM: ${new Date(l.odometerCalculation.previousPmDate).toLocaleString("en-ZA")}` : l.odometerCalculation?.flags?.join(", ")}>{l.privateKm == null ? <span className="text-amber-700">Review</span> : `${l.privateKm} km`}</td>
                          </tr>
                        ))}
                        {filteredKm.length === 0 && (
                          <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No KM logs found</td></tr>
                        )}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ── FUEL ─────────────────────────────────────────────────────── */}
              <TabsContent value="fuel" className="mt-4">
                <Card>
                  <CardContent className="overflow-x-auto p-0">
                    <table className="w-full min-w-[850px] text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">Driver</th>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">Vehicle</th>
                           <th className="text-left px-4 py-3 font-medium text-gray-600">Fuel Type</th>
                           <th className="text-right px-4 py-3 font-medium text-gray-600">Odometer</th>
                          <th className="text-right px-4 py-3 font-medium text-gray-600">Litres</th>
                          <th className="text-right px-4 py-3 font-medium text-gray-600">Cost</th>
                           <th className="text-left px-4 py-3 font-medium text-gray-600">Slip</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {filteredFuel.map((f: any) => (
                          <tr key={f.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-gray-600">{format(new Date(f.fillDate), "dd MMM yyyy")}</td>
                            <td className="px-4 py-3 font-medium">{workerName(f.workerId)}</td>
                            <td className="px-4 py-3 text-gray-600">{vehicleName(f.vehicleId)}</td>
                             <td className="px-4 py-3 text-gray-600">{f.fuelType || "—"}</td>
                             <td className="px-4 py-3 text-right text-gray-600">{f.odometer?.toLocaleString?.() ?? "—"} km</td>
                            <td className="px-4 py-3 text-right">{parseFloat(f.litres || "0").toFixed(1)} L</td>
                            <td className="px-4 py-3 text-right font-medium text-amber-700">R {parseFloat(f.cost || "0").toFixed(2)}</td>
                             <td className="px-4 py-3">{f.receiptPhoto ? <a href={f.receiptPhoto} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-blue-600 underline">View slip</a> : <span className="text-gray-400">—</span>}</td>
                          </tr>
                        ))}
                        {filteredFuel.length === 0 && (
                          <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No fuel records found</td></tr>
                        )}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ── INSPECTIONS ───────────────────────────────────────────────── */}
              <TabsContent value="inspections" className="mt-4">
                <Card>
                  <CardContent className="p-0">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">Driver</th>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">Vehicle</th>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">Result</th>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">Failed Items</th>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">Comments</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {filteredInspections.map((ins: any) => {
                          const items = ins.itemsJson ? JSON.parse(ins.itemsJson) : [];
                          const failedItems = items.filter((it: any) => it.result === "fail");
                          return (
                            <tr key={ins.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-gray-600">{format(new Date(ins.inspectionDate), "dd MMM yyyy HH:mm")}</td>
                              <td className="px-4 py-3 font-medium">{workerName(ins.workerId)}</td>
                              <td className="px-4 py-3 text-gray-600">{vehicleName(ins.vehicleId)}</td>
                              <td className="px-4 py-3">
                                {ins.overallResult === "pass"
                                  ? <Badge className="bg-green-100 text-green-700 flex items-center gap-1 w-fit"><CheckCircle className="h-3 w-3" /> Pass</Badge>
                                  : <Badge variant="destructive" className="flex items-center gap-1 w-fit"><AlertTriangle className="h-3 w-3" /> Fail</Badge>}
                              </td>
                              <td className="px-4 py-3">
                                {failedItems.length > 0
                                  ? <span className="text-red-600 text-xs">{failedItems.map((it: any) => it.name).join(", ")}</span>
                                  : <span className="text-gray-400">—</span>}
                              </td>
                              <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">{ins.comments || "—"}</td>
                            </tr>
                          );
                        })}
                        {filteredInspections.length === 0 && (
                          <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No inspections found</td></tr>
                        )}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
  );
}
