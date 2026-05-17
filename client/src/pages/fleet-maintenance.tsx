import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";
import {
  Wrench, AlertCircle, AlertTriangle, CheckCircle, Clock, Truck, Search,
  TrendingUp, DollarSign, ChevronRight,
} from "lucide-react";
import { format, isPast, addDays } from "date-fns";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";

const URGENCY_OPTIONS = [
  { value: "low", label: "Low", color: "bg-gray-100 text-gray-600 border-gray-300" },
  { value: "medium", label: "Medium", color: "bg-amber-100 text-amber-700 border-amber-300" },
  { value: "high", label: "High", color: "bg-orange-100 text-orange-700 border-orange-300" },
  { value: "not_safe", label: "Not Safe", color: "bg-red-100 text-red-700 border-red-400" },
];

const STATUS_COLORS: Record<string, string> = {
  open: "bg-red-100 text-red-700",
  in_progress: "bg-amber-100 text-amber-700",
  booked: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  not_required: "bg-gray-100 text-gray-500",
};
const STATUS_LABELS: Record<string, string> = {
  open: "Open", in_progress: "In Progress", booked: "Booked",
  completed: "Completed", not_required: "Not Required",
};

const CATEGORY_LABELS: Record<string, string> = {
  tyres: "Tyres", engine: "Engine", brakes: "Brakes", electrical: "Electrical",
  body: "Body Damage", lights: "Lights", fluids: "Fluids", windscreen: "Windscreen", other: "Other",
};

