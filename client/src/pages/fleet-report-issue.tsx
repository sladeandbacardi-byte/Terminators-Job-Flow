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
import { Link, useSearch } from "wouter";
import { AlertCircle, ArrowLeft, Truck, User, Camera } from "lucide-react";
import { format } from "date-fns";

const CATEGORIES = [
  { value: "tyres", label: "Tyres" },
  { value: "engine", label: "Engine" },
  { value: "brakes", label: "Brakes" },
  { value: "electrical", label: "Electrical" },
  { value: "body", label: "Body Damage" },
  { value: "lights", label: "Lights" },
  { value: "fluids", label: "Fluids" },
  { value: "windscreen", label: "Windscreen" },
  { value: "other", label: "Other" },
];

const URGENCY_OPTIONS = [
  { value: "low", label: "Low", color: "bg-gray-100 text-gray-700 border-gray-300", dot: "bg-gray-400" },
  { value: "medium", label: "Medium", color: "bg-amber-50 text-amber-700 border-amber-300", dot: "bg-amber-400" },
  { value: "high", label: "High", color: "bg-orange-50 text-orange-700 border-orange-300", dot: "bg-orange-500" },
  { value: "not_safe", label: "Vehicle Not Safe", color: "bg-red-50 text-red-700 border-red-400", dot: "bg-red-600" },
];

const STATUS_COLORS: Record<string, string> = {
  open: "bg-red-100 text-red-700",
  in_progress: "bg-amber-100 text-amber-700",
  booked: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  not_required: "bg-gray-100 text-gray-600",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Open", in_progress: "In Progress", booked: "Booked",
  completed: "Completed", not_required: "Not Required",
};

