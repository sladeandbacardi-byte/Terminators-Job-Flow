import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { getDashboardRole } from "@/lib/dashboardRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "wouter";
import {
  Truck, Gauge, Fuel, ClipboardCheck, AlertTriangle, CheckCircle,
  Car, Calendar, User, Plus, Search,
} from "lucide-react";
import { format } from "date-fns";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";

function StatCard({ title, value, sub, icon: Icon, color }: {
  title: string; value: string | number; sub?: string;
  icon: any; color: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">{title}</p>
            <p className="text-2xl font-bold mt-0.5">{value}</p>
            {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
          </div>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function FleetPage() {
  const { user } = useAuth();
  const role = user ? getDashboardRole(user) : "service";
  const isAdmin = ["admin", "manager", "coordinator"].includes(role);

  const [search, setSearch] = useState("");
  const [vehicleFilter, setVehicleFilter] = useState("all");

  const { data: vehicles = [] } = useQuery<any[]>({ queryKey: ["/api/fleet/vehicles"] });
  const { data: assignments = [] } = useQuery<any[]>({ queryKey: ["/api/fleet/assignments"] });
  const { data: kmLogs = [] } = useQuery<any[]>({
    queryKey: ["/api/fleet/km-logs", isAdmin ? undefined : user?.id],
    queryFn: async () => {
      const url = isAdmin ? "/api/fleet/km-logs" : `/api/fleet/km-logs?workerId=${user?.id}`;
      const res = await fetch(url, { credentials: "include" });
      return res.json();
    },
  });
  const { data: fuelFillups = [] } = useQuery<any[]>({
    queryKey: ["/api/fleet/fuel-fillups", isAdmin ? undefined : user?.id],
    queryFn: async () => {
      const url = isAdmin ? "/api/fleet/fuel-fillups" : `/api/fleet/fuel-fillups?workerId=${user?.id}`;
      const res = await fetch(url, { credentials: "include" });
      return res.json();
    },
  });
  const { data: inspections = [] } = useQuery<any[]>({
    queryKey: ["/api/fleet/inspections", isAdmin ? undefined : user?.id],
    queryFn: async () => {
      const url = isAdmin ? "/api/fleet/inspections" : `/api/fleet/inspections?workerId=${user?.id}`;
      const res = await fetch(url, { credentials: "include" });
      return res.json();
    },
  });
  const { data: workers = [] } = useQuery<any[]>({ queryKey: ["/api/workers"] });

  // stats
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const kmThisMonth = kmLogs
    .filter((l: any) => new Date(l.logDate) >= monthStart)
    .reduce((s: number, l: any) => s + (l.totalKm || 0), 0);
  const fuelCostThisMonth = fuelFillups
    .filter((f: any) => new Date(f.fillDate) >= monthStart)
    .reduce((s: number, f: any) => s + parseFloat(f.cost || "0"), 0);
  const failedInspections = inspections.filter((i: any) => i.overallResult === "fail");

  const vehicleName = (id: string) => vehicles.find((v: any) => v.id === id)?.name ?? id;
  const workerName = (id: string) => workers.find((w: any) => w.id === id)?.name ?? id;

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

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header title="Fleet" onMobileMenuToggle={() => setMobileMenuOpen(o => !o)} />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          <div className="max-w-7xl mx-auto space-y-6">

            {/* Header row */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <Truck className="h-6 w-6 text-blue-600" />
                  Fleet Dashboard
                </h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  {isAdmin ? "All vehicles & drivers" : "My fleet activity"}
                </p>
              </div>
              <div className="flex gap-2">
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
                <Link href="/fleet/fuel">
                  <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white">
                    <Fuel className="h-4 w-4" /> Fuel Fill-up
                  </Button>
                </Link>
              </div>
            </div>

            {/* Stats cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard title="Active Vehicles" value={vehicles.filter((v: any) => v.isActive).length} sub="in fleet" icon={Truck} color="bg-blue-500" />
              <StatCard title="KMs This Month" value={kmThisMonth.toLocaleString()} sub="business + private" icon={Gauge} color="bg-green-500" />
              <StatCard title="Fuel Cost (MTD)" value={`R ${fuelCostThisMonth.toFixed(2)}`} sub="month to date" icon={Fuel} color="bg-amber-500" />
              <StatCard title="Failed Inspections" value={failedInspections.length} sub="require attention" icon={AlertTriangle} color={failedInspections.length > 0 ? "bg-red-500" : "bg-gray-400"} />
            </div>

            {/* Failed inspection alerts */}
            {failedInspections.length > 0 && (
              <Card className="border-red-200 bg-red-50">
                <CardHeader className="pb-3 pt-4">
                  <CardTitle className="text-base text-red-800 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Failed Inspection Alerts ({failedInspections.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 pb-4">
                  {failedInspections.map((ins: any) => {
                    const items = ins.itemsJson ? JSON.parse(ins.itemsJson) : [];
                    const failedItems = items.filter((it: any) => it.result === "fail");
                    return (
                      <div key={ins.id} className="bg-white rounded-lg border border-red-200 p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="destructive" className="text-xs">FAIL</Badge>
                            <span className="font-medium text-sm">{vehicleName(ins.vehicleId)}</span>
                            <span className="text-gray-500 text-sm">· {workerName(ins.workerId)}</span>
                          </div>
                          <span className="text-xs text-gray-400">{format(new Date(ins.inspectionDate), "dd MMM yyyy HH:mm")}</span>
                        </div>
                        {failedItems.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {failedItems.map((it: any, i: number) => (
                              <span key={i} className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">{it.name}</span>
                            ))}
                          </div>
                        )}
                        {ins.comments && <p className="text-xs text-gray-500 mt-1">{ins.comments}</p>}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* Filters */}
            <div className="flex gap-3 items-center">
              <div className="relative flex-1 max-w-xs">
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

            {/* Tabs */}
            <Tabs defaultValue="vehicles">
              <TabsList>
                {isAdmin && <TabsTrigger value="vehicles">Vehicles</TabsTrigger>}
                <TabsTrigger value="km">KM Logs</TabsTrigger>
                <TabsTrigger value="fuel">Fuel</TabsTrigger>
                <TabsTrigger value="inspections">Inspections</TabsTrigger>
              </TabsList>

              {isAdmin && (
                <TabsContent value="vehicles" className="mt-4">
                  <Card>
                    <CardContent className="p-0">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="text-left px-4 py-3 font-medium text-gray-600">Vehicle</th>
                            <th className="text-left px-4 py-3 font-medium text-gray-600">Registration</th>
                            <th className="text-left px-4 py-3 font-medium text-gray-600">Assigned Driver</th>
                            <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {vehicles.map((v: any) => {
                            const assignment = assignments.find((a: any) => a.vehicleId === v.id && a.isActive);
                            return (
                              <tr key={v.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 font-medium flex items-center gap-2">
                                  <Car className="h-4 w-4 text-blue-500" /> {v.name}
                                </td>
                                <td className="px-4 py-3 text-gray-600">{v.registration}</td>
                                <td className="px-4 py-3">
                                  {assignment ? <span className="flex items-center gap-1 text-gray-700"><User className="h-3.5 w-3.5" />{workerName(assignment.workerId)}</span> : <span className="text-gray-400">Unassigned</span>}
                                </td>
                                <td className="px-4 py-3">
                                  <Badge variant={v.isActive ? "default" : "secondary"} className={v.isActive ? "bg-green-100 text-green-700" : ""}>
                                    {v.isActive ? "Active" : "Inactive"}
                                  </Badge>
                                </td>
                              </tr>
                            );
                          })}
                          {vehicles.length === 0 && (
                            <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No vehicles in fleet</td></tr>
                          )}
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>
                </TabsContent>
              )}

              <TabsContent value="km" className="mt-4">
                <Card>
                  <CardContent className="p-0">
                    <table className="w-full text-sm">
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
                            <td className="px-4 py-3 text-right text-green-600">{l.businessKm} km</td>
                            <td className="px-4 py-3 text-right text-gray-500">{l.privateKm} km</td>
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

              <TabsContent value="fuel" className="mt-4">
                <Card>
                  <CardContent className="p-0">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">Driver</th>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">Vehicle</th>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">Station</th>
                          <th className="text-right px-4 py-3 font-medium text-gray-600">Litres</th>
                          <th className="text-right px-4 py-3 font-medium text-gray-600">Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {filteredFuel.map((f: any) => (
                          <tr key={f.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-gray-600">{format(new Date(f.fillDate), "dd MMM yyyy")}</td>
                            <td className="px-4 py-3 font-medium">{workerName(f.workerId)}</td>
                            <td className="px-4 py-3 text-gray-600">{vehicleName(f.vehicleId)}</td>
                            <td className="px-4 py-3 text-gray-600">{f.fuelStation || "—"}</td>
                            <td className="px-4 py-3 text-right">{parseFloat(f.litres || "0").toFixed(1)} L</td>
                            <td className="px-4 py-3 text-right font-medium text-amber-700">R {parseFloat(f.cost || "0").toFixed(2)}</td>
                          </tr>
                        ))}
                        {filteredFuel.length === 0 && (
                          <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No fuel records found</td></tr>
                        )}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </TabsContent>

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
                                  : <Badge variant="destructive" className="flex items-center gap-1 w-fit"><AlertTriangle className="h-3 w-3" /> Fail</Badge>
                                }
                              </td>
                              <td className="px-4 py-3">
                                {failedItems.length > 0
                                  ? <span className="text-red-600 text-xs">{failedItems.map((it: any) => it.name).join(", ")}</span>
                                  : <span className="text-gray-400">—</span>
                                }
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
        </main>
      </div>
    </div>
  );
}
