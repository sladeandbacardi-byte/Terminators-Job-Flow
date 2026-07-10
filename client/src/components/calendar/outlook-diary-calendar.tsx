import { forwardRef, useImperativeHandle, useRef, useState, useCallback } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import type {
  EventClickArg, EventContentArg, EventHoveringArg, DateSelectArg, EventDropArg,
} from "@fullcalendar/core";
import type { EventResizeDoneArg } from "@fullcalendar/interaction";
import { format, differenceInMinutes } from "date-fns";
import type { DiaryEvent } from "@shared/calendar-types";
import { statusColorClasses } from "@shared/calendar-types";

// ─── Public types ────────────────────────────────────────────────────────────

export type OutlookCalView = "timeGridDay" | "timeGridWeek" | "dayGridMonth" | "listWeek";

export interface OutlookDiaryCalendarHandle {
  prev: () => void;
  next: () => void;
  today: () => void;
  getApi: () => ReturnType<FullCalendar["getApi"]> | undefined;
}

export interface OutlookDiaryCalendarProps {
  /** Standardized events (already filtered by the caller). */
  events: DiaryEvent[];
  /** Which FullCalendar view to render. Controlled by the parent page. */
  view: OutlookCalView;
  initialView?: OutlookCalView;
  slotMinTime?: string;
  slotMaxTime?: string;
  slotDuration?: string;
  /** Fired once FullCalendar computes the visible range's display title. */
  onDatesSet?: (title: string) => void;
  onEventClick?: (event: DiaryEvent) => void;
  /**
   * Called after a drag-move. Call `revert()` from the handler (or let the
   * returned promise reject) to snap the event back on failure/denial.
   */
  onEventDrop?: (event: DiaryEvent, newStart: Date, newEnd: Date, revert: () => void) => void;
  /** Called after a resize (duration change only, start stays the same). */
  onEventResize?: (event: DiaryEvent, newStart: Date, newEnd: Date, revert: () => void) => void;
  onSelect?: (start: Date, end: Date) => void;
  onEventMouseEnter?: (event: DiaryEvent, x: number, y: number) => void;
  onEventMouseLeave?: () => void;
  /** Custom Outlook-style block renderer. Defaults to a generic one below. */
  renderEventContent?: (event: DiaryEvent, viewType: string) => React.ReactNode;
  /** Per-event editability, used to gate drag/resize per the permission model. */
  isEventEditable?: (event: DiaryEvent) => boolean;
  height?: number | "auto";
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(min: number): string {
  if (min <= 0) return "";
  const h = Math.floor(min / 60), m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Default Outlook-style event block, generalized from the Sales Diary reference implementation. */
function defaultRenderEventContent(info: EventContentArg) {
  const ev = info.event.extendedProps.__diaryEvent as DiaryEvent;
  const color = ev.colour || "#64748b";
  const name = ev.clientName || ev.title || "Event";
  const subLabel = ev.serviceType || ev.department || "";
  const startStr = format(info.event.start!, "HH:mm");
  const endStr = info.event.end ? format(info.event.end, "HH:mm") : startStr;
  const dur = info.event.end ? differenceInMinutes(info.event.end, info.event.start!) : ev.durationMinutes;
  const durLabel = formatDuration(dur);
  const statusClasses = statusColorClasses(ev.status);
  const vType = info.view.type;

  if (vType === "dayGridMonth") {
    const label = subLabel && name !== subLabel ? `${name} – ${subLabel}` : name;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 3, padding: "1px 4px", overflow: "hidden", width: "100%" }}>
        <span style={{ fontSize: 10, color, fontWeight: 700, flexShrink: 0, lineHeight: 1.2 }}>{startStr}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.2 }}>
          {label}
        </span>
      </div>
    );
  }

  if (vType === "listWeek") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "2px 4px" }}>
        <strong style={{ color: "#111827", fontSize: 13 }}>{name}</strong>
        {subLabel && <span style={{ color: "#6b7280", fontSize: 12 }}>{subLabel}</span>}
        <span style={{ color, fontSize: 11, fontWeight: 600 }}>{startStr}–{endStr}{durLabel ? ` · ${durLabel}` : ""}</span>
        <span className={statusClasses} style={{ fontSize: 10, padding: "0 5px", borderRadius: 3, border: "1px solid" }}>{ev.status}</span>
      </div>
    );
  }

  // Time grid (day/week): Outlook-style block, priority time > name > sub-label > status
  if (dur <= 15) {
    return (
      <div style={{ padding: "0 4px", overflow: "hidden", height: "100%", display: "flex", alignItems: "center" }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {startStr} {name}
        </span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", padding: "2px 4px 2px 0", overflow: "hidden", height: "100%", gap: 1 }}>
      <span style={{ fontSize: 10, fontWeight: 600, color, whiteSpace: "nowrap", lineHeight: 1.2 }}>
        {startStr}–{endStr}{durLabel ? ` · ${durLabel}` : ""}
      </span>
      <span style={{ fontSize: 11, fontWeight: 700, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.3 }}>
        {name}
      </span>
      {dur >= 30 && subLabel && (
        <span style={{ fontSize: 10, color: "#4b5563", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.2 }}>
          {subLabel}
        </span>
      )}
      {dur >= 75 && (
        <span className={statusClasses} style={{ fontSize: 9, padding: "1px 4px", borderRadius: 3, border: "1px solid currentColor", display: "inline-block", marginTop: "auto", lineHeight: 1.4 }}>
          {ev.status}
        </span>
      )}
    </div>
  );
}

/**
 * Tie-break sort for same-time events (used primarily by the list view):
 * time (handled natively by FullCalendar) → route sequence → client/title name.
 */
function eventOrderComparator(a: any, b: any) {
  const evA = a?.extendedProps?.__diaryEvent as DiaryEvent | undefined;
  const evB = b?.extendedProps?.__diaryEvent as DiaryEvent | undefined;
  const seqA = evA?.meta?.routeSequence;
  const seqB = evB?.meta?.routeSequence;
  if (seqA != null && seqB != null && seqA !== seqB) return seqA - seqB;
  if (seqA != null && seqB == null) return -1;
  if (seqA == null && seqB != null) return 1;
  const nameA = evA?.clientName || evA?.title || "";
  const nameB = evB?.clientName || evB?.title || "";
  return nameA.localeCompare(nameB);
}

// ─── Component ───────────────────────────────────────────────────────────────

export const OutlookDiaryCalendar = forwardRef<OutlookDiaryCalendarHandle, OutlookDiaryCalendarProps>(function OutlookDiaryCalendar(
  {
    events, view, initialView, slotMinTime = "06:00:00", slotMaxTime = "19:00:00", slotDuration = "00:30:00",
    onDatesSet, onEventClick, onEventDrop, onEventResize, onSelect, onEventMouseEnter, onEventMouseLeave,
    renderEventContent, isEventEditable, height = "auto",
  },
  ref,
) {
  const calendarRef = useRef<FullCalendar>(null);

  useImperativeHandle(ref, () => ({
    prev: () => calendarRef.current?.getApi().prev(),
    next: () => calendarRef.current?.getApi().next(),
    today: () => calendarRef.current?.getApi().today(),
    getApi: () => calendarRef.current?.getApi(),
  }), []);

  const fcEvents = events.map(ev => ({
    id: ev.eventId,
    title: ev.clientName || ev.title,
    start: ev.startDateTime,
    end: ev.endDateTime,
    backgroundColor: (ev.colour || "#64748b") + "1a",
    borderColor: ev.colour || "#64748b",
    textColor: "#1f2937",
    editable: isEventEditable ? isEventEditable(ev) : ev.editable,
    startEditable: (isEventEditable ? isEventEditable(ev) : ev.editable) && ev.draggable,
    durationEditable: isEventEditable ? isEventEditable(ev) : ev.editable,
    extendedProps: { __diaryEvent: ev },
  }));

  const handleEventClick = useCallback((info: EventClickArg) => {
    info.jsEvent.preventDefault();
    onEventClick?.(info.event.extendedProps.__diaryEvent as DiaryEvent);
  }, [onEventClick]);

  const handleEventDrop = useCallback((info: EventDropArg) => {
    const ev = info.event.extendedProps.__diaryEvent as DiaryEvent;
    onEventDrop?.(ev, info.event.start!, info.event.end || info.event.start!, () => info.revert());
  }, [onEventDrop]);

  const handleEventResize = useCallback((info: EventResizeDoneArg) => {
    const ev = info.event.extendedProps.__diaryEvent as DiaryEvent;
    onEventResize?.(ev, info.event.start!, info.event.end!, () => info.revert());
  }, [onEventResize]);

  const handleSelect = useCallback((info: DateSelectArg) => {
    onSelect?.(info.start, info.end);
    calendarRef.current?.getApi().unselect();
  }, [onSelect]);

  const handleMouseEnter = useCallback((info: EventHoveringArg) => {
    const ev = info.event.extendedProps.__diaryEvent as DiaryEvent;
    onEventMouseEnter?.(ev, info.jsEvent.clientX, info.jsEvent.clientY);
  }, [onEventMouseEnter]);

  return (
    <div className="bg-white border rounded-xl overflow-hidden outlook-fc">
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
        initialView={initialView || view}
        headerToolbar={false}
        editable={true}
        selectable={!!onSelect}
        selectMirror={true}
        eventDurationEditable={true}
        eventStartEditable={true}
        snapDuration="00:15:00"
        slotDuration={slotDuration}
        slotLabelInterval="01:00"
        slotMinTime={slotMinTime}
        slotMaxTime={slotMaxTime}
        allDaySlot={false}
        nowIndicator={true}
        expandRows={true}
        height={height}
        contentHeight={height === "auto" ? 680 : undefined}
        firstDay={1}
        dayHeaderFormat={{ weekday: "short", day: "numeric" }}
        slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
        eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
        events={fcEvents}
        eventOrder={eventOrderComparator}
        eventContent={renderEventContent ? (info) => renderEventContent(info.event.extendedProps.__diaryEvent as DiaryEvent, info.view.type) : defaultRenderEventContent}
        eventClick={handleEventClick}
        eventDrop={handleEventDrop}
        eventResize={handleEventResize}
        eventMouseEnter={handleMouseEnter}
        eventMouseLeave={onEventMouseLeave}
        select={handleSelect}
        datesSet={(arg) => onDatesSet?.(arg.view.title)}
      />
    </div>
  );
});

// ─── Columns / Team view ─────────────────────────────────────────────────────
// A side-by-side card layout (one column per technician/team/rep), generalized
// from the Sales Diary's TeamView. Used wherever a resource/team column view is
// needed, since the resourceTimeGrid FullCalendar plugin is a paid add-on.

export interface OutlookColumn {
  id: string;
  label: string;
  sublabel?: string;
  events: DiaryEvent[];
}

export interface OutlookColumnsViewProps {
  columns: OutlookColumn[];
  onEventClick?: (event: DiaryEvent) => void;
  onEventMouseEnter?: (event: DiaryEvent, x: number, y: number) => void;
  onEventMouseLeave?: () => void;
  /** Called when an event is dropped onto a different column (reassignment). */
  onReassign?: (event: DiaryEvent, targetColumnId: string) => void;
  isEventDraggable?: (event: DiaryEvent) => boolean;
  renderCard?: (event: DiaryEvent) => React.ReactNode;
  emptyLabel?: string;
  minColumnWidth?: number;
}

function defaultRenderCard(ev: DiaryEvent) {
  const color = ev.colour || "#64748b";
  const start = format(new Date(ev.startDateTime), "HH:mm");
  const end = format(new Date(ev.endDateTime), "HH:mm");
  const dur = differenceInMinutes(new Date(ev.endDateTime), new Date(ev.startDateTime));
  const statusClasses = statusColorClasses(ev.status);
  return (
    <>
      <p className="text-xs font-bold text-gray-900 leading-tight truncate">{ev.clientName || ev.title}</p>
      {ev.serviceType && <p className="text-xs text-gray-500 truncate">{ev.serviceType}</p>}
      <p className="text-xs font-medium mt-0.5" style={{ color }}>
        {start}–{end}{dur > 0 ? ` · ${formatDuration(dur)}` : ""}
      </p>
      <span className={`text-xs px-1.5 py-0 rounded border inline-block mt-1 ${statusClasses}`}>{ev.status}</span>
    </>
  );
}

export function OutlookColumnsView({
  columns, onEventClick, onEventMouseEnter, onEventMouseLeave, onReassign,
  isEventDraggable, renderCard, emptyLabel = "No events", minColumnWidth = 220,
}: OutlookColumnsViewProps) {
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const dragRef = useRef<DiaryEvent | null>(null);

  return (
    <div className="grid gap-3 overflow-auto" style={{ gridTemplateColumns: `repeat(${Math.min(columns.length, 4)}, minmax(${minColumnWidth}px,1fr))` }}>
      {columns.map(col => {
        const isOver = dragOverColumn === col.id;
        return (
          <div
            key={col.id}
            className={`rounded-xl border-2 transition-colors ${isOver ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-white"}`}
            onDragOver={e => { if (!onReassign) return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverColumn(col.id); }}
            onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverColumn(null); }}
            onDrop={e => {
              e.preventDefault();
              const drag = dragRef.current;
              setDragOverColumn(null);
              dragRef.current = null;
              if (!drag || !onReassign) return;
              onReassign(drag, col.id);
            }}
          >
            <div className={`flex items-center gap-2 px-3 py-2.5 border-b rounded-t-xl ${isOver ? "border-blue-300 bg-blue-100" : "border-gray-100 bg-gray-50"}`}>
              <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700 flex-shrink-0">
                {col.label.charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-800 truncate">{col.label}</p>
                {col.sublabel && <p className="text-xs text-gray-400">{col.sublabel}</p>}
              </div>
              <span className="text-xs bg-gray-200 text-gray-700 rounded-full px-1.5 ml-auto flex-shrink-0">{col.events.length}</span>
            </div>
            {isOver && (
              <div className="mx-2 mt-2 rounded border-2 border-dashed border-blue-400 bg-blue-50/50 py-2 text-center text-xs text-blue-500 font-medium">
                Drop to reassign
              </div>
            )}
            <div className="p-2 space-y-1.5 min-h-[80px]">
              {col.events.length === 0 && !isOver && (
                <p className="text-xs text-gray-400 text-center py-5">{emptyLabel}</p>
              )}
              {col.events.map(ev => {
                const draggable = isEventDraggable ? isEventDraggable(ev) : ev.draggable;
                return (
                  <div
                    key={ev.eventId}
                    className="p-2 rounded-lg border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                    draggable={draggable && !!onReassign}
                    onDragStart={e => { e.stopPropagation(); dragRef.current = ev; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", ev.eventId); }}
                    onDragEnd={() => { dragRef.current = null; setDragOverColumn(null); }}
                    onClick={() => onEventClick?.(ev)}
                    onMouseEnter={e => onEventMouseEnter?.(ev, e.clientX, e.clientY)}
                    onMouseLeave={() => onEventMouseLeave?.()}
                  >
                    {(renderCard || defaultRenderCard)(ev)}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
