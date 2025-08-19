import type { Invoice, InvoiceItem, Client } from "@shared/schema";

interface SageConfig {
  clientId: string;
  clientSecret: string;
  accessToken: string;
  baseUrl: string;
}

interface SageInvoiceRequest {
  contact_id: string;
  date: string;
  due_date: string;
  invoice_lines: Array<{
    ledger_account_id: string;
    quantity: number;
    unit_price: number;
    description: string;
    tax_rate_id?: string;
  }>;
  currency?: string;
  reference?: string;
  notes?: string;
}

interface SageInvoiceResponse {
  id: string;
  invoice_number: string;
  status: {
    display_name: string;
  };
  total_amount: number;
  date: string;
  due_date: string;
}

interface SageContact {
  id: string;
  name: string;
  email?: string;
  contact_type: 'CUSTOMER' | 'VENDOR';
}

export class SageIntegrationService {
  private config: SageConfig;

  constructor(config: SageConfig) {
    this.config = config;
  }

  private async makeRequest(endpoint: string, method: 'GET' | 'POST' | 'PUT' = 'GET', data?: any): Promise<any> {
    const url = `${this.config.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.config.accessToken}`,
      'Content-Type': 'application/json',
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Sage API Error ${response.status}: ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Sage API request failed:', error);
      throw error;
    }
  }

  /**
   * Get or create a Sage contact for the client
   */
  async ensureContact(client: Client): Promise<string> {
    try {
      // First, try to find existing contact by name
      const existingContacts = await this.makeRequest(`/contacts?search=${encodeURIComponent(client.name)}`);
      
      if (existingContacts.$items && existingContacts.$items.length > 0) {
        const contact = existingContacts.$items.find((c: SageContact) => 
          c.name.toLowerCase() === client.name.toLowerCase() && c.contact_type === 'CUSTOMER'
        );
        
        if (contact) {
          return contact.id;
        }
      }

      // Create new contact if not found
      const contactData = {
        name: client.name,
        contact_type: 'CUSTOMER',
        email: client.email || undefined,
        telephone: client.phone || undefined,
        address: client.address ? {
          address_line_1: client.address
        } : undefined,
      };

      const newContact = await this.makeRequest('/contacts', 'POST', contactData);
      return newContact.id;
    } catch (error) {
      console.error('Error ensuring contact in Sage:', error);
      throw new Error(`Failed to create/find contact in Sage: ${error}`);
    }
  }

  /**
   * Get default sales ledger account ID
   */
  async getDefaultSalesAccount(): Promise<string> {
    try {
      const accounts = await this.makeRequest('/ledger_accounts?account_type=INCOME');
      
      if (accounts.$items && accounts.$items.length > 0) {
        // Use the first income account, or look for "Sales" account
        const salesAccount = accounts.$items.find((acc: any) => 
          acc.name.toLowerCase().includes('sales') || acc.name.toLowerCase().includes('income')
        );
        return salesAccount ? salesAccount.id : accounts.$items[0].id;
      }
      
      throw new Error('No income accounts found in Sage');
    } catch (error) {
      console.error('Error getting sales account:', error);
      throw error;
    }
  }

  /**
   * Send invoice to Sage Accounting
   */
  async sendInvoice(invoice: Invoice, invoiceItems: InvoiceItem[], client: Client): Promise<SageInvoiceResponse> {
    try {
      // Ensure contact exists in Sage
      const contactId = await this.ensureContact(client);
      
      // Get default sales account
      const salesAccountId = await this.getDefaultSalesAccount();

      // Prepare invoice lines
      const invoiceLines = invoiceItems.map(item => ({
        ledger_account_id: salesAccountId,
        quantity: parseFloat(item.quantity),
        unit_price: parseFloat(item.unitPrice),
        description: item.description,
      }));

      // Prepare invoice data
      const invoiceData: SageInvoiceRequest = {
        contact_id: contactId,
        date: invoice.issueDate.toISOString().split('T')[0],
        due_date: invoice.dueDate.toISOString().split('T')[0],
        invoice_lines: invoiceLines,
        currency: 'ZAR', // South African Rand
        reference: invoice.invoiceNumber,
        notes: invoice.notes || undefined,
      };

      // Send to Sage
      const sageInvoice = await this.makeRequest('/sales_invoices', 'POST', invoiceData);
      
      // Release the invoice (change from draft to active)
      if (sageInvoice.id) {
        await this.makeRequest(`/sales_invoices/${sageInvoice.id}/release`, 'POST');
      }

      return sageInvoice;
    } catch (error) {
      console.error('Error sending invoice to Sage:', error);
      throw error;
    }
  }

  /**
   * Bulk send multiple invoices to Sage
   */
  async sendMultipleInvoices(
    invoiceData: Array<{
      invoice: Invoice;
      invoiceItems: InvoiceItem[];
      client: Client;
    }>
  ): Promise<Array<{ success: boolean; invoiceNumber: string; sageId?: string; error?: string }>> {
    const results = [];

    for (const { invoice, invoiceItems, client } of invoiceData) {
      try {
        const sageInvoice = await this.sendInvoice(invoice, invoiceItems, client);
        results.push({
          success: true,
          invoiceNumber: invoice.invoiceNumber,
          sageId: sageInvoice.id,
        });
      } catch (error) {
        results.push({
          success: false,
          invoiceNumber: invoice.invoiceNumber,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Get invoice status from Sage
   */
  async getInvoiceStatus(sageInvoiceId: string): Promise<{ status: string; total: number }> {
    try {
      const invoice = await this.makeRequest(`/sales_invoices/${sageInvoiceId}`);
      return {
        status: invoice.status?.display_name || 'Unknown',
        total: invoice.total_amount || 0,
      };
    } catch (error) {
      console.error('Error getting invoice status from Sage:', error);
      throw error;
    }
  }

  /**
   * Test connection to Sage API
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      await this.makeRequest('/me');
      return {
        success: true,
        message: 'Successfully connected to Sage Accounting API',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown connection error',
      };
    }
  }
}

// Factory function to create Sage service with environment variables
export function createSageService(): SageIntegrationService {
  const config: SageConfig = {
    clientId: process.env.SAGE_CLIENT_ID || '',
    clientSecret: process.env.SAGE_CLIENT_SECRET || '',
    accessToken: process.env.SAGE_ACCESS_TOKEN || '',
    baseUrl: process.env.SAGE_BASE_URL || 'https://api.sage.com/accounting/v3.1',
  };

  if (!config.clientId || !config.clientSecret || !config.accessToken) {
    throw new Error('Sage API credentials not configured. Please set SAGE_CLIENT_ID, SAGE_CLIENT_SECRET, and SAGE_ACCESS_TOKEN environment variables.');
  }

  return new SageIntegrationService(config);
}