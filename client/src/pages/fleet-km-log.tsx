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
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Gauge, ArrowLeft, Truck, User } from "lucide-react";
import { format } from "date-fns";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";

export default function FleetKmLog() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [vehicleId, setVehicleId] = useState("");
  const [logDate, setLogDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [startOdometer, setStartOdometer] = useState("");
  const [endOdometer, setEndOdometer] = useState("");
  const [businessKm, setBusinessKm] = useState("");
  const [privateKm, setPrivateKm] = useState("");
  const [notes, setNotes] = useState("");

  const { data: vehicles = [] } = useQuery<any[]>({ queryKey: ["/api/fleet/vehicles"] });
  const { data: assignments = [] } = useQuery<any[]>({ queryKey: ["/api/fleet/assignments"] });
  const { data: myLogs = [] } = useQuery<any[]>({
    queryKey: ["/api/fleet/km-logs", user?.id],
    queryFn: async () => {
      const res = await fetch(`/api/fleet/km-logs?workerId=${user?.id}`, { credentials: "include" });
      return res.json();
    },
    enabled: !!user?.id,
  });

  // Auto-select assigned vehicle
  useEffect(() => {
    if (user?.id && assignments.length > 0) {
      const mine = (assignments as any[]).find(a => a.workerId === user.id && a.isActive);
      if (mine && !vehicleId) setVehicleId(mine.vehicleId);
    }
  }, [assignments, user?.id]);

  const totalKm = startOdometer && endOdometer
    ? Math.max(0, parseInt(endOdometer) - parseInt(startOdometer))
    : 0;

  // Auto-balance business/private KMs when total changes
  const handleStartOrEnd = () => {
    if (totalKm > 0 && !businessKm && !privateKm) {
      setBusinessKm(String(totalKm));
      setPrivateKm("0");
    }
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      const body = {
        vehicleId,
        workerId: user?.id,
        logDate: new Date(logDate).toISOString(),
        startOdometer: parseInt(startOdometer),
        endOdometer: parseInt(endOdometer),
        totalKm,
        businessKm: parseInt(businessKm) || 0,
        privateKm: parseInt(privateKm) || 0,
        notes: notes || null,
      };
      return apiRequest("POST", "/api/fleet/km-logs", body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/fleet/km-logs"] });
      toast({ title: "KM Log Saved", description: "Your trip has been recorded." });
      setStartOdometer(""); setEndOdometer(""); setBusinessKm(""); setPrivateKm(""); setNotes("");
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const vehicleName = (id: string) => (vehicles as any[]).find(v => v.id === id)?.name ?? id;

  const canSubmit = vehicleId && logDate && startOdometer && endOdometer &&
    parseInt(endOdometer) >= parseInt(startOdometer) &&
    (parseInt(businessKm) || 0) + (parseInt(privateKm) || 0) <= totalKm + 1;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header title="Log KMs" onMobileMenuToggle={() => {}} />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          <div className="max-w-3xl mx-auto space-y-6">

            <div className="flex items-center gap-3">
              <Link href="/fleet">
                <Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4" /> Fleet</Button>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Gauge className="h-5 w-5 text-green-600" /> Log KMs
                </h1>
              </div>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Trip Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Driver (read-only) */}
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg text-sm">
                  <User className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-500">Driver:</span>
                  <span className="font-medium">{user?.firstName} {user?.lastName}</span>
                </div>

                {/* Vehicle */}
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

                {/* Date */}
                <div className="space-y-1.5">
                  <Label>Date</Label>
                  <Input type="date" value={logDate} onChange={e => setLogDate(e.target.value)} />
                </div>

                {/* Odometer */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Start Odometer (km)</Label>
                    <Input type="number" placeholder="e.g. 85420" value={startOdometer}
                      onChange={e => { setStartOdometer(e.target.value); }}
                      onBlur={handleStartOrEnd} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>End Odometer (km)</Label>
                    <Input type="number" placeholder="e.g. 85520" value={endOdometer}
                      onChange={e => { setEndOdometer(e.target.value); }}
                      onBlur={handleStartOrEnd} />
                  </div>
                </div>

                {/* Total KMs */}
                {totalKm > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex items-center justify-between">
                    <span className="text-sm text-green-700">Total trip distance</span>
                    <span className="text-lg font-bold text-green-700">{totalKm.toLocaleString()} km</span>
                  </div>
                )}

                {/* Business / Private split */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Business KMs</Label>
                    <Input type="number" placeholder="0" value={businessKm}
                      onChange={e => setBusinessKm(e.target.value)} min={0} max={totalKm} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Private KMs</Label>
                    <Input type="number" placeholder="0" value={privateKm}
                      onChange={e => setPrivateKm(e.target.value)} min={0} max={totalKm} />
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                  <Label>Notes <span className="text-gray-400 font-normal">(optional)</span></Label>
                  <Textarea placeholder="Route, purpose, or any notes..." value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
                </div>

                <Button onClick={() => submitMutation.mutate()} disabled={!canSubmit || submitMutation.isPending}
                  className="w-full bg-green-600 hover:bg-green-700 text-white">
                  {submitMutation.isPending ? "Saving..." : "Save KM Log"}
                </Button>
              </CardContent>
            </Card>

            {/* Recent entries */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">My Recent Trips</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Vehicle</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Business</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Private</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(myLogs as any[]).slice(0, 10).map((l: any) => (
                      <tr key={l.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-600">{format(new Date(l.logDate), "dd MMM yyyy")}</td>
                        <td className="px-4 py-3">{vehicleName(l.vehicleId)}</td>
                        <td className="px-4 py-3 text-right font-medium">{l.totalKm} km</td>
                        <td className="px-4 py-3 text-right text-green-600">{l.businessKm} km</td>
                        <td className="px-4 py-3 text-right text-gray-500">{l.privateKm} km</td>
                      </tr>
                    ))}
                    {(myLogs as any[]).length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">No trips logged yet</td></tr>
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
