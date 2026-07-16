import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
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
  Save,
  CalendarClock,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  alertEmailStatus?: "success" | "failed" | "skipped";
  alertEmailError?: string;
}

interface EmailConfigResponse {
  recipient: string;
  alertRecipient: string;
  alertRecipientOverridden: boolean;
  sender: string;
  provider: string;
  brevoConfigured: boolean;
  brevoDeliveryMethod?: "smtp" | "api" | "none";
  smtpConfigured?: boolean;
  sendgridConfigured: boolean;
  emailConfigured: boolean;
  maxAttachmentBytes: number;
}

interface BackupScheduleSettings {
  enabled: boolean;
  frequency: "daily" | "weekly";
  dayOfWeek: number;
  hourUTC: number;
  minuteUTC: number;
  recipientEmail: string;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function computeNextRun(schedule: BackupScheduleSettings): string {
  if (!schedule.enabled) return "Disabled";
  const now = new Date();
  const candidate = new Date(now);
  candidate.setUTCHours(schedule.hourUTC, schedule.minuteUTC, 0, 0);
  if (candidate <= now) candidate.setUTCDate(candidate.getUTCDate() + 1);

  if (schedule.frequency === "weekly") {
    while (candidate.getUTCDay() !== schedule.dayOfWeek) {
      candidate.setUTCDate(candidate.getUTCDate() + 1);
    }
  }

  return candidate.toLocaleString("en-ZA", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
    timeZoneName: "short",
  });
}

const TYPE_LABEL: Record<BackupType, string> = {
  "email-auto": "Email Auto",
  "email-manual": "Email Manual",
  "email-test": "Email Test",
};

