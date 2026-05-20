import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import MobileNavigation from "@/components/layout/mobile-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient as useQC } from "@tanstack/react-query";
import {
  Download,
  Upload,
  CheckCircle,
  AlertTriangle,
  Clock,
  ShieldCheck,
  RefreshCw,
  FileJson,
  FileSpreadsheet,
  Cloud,
  Info,
  ChevronDown,
  ChevronUp,
  Mail,
  Send,
  TestTube2,
  MessageCircle,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const TODAY = new Date().toISOString().split("T")[0];

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDatetime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-ZA", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

function nextScheduledBackup(): string {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(21, 30, 0, 0);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  return next.toLocaleString("en-ZA", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
    timeZoneName: "short",
  });
}

type BackupType = "email-auto" | "email-manual" | "email-test";

interface BackupLog {
  id: string;
  datetime: string;
  backupType: BackupType;
  fileNames: string[];
  fileSizesBytes: number[];
  destination: string;
  status: "success" | "failed";
  errorMessage?: string;
  recipientEmail?: string;
}

interface EmailConfigResponse {
  recipient: string;
  sender: string;
  sendgridConfigured: boolean;
}

const TYPE_LABEL: Record<BackupType, string> = {
  "email-auto": "Email Auto",
  "email-manual": "Email Manual",
  "email-test": "Email Test",
};