export default function FleetReportIssue() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const search = useSearch();
  const preselectedVehicle = new URLSearchParams(search).get("vehicleId") ?? "";

  const [vehicleId, setVehicleId] = useState(preselectedVehicle);
  const [reportedAt, setReportedAt] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm").slice(0, 16));
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState("medium");
  const [photoUrl, setPhotoUrl] = useState("");

  const { data: vehicles = [] } = useQuery<any[]>({ queryKey: ["/api/fleet/vehicles"] });
  const { data: assignments = [] } = useQuery<any[]>({ queryKey: ["/api/fleet/assignments"] });
  const { data: myIssues = [] } = useQuery<any[]>({
    queryKey: ["/api/fleet/issues", user?.id],
    queryFn: async () => {
      const res = await fetch(`/api/fleet/issues?workerId=${user?.id}`, { credentials: "include" });
      return res.json();
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (user?.id && (assignments as any[]).length > 0) {
      const mine = (assignments as any[]).find((a: any) => a.workerId === user.id && a.isActive);
      if (mine && !vehicleId) setVehicleId(mine.vehicleId);
    }
  }, [assignments, user?.id]);

  const vehicleName = (id: string) => (vehicles as any[]).find((v: any) => v.id === id)?.name ?? id;
  const vehicleReg = (id: string) => (vehicles as any[]).find((v: any) => v.id === id)?.registration ?? "";

  const submitMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/fleet/issues", {
        vehicleId,
        workerId: user?.id,
        reportedAt: new Date(reportedAt).toISOString(),
        category,
        description,
        urgency,
        photoUrl: photoUrl || null,
        status: "open",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/fleet/issues"] });
      toast({
        title: urgency === "not_safe" ? "⚠️ Safety Issue Reported" : "Issue Reported",
        description: urgency === "not_safe"
          ? "Your safety issue has been reported. Please park the vehicle and inform your manager immediately."
          : "Your issue has been logged and the maintenance team has been notified.",
        variant: urgency === "not_safe" ? "destructive" : "default",
      });
      setCategory(""); setDescription(""); setPhotoUrl(""); setUrgency("medium");
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const canSubmit = vehicleId && category && description.trim().length > 5;

  return (
        <div className="p-4 sm:p-6">
          <div className="max-w-3xl mx-auto space-y-6">

            <div className="flex items-center gap-3">
              <Link href="/fleet">
                <Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4" /> Fleet</Button>
              </Link>
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-500" /> Report Vehicle Issue
              </h1>
            </div>

            {/* Not-safe banner */}
            {urgency === "not_safe" && (
              <div className="bg-red-600 text-white rounded-xl px-4 py-3 flex items-center gap-3">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">Vehicle Not Safe to Drive</p>
                  <p className="text-sm text-red-100">After submitting, please park the vehicle immediately and inform your manager.</p>
                </div>
              </div>
            )}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Issue Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Driver */}
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
                      {(vehicles as any[]).filter((v: any) => v.isActive).map((v: any) => (
                        <SelectItem key={v.id} value={v.id}>
                          <span className="flex items-center gap-2">
                            <Truck className="h-3.5 w-3.5 text-blue-500" />
                            {v.name} · {v.registration}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {vehicleId && (
                    <p className="text-xs text-gray-500">Registration: <strong>{vehicleReg(vehicleId)}</strong></p>
                  )}
                </div>

                {/* Date/time */}
                <div className="space-y-1.5">
                  <Label>Date & Time</Label>
                  <Input type="datetime-local" value={reportedAt} onChange={e => setReportedAt(e.target.value)} />
                </div>

                {/* Category */}
                <div className="space-y-1.5">
                  <Label>Issue Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category..." />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <Label>Issue Description</Label>
                  <Textarea
                    placeholder="Describe the problem in detail..."
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    rows={4}
                  />
                </div>

                {/* Urgency */}
                <div className="space-y-2">
                  <Label>Urgency Level</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {URGENCY_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setUrgency(opt.value)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${urgency === opt.value ? opt.color + " border-current" : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"}`}
                      >
                        <span className={`w-2.5 h-2.5 rounded-full ${urgency === opt.value ? opt.dot : "bg-gray-300"}`} />
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Photo URL */}
                <div className="space-y-1.5">
                  <Label>Photo URL <span className="text-gray-400 font-normal">(optional)</span></Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Paste photo URL or leave blank..."
                      value={photoUrl}
                      onChange={e => setPhotoUrl(e.target.value)}
                    />
                    <Button variant="outline" size="sm" className="shrink-0 gap-1 text-gray-500">
                      <Camera className="h-4 w-4" /> Upload
                    </Button>
                  </div>
                  {photoUrl && (
                    <img src={photoUrl} alt="Issue photo" className="mt-2 rounded-lg max-h-40 object-cover border" onError={e => (e.currentTarget.style.display = "none")} />
                  )}
                </div>

                <Button
                  onClick={() => submitMutation.mutate()}
                  disabled={!canSubmit || submitMutation.isPending}
                  className={`w-full text-white ${urgency === "not_safe" ? "bg-red-600 hover:bg-red-700" : urgency === "high" ? "bg-orange-500 hover:bg-orange-600" : "bg-blue-600 hover:bg-blue-700"}`}
                >
                  {submitMutation.isPending ? "Submitting..." : urgency === "not_safe" ? "⚠️ Report Safety Issue" : "Submit Issue Report"}
                </Button>
              </CardContent>
            </Card>

            {/* My recent issues */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">My Reported Issues</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Vehicle</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Urgency</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(myIssues as any[]).slice(0, 10).map((issue: any) => {
                      const urg = URGENCY_OPTIONS.find(u => u.value === issue.urgency);
                      return (
                        <tr key={issue.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-600">{format(new Date(issue.reportedAt), "dd MMM HH:mm")}</td>
                          <td className="px-4 py-3 font-medium text-xs">{vehicleName(issue.vehicleId)}</td>
                          <td className="px-4 py-3 capitalize">{CATEGORIES.find(c => c.value === issue.category)?.label ?? issue.category}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${urg?.color ?? ""}`}>{urg?.label ?? issue.urgency}</span>
                          </td>
                          <td className="px-4 py-3">
                            <Badge className={`text-xs ${STATUS_COLORS[issue.status] ?? "bg-gray-100"}`}>
                              {STATUS_LABELS[issue.status] ?? issue.status}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                    {(myIssues as any[]).length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">No issues reported yet</td></tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>

          </div>
        </div>
  );
}
