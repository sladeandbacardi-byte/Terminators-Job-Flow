import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import {
  AlertTriangle, ArrowLeft, Bell, CalendarCheck2, CalendarDays, ChevronLeft, ChevronRight, ClipboardCheck,
  Fuel, Gauge, Camera, RefreshCw,
} from "lucide-react";
import type { Worker } from "@shared/schema";
import { FLEET_INSPECTION_CHECKS } from "@shared/fleet";
import { mobileFetch } from "@/lib/mobile-auth";
import { TERMINATORS_LOGO_IMAGE } from "@/components/terminators-logo";
import { MOBILE_FLEET_OVERVIEW_LAYOUT } from "./mobile-fleet-contract";

type FleetMode = "fleet" | "kmMorning" | "kmAfternoon" | "fuel" | "inspection" | "monthlyInspection" | "issue";
type Log = { id: string; logDate: string; startOdometer: number; endOdometer: number; totalKm: number; businessKm: number; privateKm: number; notes?: string | null; isSelectedDay?: boolean };
type Overview = {
  vehicle: { id: string; name: string; registration: string; latestOdometer?: number | null } | null;
  kmLogs: Log[];
  fuelFillups: Array<{ id: string; fillDate: string; litres: string; cost: string; odometer: number; fuelType: string; isLegacyImported?: boolean; slipStatus?: string }>;
  inspections: Array<{ id: string; inspectionDate: string; overallResult: string; comments?: string | null }>;
  issues: Array<{ id: string; reportedAt: string; category: string; description: string; urgency: string; status: string }>;
};

const headers = () => ({ "Content-Type": "application/json" });
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const localTime = () => new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());
const datetimeFor = (date: string, time: string) => `${date}T${time}:00`;
const newSubmissionKey = () => crypto.randomUUID();

type FleetDetail = { title: string; lines: string[] };
type MobileKmSnapshot = { type: "AM" | "PM"; odometer: number; timestamp?: string };

function snapshotFromLog(log: Log | undefined, type: "AM" | "PM"): MobileKmSnapshot | undefined {
  if (!log?.notes) return undefined;
  try {
    const snapshots = JSON.parse(log.notes).snapshots;
    return Array.isArray(snapshots) ? snapshots.find((snapshot: MobileKmSnapshot) => snapshot.type === type) : undefined;
  } catch {
    return undefined;
  }
}