export default function FleetMaintenance() {
  const [search, setSearch] = useState("");

  const { data: vehicles = [] } = useQuery<any[]>({ queryKey: ["/api/fleet/vehicles"] });
  const { data: issues = [] } = useQuery<any[]>({ queryKey: ["/api/fleet/issues"] });
  const { data: serviceRecords = [] } = useQuery<any[]>({ queryKey: ["/api/fleet/service-records"] });
  const { data: kmLogs = [] } = useQuery<any[]>({ queryKey: ["/api/fleet/km-logs"] });
  const { data: workers = [] } = useQuery<any[]>({ queryKey: ["/api/workers"] });

  const workerName = (id: string) => (workers as any[]).find((w: any) => w.id === id)?.name ?? id;

  const openIssues = (issues as any[]).filter((i: any) => !["completed", "not_required"].includes(i.status));
  const notSafeIssues = (issues as any[]).filter((i: any) => i.urgency === "not_safe" && !["completed", "not_required"].includes(i.status));

  // Per-vehicle latest service record for due/overdue check
  const latestServiceByVehicle = (vehicles as any[]).reduce((acc: any, v: any) => {
    const recs = (serviceRecords as any[]).filter((r: any) => r.vehicleId === v.id).sort((a: any, b: any) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime());
    acc[v.id] = recs[0] ?? null;
    return acc;
  }, {});

  // Latest odometer per vehicle
  const latestOdoByVehicle = (vehicles as any[]).reduce((acc: any, v: any) => {
    const logs = (kmLogs as any[]).filter((l: any) => l.vehicleId === v.id).sort((a: any, b: any) => new Date(b.logDate).getTime() - new Date(a.logDate).getTime());
    acc[v.id] = logs[0]?.endOdometer ?? null;
    return acc;
  }, {});

  const isDueSoon = (v: any) => {
    const sr = latestServiceByVehicle[v.id];
    if (!sr) return false;
    if (sr.nextServiceDate) {
      const due = new Date(sr.nextServiceDate);
      return !isPast(due) && due <= addDays(new Date(), 30);
    }
    if (sr.nextServiceOdometer && latestOdoByVehicle[v.id]) {
      return sr.nextServiceOdometer - latestOdoByVehicle[v.id] <= 1000 && sr.nextServiceOdometer - latestOdoByVehicle[v.id] > 0;
    }
    return false;
  };

  const isOverdue = (v: any) => {
    const sr = latestServiceByVehicle[v.id];
    if (!sr) return false;
    if (sr.nextServiceDate && isPast(new Date(sr.nextServiceDate))) return true;
    if (sr.nextServiceOdometer && latestOdoByVehicle[v.id] && latestOdoByVehicle[v.id] >= sr.nextServiceOdometer) return true;
    return false;
  };

  const dueSoonVehicles = (vehicles as any[]).filter(isDueSoon);
  const overdueVehicles = (vehicles as any[]).filter(isOverdue);

  const totalServiceCost = (serviceRecords as any[]).reduce((s: number, r: any) => s + parseFloat(r.cost || "0"), 0);

  const filteredIssues = (issues as any[]).filter((i: any) => {
    if (!search) return true;
    const vn = (vehicles as any[]).find((v: any) => v.id === i.vehicleId)?.name ?? "";
    const wn = workerName(i.workerId);
    return vn.toLowerCase().includes(search.toLowerCase()) || wn.toLowerCase().includes(search.toLowerCase()) || i.description.toLowerCase().includes(search.toLowerCase());
  });

  const vehiclesWithOpenIssues = (vehicles as any[]).filter((v: any) =>
    openIssues.some((i: any) => i.vehicleId === v.id)
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header title="Fleet Maintenance" onMobileMenuToggle={() => {}} />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          <div className="max-w-7xl mx-auto space-y-6">

            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <Wrench className="h-6 w-6 text-blue-600" /> Fleet Maintenance
                </h1>
                <p className="text-sm text-gray-500 mt-0.5">Vehicle issues, service requests, and maintenance history</p>
              </div>
              <Link href="/fleet/report-issue">
                <Button size="sm" variant="outline" className="gap-1.5">
                  <AlertCircle className="h-4 w-4" /> Report Issue
                </Button>
              </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Open Issues</p>
                      <p className="text-2xl font-bold mt-0.5">{openIssues.length}</p>
                    </div>
                    <div className="w-12 h-12 bg-red-500 rounded-xl flex items-center justify-center">
                      <AlertCircle className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className={notSafeIssues.length > 0 ? "border-red-300 bg-red-50" : ""}>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-sm ${notSafeIssues.length > 0 ? "text-red-600" : "text-gray-500"}`}>Not Safe</p>
                      <p className={`text-2xl font-bold mt-0.5 ${notSafeIssues.length > 0 ? "text-red-700" : ""}`}>{notSafeIssues.length}</p>
                    </div>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${notSafeIssues.length > 0 ? "bg-red-600" : "bg-gray-400"}`}>
                      <AlertTriangle className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className={overdueVehicles.length > 0 ? "border-orange-300 bg-orange-50" : ""}>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Overdue Service</p>
                      <p className={`text-2xl font-bold mt-0.5 ${overdueVehicles.length > 0 ? "text-orange-700" : ""}`}>{overdueVehicles.length}</p>
                    </div>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${overdueVehicles.length > 0 ? "bg-orange-500" : "bg-gray-400"}`}>
                      <Clock className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Total Service Cost</p>
                      <p className="text-xl font-bold mt-0.5">R {totalServiceCost.toFixed(0)}</p>
                    </div>
                    <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center">
                      <DollarSign className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Not-safe alert */}
            {notSafeIssues.length > 0 && (
              <div className="bg-red-600 text-white rounded-xl px-5 py-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-bold">{notSafeIssues.length} vehicle{notSafeIssues.length > 1 ? "s" : ""} reported as NOT SAFE TO DRIVE</p>
                    <p className="text-sm text-red-100">Immediate attention required. Check vehicle profiles below.</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {notSafeIssues.map((i: any) => {
                    const v = (vehicles as any[]).find((vv: any) => vv.id === i.vehicleId);
                    return (
                      <Link key={i.id} href={`/fleet/maintenance/${i.vehicleId}`}>
                        <span className="bg-red-700 hover:bg-red-800 text-white text-sm px-3 py-1 rounded-lg cursor-pointer">
                          {v?.name ?? i.vehicleId}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Search */}
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input placeholder="Search issues, vehicles, drivers..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>

            <Tabs defaultValue="vehicles">
              <TabsList>
                <TabsTrigger value="vehicles">Vehicles ({vehiclesWithOpenIssues.length} with issues)</TabsTrigger>
                <TabsTrigger value="all-issues">All Issues ({filteredIssues.length})</TabsTrigger>
                <TabsTrigger value="service">Service Schedule</TabsTrigger>
                <TabsTrigger value="history">Service History</TabsTrigger>
              </TabsList>

              {/* Vehicles overview */}
              <TabsContent value="vehicles" className="mt-4">
                <div className="grid gap-3">
                  {(vehicles as any[]).map((v: any) => {
                    const vIssues = (issues as any[]).filter((i: any) => i.vehicleId === v.id);
                    const openVIssues = vIssues.filter((i: any) => !["completed", "not_required"].includes(i.status));
                    const hasNotSafe = vIssues.some((i: any) => i.urgency === "not_safe" && !["completed", "not_required"].includes(i.status));
                    const sr = latestServiceByVehicle[v.id];
                    const overdue = isOverdue(v);
                    const dueSoon = isDueSoon(v);
                    return (
                      <Link key={v.id} href={`/fleet/maintenance/${v.id}`}>
                        <Card className={`cursor-pointer hover:shadow-md transition-shadow ${hasNotSafe ? "border-red-300" : overdue ? "border-orange-200" : ""}`}>
                          <CardContent className="py-4 px-5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${hasNotSafe ? "bg-red-100" : openVIssues.length > 0 ? "bg-orange-100" : "bg-green-100"}`}>
                                  <Truck className={`h-5 w-5 ${hasNotSafe ? "text-red-600" : openVIssues.length > 0 ? "text-orange-600" : "text-green-600"}`} />
                                </div>
                                <div>
                                  <p className="font-semibold text-gray-900">{v.name}</p>
                                  <p className="text-xs text-gray-500">{v.registration} · {v.year}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="text-right">
                                  {hasNotSafe && <Badge className="bg-red-100 text-red-700 text-xs mb-1">⚠ NOT SAFE</Badge>}
                                  {openVIssues.length > 0 && (
                                    <p className="text-sm font-medium text-orange-600">{openVIssues.length} open issue{openVIssues.length > 1 ? "s" : ""}</p>
                                  )}
                                  {openVIssues.length === 0 && <p className="text-sm text-green-600">No open issues</p>}
                                  {(overdue || dueSoon) && (
                                    <p className={`text-xs ${overdue ? "text-red-500 font-medium" : "text-amber-600"}`}>
                                      {overdue ? "Service overdue" : "Service due soon"}
                                    </p>
                                  )}
                                  {sr && <p className="text-xs text-gray-400">Last service: {format(new Date(sr.serviceDate), "dd MMM yyyy")}</p>}
                                </div>
                                <ChevronRight className="h-4 w-4 text-gray-400" />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    );
                  })}
                  {(vehicles as any[]).length === 0 && (
                    <p className="text-center text-gray-400 py-8">No vehicles in fleet</p>
                  )}
                </div>
              </TabsContent>

              {/* All issues table */}
              <TabsContent value="all-issues" className="mt-4">
                <Card>
                  <CardContent className="p-0">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">Vehicle</th>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">Driver</th>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">Description</th>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">Urgency</th>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {filteredIssues.map((issue: any) => {
                          const v = (vehicles as any[]).find((vv: any) => vv.id === issue.vehicleId);
                          const urg = URGENCY_OPTIONS.find(u => u.value === issue.urgency);
                          return (
                            <tr key={issue.id} className={`hover:bg-gray-50 ${issue.urgency === "not_safe" ? "bg-red-50" : ""}`}>
                              <td className="px-4 py-3 text-gray-600">{format(new Date(issue.reportedAt), "dd MMM HH:mm")}</td>
                              <td className="px-4 py-3 font-medium text-xs">{v?.name ?? issue.vehicleId}</td>
                              <td className="px-4 py-3 text-xs">{workerName(issue.workerId)}</td>
                              <td className="px-4 py-3">{CATEGORY_LABELS[issue.category] ?? issue.category}</td>
                              <td className="px-4 py-3 max-w-xs text-xs text-gray-600 truncate">{issue.description}</td>
                              <td className="px-4 py-3">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${urg?.color ?? ""}`}>{urg?.label ?? issue.urgency}</span>
                              </td>
                              <td className="px-4 py-3">
                                <Badge className={`text-xs ${STATUS_COLORS[issue.status] ?? ""}`}>{STATUS_LABELS[issue.status] ?? issue.status}</Badge>
                              </td>
                              <td className="px-4 py-3">
                                <Link href={`/fleet/maintenance/${issue.vehicleId}`}>
                                  <Button variant="ghost" size="sm" className="text-xs h-7 text-blue-600">View</Button>
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                        {filteredIssues.length === 0 && (
                          <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No issues found</td></tr>
                        )}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Service schedule */}
              <TabsContent value="service" className="mt-4">
                <Card>
                  <CardContent className="p-0">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">Vehicle</th>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">Last Service</th>
                          <th className="text-right px-4 py-3 font-medium text-gray-600">Last Odometer</th>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">Next Due Date</th>
                          <th className="text-right px-4 py-3 font-medium text-gray-600">Next Due Odo</th>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">Provider</th>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {(vehicles as any[]).map((v: any) => {
                          const sr = latestServiceByVehicle[v.id];
                          const overdue = isOverdue(v);
                          const dueSoon = isDueSoon(v);
                          return (
                            <tr key={v.id} className={`hover:bg-gray-50 ${overdue ? "bg-red-50" : dueSoon ? "bg-amber-50" : ""}`}>
                              <td className="px-4 py-3">
                                <Link href={`/fleet/maintenance/${v.id}`}>
                                  <span className="font-medium text-blue-600 hover:underline cursor-pointer">{v.name}</span>
                                </Link>
                                <p className="text-xs text-gray-400">{v.registration}</p>
                              </td>
                              <td className="px-4 py-3 text-gray-600">{sr ? format(new Date(sr.serviceDate), "dd MMM yyyy") : "—"}</td>
                              <td className="px-4 py-3 text-right">{sr ? sr.odometer?.toLocaleString() + " km" : "—"}</td>
                              <td className="px-4 py-3">{sr?.nextServiceDate ? format(new Date(sr.nextServiceDate), "dd MMM yyyy") : "—"}</td>
                              <td className="px-4 py-3 text-right">{sr?.nextServiceOdometer ? sr.nextServiceOdometer.toLocaleString() + " km" : "—"}</td>
                              <td className="px-4 py-3 text-gray-600 text-xs">{sr?.serviceProvider ?? "—"}</td>
                              <td className="px-4 py-3">
                                {!sr ? <span className="text-gray-400 text-xs">No record</span>
                                  : overdue ? <Badge className="bg-red-100 text-red-700 text-xs">Overdue</Badge>
                                    : dueSoon ? <Badge className="bg-amber-100 text-amber-700 text-xs">Due Soon</Badge>
                                      : <Badge className="bg-green-100 text-green-700 text-xs">OK</Badge>
                                }
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Service history */}
              <TabsContent value="history" className="mt-4">
                <Card>
                  <CardContent className="p-0">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">Vehicle</th>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">Provider</th>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">Work Done</th>
                          <th className="text-right px-4 py-3 font-medium text-gray-600">Odometer</th>
                          <th className="text-right px-4 py-3 font-medium text-gray-600">Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {(serviceRecords as any[]).sort((a: any, b: any) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime()).map((r: any) => {
                          const v = (vehicles as any[]).find((vv: any) => vv.id === r.vehicleId);
                          return (
                            <tr key={r.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-gray-600">{format(new Date(r.serviceDate), "dd MMM yyyy")}</td>
                              <td className="px-4 py-3">
                                <Link href={`/fleet/maintenance/${r.vehicleId}`}>
                                  <span className="font-medium text-blue-600 hover:underline cursor-pointer text-xs">{v?.name ?? r.vehicleId}</span>
                                </Link>
                              </td>
                              <td className="px-4 py-3 text-gray-600 text-xs">{r.serviceProvider}</td>
                              <td className="px-4 py-3 max-w-xs text-xs text-gray-600 truncate">{r.workDone}</td>
                              <td className="px-4 py-3 text-right">{r.odometer?.toLocaleString()} km</td>
                              <td className="px-4 py-3 text-right font-medium text-green-700">R {parseFloat(r.cost || "0").toFixed(2)}</td>
                            </tr>
                          );
                        })}
                        {(serviceRecords as any[]).length === 0 && (
                          <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No service records yet</td></tr>
                        )}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

          </div>
        </main>
      </div>
    </div>
  );
}
