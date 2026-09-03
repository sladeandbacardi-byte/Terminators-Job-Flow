/**
 * Side-effect-free Fleet business rules.  Keeping these calculations here makes
 * the values used by dashboard, history, exports and recalculation jobs
 * identical, rather than allowing each endpoint to approximate them.
 */
export const JOHANNESBURG_TIME_ZONE = "Africa/Johannesburg";
export const WEEKDAY_ALLOWANCE = 50;
export const WEEKEND_ALLOWANCE = 100;

export type FleetDatedRecord = {
  id?: string;
  vehicleId: string;
  workerId?: string | null;
  date: Date | string;
  deletedAt?: Date | string | null;
};

export type FleetFuelRecord = FleetDatedRecord & {
  odometer: number;
  litres: number | string;
};

export type ConsumptionReading = {
  fillupId?: string;
  vehicleId: string;
  workerId?: string | null;
  fillDate: string;
  previousFillupId?: string;
  previousFillDate: string;
  distanceKm: number;
  litres: number;
  litresPer100Km: number;
};

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: JOHANNESBURG_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
});
const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: JOHANNESBURG_TIME_ZONE, weekday: "short",
});

function instant(value: Date | string): Date {
  const result = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(result.getTime())) throw new Error("A valid fleet date is required.");
  return result;
}

/** A calendar date in Johannesburg, never the host process timezone. */
export function johannesburgDay(value: Date | string): string {
  const parts = dayFormatter.formatToParts(instant(value));
  const item = (type: string) => parts.find(part => part.type === type)?.value;
  return `${item("year")}-${item("month")}-${item("day")}`;
}

export function johannesburgMonth(value: Date | string): string {
  return johannesburgDay(value).slice(0, 7);
}

export function allowanceForDate(value: Date | string): number {
  const weekday = weekdayFormatter.format(instant(value));
  return weekday === "Sat" || weekday === "Sun" ? WEEKEND_ALLOWANCE : WEEKDAY_ALLOWANCE;
}

export function allowanceFeedback(value: Date | string): string {
  return allowanceForDate(value) === WEEKEND_ALLOWANCE
    ? `Weekend allowance: R${WEEKEND_ALLOWANCE}.`
    : `Weekday allowance: R${WEEKDAY_ALLOWANCE}.`;
}

/** Due from the 25th until a non-deleted check is submitted in that month. */
export function monthlyCheckStatus(
  date: Date | string,
  checks: Array<Pick<FleetDatedRecord, "vehicleId" | "workerId" | "date" | "deletedAt">>,
  scope: { vehicleId?: string; workerId?: string } = {},
): { due: boolean; month: string; feedback: string } {
  const day = johannesburgDay(date);
  const month = day.slice(0, 7);
  if (Number(day.slice(8, 10)) < 25) {
    return { due: false, month, feedback: "Monthly vehicle check opens on the 25th." };
  }
  const submitted = checks.some(check =>
    !check.deletedAt
    && johannesburgMonth(check.date) === month
    && (!scope.vehicleId || check.vehicleId === scope.vehicleId)
    && (!scope.workerId || check.workerId === scope.workerId),
  );
  return submitted
    ? { due: false, month, feedback: "Monthly vehicle check is complete." }
    : { due: true, month, feedback: "Monthly vehicle check is due." };
}

/**
 * Consumption belongs to two consecutive, active fill-ups for the same
 * vehicle.  It deliberately never bridges a deleted entry or accepts a
 * rollback/duplicate odometer, since either would fabricate L/100 values.
 */
export function calculateFuelConsumption(fillups: FleetFuelRecord[]): ConsumptionReading[] {
  const byVehicle = new Map<string, FleetFuelRecord[]>();
  for (const fillup of fillups) {
    if (fillup.deletedAt) continue;
    const list = byVehicle.get(fillup.vehicleId) ?? [];
    list.push(fillup);
    byVehicle.set(fillup.vehicleId, list);
  }
  const readings: ConsumptionReading[] = [];
  for (const [vehicleId, records] of Array.from(byVehicle.entries())) {
    records.sort((a, b) => instant(a.date).getTime() - instant(b.date).getTime()
      || String(a.id ?? "").localeCompare(String(b.id ?? "")));
    for (let index = 1; index < records.length; index++) {
      const previous = records[index - 1];
      const current = records[index];
      const distanceKm = current.odometer - previous.odometer;
      const litres = Number(current.litres);
      if (!Number.isFinite(litres) || litres <= 0 || !Number.isFinite(distanceKm) || distanceKm <= 0) continue;
      readings.push({
        fillupId: current.id, vehicleId, workerId: current.workerId ?? null,
        fillDate: johannesburgDay(current.date), previousFillupId: previous.id,
        previousFillDate: johannesburgDay(previous.date), distanceKm, litres,
        litresPer100Km: (litres / distanceKm) * 100,
      });
    }
  }
  return readings;
}

export function consumptionSummary(readings: ConsumptionReading[]) {
  if (!readings.length) return { averageLPer100Km: null, bestLPer100Km: null, worstLPer100Km: null };
  const values = readings.map(reading => reading.litresPer100Km);
  return {
    averageLPer100Km: values.reduce((sum, value) => sum + value, 0) / values.length,
    bestLPer100Km: Math.min(...values),
    worstLPer100Km: Math.max(...values),
  };
}

export type FleetAchievement = { code: string; label: string; earnedAt: string };
/** Positive-only recognitions.  Faults/omissions never generate punitive badges. */
export function calculateFleetAchievements(input: {
  inspections: Array<{ inspectionDate: Date | string; overallResult: string; deletedAt?: Date | string | null }>;
  kmLogs: Array<{ logDate: Date | string; businessKm: number | null; deletedAt?: Date | string | null }>;
  consumption: ConsumptionReading[];
  now?: Date | string;
}): FleetAchievement[] {
  const now = input.now ?? new Date();
  const clean = input.inspections.filter(row => !row.deletedAt);
  const earned: FleetAchievement[] = [];
  if (clean.length) earned.push({ code: "checks-submitted", label: `${clean.length} vehicle checks submitted`, earnedAt: johannesburgDay(now) });
  if (clean.some(row => row.overallResult === "pass")) earned.push({ code: "zero-fault-check", label: "Zero-fault vehicle check", earnedAt: johannesburgDay(now) });
  const days = new Set(clean.filter(row => row.overallResult === "pass").map(row => johannesburgDay(row.inspectionDate)));
  if (days.size >= 5) earned.push({ code: "perfect-week", label: "Perfect check week", earnedAt: johannesburgDay(now) });
  const values = input.consumption.map(row => row.litresPer100Km);
  if (values.length >= 2 && values.at(-1)! < Math.min(...values.slice(0, -1))) {
    earned.push({ code: "personal-best-consumption", label: "Personal best fuel consumption", earnedAt: johannesburgDay(now) });
  }
  if (input.kmLogs.some(row => !row.deletedAt && row.businessKm !== null && row.businessKm <= 20)) {
    earned.push({ code: "low-business-km", label: "Low business KM day", earnedAt: johannesburgDay(now) });
  }
  return earned;
}