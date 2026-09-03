import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import {
  AlertTriangle, ArrowLeft, Bell, CalendarCheck2, CalendarDays, ChevronLeft, ChevronRight, ClipboardCheck,
  Fuel, Gauge, Camera, RefreshCw, CheckCircle2, Image as ImageIcon,
} from "lucide-react";
import type { Worker } from "@shared/schema";
import { FLEET_INSPECTION_CHECKS } from "@shared/fleet";
import { mobileFetch } from "@/lib/mobile-auth";
import { TERMINATORS_LOGO_IMAGE } from "@/components/terminators-logo";
import { buildFleetInspectionSubmission, canSelectFleetVehicle, fleetTodayVehicleConfirmed, normalizeFleetInspectionItems, type FleetInspectionApiItem, MOBILE_FLEET_OVERVIEW_LAYOUT } from "./mobile-fleet-contract";

type FleetMode = "fleet" | "kmMorning" | "kmAfternoon" | "fuel" | "inspection" | "monthlyInspection" | "issue";
type Log = { id: string; logDate: string; startOdometer: number; endOdometer: number; totalKm: number; businessKm: number; privateKm: number; notes?: string | null; isSelectedDay?: boolean };
type Overview = {
  vehicle: { id: string; name: string; registration: string; year?: string | number | null; make?: string | null; model?: string | null; selectedToday?: boolean; latestOdometer?: number | null } | null;
  kmLogs: Log[];
  fuelFillups: Array<{ id: string; fillDate: string; litres: string; cost: string; odometer: number; fuelType: string; isLegacyImported?: boolean; slipStatus?: string }>;
  inspections: Array<{ id: string; inspectionDate: string; overallResult: string; comments?: string | null }>;
  issues: Array<{ id: string; reportedAt: string; category: string; description: string; urgency: string; status: string }>;
  allowance?: { amount?: number; feedback?: string; privateKm?: number; remainingKm?: number } | null;
  monthlyCheck?: { due?: boolean; feedback?: string } | null;
  achievements?: Array<{ id?: string; title?: string; message?: string; label?: string }> | null;
  selectedToday?: boolean;
  dailyInspectionItems?: FleetInspectionApiItem[];
  monthlyInspectionItems?: FleetInspectionApiItem[];
  dailyInspectionTemplateId?: string | null;
  monthlyInspectionTemplateId?: string | null;
};
type SelectableVehicle = { id: string; name: string; registration: string; year?: string | number | null; make?: string | null; model?: string | null; isAssigned?: boolean; selectedToday?: boolean };

function vehicleDescription(vehicle: { name?: string | null; registration?: string | null; year?: string | number | null; make?: string | null; model?: string | null }) {
  const details = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ").trim();
  return `${details || vehicle.name || "Vehicle"} · ${vehicle.registration || "Registration pending"}`;
}

function inspectionChecksFromOverview(overview: Overview | null, monthly: boolean) {
  const returned = monthly ? overview?.monthlyInspectionItems : overview?.dailyInspectionItems;
  if (returned === undefined) return null;
  const templateId = monthly ? overview?.monthlyInspectionTemplateId : overview?.dailyInspectionTemplateId;
  return normalizeFleetInspectionItems(
    returned.map(item => ({ ...item, templateId: item.templateId ?? templateId })),
    !returned.length && templateId ? { templateId, labels: FLEET_INSPECTION_CHECKS } : null,
  );
}

const headers = () => ({ "Content-Type": "application/json" });
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const localTime = () => new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());
const datetimeFor = (date: string, time: string) => `${date}T${time}:00`;
const newSubmissionKey = () => crypto.randomUUID();

