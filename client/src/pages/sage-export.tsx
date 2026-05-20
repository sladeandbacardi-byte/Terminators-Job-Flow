import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Download, AlertTriangle, CheckCircle2, Filter, FileSpreadsheet, RefreshCw,
} from "lucide-react";
import type { Worker, Department, Client } from "@shared/schema";

interface SageJob {
  id: string;
  jobNumber: string;
  jobDate: string;
  clientName: string;
  sageCode: string;
  department: string;
  technician: string;
  description: string;
  quantity: number;
  unitPriceEx: number;
  vatPct: number;
  vatAmount: number;
  totalIncl: number;
  invoiceNotes: string;
  invoiceStatus: string;
}

const STATUS_LABELS: Record<string, string> = {
  not_invoiced: "Not Invoiced",
  exported:     "Exported",
  invoiced:     "Invoiced",
};

const STATUS_COLORS: Record<string, string> = {
  not_invoiced: "bg-yellow-100 text-yellow-800 border-yellow-200",
  exported:     "bg-blue-100 text-blue-800 border-blue-200",
  invoiced:     "bg-green-100 text-green-800 border-green-200",
};

export default function SageExport() {
  const { toast } = useToast();
  const qc = useQueryClient();

  // ── Filters ──────────────────────────────────────────────────────────────
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString().split("T")[0];
  const todayStr = today.toISOString().split("T")[0];

  const [from, setFrom]               = useState(firstOfMonth);
  const [to, setTo]                   = useState(todayStr);
  const [deptFilter, setDeptFilter]   = useState("all");
  const [workerFilter, setWorkerFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [includeExported, setIncludeExported] = useState(false);

  // ── Dialog state ──────────────────────────────────────────────────────────
  const [markDialog, setMarkDialog]     = useState(false);
  const [pendingExport, setPendingExport] = useState<SageJob[]>([]);

  // ── Reference data ────────────────────────────────────────────────────────
  const { data: departments = [] } = useQuery<Department[]>({ queryKey: ["/api/departments"] });
  const { data: workers = [] }     = useQuery<Worker[]>({ queryKey: ["/api/workers"] });
  const { data: clients = [] }     = useQuery<Client[]>({ queryKey: ["/api/clients"] });

  // ── Build query params ────────────────────────────────────────────────────
  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (from)                        p.set("from", from);
    if (to)                          p.set("to", to);
    if (deptFilter   !== "all")      p.set("departmentId", deptFilter);
    if (workerFilter !== "all")      p.set("workerId", workerFilter);
    if (clientFilter !== "all")      p.set("clientId", clientFilter);
    if (includeExported)             p.set("includeExported", "true");
    return p.toString();
  }, [from, to, deptFilter, workerFilter, clientFilter, includeExported]);

  // ── Fetch jobs ────────────────────────────────────────────────────────────
  const { data: jobs = [], isLoading, refetch } = useQuery<SageJob[]>({
    queryKey: ["/api/sage-export/jobs", params],
    queryFn: () => fetch(`/api/sage-export/jobs?${params}`).then(r => r.json()),
  });

  // ── Mark mutation ─────────────────────────────────────────────────────────
  const markMutation = useMutation({
    mutationFn: (payload: { jobIds: string[]; status: "exported" | "invoiced" }) =>
      apiRequest("POST", "/api/sage-export/mark", payload),
    onSuccess: () => {
      toast({ title: "Jobs updated", description: "Invoice status updated successfully." });
      qc.invalidateQueries({ queryKey: ["/api/sage-export/jobs"] });
      setMarkDialog(false);
    },
    onError: () => toast({ title: "Error", description: "Could not update jobs.", variant: "destructive" }),
  });

  // ── Export handler ────────────────────────────────────────────────────────
  const handleExport = async () => {
    if (jobs.length === 0) {
      toast({ title: "Nothing to export", description: "No completed jobs match the current filters.", variant: "destructive" });
      return;
    }
    try {
      const res = await fetch("/api/sage-export/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobs }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `sage-export-${todayStr}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);

      setPendingExport(jobs.filter(j => j.invoiceStatus === "not_invoiced"));
      setMarkDialog(true);
    } catch (e: any) {
      toast({ title: "Export failed", description: e.message, variant: "destructive" });
    }
  };

  // ── Totals ────────────────────────────────────────────────────────────────
  const totals = useMemo(() => ({
    count:    jobs.length,
    exVat:    jobs.reduce((s, j) => s + Number(j.unitPriceEx) * j.quantity, 0),
    vat:      jobs.reduce((s, j) => s + Number(j.vatAmount), 0),
    incl:     jobs.reduce((s, j) => s + Number(j.totalIncl), 0),
  }), [jobs]);

  const fmt = (n: number) =>
    n.toLocaleString("en-ZA", { style: "currency", currency: "ZAR", minimumFractionDigits: 2 });

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-green-600" />
            Sage Export
          </h1>
          <p className="text-sm text-gray-500 mt-1">Export completed jobs for capturing in Sage Accounting</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Button
            onClick={handleExport}
            disabled={jobs.length === 0 || isLoading}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Download className="h-4 w-4 mr-2" />
            Export Completed Jobs for Sage
            {jobs.length > 0 && <span className="ml-2 bg-white/20 rounded px-1.5 text-xs">{jobs.length}</span>}
          </Button>
        </div>
      </div>

      {/* Warning banner */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800 dark:text-amber-200">
          <strong>Important:</strong> This export does not create invoices in Sage. Please check the file carefully before capturing or importing it into Sage Accounting.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" /> Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            {/* Date range */}
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">From Date</Label>
              <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">To Date</Label>
              <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-9 text-sm" />
            </div>

            {/* Department */}
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Department</Label>
              <Select value={deptFilter} onValueChange={setDeptFilter}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="All departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Technician */}
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Technician</Label>
              <Select value={workerFilter} onValueChange={setWorkerFilter}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="All technicians" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Technicians</SelectItem>
                  {workers.map((w: any) => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Customer */}
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Customer</Label>
              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="All customers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Customers</SelectItem>
                  {clients.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Include Exported toggle */}
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Show Exported</Label>
              <div className="flex items-center gap-2 h-9">
                <Checkbox
                  id="includeExported"
                  checked={includeExported}
                  onCheckedChange={v => setIncludeExported(!!v)}
                />
                <label htmlFor="includeExported" className="text-sm text-gray-600 cursor-pointer">
                  Include exported jobs
                </label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      {jobs.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Jobs",         value: totals.count.toString(),  color: "text-gray-900 dark:text-gray-100" },
            { label: "Ex VAT Total", value: fmt(totals.exVat),        color: "text-blue-700" },
            { label: "VAT (15%)",    value: fmt(totals.vat),          color: "text-orange-600" },
            { label: "Total Incl",   value: fmt(totals.incl),         color: "text-green-700 font-semibold" },
          ].map(s => (
            <Card key={s.label} className="py-3">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">{s.label}</p>
                <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Results table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading jobs…
            </div>
          ) : jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
              <CheckCircle2 className="h-10 w-10 text-green-300" />
              <p className="font-medium">No completed jobs found</p>
              <p className="text-sm">All jobs in this date range have been invoiced, or no completed jobs exist.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 dark:bg-gray-800/50">
                    <TableHead className="text-xs font-semibold whitespace-nowrap">Job Date</TableHead>
                    <TableHead className="text-xs font-semibold whitespace-nowrap">Job #</TableHead>
                    <TableHead className="text-xs font-semibold whitespace-nowrap">Customer</TableHead>
                    <TableHead className="text-xs font-semibold whitespace-nowrap">Sage Code</TableHead>
                    <TableHead className="text-xs font-semibold whitespace-nowrap">Dept</TableHead>
                    <TableHead className="text-xs font-semibold whitespace-nowrap">Technician</TableHead>
                    <TableHead className="text-xs font-semibold whitespace-nowrap">Description</TableHead>
                    <TableHead className="text-xs font-semibold text-right whitespace-nowrap">Qty</TableHead>
                    <TableHead className="text-xs font-semibold text-right whitespace-nowrap">Unit Ex</TableHead>
                    <TableHead className="text-xs font-semibold text-right whitespace-nowrap">VAT</TableHead>
                    <TableHead className="text-xs font-semibold text-right whitespace-nowrap">Total Incl</TableHead>
                    <TableHead className="text-xs font-semibold whitespace-nowrap">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map(job => (
                    <TableRow key={job.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                      <TableCell className="text-xs whitespace-nowrap">{fmtDate(job.jobDate)}</TableCell>
                      <TableCell className="text-xs font-mono whitespace-nowrap">{job.jobNumber}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap max-w-[140px] truncate">{job.clientName}</TableCell>
                      <TableCell className="text-xs font-mono">
                        {job.sageCode
                          ? <span className="text-green-700 font-medium">{job.sageCode}</span>
                          : <span className="text-gray-400 italic">—</span>}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{job.department}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{job.technician || "—"}</TableCell>
                      <TableCell className="text-xs max-w-[160px] truncate">{job.description}</TableCell>
                      <TableCell className="text-xs text-right">{job.quantity}</TableCell>
                      <TableCell className="text-xs text-right whitespace-nowrap">
                        {Number(job.unitPriceEx).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-xs text-right whitespace-nowrap text-orange-600">
                        {Number(job.vatAmount).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-xs text-right whitespace-nowrap font-semibold text-green-700">
                        {Number(job.totalIncl).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[job.invoiceStatus] ?? STATUS_COLORS.not_invoiced}`}>
                          {STATUS_LABELS[job.invoiceStatus] ?? job.invoiceStatus}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mark as Exported dialog */}
      <Dialog open={markDialog} onOpenChange={setMarkDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Mark Jobs as Exported?
            </DialogTitle>
            <DialogDescription>
              Your file has been downloaded. Do you want to mark the{" "}
              <strong>{pendingExport.length}</strong> exported job
              {pendingExport.length !== 1 ? "s" : ""} as <em>Exported</em>?
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-gray-500 px-1">
            Marking them as <strong>Exported</strong> means they won't appear in future exports unless you tick "Include exported jobs". You can still update their status to <strong>Invoiced</strong> once captured in Sage.
          </p>
          <DialogFooter className="gap-2 flex-col sm:flex-row">
            <Button variant="outline" onClick={() => setMarkDialog(false)}>
              No, keep as Not Invoiced
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={markMutation.isPending}
              onClick={() =>
                markMutation.mutate({
                  jobIds: pendingExport.map(j => j.id),
                  status: "exported",
                })
              }
            >
              {markMutation.isPending ? "Updating…" : "Yes, Mark as Exported"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
