import { useState, useEffect, type ChangeEvent } from "react";
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
import { Link, useSearch } from "wouter";
import { ClipboardCheck, ArrowLeft, CheckCircle, XCircle, AlertTriangle, Truck, User } from "lucide-react";
import { format } from "date-fns";
const newSubmissionKey = () => crypto.randomUUID();

const INSPECTION_CHECKLIST = [
  "Tyres (condition & pressure)",
  "Front lights",
  "Rear lights & indicators",
  "Brakes",
  "Engine oil",
  "Coolant / water level",
  "Windscreen (no cracks)",
  "Wipers",
  "Mirrors",
  "Seat belts",
  "Fire extinguisher",
  "First aid kit",
  "Equipment secured",
  "Vehicle cleanliness",
  "Licence disc valid",
  "Driver's licence in possession",
];

interface ItemState {
  result: "pass" | "fail";
  comments: string;
}

export default function FleetInspection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const search = useSearch();
  const preselectedVehicle = new URLSearchParams(search).get("vehicleId") ?? "";

  const [vehicleId, setVehicleId] = useState(preselectedVehicle);
  const [inspectionDate, setInspectionDate] = useState(
    format(new Date(), "yyyy-MM-dd'T'HH:mm").slice(0, 16)
  );
  const [items, setItems] = useState<Record<string, ItemState>>(() =>
    Object.fromEntries(INSPECTION_CHECKLIST.map(name => [name, { result: "pass", comments: "" }]))
  );
  const [overallComments, setOverallComments] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(newSubmissionKey);

  const { data: vehicles = [] } = useQuery<any[]>({ queryKey: ["/api/fleet/vehicles"] });
  const { data: assignments = [] } = useQuery<any[]>({ queryKey: ["/api/fleet/assignments"] });
  const { data: myInspections = [] } = useQuery<any[]>({
    queryKey: ["/api/fleet/inspections", user?.id],
    queryFn: async () => {
      const res = await fetch(`/api/fleet/inspections?workerId=${user?.id}`, { credentials: "include" });
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

  const setItemResult = (name: string, result: "pass" | "fail") =>
    setItems(prev => ({ ...prev, [name]: { ...prev[name], result } }));
  const setItemComment = (name: string, comments: string) =>
    setItems(prev => ({ ...prev, [name]: { ...prev[name], comments } }));

  const anyFail = Object.values(items).some(i => i.result === "fail");
  const overallResult = anyFail ? "fail" : "pass";
  const vehicleName = (id: string) => (vehicles as any[]).find(v => v.id === id)?.name ?? id;

  const submitMutation = useMutation({
    mutationFn: async () => {
      const itemsArr = INSPECTION_CHECKLIST.map(name => ({
        name,
        result: items[name].result,
        comments: items[name].comments || undefined,
      }));
      const body = {
        vehicleId,
        workerId: user?.id,
        inspectionDate: new Date(inspectionDate).toISOString(),
        overallResult,
        itemsJson: JSON.stringify(itemsArr),
        comments: overallComments || null,
        photoUrl,
        idempotencyKey,
      };
      return apiRequest("POST", "/api/fleet/inspections", body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/fleet/inspections"] });
      const msg = anyFail
        ? "Inspection saved. Admin has been notified of the failed items."
        : "Inspection saved. All items passed.";
      toast({ title: anyFail ? "Inspection — FAIL" : "Inspection — PASS", description: msg,
        variant: anyFail ? "destructive" : "default" });
      setItems(Object.fromEntries(INSPECTION_CHECKLIST.map(n => [n, { result: "pass", comments: "" }])));
      setOverallComments("");
      setPhotoUrl("");
      setIdempotencyKey(newSubmissionKey());
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const passCount = Object.values(items).filter(i => i.result === "pass").length;
  const failCount = Object.values(items).filter(i => i.result === "fail").length;
  const choosePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 2_000_000) {
      toast({ title: "Invalid photo", description: "Use a JPG, PNG, or WebP image smaller than 2 MB.", variant: "destructive" });
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPhotoUrl(String(reader.result));
    reader.readAsDataURL(file);
  };

  return (
        <div className="p-4 sm:p-6">
          <div className="max-w-3xl mx-auto space-y-6">

            <div className="flex items-center gap-3">
              <Link href="/fleet">
                <Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4" /> Fleet</Button>
              </Link>
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-blue-600" /> Vehicle Inspection
              </h1>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Inspection Details</CardTitle>
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
                              {v.name} · {v.registration}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Date & Time</Label>
                    <Input type="datetime-local" value={inspectionDate} onChange={e => setInspectionDate(e.target.value)} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Summary bar */}
            <div className={`rounded-xl px-4 py-3 flex items-center justify-between ${anyFail ? "bg-red-50 border border-red-200" : "bg-green-50 border border-green-200"}`}>
              <div className="flex items-center gap-3">
                {anyFail
                  ? <AlertTriangle className="h-5 w-5 text-red-500" />
                  : <CheckCircle className="h-5 w-5 text-green-500" />
                }
                <span className={`font-semibold ${anyFail ? "text-red-700" : "text-green-700"}`}>
                  Overall: {anyFail ? "FAIL" : "PASS"}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-green-600 font-medium">{passCount} pass</span>
                {failCount > 0 && <span className="text-red-600 font-medium">{failCount} fail</span>}
              </div>
            </div>

            {/* Checklist */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  Inspection Checklist
                  <span className="text-xs text-gray-400 font-normal">Tap to toggle Pass / Fail</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pb-4">
                {INSPECTION_CHECKLIST.map(name => {
                  const item = items[name];
                  const isFail = item.result === "fail";
                  return (
                    <div key={name} className={`rounded-lg border p-3 ${isFail ? "border-red-200 bg-red-50" : "border-gray-100 bg-white"}`}>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setItemResult(name, "pass")}
                          className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${!isFail ? "bg-green-100 text-green-700 border-green-200" : "bg-white text-gray-400 border-gray-200 hover:bg-green-50"}`}
                        >
                          <CheckCircle className="h-3.5 w-3.5" /> Pass
                        </button>
                        <button
                          onClick={() => setItemResult(name, "fail")}
                          className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${isFail ? "bg-red-100 text-red-700 border-red-200" : "bg-white text-gray-400 border-gray-200 hover:bg-red-50"}`}
                        >
                          <XCircle className="h-3.5 w-3.5" /> Fail
                        </button>
                        <span className={`flex-1 text-sm ${isFail ? "font-medium text-red-800" : "text-gray-700"}`}>{name}</span>
                      </div>
                      {isFail && (
                        <div className="mt-2">
                          <Input
                            placeholder="Describe the issue..."
                            value={item.comments}
                            onChange={e => setItemComment(name, e.target.value)}
                            className="text-sm bg-white border-red-200"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 space-y-4">
                <div className="space-y-1.5">
                  <Label>Overall Comments <span className="text-gray-400 font-normal">(optional)</span></Label>
                  <Textarea value={overallComments} onChange={e => setOverallComments(e.target.value)}
                    placeholder="Any additional notes about the vehicle condition..." rows={3} />
                </div>
                <div className="space-y-1.5">
                  <Label>Vehicle-check photo (required)</Label>
                  <Input required type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={choosePhoto} />
                  {photoUrl && <img src={photoUrl} alt="Daily vehicle-check preview" className="max-h-48 w-full rounded-lg border object-contain" />}
                </div>
                {anyFail && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-sm text-red-700 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    A fail alert email will be sent to admin immediately upon submission.
                  </div>
                )}
                <Button onClick={() => submitMutation.mutate()} disabled={!vehicleId || !photoUrl || submitMutation.isPending}
                  className={`w-full text-white ${anyFail ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"}`}>
                  {submitMutation.isPending ? "Submitting..." : anyFail ? "Submit (Will Alert Admin)" : "Submit Inspection"}
                </Button>
              </CardContent>
            </Card>

            {/* Recent inspections */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">My Recent Inspections</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Vehicle</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Result</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Failed Items</th>
                       <th className="text-left px-4 py-3 font-medium text-gray-600">Photo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(myInspections as any[]).slice(0, 8).map((ins: any) => {
                      const its = ins.itemsJson ? JSON.parse(ins.itemsJson) : [];
                      const fails = its.filter((i: any) => i.result === "fail");
                      return (
                        <tr key={ins.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-600">{format(new Date(ins.inspectionDate), "dd MMM yyyy HH:mm")}</td>
                          <td className="px-4 py-3">{vehicleName(ins.vehicleId)}</td>
                          <td className="px-4 py-3">
                            {ins.overallResult === "pass"
                              ? <Badge className="bg-green-100 text-green-700">Pass</Badge>
                              : <Badge variant="destructive">Fail</Badge>
                            }
                          </td>
                          <td className="px-4 py-3 text-xs text-red-600">{fails.length > 0 ? fails.map((i: any) => i.name).join(", ") : "—"}</td>
                           <td className="px-4 py-3">{ins.photoUrl ? <a href={ins.photoUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-blue-600 underline">View photo</a> : "—"}</td>
                        </tr>
                      );
                    })}
                    {(myInspections as any[]).length === 0 && (
                       <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">No inspections yet</td></tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>

          </div>
        </div>
  );
}
