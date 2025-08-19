import { MailService } from '@sendgrid/mail';
import type { PurchaseOrder, Supplier, PurchaseOrderItem, InventoryItem } from "@shared/schema";

if (!process.env.SENDGRID_API_KEY) {
  console.warn("SENDGRID_API_KEY not found. Email functionality will be disabled.");
}

const mailService = process.env.SENDGRID_API_KEY ? new MailService() : null;
if (mailService && process.env.SENDGRID_API_KEY) {
  mailService.setApiKey(process.env.SENDGRID_API_KEY);
}

interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  if (!mailService) {
    console.log('Email simulation (SendGrid not configured):', params.subject, 'to', params.to);
    return true; // Simulate success for development
  }

  try {
    await mailService.send({
      to: params.to,
      from: params.from,
      subject: params.subject,
      text: params.text || '',
      html: params.html || '',
    });
    return true;
  } catch (error) {
    console.error('SendGrid email error:', error);
    return false;
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