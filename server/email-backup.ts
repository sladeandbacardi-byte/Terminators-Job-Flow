import nodemailer from "nodemailer";
import { sendEmail } from "./email-service";
import { storage } from "./storage";
import { generateJsonBackupBuffer, generateCsvBackupBuffer } from "./backup-helpers";

const BACKUP_RECIPIENT =
  process.env.BACKUP_EMAIL_TO ??
  process.env.BACKUP_EMAIL_RECIPIENT ??
  "info@terminators.co.za";
const BACKUP_ALERT_RECIPIENT =
  process.env.BACKUP_ALERT_EMAIL_TO?.trim() ||
  BACKUP_RECIPIENT;
const BACKUP_SENDER =
  process.env.BACKUP_EMAIL_FROM ??
  process.env.SENDGRID_FROM_EMAIL ??
  "info@terminators.co.za";
const EMAIL_PROVIDER = (process.env.EMAIL_PROVIDER ?? "brevo").toLowerCase();

const BREVO_MAX_TOTAL_BYTES = 10 * 1024 * 1024; // Brevo free plan: 10 MB total attachments
const TOO_LARGE_MESSAGE =
  "Backup files are too large to email. Please download manually or set up cloud backup.";
const DEMO_MODE = (process.env.DEMO_MODE ?? "").toLowerCase() === "true";

export type EmailBackupKind = "auto" | "manual" | "test";

function logTypeFor(kind: EmailBackupKind): "email-auto" | "email-manual" | "email-test" {
  return kind === "auto" ? "email-auto" : kind === "manual" ? "email-manual" : "email-test";
}

interface BackupAttachment {
  filename: string;
  contentBase64: string;
  type: string;
}

async function sendViaBrevoSmtp(opts: {
  to: string;
  from: string;
  subject: string;
  text: string;
  html: string;
  attachments: BackupAttachment[];
}): Promise<void> {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = Number(process.env.SMTP_PORT ?? "587");

  if (!host || !user || !pass) {
    const missing = [
      !host && "SMTP_HOST",
      !user && "SMTP_USER",
      !pass && "SMTP_PASS",
    ].filter(Boolean).join(", ");
    throw new Error(
      `Brevo SMTP not fully configured. Missing secrets: ${missing}. ` +
      `Set SMTP_HOST=smtp-relay.brevo.com, SMTP_PORT=587, SMTP_USER=<brevo login>, SMTP_PASS=<brevo SMTP key>.`,
    );
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: opts.from,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
    attachments: opts.attachments.map((a) => ({
      filename: a.filename,
      content: Buffer.from(a.contentBase64, "base64"),
      contentType: a.type,
    })),
  });
}

