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
import { Fuel, ArrowLeft, Truck, User, ShieldOff } from "lucide-react";
import { format } from "date-fns";
import { getDashboardRole } from "@/lib/dashboardRole";
const newSubmissionKey = () => crypto.randomUUID();

export default function FleetFuel() {
  const { user } = useAuth();
  const role = getDashboardRole({
    id: user?.id,
    firstName: user?.firstName,
    lastName: user?.lastName,
    role: user?.role,
  });
  const { toast } = useToast();
  const qc = useQueryClient();
  const search = useSearch();
  const preselectedVehicle = new URLSearchParams(search).get("vehicleId") ?? "";

  const [vehicleId, setVehicleId] = useState(preselectedVehicle);
  const [fillDate, setFillDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [fillTime, setFillTime] = useState(format(new Date(), "HH:mm"));
  const [odometer, setOdometer] = useState("");
  const [litres, setLitres] = useState("");
  const [cost, setCost] = useState("");
  const [fuelType, setFuelType] = useState("");
  const [receiptPhoto, setReceiptPhoto] = useState("");
  const [notes, setNotes] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(newSubmissionKey);

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
        date: fillDate,
        time: fillTime,
        odometer: parseInt(odometer),
        litres,
        cost,
        fuelType,
        receiptPhoto,
        notes: notes || null,
        idempotencyKey,
      };
      return apiRequest("POST", "/api/fleet/fuel-fillups", body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/fleet/fuel-fillups"] });
      toast({ title: "Fuel Fill-up Saved", description: "Fill-up recorded successfully." });
      setOdometer(""); setLitres(""); setCost(""); setFuelType(""); setReceiptPhoto(""); setNotes(""); setIdempotencyKey(newSubmissionKey());
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const vehicleName = (id: string) => (vehicles as any[]).find(v => v.id === id)?.name ?? id;
  const canSubmit = vehicleId && fillDate && fillTime && odometer && litres && cost && fuelType && receiptPhoto;

  if (role === "admin") {
    return (
        <>
          <div className="p-4 sm:p-6">
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="flex items-center gap-3">
                <Link href="/fleet">
                  <Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4" /> Fleet</Button>
                </Link>
                <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Fuel className="h-5 w-5 text-amber-500" /> Fuel Fill-up
                </h1>
              </div>
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <ShieldOff className="h-12 w-12 text-gray-300 mb-4" />
                <h2 className="text-lg font-semibold text-gray-700 mb-2">Not available for admin users</h2>
                <p className="text-sm text-gray-500 max-w-sm">
                  Fuel fill-ups must be logged by the driver of the vehicle. Please ask the assigned driver to record this fill-up.
                </p>
              </div>
            </div>
          </div>
        </>
    );
  }

  return (
    <div className="p-4 sm:p-6">
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

                <div className="grid grid-cols-3 gap-3">
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
                              {v.name} · {v.registration}
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
                  <div className="space-y-1.5">
                    <Label>Time</Label>
                    <Input type="time" value={fillTime} onChange={e => setFillTime(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Current Odometer Reading (km)</Label>
                  <Input required type="number" min="0" placeholder="e.g. 85520" value={odometer} onChange={e => setOdometer(e.target.value)} />
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
                  <Label>Fuel Type</Label>
                  <Select value={fuelType} onValueChange={setFuelType}>
                    <SelectTrigger><SelectValue placeholder="Select fuel type..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Petrol 93">Petrol 93</SelectItem>
                      <SelectItem value="Petrol 95">Petrol 95</SelectItem>
                      <SelectItem value="Diesel 10 ppm">Diesel 10 ppm</SelectItem>
                      <SelectItem value="Diesel 50 ppm">Diesel 50 ppm</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Fuel Slip Photo</Label>
                  <Input required type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={event => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 2_000_000) {
                      toast({ title: "Invalid slip photo", description: "Use a JPG, PNG, or WebP image smaller than 2 MB.", variant: "destructive" });
                      event.target.value = "";
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = () => setReceiptPhoto(String(reader.result));
                    reader.readAsDataURL(file);
                  }} />
                  {receiptPhoto && <p className="text-sm text-emerald-700">Slip photo attached</p>}
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
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Fuel Type</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Litres</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(myFillups as any[]).slice(0, 10).map((f: any) => (
                      <tr key={f.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-600">{format(new Date(f.fillDate), "dd MMM yyyy")}</td>
                        <td className="px-4 py-3">{vehicleName(f.vehicleId)}</td>
                        <td className="px-4 py-3 text-gray-500">{f.fuelType || "—"}</td>
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
    </div>
  );
}
