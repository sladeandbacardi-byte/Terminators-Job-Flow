import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Clock3, Plus, RefreshCw } from "lucide-react";
import { calculateAuthorisedTimeOffMinutes, calculateOvertimeBreakdown, formatNetTimeDifference, formatOvertimeMinutes } from "@shared/overtime";

type TimeEntry = { id: string; entryType: "OVERTIME" | "AUTHORISED_TIME_OFF"; workDate: string; startTime: string; finishTime: string; overtimeMinutes: number; notes: string; timeOffReason?: string | null; status: "pending" | "approved" | "rejected"; clientName?: string };
type Summary = { approvedOvertimeMinutes: number; approvedTimeOffMinutes: number; pendingOvertimeMinutes: number; pendingTimeOffMinutes: number; netMinutes: number };
const authHeaders = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("mobile_session_token") ?? ""}` });
const today = () => new Date().toISOString().slice(0, 10);
const reasons = [["finished_scheduled_work_early", "Finished scheduled work early"], ["gap_between_jobs", "Gap between jobs"], ["management_authorised", "Management authorised"], ["returned_home_before_later_job", "Returned home before later job"], ["operational_downtime", "Operational downtime"], ["other", "Other"]] as const;

export default function MobileMyTime() {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [summary, setSummary] = useState<Summary>({ approvedOvertimeMinutes: 0, approvedTimeOffMinutes: 0, pendingOvertimeMinutes: 0, pendingTimeOffMinutes: 0, netMinutes: 0 });
  const [mode, setMode] = useState<"none" | "overtime" | "timeoff">("none");
  const [form, setForm] = useState({ workDate: today(), startTime: "", finishTime: "", customerName: "", notes: "", reason: "gap_between_jobs", otherReason: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const response = await fetch("/api/mobile/time", { headers: authHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load your time.");
      setEntries(data.entries ?? []); setSummary(data.summary ?? {});
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to load your time."); }
  };
  useEffect(() => { load(); }, []);
  const overtime = useMemo(() => calculateOvertimeBreakdown(form.startTime, form.finishTime), [form.startTime, form.finishTime]);
  const timeOff = useMemo(() => calculateAuthorisedTimeOffMinutes(form.startTime, form.finishTime), [form.startTime, form.finishTime]);
  const total = mode === "overtime" ? overtime?.totalMinutes : timeOff;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(""); setMessage(""); setSaving(true);
    try {
      const path = mode === "timeoff" ? "/api/mobile/time-off" : "/api/mobile/overtime";
      const body = mode === "timeoff"
        ? { workDate: form.workDate, startTime: form.startTime, finishTime: form.finishTime, reason: form.reason, otherReason: form.otherReason || null, notes: form.notes }
        : { workDate: form.workDate, startTime: form.startTime, finishTime: form.finishTime, customerName: form.customerName, notes: form.notes };
      const response = await fetch(path, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save this entry.");
      setForm({ workDate: today(), startTime: "", finishTime: "", customerName: "", notes: "", reason: "gap_between_jobs", otherReason: "" });
      setMode("none"); setMessage(mode === "timeoff" ? "Time Off submitted for approval." : "Overtime submitted for approval."); await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to save this entry."); }
    finally { setSaving(false); }
  };
  const status = (entry: TimeEntry) => entry.status === "approved" ? "bg-emerald-100 text-emerald-800" : entry.status === "rejected" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800";
  return <main className="min-h-screen bg-slate-50">
    <header className="sticky top-0 z-10 flex items-center justify-between bg-slate-950 px-4 py-3 text-white shadow"><div className="flex items-center gap-3"><button aria-label="Back to dashboard" onClick={() => { window.location.href = "/mobile"; }} className="rounded-lg p-2 hover:bg-slate-800"><ArrowLeft className="h-5 w-5" /></button><div><h1 className="font-bold">My Time</h1><p className="text-xs text-slate-300">Overtime and authorised time off</p></div></div><button aria-label="Refresh My Time" onClick={load} className="rounded-lg p-2 hover:bg-slate-800"><RefreshCw className="h-5 w-5" /></button></header>
    <div className="mx-auto max-w-lg space-y-4 p-4 pb-10">
      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}{message && <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div>}
      <div className="grid grid-cols-2 gap-3"><button onClick={() => setMode(mode === "overtime" ? "none" : "overtime")} className="rounded-xl bg-red-600 px-3 py-3 text-sm font-bold text-white"><Plus className="mr-1 inline h-4 w-4" />LOG OVERTIME</button><button onClick={() => setMode(mode === "timeoff" ? "none" : "timeoff")} className="rounded-xl bg-slate-900 px-3 py-3 text-sm font-bold text-white"><Plus className="mr-1 inline h-4 w-4" />LOG TIME OFF</button></div>
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">This month</p><div className="mt-3 grid grid-cols-3 gap-2 text-center"><div><p className="text-xs text-slate-500">Overtime</p><p className="mt-1 font-bold">{formatOvertimeMinutes(summary.approvedOvertimeMinutes || 0)}</p></div><div><p className="text-xs text-slate-500">Time Off</p><p className="mt-1 font-bold">{formatOvertimeMinutes(summary.approvedTimeOffMinutes || 0)}</p></div><div><p className="text-xs text-slate-500">Net</p><p className="mt-1 font-bold">{formatNetTimeDifference(summary.netMinutes || 0)}</p></div></div><div className="mt-3 border-t pt-3 text-xs text-slate-500">Pending overtime: {formatOvertimeMinutes(summary.pendingOvertimeMinutes || 0)} · Pending Time Off: {formatOvertimeMinutes(summary.pendingTimeOffMinutes || 0)}</div></section>
      {mode !== "none" && <form onSubmit={submit} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><h2 className="font-semibold">{mode === "timeoff" ? "Log Time Off" : "Log Overtime"}</h2><label className="block text-xs font-medium text-slate-600">Date<input required type="date" value={form.workDate} onChange={e => setForm(f => ({ ...f, workDate: e.target.value }))} className="mt-1 w-full rounded-lg border p-2.5 text-sm" /></label><div className="grid grid-cols-2 gap-3"><label className="text-xs font-medium text-slate-600">Start Time<input required type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} className="mt-1 w-full rounded-lg border p-2.5 text-sm" /></label><label className="text-xs font-medium text-slate-600">Finish Time<input required type="time" value={form.finishTime} onChange={e => setForm(f => ({ ...f, finishTime: e.target.value }))} className="mt-1 w-full rounded-lg border p-2.5 text-sm" /></label></div>{mode === "timeoff" ? <><label className="block text-xs font-medium text-slate-600">Reason<select value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} className="mt-1 w-full rounded-lg border p-2.5 text-sm">{reasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{form.reason === "other" && <input required value={form.otherReason} onChange={e => setForm(f => ({ ...f, otherReason: e.target.value }))} placeholder="Describe the reason" className="w-full rounded-lg border p-2.5 text-sm" />}</> : <label className="block text-xs font-medium text-slate-600">Customer Name<input required value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} className="mt-1 w-full rounded-lg border p-2.5 text-sm" /></label>}<label className="block text-xs font-medium text-slate-600">Notes (optional)<textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="mt-1 min-h-20 w-full rounded-lg border p-2.5 text-sm" /></label>{form.startTime && form.finishTime && <div className={`rounded-lg p-3 text-sm ${total && total > 0 ? "bg-slate-50 text-slate-700" : "bg-amber-50 text-amber-800"}`}>{mode === "timeoff" ? total === 0 ? "No normal working time exists in this period." : <>Total Time Off: <strong>{formatOvertimeMinutes(total || 0)}</strong></> : <>Calculated overtime: <strong>{formatOvertimeMinutes(total || 0)}</strong></>}</div>}<button disabled={saving || !total || total <= 0} className="w-full rounded-lg bg-slate-950 px-4 py-3 font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : mode === "timeoff" ? "Submit Time Off" : "Submit Overtime"}</button></form>}
      <section><h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-600">Recent activity</h2>{entries.length ? <div className="space-y-2">{entries.slice(0, 12).map(entry => <article key={entry.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><div className="flex justify-between gap-3"><div><p className="font-semibold">{entry.entryType === "AUTHORISED_TIME_OFF" ? "Authorised Time Off" : "Overtime"}</p><p className="text-xs text-slate-500">{entry.workDate} · {entry.startTime}–{entry.finishTime}</p></div><span className={`h-fit rounded-full px-2 py-1 text-xs font-semibold ${status(entry)}`}>{entry.status}</span></div><p className="mt-2 text-sm font-medium">{formatOvertimeMinutes(entry.overtimeMinutes)}</p></article>)}</div> : <p className="rounded-xl bg-white p-4 text-sm text-slate-500">No time entries yet.</p>}</section>
    </div>
  </main>;
}