async function sendViaBrevoApi(opts: {
  to: string;
  from: string;
  subject: string;
  text: string;
  html: string;
  attachments: BackupAttachment[];
}): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    throw new Error("BREVO_API_KEY is not set. Add it to environment secrets to enable Brevo email.");
  }

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: opts.from, name: "Job Flow Backup" },
      to: [{ email: opts.to }],
      subject: opts.subject,
      htmlContent: opts.html,
      textContent: opts.text,
      attachment: opts.attachments.map((a) => ({
        name: a.filename,
        content: a.contentBase64,
      })),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Brevo API error (${res.status}): ${body || res.statusText}`);
  }
}

export async function runDailyBackupEmail(
  kind: EmailBackupKind,
  recipientOverride?: string,
): Promise<{
  status: "success" | "failed";
  recipient: string;
  jsonFile: { name: string; sizeBytes: number };
  csvFile: { name: string; sizeBytes: number };
  errorMessage?: string;
  logId?: string;
}> {
  const recipient = recipientOverride?.trim() || BACKUP_RECIPIENT;
  const dateStr = new Date().toISOString().split("T")[0];
  const isTest = kind === "test";

  let jsonInfo = { name: `job-flow-restore-backup-${dateStr}.json`, sizeBytes: 0 };
  let csvInfo  = { name: `job-flow-backup-${dateStr}.csv`, sizeBytes: 0 };

  try {
    const jsonResult = await generateJsonBackupBuffer();
    const csvResult  = await generateCsvBackupBuffer();
    jsonInfo = { name: jsonResult.filename, sizeBytes: jsonResult.sizeBytes };
    csvInfo  = { name: csvResult.filename,  sizeBytes: csvResult.sizeBytes };

    const totalBytes = jsonInfo.sizeBytes + csvInfo.sizeBytes;
    if (totalBytes > BREVO_MAX_TOTAL_BYTES) {
      throw new Error(TOO_LARGE_MESSAGE);
    }

    const subject = isTest
      ? `Job Flow Daily Backup TEST - ${dateStr}`
      : `Job Flow Daily Backup - ${dateStr}`;

    const bodyText = isTest
      ? `This is a TEST of the daily Job Flow backup email.\n\nAttached are the backup files generated right now for verification.\n\nThe JSON file is for system restore.\nThe CSV file contains clients, jobs, invoices and staff for human review.`
      : `Attached are the daily Job Flow backup files.\n\nThe JSON file is for system restore.\nThe CSV file contains clients, jobs, invoices and staff for human review.`;

    const bodyHtml = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.6;">
      <h2 style="color:#1d4ed8;margin-bottom:8px;">${isTest ? "Job Flow Daily Backup — TEST" : "Job Flow Daily Backup"}</h2>
      <p style="margin:4px 0;color:#6b7280;font-size:13px;">${dateStr}</p>
      ${isTest ? `<div style="background:#fef3c7;border:1px solid #fbbf24;padding:10px;border-radius:6px;margin:12px 0;font-size:13px;">This is a <strong>test email</strong> to confirm backup delivery is working.</div>` : ""}
      <p>Attached are the daily Job Flow backup files.</p>
      <ul>
        <li><strong>${jsonInfo.name}</strong> — JSON restore backup (${(jsonInfo.sizeBytes / 1024).toFixed(1)} KB) — use to restore the system.</li>
        <li><strong>${csvInfo.name}</strong> — CSV summary (${(csvInfo.sizeBytes / 1024).toFixed(1)} KB) — open in Excel or Google Sheets for review.</li>
      </ul>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">
      <p style="font-size:12px;color:#6b7280;">Sent automatically by Job Flow — The Terminators Field Service Management System.</p>
    </body></html>`;

    const attachments: BackupAttachment[] = [
      { filename: jsonInfo.name, contentBase64: jsonResult.buffer.toString("base64"), type: "application/json" },
      { filename: csvInfo.name,  contentBase64: csvResult.buffer.toString("base64"),  type: "text/csv" },
    ];

    if (DEMO_MODE) {
      // Demo Mode disables real email sending. Skip provider call but still log.
    } else if (EMAIL_PROVIDER === "brevo") {
      const smtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
      const apiKeyConfigured = Boolean(process.env.BREVO_API_KEY);

      if (!smtpConfigured && !apiKeyConfigured) {
        throw new Error(
          "Brevo is not configured. Set BREVO_API_KEY for HTTP delivery, or set SMTP_HOST / SMTP_USER / SMTP_PASS for SMTP relay.",
        );
      }

      if (smtpConfigured) {
        // Prefer SMTP relay — handles all attachment types reliably.
        await sendViaBrevoSmtp({
          to: recipient,
          from: BACKUP_SENDER,
          subject,
          text: bodyText,
          html: bodyHtml,
          attachments,
        });
      } else {
        // Fall back to Brevo HTTP API when SMTP credentials are absent.
        // CSV + JSON attachments are generally accepted; if Brevo rejects a file type
        // the API error will be propagated and logged for the admin to see.
        await sendViaBrevoApi({
          to: recipient,
          from: BACKUP_SENDER,
          subject,
          text: bodyText,
          html: bodyHtml,
          attachments,
        });
      }
    } else {
      await sendEmail({
        to: recipient,
        from: BACKUP_SENDER,
        subject,
        text: bodyText,
        html: bodyHtml,
        attachments: attachments.map((a) => ({
          content: a.contentBase64,
          filename: a.filename,
          type: a.type,
        })),
      });
    }

    const successLog = await storage.addBackupLog({
      datetime: new Date().toISOString(),
      backupType: logTypeFor(kind),
      fileNames: [jsonInfo.name, csvInfo.name],
      fileSizesBytes: [jsonInfo.sizeBytes, csvInfo.sizeBytes],
      destination: DEMO_MODE ? `Email (${EMAIL_PROVIDER}, demo)` : `Email (${EMAIL_PROVIDER})`,
      status: "success",
      recipientEmail: recipient,
    });

    return { status: "success", recipient, jsonFile: jsonInfo, csvFile: csvInfo, logId: successLog.id };
  } catch (e: any) {
    const errMsg = e?.message ?? "Unknown email backup error";
    const failedLog = await storage.addBackupLog({
      datetime: new Date().toISOString(),
      backupType: logTypeFor(kind),
      fileNames: [jsonInfo.name, csvInfo.name],
      fileSizesBytes: [jsonInfo.sizeBytes, csvInfo.sizeBytes],
      destination: `Email (${EMAIL_PROVIDER})`,
      status: "failed",
      errorMessage: errMsg,
      recipientEmail: recipient,
    });
    return { status: "failed", recipient, jsonFile: jsonInfo, csvFile: csvInfo, errorMessage: errMsg, logId: failedLog.id };
  }
}

