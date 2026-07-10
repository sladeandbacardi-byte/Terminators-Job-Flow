// ─── Shared Outlook-style Calendar / Diary Types ────────────────────────────
// Standard event shape used by every diary/calendar area in the app
// (Sales Diary, Service Calendar, Daily Diaries, Technician Diary,
// Contract Schedule View). All calendar views must convert their records
// into this shape before handing them to <OutlookDiaryCalendar />.

export const SOURCE_TYPES = [
  "salesAppointment",
  "followUp",
  "quoteVisit",
  "onceOffJob",
  "serviceContractOccurrence",
  "rentalContractOccurrence",
  "treatmentReport",
  "fleetTask",
  "inspection",
  "other",
] as const;

export type CalendarSourceType = typeof SOURCE_TYPES[number];

export type DiaryEventStatus =
  | "scheduled"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "overdue"
  | "requires_confirmation"
  | "ready_to_invoice"
  | "invoiced"
  | string; // tolerate source-specific status strings not yet mapped

export interface DiaryEvent {
  eventId: string;
  sourceType: CalendarSourceType;
  sourceId: string;
  clientId?: string | null;
  title: string;
  clientName?: string | null;
  department?: string | null;
  serviceType?: string | null;
  assignedUserId?: string | null;
  assignedUserName?: string | null;
  assignedTeamId?: string | null;
  assignedTeamName?: string | null;
  startDateTime: string; // ISO datetime
  endDateTime: string;   // ISO datetime
  durationMinutes: number;
  status: DiaryEventStatus;
  priority?: string | null;
  location?: string | null;
  googleMapsLink?: string | null;
  colour?: string;
  editable: boolean;
  draggable: boolean;
  // Extra bag for source-specific fields the detail dialogs need
  // (route sequence, contract number, invoice status, raw record, etc.)
  meta?: Record<string, any>;
}

// ─── Standard status colour palette (used everywhere) ───────────────────────
// Keep in sync with STATUS_COLOR_CLASSES below.
export const STATUS_COLORS: Record<string, string> = {
  scheduled: "#3b82f6",              // blue
  planned: "#3b82f6",
  confirmed: "#3b82f6",
  in_progress: "#f59e0b",            // orange
  completed: "#22c55e",              // green
  cancelled: "#ef4444",              // red
  overdue: "#ef4444",
  not_completed: "#ef4444",
  no_show: "#ef4444",
  requires_confirmation: "#eab308",  // yellow
  rescheduled: "#eab308",
  ready_to_invoice: "#a855f7",       // purple
  invoiced: "#6b7280",               // grey
};

// Tailwind badge classes matching STATUS_COLORS, for pages that render
// <Badge> components instead of raw FullCalendar colours.
export const STATUS_COLOR_CLASSES: Record<string, string> = {
  scheduled: "bg-blue-50 text-blue-700 border-blue-200",
  planned: "bg-blue-50 text-blue-700 border-blue-200",
  confirmed: "bg-blue-50 text-blue-700 border-blue-200",
  in_progress: "bg-orange-50 text-orange-700 border-orange-200",
  completed: "bg-green-50 text-green-700 border-green-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
  overdue: "bg-red-50 text-red-700 border-red-200",
  not_completed: "bg-red-50 text-red-700 border-red-200",
  no_show: "bg-red-50 text-red-700 border-red-200",
  requires_confirmation: "bg-yellow-50 text-yellow-700 border-yellow-200",
  rescheduled: "bg-yellow-50 text-yellow-700 border-yellow-200",
  ready_to_invoice: "bg-purple-50 text-purple-700 border-purple-200",
  invoiced: "bg-gray-100 text-gray-600 border-gray-200",
};

export function statusColor(status: string | null | undefined): string {
  if (!status) return "#64748b";
  return STATUS_COLORS[status] || "#64748b";
}

export function statusColorClasses(status: string | null | undefined): string {
  if (!status) return "bg-gray-50 text-gray-600 border-gray-200";
  return STATUS_COLOR_CLASSES[status] || "bg-gray-50 text-gray-600 border-gray-200";
}
