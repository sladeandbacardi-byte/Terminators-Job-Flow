import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import MobileNavigation from "@/components/layout/mobile-nav";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertTriangle, CheckCircle2, Copy, Database, Download,
  RefreshCw, ExternalLink, CalendarClock, FlaskConical,
  XCircle, Loader2,
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

const BACKUP_LABELS: Record<string, string> = {
  clients:          "Clients",
  jobs:             "Jobs",
  rentalContracts:  "Rental Contracts",
  serviceContracts: "Service Contracts",
  invoices:         "Invoices",
  quotes:           "Quotes / Leads",
  workers:          "Staff",
};

// ── Helpers ────────────────────────────────────────────────────────────────────
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

function LoadingRows() {
  return (
    <div className="space-y-3 pt-2">
      {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
    </div>
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
  const { data, isLoading, refetch } = useQuery<DuplicatesResponse>({
    queryKey: ["/api/admin/data-integrity/duplicates"],
  });

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
                <div className="flex items-center gap-2">
                  <Badge className={FIELD_COLORS[g.field]}>
                    {FIELD_LABELS[g.field]}
                  </Badge>
                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground font-mono">{g.value}</span>
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
          Live record counts for every data module — confirms data is loading and accessible.
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
              <TableHead>Data Source / Table</TableHead>
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
                    OK
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

      // After JSON export, record summary
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
      <p className="text-sm text-muted-foreground">
        Export a point-in-time snapshot of the system data. Store it somewhere safe — you can restore from the JSON backup via the Backup & Restore page.
      </p>

      {/* Scheduled backup status */}
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

      {/* Current data summary */}
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

      {/* Last export summary */}
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
            Creates one record of each type for a temporary test client, then checks that
            every record can be found in the list screens a real user would navigate to.
            All test data is deleted automatically when the test finishes.
          </p>
          <p className="text-xs text-orange-600 font-medium">
            Note: this app stores data in memory. Data is lost on server restart — records saved before a restart will not survive it.
          </p>
        </div>
        <Button
          onClick={runTest}
          disabled={running}
          className="shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          {running
            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Running…</>
            : <><FlaskConical className="h-4 w-4 mr-2" />Run Save/Search Test</>}
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
          <p className="text-sm">Creating records and verifying visibility…</p>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {/* Overall banner */}
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

          {/* Per-record cards */}
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
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header title="Data Integrity" />
        <main className="flex-1 overflow-auto p-6">
          <div className="space-y-6 max-w-5xl">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-orange-500" />
              <div>
                <h1 className="text-2xl font-bold">Data Integrity</h1>
                <p className="text-sm text-muted-foreground">
                  Scan for orphaned records, duplicate clients, and export a backup.
                </p>
              </div>
            </div>

            <Tabs defaultValue="orphans" className="space-y-4">
              <TabsList className="flex-wrap h-auto gap-1">
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
                      Client records that appear to be the same based on phone, email, or name. Use "View" to open the client profile.
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
                      Live record counts for each module mapped to its backing data source.
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
                      Download a full or lightweight export of your data. A summary shows counts at the time of export.
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
                      Save / Search Workflow Test
                    </CardTitle>
                    <CardDescription>
                      Proves that a record saved in any module can be found again on every screen that should show it.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <SaveSearchTestTab />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
      <MobileNavigation />
    </div>
  );
}
