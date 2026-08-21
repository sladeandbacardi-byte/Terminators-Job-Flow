import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays, ClipboardPenLine, ExternalLink,
  LayoutDashboard, ListChecks, LogOut, Menu, RefreshCw, Truck, X,
} from "lucide-react";
import type { Client, Job, Worker } from "@shared/schema";

type Screen = "dashboard" | "jobs" | "diaries" | "calendar" | "km" | "fuel" | "inspection" | "issue";
type MobileJob = Job & { client: Client };

type DashboardData = {
  jobs: MobileJob[];
  todayJobs: MobileJob[];
  vehicle: { id: string; name: string; registration: string } | null;
  metrics: {
    jobsToday: number;
    completedToday: number;
    inProgress: number;
    fieldDiariesDue: number;
    currentJob: MobileJob | null;
    weekJobs: MobileJob[];
  };
};

const authHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("mobile_session_token") ?? ""}`,
});

export function MobileTechnicianDashboard({ worker, onLogout }: { worker: Worker; onLogout: () => void }) {
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/mobile/dashboard", { headers: authHeaders() });
      if (!response.ok) throw new Error(response.status === 401 ? "Your mobile session has expired. Please sign in again." : "Unable to load your mobile dashboard.");
      setData(await response.json());
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load your mobile dashboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const jobs = data?.jobs ?? [];
  const vehicleLabel = data?.vehicle ? `${data.vehicle.name} · ${data.vehicle.registration}` : "No vehicle assigned";
  const today = new Date().toISOString().slice(0, 10);
  const input = (name: string, placeholder: string, type = "text", required = false) => (
    <input
      type={type} required={required} placeholder={placeholder} value={form[name] ?? ""}
      onChange={(event) => setForm(current => ({ ...current, [name]: event.target.value }))}
      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
    />
  );

  const submit = async (path: string, body: Record<string, unknown>, success: string) => {
    setNotice("");
    try {
      const response = await fetch(path, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Unable to save your update.");
      setNotice(success);
      setForm({});
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save your update.");
    }
  };

  const updateStatus = async (jobId: string, status: "in_progress" | "completed") => {
    try {
      const response = await fetch(`/api/mobile/jobs/${jobId}/status`, {
        method: "PATCH", headers: authHeaders(), body: JSON.stringify({ status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Unable to update job.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update job.");
    }
  };

  const nav = (target: Screen) => {
    setScreen(target);
    setMenuOpen(false);
    setNotice("");
    setError("");
  };

  const screenTitle: Record<Screen, string> = {
    dashboard: "Dashboard", jobs: "My Jobs", diaries: "Field Diaries", calendar: "Calendar",
    km: "Log KMs", fuel: "Fuel Fill-up", inspection: "Vehicle Inspection", issue: "Report Issue",
  };

  const menuItems: Array<{ screen: Screen; label: string; icon: typeof LayoutDashboard }> = [
    { screen: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { screen: "jobs", label: "My Jobs", icon: ListChecks },
    { screen: "diaries", label: "Field Diaries", icon: ClipboardPenLine },
    { screen: "calendar", label: "Calendar", icon: CalendarDays },
  ];
  const openFleetGuard = () => { window.location.href = "/fleet"; };

  const jobRows = (list: MobileJob[]) => (
    <div className="space-y-3">
      {list.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">No jobs are assigned to you or your team.</p> :
        list.map(job => (
          <article key={job.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">{job.client?.name ?? job.title}</p>
                <p className="mt-1 text-xs text-slate-500">{new Date(job.scheduledDate).toLocaleDateString("en-ZA")} · {job.scheduledTime || "Time to be confirmed"}</p>
              </div>
              <span className={`rounded-full px-2 py-1 text-xs font-semibold ${job.status === "completed" ? "bg-emerald-100 text-emerald-800" : job.status === "in_progress" ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800"}`}>
                {job.status.replace("_", " ")}
              </span>
            </div>
            {job.location && <p className="mt-3 text-sm text-slate-600">{job.location}</p>}
            <div className="mt-3 flex gap-2">
              {job.status === "scheduled" && <button onClick={() => updateStatus(job.id, "in_progress")} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white">Start job</button>}
              {job.status === "in_progress" && <button onClick={() => updateStatus(job.id, "completed")} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white">Mark complete</button>}
            </div>
          </article>
        ))}
    </div>
  );

  const content = useMemo(() => {
    if (!data) return null;
    if (screen === "jobs") return jobRows(jobs);
    if (screen === "calendar") return <div className="space-y-3">{jobRows([...jobs].sort((a, b) => +new Date(a.scheduledDate) - +new Date(b.scheduledDate)))}</div>;
    if (screen === "diaries") return (
      <form className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm" onSubmit={(event) => {
        event.preventDefault();
        submit("/api/mobile/field-diaries", { ...form, serviceDate: form.serviceDate || today }, "Field diary submitted.");
      }}>
        <p className="text-sm text-slate-600">Submit a diary only for a job assigned to you or your team.</p>
        <select required value={form.jobId ?? ""} onChange={event => setForm(current => ({ ...current, jobId: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm">
          <option value="">Select job</option>
          {jobs.map(job => <option key={job.id} value={job.id}>{job.client?.name ?? job.title}</option>)}
        </select>
        {input("serviceDate", "Service date", "date", true)}
        {input("arrivalTime", "Arrival time", "time")}
        {input("departureTime", "Departure time", "time")}
        <textarea required placeholder="Work completed" value={form.workCompleted ?? ""} onChange={event => setForm(current => ({ ...current, workCompleted: event.target.value }))} className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
        <textarea placeholder="Notes (optional)" value={form.notes ?? ""} onChange={event => setForm(current => ({ ...current, notes: event.target.value }))} className="min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
        <button className="w-full rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white">Submit field diary</button>
      </form>
    );
    if (screen === "km") return <form className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm" onSubmit={(event) => { event.preventDefault(); submit("/api/mobile/fleet/km-logs", form, "Kilometres logged."); }}>
      <p className="text-sm text-slate-600">{vehicleLabel}</p>{input("startOdometer", "Start odometer", "number", true)}{input("endOdometer", "End odometer", "number", true)}{input("businessKm", "Business KMs", "number")}{input("privateKm", "Private KMs", "number")}<textarea placeholder="Notes (optional)" value={form.notes ?? ""} onChange={event => setForm(current => ({ ...current, notes: event.target.value }))} className="min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" /><button className="w-full rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white">Log KMs</button>
    </form>;
    if (screen === "fuel") return <form className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm" onSubmit={(event) => { event.preventDefault(); submit("/api/mobile/fleet/fuel-fillups", form, "Fuel fill-up logged."); }}>
      <p className="text-sm text-slate-600">{vehicleLabel}</p>{input("litres", "Litres", "number", true)}{input("cost", "Total cost", "number", true)}{input("odometer", "Odometer (optional)", "number")}{input("fuelStation", "Fuel station")}<textarea placeholder="Notes (optional)" value={form.notes ?? ""} onChange={event => setForm(current => ({ ...current, notes: event.target.value }))} className="min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" /><button className="w-full rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white">Log fuel fill-up</button>
    </form>;
    if (screen === "inspection") return <form className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm" onSubmit={(event) => { event.preventDefault(); submit("/api/mobile/fleet/inspections", { ...form, items: [] }, "Vehicle inspection submitted."); }}>
      <p className="text-sm text-slate-600">{vehicleLabel}</p><select value={form.overallResult ?? "pass"} onChange={event => setForm(current => ({ ...current, overallResult: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"><option value="pass">Vehicle passed inspection</option><option value="fail">Vehicle has a fault</option></select><textarea required placeholder="Inspection comments and any faults found" value={form.comments ?? ""} onChange={event => setForm(current => ({ ...current, comments: event.target.value }))} className="min-h-28 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" /><button className="w-full rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white">Submit inspection</button>
    </form>;
    if (screen === "issue") return <form className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm" onSubmit={(event) => { event.preventDefault(); submit("/api/mobile/fleet/issues", form, "Vehicle issue reported."); }}>
      <p className="text-sm text-slate-600">{vehicleLabel}</p><select value={form.category ?? "other"} onChange={event => setForm(current => ({ ...current, category: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"><option value="other">Other</option><option value="tyres">Tyres</option><option value="engine">Engine</option><option value="brakes">Brakes</option><option value="electrical">Electrical</option><option value="lights">Lights</option></select><select value={form.urgency ?? "medium"} onChange={event => setForm(current => ({ ...current, urgency: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="not_safe">Not safe to drive</option></select><textarea required placeholder="Describe the issue" value={form.description ?? ""} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} className="min-h-28 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" /><button className="w-full rounded-lg bg-red-600 px-4 py-3 font-semibold text-white">Report issue</button>
    </form>;
    const metrics = data.metrics;
    return <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        {[["Jobs Today", metrics.jobsToday], ["Completed Today", metrics.completedToday], ["In Progress", metrics.inProgress], ["Field Diaries Due", metrics.fieldDiariesDue]].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold text-slate-900">{value}</p></div>)}
      </div>
      <section><h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-600">Current Job</h2>{metrics.currentJob ? jobRows([metrics.currentJob]) : <p className="rounded-xl bg-slate-100 p-4 text-sm text-slate-600">No job is currently in progress.</p>}</section>
      <section><h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-600">My Jobs Today</h2>{jobRows(data.todayJobs)}</section>
      <section><h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-600">My Week</h2><p className="rounded-xl bg-white p-4 text-sm text-slate-600">{metrics.weekJobs.length} jobs scheduled for the next seven days.</p></section>
      <section><h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-600">Fleet</h2><button onClick={openFleetGuard} className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left font-semibold text-slate-700 shadow-sm hover:bg-emerald-50"><Truck className="h-5 w-5 text-emerald-600" /><span className="flex-1">FleetGuard</span><ExternalLink className="h-4 w-4 text-slate-400" /></button></section>
    </div>;
  }, [data, form, screen]);

  return <main className="min-h-screen bg-slate-50">
    <header className="sticky top-0 z-20 flex items-center justify-between bg-emerald-700 px-4 py-3 text-white shadow">
      <div className="flex items-center gap-3"><button aria-label="Open menu" onClick={() => setMenuOpen(true)} className="rounded-lg p-2 hover:bg-emerald-800"><Menu className="h-5 w-5" /></button><div><h1 className="font-bold">{screenTitle[screen]}</h1><p className="text-xs text-emerald-100">{worker.name} · Technician</p></div></div>
      <button aria-label="Refresh dashboard" onClick={load} className="rounded-lg p-2 hover:bg-emerald-800"><RefreshCw className="h-5 w-5" /></button>
    </header>
    {menuOpen && <div className="fixed inset-0 z-30"><button aria-label="Close menu" className="absolute inset-0 bg-slate-950/40" onClick={() => setMenuOpen(false)} /><aside className="absolute inset-y-0 left-0 w-80 overflow-y-auto bg-white p-5 shadow-2xl"><div className="mb-6 flex items-center justify-between"><div><p className="font-bold">{worker.name}</p><p className="text-xs text-slate-500">Mobile Technician</p></div><button aria-label="Close menu" onClick={() => setMenuOpen(false)}><X /></button></div><p className="mb-2 text-xs font-bold tracking-widest text-slate-400">SERVICE</p>{menuItems.map(item => { const Icon = item.icon; return <button key={item.screen} onClick={() => nav(item.screen)} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium text-slate-700 hover:bg-emerald-50"><Icon className="h-4 w-4 text-emerald-700" />{item.label}</button>; })}<p className="mb-2 mt-6 text-xs font-bold tracking-widest text-slate-400">FLEET</p><button onClick={openFleetGuard} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium text-slate-700 hover:bg-emerald-50"><Truck className="h-4 w-4 text-emerald-700" />FleetGuard<ExternalLink className="ml-auto h-3.5 w-3.5 text-slate-400" /></button><button onClick={onLogout} className="mt-8 flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 px-4 py-3 text-sm font-semibold text-red-700"><LogOut className="h-4 w-4" />Sign out</button></aside></div>}
    <div className="mx-auto max-w-lg p-4">{error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}{notice && <div className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</div>}{loading ? <div className="py-20 text-center text-sm text-slate-500">Loading your technician dashboard…</div> : content}</div>
  </main>;
}