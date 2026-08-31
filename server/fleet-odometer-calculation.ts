export type OdometerSourceLog = {
  id: string;
  vehicleId: string;
  logDate: Date | string;
  startOdometer: number;
  endOdometer: number;
  businessKm: number;
  privateKm: number;
  totalKm: number;
  notes?: string | null;
  createdAt?: Date | string | null;
};

type Snapshot = { type: "AM" | "PM"; odometer: number; timestamp: string };
type Event = Snapshot & { logId: string; vehicleId: string; time: number; day: string };

export type OdometerCalculation = {
  status: "valid" | "flagged";
  privateKm: number | null;
  businessKm: number | null;
  totalKm: number | null;
  amOdometer: number | null;
  amDate: string | null;
  pmOdometer: number | null;
  pmDate: string | null;
  previousPmOdometer: number | null;
  previousPmDate: string | null;
  flags: string[];
};

const dayOf = (timestamp: string) => timestamp.slice(0, 10);
const validReading = (value: unknown): value is number =>
  Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 10_000_000;

function snapshotsFor(log: OdometerSourceLog): { snapshots: Snapshot[]; invalid: boolean } {
  try {
    const parsed = log.notes ? JSON.parse(log.notes) : null;
    if (Array.isArray(parsed?.snapshots)) {
      const snapshots = parsed.snapshots.filter((item: any) =>
        ["AM", "PM"].includes(item?.type) &&
        validReading(item?.odometer) &&
        !Number.isNaN(Date.parse(item?.timestamp))
      );
      return { snapshots, invalid: snapshots.length !== parsed.snapshots.length };
    }
  } catch {
    // Non-JSON notes are valid for manually entered logs.
  }
  const day = new Date(log.logDate).toISOString().slice(0, 10);
  const start = `${day}T06:00:00.000Z`;
  const snapshots = [
    { type: "AM", odometer: log.startOdometer, timestamp: start },
    { type: "PM", odometer: log.endOdometer, timestamp: `${day}T16:00:00.000Z` },
  ].filter(item => validReading(item.odometer)) as Snapshot[];
  return { snapshots, invalid: snapshots.length !== 2 };
}

export function calculateFleetOdometerLogs<T extends OdometerSourceLog>(
  logs: T[],
): Array<T & { odometerCalculation: OdometerCalculation; privateKm: number | null; businessKm: number | null; totalKm: number | null }> {
  const parsed = logs.map(log => ({ log, ...snapshotsFor(log) }));
  const invalidLogIds = new Set(parsed.filter(item => item.invalid).map(item => item.log.id));
  const events: Event[] = parsed.flatMap(({ log, snapshots }) => snapshots.map(snapshot => ({
    ...snapshot,
    logId: log.id,
    vehicleId: log.vehicleId,
    time: Date.parse(snapshot.timestamp),
    day: dayOf(snapshot.timestamp),
  }))).sort((a, b) => a.time - b.time);
  const validPmEvents = events.filter(pm => {
    if (pm.type !== "PM" || invalidLogIds.has(pm.logId)) return false;
    const sameLog = events.filter(event => event.logId === pm.logId);
    const ownPms = sameLog.filter(event => event.type === "PM");
    const ownAms = sameLog.filter(event => event.type === "AM");
    if (ownPms.length !== 1 || ownAms.length > 1) return false;
    return ownAms.length === 0 || (
      pm.time > ownAms[0].time &&
      pm.odometer >= ownAms[0].odometer
    );
  });

  return logs.map(log => {
    const own = events.filter(event => event.logId === log.id);
    const ams = own.filter(event => event.type === "AM");
    const pms = own.filter(event => event.type === "PM");
    const flags: string[] = [];
    if (invalidLogIds.has(log.id)) flags.push("INVALID_READING");
    if (ams.length === 0) flags.push("MISSING_AM");
    if (ams.length > 1) flags.push("DUPLICATE_AM");
    const am = ams.length === 1 ? ams[0] : null;
    const sameDayPms = am ? events.filter(event =>
      event.vehicleId === log.vehicleId && event.type === "PM" &&
      event.day === am.day && event.time > am.time
    ) : pms;
    if (sameDayPms.length === 0) flags.push("MISSING_PM");
    if (sameDayPms.length > 1) flags.push("DUPLICATE_PM");
    const pm = sameDayPms.length === 1 ? sameDayPms[0] : null;
    const previousPms = am ? validPmEvents.filter(event =>
      event.vehicleId === log.vehicleId && event.time < am.time
    ) : [];
    let previousPm = previousPms.at(-1) ?? null;
    if (previousPm && previousPms.filter(event => event.day === previousPm!.day).length > 1) {
      flags.push("DUPLICATE_PREVIOUS_PM");
      previousPm = null;
    }
    if (!previousPm) flags.push("MISSING_PREVIOUS_PM");

    let privateKm = am && previousPm ? am.odometer - previousPm.odometer : null;
    let businessKm = am && pm ? pm.odometer - am.odometer : null;
    if (privateKm !== null && privateKm < 0) {
      flags.push("PRIVATE_ODOMETER_ROLLBACK");
      privateKm = null;
    }
    if (businessKm !== null && businessKm < 0) {
      flags.push("BUSINESS_ODOMETER_ROLLBACK");
      businessKm = null;
    }
    if (flags.some(flag => flag.startsWith("DUPLICATE_"))) {
      privateKm = null;
      businessKm = null;
    }
    const totalKm = privateKm !== null && businessKm !== null ? privateKm + businessKm : null;
    const calculation: OdometerCalculation = {
      status: flags.length ? "flagged" : "valid",
      privateKm, businessKm, totalKm,
      amOdometer: am?.odometer ?? null,
      amDate: am?.timestamp ?? null,
      pmOdometer: pm?.odometer ?? null,
      pmDate: pm?.timestamp ?? null,
      previousPmOdometer: previousPm?.odometer ?? null,
      previousPmDate: previousPm?.timestamp ?? null,
      flags,
    };
    return { ...log, privateKm, businessKm, totalKm, odometerCalculation: calculation };
  });
}