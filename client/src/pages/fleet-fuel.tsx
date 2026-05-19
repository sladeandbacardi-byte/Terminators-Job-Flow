import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link, useSearch } from "wouter";
import { Fuel, ArrowLeft, Truck, User } from "lucide-react";
import { format } from "date-fns";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";

export default function FleetFuel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const search = useSearch();
  const preselectedVehicle = new URLSearchParams(search).get("vehicleId") ?? "";

  const [vehicleId, setVehicleId] = useState(preselectedVehicle);
  const [fillDate, setFillDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [odometer, setOdometer] = useState("");
  const [litres, setLitres] = useState("");
  const [cost, setCost] = useState("");
  const [fuelStation, setFuelStation] = useState("");
  const [notes, setNotes] = useState("");

  const { data: vehicles = [] } = useQuery<any[]>({ queryKey: ["/api/fleet/vehicles"] });
  const { data: assignments = [] } = useQuery<any[]>({ queryKey: ["/api/fleet/assignments"] });
  const { data: myFillups = [] } = useQuery<any[]>({
    queryKey: ["/api/fleet/fuel-fillups", user?.id],
    queryFn: async () => {
      const res = await fetch(`/api/fleet/fuel-fillups?workerId=${user?.id}`, { credentials: "include" });
      return res.json();
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (user?.id && (assignments as any[]).length > 0) {
      const mine = (assignments as any[]).find(a => a.workerId === user.id && a.isActive);
      if (mine && !vehicleId) setVehicleId(mine.vehicleId);
    }
  }, [assignments, user?.id]);

  const pricePerLitre = litres && cost
    ? (parseFloat(cost) / parseFloat(litres)).toFixed(2)
    : null;

  const submitMutation = useMutation({
    mutationFn: async () => {
      const body = {
        vehicleId,
        workerId: user?.id,
        fillDate: new Date(fillDate).toISOString(),
        odometer: odometer ? parseInt(odometer) : null,
        litres,
        cost,
        fuelStation: fuelStation || null,
        notes: notes || null,
      };
      return apiRequest("POST", "/api/fleet/fuel-fillups", body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/fleet/fuel-fillups"] });
      toast({ title: "Fuel Fill-up Saved", description: "Fill-up recorded successfully." });
      setOdometer(""); setLitres(""); setCost(""); setFuelStation(""); setNotes("");
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const vehicleName = (id: string) => (vehicles as any[]).find(v => v.id === id)?.name ?? id;
  const canSubmit = vehicleId && fillDate && litres && cost;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header title="Fuel Fill-up" onMobileMenuToggle={() => {}} />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          <div className="max-w-3xl mx-auto space-y-6">

            <div className="flex items-center gap-3">
              <Link href="/fleet">
                <Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4" /> Fleet</Button>
              </Link>
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Fuel className="h-5 w-5 text-amber-500" /> Fuel Fill-up
              </h1>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Fill-up Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg text-sm">
                  <User className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-500">Driver:</span>
                  <span className="font-medium">{user?.firstName} {user?.lastName}</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Vehicle</Label>
                    <Select value={vehicleId} onValueChange={setVehicleId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select vehicle..." />
                      </SelectTrigger>
                      <SelectContent>
                        {(vehicles as any[]).filter(v => v.isActive).map((v: any) => (
                          <SelectItem key={v.id} value={v.id}>
                            <span className="flex items-center gap-2">
                              <Truck className="h-3.5 w-3.5 text-blue-500" />
                              {v.name}
                              <span className="text-xs text-gray-400 font-mono">{v.registration}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Date</Label>
                    <Input type="date" value={fillDate} onChange={e => setFillDate(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Odometer Reading (km) <span className="text-gray-400 font-normal">(optional)</span></Label>
                  <Input type="number" placeholder="e.g. 85520" value={odometer} onChange={e => setOdometer(e.target.value)} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Litres</Label>
                    <Input type="number" step="0.1" placeholder="e.g. 45.5" value={litres} onChange={e => setLitres(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Total Cost (R)</Label>
                    <Input type="number" step="0.01" placeholder="e.g. 1200.00" value={cost} onChange={e => setCost(e.target.value)} />
                  </div>
                </div>

                {pricePerLitre && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 flex items-center justify-between text-sm">
                    <span className="text-amber-700">Price per litre</span>
                    <span className="font-bold text-amber-700">R {pricePerLitre} / L</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label>Fuel Station <span className="text-gray-400 font-normal">(optional)</span></Label>
                  <Input placeholder="e.g. Engen Sandton" value={fuelStation} onChange={e => setFuelStation(e.target.value)} />
                </div>

                <div className="space-y-1.5">
                  <Label>Notes <span className="text-gray-400 font-normal">(optional)</span></Label>
                  <Textarea placeholder="Any notes..." value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
                </div>

                <Button onClick={() => submitMutation.mutate()} disabled={!canSubmit || submitMutation.isPending}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white">
                  {submitMutation.isPending ? "Saving..." : "Save Fill-up"}
                </Button>
              </CardContent>
            </Card>

            {/* Recent entries */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">My Recent Fill-ups</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Vehicle</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Station</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Litres</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(myFillups as any[]).slice(0, 10).map((f: any) => (
                      <tr key={f.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-600">{format(new Date(f.fillDate), "dd MMM yyyy")}</td>
                        <td className="px-4 py-3">{vehicleName(f.vehicleId)}</td>
                        <td className="px-4 py-3 text-gray-500">{f.fuelStation || "—"}</td>
                        <td className="px-4 py-3 text-right">{parseFloat(f.litres || "0").toFixed(1)} L</td>
                        <td className="px-4 py-3 text-right font-medium text-amber-700">R {parseFloat(f.cost || "0").toFixed(2)}</td>
                      </tr>
                    ))}
                    {(myFillups as any[]).length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">No fill-ups recorded yet</td></tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>

          </div>
        </main>
      </div>
    </div>
  );
}
