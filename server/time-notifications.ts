import nodemailer from "nodemailer";
import { sendEmail } from "./email-service";
import {
  EMAIL_BRANDING_SENDGRID_ATTACHMENTS,
  EMAIL_BRANDING_SMTP_ATTACHMENTS,
  withEmailBranding,
} from "./email-branding";
import { formatOvertimeMinutes } from "@shared/overtime";
import { TIME_OFF_REASON_LABELS, type TimeOffReason } from "@shared/schema";

type TimeEntry = {
  id: string;
  entryType?: string | null;
  employeeId: string;
  workDate: string;
  startTime: string;
  finishTime: string;
  beforeHoursMinutes?: number | null;
  afterHoursMinutes?: number | null;
  overtimeMinutes: number;
  notes?: string | null;
  customerName?: string | null;
  clientName?: string | null;
  jobNumber?: string | null;
  jobLabel?: string | null;
  timeOffReason?: string | null;
  timeOffOtherReason?: string | null;
  status: string;
  approvedByName?: string | null;
};
type TimeNotificationProviderResponse = {
  provider: "smtp" | "sendgrid";
  messageId?: string;
  accepted?: string[];
  rejected?: string[];
  response?: string;
};

export type TimeNotificationDelivery = {
  recipient: string;
  sent: boolean;
  error?: string;
  providerResponse?: TimeNotificationProviderResponse;
};

// Keep one shared recipient list so Overtime and Time Off cannot drift apart.
export const TIME_NOTIFICATION_RECIPIENTS = [
  "julien@terminators.co.za",
  "accounts@terminators.co.za",
] as const;

const sender = () =>
  process.env.TIME_NOTIFICATION_EMAIL_FROM?.trim() ||
  process.env.BACKUP_EMAIL_FROM?.trim() ||
  process.env.SENDGRID_FROM_EMAIL?.trim() ||
  "info@terminators.co.za";

async function deliverEmail(params: { to: string; from: string; subject: string; text: string; html: string }): Promise<TimeNotificationProviderResponse> {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (host && user && pass) {
    const port = Number(process.env.SMTP_PORT || "587");
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 10000,
    });
    const result = await transporter.sendMail({
      ...params,
      html: withEmailBranding(params.html),
      attachments: [...EMAIL_BRANDING_SMTP_ATTACHMENTS],
    });
    return {
      provider: "smtp",
      messageId: result.messageId,
      accepted: (result.accepted || []).map(String),
      rejected: (result.rejected || []).map(String),
      response: result.response,
    };
  }
  await sendEmail({
    ...params,
    html: withEmailBranding(params.html),
    attachments: [...EMAIL_BRANDING_SENDGRID_ATTACHMENTS],
  });
  return {
    provider: "sendgrid",
    accepted: params.to.split(",").map(value => value.trim()).filter(Boolean),
  };
}

const escapeHtml = (value: unknown) => String(value ?? "—")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#039;");

const formatDate = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString("en-ZA", { day: "2-digit", month: "2-digit", year: "numeric" });

const entryUrl = (entry: TimeEntry, baseUrl?: string) => {
  const path = entry.entryType === "AUTHORISED_TIME_OFF"
    ? `/overtime-approval?entry=${encodeURIComponent(entry.id)}&type=AUTHORISED_TIME_OFF`
    : `/overtime-approval?entry=${encodeURIComponent(entry.id)}&type=OVERTIME`;
  return `${(baseUrl || "").replace(/\/$/, "")}${path}`;
};

