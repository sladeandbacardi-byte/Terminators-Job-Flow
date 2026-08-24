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

const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("mobile_session_token") ?? ""}`,
});

const today = () => new Date().toISOString().slice(0, 10);

function isThisMonth(date: string) {
  const current = new Date();
  return date.startsWith(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`);
}

export default function MobileOvertime() {
  const [jobs, setJobs] = useState<MobileJob[]>([]);
  const [entries, setEntries] = useState<OvertimeEntry[]>([]);
  const [form, setForm] = useState({ workDate: today(), customerName: "", jobId: new URLSearchParams(window.location.search).get("job") ?? "", startTime: "", finishTime: "", notes: "" });
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
      const availableJobs = dashboardData.jobs ?? [];
      setJobs(availableJobs);
      setForm(current => current.jobId && !current.customerName
        ? { ...current, customerName: availableJobs.find((job: MobileJob) => job.id === current.jobId)?.client?.name ?? "" }
        : current);
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
  const totalMinutes = useMemo(
    () => entries.filter(entry => isThisMonth(entry.workDate)).reduce((sum, entry) => sum + entry.overtimeMinutes, 0),
    [entries],
  );

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
      setForm({ workDate: today(), customerName: "", jobId: "", startTime: "", finishTime: "", notes: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit overtime.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 flex items-center justify-between bg-slate-950 px-4 py-3 text-white shadow">
        <div className="flex items-center gap-3">
          <button aria-label="Back to mobile dashboard" onClick={() => { window.location.href = "/mobile"; }} className="rounded-lg p-2 hover:bg-slate-800"><ArrowLeft className="h-5 w-5" /></button>
          <div><h1 className="font-bold">Overtime</h1><p className="text-xs text-slate-300">View and log overtime</p></div>
        </div>
        <button aria-label="Refresh overtime" onClick={load} className="rounded-lg p-2 hover:bg-slate-800"><RefreshCw className="h-5 w-5" /></button>
      </header>
      <div className="mx-auto max-w-lg space-y-4 p-4 pb-10">
        {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {notice && <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</div>}
        <section className="rounded-xl border border-red-100 bg-red-50 p-4">
          <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-red-700">Total overtime this month</p><p className="mt-1 text-2xl font-bold text-slate-950">{formatOvertimeMinutes(totalMinutes)}</p></div><Clock3 className="h-8 w-8 text-red-600" /></div>
        </section>
        <form onSubmit={save} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold text-slate-900">Log overtime</h2>
          <label className="text-xs font-medium text-slate-600">Date<input required type="date" value={form.workDate} onChange={event => setForm(current => ({ ...current, workDate: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-medium text-slate-600">Start Time at Customer<input required type="time" value={form.startTime} onChange={event => setForm(current => ({ ...current, startTime: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" /></label>
            <label className="text-xs font-medium text-slate-600">End Time at Customer<input required type="time" value={form.finishTime} onChange={event => setForm(current => ({ ...current, finishTime: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" /></label>
          </div>
          <label className="text-xs font-medium text-slate-600">Customer Name<input required value={form.customerName} onChange={event => setForm(current => ({ ...current, customerName: event.target.value }))} placeholder="Enter customer name" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" /></label>
          <label className="text-xs font-medium text-slate-600">Notes, optional<textarea value={form.notes} onChange={event => setForm(current => ({ ...current, notes: event.target.value }))} className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" /></label>
          {breakdown && breakdown.totalMinutes > 0 && <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">Calculated overtime: <strong>{formatOvertimeMinutes(breakdown.totalMinutes)}</strong></p>}
          {breakdown && breakdown.totalMinutes === 0 && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">No overtime hours were calculated because the selected time falls within normal working hours. You can cancel or submit anyway.</p>}
          <button disabled={saving || !breakdown} className="w-full rounded-lg bg-red-600 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Submitting…" : breakdown?.totalMinutes === 0 ? "Submit Anyway" : "Submit Overtime"}</button>
        </form>
        <section><h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-600">My overtime</h2>{loading ? <p className="rounded-xl bg-white p-4 text-sm text-slate-500">Loading overtime…</p> : entries.length === 0 ? <p className="rounded-xl bg-white p-4 text-sm text-slate-500">No overtime entries yet.</p> : <div className="space-y-2">{entries.map(entry => <article key={entry.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-900">{entry.clientName || "Customer not specified"}</p><p className="mt-1 text-xs text-slate-500">{new Date(`${entry.workDate}T12:00:00`).toLocaleDateString("en-ZA")}</p><p className="mt-1 text-xs text-slate-500">{entry.startTime}–{entry.finishTime}</p></div><span className={`rounded-full px-2 py-1 text-xs font-semibold ${entry.status === "approved" ? "bg-emerald-100 text-emerald-800" : entry.status === "rejected" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>{entry.status === "pending" ? "Submitted" : entry.status === "rejected" ? "Declined" : "Approved"}</span></div><p className="mt-2 text-sm font-medium text-slate-700">Overtime: {formatOvertimeMinutes(entry.overtimeMinutes)}</p>{entry.notes && <p className="mt-1 text-sm text-slate-500">{entry.notes}</p>}</article>)}</div>}</section>
      </div>
    </main>
  );
}