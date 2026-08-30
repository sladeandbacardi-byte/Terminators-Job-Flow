import { useEffect, useMemo, useState } from "react";
import { Clock3, History, LayoutDashboard, ListChecks, Play, Plus, RefreshCw, Square, Truck } from "lucide-react";
import { calculateAuthorisedTimeOffMinutes, calculateOvertimeBreakdown, formatNetTimeDifference, formatOvertimeMinutes } from "@shared/overtime";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MobileShell, type MobileNavItem } from "./mobile-shell";

type TimeEntry = {
  id: string;
  entryType: "OVERTIME" | "AUTHORISED_TIME_OFF";
  workDate: string;
  startTime: string;
  finishTime: string;
  overtimeMinutes: number;
  notes: string;
  timeOffReason?: string | null;
  timeOffOtherReason?: string | null;
  status: "pending" | "approved" | "rejected";
  clientName?: string;
  approvedByName?: string | null;
  rejectionReason?: string | null;
};
type Summary = {
  approvedOvertimeMinutes: number;
  approvedTimeOffMinutes: number;
  pendingOvertimeMinutes: number;
  pendingTimeOffMinutes: number;
  netMinutes: number;
};
type Attendance = {
  id: string;
  workDate: string;
  startTime: string;
  finishTime: string | null;
  totalMinutes: number | null;
  lateStartMinutes: number;
  earlyFinishMinutes: number;
  status: "WORKING" | "FINISHED";
};

const authHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("mobile_session_token") ?? ""}`,
});
const today = () => new Date().toISOString().slice(0, 10);
const reasons = [
  ["finished_scheduled_work_early", "Finished scheduled work early"],
  ["gap_between_jobs", "Gap between jobs"],
  ["management_authorised", "Management authorised"],
  ["returned_home_before_later_job", "Returned home before later job"],
  ["operational_downtime", "Operational downtime"],
  ["other", "Other"],
] as const;
const reasonLabels = Object.fromEntries(reasons);

export default function MobileMyTime() {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [summary, setSummary] = useState<Summary>({
    approvedOvertimeMinutes: 0,
    approvedTimeOffMinutes: 0,
    pendingOvertimeMinutes: 0,
    pendingTimeOffMinutes: 0,
    netMinutes: 0,
  });
  const [mode, setMode] = useState<"none" | "overtime" | "timeoff">("none");
  const [form, setForm] = useState({
    workDate: today(),
    startTime: "",
    finishTime: "",
    customerName: "",
    notes: "",
    reason: "gap_between_jobs",
    otherReason: "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [attendance, setAttendance] = useState<Attendance | null>(null);
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const worker = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("mobile_worker_data") || "{\"name\":\"Technician\",\"role\":\"Technician\"}") as { name: string; role?: string };
    } catch {
      return { name: "Technician", role: "Technician" };
    }
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [timeResponse, attendanceResponse] = await Promise.all([
        fetch("/api/mobile/time", { headers: authHeaders() }),
        fetch("/api/mobile/attendance/today", { headers: authHeaders() }),
      ]);
      const [data, attendanceData] = await Promise.all([
        timeResponse.json().catch(() => ({})),
        attendanceResponse.json().catch(() => ({})),
      ]);
      if (!timeResponse.ok) {
        throw new Error(timeResponse.status === 401
          ? "Your mobile session has expired. Please sign in again."
          : data.error || data.message || "Unable to load your time.");
      }
      if (!attendanceResponse.ok) {
        throw new Error(attendanceResponse.status === 401
          ? "Your mobile session has expired. Please sign in again."
          : attendanceData.error || attendanceData.message || "Unable to load today's attendance.");
      }
      setEntries(data.entries ?? []);
      setSummary(data.summary ?? {});
      setAttendance(attendanceData.attendance ?? null);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load your time.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const updateAttendance = async (action: "start" | "end") => {
    setAttendanceSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/mobile/attendance/${action}`, {
        method: "POST",
        headers: authHeaders(),
        body: "{}",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(response.status === 401
          ? "Your mobile session has expired. Please sign in again."
          : data.error || `Unable to ${action} work.`);
      }
      setAttendance(data.attendance ?? null);
      setMessage(action === "start"
        ? `Work started at ${data.attendance?.startTime}.`
        : `Work ended at ${data.attendance?.finishTime}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Unable to ${action} work.`);
    } finally {
      setAttendanceSaving(false);
    }
  };

  const overtime = useMemo(() => calculateOvertimeBreakdown(form.startTime, form.finishTime), [form.startTime, form.finishTime]);
  const timeOff = useMemo(() => calculateAuthorisedTimeOffMinutes(form.startTime, form.finishTime), [form.startTime, form.finishTime]);
  const total = mode === "overtime" ? overtime?.totalMinutes : timeOff;
  const calculationMessage = useMemo(() => {
    if (!form.startTime || !form.finishTime) return "";
    if (total === null || total === undefined) return "Finish time must be later than start time on the same day.";
    if (mode === "overtime" && total === 0) return "No overtime detected. Overtime is only counted before 08:00 or after 16:00.";
    if (mode === "timeoff" && total === 0) return "No normal working time exists in this period. Time Off is counted only between 08:00 and 16:00.";
    return "";
  }, [form.startTime, form.finishTime, mode, total]);
  const canSubmit = Boolean(
    form.workDate && form.startTime && form.finishTime && total && total > 0
      && (mode !== "overtime" || form.customerName.trim())
      && (mode !== "timeoff" || (form.reason !== "other" || form.otherReason.trim())),
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!canSubmit) {
      setError(calculationMessage || (mode === "overtime" && !form.customerName.trim()
        ? "Enter the customer name before submitting overtime."
        : mode === "timeoff" && form.reason === "other" && !form.otherReason.trim()
          ? "Describe the other reason before submitting Time Off."
          : "Complete the required fields before submitting."));
      return;
    }
    setSaving(true);
    try {
      const path = mode === "timeoff" ? "/api/mobile/time-off" : "/api/mobile/overtime";
      const body = mode === "timeoff"
        ? { workDate: form.workDate, startTime: form.startTime, finishTime: form.finishTime, reason: form.reason, otherReason: form.otherReason || null, notes: form.notes }
        : { workDate: form.workDate, startTime: form.startTime, finishTime: form.finishTime, customerName: form.customerName, notes: form.notes };
      const response = await fetch(path, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(response.status === 401
          ? "Your mobile session has expired. Please sign in again."
          : data.error || data.message || "Unable to save this entry.");
      }
      setForm({ workDate: today(), startTime: "", finishTime: "", customerName: "", notes: "", reason: "gap_between_jobs", otherReason: "" });
      setMode("none");
      setMessage(mode === "timeoff" ? "Time Off submitted for approval." : "Overtime submitted for approval.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save this entry.");
    } finally {
      setSaving(false);
    }
  };

  const logout = () => {
    ["mobile_worker_id", "mobile_session_token", "mobile_worker_data", "mobile_user_role", "mobile_user_type", "auth_token", "auth_user", "auth_user_role", "auth_user_type", "demo_mode", "selected_login_mode"].forEach(key => localStorage.removeItem(key));
    window.location.replace("/");
  };
  const statusClass = (status: TimeEntry["status"]) =>
    status === "approved" ? "bg-emerald-100 text-emerald-800" : status === "rejected" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800";
  const mobileNavItems: MobileNavItem[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/mobile" },
    { id: "jobs", label: "My Jobs", icon: ListChecks, href: "/mobile" },
    { id: "my-time", label: "My Time", icon: Clock3 },
    { id: "fleet", label: "Fleet Actions", icon: Truck, href: "/fleet" },
  ];

  return (
    <MobileShell
      title="My Time"
      subtitle="Attendance, overtime and authorised Time Off"
      workerName={worker.name}
      workerRole={worker.role}
      activeItem="my-time"
      items={mobileNavItems}
      onLogout={logout}
      headerAction={<button aria-label="Refresh My Time" onClick={load} className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"><RefreshCw className="h-4 w-4" /></button>}
    >
      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {message && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div>}

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">Attendance today</p>
            <h2 className="mt-1 text-lg font-bold text-gray-900">
              {!attendance ? "Not started" : attendance.status === "WORKING" ? "Working" : "Finished"}
            </h2>
          </div>
          <Badge className={!attendance ? "bg-gray-100 text-gray-700" : attendance.status === "WORKING" ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"}>
            {!attendance ? "NOT STARTED" : attendance.status}
          </Badge>
        </div>

        {!attendance ? (
          <Button
            onClick={() => updateAttendance("start")}
            disabled={attendanceSaving || loading}
            className="mt-4 h-14 w-full bg-red-600 text-base font-bold hover:bg-red-700"
          >
            <Play className="mr-2 h-5 w-5" />
            {attendanceSaving ? "Starting…" : "Start Work"}
          </Button>
        ) : attendance.status === "WORKING" ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              Started at <strong>{attendance.startTime}</strong>
            </div>
            <Button
              onClick={() => updateAttendance("end")}
              disabled={attendanceSaving}
              className="h-14 w-full bg-gray-900 text-base font-bold hover:bg-gray-800"
            >
              <Square className="mr-2 h-5 w-5" />
              {attendanceSaving ? "Ending…" : "End Work"}
            </Button>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-500">Started</p><p className="mt-1 font-bold text-gray-900">{attendance.startTime}</p></div>
            <div className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-500">Finished</p><p className="mt-1 font-bold text-gray-900">{attendance.finishTime}</p></div>
            <div className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-500">Total</p><p className="mt-1 font-bold text-gray-900">{formatOvertimeMinutes(attendance.totalMinutes || 0)}</p></div>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Button onClick={() => setMode(mode === "overtime" ? "none" : "overtime")} className="h-12 bg-red-600 text-sm font-bold hover:bg-red-700"><Plus className="mr-2 h-4 w-4" />Log overtime</Button>
        <Button onClick={() => setMode(mode === "timeoff" ? "none" : "timeoff")} variant="outline" className="h-12 border-gray-300 text-sm font-bold hover:bg-gray-50"><Plus className="mr-2 h-4 w-4" />Log Time Off</Button>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">This month</p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div><p className="text-xs text-gray-500">Overtime</p><p className="mt-1 font-bold text-gray-900">{formatOvertimeMinutes(summary.approvedOvertimeMinutes || 0)}</p></div>
          <div><p className="text-xs text-gray-500">Time Off</p><p className="mt-1 font-bold text-gray-900">{formatOvertimeMinutes(summary.approvedTimeOffMinutes || 0)}</p></div>
          <div><p className="text-xs text-gray-500">Net</p><p className="mt-1 font-bold text-gray-900">{formatNetTimeDifference(summary.netMinutes || 0)}</p></div>
        </div>
        <div className="mt-4 border-t border-gray-100 pt-3 text-xs text-gray-500">Pending overtime: {formatOvertimeMinutes(summary.pendingOvertimeMinutes || 0)} · Pending Time Off: {formatOvertimeMinutes(summary.pendingTimeOffMinutes || 0)}</div>
      </section>

      {mode !== "none" && (
        <form onSubmit={submit} className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
          <div><h2 className="font-semibold text-gray-900">{mode === "timeoff" ? "Log Time Off" : "Log Overtime"}</h2><p className="mt-1 text-sm text-gray-500">Enter the time exactly as recorded in the field.</p></div>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="space-y-1 text-sm font-medium text-gray-700">Date<Input required type="date" value={form.workDate} onChange={e => setForm(f => ({ ...f, workDate: e.target.value }))} /></label>
            <label className="space-y-1 text-sm font-medium text-gray-700">Start time<Input required type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} /></label>
            <label className="space-y-1 text-sm font-medium text-gray-700">Finish time<Input required type="time" value={form.finishTime} onChange={e => setForm(f => ({ ...f, finishTime: e.target.value }))} /></label>
          </div>
          {mode === "timeoff" ? (
            <div className="space-y-3">
              <label className="space-y-1 text-sm font-medium text-gray-700">Reason
                <Select value={form.reason} onValueChange={reason => setForm(f => ({ ...f, reason }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{reasons.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
              </label>
              {form.reason === "other" && <Input required value={form.otherReason} onChange={e => setForm(f => ({ ...f, otherReason: e.target.value }))} placeholder="Describe the reason" />}
            </div>
          ) : (
            <label className="space-y-1 text-sm font-medium text-gray-700">Customer name<Input required value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} /></label>
          )}
          <label className="space-y-1 text-sm font-medium text-gray-700">Notes (optional)<Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Add any helpful details" /></label>
           {form.startTime && form.finishTime && <div className={`rounded-lg border p-3 text-sm ${total && total > 0 ? "border-gray-200 bg-gray-50 text-gray-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}>{total && total > 0 ? <>{mode === "overtime" ? "Calculated overtime" : "Total Time Off"}: <strong>{formatOvertimeMinutes(total)}</strong></> : calculationMessage}</div>}
           <Button type="submit" disabled={saving || !canSubmit} className={mode === "overtime" ? "bg-red-600 hover:bg-red-700" : "bg-gray-900 hover:bg-gray-800"}>{saving ? "Saving…" : mode === "timeoff" ? "Submit Time Off" : "Submit Overtime"}</Button>
        </form>
      )}

      <section>
        <div className="mb-3 flex items-center gap-2"><History className="h-4 w-4 text-gray-400" /><div><h2 className="text-sm font-semibold text-gray-900">Recent activity</h2><p className="text-xs text-gray-500">Approved entries are locked.</p></div></div>
         {loading ? <div className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-500 shadow-sm">Loading your time…</div> : entries.length ? <div className="space-y-2">{entries.slice(0, 12).map(entry => <article key={entry.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-gray-900">{entry.entryType === "AUTHORISED_TIME_OFF" ? "Authorised Time Off" : "Overtime"}</p><p className="mt-1 text-xs text-gray-500">{entry.workDate} · {entry.startTime}–{entry.finishTime}</p></div><Badge className={statusClass(entry.status)}>{entry.status}</Badge></div><p className="mt-2 text-sm font-medium text-gray-700">{formatOvertimeMinutes(entry.overtimeMinutes)}</p>{entry.clientName && <p className="mt-1 text-xs text-gray-500">Customer: {entry.clientName}</p>}{entry.entryType === "AUTHORISED_TIME_OFF" && entry.timeOffReason && <p className="mt-1 text-xs text-gray-500">Reason: {entry.timeOffReason === "other" ? entry.timeOffOtherReason || "Other" : reasonLabels[entry.timeOffReason as keyof typeof reasonLabels] || entry.timeOffReason}</p>}{entry.notes && <p className="mt-1 text-xs text-gray-500">{entry.notes}</p>}{entry.status === "approved" && entry.approvedByName && <p className="mt-1 text-xs text-emerald-700">Approved by {entry.approvedByName}</p>}{entry.status === "rejected" && entry.rejectionReason && <p className="mt-1 text-xs text-red-700">Reason: {entry.rejectionReason}</p>}</article>)}</div> : <p className="rounded-xl border border-dashed border-gray-300 bg-white p-5 text-sm text-gray-500">No time entries yet.</p>}
      </section>
    </MobileShell>
  );
}