export async function sendTimeAdjustmentNotification(
  entry: TimeEntry,
  employeeName: string,
  options: { baseUrl?: string; approvedByName?: string | null } = {},
): Promise<TimeNotificationDelivery[]> {
  const isTimeOff = entry.entryType === "AUTHORISED_TIME_OFF";
  const isApproved = isTimeOff && entry.status === "approved";
  const notificationType = isTimeOff ? "AUTHORISED_TIME_OFF" : "OVERTIME";
  const notificationTo = TIME_NOTIFICATION_RECIPIENTS.join(", ");
  const reason = entry.timeOffReason === "other"
    ? entry.timeOffOtherReason || "Other"
    : (TIME_OFF_REASON_LABELS[entry.timeOffReason as TimeOffReason] || entry.timeOffReason || "—");
  const link = entryUrl(entry, options.baseUrl);
  const subject = isApproved
    ? `JobFlow - Time Off Authorised - ${employeeName}`
    : isTimeOff
      ? `JobFlow - Time Off Logged - ${employeeName} - ${formatOvertimeMinutes(entry.overtimeMinutes)}`
      : `JobFlow - Overtime Logged - ${employeeName}`;
  const text = isTimeOff
    ? isApproved
      ? `Authorised Time Off has been recorded.\n\nEmployee: ${employeeName}\nDate: ${formatDate(entry.workDate)}\nTime: ${entry.startTime} - ${entry.finishTime}\nTotal: ${formatOvertimeMinutes(entry.overtimeMinutes)}\nReason: ${reason}\nAuthorised By: ${options.approvedByName || entry.approvedByName || "Management"}\nStatus: Approved\n\nVIEW TIME OFF REQUEST: ${link}`
      : `An Authorised Time Off entry has been submitted in JobFlow.\n\nEmployee: ${employeeName}\nDate: ${formatDate(entry.workDate)}\nStart Time: ${entry.startTime}\nFinish Time: ${entry.finishTime}\nTotal Time Off: ${formatOvertimeMinutes(entry.overtimeMinutes)}\nReason: ${reason}\nNotes:\n${entry.notes || "—"}\n\nStatus: Pending Approval\n\nVIEW TIME OFF REQUEST: ${link}`
    : `An overtime entry has been submitted in JobFlow.\n\nEmployee: ${employeeName}\nDate: ${formatDate(entry.workDate)}\nClient: ${entry.customerName || entry.clientName || "—"}\nJob: ${entry.jobNumber || entry.jobLabel || "—"}\nStart Time: ${entry.startTime}\nFinish Time: ${entry.finishTime}\nBefore 08:00: ${formatOvertimeMinutes(entry.beforeHoursMinutes || 0)}\nAfter 16:00: ${formatOvertimeMinutes(entry.afterHoursMinutes || 0)}\nTotal Overtime: ${formatOvertimeMinutes(entry.overtimeMinutes)}\nReason / Notes:\n${entry.notes || "—"}\n\nStatus: Pending Approval\n\nVIEW OVERTIME REQUEST: ${link}`;

  const rows = isTimeOff
    ? isApproved
      ? [["Employee", employeeName], ["Date", formatDate(entry.workDate)], ["Time", `${entry.startTime} – ${entry.finishTime}`], ["Total", formatOvertimeMinutes(entry.overtimeMinutes)], ["Reason", reason], ["Authorised By", options.approvedByName || entry.approvedByName || "Management"], ["Status", "Approved"]]
      : [["Employee", employeeName], ["Date", formatDate(entry.workDate)], ["Start Time", entry.startTime], ["Finish Time", entry.finishTime], ["Total Time Off", formatOvertimeMinutes(entry.overtimeMinutes)], ["Reason", reason], ["Notes", entry.notes || "—"], ["Status", "Pending Approval"]]
    : [["Employee", employeeName], ["Date", formatDate(entry.workDate)], ["Client", entry.customerName || entry.clientName || "—"], ["Job", entry.jobNumber || entry.jobLabel || "—"], ["Start Time", entry.startTime], ["Finish Time", entry.finishTime], ["Before 08:00", formatOvertimeMinutes(entry.beforeHoursMinutes || 0)], ["After 16:00", formatOvertimeMinutes(entry.afterHoursMinutes || 0)], ["Total Overtime", formatOvertimeMinutes(entry.overtimeMinutes)], ["Reason / Notes", entry.notes || "—"], ["Status", "Pending Approval"]];
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.5"><h2 style="color:#dc2626">${escapeHtml(subject)}</h2><p>${escapeHtml(isApproved ? "Authorised Time Off has been recorded." : isTimeOff ? "An Authorised Time Off entry has been submitted in JobFlow." : "An overtime entry has been submitted in JobFlow.")}</p><table style="border-collapse:collapse;width:100%;max-width:640px">${rows.map(([label, value]) => `<tr><td style="padding:7px 12px 7px 0;font-weight:bold;border-bottom:1px solid #e5e7eb">${escapeHtml(label)}</td><td style="padding:7px 0;border-bottom:1px solid #e5e7eb">${escapeHtml(value)}</td></tr>`).join("")}</table><p style="margin-top:24px"><a href="${escapeHtml(link)}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:11px 16px;border-radius:6px">${isTimeOff ? "VIEW TIME OFF REQUEST" : "VIEW OVERTIME REQUEST"}</a></p><p style="font-size:12px;color:#6b7280">Sent by JobFlow.</p></body></html>`;

  console.info(`[EMAIL DEBUG]\nType: ${notificationType}\nEntry ID: ${entry.id}\nFrom: ${sender()}\nTo: ${notificationTo}`);
  try {
    const providerResponse = await deliverEmail({ to: notificationTo, from: sender(), subject, text, html });
    const accepted = new Set((providerResponse.accepted || []).map(address => address.toLowerCase()));
    const rejected = new Set((providerResponse.rejected || []).map(address => address.toLowerCase()));
    return TIME_NOTIFICATION_RECIPIENTS.map(recipient => {
      const normalizedRecipient = recipient.toLowerCase();
      const wasRejected = rejected.has(normalizedRecipient);
      const wasAccepted = accepted.size === 0 || accepted.has(normalizedRecipient);
      const sent = !wasRejected && wasAccepted;
      const error = sent
        ? undefined
        : wasRejected
          ? `Provider rejected ${recipient}: ${providerResponse.response || "No provider reason returned"}`
          : `Provider did not accept ${recipient}`;
      console.info(`[EMAIL DEBUG] ${recipient} -> ${sent ? "SENT" : "FAILED"}\nProvider response: ${JSON.stringify(providerResponse)}${error ? `\nProvider error: ${error}` : ""}`);
      return { recipient, sent, error, providerResponse };
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[EMAIL DEBUG] To: ${notificationTo}\nAll recipients -> FAILED\nProvider error: ${message}`);
    return TIME_NOTIFICATION_RECIPIENTS.map(recipient => ({ recipient, sent: false, error: message }));
  }
}