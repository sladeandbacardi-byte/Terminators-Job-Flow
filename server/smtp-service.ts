import nodemailer from "nodemailer";

export interface SmtpTestResult {
  success: boolean;
  recipient: string;
  message: string;
  messageId?: string;
}

export async function sendBrevoTestEmail(): Promise<SmtpTestResult> {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const to = process.env.BACKUP_EMAIL_TO;
  const from = process.env.BACKUP_EMAIL_FROM;

  const missing: string[] = [];
  if (!host) missing.push("SMTP_HOST");
  if (!user) missing.push("SMTP_USER");
  if (!pass) missing.push("SMTP_PASS");
  if (!to) missing.push("BACKUP_EMAIL_TO");
  if (!from) missing.push("BACKUP_EMAIL_FROM");
  if (missing.length > 0) {
    return {
      success: false,
      recipient: to ?? "(unset)",
      message: `Missing SMTP secrets: ${missing.join(", ")}`,
    };
  }

  const transporter = nodemailer.createTransport({
    host: host!,
    port,
    secure: port === 465,
    auth: { user: user!, pass: pass! },
  });

  try {
    const info = await transporter.sendMail({
      from: from!,
      to: to!,
      subject: "Job Flow Backup Email Test",
      text: "This is a test email from Job Flow using Brevo SMTP.",
    });
    return {
      success: true,
      recipient: to!,
      message: `Test email sent successfully to ${to}.`,
      messageId: info.messageId,
    };
  } catch (e: any) {
    return {
      success: false,
      recipient: to!,
      message: e?.message ?? "SMTP send failed",
    };
  }
}