export async function sendBackupFailureAlert(
  errorMessage: string,
): Promise<{ success: boolean; skipped?: boolean; error?: string }> {
  const recipient = BACKUP_ALERT_RECIPIENT;
  const dateStr = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";

  const subject = `⚠️ Job Flow Nightly Backup FAILED — ${new Date().toISOString().split("T")[0]}`;

  const bodyText =
    `The nightly automated backup email FAILED.\n\n` +
    `Time: ${dateStr}\n` +
    `Error: ${errorMessage}\n\n` +
    `Please log in to the Backup & Restore page to investigate and retry.\n\n` +
    `This is an automated alert from Job Flow — The Terminators Field Service Management System.`;

  const bodyHtml = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.6;">
    <h2 style="color:#dc2626;margin-bottom:8px;">⚠️ Nightly Backup Failed</h2>
    <p style="margin:4px 0;color:#6b7280;font-size:13px;">${dateStr}</p>
    <div style="background:#fef2f2;border:1px solid #fca5a5;padding:14px;border-radius:6px;margin:16px 0;">
      <p style="margin:0 0 8px 0;font-weight:bold;color:#991b1b;">The automated nightly backup email could not be delivered.</p>
      <p style="margin:0;font-size:13px;color:#7f1d1d;word-break:break-word;"><strong>Error:</strong> ${errorMessage}</p>
    </div>
    <p>Please log in to the <strong>Backup &amp; Restore</strong> page to investigate and retry the backup.</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">
    <p style="font-size:12px;color:#6b7280;">Automated alert from Job Flow — The Terminators Field Service Management System.</p>
  </body></html>`;

  if (DEMO_MODE) {
    return { success: true, skipped: true };
  }

  try {
    if (EMAIL_PROVIDER === "brevo") {
      const smtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
      const apiKeyConfigured = Boolean(process.env.BREVO_API_KEY);
      if (!smtpConfigured && !apiKeyConfigured) {
        console.warn("[Backup Alert] ⚠️ ALERT EMAIL NOT SENT — no email provider configured. Backup failure may go unnoticed.");
        return { success: false, skipped: true, error: "No email provider configured (BREVO_API_KEY or SMTP credentials missing)" };
      }

      if (smtpConfigured) {
        await sendViaBrevoSmtp({ to: recipient, from: BACKUP_SENDER, subject, text: bodyText, html: bodyHtml, attachments: [] });
      } else {
        await sendViaBrevoApi({ to: recipient, from: BACKUP_SENDER, subject, text: bodyText, html: bodyHtml, attachments: [] });
      }
    } else {
      await sendEmail({ to: recipient, from: BACKUP_SENDER, subject, text: bodyText, html: bodyHtml, attachments: [] });
    }
    return { success: true };
  } catch (e: any) {
    const errMsg: string = e?.message ?? "Unknown error sending alert email";
    console.error(`[Backup Alert] ⚠️ ALERT EMAIL FAILED — ${errMsg}. Backup failure may go unnoticed. Recipient: ${recipient}`);
    return { success: false, error: errMsg };
  }
}

export function getBackupEmailConfig() {
  const smtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
  const apiKeyConfigured = Boolean(process.env.BREVO_API_KEY);
  const brevoConfigured = smtpConfigured || apiKeyConfigured;
  const brevoDeliveryMethod: "smtp" | "api" | "none" =
    smtpConfigured ? "smtp" : apiKeyConfigured ? "api" : "none";

  return {
    recipient: BACKUP_RECIPIENT,
    alertRecipient: BACKUP_ALERT_RECIPIENT,
    alertRecipientOverridden: BACKUP_ALERT_RECIPIENT !== BACKUP_RECIPIENT,
    sender: BACKUP_SENDER,
    provider: EMAIL_PROVIDER,
    brevoConfigured,
    brevoDeliveryMethod,
    smtpConfigured,
    sendgridConfigured: Boolean(process.env.SENDGRID_API_KEY),
    demoMode: DEMO_MODE,
    emailConfigured:
      EMAIL_PROVIDER === "brevo"
        ? brevoConfigured
        : Boolean(process.env.SENDGRID_API_KEY),
    maxAttachmentBytes: BREVO_MAX_TOTAL_BYTES,
  };
}