type FleetDetail = { title: string; lines: string[]; confirm?: { label: string; action: () => void } };
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
  onChangeVehicle,
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
  onChangeVehicle: () => void;
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
           <p className="whitespace-normal break-words text-sm font-bold text-slate-900">{worker.name}</p>
           <p className="whitespace-normal break-words text-sm text-slate-500">{overview?.vehicle ? vehicleDescription(overview.vehicle) : "No vehicle assigned"}</p>
        </div>
        <button type="button" className="shrink-0 text-sm font-bold text-blue-700 underline underline-offset-2" onClick={onChangeVehicle}>Change</button>
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
       <section className={`rounded-2xl border p-4 ${privateKm > 0 ? "border-amber-200 bg-amber-50 text-amber-950" : "border-emerald-200 bg-emerald-50 text-emerald-950"}`}>
         <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /><div>
           <p className="text-sm font-bold">Daily allowance</p>
           <p className="mt-1 text-sm">{overview?.allowance?.feedback ?? "Allowance status is unavailable right now. Your kilometres are still being recorded."}</p>
         </div></div>
       </section>
       {overview?.achievements?.map((achievement, index) => <section key={achievement.id ?? `${achievement.title}-${index}`} className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-950"><p className="text-xs font-bold uppercase tracking-wide text-blue-700">Achievement</p><p className="mt-1 font-bold">{achievement.title ?? achievement.label ?? "Fleet record milestone"}</p>{(achievement.message) && <p className="mt-1 text-sm">{achievement.message}</p>}</section>)}
       {morning && afternoon && <section className="rounded-2xl border border-emerald-200 bg-emerald-600 p-4 text-white shadow-sm"><div className="flex items-center gap-3"><CheckCircle2 className="h-6 w-6 shrink-0" /><div><p className="font-bold">Day captured</p><p className="text-sm text-emerald-50">Both readings are in. Thanks for keeping the fleet record current.</p></div></div></section>}
      <div className="grid grid-cols-2 gap-3"><button type="button" onClick={() => onNavigate("kmMorning")} className="rounded-xl bg-blue-600 px-3 py-4 text-sm font-bold text-white shadow-sm hover:bg-blue-700">Log Morning KMs</button><button type="button" onClick={() => onNavigate("kmAfternoon")} className="rounded-xl bg-blue-600 px-3 py-4 text-sm font-bold text-white shadow-sm hover:bg-blue-700">Log Afternoon KMs</button></div>
       <div className="space-y-2"><button type="button" onClick={() => onNavigate("inspection")} className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-left text-emerald-900"><ClipboardCheck className="h-5 w-5 text-emerald-600" /><span className="flex-1 font-semibold">Daily Vehicle Check</span><ChevronRight className="h-4 w-4 text-emerald-500" /></button><button type="button" onClick={() => onNavigate("monthlyInspection")} className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-left text-slate-900"><CalendarCheck2 className="h-5 w-5 text-slate-600" /><span className="flex-1 font-semibold">Monthly Inspection</span><ChevronRight className="h-4 w-4 text-slate-400" /></button><button type="button" onClick={() => onNavigate("fuel")} className="flex min-h-14 w-full items-center gap-3 rounded-xl bg-orange-500 p-4 text-left text-white shadow-sm hover:bg-orange-600"><Fuel className="h-5 w-5" /><span className="flex-1 font-bold">Log Fuel</span><ChevronRight className="h-4 w-4" /></button><button type="button" onClick={() => onNavigate("issue")} className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-left text-red-800"><AlertTriangle className="h-5 w-5 text-red-600" /><span className="flex-1 font-semibold">Report Fault</span><ChevronRight className="h-4 w-4 text-red-400" /></button></div>
    </>}
    {detail && <div role="dialog" aria-modal="true" aria-labelledby="fleet-detail-title" className="fixed inset-0 z-50 flex items-end bg-slate-950/40 p-4 sm:items-center sm:justify-center"><section className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"><h2 id="fleet-detail-title" className="text-lg font-bold">{detail.title}</h2>{detail.lines.map(line => <p key={line} className="mt-3 text-sm text-slate-600">{line}</p>)}{detail.confirm && <button type="button" onClick={detail.confirm.action} className="mt-5 w-full rounded-xl bg-blue-700 py-3 font-semibold text-white">{detail.confirm.label}</button>}<button type="button" onClick={() => setDetail(null)} className={`${detail.confirm ? "mt-2" : "mt-5"} w-full rounded-xl bg-slate-900 py-3 font-semibold text-white`}>{detail.confirm ? "Cancel" : "Close"}</button></section></div>}
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
  const [detail, setDetail] = useState<FleetDetail | null>(null);
  const [vehiclePicker, setVehiclePicker] = useState(false);
  const [vehicles, setVehicles] = useState<SelectableVehicle[]>([]);
  const [changingVehicle, setChangingVehicle] = useState(false);
  const [todayVehicleConfirmed, setTodayVehicleConfirmed] = useState<boolean | null>(null);
  const [fuelReview, setFuelReview] = useState(false);
  const activeInspectionEntries = useMemo(() => inspectionChecksFromOverview(overview, mode === "monthlyInspection"), [overview, mode]);
  const activeInspectionChecks = useMemo(() => activeInspectionEntries?.map(item => item.label) ?? [], [activeInspectionEntries]);
  const load = async () => {
    setLoading(true);
    try {
      const response = await mobileFetch(`/api/mobile/fleet/overview?date=${date}`, { headers: headers() });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Unable to load FleetGuard.");
       setOverview(payload);
       setTodayVehicleConfirmed(fleetTodayVehicleConfirmed(payload));
       setError("");
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to load FleetGuard."); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [date]);
  useEffect(() => {
    if ((mode === "inspection" || mode === "monthlyInspection") && activeInspectionEntries) {
      setForm(current => activeInspectionChecks.reduce((next, item) => ({
        ...next, [`check:${item}`]: current[`check:${item}`] ?? "pass",
      }), { ...current, templateId: activeInspectionEntries[0]?.templateId ?? current.templateId }));
    }
  }, [activeInspectionChecks, activeInspectionEntries, mode]);
  const openVehiclePicker = async () => {
    setError(""); setChangingVehicle(true);
    try {
      const response = await mobileFetch("/api/mobile/fleet/vehicles", { headers: headers() });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Unable to load vehicles.");
       setVehicles(payload.vehicles ?? []);
       const assigned = (payload.vehicles ?? []).find((vehicle: SelectableVehicle) => vehicle.isAssigned);
       setTodayVehicleConfirmed(fleetTodayVehicleConfirmed({ ...payload, vehicle: assigned }));
       setVehiclePicker(true);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to load vehicles."); }
    finally { setChangingVehicle(false); }
  };
  const chooseVehicle = async (vehicleId: string, confirmed = false) => {
    setChangingVehicle(true); setError("");
    try {
      const response = await mobileFetch("/api/mobile/fleet/selection", { method: "POST", headers: headers(), body: JSON.stringify({ vehicleId, confirmed }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Unable to change vehicle.");
      if (payload.requiresConfirmation) {
        const target = vehicles.find(vehicle => vehicle.id === vehicleId);
        setDetail({ title: "Confirm vehicle change", lines: [
          `${target?.registration || "This vehicle"} was selected today by ${payload.occupiedBy?.name || "another driver"}.`,
          payload.willSwap ? "Confirm to exchange your current vehicles." : "Confirm to transfer this vehicle to you.",
        ], confirm: { label: "Confirm change", action: () => chooseVehicle(vehicleId, true) } });
        // The detail dialog deliberately requires an explicit second action.
        setVehiclePicker(false);
        return;
      }
       setTodayVehicleConfirmed(true);
       setVehiclePicker(false); setDetail(null); setNotice(payload.swapped ? "Vehicles exchanged." : "Current vehicle confirmed for today.");
      await Promise.all([load(), onSaved()]);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to change vehicle."); }
    finally { setChangingVehicle(false); }
  };
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
       if (todayVehicleConfirmed === false) {
         await openVehiclePicker();
         throw new Error("Choose your vehicle for today before recording FleetGuard activity.");
       }
       const inspectionPayload = path === "/api/mobile/fleet/inspections" && activeInspectionEntries
         ? buildFleetInspectionSubmission(
           activeInspectionEntries,
           Object.fromEntries(activeInspectionEntries.map(item => [item.id, form[`check:${item.label}`] as "pass" | "fail"])),
           Object.fromEntries(activeInspectionEntries.map(item => [item.id, form[`note:${item.label}`]])),
           extra.inspectionType === "monthly" ? "monthly" : "daily",
         )
         : {};
       const response = await mobileFetch(path, { method: "POST", headers: headers(), body: JSON.stringify({ ...form, ...extra, ...inspectionPayload, vehicleId: overview.vehicle.id, idempotencyKey }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Unable to save this FleetGuard update.");
      setForm({}); setIdempotencyKey(newSubmissionKey()); setNotice(success); await Promise.all([load(), onSaved()]); onNavigate("fleet");
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to save this FleetGuard update."); }
  };
  if (mode === "fleet") return <><FleetOverview worker={worker} date={date} overview={overview} loading={loading} error={error} notice={notice} morning={morning} afternoon={afternoon} business={business} privateKm={privateKm} detail={detail} goDate={goDate} onNavigate={onNavigate} setDetail={setDetail} load={load} onChangeVehicle={openVehiclePicker} />{vehiclePicker && <div role="dialog" aria-modal="true" aria-label="Change vehicle" className="fixed inset-0 z-50 flex items-end bg-slate-950/40 p-4 sm:items-center sm:justify-center"><section className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"><h2 className="text-lg font-bold">Choose today&apos;s vehicle</h2><p className="mt-1 text-sm text-slate-600">Select your actual vehicle for today. Vehicles in use by another driver stay clickable and may ask for confirmation.</p><div className="mt-4 max-h-72 space-y-2 overflow-y-auto">{vehicles.map(vehicle => <button key={vehicle.id} type="button" disabled={changingVehicle || !canSelectFleetVehicle(Boolean(vehicle.isAssigned), Boolean(vehicle.selectedToday))} onClick={() => chooseVehicle(vehicle.id)} className="flex min-h-16 w-full items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 text-left disabled:opacity-50"><span className="min-w-0"><span className="block whitespace-normal break-words font-semibold">{vehicle.registration}</span><span className="block whitespace-normal break-words text-sm text-slate-500">{vehicle.name}</span></span><span className="shrink-0 text-xs font-bold text-blue-700">{vehicle.isAssigned && vehicle.selectedToday ? "Confirmed today" : vehicle.selectedToday ? "Review" : "Select"}</span></button>)}</div><button type="button" onClick={() => setVehiclePicker(false)} className="mt-4 w-full rounded-xl border border-slate-300 py-3 font-semibold">Cancel</button></section></div>}</>;
  const input = (name: string, label: string, required = false) => <label className="block text-sm font-semibold text-slate-700">{label}<input required={required} min="0" type="number" inputMode="decimal" value={form[name] ?? ""} onChange={e => set(name, e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 font-normal outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100" /></label>;
  const choosePhoto = (key: string) => (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 2_000_000) { setError("Use a JPG, PNG, or WebP image smaller than 2 MB."); event.target.value = ""; return; } const reader = new FileReader(); reader.onload = () => set(key, String(reader.result)); reader.readAsDataURL(file); };
   const FormShell = ({ title, children }: { title: string; children: ReactNode }) => <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><button type="button" onClick={() => onNavigate("fleet")} className="flex items-center gap-1 text-sm font-semibold text-slate-600"><ArrowLeft className="h-4 w-4" /> FleetGuard</button><div><h2 className="text-lg font-bold text-slate-900">{title}</h2><p className="whitespace-normal break-words text-sm text-slate-500">{overview?.vehicle ? vehicleDescription(overview.vehicle) : "No vehicle assigned"}</p></div>{error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}{loading ? <p className="text-sm text-slate-500">Loading vehicle details…</p> : !overview?.vehicle ? <button onClick={load} className="w-full rounded-xl border border-slate-300 py-3 font-semibold text-slate-700">Retry assigned vehicle</button> : children}</section>;
  if (mode === "kmMorning" || mode === "kmAfternoon") { const logType = mode === "kmMorning" ? "AM" : "PM"; return <FormShell title={`Log ${logType === "AM" ? "Morning" : "Afternoon"} KMs`}><p className="rounded-xl bg-orange-50 p-3 text-sm text-orange-900">Enter the current odometer only. JobFlow calculates kilometres from your daily AM and PM snapshots.</p>{input("odometer", `${logType === "AM" ? "Morning" : "Afternoon"} odometer`, true)}<button disabled={!form.odometer} onClick={() => submit("/api/mobile/fleet/km-logs", `${logType === "AM" ? "Morning" : "Afternoon"} kilometres logged.`, { logType, logDate: date })} className="w-full rounded-xl bg-slate-900 py-3 font-semibold text-white disabled:opacity-50">Save {logType === "AM" ? "morning" : "afternoon"} reading</button></FormShell>; }
  if (mode === "fuel") return <><FormShell title="Log fuel"><div className="rounded-xl bg-orange-500 p-3 text-sm font-medium text-white">Record fuel type, time, odometer and a photo of the slip.</div><div className="grid grid-cols-2 gap-3"><label className="block text-sm font-semibold text-slate-700">Date<input required type="date" value={form.date ?? date} onChange={e => set("date", e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 font-normal" /></label><label className="block text-sm font-semibold text-slate-700">Time<input required type="time" value={form.time ?? localTime()} onChange={e => set("time", e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 font-normal" /></label></div>{input("odometer", "Current odometer reading", true)}<div className="grid grid-cols-2 gap-3">{input("litres", "Litres", true)}{input("cost", "Rand amount", true)}</div><label className="block text-sm font-semibold text-slate-700">Fuel type<select required value={form.fuelType ?? ""} onChange={e => set("fuelType", e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 font-normal"><option value="" disabled>Select fuel type</option><option value="Petrol 93">Petrol 93</option><option value="Petrol 95">Petrol 95</option><option value="Diesel 10 ppm">Diesel 10 ppm</option><option value="Diesel 50 ppm">Diesel 50 ppm</option></select></label><label className="block rounded-xl border border-dashed border-orange-300 bg-orange-50 p-3 text-sm font-semibold text-orange-900"><ImageIcon className="mr-1 inline h-4 w-4" /> Fuel slip (required)<input required type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="mt-2 block w-full text-xs font-normal" onChange={choosePhoto("receiptPhoto")} />{form.receiptPhoto && <img src={form.receiptPhoto} alt="Original fuel slip preview" className="mt-3 h-28 w-full rounded-lg object-cover" />}</label><button disabled={!form.odometer || !form.litres || !form.cost || !form.fuelType || !form.receiptPhoto} onClick={() => setFuelReview(true)} className="w-full rounded-xl bg-orange-500 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Review fuel entry</button></FormShell>{fuelReview && <div role="dialog" aria-modal="true" aria-labelledby="fuel-review-title" className="fixed inset-0 z-50 flex items-end bg-slate-950/40 p-4 sm:items-center sm:justify-center"><section className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"><h2 id="fuel-review-title" className="text-lg font-bold text-slate-900">Check before saving</h2><p className="mt-1 text-sm text-slate-600">Make sure the original slip and figures are readable. This cannot be edited after submission.</p>{form.receiptPhoto && <img src={form.receiptPhoto} alt="Original fuel slip" className="mt-4 max-h-48 w-full rounded-xl border border-slate-200 object-contain" />}<div className="mt-4 space-y-1 text-sm text-slate-700"><p><strong>{form.fuelType}</strong> · {form.litres} L · R {form.cost}</p><p>Odometer {form.odometer} km · {form.date ?? date} at {form.time ?? localTime()}</p></div><button type="button" onClick={() => { setFuelReview(false); submit("/api/mobile/fleet/fuel-fillups", "Fuel fill-up logged.", { date: form.date ?? date, time: form.time ?? localTime() }); }} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-orange-500 font-bold text-white"><CheckCircle2 className="h-5 w-5" /> Save fuel entry</button><button type="button" onClick={() => setFuelReview(false)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 font-semibold text-slate-700">Back to edit</button></section></div>}</>;
  if ((mode === "inspection" || mode === "monthlyInspection") && (!activeInspectionEntries || !activeInspectionEntries.length)) return <FormShell title={mode === "monthlyInspection" ? "Monthly inspection" : "Daily vehicle check"}><div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"><p className="font-bold">Checklist unavailable</p><p className="mt-1">We could not load the active inspection checklist. Refresh before submitting.</p><button type="button" onClick={load} className="mt-3 font-bold text-blue-700 underline">Refresh checklist</button></div></FormShell>;
  if (mode === "inspection" || mode === "monthlyInspection") { const FLEET_INSPECTION_CHECKS = activeInspectionChecks!; const monthly = mode === "monthlyInspection"; const monthDue = overview?.monthlyCheck?.due === true; const monthlyKnown = overview?.monthlyCheck?.due !== undefined; const completed = FLEET_INSPECTION_CHECKS.every(item => form[`check:${item}`] === "pass" || form[`check:${item}`] === "fail"); const failed = FLEET_INSPECTION_CHECKS.filter(item => form[`check:${item}`] === "fail"); const items = FLEET_INSPECTION_CHECKS.map(name => ({ name, result: form[`check:${name}`], comments: form[`note:${name}`] || undefined, type: monthly ? "monthly" : "daily" })); return <FormShell title={monthly ? "Monthly inspection" : "Daily vehicle check"}>{monthly && (!monthlyKnown || !monthDue) ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"><p className="font-bold">{monthlyKnown ? "Monthly inspection is not due yet" : "Monthly inspection status unavailable"}</p><p className="mt-1">{overview?.monthlyCheck?.feedback ?? "We could not confirm the monthly schedule. Try again before submitting."}</p><button type="button" onClick={load} className="mt-3 font-bold text-blue-700 underline">Refresh status</button></div> : <><p className={`rounded-xl p-3 text-sm ${monthly ? "bg-blue-50 text-blue-900" : "bg-emerald-50 text-emerald-900"}`}>{monthly ? (overview?.monthlyCheck?.feedback ?? "Monthly check is due. Record it separately from your daily check.") : "Quick check: every item starts as Pass. Change only anything that needs attention."}</p>{FLEET_INSPECTION_CHECKS.map(name => <div key={name} className={`rounded-xl border p-3 ${form[`check:${name}`] === "fail" ? "border-red-200 bg-red-50" : "border-slate-200"}`}><div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold">{name}</span><div className="flex gap-2"><button type="button" onClick={() => set(`check:${name}`, "pass")} className={`rounded-lg px-2 py-1 text-xs font-bold ${form[`check:${name}`] === "pass" ? "bg-emerald-600 text-white" : "bg-white text-slate-600"}`}>Pass</button><button type="button" onClick={() => set(`check:${name}`, "fail")} className={`rounded-lg px-2 py-1 text-xs font-bold ${form[`check:${name}`] === "fail" ? "bg-red-600 text-white" : "bg-white text-slate-600"}`}>Fail</button></div></div>{form[`check:${name}`] === "fail" && <input value={form[`note:${name}`] ?? ""} onChange={e => set(`note:${name}`, e.target.value)} placeholder="What is wrong?" className="mt-2 w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm" />}</div>)}<textarea value={form.comments ?? ""} onChange={e => set("comments", e.target.value)} placeholder="Overall notes (optional)" className="min-h-24 w-full rounded-xl border border-slate-200 p-3 text-sm" /><button disabled={!completed} onClick={() => submit("/api/mobile/fleet/inspections", `${monthly ? "Monthly inspection" : "Daily vehicle check"} submitted.`, { overallResult: failed.length ? "fail" : "pass", items, inspectionType: monthly ? "monthly" : "daily", inspectionDate: datetimeFor(date, localTime()) })} className={`w-full rounded-xl py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${failed.length ? "bg-red-600" : monthly ? "bg-blue-600" : "bg-emerald-600"}`}>Submit {monthly ? "monthly inspection" : "check"}</button></>}</FormShell>; }
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