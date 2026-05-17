import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Wrench, ArrowLeft, Truck, AlertCircle, CheckCircle, Clock,
  Plus, Calendar, DollarSign, User, FileText, AlertTriangle,
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

const ISSUE_STATUSES = [
  { value: "open", label: "Open", color: "bg-red-100 text-red-700" },
  { value: "in_progress", label: "In Progress", color: "bg-amber-100 text-amber-700" },
  { value: "booked", label: "Booked", color: "bg-blue-100 text-blue-700" },
  { value: "completed", label: "Completed", color: "bg-green-100 text-green-700" },
  { value: "not_required", label: "Not Required", color: "bg-gray-100 text-gray-500" },
];

const CATEGORY_LABELS: Record<string, string> = {
  tyres: "Tyres", engine: "Engine", brakes: "Brakes", electrical: "Electrical",
  body: "Body Damage", lights: "Lights", fluids: "Fluids", windscreen: "Windscreen", other: "Other",
};

function AddServiceRecordDialog({ vehicleId, vehicleName, onSaved }: { vehicleId: string; vehicleName: string; onSaved: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [serviceDate, setServiceDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [odometer, setOdometer] = useState("");
  const [serviceProvider, setServiceProvider] = useState("");
  const [workDone, setWorkDone] = useState("");
  const [issuesFixed, setIssuesFixed] = useState("");
  const [cost, setCost] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceUrl, setInvoiceUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [nextServiceDate, setNextServiceDate] = useState("");
  const [nextServiceOdometer, setNextServiceOdometer] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/fleet/service-records", {
        vehicleId,
        serviceDate: new Date(serviceDate).toISOString(),
        odometer: parseInt(odometer),
        serviceProvider,
        workDone,
        issuesFixed: issuesFixed || null,
        cost: cost || null,
        invoiceNumber: invoiceNumber || null,
        invoiceUrl: invoiceUrl || null,
        notes: notes || null,
        nextServiceDate: nextServiceDate ? new Date(nextServiceDate).toISOString() : null,
        nextServiceOdometer: nextServiceOdometer ? parseInt(nextServiceOdometer) : null,
        createdByWorkerId: user?.id ?? null,
      });
    },
    onSuccess: () => {
      toast({ title: "Service Record Added", description: "Service record has been saved." });
      setOpen(false);
      onSaved();
      // reset
      setOdometer(""); setServiceProvider(""); setWorkDone(""); setIssuesFixed("");
      setCost(""); setInvoiceNumber(""); setInvoiceUrl(""); setNotes(""); setNextServiceDate(""); setNextServiceOdometer("");
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const canSubmit = serviceDate && odometer && serviceProvider && workDone;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white">
          <Plus className="h-4 w-4" /> Add Service Record
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-blue-600" /> Add Service Record — {vehicleName}
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 mt-2">
          <div className="space-y-1.5">
            <Label>Service Date *</Label>
            <Input type="date" value={serviceDate} onChange={e => setServiceDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Odometer (km) *</Label>
            <Input type="number" placeholder="e.g. 85570" value={odometer} onChange={e => setOdometer(e.target.value)} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Service Provider *</Label>
            <Input placeholder="e.g. Kyalami Motors" value={serviceProvider} onChange={e => setServiceProvider(e.target.value)} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Work Done *</Label>
            <Textarea placeholder="Describe all work done during this service..." value={workDone} onChange={e => setWorkDone(e.target.value)} rows={3} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Issues Fixed <span className="text-gray-400 font-normal">(optional)</span></Label>
            <Textarea placeholder="List any reported issues that were resolved..." value={issuesFixed} onChange={e => setIssuesFixed(e.target.value)} rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label>Total Cost (R) <span className="text-gray-400 font-normal">(optional)</span></Label>
            <Input type="number" step="0.01" placeholder="e.g. 8500.00" value={cost} onChange={e => setCost(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Invoice Number <span className="text-gray-400 font-normal">(optional)</span></Label>
            <Input placeholder="e.g. INV-2025-0042" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Invoice / Photo URL <span className="text-gray-400 font-normal">(optional)</span></Label>
            <Input placeholder="Paste URL to invoice or photo..." value={invoiceUrl} onChange={e => setInvoiceUrl(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Next Service Date <span className="text-gray-400 font-normal">(optional)</span></Label>
            <Input type="date" value={nextServiceDate} onChange={e => setNextServiceDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Next Service Odometer (km) <span className="text-gray-400 font-normal">(optional)</span></Label>
            <Input type="number" placeholder="e.g. 95000" value={nextServiceOdometer} onChange={e => setNextServiceOdometer(e.target.value)} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Notes <span className="text-gray-400 font-normal">(optional)</span></Label>
            <Textarea placeholder="Additional notes..." value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          </div>
          <div className="col-span-2 flex gap-3">
            <Button onClick={() => mutation.mutate()} disabled={!canSubmit || mutation.isPending}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
              {mutation.isPending ? "Saving..." : "Save Service Record"}
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function FleetVehicleMaintenance() {
  const { vehicleId } = useParams<{ vehicleId: string }>();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: vehicle } = useQuery<any>({
    queryKey: ["/api/fleet/vehicles", vehicleId],
    queryFn: async () => {
      const res = await fetch(`/api/fleet/vehicles/${vehicleId}`, { credentials: "include" });
      return res.json();
    },
    enabled: !!vehicleId,
  });

  const { data: issues = [] } = useQuery<any[]>({
    queryKey: ["/api/fleet/issues", vehicleId],
    queryFn: async () => {
      const res = await fetch(`/api/fleet/issues?vehicleId=${vehicleId}`, { credentials: "include" });
      return res.json();
    },
    enabled: !!vehicleId,
  });

  const { data: serviceRecords = [] } = useQuery<any[]>({
    queryKey: ["/api/fleet/service-records", vehicleId],
    queryFn: async () => {
      const res = await fetch(`/api/fleet/service-records?vehicleId=${vehicleId}`, { credentials: "include" });
      return res.json();
    },
    enabled: !!vehicleId,
  });

  const { data: workers = [] } = useQuery<any[]>({ queryKey: ["/api/workers"] });
  const { data: kmLogs = [] } = useQuery<any[]>({
    queryKey: ["/api/fleet/km-logs", vehicleId, "vehicle"],
    queryFn: async () => {
      const res = await fetch(`/api/fleet/km-logs?vehicleId=${vehicleId}`, { credentials: "include" });
      return res.json();
    },
    enabled: !!vehicleId,
  });

  const workerName = (id: string) => (workers as any[]).find((w: any) => w.id === id)?.name ?? id;

  // Latest service record for schedule
  const latestService = (serviceRecords as any[]).sort((a: any, b: any) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime())[0];
  const latestOdo = (kmLogs as any[]).sort((a: any, b: any) => new Date(b.logDate).getTime() - new Date(a.logDate).getTime())[0]?.endOdometer;

  const isOverdue = latestService && (
    (latestService.nextServiceDate && isPast(new Date(latestService.nextServiceDate))) ||
    (latestService.nextServiceOdometer && latestOdo && latestOdo >= latestService.nextServiceOdometer)
  );
  const isDueSoon = !isOverdue && latestService && (
    (latestService.nextServiceDate && !isPast(new Date(latestService.nextServiceDate)) && new Date(latestService.nextServiceDate) <= addDays(new Date(), 30)) ||
    (latestService.nextServiceOdometer && latestOdo && latestService.nextServiceOdometer - latestOdo <= 1000 && latestService.nextServiceOdometer - latestOdo > 0)
  );

  const openIssues = (issues as any[]).filter((i: any) => !["completed", "not_required"].includes(i.status));
  const notSafeIssues = openIssues.filter((i: any) => i.urgency === "not_safe");

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, managerNotes }: { id: string; status: string; managerNotes?: string }) => {
      return apiRequest("PATCH", `/api/fleet/issues/${id}`, { status, managerNotes });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/fleet/issues", vehicleId] });
      qc.invalidateQueries({ queryKey: ["/api/fleet/issues"] });
      toast({ title: "Issue Updated", description: "Status has been updated." });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  if (!vehicle) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header title="Vehicle Maintenance" onMobileMenuToggle={() => {}} />
        <div className="flex flex-1">
          <Sidebar />
          <main className="flex-1 p-6 flex items-center justify-center">
            <p className="text-gray-400">Loading vehicle...</p>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header title="Vehicle Maintenance" onMobileMenuToggle={() => {}} />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          <div className="max-w-5xl mx-auto space-y-6">

            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <Link href="/fleet/maintenance">
                  <Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4" /> Maintenance</Button>
                </Link>
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${notSafeIssues.length > 0 ? "bg-red-100" : openIssues.length > 0 ? "bg-orange-100" : "bg-green-100"}`}>
                    <Truck className={`h-6 w-6 ${notSafeIssues.length > 0 ? "text-red-600" : openIssues.length > 0 ? "text-orange-600" : "text-green-600"}`} />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">{vehicle.name}</h1>
                    <p className="text-sm text-gray-500">{vehicle.registration} · {vehicle.make} {vehicle.model} · {vehicle.year}</p>
                  </div>
                </div>
              </div>
              <AddServiceRecordDialog
                vehicleId={vehicleId!}
                vehicleName={vehicle.name}
                onSaved={() => {
                  qc.invalidateQueries({ queryKey: ["/api/fleet/service-records", vehicleId] });
                  qc.invalidateQueries({ queryKey: ["/api/fleet/service-records"] });
                }}
              />
            </div>

            {/* Not-safe alert */}
            {notSafeIssues.length > 0 && (
              <div className="bg-red-600 text-white rounded-xl px-4 py-3 flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <div>
                  <p className="font-bold">This vehicle has been reported as NOT SAFE TO DRIVE</p>
                  <p className="text-sm text-red-100">Resolve the safety issue before allowing this vehicle to be driven.</p>
                </div>
              </div>
            )}

            {/* Service schedule */}
            <Card className={isOverdue ? "border-red-200 bg-red-50" : isDueSoon ? "border-amber-200 bg-amber-50" : ""}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-600" /> Service Schedule
                </CardTitle>
              </CardHeader>
              <CardContent>
                {latestService ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Last Service</p>
                      <p className="font-semibold">{format(new Date(latestService.serviceDate), "dd MMM yyyy")}</p>
                      <p className="text-xs text-gray-400">{latestService.serviceProvider}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Last Odometer</p>
                      <p className="font-semibold">{latestService.odometer?.toLocaleString()} km</p>
                      {latestOdo && <p className="text-xs text-gray-400">Current: {latestOdo?.toLocaleString()} km</p>}
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Next Service Date</p>
                      {latestService.nextServiceDate ? (
                        <>
                          <p className={`font-semibold ${isOverdue ? "text-red-600" : isDueSoon ? "text-amber-600" : ""}`}>
                            {format(new Date(latestService.nextServiceDate), "dd MMM yyyy")}
                          </p>
                          {isOverdue && <Badge className="bg-red-100 text-red-700 text-xs">Overdue</Badge>}
                          {isDueSoon && <Badge className="bg-amber-100 text-amber-700 text-xs">Due Soon</Badge>}
                        </>
                      ) : <p className="text-gray-400">—</p>}
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Next Service Odometer</p>
                      {latestService.nextServiceOdometer ? (
                        <p className="font-semibold">{latestService.nextServiceOdometer?.toLocaleString()} km</p>
                      ) : <p className="text-gray-400">—</p>}
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">No service records yet. Add the first service record above.</p>
                )}
              </CardContent>
            </Card>

            {/* Current Issues */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-orange-500" /> Current Problems
                    {openIssues.length > 0 && <Badge className="bg-orange-100 text-orange-700">{openIssues.length} open</Badge>}
                  </span>
                  <Link href="/fleet/report-issue">
                    <Button size="sm" variant="outline" className="gap-1 text-xs h-7">
                      <Plus className="h-3.5 w-3.5" /> Report Issue
                    </Button>
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {(issues as any[]).filter((i: any) => !["completed", "not_required"].includes(i.status)).map((issue: any) => {
                    const urg = URGENCY_OPTIONS.find(u => u.value === issue.urgency);
                    return (
                      <div key={issue.id} className={`px-5 py-4 ${issue.urgency === "not_safe" ? "bg-red-50" : ""}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${urg?.color ?? ""}`}>{urg?.label}</span>
                              <span className="text-xs text-gray-500">{CATEGORY_LABELS[issue.category] ?? issue.category}</span>
                              <span className="text-xs text-gray-400">· {format(new Date(issue.reportedAt), "dd MMM yyyy HH:mm")}</span>
                              <span className="text-xs text-gray-400">· {workerName(issue.workerId)}</span>
                            </div>
                            <p className="text-sm text-gray-800">{issue.description}</p>
                            {issue.managerNotes && (
                              <p className="text-xs text-blue-600 mt-1">📝 {issue.managerNotes}</p>
                            )}
                            {issue.photoUrl && (
                              <a href={issue.photoUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline mt-1 inline-block">View Photo</a>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <Select
                              value={issue.status}
                              onValueChange={val => updateStatusMutation.mutate({ id: issue.id, status: val })}
                            >
                              <SelectTrigger className="w-36 h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ISSUE_STATUSES.map(s => (
                                  <SelectItem key={s.value} value={s.value}>
                                    <span className={`text-xs font-medium ${s.color} px-1.5 py-0.5 rounded`}>{s.label}</span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {editingNotes === issue.id ? (
                              <div className="w-48 space-y-1">
                                <Input className="h-7 text-xs" placeholder="Manager notes..." value={noteText} onChange={e => setNoteText(e.target.value)} />
                                <div className="flex gap-1">
                                  <Button size="sm" className="h-6 text-xs px-2" onClick={() => {
                                    updateStatusMutation.mutate({ id: issue.id, status: issue.status, managerNotes: noteText });
                                    setEditingNotes(null); setNoteText("");
                                  }}>Save</Button>
                                  <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => setEditingNotes(null)}>Cancel</Button>
                                </div>
                              </div>
                            ) : (
                              <Button size="sm" variant="ghost" className="h-6 text-xs text-blue-600 px-2" onClick={() => { setEditingNotes(issue.id); setNoteText(issue.managerNotes ?? ""); }}>
                                {issue.managerNotes ? "Edit note" : "+ Add note"}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {openIssues.length === 0 && (
                    <div className="px-5 py-8 text-center">
                      <CheckCircle className="h-8 w-8 text-green-400 mx-auto mb-2" />
                      <p className="text-gray-400">No open issues — vehicle is in good condition.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Completed issues */}
            {(issues as any[]).filter((i: any) => ["completed", "not_required"].includes(i.status)).length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 text-gray-500">
                    <CheckCircle className="h-4 w-4 text-green-500" /> Resolved Issues
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {(issues as any[]).filter((i: any) => ["completed", "not_required"].includes(i.status)).map((issue: any) => {
                      const urg = URGENCY_OPTIONS.find(u => u.value === issue.urgency);
                      const st = ISSUE_STATUSES.find(s => s.value === issue.status);
                      return (
                        <div key={issue.id} className="px-5 py-3 opacity-60">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${urg?.color ?? ""}`}>{urg?.label}</span>
                              <span className="text-xs text-gray-500">{CATEGORY_LABELS[issue.category] ?? issue.category}</span>
                              <span className="text-xs text-gray-600">{issue.description}</span>
                            </div>
                            <Badge className={`text-xs ${st?.color ?? ""}`}>{st?.label}</Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Service history */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-600" /> Service History
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pb-5">
                {(serviceRecords as any[]).length === 0 && (
                  <p className="text-gray-400 text-sm text-center py-4">No service records yet.</p>
                )}
                {(serviceRecords as any[]).sort((a: any, b: any) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime()).map((r: any, idx: number) => (
                  <div key={r.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                        <Wrench className="h-4 w-4 text-blue-600" />
                      </div>
                      {idx < (serviceRecords as any[]).length - 1 && <div className="flex-1 w-0.5 bg-gray-200 mt-1" />}
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-sm">{r.serviceProvider}</p>
                          <p className="text-xs text-gray-500">{format(new Date(r.serviceDate), "dd MMM yyyy")} · {r.odometer?.toLocaleString()} km</p>
                        </div>
                        {r.cost && <span className="font-semibold text-green-700 text-sm">R {parseFloat(r.cost).toFixed(2)}</span>}
                      </div>
                      <p className="text-sm text-gray-700 mt-1">{r.workDone}</p>
                      {r.issuesFixed && <p className="text-xs text-green-700 mt-0.5">✓ Fixed: {r.issuesFixed}</p>}
                      {r.invoiceNumber && <p className="text-xs text-gray-400 mt-0.5">Invoice: {r.invoiceNumber}</p>}
                      {r.invoiceUrl && (
                        <a href={r.invoiceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline mt-0.5 inline-block">View Invoice / Photo</a>
                      )}
                      {r.nextServiceDate && (
                        <p className="text-xs text-blue-600 mt-1">Next service: {format(new Date(r.nextServiceDate), "dd MMM yyyy")}{r.nextServiceOdometer ? ` or ${r.nextServiceOdometer.toLocaleString()} km` : ""}</p>
                      )}
                      {r.notes && <p className="text-xs text-gray-500 mt-0.5 italic">{r.notes}</p>}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

          </div>
        </main>
      </div>
    </div>
  );
}
