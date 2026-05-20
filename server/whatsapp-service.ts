export interface WhatsAppTestResult {
  success: boolean;
  recipient: string;
  message: string;
  messageId?: string;
}

const TEST_BODY =
  "Job Flow WhatsApp backup test. If you received this, WhatsApp backups are working.";

function normalizeRecipient(raw: string): string {
  return raw.replace(/[\s+\-()]/g, "");
}

export async function sendWhatsAppBackupTest(): Promise<WhatsAppTestResult> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const to = process.env.WHATSAPP_BACKUP_TO;

  const missing: string[] = [];
  if (!token) missing.push("WHATSAPP_ACCESS_TOKEN");
  if (!phoneNumberId) missing.push("WHATSAPP_PHONE_NUMBER_ID");
  if (!to) missing.push("WHATSAPP_BACKUP_TO");
  if (missing.length > 0) {
    return {
      success: false,
      recipient: to ?? "(unset)",
      message: `Missing WhatsApp secrets: ${missing.join(", ")}`,
    };
  }

  const recipient = normalizeRecipient(to!);
  const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: recipient,
        type: "text",
        text: { body: TEST_BODY },
      }),
    });

    const rawText = await response.text();
    let parsed: any = null;
    try { parsed = JSON.parse(rawText); } catch { /* keep rawText */ }

    if (!response.ok) {
      const apiErr = parsed?.error;
      const reason =
        apiErr?.message ??
        apiErr?.error_user_msg ??
        rawText ??
        `HTTP ${response.status}`;
      console.error("[whatsapp-backup] API error:", {
        status: response.status,
        recipient,
        error: apiErr ?? rawText,
      });
      return {
        success: false,
        recipient,
        message: `WhatsApp API error (${response.status}): ${reason}`,
      };
    }

    const messageId = parsed?.messages?.[0]?.id;
    console.log("[whatsapp-backup] sent OK", { recipient, messageId });
    return {
      success: true,
      recipient,
      message: `WhatsApp test message sent to ${recipient}.`,
      messageId,
    };
  } catch (e: any) {
    console.error("[whatsapp-backup] network/exception:", e);
    return {
      success: false,
      recipient,
      message: e?.message ?? "WhatsApp send failed (network error)",
    };
  }
}
