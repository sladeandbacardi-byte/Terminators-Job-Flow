import { pool } from "./db";
import { escapeHtml, sendEmail } from "./email-service";

export const DEFAULT_FLEET_EMAIL_RECIPIENTS = [
  "julien@terminators.co.za",
  "accounts@terminators.co.za",
] as const;

export function fleetEmailRecipients(value = process.env.FLEET_NOTIFICATION_RECIPIENTS): string[] {
  if (!value?.trim()) return [...DEFAULT_FLEET_EMAIL_RECIPIENTS];
  const recipients = Array.from(new Set(value.split(/[;,]/).map(item => item.trim().toLowerCase()).filter(Boolean)));
  if (!recipients.length || recipients.some(item => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item))) {
    throw new Error("FLEET_NOTIFICATION_RECIPIENTS must contain valid comma-separated email addresses.");
  }
  return recipients;
}

export type FleetEmailKind = "fuel_fillup" | "inspection_failed" | "fault_reported" | "weekly_summary";

export type FleetEmail = {
  kind: FleetEmailKind;
  eventKey: string;
  subject: string;
  text: string;
  html: string;
};

const fromAddress = () =>
  process.env.FLEET_NOTIFICATION_EMAIL_FROM?.trim() ||
  process.env.SENDGRID_FROM_EMAIL?.trim() ||
  "info@terminators.co.za";

const display = (value: unknown) => String(value ?? "—").trim() || "—";
const money = (value: unknown) => `R${Number(value || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function template(kind: FleetEmailKind, eventKey: string, subject: string, lines: Array<[string, unknown]>): FleetEmail {
  const body = lines.map(([label, value]) => `${label}: ${display(value)}`).join("\n");
  const rows = lines.map(([label, value]) =>
    `<tr><td style="padding:7px 12px 7px 0;font-weight:bold;border-bottom:1px solid #e5e7eb">${escapeHtml(label)}</td><td style="padding:7px 0;border-bottom:1px solid #e5e7eb">${escapeHtml(display(value))}</td></tr>`,
  ).join("");
  return {
    kind, eventKey, subject,
    text: `${subject}\n\n${body}\n\nSent automatically by JobFlow Fleet.`,
    html: `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.5"><h2 style="color:#dc2626">${escapeHtml(subject)}</h2><table style="border-collapse:collapse;width:100%;max-width:640px">${rows}</table><p style="font-size:12px;color:#6b7280">Sent automatically by JobFlow Fleet.</p></body></html>`,
  };
}

/** No station field is accepted or rendered for fuel notifications. */
export function fleetFuelEmail(fillup: { id: string; vehicleId: string; workerId: string; fillDate: Date; odometer: number; litres: string; cost: string; fuelType: string }): FleetEmail {
  return template("fuel_fillup", `fleet:fuel:${fillup.id}`, `JobFlow Fleet - Fuel Fill-up - ${display(fillup.vehicleId)}`, [
    ["Vehicle", fillup.vehicleId], ["Driver", fillup.workerId],
    ["Date", new Date(fillup.fillDate).toLocaleString("en-ZA")], ["Odometer", `${Number(fillup.odometer).toLocaleString("en-ZA")} km`],
    ["Fuel type", fillup.fuelType], ["Litres", `${Number(fillup.litres).toFixed(2)} L`], ["Amount", money(fillup.cost)],
  ]);
}

export function failedInspectionEmail(inspection: { id: string; vehicleId: string; workerId: string; inspectionDate: Date; comments?: string | null; itemsJson?: string | null }): FleetEmail {
  let failedItems = "No item detail supplied";
  try {
    const items = JSON.parse(inspection.itemsJson || "[]");
    failedItems = items.filter((item: any) => item?.result === "fail").map((item: any) =>
      `${display(item.name)}${item.comments ? `: ${display(item.comments)}` : ""}`,
    ).join("; ") || failedItems;
  } catch { /* validation of the submitted inspection is handled by its route */ }
  return template("inspection_failed", `fleet:inspection-failed:${inspection.id}`, `JobFlow Fleet - Inspection Failed - ${display(inspection.vehicleId)}`, [
    ["Vehicle", inspection.vehicleId], ["Driver", inspection.workerId], ["Date", new Date(inspection.inspectionDate).toLocaleString("en-ZA")],
    ["Failed items", failedItems], ["Comments", inspection.comments],
  ]);
}

