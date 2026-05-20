import { sendEmail } from "./email-service";
import { storage } from "./storage";
import { generateJsonBackupBuffer, generateExcelBackupBuffer } from "./backup-helpers";

const BACKUP_RECIPIENT =
  process.env.BACKUP_EMAIL_TO ??
  process.env.BACKUP_EMAIL_RECIPIENT ??
  "info@terminators.co.za";
const BACKUP_SENDER =
  process.env.BACKUP_EMAIL_FROM ??
  process.env.SENDGRID_FROM_EMAIL ??
  "info@terminators.co.za";
const EMAIL_PROVIDER = (process.env.EMAIL_PROVIDER ?? "brevo").toLowerCase();

const BREVO_MAX_TOTAL_BYTES = 10 * 1024 * 1024; // Brevo free plan: 10 MB total attachments
const TOO_LARGE_MESSAGE =
  "Backup files are too large to email. Please download manually or set up cloud backup.";

export type EmailBackupKind = "auto" | "manual" | "test";

function logTypeFor(kind: EmailBackupKind): "email-auto" | "email-manual" | "email-test" {
  return kind === "auto" ? "email-auto" : kind === "manual" ? "email-manual" : "email-test";
}

interface BackupAttachment {
  filename: string;
  contentBase64: string;
  type: string;
}

async function sendViaBrevo(opts: {
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
  excelFile: { name: string; sizeBytes: number };
  errorMessage?: string;
}> {
  const recipient = recipientOverride?.trim() || BACKUP_RECIPIENT;
  const dateStr = new Date().toISOString().split("T")[0];
  const isTest = kind === "test";

  let jsonInfo = { name: `job-flow-restore-backup-${dateStr}.json`, sizeBytes: 0 };
  let excelInfo = { name: `job-flow-excel-backup-${dateStr}.xlsx`, sizeBytes: 0 };

  try {
    const jsonResult = await generateJsonBackupBuffer();
    const excelResult = await generateExcelBackupBuffer();
    jsonInfo = { name: jsonResult.filename, sizeBytes: jsonResult.sizeBytes };
    excelInfo = { name: excelResult.filename, sizeBytes: excelResult.sizeBytes };

    const totalBytes = jsonInfo.sizeBytes + excelInfo.sizeBytes;
    if (totalBytes > BREVO_MAX_TOTAL_BYTES) {
      throw new Error(TOO_LARGE_MESSAGE);
    }

    const subject = isTest
      ? `Job Flow Daily Backup TEST - ${dateStr}`
      : `Job Flow Daily Backup - ${dateStr}`;

    const bodyText = isTest
      ? `This is a TEST of the daily Job Flow backup email.\n\nAttached are the backup files generated right now for verification.\n\nThe JSON file is for system restore.\nThe Excel file is for human review and record keeping.`
      : `Attached are the daily Job Flow backup files.\n\nThe JSON file is for system restore.\nThe Excel file is for human review and record keeping.`;

    const bodyHtml = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.6;">
      <h2 style="color:#1d4ed8;margin-bottom:8px;">${isTest ? "Job Flow Daily Backup — TEST" : "Job Flow Daily Backup"}</h2>
      <p style="margin:4px 0;color:#6b7280;font-size:13px;">${dateStr}</p>
      ${isTest ? `<div style="background:#fef3c7;border:1px solid #fbbf24;padding:10px;border-radius:6px;margin:12px 0;font-size:13px;">This is a <strong>test email</strong> to confirm backup delivery is working.</div>` : ""}
      <p>Attached are the daily Job Flow backup files.</p>
      <ul>
        <li><strong>${jsonInfo.name}</strong> — JSON restore backup (${(jsonInfo.sizeBytes / 1024).toFixed(1)} KB) — use to restore the system.</li>
        <li><strong>${excelInfo.name}</strong> — Excel backup (${(excelInfo.sizeBytes / 1024).toFixed(1)} KB) — open in Excel for review.</li>
      </ul>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">
      <p style="font-size:12px;color:#6b7280;">Sent automatically by Job Flow — The Terminators Field Service Management System.</p>
    </body></html>`;

    const attachments: BackupAttachment[] = [
      { filename: jsonInfo.name, contentBase64: jsonResult.buffer.toString("base64"), type: "application/json" },
      { filename: excelInfo.name, contentBase64: excelResult.buffer.toString("base64"), type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    ];

    if (EMAIL_PROVIDER === "brevo") {
      await sendViaBrevo({
        to: recipient,
        from: BACKUP_SENDER,
        subject,
        text: bodyText,
        html: bodyHtml,
        attachments,
      });
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

    await storage.addBackupLog({
      datetime: new Date().toISOString(),
      backupType: logTypeFor(kind),
      fileNames: [jsonInfo.name, excelInfo.name],
      fileSizesBytes: [jsonInfo.sizeBytes, excelInfo.sizeBytes],
      destination: `Email (${EMAIL_PROVIDER})`,
      status: "success",
      recipientEmail: recipient,
    });

    return { status: "success", recipient, jsonFile: jsonInfo, excelFile: excelInfo };
  } catch (e: any) {
    const errMsg = e?.message ?? "Unknown email backup error";
    await storage.addBackupLog({
      datetime: new Date().toISOString(),
      backupType: logTypeFor(kind),
      fileNames: [jsonInfo.name, excelInfo.name],
      fileSizesBytes: [jsonInfo.sizeBytes, excelInfo.sizeBytes],
      destination: `Email (${EMAIL_PROVIDER})`,
      status: "failed",
      errorMessage: errMsg,
      recipientEmail: recipient,
    });
    return { status: "failed", recipient, jsonFile: jsonInfo, excelFile: excelInfo, errorMessage: errMsg };
  }
}

export function getBackupEmailConfig() {
  return {
    recipient: BACKUP_RECIPIENT,
    sender: BACKUP_SENDER,
    provider: EMAIL_PROVIDER,
    brevoConfigured: Boolean(process.env.BREVO_API_KEY),
    sendgridConfigured: Boolean(process.env.SENDGRID_API_KEY),
    emailConfigured:
      EMAIL_PROVIDER === "brevo"
        ? Boolean(process.env.BREVO_API_KEY)
        : Boolean(process.env.SENDGRID_API_KEY),
    maxAttachmentBytes: BREVO_MAX_TOTAL_BYTES,
  };
}
