import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import MobileNavigation from "@/components/layout/mobile-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";
import {
  Download,
  Upload,
  Database,
  CheckCircle,
  AlertTriangle,
  Clock,
  ShieldCheck,
  RefreshCw,
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

export default function BackupPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [restoreResult, setRestoreResult] = useState<{ success: boolean; message: string } | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleDownloadBackup = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch("/api/backup/export", {
        headers: { Authorization: `Bearer ${localStorage.getItem("authToken") ?? ""}` },
      });
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const filename = `terminators-backup-${new Date().toISOString().split("T")[0]}.json`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Backup downloaded", description: `Saved as ${filename}` });
    } catch {
      toast({ title: "Download failed", description: "Could not export the backup.", variant: "destructive" });
    } finally {
      setIsDownloading(false);
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
        <Header
          title="Backup & Restore"
          onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        />
        <MobileNavigation
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
        />

        <main className="flex-1 overflow-y-auto p-6 pb-20 lg:pb-6">
          <div className="max-w-3xl mx-auto space-y-6">

            <div>
              <h1 className="text-3xl font-bold tracking-tight">Backup & Restore</h1>
              <p className="text-muted-foreground mt-1">
                Download a full snapshot of your data or restore from a previous backup file.
              </p>
            </div>

            {/* Info banner */}
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="flex items-start gap-3 pt-5">
                <ShieldCheck className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                <div className="text-sm text-blue-800 space-y-1">
                  <p className="font-semibold">How backups work</p>
                  <p>The backup captures all your current data — clients, jobs, staff, invoices, suppliers, stock, calendar events, and more — as a single <code>.json</code> file. Store it securely and use it to restore your system at any time.</p>
                </div>
              </CardContent>
            </Card>

            {/* Backup */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-100">
                    <Download className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <CardTitle>Download Backup</CardTitle>
                    <CardDescription>Export the entire database to a JSON file</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    "Clients & Contacts",
                    "Jobs & Scheduling",
                    "Staff & Departments",
                    "Invoices & Contracts",
                    "Suppliers & Purchase Orders",
                    "Stock & Inventory",
                    "Calendar Events",
                    "Email Templates & Logs",
                  ].map(item => (
                    <div key={item} className="flex items-center gap-2 text-muted-foreground">
                      <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                      {item}
                    </div>
                  ))}
                </div>
                <Button
                  onClick={handleDownloadBackup}
                  disabled={isDownloading}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  {isDownloading ? (
                    <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Preparing backup...</>
                  ) : (
                    <><Download className="mr-2 h-4 w-4" />Download Backup Now</>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Restore */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-100">
                    <Upload className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <CardTitle>Restore from Backup</CardTitle>
                    <CardDescription>Replace the current database with a previously downloaded backup file</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <p><strong>Warning:</strong> Restoring replaces ALL current data with the contents of the backup file. This cannot be undone — download a fresh backup first if you want to preserve your current data.</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isRestoring}
                  className="w-full border-amber-300 hover:bg-amber-50"
                >
                  {isRestoring ? (
                    <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Restoring database...</>
                  ) : (
                    <><Upload className="mr-2 h-4 w-4" />Select Backup File to Restore</>
                  )}
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

            {/* Tips */}
            <Card className="border-gray-200">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Backup tips
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>• Download a backup before making large changes such as bulk imports or data cleanup.</p>
                <p>• Keep backups in a secure location — they contain all client and financial data.</p>
                <p>• The backup file is named with today's date for easy versioning (e.g. <code>terminators-backup-2025-08-29.json</code>).</p>
                <p>• Because data is stored in memory, a server restart clears all changes — back up regularly.</p>
              </CardContent>
            </Card>

          </div>
        </main>
      </div>

      {/* Confirm restore dialog */}
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
