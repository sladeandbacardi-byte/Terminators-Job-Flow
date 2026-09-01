import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays, ClipboardPenLine,
  LayoutDashboard, ListChecks, RefreshCw, Truck, Lightbulb, Camera, Clock3,
  Fuel, ClipboardCheck, AlertTriangle, Gauge,
} from "lucide-react";
import type { Client, Job, Worker } from "@shared/schema";
import { OPPORTUNITY_TYPES, OPPORTUNITY_TYPE_LABELS } from "@shared/opportunities";
import { MobileTreatmentReport } from "./mobile-treatment-report";
import { MobileShell, type MobileNavItem } from "./mobile-shell";
import { MobileFleetGuard } from "./mobile-fleet-guard";

type Screen = "dashboard" | "jobs" | "diaries" | "calendar" | "fleet" | "kmMorning" | "kmAfternoon" | "fuel" | "inspection" | "monthlyInspection" | "issue" | "opportunities";
type MobileJob = Job & { client: Client };
type Opportunity = {
  id: string; clientName: string; description: string; opportunityType: string; typeLabel: string;
  urgency: string; status: string; statusLabel: string; createdAt: string; photos: Array<{ id: string; fileUrl: string }>;
};

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
type FleetVehicle = {
  id: string;
  name: string;
  registration: string;
  latestOdometer: number | null;
  isAssigned: boolean;
};
type MyDayData = {
  workDate: string;
  events: Array<{
    id: string;
    type: "attendance" | "job" | "time_off" | "overtime" | "note";
    time: string;
    endTime?: string | null;
    title: string;
    subtitle?: string | null;
    status?: string | null;
  }>;
  totals: { vehicleDistanceKm: number; attendanceMinutes: number };
};

const authHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("mobile_session_token") ?? ""}`,
});

export function MobileTechnicianDashboard({ worker, onLogout }: { worker: Worker; onLogout: () => void }) {
  const [screen, setScreen] = useState<Screen>(() => {
    const requested = new URLSearchParams(window.location.search).get("screen");
    return requested === "fleet" || window.location.pathname === "/fleet" ? "fleet" : "dashboard";
  });
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Record<string, string>>({});
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [opportunityPhotos, setOpportunityPhotos] = useState<Array<{ fileUrl: string; fileName: string }>>([]);
  const [treatmentJobId, setTreatmentJobId] = useState<string | null>(null);
  const [fleetVehicles, setFleetVehicles] = useState<FleetVehicle[]>([]);
  const [myDay, setMyDay] = useState<MyDayData | null>(null);
  const [myDayDate, setMyDayDate] = useState(() => new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date()));

  const load = async () => {
    setLoading(true);
    try {
      const [response, fleetResponse] = await Promise.all([
        fetch("/api/mobile/dashboard", { headers: authHeaders() }),
        fetch("/api/mobile/fleet/vehicles", { headers: authHeaders() }),
      ]);
      if (!response.ok || !fleetResponse.ok) throw new Error(response.status === 401 || fleetResponse.status === 401 ? "Your mobile session has expired. Please sign in again." : "Unable to load your mobile dashboard.");
      const [dashboardData, fleetData] = await Promise.all([response.json(), fleetResponse.json()]);
      setData(dashboardData);
      setFleetVehicles(fleetData.vehicles ?? []);
      setForm(current => current.vehicleId ? current : { ...current, vehicleId: fleetData.assignedVehicleId || "" });
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load your mobile dashboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const loadOpportunities = async () => {
    const response = await fetch("/api/mobile/opportunities", { headers: authHeaders() });
    if (!response.ok) throw new Error("Unable to load your submitted opportunities.");
    setOpportunities(await response.json());
  };
  const loadMyDay = async (date = myDayDate) => {
    const response = await fetch(`/api/mobile/my-day?date=${encodeURIComponent(date)}`, { headers: authHeaders() });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Unable to load My Day.");
    setMyDay(result);
  };

  const jobs = data?.jobs ?? [];
  const isPestControlJob = (job: MobileJob) =>
    job.departmentId === "div-1" || /pest|fumig|rodent|cockroach/i.test(`${job.serviceType ?? ""} ${(job as any).service ?? ""}`);
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

  const chooseOpportunityJob = (jobId: string) => {
    const job = jobs.find(item => item.id === jobId);
    setForm(current => ({ ...current, sourceJobId: jobId, clientId: job?.clientId ?? "" }));
  };

  const chooseOpportunityPhotos = async (files: FileList | null) => {
    if (!files) return;
    const selected = Array.from(files).slice(0, 4 - opportunityPhotos.length);
    const images = await Promise.all(selected.map(file => new Promise<{ fileUrl: string; fileName: string }>((resolve, reject) => {
      if (!file.type.startsWith("image/") || file.size > 2_000_000) return reject(new Error("Use JPG/PNG images smaller than 2 MB."));
      const reader = new FileReader();
      reader.onload = () => resolve({ fileUrl: String(reader.result), fileName: file.name });
      reader.onerror = () => reject(new Error("Unable to read photo."));
      reader.readAsDataURL(file);
    })));
    setOpportunityPhotos(current => [...current, ...images].slice(0, 4));
  };

  const submitOpportunity = async () => {
    await submit("/api/mobile/opportunities", {
      ...form,
      estimatedValue: form.estimatedValue || undefined,
      photos: opportunityPhotos,
    }, "Opportunity submitted. The office team has been notified.");
    setOpportunityPhotos([]);
    await loadOpportunities();
  };

  const nav = (target: Screen) => {
    setScreen(target);
    setNotice("");
    setError("");
    if (target === "opportunities") {
      loadOpportunities().catch(err => setError(err instanceof Error ? err.message : "Unable to load your opportunities."));
    }
    if (target === "diaries") {
      loadMyDay().catch(err => setError(err instanceof Error ? err.message : "Unable to load My Day."));
    }
  };

  const screenTitle: Record<Screen, string> = {
    dashboard: "Dashboard", jobs: "My Jobs", diaries: "My Day", calendar: "Calendar", fleet: "Fleet",
    kmMorning: "Log Morning KMs", kmAfternoon: "Log Afternoon KMs", fuel: "Fuel Fill-up", inspection: "Vehicle Inspection", monthlyInspection: "Monthly Inspection", issue: "Report Issue", opportunities: "Additional Opportunities",
  };

  const mobileNavItems: MobileNavItem[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, onSelect: () => nav("dashboard") },
    { id: "jobs", label: "My Jobs", icon: ListChecks, onSelect: () => nav("jobs") },
    { id: "my-time", label: "My Time", icon: Clock3, href: "/my-overtime" },
    { id: "diaries", label: "My Day", icon: ClipboardPenLine, onSelect: () => nav("diaries") },
    { id: "calendar", label: "Calendar", icon: CalendarDays, onSelect: () => nav("calendar") },
    { id: "opportunities", label: "Additional Opportunities", icon: Lightbulb, onSelect: () => nav("opportunities") },
    { id: "fleet", label: "Fleet", icon: Truck, onSelect: () => nav("fleet") },
  ];
  const openFleetGuard = () => nav("fleet");
  const vehicleSelect = (
    <select required value={form.vehicleId ?? ""} onChange={event => setForm(current => ({ ...current, vehicleId: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm">
      <option value="">Select vehicle</option>
      {fleetVehicles.map(vehicle => <option key={vehicle.id} value={vehicle.id}>{vehicle.registration} — {vehicle.name}{vehicle.isAssigned ? " (assigned)" : ""}</option>)}
    </select>
  );

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
                {job.status === "in_progress" && !isPestControlJob(job) && <button onClick={() => updateStatus(job.id, "completed")} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700">Mark complete</button>}
                {isPestControlJob(job) && (job.status === "in_progress" || job.status === "completed") && <button onClick={() => setTreatmentJobId(job.id)} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100">{job.status === "completed" ? "View treatment report" : "Treatment report"}</button>}
              <button onClick={() => { chooseOpportunityJob(job.id); nav("opportunities"); }} className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">Report opportunity</button>
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
      <div className="space-y-4">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="text-sm font-semibold text-slate-700">Day
            <input type="date" value={myDayDate} onChange={event => {
              setMyDayDate(event.target.value);
              loadMyDay(event.target.value).catch(err => setError(err.message));
            }} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" />
          </label>
        </section>
        {!myDay ? <p className="rounded-xl bg-white p-5 text-sm text-slate-500">Loading your day…</p> : myDay.events.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">No JobFlow activity is recorded for this day.</p> :
          <div className="relative space-y-3 before:absolute before:bottom-4 before:left-[2.15rem] before:top-4 before:w-px before:bg-slate-200">
            {myDay.events.map(event => <article key={`${event.type}:${event.id}`} className="relative flex gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-xs font-bold text-red-700">{event.time || "—"}</div>
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-slate-900">{event.title}</p>{event.status && <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase text-slate-600">{event.status.replace("_", " ")}</span>}</div>{event.endTime && <p className="text-xs text-slate-500">{event.time}–{event.endTime}</p>}{event.subtitle && <p className="mt-1 text-sm text-slate-600">{event.subtitle}</p>}</div>
            </article>)}
          </div>}
        {myDay && <section className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-slate-900 p-4 text-white"><p className="text-xs text-slate-300">Attendance</p><p className="mt-1 font-bold">{Math.floor(myDay.totals.attendanceMinutes / 60)}h {myDay.totals.attendanceMinutes % 60}m</p></div><div className="rounded-xl bg-red-600 p-4 text-white"><p className="text-xs text-red-100">Vehicle KM</p><p className="mt-1 font-bold">{myDay.totals.vehicleDistanceKm.toLocaleString("en-ZA")} km</p></div></section>}
      </div>
    );
    if (screen === "fleet" || screen === "kmMorning" || screen === "kmAfternoon" || screen === "fuel" || screen === "inspection" || screen === "monthlyInspection" || screen === "issue") return <MobileFleetGuard worker={worker} mode={screen} onNavigate={target => nav(target)} onSaved={load} />;
    if (screen === "opportunities") return (
      <div className="space-y-4">
        <form className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm" onSubmit={(event) => { event.preventDefault(); submitOpportunity(); }}>
          <div><h2 className="font-semibold text-slate-900">Report an additional opportunity</h2><p className="mt-1 text-xs text-slate-500">Share a service need you notice at a client. The sales team will review it.</p></div>
          <select required value={form.sourceJobId ?? ""} onChange={event => chooseOpportunityJob(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm">
            <option value="">Select the job where you noticed it</option>
            {jobs.map(job => <option key={job.id} value={job.id}>{job.client?.name ?? job.title}</option>)}
          </select>
          <input readOnly value={jobs.find(job => job.id === form.sourceJobId)?.client?.name ?? ""} placeholder="Client is filled in from the selected job" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600" />
          <select required value={form.opportunityType ?? ""} onChange={event => setForm(current => ({ ...current, opportunityType: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm">
            <option value="">What additional service is needed?</option>
            {OPPORTUNITY_TYPES.map(type => <option key={type} value={type}>{OPPORTUNITY_TYPE_LABELS[type]}</option>)}
          </select>
          {form.opportunityType === "other" && input("customType", "Name the service", "text", true)}
          <select value={form.urgency ?? "normal"} onChange={event => setForm(current => ({ ...current, urgency: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"><option value="normal">Normal</option><option value="important">Important</option><option value="urgent">Urgent</option></select>
          {input("estimatedValue", "Estimated value (optional)", "number")}
          <textarea required placeholder="What did you notice? Include the client need, location, and useful details." value={form.description ?? ""} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} className="min-h-28 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-amber-400 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800"><Camera className="h-4 w-4" />Add up to 4 photos<input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={event => chooseOpportunityPhotos(event.target.files).catch(err => setError(err.message))} /></label>
          {opportunityPhotos.length > 0 && <div className="grid grid-cols-4 gap-2">{opportunityPhotos.map((photo, index) => <div key={photo.fileUrl} className="relative"><img src={photo.fileUrl} alt="" className="h-16 w-full rounded object-cover" /><button type="button" onClick={() => setOpportunityPhotos(current => current.filter((_, itemIndex) => itemIndex !== index))} className="absolute -right-1 -top-1 rounded-full bg-slate-900 px-1.5 text-xs text-white">×</button></div>)}</div>}
          <button className="w-full rounded-lg bg-amber-600 px-4 py-3 font-semibold text-white">Send opportunity to sales</button>
        </form>
        <section><h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-600">My submissions</h2>{opportunities.length === 0 ? <p className="rounded-xl bg-white p-4 text-sm text-slate-500">You have not submitted an opportunity yet.</p> : <div className="space-y-2">{opportunities.map(item => <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-3"><div className="flex items-start justify-between gap-2"><div><p className="font-semibold text-slate-900">{item.typeLabel}</p><p className="text-xs text-slate-500">{item.clientName}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">{item.statusLabel}</span></div><p className="mt-2 text-sm text-slate-600 line-clamp-2">{item.description}</p></article>)}</div>}</section>
      </div>
    );
    const metrics = data.metrics;
    return <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        {[["Jobs Today", metrics.jobsToday], ["Completed Today", metrics.completedToday], ["In Progress", metrics.inProgress], ["My Day Jobs", metrics.jobsToday]].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold text-slate-900">{value}</p></div>)}
      </div>
      <section><h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-600">Current Job</h2>{metrics.currentJob ? jobRows([metrics.currentJob]) : <p className="rounded-xl bg-slate-100 p-4 text-sm text-slate-600">No job is currently in progress.</p>}</section>
      <section><h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-600">My Jobs Today</h2>{jobRows(data.todayJobs)}</section>
      <section><h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-600">My Week</h2><p className="rounded-xl bg-white p-4 text-sm text-slate-600">{metrics.weekJobs.length} jobs scheduled for the next seven days.</p></section>
       <section><h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-600">Fleet</h2><button onClick={openFleetGuard} className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left font-semibold text-slate-700 shadow-sm hover:bg-red-50"><Truck className="h-5 w-5 text-red-600" /><span className="flex-1">FleetGuard · Fleet Management</span></button></section>
    </div>;
  }, [data, form, screen, opportunities, opportunityPhotos]);

  return <MobileShell
    title={treatmentJobId ? "Treatment Report" : screenTitle[screen]}
    workerName={worker.name}
    workerRole={worker.role}
    items={mobileNavItems}
    activeItem={treatmentJobId ? "jobs" : screen}
    onLogout={onLogout}
    headerAction={<button aria-label="Refresh dashboard" onClick={load} className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"><RefreshCw className="h-4 w-4" /></button>}
  >
    {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    {notice && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</div>}
    {treatmentJobId ? <MobileTreatmentReport jobId={treatmentJobId} onBack={() => setTreatmentJobId(null)} onCompleted={async () => { await load(); }} /> : loading ? <div className="rounded-xl border border-gray-200 bg-white py-20 text-center text-sm text-gray-500 shadow-sm">Loading your technician dashboard…</div> : content}
  </MobileShell>;
}