export default function BackupPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isDownloadingJson, setIsDownloadingJson] = useState(false);
  const [isDownloadingExcel, setIsDownloadingExcel] = useState(false);
  const [restoreResult, setRestoreResult] = useState<{ success: boolean; message: string } | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showLogs, setShowLogs] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { isDemoMode } = useAuth();
  const queryClient = useQueryClient();

  const { data: emailConfig } = useQuery<EmailConfigResponse>({
    queryKey: ["/api/backup/email-config"],
  });

  const { data: backupLogs = [], refetch: refetchLogs } = useQuery<BackupLog[]>({
    queryKey: ["/api/backup/logs"],
    refetchInterval: 30_000,
  });

  const emailLogs = backupLogs.filter((l) => l.backupType.startsWith("email"));
  const lastEmailSuccess = emailLogs.find((l) => l.status === "success");
  const lastEmailFailed = emailLogs.find((l) => l.status === "failed");

  const emailSendMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/backup/email-send"),
    onSuccess: async (res: any) => {
      const json = await res.json().catch(() => ({}));
      toast({
        title: "Backup email sent",
        description: `Sent to ${json?.result?.recipient ?? emailConfig?.recipient ?? "recipient"}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/backup/logs"] });
    },
    onError: (e: any) => {
      toast({ title: "Backup email failed", description: e.message, variant: "destructive" });
      queryClient.invalidateQueries({ queryKey: ["/api/backup/logs"] });
    },
  });

  const whatsappTestMutation = useMutation<{ success: boolean; recipient: string; message: string; messageId?: string }, Error, void>({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/backup/whatsapp-test");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "WhatsApp test sent", description: `Sent to ${data.recipient}.` });
    },
    onError: (e: any) => {
      toast({ title: "WhatsApp test failed", description: e?.message ?? "Send failed", variant: "destructive" });
    },
  });

  const handleSendWhatsAppTest = () => {
    if (isDemoMode) {
      toast({ title: "Demo Mode", description: "This action is disabled in Demo Mode.", variant: "destructive" });
      return;
    }
    whatsappTestMutation.mutate();
  };

  const smtpTestMutation = useMutation<{ success: boolean; recipient: string; message: string }, Error, void>({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/backup/smtp-test");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "SMTP test sent", description: `Sent to ${data.recipient}.` });
    },
    onError: (e: any) => {
      toast({ title: "SMTP test failed", description: e?.message ?? "Send failed", variant: "destructive" });
    },
  });

  const handleSendSmtpTest = () => {
    if (isDemoMode) {
      toast({ title: "Demo Mode", description: "This action is disabled in Demo Mode.", variant: "destructive" });
      return;
    }
    smtpTestMutation.mutate();
  };

  const emailTestMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/backup/email-test"),
    onSuccess: async (res: any) => {
      const json = await res.json().catch(() => ({}));
      toast({
        title: "Test email sent",
        description: `Sent to ${json?.result?.recipient ?? emailConfig?.recipient ?? "recipient"}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/backup/logs"] });
    },
    onError: (e: any) => {
      toast({ title: "Test email failed", description: e.message, variant: "destructive" });
      queryClient.invalidateQueries({ queryKey: ["/api/backup/logs"] });
    },
  });

  const handleSendBackupEmail = () => {
    if (isDemoMode) {
      toast({ title: "Demo Mode", description: "This action is disabled in Demo Mode.", variant: "destructive" });
      return;
    }
    emailSendMutation.mutate();
  };

  const handleSendTestEmail = () => {
    if (isDemoMode) {
      toast({ title: "Demo Mode", description: "This action is disabled in Demo Mode.", variant: "destructive" });
      return;
    }
    emailTestMutation.mutate();
  };

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadJson = async () => {
    setIsDownloadingJson(true);
    try {
      const response = await fetch("/api/backup/export");
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      triggerDownload(blob, `job-flow-restore-backup-${TODAY}.json`);
      toast({ title: "Restore backup downloaded", description: `Saved as job-flow-restore-backup-${TODAY}.json` });
    } catch {
      toast({ title: "Download failed", description: "Could not export the backup.", variant: "destructive" });
    } finally {
      setIsDownloadingJson(false);
    }
  };

  const handleDownloadExcel = async () => {
    setIsDownloadingExcel(true);
    try {
      const response = await fetch("/api/backup/export-excel");
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      triggerDownload(blob, `job-flow-excel-backup-${TODAY}.xlsx`);
      toast({ title: "Excel backup downloaded", description: `Saved as job-flow-excel-backup-${TODAY}.xlsx` });
    } catch {
      toast({ title: "Download failed", description: "Could not export the Excel backup.", variant: "destructive" });
    } finally {
      setIsDownloadingExcel(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".json")) {
      toast({ title: "Invalid file", description: "Please select a .json backup file.", variant: "destructive" });
      return;
    }
    setPendingFile(file);
    setConfirmRestore(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRestore = async () => {
    if (!pendingFile) return;
    setIsRestoring(true);
    setRestoreResult(null);
    setConfirmRestore(false);
    try {
      const text = await pendingFile.text();
      const data = JSON.parse(text);
      const res = await apiRequest("POST", "/api/backup/restore", data);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Restore failed");
      setRestoreResult({ success: true, message: "Database restored successfully. All data has been replaced with the backup." });
      queryClient.invalidateQueries();
      toast({ title: "Restore complete", description: "Your database has been restored from the backup file." });
    } catch (err: any) {
      setRestoreResult({ success: false, message: err.message ?? "Failed to restore backup." });
      toast({ title: "Restore failed", description: err.message ?? "Could not restore the backup.", variant: "destructive" });
    } finally {
      setIsRestoring(false);
      setPendingFile(null);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Backup & Restore" onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />
        <MobileNavigation isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

        <main className="flex-1 overflow-y-auto p-6 pb-20 lg:pb-6">
          <div className="max-w-3xl mx-auto space-y-6">

            <div>
              <h1 className="text-3xl font-bold tracking-tight">Backup & Restore</h1>
              <p className="text-muted-foreground mt-1">
                Download, email, or restore your data.
              </p>
            </div>

            {/* Info banner */}
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="flex items-start gap-3 pt-5">
                <ShieldCheck className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                <div className="text-sm text-blue-800 space-y-1">
                  <p className="font-semibold">Two backup types</p>
                  <p>
                    The <strong>Restore Backup</strong> (.json) captures all data for a full system restore.
                    The <strong>Excel Backup</strong> (.xlsx) creates a workbook you can open in Excel or Google Sheets.
                    Both are emailed automatically each night.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* ── Email Backup ──────────────────────────────────────────────── */}
            <Card className={emailConfig?.sendgridConfigured ? "border-blue-200" : "border-amber-200"}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${emailConfig?.sendgridConfigured ? "bg-blue-100" : "bg-amber-100"}`}>
                    <Mail className={`h-5 w-5 ${emailConfig?.sendgridConfigured ? "text-blue-600" : "text-amber-600"}`} />
                  </div>
                  <div>
                    <CardTitle>Daily Backup Email</CardTitle>
                    <CardDescription>
                      {emailConfig?.sendgridConfigured
                        ? <>Sends JSON + Excel attachments to <strong>{emailConfig.recipient}</strong> every night at 23:30 SAST</>
                        : "SendGrid not configured — set SENDGRID_API_KEY to enable email backups"}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">

                {/* Status row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <CheckCircle className="h-3.5 w-3.5 text-green-500" /> Last successful email
                    </p>
                    {lastEmailSuccess ? (
                      <p className="text-sm font-medium">{formatDatetime(lastEmailSuccess.datetime)}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No successful emails yet</p>
                    )}
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Last failed email
                    </p>
                    {lastEmailFailed ? (
                      <p className="text-sm font-medium text-red-600">{formatDatetime(lastEmailFailed.datetime)}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No failures</p>
                    )}
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-blue-500" /> Next scheduled email
                    </p>
                    <p className="text-sm font-medium">{nextScheduledBackup()}</p>
                  </div>
                </div>

                {!emailConfig?.sendgridConfigured && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 space-y-1">
                    <p className="font-semibold flex items-center gap-2">
                      <Info className="h-4 w-4" /> SendGrid not configured
                    </p>
                    <p>Set the <code className="bg-amber-100 px-1 rounded">SENDGRID_API_KEY</code> environment variable. Optionally set <code className="bg-amber-100 px-1 rounded">BACKUP_EMAIL_FROM</code> and <code className="bg-amber-100 px-1 rounded">BACKUP_EMAIL_RECIPIENT</code> to override defaults. Manual buttons will simulate-send (no real email) until configured.</p>
                  </div>
                )}

                {isDemoMode && (
                  <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                    <Info className="h-4 w-4 shrink-0" />
                    This action is disabled in Demo Mode.
                  </div>
                )}

                {/* Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Button
                    onClick={handleSendBackupEmail}
                    disabled={isDemoMode || emailSendMutation.isPending}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    {emailSendMutation.isPending
                      ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Sending backup email…</>
                      : <><Send className="mr-2 h-4 w-4" />Send Backup Email Now</>}
                  </Button>
                  <Button
                    onClick={handleSendTestEmail}
                    disabled={isDemoMode || emailTestMutation.isPending}
                    variant="outline"
                    className="w-full border-blue-300 hover:bg-blue-50"
                  >
                    {emailTestMutation.isPending
                      ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Sending test email…</>
                      : <><TestTube2 className="mr-2 h-4 w-4" />Send Test Backup Email</>}
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground">
                  Both buttons always send to <strong>{emailConfig?.recipient ?? "info@terminators.co.za"}</strong>.
                  The test email is identical to the daily email but clearly labelled as a TEST.
                </p>

                <div className="pt-3 mt-3 border-t border-dashed">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Brevo SMTP connection test</p>
                  <Button
                    onClick={handleSendSmtpTest}
                    disabled={isDemoMode || smtpTestMutation.isPending}
                    variant="outline"
                    className="w-full border-purple-300 hover:bg-purple-50"
                  >
                    {smtpTestMutation.isPending
                      ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Sending SMTP test…</>
                      : <><Send className="mr-2 h-4 w-4" />Send Test Backup Email (Brevo SMTP)</>}
                  </Button>
                  {smtpTestMutation.data && (
                    <div className={`mt-2 rounded-lg p-3 flex items-start gap-2 text-sm ${smtpTestMutation.data.success ? "bg-green-50 border border-green-200 text-green-800" : "bg-red-50 border border-red-200 text-red-800"}`}>
                      {smtpTestMutation.data.success
                        ? <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
                        : <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />}
                      <p>{smtpTestMutation.data.message}</p>
                    </div>
                  )}
                  {smtpTestMutation.isError && (
                    <div className="mt-2 rounded-lg p-3 flex items-start gap-2 text-sm bg-red-50 border border-red-200 text-red-800">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <p>{(smtpTestMutation.error as any)?.message ?? "SMTP test failed"}</p>
                    </div>
                  )}
                </div>

                <div className="pt-3 mt-3 border-t border-dashed">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">WhatsApp backup test</p>
                  <Button
                    onClick={handleSendWhatsAppTest}
                    disabled={isDemoMode || whatsappTestMutation.isPending}
                    variant="outline"
                    className="w-full border-green-400 hover:bg-green-50"
                  >
                    {whatsappTestMutation.isPending
                      ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Sending WhatsApp test…</>
                      : <><MessageCircle className="mr-2 h-4 w-4" />Send Test WhatsApp Backup</>}
                  </Button>
                  {whatsappTestMutation.data && (
                    <div className={`mt-2 rounded-lg p-3 flex items-start gap-2 text-sm ${whatsappTestMutation.data.success ? "bg-green-50 border border-green-200 text-green-800" : "bg-red-50 border border-red-200 text-red-800"}`}>
                      {whatsappTestMutation.data.success
                        ? <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
                        : <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />}
                      <p>{whatsappTestMutation.data.message}</p>
                    </div>
                  )}
                  {whatsappTestMutation.isError && (
                    <div className="mt-2 rounded-lg p-3 flex items-start gap-2 text-sm bg-red-50 border border-red-200 text-red-800">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <p>{(whatsappTestMutation.error as any)?.message ?? "WhatsApp test failed"}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* ── JSON Restore Backup ───────────────────────────────────────── */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-100">
                    <FileJson className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <CardTitle>Download Restore Backup</CardTitle>
                    <CardDescription>
                      Exports a <code>.json</code> file — use this for full system restore.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {[
                    "Clients & Contacts", "Jobs & Scheduling",
                    "Staff & Departments", "Invoices & Contracts",
                    "Suppliers & Purchase Orders", "Stock & Inventory",
                    "Calendar Events", "Email Templates & Logs",
                  ].map(item => (
                    <div key={item} className="flex items-center gap-2 text-muted-foreground">
                      <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                      {item}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground italic">
                  File name: <code>job-flow-restore-backup-{TODAY}.json</code>
                </p>
                <Button
                  onClick={handleDownloadJson}
                  disabled={isDownloadingJson}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  {isDownloadingJson
                    ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Preparing backup...</>
                    : <><Download className="mr-2 h-4 w-4" />Download Restore Backup</>}
                </Button>
              </CardContent>
            </Card>

            {/* ── Excel Backup ──────────────────────────────────────────────── */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-100">
                    <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <CardTitle>Download Excel Backup</CardTitle>
                    <CardDescription>
                      Exports an <code>.xlsx</code> workbook — open and review business records in Excel.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {[
                    "Clients", "Jobs",
                    "Quotes", "Invoices",
                    "Rental Contracts", "Stock",
                    "Staff", "Teams & Attendance",
                    "Vehicles", "Fuel Fill-ups",
                    "Vehicle Inspections", "Maintenance",
                    "Reported Issues", "Purchase Orders",
                    "Suppliers", "Attendance Members",
                  ].map(item => (
                    <div key={item} className="flex items-center gap-2 text-muted-foreground">
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      {item}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground italic">
                  File name: <code>job-flow-excel-backup-{TODAY}.xlsx</code>
                </p>
                <Button
                  onClick={handleDownloadExcel}
                  disabled={isDownloadingExcel}
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                >
                  {isDownloadingExcel
                    ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Generating Excel file...</>
                    : <><FileSpreadsheet className="mr-2 h-4 w-4" />Download Excel Backup</>}
                </Button>
              </CardContent>
            </Card>

            {/* ── Restore ───────────────────────────────────────────────────── */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-100">
                    <Upload className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <CardTitle>Restore from Backup</CardTitle>
                    <CardDescription>Replace the current database with a previously downloaded <code>.json</code> restore backup</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <p><strong>Warning:</strong> Restoring replaces ALL current data with the contents of the backup file. This cannot be undone — download a fresh backup first if you want to preserve your current data.</p>
                </div>
                <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileSelect} className="hidden" />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isRestoring}
                  className="w-full border-amber-300 hover:bg-amber-50"
                >
                  {isRestoring
                    ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Restoring database...</>
                    : <><Upload className="mr-2 h-4 w-4" />Select Backup File to Restore</>}
                </Button>

                {restoreResult && (
                  <div className={`rounded-lg p-4 flex items-start gap-3 text-sm ${restoreResult.success ? "bg-green-50 border border-green-200 text-green-800" : "bg-red-50 border border-red-200 text-red-800"}`}>
                    {restoreResult.success
                      ? <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      : <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />}
                    <p>{restoreResult.message}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Backup Logs ───────────────────────────────────────────────── */}
            <Card>
              <CardHeader
                className="pb-3 cursor-pointer select-none"
                onClick={() => setShowLogs(p => !p)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-slate-100">
                      <Clock className="h-5 w-5 text-slate-600" />
                    </div>
                    <div>
                      <CardTitle>Backup Logs</CardTitle>
                      <CardDescription>
                        {backupLogs.length === 0
                          ? "No backup attempts yet"
                          : `${backupLogs.length} record${backupLogs.length !== 1 ? "s" : ""}`}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={(e) => { e.stopPropagation(); refetchLogs(); }}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                    {showLogs ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </div>
              </CardHeader>
              {showLogs && (
                <CardContent className="p-0">
                  {backupLogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2 text-sm">
                      <Cloud className="h-8 w-8 text-muted-foreground/30" />
                      <p>No backup logs yet. Run a manual backup or wait for the nightly schedule.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead className="text-xs font-semibold">Date &amp; Time</TableHead>
                            <TableHead className="text-xs font-semibold">Type</TableHead>
                            <TableHead className="text-xs font-semibold">Status</TableHead>
                            <TableHead className="text-xs font-semibold">Files</TableHead>
                            <TableHead className="text-xs font-semibold">Sizes</TableHead>
                            <TableHead className="text-xs font-semibold">Destination / Recipient</TableHead>
                            <TableHead className="text-xs font-semibold">Error</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {backupLogs.map((log) => (
                            <TableRow key={log.id} className="hover:bg-muted/20">
                              <TableCell className="text-xs whitespace-nowrap">{formatDatetime(log.datetime)}</TableCell>
                              <TableCell className="text-xs">
                                <Badge
                                  variant="outline"
                                  className={`text-xs font-normal ${log.backupType.startsWith("email") ? "border-blue-300 text-blue-700 bg-blue-50" : ""}`}
                                >
                                  {TYPE_LABEL[log.backupType] ?? log.backupType}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {log.status === "success" ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
                                    <CheckCircle className="h-3.5 w-3.5" /> Success
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
                                    <AlertTriangle className="h-3.5 w-3.5" /> Failed
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-xs">
                                {log.fileNames.length > 0 ? (
                                  <div className="space-y-0.5">
                                    {log.fileNames.map((fn) => (
                                      <div key={fn} className="font-mono text-xs text-muted-foreground truncate max-w-[180px]">{fn}</div>
                                    ))}
                                  </div>
                                ) : <span className="text-muted-foreground">—</span>}
                              </TableCell>
                              <TableCell className="text-xs whitespace-nowrap">
                                {log.fileSizesBytes.length > 0 ? (
                                  <div className="space-y-0.5">
                                    {log.fileSizesBytes.map((sz, i) => (
                                      <div key={i}>{formatBytes(sz)}</div>
                                    ))}
                                  </div>
                                ) : <span className="text-muted-foreground">—</span>}
                              </TableCell>
                              <TableCell className="text-xs font-mono text-muted-foreground truncate max-w-[200px]">
                                {log.recipientEmail ?? log.destination ?? "—"}
                              </TableCell>
                              <TableCell className="text-xs text-red-600 max-w-[200px]">
                                {log.errorMessage ? (
                                  <span title={log.errorMessage} className="truncate block">{log.errorMessage}</span>
                                ) : <span className="text-muted-foreground">—</span>}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>

            {/* Tips */}
            <Card className="border-gray-200">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Backup tips
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>• Download a <strong>Restore Backup</strong> before making large changes — it can be used to undo everything.</p>
                <p>• Use the <strong>Excel Backup</strong> to share records with staff, do admin checks, or print reports.</p>
                <p>• Backup emails are sent automatically at <strong>23:30 South Africa time</strong> every night.</p>
                <p>• Retention policy: daily backups kept for <strong>30 days</strong>; month-end backups kept for <strong>12 months</strong>.</p>
                <p>• Keep backups in a secure location — they contain all client and financial data.</p>
                <p>• Because data is stored in memory, a server restart clears all changes — back up regularly.</p>
              </CardContent>
            </Card>

          </div>
        </main>
      </div>

      <AlertDialog open={confirmRestore} onOpenChange={setConfirmRestore}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore database from backup?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace ALL current data with the contents of <strong>{pendingFile?.name}</strong>. Your existing data will be permanently overwritten. Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingFile(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestore} className="bg-amber-600 hover:bg-amber-700">
              Yes, restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
