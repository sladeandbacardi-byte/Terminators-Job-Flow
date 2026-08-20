export const NORMAL_WORK_START_MINUTES = 8 * 60;
export const NORMAL_WORK_END_MINUTES = 16 * 60;

export function timeToMinutes(value: string): number | null {
  if (!/^\d{2}:\d{2}$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * Returns the time worked outside the fixed 08:00–16:00 normal-hours window.
 * Shifts must begin and finish on the same date; callers should reject an end
 * time that is not later than the start time.
 */
export function calculateOvertimeMinutes(startTime: string, finishTime: string): number | null {
  const start = timeToMinutes(startTime);
  const finish = timeToMinutes(finishTime);
  if (start === null || finish === null || finish <= start) return null;

  const beforeNormalHours = Math.max(0, Math.min(finish, NORMAL_WORK_START_MINUTES) - start);
  const afterNormalHours = Math.max(0, finish - Math.max(start, NORMAL_WORK_END_MINUTES));
  return beforeNormalHours + afterNormalHours;
}

export function formatOvertimeMinutes(minutes: number): string {
  const safeMinutes = Math.max(0, Math.round(minutes || 0));
  const hours = Math.floor(safeMinutes / 60);
  const remainder = safeMinutes % 60;
  if (hours === 0) return `${remainder} min`;
  if (remainder === 0) return `${hours} hr${hours === 1 ? "" : "s"}`;
  return `${hours} hr${hours === 1 ? "" : "s"} ${remainder} min`;
}