import { MailService } from '@sendgrid/mail';
import type { PurchaseOrder, Supplier, PurchaseOrderItem, InventoryItem } from "@shared/schema";
import {
  EMAIL_BRANDING_MARKER,
  EMAIL_BRANDING_SENDGRID_ATTACHMENTS,
  withEmailBranding,
} from "./email-branding";

if (!process.env.SENDGRID_API_KEY) {
  console.warn("SENDGRID_API_KEY not found. Email functionality will be disabled.");
}

const mailService = process.env.SENDGRID_API_KEY ? new MailService() : null;
if (mailService && process.env.SENDGRID_API_KEY) {
  mailService.setApiKey(process.env.SENDGRID_API_KEY);
}

interface EmailAttachment {
  content: string; // base64
  filename: string;
  type: string;
  disposition?: string;
  content_id?: string;
}

interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: EmailAttachment[];
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  if (!mailService) {
    console.log('Email simulation (SendGrid not configured):', params.subject, 'to', params.to);
    return true; // Simulate success for development
  }

  try {
    const shouldAddBranding = Boolean(params.html) && !params.html.includes(EMAIL_BRANDING_MARKER);
    const html = withEmailBranding(params.html || '');
    const attachments = shouldAddBranding
      ? [...(params.attachments || []), ...EMAIL_BRANDING_SENDGRID_ATTACHMENTS]
      : params.attachments;
    const message: any = {
      to: params.to,
      from: params.from,
      subject: params.subject,
      text: params.text || '',
      html,
    };
    if (attachments && attachments.length > 0) {
      message.attachments = attachments.map(a => ({
        content: a.content,
        filename: a.filename,
        type: a.type,
        disposition: a.disposition ?? 'attachment',
        ...(a.content_id ? { content_id: a.content_id } : {}),
      }));
    }
    await mailService.send(message);
    return true;
  } catch (error: any) {
    console.error('SendGrid email error:', error?.response?.body ?? error);
    const msg = error?.response?.body?.errors?.[0]?.message ?? error?.message ?? 'SendGrid send failed';
    throw new Error(msg);
  }
}

