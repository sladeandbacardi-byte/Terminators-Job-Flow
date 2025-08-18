import { PublicClientApplication, AuthenticationResult } from "@azure/msal-node";
import type { EmailTemplate, EmailLog, Invoice, Client } from "@shared/schema";

interface EmailConfig {
  clientId: string;
  authority: string;
  redirectUri: string;
}

interface EmailData {
  to: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
}

class OutlookEmailService {
  private msalClient: PublicClientApplication;
  private accessToken: string | null = null;

  constructor(config: EmailConfig) {
    this.msalClient = new PublicClientApplication({
      auth: {
        clientId: config.clientId,
        authority: config.authority,
      }
    });
  }

  async authenticate(username: string, password: string): Promise<boolean> {
    try {
      const response = await this.msalClient.acquireTokenByUsernamePassword({
        scopes: ["https://graph.microsoft.com/Mail.Send"],
        username: username,
        password: password,
      });
      
      if (response && response.accessToken) {
        this.accessToken = response.accessToken;
        return true;
      }
      return false;
    } catch (error) {
      console.error('Authentication failed:', error);
      return false;
    }
  }

  async sendEmail(emailData: EmailData): Promise<boolean> {
    if (!this.accessToken) {
      throw new Error('Not authenticated. Please authenticate first.');
    }

    try {
      const response = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            subject: emailData.subject,
            body: {
              contentType: 'HTML',
              content: emailData.htmlContent,
            },
            toRecipients: [
              {
                emailAddress: {
                  address: emailData.to,
                }
              }
            ],
          }
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to send email:', error);
      return false;
    }
  }

  generateInvoiceEmailTemplate(invoice: Invoice, client: Client): { subject: string; htmlContent: string; textContent: string } {
    const subject = `Invoice ${invoice.invoiceNumber} from The Terminators`;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Invoice ${invoice.invoiceNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .header { background-color: #16a34a; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .invoice-details { background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .amount { font-size: 1.2em; font-weight: bold; color: #16a34a; }
          .footer { background-color: #f0f0f0; padding: 15px; text-align: center; font-size: 0.9em; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>The Terminators</h1>
          <p>Field Service Management</p>
        </div>
        
        <div class="content">
          <h2>Invoice ${invoice.invoiceNumber}</h2>
          
          <p>Dear ${client.name},</p>
          
          <p>Please find your invoice details below:</p>
          
          <div class="invoice-details">
            <p><strong>Invoice Number:</strong> ${invoice.invoiceNumber}</p>
            <p><strong>Issue Date:</strong> ${new Date(invoice.issueDate).toLocaleDateString()}</p>
            <p><strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString()}</p>
            <p><strong>Amount Due:</strong> <span class="amount">R${parseFloat(invoice.total).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span></p>
          </div>
          
          <p>Please ensure payment is made by the due date to avoid any late fees.</p>
          
          <p>If you have any questions about this invoice, please don't hesitate to contact us.</p>
          
          <p>Thank you for your business!</p>
        </div>
        
        <div class="footer">
          <p><strong>The Terminators Field Service Management</strong></p>
          <p>Contact us for any questions or concerns</p>
        </div>
      </body>
      </html>
    `;
    
    const textContent = `
Invoice ${invoice.invoiceNumber} from The Terminators

Dear ${client.name},

Please find your invoice details below:

Invoice Number: ${invoice.invoiceNumber}
Issue Date: ${new Date(invoice.issueDate).toLocaleDateString()}
Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}
Amount Due: R${parseFloat(invoice.total).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}

Please ensure payment is made by the due date to avoid any late fees.

If you have any questions about this invoice, please don't hesitate to contact us.

Thank you for your business!

The Terminators Field Service Management
Contact us for any questions or concerns
    `;

    return { subject, htmlContent, textContent };
  }

  generateCustomerEmailTemplate(subject: string, message: string, customerName: string): { subject: string; htmlContent: string; textContent: string } {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${subject}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .header { background-color: #16a34a; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .footer { background-color: #f0f0f0; padding: 15px; text-align: center; font-size: 0.9em; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>The Terminators</h1>
          <p>Field Service Management</p>
        </div>
        
        <div class="content">
          <p>Dear ${customerName},</p>
          
          ${message.split('\n').map(line => `<p>${line}</p>`).join('')}
          
          <p>Best regards,<br>The Terminators Team</p>
        </div>
        
        <div class="footer">
          <p><strong>The Terminators Field Service Management</strong></p>
          <p>Contact us for any questions or concerns</p>
        </div>
      </body>
      </html>
    `;
    
    const textContent = `
${subject}

Dear ${customerName},

${message}

Best regards,
The Terminators Team

The Terminators Field Service Management
Contact us for any questions or concerns
    `;

    return { subject, htmlContent, textContent };
  }
}

export default OutlookEmailService;