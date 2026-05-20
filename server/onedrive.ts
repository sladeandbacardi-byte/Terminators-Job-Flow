import { ConfidentialClientApplication } from "@azure/msal-node";
import { generateJsonBackupBuffer, generateExcelBackupBuffer } from "./backup-helpers";
import { storage } from "./storage";

export interface OneDriveConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  userId: string;
  backupFolder: string;
}

export function getOneDriveConfig(): OneDriveConfig | null {
  const tenantId = process.env.ONEDRIVE_TENANT_ID;
  const clientId = process.env.ONEDRIVE_CLIENT_ID;
  const clientSecret = process.env.ONEDRIVE_CLIENT_SECRET;
  const userId = process.env.ONEDRIVE_USER_ID;
  const backupFolder = process.env.ONEDRIVE_BACKUP_FOLDER || "/Job Flow Backups/Daily Backups";

  if (!tenantId || !clientId || !clientSecret || !userId) return null;
  return { tenantId, clientId, clientSecret, userId, backupFolder };
}

async function getAccessToken(config: OneDriveConfig): Promise<string> {
  const cca = new ConfidentialClientApplication({
    auth: {
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      authority: `https://login.microsoftonline.com/${config.tenantId}`,
    },
  });
  const result = await cca.acquireTokenByClientCredential({
    scopes: ["https://graph.microsoft.com/.default"],
  });
  if (!result?.accessToken) throw new Error("Failed to acquire OneDrive access token");
  return result.accessToken;
}

async function uploadFile(
  config: OneDriveConfig,
  token: string,
  filename: string,
  buffer: Buffer,
  mimeType: string,
): Promise<void> {
  const encodedPath = encodeURIComponent(`${config.backupFolder}/${filename}`).replace(/%2F/g, "/");
  const url = `https://graph.microsoft.com/v1.0/users/${config.userId}/drive/root:${encodedPath}:/content`;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": mimeType,
    },
    body: buffer,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new Error(`OneDrive upload failed (${res.status}): ${body}`);
  }
}

function isMonthEnd(dateStr: string): boolean {
  const date = new Date(dateStr + "T00:00:00Z");
  const nextDay = new Date(date.getTime() + 24 * 60 * 60 * 1000);
  return nextDay.getUTCDate() === 1;
}

async function applyRetentionPolicy(config: OneDriveConfig, token: string): Promise<void> {
  const now = new Date();
  const cutoff30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const cutoff12m = new Date(now.getTime() - 366 * 24 * 60 * 60 * 1000);

  const folderPath = encodeURIComponent(config.backupFolder).replace(/%2F/g, "/");
  const listUrl = `https://graph.microsoft.com/v1.0/users/${config.userId}/drive/root:${folderPath}:/children?$top=500`;

  const res = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return;

  const data = await res.json();
  const files: any[] = data.value ?? [];

  for (const file of files) {
    const name: string = file.name ?? "";
    const dateMatch = name.match(/(\d{4}-\d{2}-\d{2})\.(json|xlsx)$/);
    if (!dateMatch) continue;

    const fileDateStr = dateMatch[1];
    const fileDate = new Date(fileDateStr + "T00:00:00Z");

    let shouldDelete = false;

    if (fileDate < cutoff12m) {
      shouldDelete = true;
    } else if (fileDate < cutoff30 && !isMonthEnd(fileDateStr)) {
      shouldDelete = true;
    }

    if (shouldDelete) {
      await fetch(`https://graph.microsoft.com/v1.0/users/${config.userId}/drive/items/${file.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
  }
}

export async function runDailyBackupToOneDrive(isManual = false): Promise<void> {
  const config = getOneDriveConfig();
  const backupType = isManual ? "onedrive-manual" : "onedrive-auto";
  const destination = config?.backupFolder ?? "(not configured)";

  if (!config) {
    await storage.addBackupLog({
      datetime: new Date().toISOString(),
      backupType,
      fileNames: [],
      fileSizesBytes: [],
      destination,
      status: "failed",
      errorMessage: "OneDrive is not configured — missing environment variables.",
    });
    throw new Error("OneDrive is not configured — missing environment variables.");
  }

  let jsonResult: { buffer: Buffer; filename: string; sizeBytes: number } | null = null;
  let xlsxResult: { buffer: Buffer; filename: string; sizeBytes: number } | null = null;

  try {
    [jsonResult, xlsxResult] = await Promise.all([
      generateJsonBackupBuffer(),
      generateExcelBackupBuffer(),
    ]);
  } catch (genErr: any) {
    await storage.addBackupLog({
      datetime: new Date().toISOString(),
      backupType,
      fileNames: [],
      fileSizesBytes: [],
      destination,
      status: "failed",
      errorMessage: `Backup generation failed: ${genErr.message}`,
    });
    throw genErr;
  }

  try {
    const token = await getAccessToken(config);

    await Promise.all([
      uploadFile(config, token, jsonResult.filename, jsonResult.buffer, "application/json"),
      uploadFile(config, token, xlsxResult.filename, xlsxResult.buffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    ]);

    await applyRetentionPolicy(config, token).catch((e) =>
      console.warn("Retention policy failed (non-fatal):", e),
    );

    await storage.addBackupLog({
      datetime: new Date().toISOString(),
      backupType,
      fileNames: [jsonResult.filename, xlsxResult.filename],
      fileSizesBytes: [jsonResult.sizeBytes, xlsxResult.sizeBytes],
      destination: config.backupFolder,
      status: "success",
    });
  } catch (uploadErr: any) {
    await storage.addBackupLog({
      datetime: new Date().toISOString(),
      backupType,
      fileNames: [jsonResult.filename, xlsxResult.filename],
      fileSizesBytes: [jsonResult.sizeBytes, xlsxResult.sizeBytes],
      destination: config.backupFolder,
      status: "failed",
      errorMessage: uploadErr.message,
    });
    throw uploadErr;
  }
}