function FleetOverview({
  worker,
  date,
  overview,
  loading,
  error,
  notice,
  morning,
  afternoon,
  business,
  privateKm,
  detail,
  goDate,
  onNavigate,
  setDetail,
  load,
}: {
  worker: Worker;
  date: string;
  overview: Overview | null;
  loading: boolean;
  error: string;
  notice: string;
  morning: Log | undefined;
  afternoon: Log | undefined;
  business: number;
  privateKm: number;
  detail: FleetDetail | null;
  goDate: (days: number) => void;
  onNavigate: (mode: FleetMode) => void;
  setDetail: (detail: FleetDetail | null) => void;
  load: () => Promise<void>;
}) {
  const statusRow = (log: Log | undefined, label: "Morning" | "Afternoon") => {
    const period = label === "Morning" ? "AM" : "PM";
    const snapshot = snapshotFromLog(log, period);
    const odometer = snapshot?.odometer ?? log?.endOdometer;
    const time = snapshot?.timestamp ? new Date(snapshot.timestamp).toLocaleTimeString("en-ZA", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit" }) : "";
    return (
      <button
        key={label}
        type="button"
        onClick={() => log ? setDetail({ title: `${label} KM log`, lines: [`${odometer?.toLocaleString("en-ZA") ?? "—"} km${time ? ` recorded at ${time}` : ""}`, `Business: ${log.businessKm} km · Private: ${log.privateKm} km`] }) : onNavigate(label === "Morning" ? "kmMorning" : "kmAfternoon")}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-50"
      >
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${log ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500"}`}><Gauge className="h-4 w-4" /><span className="sr-only">{period}</span></span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-900">{label} reading</span>
          <span className="block truncate text-xs text-slate-500">{log ? `${odometer?.toLocaleString("en-ZA") ?? "—"} km${time ? ` · ${time}` : ""}` : `No ${label.toLowerCase()} reading recorded`}</span>
        </span>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${log ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500"}`}>{log ? "Logged" : "Pending"}</span>
      </button>
    );
  };

  return <div className="fleet-guard-screen space-y-4 pb-16" data-status-layout={MOBILE_FLEET_OVERVIEW_LAYOUT.statusRows}>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {notice && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}
    <header className="border-b border-slate-200 bg-white pb-3">
      <div className="relative flex min-h-12 items-center justify-center px-1">
        <img src={TERMINATORS_LOGO_IMAGE} alt="The Terminators" className="h-auto w-32 object-contain" />
        <button type="button" aria-label="View Fleet notifications" onClick={() => setDetail({ title: "Notifications", lines: ["Fleet alerts and review messages appear here.", "No new notifications."] })} className="absolute right-0 rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Bell className="h-5 w-5" /></button>
      </div>
      <div className="mt-2 flex items-end justify-between gap-3 px-1">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-900">{worker.name}</p>
          <p className="truncate text-sm text-slate-500">{overview?.vehicle ? `${overview.vehicle.registration} · ${overview.vehicle.name}` : "No vehicle assigned"}</p>
        </div>
        <button type="button" className="shrink-0 text-sm font-bold text-blue-700 underline underline-offset-2" onClick={() => setDetail({ title: "Assigned vehicle", lines: [overview?.vehicle ? `${overview.vehicle.registration} · ${overview.vehicle.name}` : "No active vehicle is assigned.", "Vehicle changes are managed by your supervisor."] })}>Change</button>
      </div>
    </header>
    <div className="flex items-center gap-2">
      <button type="button" aria-label="Previous day" onClick={() => goDate(-1)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><ChevronLeft className="h-5 w-5" /></button>
      <div className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5"><span className="flex min-w-0 items-center gap-2 text-sm font-medium text-slate-800"><CalendarDays className="h-4 w-4 shrink-0 text-slate-500" /><span className="truncate">{new Date(`${date}T12:00:00`).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })}</span></span><span className="shrink-0 text-sm text-slate-500">{date === today() ? "Today" : new Date(`${date}T12:00:00`).toLocaleDateString("en-ZA", { weekday: "long" })}</span></div>
      <button type="button" aria-label="Next day" onClick={() => goDate(1)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><ChevronRight className="h-5 w-5" /></button>
    </div>
    {loading ? <p className="rounded-xl border border-slate-200 bg-white p-5 text-center text-sm text-slate-500">Loading FleetGuard…</p> : error ? <section className="rounded-xl border border-red-200 bg-red-50 p-4 text-center"><p role="alert" className="text-sm text-red-700">{error}</p><button type="button" onClick={load} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-red-800"><RefreshCw className="h-4 w-4" /> Try again</button></section> : <>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-bold text-slate-900">Today&apos;s status</h2>
        <div className="divide-y divide-slate-200">{statusRow(morning, "Morning")}{statusRow(afternoon, "Afternoon")}</div>
      </section>
      <section className="grid grid-cols-2 gap-3"><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Business KM</p><p className="mt-1 text-2xl font-bold text-slate-900">{business} <span className="text-sm">km</span></p></div><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Private KM</p><p className="mt-1 text-2xl font-bold text-slate-900">{privateKm} <span className="text-sm">km</span></p></div></section>
      <p className={`rounded-xl p-3 text-sm ${privateKm > 0 ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-900"}`}>{privateKm > 0 ? `${privateKm} private km recorded. Your allowance will be reviewed with this log.` : "No private kilometres recorded. You're within your daily allowance."}</p>
      <div className="grid grid-cols-2 gap-3"><button type="button" onClick={() => onNavigate("kmMorning")} className="rounded-xl bg-blue-600 px-3 py-4 text-sm font-bold text-white shadow-sm hover:bg-blue-700">Log Morning KMs</button><button type="button" onClick={() => onNavigate("kmAfternoon")} className="rounded-xl bg-blue-600 px-3 py-4 text-sm font-bold text-white shadow-sm hover:bg-blue-700">Log Afternoon KMs</button></div>
      <div className="space-y-2"><button type="button" onClick={() => onNavigate("inspection")} className="flex w-full items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-left text-emerald-900"><ClipboardCheck className="h-5 w-5 text-emerald-600" /><span className="flex-1 font-semibold">Daily Vehicle Check</span><ChevronRight className="h-4 w-4 text-emerald-500" /></button><button type="button" onClick={() => onNavigate("monthlyInspection")} className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-left text-slate-900"><CalendarCheck2 className="h-5 w-5 text-slate-600" /><span className="flex-1 font-semibold">Monthly Inspection</span><ChevronRight className="h-4 w-4 text-slate-400" /></button><button type="button" onClick={() => onNavigate("fuel")} className="flex w-full items-center gap-3 rounded-xl bg-orange-500 p-4 text-left text-white shadow-sm hover:bg-orange-600"><Fuel className="h-5 w-5" /><span className="flex-1 font-bold">Log Fuel</span><ChevronRight className="h-4 w-4" /></button><button type="button" onClick={() => onNavigate("issue")} className="flex w-full items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-left text-red-800"><AlertTriangle className="h-5 w-5 text-red-600" /><span className="flex-1 font-semibold">Report Fault</span><ChevronRight className="h-4 w-4 text-red-400" /></button></div>
    </>}
    {detail && <div role="dialog" aria-modal="true" aria-labelledby="fleet-detail-title" className="fixed inset-0 z-50 flex items-end bg-slate-950/40 p-4 sm:items-center sm:justify-center"><section className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"><h2 id="fleet-detail-title" className="text-lg font-bold">{detail.title}</h2>{detail.lines.map(line => <p key={line} className="mt-3 text-sm text-slate-600">{line}</p>)}<button type="button" onClick={() => setDetail(null)} className="mt-5 w-full rounded-xl bg-slate-900 py-3 font-semibold text-white">Close</button></section></div>}
  </div>;
}

export function MobileFleetGuard({ worker, mode, onNavigate, onSaved }: { worker: Worker; mode: FleetMode; onNavigate: (mode: FleetMode) => void; onSaved: () => Promise<void> }) {
  const [date, setDate] = useState(today);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState<Record<string, string>>({});
  const [idempotencyKey, setIdempotencyKey] = useState(newSubmissionKey);
  const [detail, setDetail] = useState<{ title: string; lines: string[] } | null>(null);
  const load = async () => {
    setLoading(true);
    try {
      const response = await mobileFetch(`/api/mobile/fleet/overview?date=${date}`, { headers: headers() });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Unable to load FleetGuard.");
      setOverview(payload); setError("");
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to load FleetGuard."); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [date]);
  const selectedLogs = useMemo(() => overview?.kmLogs.filter(log => log.isSelectedDay) ?? [], [overview]);
  const snapshotLog = (type: "AM" | "PM") => selectedLogs.find(log => {
    try { return JSON.parse(log.notes || "{}").snapshots?.some((snapshot: { type?: string }) => snapshot.type === type); }
    catch { return false; }
  });
  const morning = snapshotLog("AM");
  const afternoon = snapshotLog("PM");
  const business = selectedLogs.reduce((sum, log) => sum + log.businessKm, 0);
  const privateKm = selectedLogs.reduce((sum, log) => sum + log.privateKm, 0);
  const goDate = (days: number) => setDate(current => {
    const d = new Date(`${current}T12:00:00`); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10);
  });
  const set = (name: string, value: string) => setForm(current => ({ ...current, [name]: value }));
  const submit = async (path: string, success: string, extra: Record<string, unknown> = {}) => {
    setError(""); setNotice("");
    try {
      if (!overview?.vehicle) throw new Error("You need an assigned vehicle before you can log FleetGuard activity.");
      const response = await mobileFetch(path, { method: "POST", headers: headers(), body: JSON.stringify({ ...form, ...extra, vehicleId: overview.vehicle.id, idempotencyKey }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Unable to save this FleetGuard update.");
      setForm({}); setIdempotencyKey(newSubmissionKey()); setNotice(success); await Promise.all([load(), onSaved()]); onNavigate("fleet");
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to save this FleetGuard update."); }
  };
  if (mode === "fleet") return <FleetOverview worker={worker} date={date} overview={overview} loading={loading} error={error} notice={notice} morning={morning} afternoon={afternoon} business={business} privateKm={privateKm} detail={detail} goDate={goDate} onNavigate={onNavigate} setDetail={setDetail} load={load} />;
  const input = (name: string, label: string, required = false) => <label className="block text-sm font-semibold text-slate-700">{label}<input required={required} min="0" type="number" inputMode="decimal" value={form[name] ?? ""} onChange={e => set(name, e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 font-normal outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100" /></label>;
  const choosePhoto = (key: string) => (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 2_000_000) { setError("Use a JPG, PNG, or WebP image smaller than 2 MB."); event.target.value = ""; return; } const reader = new FileReader(); reader.onload = () => set(key, String(reader.result)); reader.readAsDataURL(file); };
  const FormShell = ({ title, children }: { title: string; children: ReactNode }) => <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><button type="button" onClick={() => onNavigate("fleet")} className="flex items-center gap-1 text-sm font-semibold text-slate-600"><ArrowLeft className="h-4 w-4" /> FleetGuard</button><div><h2 className="text-lg font-bold text-slate-900">{title}</h2><p className="text-sm text-slate-500">{overview?.vehicle ? `${overview.vehicle.registration} · ${overview.vehicle.name}` : "No vehicle assigned"}</p></div>{error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}{loading ? <p className="text-sm text-slate-500">Loading vehicle details…</p> : !overview?.vehicle ? <button onClick={load} className="w-full rounded-xl border border-slate-300 py-3 font-semibold text-slate-700">Retry assigned vehicle</button> : children}</section>;
  if (mode === "kmMorning" || mode === "kmAfternoon") { const logType = mode === "kmMorning" ? "AM" : "PM"; return <FormShell title={`Log ${logType === "AM" ? "Morning" : "Afternoon"} KMs`}><p className="rounded-xl bg-orange-50 p-3 text-sm text-orange-900">Enter the current odometer only. JobFlow calculates kilometres from your daily AM and PM snapshots.</p>{input("odometer", `${logType === "AM" ? "Morning" : "Afternoon"} odometer`, true)}<button disabled={!form.odometer} onClick={() => submit("/api/mobile/fleet/km-logs", `${logType === "AM" ? "Morning" : "Afternoon"} kilometres logged.`, { logType, logDate: date })} className="w-full rounded-xl bg-slate-900 py-3 font-semibold text-white disabled:opacity-50">Save {logType === "AM" ? "morning" : "afternoon"} reading</button></FormShell>; }
  if (mode === "fuel") return <FormShell title="Log fuel"><div className="rounded-xl bg-orange-500 p-3 text-sm font-medium text-white">Record fuel type, time, odometer and a photo of the slip.</div><div className="grid grid-cols-2 gap-3"><label className="block text-sm font-semibold text-slate-700">Date<input required type="date" value={form.date ?? date} onChange={e => set("date", e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 font-normal" /></label><label className="block text-sm font-semibold text-slate-700">Time<input required type="time" value={form.time ?? localTime()} onChange={e => set("time", e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 font-normal" /></label></div>{input("odometer", "Current odometer reading", true)}<div className="grid grid-cols-2 gap-3">{input("litres", "Litres", true)}{input("cost", "Rand amount", true)}</div><label className="block text-sm font-semibold text-slate-700">Fuel type<select required value={form.fuelType ?? ""} onChange={e => set("fuelType", e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 font-normal"><option value="" disabled>Select fuel type</option><option value="Petrol 93">Petrol 93</option><option value="Petrol 95">Petrol 95</option><option value="Diesel 10 ppm">Diesel 10 ppm</option><option value="Diesel 50 ppm">Diesel 50 ppm</option></select></label><label className="block rounded-xl border border-dashed border-orange-300 bg-orange-50 p-3 text-sm font-semibold text-orange-900">Fuel slip photo (required)<input required type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="mt-2 block w-full text-xs font-normal" onChange={choosePhoto("receiptPhoto")} />{form.receiptPhoto && <span className="mt-2 block text-emerald-700">Slip photo attached</span>}</label><button disabled={!form.odometer || !form.litres || !form.cost || !form.fuelType || !form.receiptPhoto} onClick={() => submit("/api/mobile/fleet/fuel-fillups", "Fuel fill-up logged.", { date: form.date ?? date, time: form.time ?? localTime() })} className="w-full rounded-xl bg-orange-500 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Log fuel</button></FormShell>;
  if (mode === "inspection" || mode === "monthlyInspection") { const monthly = mode === "monthlyInspection"; const completed = FLEET_INSPECTION_CHECKS.every(item => form[`check:${item}`] === "pass" || form[`check:${item}`] === "fail"); const failed = FLEET_INSPECTION_CHECKS.filter(item => form[`check:${item}`] === "fail"); const items = FLEET_INSPECTION_CHECKS.map(name => ({ name, result: form[`check:${name}`], comments: form[`note:${name}`] || undefined, type: monthly ? "monthly" : "daily" })); return <FormShell title={monthly ? "Monthly inspection" : "Daily vehicle check"}><p className={`rounded-xl p-3 text-sm ${monthly ? "bg-blue-50 text-blue-900" : "bg-emerald-50 text-emerald-900"}`}>{monthly ? "Record the scheduled monthly inspection separately from your daily check." : "Complete every safety check before setting off."}</p>{FLEET_INSPECTION_CHECKS.map(name => <div key={name} className={`rounded-xl border p-3 ${form[`check:${name}`] === "fail" ? "border-red-200 bg-red-50" : "border-slate-200"}`}><div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold">{name}</span><div className="flex gap-2"><button type="button" onClick={() => set(`check:${name}`, "pass")} className={`rounded-lg px-2 py-1 text-xs font-bold ${form[`check:${name}`] === "pass" ? "bg-emerald-600 text-white" : "bg-white text-slate-600"}`}>Pass</button><button type="button" onClick={() => set(`check:${name}`, "fail")} className={`rounded-lg px-2 py-1 text-xs font-bold ${form[`check:${name}`] === "fail" ? "bg-red-600 text-white" : "bg-white text-slate-600"}`}>Fail</button></div></div>{form[`check:${name}`] === "fail" && <input value={form[`note:${name}`] ?? ""} onChange={e => set(`note:${name}`, e.target.value)} placeholder="What is wrong?" className="mt-2 w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm" />}</div>)}<textarea value={form.comments ?? ""} onChange={e => set("comments", e.target.value)} placeholder="Overall notes (optional)" className="min-h-24 w-full rounded-xl border border-slate-200 p-3 text-sm" /><button disabled={!completed} onClick={() => submit("/api/mobile/fleet/inspections", `${monthly ? "Monthly inspection" : "Daily vehicle check"} submitted.`, { overallResult: failed.length ? "fail" : "pass", items, inspectionType: monthly ? "monthly" : "daily", inspectionDate: datetimeFor(date, localTime()) })} className={`w-full rounded-xl py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${failed.length ? "bg-red-600" : monthly ? "bg-blue-600" : "bg-emerald-600"}`}>Submit {monthly ? "monthly inspection" : "check"}</button></FormShell>; }
  if (mode === "issue") return <FormShell title="Report a fault"><select value={form.category ?? "other"} onChange={e => set("category", e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm">{["other", "tyres", "engine", "brakes", "electrical", "lights", "fluids", "windscreen", "body"].map(x => <option key={x} value={x}>{x[0].toUpperCase() + x.slice(1)}</option>)}</select><select value={form.urgency ?? "medium"} onChange={e => set("urgency", e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="not_safe">Not safe to drive</option></select>{(form.urgency ?? "medium") === "not_safe" && <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">Park the vehicle safely and contact your manager immediately.</p>}<textarea required value={form.description ?? ""} onChange={e => set("description", e.target.value)} placeholder="Describe the fault and where you noticed it" className="min-h-28 w-full rounded-xl border border-slate-200 p-3 text-sm" /><label className="block rounded-xl border border-dashed border-slate-300 p-3 text-sm font-semibold text-slate-700"><Camera className="mr-1 inline h-4 w-4" /> Add fault photo (optional)<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="mt-2 block w-full text-xs font-normal" onChange={choosePhoto("photoUrl")} />{form.photoUrl && <span className="mt-2 block text-emerald-700">Fault photo attached</span>}</label><button disabled={(form.description ?? "").trim().length < 3} onClick={() => submit("/api/mobile/fleet/issues", "Fault reported to the fleet team.", { reportedAt: datetimeFor(date, localTime()) })} className="w-full rounded-xl bg-red-600 py-3 font-semibold text-white disabled:opacity-50">Report fault</button></FormShell>;
  /*
  return <div className="fleet-guard-screen space-y-4 pb-16">
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}{notice && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}
    <section className="overflow-hidden rounded-2xl bg-slate-950 text-white shadow-sm"><div className="border-b border-white/10 px-5 py-4"><div className="flex items-center justify-between"><span className="text-lg font-bold tracking-tight">Fleet<span className="text-orange-400">Guard</span></span><Truck className="h-5 w-5 text-orange-400" /></div><p className="mt-3 text-sm font-semibold">{driverLine}</p><div className="mt-3 flex items-center justify-between rounded-xl bg-white/10 px-3 py-2 text-sm"><span className="truncate">{overview?.vehicle ? `${overview.vehicle.registration} · ${overview.vehicle.name}` : "No vehicle assigned"}</span><button className="ml-3 shrink-0 font-bold text-orange-300 underline underline-offset-2" aria-label="View assigned vehicle" onClick={() => setDetail({ title: "Assigned vehicle", lines: [overview?.vehicle ? `${overview.vehicle.registration} · ${overview.vehicle.name}` : "No active vehicle is assigned.", "Vehicle changes are managed by your supervisor."] })}>Change</button></div></div><div className="flex items-center justify-between px-3 py-3"><button aria-label="Previous day" onClick={() => goDate(-1)} className="rounded-lg p-2 hover:bg-white/10"><ChevronLeft /></button><div className="text-center"><p className="text-sm font-bold">{formatDate(date)}</p><p className="text-xs text-slate-400">{date === today() ? "Today" : "Selected date"}</p></div><button aria-label="Next day" onClick={() => goDate(1)} className="rounded-lg p-2 hover:bg-white/10"><ChevronRight /></button></div></section>
    {loading ? <p className="rounded-xl bg-white p-5 text-center text-sm text-slate-500">Loading FleetGuard…</p> : error ? <section className="rounded-xl border border-red-200 bg-red-50 p-4 text-center"><p role="alert" className="text-sm text-red-700">{error}</p><button onClick={load} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-red-800"><RefreshCw className="h-4 w-4" /> Try again</button></section> : <><section><h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-600">Today&apos;s status</h2><div className="grid grid-cols-2 gap-3">{[[morning, "Morning"], [afternoon, "Afternoon"]].map(([log, label]) => <button key={String(label)} onClick={() => log ? setDetail({ title: `${label} KM log`, lines: [`${(log as Log).startOdometer.toLocaleString("en-ZA")} → ${(log as Log).endOdometer.toLocaleString("en-ZA")} km`, `Business: ${(log as Log).businessKm} km · Private: ${(log as Log).privateKm} km`] }) : onNavigate(label === "Morning" ? "kmMorning" : "kmAfternoon")} className={`rounded-2xl border p-4 text-left ${log ? "border-emerald-200 bg-emerald-50" : "border-orange-200 bg-orange-50"}`}><ShieldCheck className={`h-5 w-5 ${log ? "text-emerald-600" : "text-orange-500"}`} /><p className="mt-3 text-sm font-bold text-slate-900">{String(label)}</p><p className={`text-xs font-semibold ${log ? "text-emerald-700" : "text-orange-700"}`}>{log ? "Logged" : "Pending"}</p></button>)}</div></section>
    <section className="grid grid-cols-2 gap-3"><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Business KM</p><p className="mt-1 text-2xl font-bold text-slate-900">{business} <span className="text-sm">km</span></p></div><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Private KM</p><p className="mt-1 text-2xl font-bold text-slate-900">{privateKm} <span className="text-sm">km</span></p></div></section>
    <p className={`rounded-xl p-3 text-sm ${privateKm > 0 ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-900"}`}>{privateKm > 0 ? `${privateKm} private km recorded. Your allowance will be reviewed with this log.` : "No private kilometres recorded. You're within your daily allowance."}</p>
    <section className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center gap-2 text-slate-600"><Gauge className="h-5 w-5 text-orange-500" /><p className="text-sm font-semibold">Last odometer</p></div><p className="mt-2 text-2xl font-bold text-slate-900">{overview?.vehicle?.latestOdometer?.toLocaleString("en-ZA") ?? overview?.kmLogs[0]?.endOdometer?.toLocaleString("en-ZA") ?? "—"} <span className="text-sm font-medium">km</span></p></section>
    <div className="grid grid-cols-2 gap-3"><button onClick={() => onNavigate("kmMorning")} className="rounded-xl bg-slate-900 px-3 py-4 text-sm font-bold text-white">Log Morning KMs</button><button onClick={() => onNavigate("kmAfternoon")} className="rounded-xl border border-slate-300 bg-white px-3 py-4 text-sm font-bold text-slate-900">Log Afternoon KMs</button></div>
    <div className="space-y-2"><button onClick={() => onNavigate("inspection")} className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left"><ClipboardCheck className="h-5 w-5 text-emerald-600" /><span className="flex-1 font-semibold">Daily Vehicle Check</span><ChevronRight className="h-4 w-4 text-slate-400" /></button><button onClick={() => onNavigate("monthlyInspection")} className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left"><CalendarCheck2 className="h-5 w-5 text-blue-600" /><span className="flex-1 font-semibold">Monthly Inspection</span><ChevronRight className="h-4 w-4 text-slate-400" /></button><button onClick={() => onNavigate("fuel")} className="flex w-full items-center gap-3 rounded-xl bg-orange-500 p-4 text-left text-white"><Fuel className="h-5 w-5" /><span className="flex-1 font-bold">Log Fuel</span><ChevronRight className="h-4 w-4" /></button><button onClick={() => onNavigate("issue")} className="flex w-full items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-left"><AlertTriangle className="h-5 w-5 text-red-600" /><span className="flex-1 font-semibold text-red-800">Report Fault</span><ChevronRight className="h-4 w-4 text-red-400" /></button></div>
    <section><div className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-600"><History className="h-4 w-4" /> Recent activity</div>{overview?.kmLogs.slice(0, 3).map(log => <button key={`km-${log.id}`} onClick={() => setDetail({ title: "KM log", lines: [new Date(log.logDate).toLocaleDateString("en-ZA"), `${log.startOdometer} → ${log.endOdometer} km`, `Business ${log.businessKm} km · Private ${log.privateKm} km`] })} className="mb-2 flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white p-3 text-left"><span className="text-sm font-semibold">KM log · {new Date(log.logDate).toLocaleDateString("en-ZA")}</span><span className="text-sm text-slate-500">{log.totalKm} km</span></button>)}{overview?.fuelFillups.slice(0, 2).map(fill => <button key={`fuel-${fill.id}`} onClick={() => setDetail({ title: "Fuel fill-up", lines: [new Date(fill.fillDate).toLocaleString("en-ZA"), `${fill.fuelType} · ${fill.odometer.toLocaleString("en-ZA")} km`, `${Number(fill.litres).toFixed(1)} L · R ${Number(fill.cost).toFixed(2)}`, fill.slipStatus === "available" ? "Fuel slip is attached to this record." : "Legacy imported record — Slip unavailable from source."] })} className="mb-2 flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white p-3 text-left"><span className="text-sm font-semibold">Fuel · {fill.fuelType}{fill.isLegacyImported && fill.slipStatus !== "available" ? " · Legacy" : ""}</span><span className="text-sm text-slate-500">R {Number(fill.cost).toFixed(2)}</span></button>)}{overview?.inspections.slice(0, 2).map(inspection => <button key={`inspection-${inspection.id}`} onClick={() => setDetail({ title: "Vehicle inspection", lines: [new Date(inspection.inspectionDate).toLocaleString("en-ZA"), inspection.overallResult === "fail" ? "Faults found" : "All checks passed", inspection.comments || "No additional notes"] })} className="mb-2 flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white p-3 text-left"><span className="text-sm font-semibold">Inspection · {inspection.overallResult === "fail" ? "Fail" : "Pass"}</span><span className="text-sm text-slate-500">{new Date(inspection.inspectionDate).toLocaleDateString("en-ZA")}</span></button>)}{overview?.issues.slice(0, 2).map(issue => <button key={`issue-${issue.id}`} onClick={() => setDetail({ title: "Reported fault", lines: [issue.category, issue.description, `${issue.urgency.replace("_", " ")} · ${issue.status.replace("_", " ")}`] })} className="mb-2 flex w-full items-center justify-between rounded-xl border border-red-200 bg-red-50 p-3 text-left"><span className="text-sm font-semibold text-red-900">Fault · {issue.category}</span><span className="text-xs font-semibold text-red-700">{issue.status.replace("_", " ")}</span></button>)}{!overview?.kmLogs.length && !overview?.fuelFillups.length && !overview?.inspections.length && !overview?.issues.length && <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">No FleetGuard activity has been recorded yet.</p>}</section></>}
    {detail && <div role="dialog" aria-modal="true" aria-labelledby="fleet-detail-title" className="fixed inset-0 z-50 flex items-end bg-slate-950/40 p-4 sm:items-center sm:justify-center"><section className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"><h2 id="fleet-detail-title" className="text-lg font-bold">{detail.title}</h2>{detail.lines.map(line => <p key={line} className="mt-3 text-sm text-slate-600">{line}</p>)}<button onClick={() => setDetail(null)} className="mt-5 w-full rounded-xl bg-slate-900 py-3 font-semibold text-white">Close</button></section></div>}
  </div>;
  */
  return null;
}