export default function BackupPage() {
  const [isRestoring, setIsRestoring] = useState(false);
  const [isDownloadingJson, setIsDownloadingJson] = useState(false);
  const [isDownloadingExcel, setIsDownloadingExcel] = useState(false);
  const [restoreResult, setRestoreResult] = useState<{ success: boolean; message: string } | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showLogs, setShowLogs] = useState(true);
  const [scheduleForm, setScheduleForm] = useState<BackupScheduleSettings | null>(null);
  const [scheduleSaved, setScheduleSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { isDemoMode } = useAuth();
  const queryClient = useQueryClient();

  const { data: emailConfig } = useQuery<EmailConfigResponse>({
    queryKey: ["/api/backup/email-config"],
  });

  const { data: scheduleData } = useQuery<BackupScheduleSettings>({
    queryKey: ["/api/backup/schedule"],
  });

  useEffect(() => {
    if (scheduleData && !scheduleForm) setScheduleForm(scheduleData);
  }, [scheduleData]);

  const scheduleMutation = useMutation({
    mutationFn: (settings: BackupScheduleSettings) => apiRequest("POST", "/api/backup/schedule", settings),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/backup/schedule"] });
      setScheduleSaved(true);
      setTimeout(() => setScheduleSaved(false), 3000);
      toast({ title: "Schedule saved", description: "Backup schedule has been updated." });
    },
    onError: (e: any) => {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    },
  });

  const { data: backupLogs = [], refetch: refetchLogs } = useQuery<BackupLog[]>({
    queryKey: ["/api/backup/logs"],
    refetchInterval: 30_000,
  });

  const activeSchedule = scheduleForm ?? scheduleData;

  const emailLogs = backupLogs.filter((l) => l.backupType.startsWith("email"));
  const lastEmailSuccess = emailLogs.find((l) => l.status === "success");
  const lastEmailFailed = emailLogs.find((l) => l.status === "failed");

  const autoLogs = backupLogs.filter((l) => l.backupType === "email-auto");
  const lastAutoRun = autoLogs[0] ?? null;
  const lastAutoFailed =
    lastAutoRun?.status === "failed" ? lastAutoRun : null;

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
      <>
        <div className="p-6 pb-20 lg:pb-6">
          <div className="max-w-3xl mx-auto space-y-6">

            <div>
              <h1 className="text-3xl font-bold tracking-tight">Backup & Restore</h1>
              <p className="text-muted-foreground mt-1">
                Download, email, or restore your data.
              </p>
            </div>

            {/* Scheduled backup failure banner */}
            {lastAutoFailed && (
              <div className="rounded-lg border-2 border-red-300 bg-red-50 p-4 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-red-900">Last scheduled backup failed</p>
                  <p className="text-sm text-red-700 mt-0.5">
                    {formatDatetime(lastAutoFailed.datetime)}
                    {lastAutoFailed.recipientEmail ? ` — to ${lastAutoFailed.recipientEmail}` : ""}
                  </p>
                  {lastAutoFailed.errorMessage && (
                    <p className="text-sm text-red-800 mt-1 break-words">{lastAutoFailed.errorMessage}</p>
                  )}
                  {lastAutoFailed.alertEmailStatus === "failed" ? (
                    <div className="mt-2 rounded border border-orange-300 bg-orange-50 px-3 py-2">
                      <p className="text-xs font-semibold text-orange-800">⚠️ Alert email also failed to send</p>
                      {lastAutoFailed.alertEmailError && (
                        <p className="text-xs text-orange-700 mt-0.5 break-words">{lastAutoFailed.alertEmailError}</p>
                      )}
                      <p className="text-xs text-orange-700 mt-1">The admin at <strong>{emailConfig?.alertRecipient ?? emailConfig?.recipient ?? "the alert address"}</strong> was NOT notified. Check your email configuration and retry the backup manually.</p>
                    </div>
                  ) : lastAutoFailed.alertEmailStatus === "skipped" ? (
                    <p className="text-xs text-amber-700 mt-2">
                      Alert email could not be sent — no email provider is configured. Check environment secrets.
                    </p>
                  ) : lastAutoFailed.alertEmailStatus === "success" ? (
                    <p className="text-xs text-green-700 mt-2">
                      An alert email was sent to <strong>{emailConfig?.alertRecipient ?? emailConfig?.recipient ?? "the admin address"}</strong>. Use "Retry Backup Email" below to resend the backup.
                    </p>
                  ) : (
                    <p className="text-xs text-red-600 mt-2">
                      An alert email was automatically sent to <strong>{emailConfig?.alertRecipient ?? emailConfig?.recipient ?? "the admin address"}</strong>. Use "Retry Backup Email" below to resend the backup.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Info banner */}
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="flex items-start gap-3 pt-5">
                <ShieldCheck className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                <div className="text-sm text-blue-800 space-y-1">
                  <p className="font-semibold">Two backup types</p>
                  <p>
                    The <strong>Restore Backup</strong> (.json) captures all data for a full system restore.
                    The <strong>CSV Summary</strong> (.csv) covers clients, jobs, invoices and staff — open it in Excel or Google Sheets.
                    Both are emailed automatically on the configured schedule.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* ── Email Backup ──────────────────────────────────────────────── */}
            <Card className={emailConfig?.emailConfigured ? "border-blue-200" : "border-amber-200"}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${emailConfig?.emailConfigured ? "bg-blue-100" : "bg-amber-100"}`}>
                    <Mail className={`h-5 w-5 ${emailConfig?.emailConfigured ? "text-blue-600" : "text-amber-600"}`} />
                  </div>
                  <div>
                    <CardTitle>Daily Backup Email</CardTitle>
                    <CardDescription>
                      {emailConfig?.emailConfigured
                        ? <>Sends JSON + CSV attachments via <strong>{emailConfig.provider === "brevo" ? "Brevo" : emailConfig?.provider}</strong>
                            {emailConfig?.brevoDeliveryMethod === "smtp" ? " (SMTP relay)" : emailConfig?.brevoDeliveryMethod === "api" ? " (HTTP API)" : ""}
                            {" "}to <strong>{emailConfig.recipient}</strong></>
                        : `${emailConfig?.provider === "brevo" ? "Brevo" : "Email provider"} not configured — set ${emailConfig?.provider === "brevo" ? "BREVO_API_KEY" : "SENDGRID_API_KEY"} to enable email backups`}
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
                    <p className="text-sm font-medium">
                      {activeSchedule ? computeNextRun(activeSchedule) : nextScheduledBackup()}
                    </p>
                  </div>
                </div>

                {!emailConfig?.emailConfigured && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 space-y-1">
                    <p className="font-semibold flex items-center gap-2">
                      <Info className="h-4 w-4" /> Email provider not configured
                    </p>
                    <p>
                      Set <code className="bg-amber-100 px-1 rounded">EMAIL_PROVIDER=brevo</code> and{" "}
                      <code className="bg-amber-100 px-1 rounded">BREVO_API_KEY</code> in environment secrets.
                      Optionally set <code className="bg-amber-100 px-1 rounded">BACKUP_EMAIL_TO</code> and{" "}
                      <code className="bg-amber-100 px-1 rounded">BACKUP_EMAIL_FROM</code> to override defaults.
                      Set <code className="bg-amber-100 px-1 rounded">BACKUP_ALERT_EMAIL_TO</code> to send failure
                      alerts to a different address than the backup recipient.
                    </p>
                  </div>
                )}

                {lastEmailFailed?.errorMessage?.toLowerCase().includes("too large") && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <p>Backup files are too large to email. Please download manually or set up cloud backup.</p>
                  </div>
                )}

                {lastEmailFailed &&
                  (!lastEmailSuccess ||
                    new Date(lastEmailFailed.datetime) > new Date(lastEmailSuccess.datetime)) &&
                  !lastEmailFailed.errorMessage?.toLowerCase().includes("too large") && (
                    <div className="rounded-lg border-2 border-red-300 bg-red-50 p-4 space-y-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-semibold text-red-900">Last backup email failed</p>
                          <p className="text-xs text-red-700 mt-0.5">
                            {formatDatetime(lastEmailFailed.datetime)} — sent to{" "}
                            {lastEmailFailed.recipientEmail ?? emailConfig?.recipient ?? "recipient"}
                          </p>
                          {lastEmailFailed.errorMessage && (
                            <p className="text-sm text-red-800 mt-2 break-words">
                              {lastEmailFailed.errorMessage}
                            </p>
                          )}
                        </div>
                      </div>
                      <Button
                        onClick={handleSendBackupEmail}
                        disabled={isDemoMode || emailSendMutation.isPending}
                        size="sm"
                        className="bg-red-600 hover:bg-red-700"
                      >
                        {emailSendMutation.isPending
                          ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Retrying…</>
                          : <><RefreshCw className="mr-2 h-4 w-4" />Retry Backup Email</>}
                      </Button>
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

                <div className="text-xs text-muted-foreground space-y-1">
                  <p>
                    Both buttons always send to <strong>{emailConfig?.recipient ?? "info@terminators.co.za"}</strong>.
                    The test email is identical to the daily email but clearly labelled as a TEST.
                  </p>
                  <p className="flex items-center gap-1 flex-wrap">
                    <span>Failure alert emails go to:</span>
                    <strong>{emailConfig?.alertRecipient ?? emailConfig?.recipient ?? "info@terminators.co.za"}</strong>
                    {emailConfig?.alertRecipientOverridden ? (
                      <span className="text-violet-600">(set via <code className="bg-muted px-0.5 rounded">BACKUP_ALERT_EMAIL_TO</code>)</span>
                    ) : (
                      <span className="text-muted-foreground/70">(same as backup recipient — set <code className="bg-muted px-0.5 rounded">BACKUP_ALERT_EMAIL_TO</code> to use a different address)</span>
                    )}
                  </p>
                </div>

                {emailConfig?.emailConfigured && emailConfig?.brevoDeliveryMethod === "api" && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 space-y-1">
                    <p className="font-semibold flex items-center gap-2">
                      <Info className="h-4 w-4" /> Using Brevo HTTP API (BREVO_API_KEY)
                    </p>
                    <p>
                      JSON attachments may occasionally be restricted by Brevo. If backup emails fail, configure Brevo SMTP
                      relay by setting <code className="bg-amber-100 px-1 rounded">SMTP_HOST</code>,{" "}
                      <code className="bg-amber-100 px-1 rounded">SMTP_USER</code>, and{" "}
                      <code className="bg-amber-100 px-1 rounded">SMTP_PASS</code> for more reliable delivery.
                    </p>
                  </div>
                )}

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

              </CardContent>
            </Card>

            {/* ── Schedule Settings ─────────────────────────────────────────── */}
            <Card className="border-violet-200">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-violet-100">
                    <CalendarClock className="h-5 w-5 text-violet-600" />
                  </div>
                  <div>
                    <CardTitle>Backup Schedule</CardTitle>
                    <CardDescription>
                      Configure when automated backup emails are sent. The server will email
                      the backup at your chosen time each day or week.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {activeSchedule && (
                    <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/20">
                      <div>
                        <p className="text-sm font-medium">Enable scheduled backups</p>
                        <p className="text-xs text-muted-foreground">
                          {activeSchedule.enabled ? "Automated backups are active" : "Automated backups are paused"}
                        </p>
                      </div>
                      <Switch
                        checked={activeSchedule.enabled}
                        onCheckedChange={(val) =>
                          setScheduleForm((f) => f ? { ...f, enabled: val } : { ...scheduleData!, enabled: val })
                        }
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Frequency</Label>
                        <Select
                          value={activeSchedule.frequency}
                          onValueChange={(val) =>
                            setScheduleForm((f) => f ? { ...f, frequency: val as "daily" | "weekly" } : { ...scheduleData!, frequency: val as "daily" | "weekly" })
                          }
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {activeSchedule.frequency === "weekly" && (
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium">Day of week</Label>
                          <Select
                            value={String(activeSchedule.dayOfWeek)}
                            onValueChange={(val) =>
                              setScheduleForm((f) => f ? { ...f, dayOfWeek: Number(val) } : { ...scheduleData!, dayOfWeek: Number(val) })
                            }
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DAY_NAMES.map((d, i) => (
                                <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">
                          Time (UTC) — currently{" "}
                          <span className="font-semibold">
                            {String(activeSchedule.hourUTC).padStart(2, "0")}:{String(activeSchedule.minuteUTC).padStart(2, "0")} UTC
                          </span>
                          {" "}= {String((activeSchedule.hourUTC + 2) % 24).padStart(2, "0")}:{String(activeSchedule.minuteUTC).padStart(2, "0")} SAST
                        </Label>
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            min={0}
                            max={23}
                            value={activeSchedule.hourUTC}
                            onChange={(e) => {
                              const h = Math.max(0, Math.min(23, Number(e.target.value)));
                              setScheduleForm((f) => f ? { ...f, hourUTC: h } : { ...scheduleData!, hourUTC: h });
                            }}
                            className="h-9 w-20"
                            placeholder="HH"
                          />
                          <span className="self-center text-muted-foreground font-bold">:</span>
                          <Input
                            type="number"
                            min={0}
                            max={59}
                            value={activeSchedule.minuteUTC}
                            onChange={(e) => {
                              const m = Math.max(0, Math.min(59, Number(e.target.value)));
                              setScheduleForm((f) => f ? { ...f, minuteUTC: m } : { ...scheduleData!, minuteUTC: m });
                            }}
                            className="h-9 w-20"
                            placeholder="MM"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Recipient email</Label>
                        <Input
                          type="email"
                          value={activeSchedule.recipientEmail}
                          onChange={(e) =>
                            setScheduleForm((f) => f ? { ...f, recipientEmail: e.target.value } : { ...scheduleData!, recipientEmail: e.target.value })
                          }
                          className="h-9"
                          placeholder="admin@example.com"
                        />
                      </div>
                    </div>

                    <div className="rounded-lg border bg-violet-50 border-violet-200 px-3 py-2 text-sm text-violet-800 flex items-center gap-2">
                      <CalendarClock className="h-4 w-4 shrink-0" />
                      <span>Next run: <strong>{computeNextRun(activeSchedule)}</strong></span>
                    </div>

                    <Button
                      onClick={() => activeSchedule && scheduleMutation.mutate(activeSchedule)}
                      disabled={scheduleMutation.isPending}
                      className="w-full bg-violet-600 hover:bg-violet-700"
                    >
                      {scheduleMutation.isPending
                        ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Saving…</>
                        : scheduleSaved
                        ? <><CheckCircle className="mr-2 h-4 w-4" />Schedule saved!</>
                        : <><Save className="mr-2 h-4 w-4" />Save Schedule</>}
                    </Button>
                )}
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
                    "Contracts", "Contract Line Items",
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
                            <TableHead className="text-xs font-semibold">Alert Email</TableHead>
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
                              <TableCell>
                                {log.status !== "failed" ? (
                                  <span className="text-xs text-muted-foreground">—</span>
                                ) : log.alertEmailStatus === "success" ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
                                    <CheckCircle className="h-3.5 w-3.5" /> Sent
                                  </span>
                                ) : log.alertEmailStatus === "failed" ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-600" title={log.alertEmailError}>
                                    <AlertTriangle className="h-3.5 w-3.5" /> Also failed
                                  </span>
                                ) : log.alertEmailStatus === "skipped" ? (
                                  <span className="text-xs text-amber-600">Not configured</span>
                                ) : (
                                  <span className="text-xs text-muted-foreground italic">Unknown</span>
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
                <p>• Backup emails are sent automatically on the configured schedule — adjust it in the Backup Schedule card above.</p>
                <p>• Retention policy: daily backups kept for <strong>30 days</strong>; month-end backups kept for <strong>12 months</strong>.</p>
                <p>• Keep backups in a secure location — they contain all client and financial data.</p>
                <p>• Because data is stored in memory, a server restart clears all changes — back up regularly.</p>
              </CardContent>
            </Card>

          </div>
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
      </>
  );
}