export function fleetFaultEmail(issue: { id: string; vehicleId: string; workerId: string; reportedAt: Date; category: string; description: string; urgency: string }): FleetEmail {
  return template("fault_reported", `fleet:fault:${issue.id}`, `JobFlow Fleet - Fault Reported - ${display(issue.vehicleId)}`, [
    ["Vehicle", issue.vehicleId], ["Reported by", issue.workerId], ["Reported", new Date(issue.reportedAt).toLocaleString("en-ZA")],
    ["Category", issue.category], ["Urgency", issue.urgency], ["Description", issue.description],
  ]);
}

export function fleetWeeklySummaryEmail(summary: { subject: string; text?: string; html?: string }, date = new Date()): FleetEmail {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  start.setUTCDate(start.getUTCDate() + 4 - (start.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(start.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((start.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
  return {
    kind: "weekly_summary",
    eventKey: `fleet:weekly-summary:${start.getUTCFullYear()}-${week}`,
    subject: summary.subject,
    text: summary.text || summary.subject,
    html: summary.html || `<p>${escapeHtml(summary.subject)}</p>`,
  };
}

/** The unique event key makes concurrent or repeated route calls a single durable enqueue. */
export async function enqueueFleetEmail(email: FleetEmail): Promise<boolean> {
  const result = await pool.query(
    `INSERT INTO fleet_email_outbox (event_key, kind, recipients, subject, text_body, html_body)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (event_key) DO NOTHING
     RETURNING id`,
    [email.eventKey, email.kind, fleetEmailRecipients(), email.subject, email.text, email.html],
  );
  return result.rowCount === 1;
}

export const retryDelaySeconds = (attempt: number) => Math.min(6 * 60 * 60, 60 * 2 ** Math.max(0, attempt - 1));
export const fleetMessageId = (eventKey: string) => `<${Buffer.from(eventKey).toString("base64url")}@jobflow-fleet>`;

/**
 * Claims rows atomically so multiple Railway instances cannot deliver the same
 * queued row concurrently. SMTP delivery is inherently at-least-once if the
 * provider accepts a message but its acknowledgement is lost; a deterministic
 * Message-ID lets compliant providers and recipients collapse retry duplicates.
 * Delivery is opt-in to prevent accidental production sends until enabled.
 */
export async function processFleetEmailOutbox(limit = 10): Promise<number> {
  if (process.env.FLEET_EMAIL_DELIVERY_ENABLED !== "true") return 0;
  const claimed = await pool.query(
    `WITH candidates AS (
       SELECT id FROM fleet_email_outbox
       WHERE sent_at IS NULL AND next_attempt_at <= now()
         AND (locked_at IS NULL OR locked_at < now() - interval '10 minutes')
       ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT $1
     )
     UPDATE fleet_email_outbox o SET locked_at = now(), attempts = o.attempts + 1
     FROM candidates WHERE o.id = candidates.id
      RETURNING o.id, o.event_key, o.recipients, o.subject, o.text_body, o.html_body, o.attempts`,
    [limit],
  );
  for (const row of claimed.rows) {
    try {
      await sendEmail({ to: row.recipients.join(", "), from: fromAddress(), subject: row.subject, text: row.text_body, html: row.html_body, headers: { "Message-ID": fleetMessageId(row.event_key ?? row.id) } });
      await pool.query(`UPDATE fleet_email_outbox SET sent_at = now(), locked_at = NULL, last_error = NULL WHERE id = $1`, [row.id]);
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 1000) : "Fleet email delivery failed";
      await pool.query(
        `UPDATE fleet_email_outbox SET locked_at = NULL, last_error = $2,
         next_attempt_at = now() + ($3 * interval '1 second') WHERE id = $1`,
        [row.id, message, retryDelaySeconds(row.attempts)],
      );
    }
  }
  return claimed.rowCount || 0;
}

export function startFleetEmailOutboxWorker(): void {
  if (process.env.FLEET_EMAIL_DELIVERY_ENABLED !== "true") return;
  const tick = () => processFleetEmailOutbox().catch(error => console.error("[fleet-email-outbox] processing failed:", error instanceof Error ? error.message : error));
  tick();
  setInterval(tick, 60_000).unref();
}