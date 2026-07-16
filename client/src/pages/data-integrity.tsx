import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  AlertTriangle, CheckCircle2, Copy, Database, Download,
  RefreshCw, ExternalLink, CalendarClock, FlaskConical,
  XCircle, Loader2, ShieldCheck, AlertCircle, Merge, History,
} from "lucide-react";
import { format } from "date-fns";

// ── Types ──────────────────────────────────────────────────────────────────────
interface OrphanRecord {
  type: string;
  id: string;
  label: string;
  clientId: string | null;
}
interface OrphansResponse {
  orphans: OrphanRecord[];
  totalClients: number;
}

interface DuplicateClient {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
}
interface DuplicateGroup {
  field: "phone" | "email" | "name";
  value: string;
  clients: DuplicateClient[];
}
interface DuplicatesResponse {
  groups: DuplicateGroup[];
  totalClients: number;
}

interface SourceEntry {
  module: string;
  source: string;
  count: number;
}

interface BackupSummary {
  exportedAt: string;
  counts: {
    clients: number;
    jobs: number;
    rentalContracts: number;
    serviceContracts: number;
    invoices: number;
    quotes: number;
    workers: number;
  };
}

interface ScreenResult {
  screen: string;
  found: boolean;
}
interface RecordTestResult {
  recordType: string;
  id: string;
  clientId: string;
  status: "passed" | "failed";
  screens: ScreenResult[];
  failureReason?: string;
}
interface SaveSearchTestResponse {
  overall: "passed" | "failed";
  results: RecordTestResult[];
}

interface DbStatusCounts {
  clients: number;
  workers: number;
  jobs: number;
  invoices: number;
  quotes: number;
  serviceContracts: number;
  rentalContracts: number;
  unifiedContracts: number;
  contractLineItems: number;
  purchaseOrders: number;
  activityLogs: number;
  backupLogs: number;
}
interface DbStatusResponse {
  storageType: string;
  memStorageDisabled: boolean;
  checkedAt: string;
  counts: DbStatusCounts;
}

interface IntegrityScan {
  id: string;
  scannedAt: string;
  triggeredBy: string;
  orphanCount: number;
  duplicateGroupCount: number;
}

