import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Clock3, RefreshCw } from "lucide-react";
import { calculateOvertimeBreakdown, formatOvertimeMinutes } from "@shared/overtime";

type MobileJob = { id: string; title: string; scheduledDate: string; client?: { name: string } | null };
type OvertimeEntry = {
  id: string;
  workDate: string;
  startTime: string;
  finishTime: string;
  overtimeMinutes: number;
  notes: string;
  status: "pending" | "approved" | "rejected";
  jobLabel: string | null;
  clientName: string;
};
type Period = "all" | "this_month" | "last_30";

const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("mobile_session_token") ?? ""}`,
});

const today = () => new Date().toISOString().slice(0, 10);

function inPeriod(date: string, period: Period) {
  if (period === "all") return true;
  const current = new Date();
  const from = new Date(current);
  if (period === "this_month") from.setDate(1);
  else from.setDate(current.getDate() - 29);
  return date >= from.toISOString().slice(0, 10) && date <= today();
}

export default function MobileOvertime() {
  const [jobs, setJobs] = useState<MobileJob[]>([]);
  const [entries, setEntries] = useState<OvertimeEntry[]>([]);
  const [period, setPeriod] = useState<Period>("this_month");
  const [form, setForm] = useState({ workDate: today(), jobId: new URLSearchParams(window.location.search).get("job") ?? "", workType: "client_job", startTime: "", finishTime: "", notes: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [overtimeResponse, dashboardResponse] = await Promise.all([
        fetch("/api/mobile/overtime", { headers: headers() }),
        fetch("/api/mobile/dashboard", { headers: headers() }),
      ]);
      const overtimeData = await overtimeResponse.json();
      const dashboardData = await dashboardResponse.json();
      if (!overtimeResponse.ok) throw new Error(overtimeData.error || "Unable to load overtime.");
      if (!dashboardResponse.ok) throw new Error(dashboardData.message || "Unable to load your jobs.");
      setEntries(overtimeData.entries ?? []);
      setJobs(dashboardData.jobs ?? []);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load overtime.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const breakdown = useMemo(
    () => calculateOvertimeBreakdown(form.startTime, form.finishTime),
    [form.startTime, form.finishTime],
  );
  const visibleEntries = useMemo(() => entries.filter(entry => inPeriod(entry.workDate, period)), [entries, period]);
  const totalMinutes = visibleEntries.reduce((sum, entry) => sum + entry.overtimeMinutes, 0);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/mobile/overtime", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ ...form, jobId: form.jobId || null }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to submit overtime.");
      setNotice("Overtime submitted for approval.");
      setForm({ workDate: today(), jobId: "", workType: "client_job", startTime: "", finishTime: "", notes: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit overtime.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 flex items-center justify-between bg-emerald-700 px-4 py-3 text-white shadow">
        <div className="flex items-center gap-3">
          <button aria-label="Back to mobile dashboard" onClick={() => { window.location.href = "/mobile"; }} className="rounded-lg p-2 hover:bg-emerald-800"><ArrowLeft className="h-5 w-5" /></button>
          <div><h1 className="font-bold">Overtime</h1><p className="text-xs text-emerald-100">View and log overtime</p></div>
        </div>
        <button aria-label="Refresh overtime" onClick={load} className="rounded-lg p-2 hover:bg-emerald-800"><RefreshCw className="h-5 w-5" /></button>
      </header>
      <div className="mx-auto max-w-lg space-y-4 p-4 pb-10">
        {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {notice && <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</div>}
        <section className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
          <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Total overtime</p><p className="mt-1 text-2xl font-bold text-emerald-950">{formatOvertimeMinutes(totalMinutes)}</p></div><Clock3 className="h-8 w-8 text-emerald-600" /></div>
          <select value={period} onChange={event => setPeriod(event.target.value as Period)} className="mt-3 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"><option value="this_month">This month</option><option value="last_30">Last 30 days</option><option value="all">All time</option></select>
        </section>
        <form onSubmit={save} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold text-slate-900">Log overtime</h2>
          <input required type="date" value={form.workDate} onChange={event => setForm(current => ({ ...current, workDate: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-medium text-slate-600">Start time<input required type="time" value={form.startTime} onChange={event => setForm(current => ({ ...current, startTime: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" /></label>
            <label className="text-xs font-medium text-slate-600">End time<input required type="time" value={form.finishTime} onChange={event => setForm(current => ({ ...current, finishTime: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" /></label>
          </div>
          <select value={form.workType} onChange={event => setForm(current => ({ ...current, workType: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"><option value="client_job">Client job</option><option value="internal">Internal work</option><option value="travel">Travel</option><option value="workshop">Workshop</option><option value="stock_warehouse">Stock / warehouse</option></select>
          <select required={form.workType === "client_job"} value={form.jobId} onChange={event => setForm(current => ({ ...current, jobId: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"><option value="">{form.workType === "client_job" ? "Select related job" : "Select related job (optional)"}</option>{jobs.map(job => <option key={job.id} value={job.id}>{job.client?.name ?? job.title} · {new Date(job.scheduledDate).toLocaleDateString("en-ZA")}</option>)}</select>
          <textarea required placeholder="Reason / notes" value={form.notes} onChange={event => setForm(current => ({ ...current, notes: event.target.value }))} className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
          {breakdown && breakdown.totalMinutes > 0 && <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">Calculated overtime: <strong>{formatOvertimeMinutes(breakdown.totalMinutes)}</strong></p>}
          {breakdown && breakdown.totalMinutes === 0 && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">Overtime must be before 08:00 or after 16:00.</p>}
          <button disabled={saving || !breakdown || breakdown.totalMinutes === 0} className="w-full rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Submitting…" : "Submit overtime"}</button>
        </form>
        <section><h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-600">My overtime</h2>{loading ? <p className="rounded-xl bg-white p-4 text-sm text-slate-500">Loading overtime…</p> : visibleEntries.length === 0 ? <p className="rounded-xl bg-white p-4 text-sm text-slate-500">No overtime entries for this period.</p> : <div className="space-y-2">{visibleEntries.map(entry => <article key={entry.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-900">{new Date(`${entry.workDate}T12:00:00`).toLocaleDateString("en-ZA")}</p><p className="text-xs text-slate-500">{entry.startTime}–{entry.finishTime}{entry.clientName ? ` · ${entry.clientName}` : ""}</p></div><span className={`rounded-full px-2 py-1 text-xs font-semibold ${entry.status === "approved" ? "bg-emerald-100 text-emerald-800" : entry.status === "rejected" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>{entry.status === "pending" ? "Submitted" : entry.status === "rejected" ? "Declined" : "Approved"}</span></div><p className="mt-2 text-sm text-slate-600">{formatOvertimeMinutes(entry.overtimeMinutes)} · {entry.notes}</p></article>)}</div>}</section>
      </div>
    </main>
  );
}