export function generatePurchaseOrderEmail(
  po: PurchaseOrder,
  supplier: Supplier,
  items: PurchaseOrderItem[],
  inventoryItems: InventoryItem[]
): EmailParams {
  const itemsHtml = items.map(item => {
    const inventoryItem = inventoryItems.find(inv => inv.id === item.inventoryItemId);
    return `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 12px;">${inventoryItem?.name || 'Unknown Item'} (${inventoryItem?.sku || 'N/A'})</td>
        <td style="padding: 12px; text-align: center;">${item.quantity}</td>
        <td style="padding: 12px; text-align: right;">R${parseFloat(item.unitPrice || "0").toFixed(2)}</td>
        <td style="padding: 12px; text-align: right;">R${parseFloat(item.totalPrice || "0").toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Purchase Order - ${po.poNumber}</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .header { background-color: #10b981; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; }
            .po-details { background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0; }
            .items-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            .items-table th { background-color: #e2e8f0; padding: 12px; text-align: left; }
            .items-table td { padding: 12px; }
            .total { background-color: #10b981; color: white; font-weight: bold; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #666; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Purchase Order</h1>
            <h2>${po.poNumber}</h2>
        </div>
        
        <div class="content">
            <div class="po-details">
                <h3>Order Details</h3>
                <p><strong>PO Number:</strong> ${po.poNumber}</p>
                <p><strong>Order Date:</strong> ${new Date(po.requestDate).toLocaleDateString()}</p>
                <p><strong>Expected Delivery:</strong> ${po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate).toLocaleDateString() : 'TBD'}</p>
                <p><strong>Supplier:</strong> ${supplier.name}</p>
                ${po.notes ? `<p><strong>Notes:</strong> ${po.notes}</p>` : ''}
            </div>

            <h3>Items Ordered</h3>
            <table class="items-table">
                <thead>
                    <tr>
                        <th>Item Description</th>
                        <th style="text-align: center;">Quantity</th>
                        <th style="text-align: right;">Unit Price</th>
                        <th style="text-align: right;">Total Price</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                    <tr class="total">
                        <td colspan="3" style="text-align: right; padding: 12px;"><strong>TOTAL AMOUNT:</strong></td>
                        <td style="text-align: right; padding: 12px;"><strong>R${parseFloat(po.totalAmount || "0").toFixed(2)}</strong></td>
                    </tr>
                </tbody>
            </table>

            <div class="footer">
                <h4>Delivery Instructions</h4>
                <p>Please deliver all items to:</p>
                <p>
                    <strong>The Terminators Field Service Management</strong><br>
                    123 Business Avenue<br>
                    Cape Town, 8001<br>
                    South Africa
                </p>
                
                <h4>Payment Terms</h4>
                <p>Payment will be processed within 30 days of delivery confirmation.</p>
                
                <h4>Contact Information</h4>
                <p>For any questions regarding this purchase order, please contact:</p>
                <p>
                    <strong>Procurement Department</strong><br>
                    Email: procurement@terminators.co.za<br>
                    Phone: +27 21 123 4567
                </p>
            </div>
        </div>
    </body>
    </html>
  `;

  const text = `
Purchase Order: ${po.poNumber}

Order Details:
- PO Number: ${po.poNumber}
- Order Date: ${new Date(po.requestDate).toLocaleDateString()}
- Expected Delivery: ${po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate).toLocaleDateString() : 'TBD'}
- Supplier: ${supplier.name}
${po.notes ? `- Notes: ${po.notes}` : ''}

Items Ordered:
${items.map(item => {
  const inventoryItem = inventoryItems.find(inv => inv.id === item.inventoryItemId);
  return `- ${inventoryItem?.name || 'Unknown Item'} (${inventoryItem?.sku || 'N/A'}) - Qty: ${item.quantity} - Unit: R${parseFloat(item.unitPrice || "0").toFixed(2)} - Total: R${parseFloat(item.totalPrice || "0").toFixed(2)}`;
}).join('\n')}

TOTAL AMOUNT: R${parseFloat(po.totalAmount || "0").toFixed(2)}

Please deliver to:
The Terminators Field Service Management
123 Business Avenue
Cape Town, 8001
South Africa

For questions, contact: procurement@terminators.co.za
  `;

  return {
    to: supplier.email,
    from: 'procurement@terminators.co.za',
    subject: `Purchase Order ${po.poNumber} - ${supplier.name}`,
    text,
    html,
  };
}

export async function generateWeeklyFleetSummaryEmail(storage: any): Promise<EmailParams | null> {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(now);
  weekEnd.setHours(23, 59, 59, 999);

  const [vehicles, workers, assignments, kmLogs, fuelFillups, inspections, issues, serviceRecords] = await Promise.all([
    storage.getVehicles(),
    storage.getWorkers(),
    storage.getVehicleAssignments(),
    storage.getKmLogsByDateRange(weekStart, weekEnd),
    storage.getFuelFillupsByDateRange(weekStart, weekEnd),
    storage.getVehicleInspections(),
    storage.getVehicleIssues(),
    storage.getServiceRecords(),
  ]);

  const weekInspections = inspections.filter((i: any) => new Date(i.inspectionDate) >= weekStart);
  const weekServiceRecords = serviceRecords.filter((r: any) => new Date(r.serviceDate) >= weekStart);
  const openIssues = issues.filter((i: any) => !["completed", "cancelled", "not_required"].includes(i.status));

  const vehicleName = (id: string) => vehicles.find((v: any) => v.id === id)?.name ?? id;
  const vehicleReg  = (id: string) => vehicles.find((v: any) => v.id === id)?.registration ?? "—";
  const workerName  = (id: string) => workers.find((w: any) => w.id === id)?.name ?? id;

  const totalKm       = kmLogs.reduce((s: number, l: any) => s + (l.totalKm || 0), 0);
  const businessKm    = kmLogs.reduce((s: number, l: any) => s + (l.businessKm || 0), 0);
  const privateKm     = kmLogs.reduce((s: number, l: any) => s + (l.privateKm || 0), 0);
  const totalLitres   = fuelFillups.reduce((s: number, f: any) => s + parseFloat(f.litres || "0"), 0);
  const totalFuelCost = fuelFillups.reduce((s: number, f: any) => s + parseFloat(f.cost || "0"), 0);
  const totalSvcCost  = weekServiceRecords.reduce((s: number, r: any) => s + parseFloat(r.cost || "0"), 0);
  const failedInsp    = weekInspections.filter((i: any) => i.overallResult === "fail");
  const passedInsp    = weekInspections.filter((i: any) => i.overallResult === "pass");

  const fmt = (n: number) => `R${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const dateRange = `${weekStart.toLocaleDateString("en-ZA", { day: "numeric", month: "short" })} – ${now.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}`;

  // ── Vehicle rows ──────────────────────────────────────────────────────────
  const vehicleRows = vehicles.filter((v: any) => v.isActive).map((v: any) => {
    const asgn   = assignments.find((a: any) => a.vehicleId === v.id && a.isActive);
    const driver = asgn ? workerName(asgn.workerId) : "—";
    const vKm    = kmLogs.filter((l: any) => l.vehicleId === v.id).reduce((s: number, l: any) => s + (l.totalKm || 0), 0);
    const vFuel  = fuelFillups.filter((f: any) => f.vehicleId === v.id).reduce((s: number, f: any) => s + parseFloat(f.litres || "0"), 0);
    const vFuelCost = fuelFillups.filter((f: any) => f.vehicleId === v.id).reduce((s: number, f: any) => s + parseFloat(f.cost || "0"), 0);
    const vInsp  = weekInspections.filter((i: any) => i.vehicleId === v.id);
    const vFailed = vInsp.filter((i: any) => i.overallResult === "fail").length;
    const vOpen  = openIssues.filter((i: any) => i.vehicleId === v.id).length;
    return `
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:8px 10px;font-size:13px;font-weight:600;">${v.name}</td>
        <td style="padding:8px 10px;font-size:12px;color:#64748b;font-family:monospace;">${v.registration}</td>
        <td style="padding:8px 10px;font-size:12px;">${driver}</td>
        <td style="padding:8px 10px;font-size:12px;text-align:right;">${vKm.toLocaleString()} km</td>
        <td style="padding:8px 10px;font-size:12px;text-align:right;">${vFuel.toFixed(1)} L</td>
        <td style="padding:8px 10px;font-size:12px;text-align:right;">${fmt(vFuelCost)}</td>
        <td style="padding:8px 10px;font-size:12px;text-align:center;">${vInsp.length}</td>
        <td style="padding:8px 10px;font-size:12px;text-align:center;${vFailed > 0 ? "color:#dc2626;font-weight:600;" : ""}">${vFailed > 0 ? `${vFailed} FAIL` : "—"}</td>
        <td style="padding:8px 10px;font-size:12px;text-align:center;${vOpen > 0 ? "color:#ea580c;font-weight:600;" : "color:#22c55e;"}">${vOpen}</td>
      </tr>`;
  }).join("");

  // ── Open issues rows ──────────────────────────────────────────────────────
  const issueRows = openIssues.slice(0, 15).map((i: any) => `
    <tr style="border-bottom:1px solid #f1f5f9;">
      <td style="padding:6px 10px;font-size:12px;font-weight:600;">${vehicleName(i.vehicleId)}</td>
      <td style="padding:6px 10px;font-size:11px;color:#64748b;font-family:monospace;">${vehicleReg(i.vehicleId)}</td>
      <td style="padding:6px 10px;font-size:12px;">${i.category ?? "—"}</td>
      <td style="padding:6px 10px;font-size:12px;">${(i.description ?? "").slice(0, 60)}</td>
      <td style="padding:6px 10px;font-size:12px;">
        <span style="background:${i.urgency === "not_safe" ? "#fef2f2" : i.urgency === "high" ? "#fff7ed" : "#f0fdf4"};color:${i.urgency === "not_safe" ? "#dc2626" : i.urgency === "high" ? "#ea580c" : "#16a34a"};padding:2px 6px;border-radius:4px;font-size:11px;font-weight:600;">
          ${i.urgency ?? "low"}
        </span>
      </td>
      <td style="padding:6px 10px;font-size:12px;text-transform:capitalize;">${(i.status ?? "open").replace("_", " ")}</td>
    </tr>`).join("");

  const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f8fafc;color:#1e293b;margin:0;padding:0;">
  <div style="max-width:860px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1d4ed8,#2563eb);padding:28px 32px;color:#fff;">
      <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:.75;margin-bottom:4px;">Weekly Fleet Report</div>
      <h1 style="margin:0;font-size:24px;font-weight:700;">Fleet Summary</h1>
      <div style="margin-top:6px;font-size:13px;opacity:.85;">${dateRange} &nbsp;·&nbsp; The Terminators</div>
    </div>

    <!-- KPI row -->
    <div style="display:flex;gap:0;border-bottom:1px solid #e2e8f0;">
      ${[
        ["Total KM", `${totalKm.toLocaleString()} km`, "#eff6ff", "#1d4ed8"],
        ["Business KM", `${businessKm.toLocaleString()} km`, "#f0fdf4", "#16a34a"],
        ["Private KM", `${privateKm.toLocaleString()} km`, "#fafafa", "#64748b"],
        ["Fuel", `${totalLitres.toFixed(0)} L / ${fmt(totalFuelCost)}`, "#fff7ed", "#ea580c"],
        ["Inspections", `${weekInspections.length} done · ${failedInsp.length} fail`, failedInsp.length > 0 ? "#fef2f2" : "#f0fdf4", failedInsp.length > 0 ? "#dc2626" : "#16a34a"],
        ["Open Issues", `${openIssues.length}`, openIssues.length > 0 ? "#fff7ed" : "#f0fdf4", openIssues.length > 0 ? "#ea580c" : "#16a34a"],
        ["Service Cost", fmt(totalSvcCost), "#fdf4ff", "#7c3aed"],
      ].map(([label, value, bg, color]) => `
        <div style="flex:1;padding:16px 14px;background:${bg};text-align:center;border-right:1px solid #e2e8f0;">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin-bottom:4px;">${label}</div>
          <div style="font-size:14px;font-weight:700;color:${color};">${value}</div>
        </div>`).join("")}
    </div>

    <div style="padding:24px 32px;space-y:24px;">

      <!-- Vehicle table -->
      <h2 style="font-size:14px;font-weight:700;color:#1e293b;margin:0 0 12px;text-transform:uppercase;letter-spacing:.5px;">Vehicle Activity This Week</h2>
      <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:28px;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b;">Vehicle</th>
            <th style="padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b;">Reg</th>
            <th style="padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b;">Driver</th>
            <th style="padding:8px 10px;text-align:right;font-size:11px;text-transform:uppercase;color:#64748b;">KM</th>
            <th style="padding:8px 10px;text-align:right;font-size:11px;text-transform:uppercase;color:#64748b;">Fuel (L)</th>
            <th style="padding:8px 10px;text-align:right;font-size:11px;text-transform:uppercase;color:#64748b;">Fuel Cost</th>
            <th style="padding:8px 10px;text-align:center;font-size:11px;text-transform:uppercase;color:#64748b;">Insp</th>
            <th style="padding:8px 10px;text-align:center;font-size:11px;text-transform:uppercase;color:#64748b;">Failed</th>
            <th style="padding:8px 10px;text-align:center;font-size:11px;text-transform:uppercase;color:#64748b;">Issues</th>
          </tr>
        </thead>
        <tbody>${vehicleRows}</tbody>
      </table>

      <!-- Open issues -->
      ${openIssues.length > 0 ? `
      <h2 style="font-size:14px;font-weight:700;color:#1e293b;margin:0 0 12px;text-transform:uppercase;letter-spacing:.5px;">Open Issues (${openIssues.length})</h2>
      <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:28px;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="padding:7px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b;">Vehicle</th>
            <th style="padding:7px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b;">Reg</th>
            <th style="padding:7px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b;">Category</th>
            <th style="padding:7px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b;">Description</th>
            <th style="padding:7px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b;">Urgency</th>
            <th style="padding:7px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b;">Status</th>
          </tr>
        </thead>
        <tbody>${issueRows}</tbody>
      </table>` : `<p style="color:#16a34a;font-weight:600;margin-bottom:28px;">✓ No open issues this week.</p>`}

      <!-- Service records -->
      ${weekServiceRecords.length > 0 ? `
      <h2 style="font-size:14px;font-weight:700;color:#1e293b;margin:0 0 12px;text-transform:uppercase;letter-spacing:.5px;">Maintenance Completed This Week</h2>
      <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:28px;">
        <thead><tr style="background:#f8fafc;">
          <th style="padding:7px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b;">Vehicle</th>
          <th style="padding:7px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b;">Date</th>
          <th style="padding:7px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b;">Provider</th>
          <th style="padding:7px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b;">Work Done</th>
          <th style="padding:7px 10px;text-align:right;font-size:11px;text-transform:uppercase;color:#64748b;">Cost</th>
        </tr></thead>
        <tbody>
          ${weekServiceRecords.map((r: any) => `
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:7px 10px;font-size:12px;font-weight:600;">${vehicleName(r.vehicleId)}</td>
            <td style="padding:7px 10px;font-size:12px;">${new Date(r.serviceDate).toLocaleDateString("en-ZA")}</td>
            <td style="padding:7px 10px;font-size:12px;">${r.serviceProvider ?? "—"}</td>
            <td style="padding:7px 10px;font-size:12px;">${(r.workDone ?? "").slice(0, 60)}</td>
            <td style="padding:7px 10px;font-size:12px;text-align:right;">${fmt(parseFloat(r.cost || "0"))}</td>
          </tr>`).join("")}
        </tbody>
      </table>` : ""}

    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 32px;text-align:center;font-size:11px;color:#94a3b8;">
      This weekly fleet report was generated automatically by Job Flow &nbsp;·&nbsp; The Terminators &nbsp;·&nbsp; ${new Date().toLocaleDateString("en-ZA")}
    </div>
  </div>
</body></html>`;

  const text = `WEEKLY FLEET SUMMARY — ${dateRange}

KM LOGS: Total ${totalKm} km (Business: ${businessKm} km, Private: ${privateKm} km)
FUEL: ${totalLitres.toFixed(1)} L — ${fmt(totalFuelCost)}
INSPECTIONS: ${weekInspections.length} completed, ${failedInsp.length} failed, ${passedInsp.length} passed
OPEN ISSUES: ${openIssues.length}
SERVICE COST: ${fmt(totalSvcCost)}

Generated by Job Flow — The Terminators`;

  return {
    to: "info@terminators.co.za",
    from: "fleet@terminators.co.za",
    subject: `Weekly Fleet Summary — ${dateRange}`,
    html,
    text,
  };
}

export function generateApprovalNotificationEmail(
  po: PurchaseOrder,
  supplier: Supplier,
  approverEmail: string
): EmailParams {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Purchase Order Approval Required</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .header { background-color: #f59e0b; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; }
            .alert { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
            .button { display: inline-block; background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 5px; }
            .details { background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Purchase Order Approval Required</h1>
        </div>
        
        <div class="content">
            <div class="alert">
                <strong>Action Required:</strong> A new purchase order requires your approval.
            </div>
            
            <div class="details">
                <h3>Purchase Order Details</h3>
                <p><strong>PO Number:</strong> ${po.poNumber}</p>
                <p><strong>Supplier:</strong> ${supplier.name}</p>
                <p><strong>Total Amount:</strong> R${parseFloat(po.totalAmount || "0").toFixed(2)}</p>
                <p><strong>Requested By:</strong> User ${po.requestedById}</p>
                <p><strong>Request Date:</strong> ${new Date(po.requestDate).toLocaleDateString()}</p>
                ${po.notes ? `<p><strong>Notes:</strong> ${po.notes}</p>` : ''}
            </div>
            
            <p>Please review and approve or reject this purchase order in the system.</p>
            
            <a href="https://terminators.replit.app/purchase-orders" class="button">Review Purchase Order</a>
        </div>
    </body>
    </html>
  `;

  const text = `
Purchase Order Approval Required

PO Number: ${po.poNumber}
Supplier: ${supplier.name}
Total Amount: R${parseFloat(po.totalAmount || "0").toFixed(2)}
Requested By: User ${po.requestedById}
Request Date: ${new Date(po.requestDate).toLocaleDateString()}
${(po.notes || '') ? `Notes: ${po.notes || ''}` : ''}

Please review and approve or reject this purchase order in the system.
  `;

  return {
    to: approverEmail,
    from: 'system@terminators.co.za',
    subject: `Approval Required: Purchase Order ${po.poNumber}`,
    text,
    html,
  };
}