interface HealthCheckItem {
  name: string;
  status: "passed" | "failed" | "warning";
  details: string;
  error?: string;
}
interface HealthCheckResponse {
  overall: "passed" | "failed" | "warning";
  checkedAt: string;
  checks: HealthCheckItem[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const BACKUP_LABELS: Record<string, string> = {
  clients:          "Clients",
  jobs:             "Jobs",
  rentalContracts:  "Rental Contracts",
  serviceContracts: "Service Contracts",
  invoices:         "Invoices",
  quotes:           "Quotes / Leads",
  workers:          "Staff",
};

const TYPE_LABELS: Record<string, string> = {
  job:             "Job",
  invoice:         "Invoice",
  rentalContract:  "Rental Contract",
  quote:           "Quote / Lead",
  serviceContract: "Service Contract",
};

const TYPE_COLORS: Record<string, string> = {
  job:             "bg-blue-100 text-blue-800",
  invoice:         "bg-green-100 text-green-800",
  rentalContract:  "bg-purple-100 text-purple-800",
  quote:           "bg-orange-100 text-orange-800",
  serviceContract: "bg-indigo-100 text-indigo-800",
};

const FIELD_LABELS: Record<string, string> = {
  phone: "Same Phone",
  email: "Same Email",
  name:  "Same Name",
};

const FIELD_COLORS: Record<string, string> = {
  phone: "bg-yellow-100 text-yellow-800",
  email: "bg-red-100 text-red-800",
  name:  "bg-pink-100 text-pink-800",
};

const DB_COUNT_LABELS: Array<{ key: keyof DbStatusCounts; label: string }> = [
  { key: "clients",          label: "Clients" },
  { key: "workers",          label: "Workers" },
  { key: "jobs",             label: "Jobs" },
  { key: "invoices",         label: "Invoices" },
  { key: "quotes",           label: "Quotes / Leads" },
  { key: "unifiedContracts", label: "Contracts" },
  { key: "contractLineItems",label: "Contract Line Items" },
  { key: "serviceContracts", label: "Legacy Service Contracts" },
  { key: "rentalContracts",  label: "Legacy Rental Contracts" },
  { key: "purchaseOrders",   label: "Purchase Orders" },
  { key: "activityLogs",     label: "Activity Logs" },
  { key: "backupLogs",       label: "Backup Logs" },
];

function LoadingRows() {
  return (
  <>
    <div className="space-y-3 pt-2">
      {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
    </div>
  </>
  );
}

function NoIssues({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
      <CheckCircle2 className="h-10 w-10 text-green-500" />
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}

// ── Database Status Section ─────────────────────────────────────────────────────
function DatabaseStatusSection() {
  const { data, isLoading, refetch, isFetching } = useQuery<DbStatusResponse>({
    queryKey: ["/api/admin/data-integrity/db-status"],
    refetchInterval: 60_000,
  });

  return (
    <Card className="border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <Database className="h-5 w-5 text-green-600" />
            <div>
              <CardTitle className="text-base text-green-900">Database Status</CardTitle>
              <CardDescription className="text-green-700 text-xs">
                All production data is stored in PostgreSQL — not in memory.
              </CardDescription>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-green-300 text-green-800 hover:bg-green-100"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            {isFetching
              ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status badges */}
        <div className="flex flex-wrap gap-2">
          <Badge className="bg-green-600 text-white px-3 py-1 text-xs font-semibold">
            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
            Persistent database storage active. Data survives server restarts.
          </Badge>
          {data && (
              <Badge variant="outline" className="border-green-300 text-green-800 text-xs">
                Storage Type: {data.storageType}
              </Badge>
              <Badge variant="outline" className="border-green-300 text-green-800 text-xs">
                MemStorage: Disabled for production data
              </Badge>
          )}
        </div>

        {/* Connection check time */}
        {data && (
          <p className="text-xs text-green-700">
            Last connection check:{" "}
            <span className="font-medium">
              {format(new Date(data.checkedAt), "d MMM yyyy, HH:mm:ss")}
            </span>
          </p>
        )}

        {/* Record counts grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[...Array(10)].map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded" />
            ))}
          </div>
        ) : data ? (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {DB_COUNT_LABELS.map(({ key, label }) => (
              <div key={key} className="bg-white rounded-lg border border-green-100 px-3 py-2 text-center shadow-sm">
                <p className="text-xl font-bold text-green-800">{data.counts[key].toLocaleString()}</p>
                <p className="text-xs text-muted-foreground leading-tight">{label}</p>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ── TEMPORARY: One-time Database Update (schema sync) ───────────────────────────
// Admin-only, manual, one-time trigger for `npm run db:push`. This does NOT run
// automatically — it only runs when this button is clicked. Remove this section
// (and the matching server route) once the production schema is confirmed in sync.
function NormalizeStatusSection() {
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message?: string; totalUpdated?: number; details?: string[]; unknownStatuses?: any[]; error?: string } | null>(null);

  async function runNormalize() {
    setConfirmOpen(false);
    setRunning(true);
    setResult(null);
    try {
      const resp = await apiRequest("POST", "/api/admin/normalize-lead-statuses");
      const json = await resp.json();
      setResult(json);
      if (json.success) {
        toast({ title: "Lead statuses normalized", description: json.message });
      } else {
        toast({ title: "Normalization failed", description: json.error ?? "Unknown error", variant: "destructive" });
      }
    } catch (err: any) {
      const message = err?.message ?? "Unknown error";
      setResult({ success: false, error: message });
      toast({ title: "Normalization failed", description: message, variant: "destructive" });
    } finally {
      setRunning(false);
    }
  }

  return (
    <Card className="border-blue-300 bg-blue-50">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <RefreshCw className="h-5 w-5 text-blue-600" />
          <div>
            <CardTitle className="text-base text-blue-900">Normalize Lead Statuses</CardTitle>
            <CardDescription className="text-blue-800 text-xs">
              Maps any old/legacy lead status values in the database to the current 7 canonical statuses
              (New, Contacted, Appointment Booked, Quote Required, Quoted, Lost, Converted).
              Run this once on a fresh production database to fix leads that may be hidden or showing under "Needs Review".
              Safe to run more than once — it only changes rows with legacy status values.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          variant="outline"
          className="border-blue-400 text-blue-900 hover:bg-blue-100"
          onClick={() => setConfirmOpen(true)}
          disabled={running}
        >
          {running ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1.5" />}
          {running ? "Normalizing statuses…" : "Normalize Lead Statuses"}
        </Button>

        {result && (
          <div className={`rounded-lg border p-3 text-sm ${result.success ? "border-green-200 bg-green-50 text-green-900" : "border-red-200 bg-red-50 text-red-900"}`}>
            <p className="font-medium flex items-center gap-1.5">
              {result.success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              {result.success ? result.message : "Failed"}
            </p>
            {result.error && <p className="mt-1 text-xs">{result.error}</p>}
            {result.details && result.details.length > 0 && (
              <ul className="mt-2 text-xs space-y-0.5">
                {result.details.map((d: string, i: number) => <li key={i}>• {d}</li>)}
              </ul>
            )}
            {result.unknownStatuses && result.unknownStatuses.length > 0 && (
              <div className="mt-2">
                <p className="text-xs font-medium text-orange-700">Unknown statuses (shown as "Needs Review" on board):</p>
                <ul className="mt-1 text-xs space-y-0.5">
                  {result.unknownStatuses.map((r: any, i: number) => (
                    <li key={i}>• "{r.status}": {r.count} row(s)</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-blue-600" />
              Normalize lead statuses?
            </DialogTitle>
            <DialogDescription>
              This will update any leads in the database that have old/legacy status values
              (e.g. "site_done", "quote_sent", "accepted") and map them to the current canonical statuses.
              No data will be deleted. This may take a few seconds.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={runNormalize}>
              Yes, normalize
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function DbPushSection() {
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ success: boolean; output?: string; error?: string } | null>(null);

  async function runDbPush() {
    setConfirmOpen(false);
    setRunning(true);
    setResult(null);
    try {
      const resp = await apiRequest("POST", "/api/admin/run-db-push");
      const json = await resp.json();
      setResult(json);
      if (json.success) {
        toast({ title: "Database update complete", description: "The database schema has been updated to match the app." });
      } else {
        toast({ title: "Database update failed", description: json.error ?? "Unknown error", variant: "destructive" });
      }
    } catch (err: any) {
      const message = err?.message ?? "Unknown error";
      setResult({ success: false, error: message });
      toast({ title: "Database update failed", description: message, variant: "destructive" });
    } finally {
      setRunning(false);
    }
  }

  return (
    <Card className="border-amber-300 bg-amber-50">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <div>
            <CardTitle className="text-base text-amber-900">Run Database Update</CardTitle>
            <CardDescription className="text-amber-800 text-xs">
              Temporary tool: updates this server's database structure to match the app (adds any missing
              tables/columns). Only run this if you were told a database update is needed. Safe to run more
              than once — it only adds what's missing, it does not delete existing data.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          variant="outline"
          className="border-amber-400 text-amber-900 hover:bg-amber-100"
          onClick={() => setConfirmOpen(true)}
          disabled={running}
        >
          {running ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Database className="h-4 w-4 mr-1.5" />}
          {running ? "Running database update…" : "Run Database Update"}
        </Button>

        {result && (
          <div className={`rounded-lg border p-3 text-sm ${result.success ? "border-green-200 bg-green-50 text-green-900" : "border-red-200 bg-red-50 text-red-900"}`}>
            <p className="font-medium flex items-center gap-1.5">
              {result.success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              {result.success ? "Update finished successfully" : "Update failed"}
            </p>
            {result.error && <p className="mt-1 text-xs">{result.error}</p>}
            {result.output && (
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-white/60 p-2 text-xs">
                {result.output}
              </pre>
            )}
          </div>
        )}
      </CardContent>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Run database update?
            </DialogTitle>
            <DialogDescription>
              This will update this database's structure to match the current app (adding any missing tables
              or columns). It will not delete any existing data. This may take up to a minute.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button className="bg-amber-600 hover:bg-amber-700 text-white" onClick={runDbPush}>
              Yes, run it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ── Health Check Tab ────────────────────────────────────────────────────────────
function HealthCheckTab() {
  const { toast } = useToast();
  const [result, setResult] = useState<HealthCheckResponse | null>(null);
  const [running, setRunning] = useState(false);

  async function runCheck() {
    setRunning(true);
    setResult(null);
    try {
      const resp = await apiRequest("GET", "/api/admin/data-integrity/health-check");
      const json: HealthCheckResponse = await resp.json();
      setResult(json);
      if (json.overall === "passed") {
        toast({ title: "All checks passed", description: "PostgreSQL is healthy and all data integrity checks passed." });
      } else if (json.overall === "warning") {
        toast({ title: "Checks passed with warnings", description: "Some minor issues detected — see details below.", variant: "destructive" });
      } else {
        toast({ title: "Health check failed", description: "One or more checks failed — see details below.", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Health check error", description: err?.message ?? "Unknown error", variant: "destructive" });
    } finally {
      setRunning(false);
    }
  }

  const statusIcon = (s: HealthCheckItem["status"]) => {
    if (s === "passed")  return <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />;
    if (s === "warning") return <AlertCircle  className="h-4 w-4 text-yellow-500 shrink-0" />;
    return <XCircle className="h-4 w-4 text-red-500 shrink-0" />;
  };

  const statusBadge = (s: HealthCheckItem["status"]) => {
    if (s === "passed")  return <Badge className="bg-green-100 text-green-800 text-xs">PASSED</Badge>;
    if (s === "warning") return <Badge className="bg-yellow-100 text-yellow-800 text-xs">WARNING</Badge>;
    return <Badge className="bg-red-100 text-red-800 text-xs">FAILED</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            Runs 13 checks against the PostgreSQL database: connection, table queries, record counts,
            orphan detection (jobs, quotes, invoices, contracts, line items), stock item references, required columns, and schema integrity.
          </p>
        </div>
        <Button
          onClick={runCheck}
          disabled={running}
          className="shrink-0 bg-blue-700 hover:bg-blue-800 text-white"
        >
          {running
            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Running…</>
            : <><ShieldCheck className="h-4 w-4 mr-2" />Run Database Health Check</>}
        </Button>
      </div>

      {!result && !running && (
        <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
          <ShieldCheck className="h-10 w-10 text-blue-300" />
          <p className="text-sm">Press the button above to run the database health check.</p>
        </div>
      )}

      {running && (
        <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="h-10 w-10 animate-spin text-blue-400" />
          <p className="text-sm">Running 10 checks against PostgreSQL…</p>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {/* Overall banner */}
          <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${
            result.overall === "passed"
              ? "bg-green-50 border-green-200 text-green-800"
              : result.overall === "warning"
              ? "bg-yellow-50 border-yellow-200 text-yellow-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}>
            {result.overall === "passed"
              ? <CheckCircle2 className="h-5 w-5 shrink-0" />
              : result.overall === "warning"
              ? <AlertCircle className="h-5 w-5 shrink-0" />
              : <XCircle className="h-5 w-5 shrink-0" />}
            <div>
              <span className="font-semibold text-sm">
                Overall:{" "}
                {result.overall === "passed" ? "PASSED — All database checks passed."
                  : result.overall === "warning" ? "WARNING — Some issues detected."
                  : "FAILED — One or more critical checks failed."}
              </span>
              <p className="text-xs opacity-75">
                Checked at: {format(new Date(result.checkedAt), "d MMM yyyy, HH:mm:ss")}
              </p>
            </div>
          </div>

          {/* Per-check rows */}
          <div className="rounded-md border divide-y">
            {result.checks.map((c, i) => (
              <div key={i} className="px-4 py-3 flex items-start gap-3">
                {statusIcon(c.status)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-sm font-medium">{c.name}</span>
                    {statusBadge(c.status)}
                  </div>
                  <p className="text-xs text-muted-foreground">{c.details}</p>
                  {c.error && (
                    <p className="text-xs text-red-600 mt-1 bg-red-50 rounded px-2 py-1 font-mono">
                      {c.error}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Orphans Tab ────────────────────────────────────────────────────────────────
function OrphansTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [fixingId, setFixingId] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<Record<string, string>>({});

  const { data, isLoading, refetch } = useQuery<OrphansResponse>({
    queryKey: ["/api/admin/data-integrity/orphans"],
  });

  const { data: clients } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/clients"],
  });

  const fixMutation = useMutation({
    mutationFn: (payload: { type: string; id: string; clientId: string }) =>
      apiRequest("PATCH", "/api/admin/data-integrity/fix-orphan", payload),
    onSuccess: () => {
      toast({ title: "Orphan fixed", description: "The record has been reassigned to the selected client." });
      qc.invalidateQueries({ queryKey: ["/api/admin/data-integrity/orphans"] });
      setFixingId(null);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message ?? "Failed to fix orphan", variant: "destructive" });
    },
  });

  if (isLoading) return <LoadingRows />;

  const orphans = data?.orphans ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Records whose client reference is missing or points to a client that no longer exists.
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      {orphans.length === 0 ? (
        <NoIssues label="No orphan records found" />
      ) : (
        <div className="space-y-2">
          {orphans.map(o => (
            <Card key={`${o.type}-${o.id}`} className="border-orange-200">
              <CardContent className="pt-4 pb-3 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={TYPE_COLORS[o.type] ?? "bg-gray-100 text-gray-800"}>
                      {TYPE_LABELS[o.type] ?? o.type}
                    </Badge>
                    <span className="text-sm font-medium truncate">{o.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    clientId: <span className="font-mono">{o.clientId ?? "(null — no client assigned)"}</span>
                  </p>
                </div>

                {fixingId === o.id ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <Select
                      value={selectedClient[o.id] ?? ""}
                      onValueChange={v => setSelectedClient(p => ({ ...p, [o.id]: v }))}
                    >
                      <SelectTrigger className="w-52 h-8 text-xs">
                        <SelectValue placeholder="Select client…" />
                      </SelectTrigger>
                      <SelectContent>
                        {(clients ?? []).map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      disabled={!selectedClient[o.id] || fixMutation.isPending}
                      onClick={() => fixMutation.mutate({ type: o.type, id: o.id, clientId: selectedClient[o.id] })}
                    >
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setFixingId(null)}>Cancel</Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setFixingId(o.id)}>
                    Fix
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground pt-2">
        {orphans.length} orphan record(s) found across {data?.totalClients ?? 0} clients.
      </p>
    </div>
  );
}

// ── Duplicates Tab ─────────────────────────────────────────────────────────────
function DuplicatesTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading, refetch } = useQuery<DuplicatesResponse>({
    queryKey: ["/api/admin/data-integrity/duplicates"],
  });

  const [mergeGroup, setMergeGroup] = useState<DuplicateGroup | null>(null);
  const [masterId, setMasterId] = useState<string>("");

  const mergeMutation = useMutation({
    mutationFn: (payload: { masterId: string; duplicateIds: string[] }) =>
      apiRequest("POST", "/api/admin/data-integrity/merge-clients", payload),
    onSuccess: async (res: any) => {
      const data = await res.json();
      const total = Object.values(data.reassigned as Record<string, number>).reduce((a, b) => a + b, 0);
      toast({
        title: "Clients merged",
        description: `Kept "${data.masterName}". ${data.deleted} duplicate(s) removed. ${total} record(s) reassigned.`,
      });
      setMergeGroup(null);
      setMasterId("");
      qc.invalidateQueries({ queryKey: ["/api/admin/data-integrity/duplicates"] });
      qc.invalidateQueries({ queryKey: ["/api/clients"] });
    },
    onError: (err: any) => {
      toast({ title: "Merge failed", description: err.message ?? "Could not merge clients.", variant: "destructive" });
    },
  });

  const openMerge = (g: DuplicateGroup) => {
    setMergeGroup(g);
    setMasterId(g.clients[0]?.id ?? "");
  };

  const confirmMerge = () => {
    if (!mergeGroup || !masterId) return;
    const duplicateIds = mergeGroup.clients.filter(c => c.id !== masterId).map(c => c.id);
    mergeMutation.mutate({ masterId, duplicateIds });
  };

  if (isLoading) return <LoadingRows />;

  const groups = data?.groups ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Clients that share the same phone number, email address, or exact name.
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      {groups.length === 0 ? (
        <NoIssues label="No duplicate clients detected" />
      ) : (
        <div className="space-y-4">
          {groups.map((g, idx) => (
            <Card key={idx} className="border-yellow-200">
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className={FIELD_COLORS[g.field]}>
                      {FIELD_LABELS[g.field]}
                    </Badge>
                    <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground font-mono">{g.value}</span>
                  </div>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => openMerge(g)}>
                    <Merge className="h-3.5 w-3.5" />
                    Merge
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0 pb-3 px-4">
                <div className="space-y-1.5">
                  {g.clients.map(c => (
                    <div key={c.id} className="flex items-center justify-between bg-muted/30 rounded px-3 py-1.5 gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {[c.email, c.phone].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-xs">{c.status}</Badge>
                        <Link href={`/clients/${c.id}`}>
                          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1">
                            <ExternalLink className="h-3 w-3" />
                            View
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground pt-2">
        {groups.length} duplicate group(s) found across {data?.totalClients ?? 0} clients.
      </p>

      {/* Merge confirmation dialog */}
      <Dialog open={!!mergeGroup} onOpenChange={open => { if (!open) { setMergeGroup(null); setMasterId(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Merge className="h-5 w-5 text-yellow-600" />
              Merge Duplicate Clients
            </DialogTitle>
            <DialogDescription>
              Select the <strong>master client</strong> to keep. All jobs, invoices, contracts, and quotes linked to the other clients will be moved to the master, and the duplicates will be permanently deleted.
            </DialogDescription>
          </DialogHeader>

          {mergeGroup && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge className={FIELD_COLORS[mergeGroup.field]}>{FIELD_LABELS[mergeGroup.field]}</Badge>
                <span className="font-mono">{mergeGroup.value}</span>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Choose the master client:</p>
                <RadioGroup value={masterId} onValueChange={setMasterId} className="space-y-2">
                  {mergeGroup.clients.map(c => (
                    <div key={c.id} className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${masterId === c.id ? "border-blue-400 bg-blue-50" : "border-border hover:bg-muted/40"}`}
                      onClick={() => setMasterId(c.id)}>
                      <RadioGroupItem value={c.id} id={`master-${c.id}`} className="mt-0.5" />
                      <Label htmlFor={`master-${c.id}`} className="cursor-pointer flex-1">
                        <p className="text-sm font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {[c.email, c.phone].filter(Boolean).join(" · ") || "No contact info"}
                        </p>
                        <Badge variant="outline" className="text-xs mt-1">{c.status}</Badge>
                      </Label>
                      {masterId === c.id && (
                        <Badge className="bg-blue-100 text-blue-800 text-xs shrink-0">Master</Badge>
                      )}
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                <strong>Warning:</strong> This action is irreversible. The {mergeGroup.clients.length - 1} other client record(s) will be permanently deleted after all their linked records are moved to the master.
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setMergeGroup(null); setMasterId(""); }}>
              Cancel
            </Button>
            <Button
              onClick={confirmMerge}
              disabled={!masterId || mergeMutation.isPending}
              className="bg-yellow-600 hover:bg-yellow-700 text-white"
            >
              {mergeMutation.isPending ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Merge className="h-4 w-4 mr-2" />}
              Confirm Merge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Data Source Check Tab ──────────────────────────────────────────────────────
function DataSourcesTab() {
  const { data, isLoading, refetch } = useQuery<SourceEntry[]>({
    queryKey: ["/api/admin/data-integrity/sources"],
  });

  if (isLoading) return <LoadingRows />;

  const sources = data ?? [];
  const total = sources.reduce((s, e) => s + e.count, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Live record counts for every data module — confirms data is loading from PostgreSQL.
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[220px]">Module</TableHead>
              <TableHead>PostgreSQL Table</TableHead>
              <TableHead className="text-right w-[100px]">Records</TableHead>
              <TableHead className="w-[80px]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sources.map(s => (
              <TableRow key={s.source}>
                <TableCell className="font-medium">{s.module}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{s.source}</TableCell>
                <TableCell className="text-right font-semibold">{s.count.toLocaleString()}</TableCell>
                <TableCell>
                  <Badge className="bg-green-100 text-green-800 text-xs">
                    PostgreSQL
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between bg-muted/30 rounded px-4 py-2.5">
        <span className="text-sm font-medium">Total records loaded</span>
        <span className="text-xl font-bold">{total.toLocaleString()}</span>
      </div>
    </div>
  );
}

// ── Backup Tab ─────────────────────────────────────────────────────────────────
interface BackupSchedule {
  enabled: boolean;
  frequency: "daily" | "weekly";
  dayOfWeek: number;
  hourUTC: number;
  minuteUTC: number;
  recipientEmail: string;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function computeNextRun(s: BackupSchedule): string {
  if (!s.enabled) return "Disabled";
  const now = new Date();
  const candidate = new Date(now);
  candidate.setUTCHours(s.hourUTC, s.minuteUTC, 0, 0);
  if (candidate <= now) candidate.setUTCDate(candidate.getUTCDate() + 1);
  if (s.frequency === "weekly") {
    while (candidate.getUTCDay() !== s.dayOfWeek) candidate.setUTCDate(candidate.getUTCDate() + 1);
  }
  return candidate.toLocaleString("en-ZA", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false, timeZoneName: "short",
  });
}

function BackupTab() {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState<"json" | "csv" | null>(null);
  const [lastExport, setLastExport] = useState<BackupSummary | null>(null);

  const { data: summary, refetch: refetchSummary } = useQuery<BackupSummary>({
    queryKey: ["/api/admin/data-integrity/backup/summary"],
  });

  const { data: schedule } = useQuery<BackupSchedule>({
    queryKey: ["/api/backup/schedule"],
  });

  const download = async (type: "json" | "csv") => {
    setDownloading(type);
    try {
      const url = type === "json"
        ? "/api/admin/data-integrity/backup/json"
        : "/api/admin/data-integrity/backup/csv";
      const token = localStorage.getItem("auth_token") ?? "";
      const resp = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      });
      if (!resp.ok) throw new Error(await resp.text());
      const blob = await resp.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      const cd = resp.headers.get("Content-Disposition") ?? "";
      const match = cd.match(/filename="([^"]+)"/);
      a.download = match?.[1] ?? (type === "json" ? "backup.json" : "clients.csv");
      a.click();
      URL.revokeObjectURL(a.href);

      if (type === "json") {
        const s = await refetchSummary();
        setLastExport(s.data ?? null);
      }

      toast({ title: "Download started", description: `${a.download} is downloading.` });
    } catch (e: any) {
      toast({ title: "Download failed", description: e.message, variant: "destructive" });
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800 flex items-center gap-2">
        <Database className="h-3.5 w-3.5 shrink-0" />
        Backup reads from PostgreSQL. All production records are included.
      </div>

      <p className="text-sm text-muted-foreground">
        Export a point-in-time snapshot of the system data. Store it somewhere safe — you can restore from the JSON backup via the Backup &amp; Restore page.
      </p>

      {schedule && (
        <div className={`rounded-md border p-3 flex items-center gap-3 text-sm ${schedule.enabled ? "border-violet-200 bg-violet-50 text-violet-800" : "border-gray-200 bg-muted/20 text-muted-foreground"}`}>
          <CalendarClock className="h-4 w-4 shrink-0" />
          <div>
            {schedule.enabled ? (
              <>
                <span className="font-medium">Automated backup active — </span>
                {schedule.frequency === "daily" ? "Daily" : `Every ${DAYS[schedule.dayOfWeek]}`} at{" "}
                {String(schedule.hourUTC).padStart(2, "0")}:{String(schedule.minuteUTC).padStart(2, "0")} UTC
                {" "}→ next run: <strong>{computeNextRun(schedule)}</strong>
              </>
            ) : (
              "Scheduled backup is disabled. Enable it on the Backup & Restore page."
            )}
          </div>
        </div>
      )}

      {summary && (
        <div className="rounded-md border bg-muted/20 p-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Current data snapshot</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            {Object.entries(summary.counts).map(([k, v]) => (
              <div key={k} className="bg-white rounded p-2 border">
                <p className="text-lg font-bold">{v}</p>
                <p className="text-xs text-muted-foreground">{BACKUP_LABELS[k] ?? k}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {lastExport && (
        <div className="rounded-md border border-green-200 bg-green-50 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <p className="text-sm font-medium text-green-800">
              Last export: {format(new Date(lastExport.exportedAt), "d MMM yyyy, HH:mm")}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            {Object.entries(lastExport.counts).map(([k, v]) => (
              <div key={k} className="bg-white/70 rounded px-2 py-1 border border-green-100">
                <p className="font-bold">{v}</p>
                <p className="text-muted-foreground">{BACKUP_LABELS[k] ?? k}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4" />
              Full System Backup (JSON)
            </CardTitle>
            <CardDescription>
              Complete data export covering all modules — clients, jobs, invoices, contracts, workers, fleet and more. Use this to restore the system.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => download("json")}
              disabled={downloading === "json"}
              className="w-full sm:w-auto"
            >
              {downloading === "json"
                ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                : <Download className="h-4 w-4 mr-2" />}
              Download JSON Backup
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Download className="h-4 w-4" />
              Clients CSV Export
            </CardTitle>
            <CardDescription>
              Lightweight export of the client list as a CSV file. Useful for Sage, Excel, or sharing with the accounts team.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => download("csv")}
              disabled={downloading === "csv"}
              className="w-full sm:w-auto"
            >
              {downloading === "csv"
                ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                : <Download className="h-4 w-4 mr-2" />}
              Download Clients CSV
            </Button>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        Tip: Schedule regular downloads and store them in a cloud folder (Google Drive, OneDrive) as your backup cadence.
      </p>
    </div>
  );
}

// ── Save/Search Test Tab ────────────────────────────────────────────────────────
function SaveSearchTestTab() {
  const { toast } = useToast();
  const [result, setResult] = useState<SaveSearchTestResponse | null>(null);
  const [running, setRunning] = useState(false);

  async function runTest() {
    setRunning(true);
    setResult(null);
    try {
      const data = await apiRequest("GET", "/api/admin/data-integrity/save-search-test");
      const json: SaveSearchTestResponse = await data.json();
      setResult(json);
      if (json.overall === "passed") {
        toast({ title: "All checks passed", description: "Every record was saved and found in all expected screens." });
      } else {
        toast({ title: "Some checks failed", description: "See below for details.", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Test error", description: err?.message ?? "Unknown error", variant: "destructive" });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            Creates one record of each type for a temporary test client in PostgreSQL, then checks that
            every record can be found in the list screens a real user would navigate to.
            All test data is deleted automatically when the test finishes.
          </p>
          <p className="text-xs text-green-700 font-medium flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Records are saved to PostgreSQL — they survive server restarts.
          </p>
        </div>
        <Button
          onClick={runTest}
          disabled={running}
          className="shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          {running
            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Running…</>
            : <><FlaskConical className="h-4 w-4 mr-2" />Run Save/Search/Restart Test</>}
        </Button>
      </div>

      {!result && !running && (
        <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
          <FlaskConical className="h-10 w-10 text-indigo-300" />
          <p className="text-sm">Press the button above to run the test.</p>
        </div>
      )}

      {running && (
        <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-400" />
          <p className="text-sm">Creating records in PostgreSQL and verifying visibility…</p>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${
            result.overall === "passed"
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}>
            {result.overall === "passed"
              ? <CheckCircle2 className="h-5 w-5 shrink-0" />
              : <XCircle className="h-5 w-5 shrink-0" />}
            <span className="font-semibold text-sm">
              {result.overall === "passed"
                ? "All record types passed — save and find is working correctly."
                : "One or more record types failed — see details below."}
            </span>
          </div>

          <div className="space-y-3">
            {result.results.map((r, i) => (
              <Card key={i} className={r.status === "failed" ? "border-red-200" : "border-green-200"}>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {r.status === "passed"
                        ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                        : <XCircle className="h-4 w-4 text-red-500 shrink-0" />}
                      <span className="font-semibold text-sm">{r.recordType}</span>
                      <Badge className={r.status === "passed"
                        ? "bg-green-100 text-green-800 text-xs"
                        : "bg-red-100 text-red-800 text-xs"}>
                        {r.status === "passed" ? "PASSED" : "FAILED"}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground space-x-2">
                      <span>Record&nbsp;ID:&nbsp;<code className="font-mono bg-gray-100 px-1 rounded">{r.id}</code></span>
                      <span>Client&nbsp;ID:&nbsp;<code className="font-mono bg-gray-100 px-1 rounded">{r.clientId}</code></span>
                    </div>
                  </div>

                  {r.failureReason && (
                    <p className="text-xs text-red-600 mb-3 bg-red-50 rounded px-2 py-1">
                      Error: {r.failureReason}
                    </p>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {r.screens.map((s, j) => (
                      <div key={j} className={`flex items-center gap-2 rounded px-2 py-1 text-xs ${
                        s.found ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                      }`}>
                        {s.found
                          ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                          : <XCircle className="h-3.5 w-3.5 shrink-0" />}
                        {s.screen}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Scan History Section ────────────────────────────────────────────────────────
function ScanHistorySection() {
  const { data: scans = [], isLoading, refetch, isFetching } = useQuery<IntegrityScan[]>({
    queryKey: ["/api/admin/data-integrity/scan-history"],
    refetchInterval: 30_000,
  });

  const lastOrphan = scans.find(s => s.orphanCount >= 0);
  const lastDuplicate = scans.find(s => s.duplicateGroupCount >= 0);

  return (
    <div className="space-y-4">
      {/* Last scan summary */}
      {(lastOrphan || lastDuplicate) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {lastOrphan && (
            <div className="flex items-center gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3">
              <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-orange-700 font-medium">Last Orphan Scan</p>
                <p className="text-sm font-bold text-orange-900">
                  {lastOrphan.orphanCount === 0 ? "No orphans found" : `${lastOrphan.orphanCount} orphan(s) found`}
                </p>
                <p className="text-xs text-orange-600">
                  {format(new Date(lastOrphan.scannedAt), "d MMM yyyy, HH:mm")} · by {lastOrphan.triggeredBy}
                </p>
              </div>
            </div>
          )}
          {lastDuplicate && (
            <div className="flex items-center gap-3 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3">
              <Copy className="h-5 w-5 text-yellow-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-yellow-700 font-medium">Last Duplicate Scan</p>
                <p className="text-sm font-bold text-yellow-900">
                  {lastDuplicate.duplicateGroupCount === 0 ? "No duplicates found" : `${lastDuplicate.duplicateGroupCount} duplicate group(s) found`}
                </p>
                <p className="text-xs text-yellow-600">
                  {format(new Date(lastDuplicate.scannedAt), "d MMM yyyy, HH:mm")} · by {lastDuplicate.triggeredBy}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Full history list */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Scan History</CardTitle>
              <CardDescription className="text-xs">Last 10 scans</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              {isFetching
                ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full rounded" />)}
            </div>
          ) : scans.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
              <History className="h-8 w-8 text-gray-300" />
              <p className="text-sm">No scans recorded yet. Run an orphan or duplicate scan to start tracking history.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Timestamp</TableHead>
                  <TableHead className="text-xs">Scan Type</TableHead>
                  <TableHead className="text-xs">Result</TableHead>
                  <TableHead className="text-xs">Triggered By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scans.map(s => {
                  const isOrphanScan = s.orphanCount >= 0;
                  const isDupScan = s.duplicateGroupCount >= 0;
                  const count = isOrphanScan ? s.orphanCount : s.duplicateGroupCount;
                  const hasIssues = count > 0;
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(s.scannedAt), "d MMM yyyy, HH:mm:ss")}
                      </TableCell>
                      <TableCell>
                        {isOrphanScan ? (
                          <Badge className="bg-orange-100 text-orange-800 text-xs">Orphan Scan</Badge>
                        ) : (
                          <Badge className="bg-yellow-100 text-yellow-800 text-xs">Duplicate Scan</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {hasIssues ? (
                          <span className="flex items-center gap-1 text-xs text-red-700">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            {count} issue(s) found
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-green-700">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Clean
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{s.triggeredBy}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function DataIntegrity() {
  const { data: orphanData } = useQuery<OrphansResponse>({
    queryKey: ["/api/admin/data-integrity/orphans"],
  });
  const { data: dupData } = useQuery<DuplicatesResponse>({
    queryKey: ["/api/admin/data-integrity/duplicates"],
  });

  const orphanCount = orphanData?.orphans.length ?? 0;
  const dupCount = dupData?.groups.length ?? 0;

  return (
        <div className="p-6">
          <div className="space-y-6 max-w-5xl">
            <div className="flex items-center gap-3">
              <Database className="h-6 w-6 text-green-600" />
              <div>
                <h1 className="text-2xl font-bold">Data Integrity</h1>
                <p className="text-sm text-muted-foreground">
                  PostgreSQL database health, orphan detection, duplicate scanning, and backup export.
                </p>
              </div>
            </div>

            {/* Database Status — always visible at the top */}
            <DatabaseStatusSection />

            {/* TEMPORARY — remove once production schema is confirmed in sync */}
            <DbPushSection />

            {/* Normalize lead statuses — run once on production to fix hidden/missing leads */}
            <NormalizeStatusSection />

            <Tabs defaultValue="health-check" className="space-y-4">
              <TabsList className="flex-wrap h-auto gap-1">
                <TabsTrigger value="health-check" className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Health Check
                </TabsTrigger>
                <TabsTrigger value="orphans" className="flex items-center gap-1.5">
                  Orphan Records
                  {orphanCount > 0 && (
                    <Badge className="h-4 px-1.5 text-xs bg-orange-500 text-white">{orphanCount}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="duplicates" className="flex items-center gap-1.5">
                  Duplicate Clients
                  {dupCount > 0 && (
                    <Badge className="h-4 px-1.5 text-xs bg-yellow-500 text-white">{dupCount}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="sources">Data Source Check</TabsTrigger>
                <TabsTrigger value="backup" className="flex items-center gap-1.5">
                  <Download className="h-3.5 w-3.5" />
                  Backup
                </TabsTrigger>
                <TabsTrigger value="save-search-test" className="flex items-center gap-1.5">
                  <FlaskConical className="h-3.5 w-3.5" />
                  Save/Search Test
                </TabsTrigger>
              </TabsList>

              <TabsContent value="health-check">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-blue-600" />
                      Database Health Check
                    </CardTitle>
                    <CardDescription>
                      10-point check: connection, table access, record counts, orphan detection, required columns, and schema integrity.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <HealthCheckTab />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="orphans">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Orphan Records</CardTitle>
                    <CardDescription>
                      Jobs, invoices, contracts, quotes, and service contracts that reference a client ID that does not exist.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <OrphansTab />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="duplicates">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Duplicate Clients</CardTitle>
                    <CardDescription>
                      Client records that appear to be the same based on phone, email, or name.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <DuplicatesTab />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="sources">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Data Source Check</CardTitle>
                    <CardDescription>
                      Live record counts for each module — all backed by PostgreSQL.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <DataSourcesTab />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="backup">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Backup Export</CardTitle>
                    <CardDescription>
                      Download a full or lightweight export from PostgreSQL. A summary shows counts at the time of export.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <BackupTab />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="save-search-test">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FlaskConical className="h-4 w-4 text-indigo-600" />
                      Save / Search / Restart Readiness Test
                    </CardTitle>
                    <CardDescription>
                      Proves that records saved to PostgreSQL can be found on every screen that should show them.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <SaveSearchTestTab />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Scan history — visible at the bottom of the page */}
            <ScanHistorySection />
          </div>
        </div>
  );
}
