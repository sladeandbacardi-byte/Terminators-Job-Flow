import type { 
  Job, Worker, Client, InventoryItem, RentalContract, Invoice, InvoiceItem,
  Supplier, PurchaseOrder, PurchaseOrderItem, EmailLog, Notification
} from "@shared/schema";
import JSZip from 'jszip';

// Helper function to generate CSV content
function generateCSVContent(data: any[]): string {
  if (data.length === 0) {
    return '';
  }

  const allKeys = new Set<string>();
  data.forEach(item => {
    Object.keys(item).forEach(key => allKeys.add(key));
  });
  
  const headers = Array.from(allKeys);
  
  const csvContent = [
    headers.join(','),
    ...data.map(item => 
      headers.map(header => {
        const value = item[header];
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      }).join(',')
    )
  ].join('\n');

  return csvContent;
}

// CSV Export utility
export function exportToCSV(data: any[], filename: string) {
  if (data.length === 0) {
    throw new Error("No data to export");
  }

  // Get all unique keys from all objects
  const allKeys = new Set<string>();
  data.forEach(item => {
    Object.keys(item).forEach(key => allKeys.add(key));
  });
  
  const headers = Array.from(allKeys);
  
  // Create CSV content
  const csvContent = [
    headers.join(','), // Header row
    ...data.map(item => 
      headers.map(header => {
        const value = item[header];
        // Handle null/undefined values
        if (value === null || value === undefined) return '';
        // Escape quotes and wrap in quotes if necessary
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      }).join(',')
    )
  ].join('\n');

  // Create and download file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}-${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Specific export functions for each data type
export function exportJobs(jobs: Job[]) {
  const exportData = jobs.map(job => ({
    id: job.id,
    title: job.title,
    description: job.description,
    status: job.status,
    priority: job.priority,
    type: job.type,
    clientId: job.clientId,
    workerId: job.workerId || '',
    departmentId: job.departmentId,
    scheduledStart: job.scheduledStart ? new Date(job.scheduledStart).toLocaleString() : '',
    scheduledEnd: job.scheduledEnd ? new Date(job.scheduledEnd).toLocaleString() : '',
    actualStart: job.actualStart ? new Date(job.actualStart).toLocaleString() : '',
    actualEnd: job.actualEnd ? new Date(job.actualEnd).toLocaleString() : '',
    estimatedDuration: job.estimatedDuration || '',
    actualDuration: job.actualDuration || '',
    location: job.location || '',
    notes: job.notes || '',
    createdAt: new Date(job.createdAt).toLocaleString(),
    updatedAt: new Date(job.updatedAt).toLocaleString(),
  }));
  
  exportToCSV(exportData, 'jobs-export');
}

export function exportWorkers(workers: Worker[]) {
  const exportData = workers.map(worker => ({
    id: worker.id,
    name: worker.name,
    email: worker.email,
    phone: worker.phone || '',
    specialization: worker.specialization || '',
    status: worker.status,
    departmentId: worker.departmentId,
    hourlyRate: worker.hourlyRate || '',
    emergencyContact: worker.emergencyContact || '',
    certifications: worker.certifications || '',
    address: worker.address || '',
    hireDate: worker.hireDate ? new Date(worker.hireDate).toLocaleDateString() : '',
    createdAt: new Date(worker.createdAt).toLocaleString(),
    updatedAt: new Date(worker.updatedAt).toLocaleString(),
  }));
  
  exportToCSV(exportData, 'workers-export');
}

export function exportClients(clients: Client[]) {
  const exportData = clients.map(client => ({
    id: client.id,
    name: client.name,
    email: client.email || '',
    phone: client.phone || '',
    address: client.address || '',
    contactPerson: client.contactPerson || '',
    businessType: client.businessType || '',
    status: client.status,
    departmentId: client.departmentId,
    taxNumber: client.taxNumber || '',
    paymentTerms: client.paymentTerms || '',
    creditLimit: client.creditLimit || '',
    notes: client.notes || '',
    createdAt: new Date(client.createdAt).toLocaleString(),
    updatedAt: new Date(client.updatedAt).toLocaleString(),
  }));
  
  exportToCSV(exportData, 'clients-export');
}

export function exportInventory(items: InventoryItem[]) {
  const exportData = items.map(item => ({
    id: item.id,
    name: item.name,
    description: item.description || '',
    sku: item.sku,
    category: item.category,
    supplier: item.supplier || '',
    quantity: item.quantity,
    minStockLevel: item.minStockLevel,
    maxStockLevel: item.maxStockLevel,
    reorderPoint: item.reorderPoint,
    unitPrice: item.unitPrice,
    location: item.location || '',
    status: item.status,
    departmentId: item.departmentId,
    lastRestocked: item.lastRestocked ? new Date(item.lastRestocked).toLocaleDateString() : '',
    expirationDate: item.expirationDate ? new Date(item.expirationDate).toLocaleDateString() : '',
    createdAt: new Date(item.createdAt).toLocaleString(),
    updatedAt: new Date(item.updatedAt).toLocaleString(),
  }));
  
  exportToCSV(exportData, 'inventory-export');
}

export function exportContracts(contracts: RentalContract[]) {
  const exportData = contracts.map(contract => ({
    id: contract.id,
    contractNumber: contract.contractNumber,
    clientId: contract.clientId,
    equipmentType: contract.equipmentType,
    quantity: contract.quantity,
    monthlyRate: contract.monthlyRate,
    status: contract.status,
    startDate: new Date(contract.startDate).toLocaleDateString(),
    endDate: contract.endDate ? new Date(contract.endDate).toLocaleDateString() : '',
    autoRenewal: contract.autoRenewal ? 'Yes' : 'No',
    paymentFrequency: contract.paymentFrequency,
    totalValue: contract.totalValue,
    notes: contract.notes || '',
    terms: contract.terms || '',
    createdAt: new Date(contract.createdAt).toLocaleString(),
    updatedAt: new Date(contract.updatedAt).toLocaleString(),
  }));
  
  exportToCSV(exportData, 'contracts-export');
}

export function exportInvoices(invoices: Invoice[], invoiceItems: InvoiceItem[]) {
  const exportData = invoices.map(invoice => {
    const items = invoiceItems.filter(item => item.invoiceId === invoice.id);
    const itemsDescription = items.map(item => 
      `${item.description} (Qty: ${item.quantity}, Rate: R${item.unitPrice})`
    ).join('; ');
    
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      clientId: invoice.clientId,
      status: invoice.status,
      issueDate: new Date(invoice.issueDate).toLocaleDateString(),
      dueDate: new Date(invoice.dueDate).toLocaleDateString(),
      paidDate: invoice.paidDate ? new Date(invoice.paidDate).toLocaleDateString() : '',
      subtotal: invoice.subtotal,
      taxAmount: invoice.taxAmount,
      totalAmount: invoice.totalAmount,
      paymentTerms: invoice.paymentTerms || '',
      notes: invoice.notes || '',
      items: itemsDescription,
      createdAt: new Date(invoice.createdAt).toLocaleString(),
      updatedAt: new Date(invoice.updatedAt).toLocaleString(),
    };
  });
  
  exportToCSV(exportData, 'invoices-export');
}

export function exportSuppliers(suppliers: Supplier[]) {
  const exportData = suppliers.map(supplier => ({
    id: supplier.id,
    name: supplier.name,
    email: supplier.email,
    phone: supplier.phone || '',
    address: supplier.address || '',
    contactPerson: supplier.contactPerson || '',
    category: supplier.category,
    paymentTerms: supplier.paymentTerms || '',
    taxNumber: supplier.taxNumber || '',
    website: supplier.website || '',
    notes: supplier.notes || '',
    isActive: supplier.isActive ? 'Yes' : 'No',
    rating: supplier.rating || '',
    createdAt: new Date(supplier.createdAt).toLocaleString(),
  }));
  
  exportToCSV(exportData, 'suppliers-export');
}

export function exportPurchaseOrders(purchaseOrders: PurchaseOrder[], purchaseOrderItems: PurchaseOrderItem[]) {
  const exportData = purchaseOrders.map(po => {
    const items = purchaseOrderItems.filter(item => item.purchaseOrderId === po.id);
    const itemsDescription = items.map(item => 
      `Item ID: ${item.inventoryItemId} (Qty: ${item.quantity}, Unit: R${item.unitPrice})`
    ).join('; ');
    
    return {
      id: po.id,
      poNumber: po.poNumber,
      supplierId: po.supplierId,
      requestedById: po.requestedById,
      approvedById: po.approvedById || '',
      status: po.status,
      totalAmount: po.totalAmount,
      requestDate: new Date(po.requestDate).toLocaleDateString(),
      approvalDate: po.approvalDate ? new Date(po.approvalDate).toLocaleDateString() : '',
      sentDate: po.sentDate ? new Date(po.sentDate).toLocaleDateString() : '',
      expectedDeliveryDate: po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate).toLocaleDateString() : '',
      actualDeliveryDate: po.actualDeliveryDate ? new Date(po.actualDeliveryDate).toLocaleDateString() : '',
      notes: po.notes || '',
      rejectionReason: po.rejectionReason || '',
      items: itemsDescription,
      createdAt: new Date(po.createdAt).toLocaleString(),
      updatedAt: new Date(po.updatedAt).toLocaleString(),
    };
  });
  
  exportToCSV(exportData, 'purchase-orders-export');
}

export function exportEmailLogs(emailLogs: EmailLog[]) {
  const exportData = emailLogs.map(log => ({
    id: log.id,
    templateId: log.templateId || '',
    recipientEmail: log.recipientEmail,
    subject: log.subject,
    status: log.status,
    sentAt: log.sentAt ? new Date(log.sentAt).toLocaleString() : '',
    errorMessage: log.errorMessage || '',
    metadata: log.metadata || '',
    createdAt: new Date(log.createdAt).toLocaleString(),
  }));
  
  exportToCSV(exportData, 'email-logs-export');
}

export function exportNotifications(notifications: Notification[]) {
  const exportData = notifications.map(notification => ({
    id: notification.id,
    title: notification.title,
    message: notification.message,
    type: notification.type,
    priority: notification.priority,
    isRead: notification.isRead ? 'Yes' : 'No',
    userId: notification.userId || '',
    relatedEntityType: notification.relatedEntityType || '',
    relatedEntityId: notification.relatedEntityId || '',
    actionUrl: notification.actionUrl || '',
    createdAt: new Date(notification.createdAt).toLocaleString(),
    readAt: notification.readAt ? new Date(notification.readAt).toLocaleString() : '',
  }));
  
  exportToCSV(exportData, 'notifications-export');
}

// Export all data as a comprehensive ZIP file with CSVs
export async function exportAllData() {
  try {
    // Fetch all data
    const responses = await Promise.all([
      fetch('/api/jobs').then(r => r.json()),
      fetch('/api/workers').then(r => r.json()),
      fetch('/api/clients').then(r => r.json()),
      fetch('/api/inventory').then(r => r.json()),
      fetch('/api/contracts').then(r => r.json()),
      fetch('/api/invoices').then(r => r.json()),
      fetch('/api/invoice-items').then(r => r.json()),
      fetch('/api/suppliers').then(r => r.json()),
      fetch('/api/purchase-orders').then(r => r.json()),
      fetch('/api/purchase-order-items').then(r => r.json()),
      fetch('/api/departments').then(r => r.json()),
    ]);

    const [jobs, workers, clients, inventory, contracts, invoices, invoiceItems, suppliers, purchaseOrders, poItems, departments] = responses;

    // Create ZIP file
    const zip = new JSZip();
    const exportDate = new Date().toISOString().split('T')[0];

    // Add README file
    const readme = `Terminators Field Service Management - Database Export
Export Date: ${new Date().toLocaleString()}

This archive contains all your business data in CSV format:

- clients.csv: Client information and contacts (${clients.length} records)
- jobs.csv: Job scheduling and assignments (${jobs.length} records)
- workers.csv: Staff and worker information (${workers.length} records)
- inventory.csv: Stock and inventory items (${inventory.length} records)
- contracts.csv: Rental contracts (${contracts.length} records)
- invoices.csv: Invoice records (${invoices.length} records)
- invoice_items.csv: Invoice line items (${invoiceItems.length} records)
- suppliers.csv: Supplier information (${suppliers.length} records)
- purchase_orders.csv: Purchase orders (${purchaseOrders.length} records)
- purchase_order_items.csv: Purchase order items (${poItems.length} records)
- departments.csv: Department information (${departments.length} records)

You can open these CSV files with Excel, Google Sheets, or any spreadsheet application.
`;
    zip.file('README.txt', readme);

    // Prepare and add CSV files
    if (clients.length > 0) {
      const clientsData = clients.map((c: Client) => ({
        id: c.id,
        name: c.name,
        email: c.email || '',
        phone: c.phone || '',
        address: c.address || '',
        contactPerson: c.contactPerson || '',
        businessType: c.businessType || '',
        status: c.status,
        departmentId: c.departmentId,
        taxNumber: c.taxNumber || '',
        paymentTerms: c.paymentTerms || '',
        creditLimit: c.creditLimit || '',
        notes: c.notes || '',
        createdAt: new Date(c.createdAt).toLocaleString(),
      }));
      zip.file('clients.csv', generateCSVContent(clientsData));
    }

    if (jobs.length > 0) {
      const jobsData = jobs.map((j: Job) => ({
        id: j.id,
        title: j.title,
        description: j.description,
        status: j.status,
        priority: j.priority,
        type: j.type,
        clientId: j.clientId,
        workerId: j.workerId || '',
        departmentId: j.departmentId,
        scheduledStart: j.scheduledStart ? new Date(j.scheduledStart).toLocaleString() : '',
        scheduledEnd: j.scheduledEnd ? new Date(j.scheduledEnd).toLocaleString() : '',
        actualStart: j.actualStart ? new Date(j.actualStart).toLocaleString() : '',
        actualEnd: j.actualEnd ? new Date(j.actualEnd).toLocaleString() : '',
        estimatedDuration: j.estimatedDuration || '',
        actualDuration: j.actualDuration || '',
        location: j.location || '',
        notes: j.notes || '',
        createdAt: new Date(j.createdAt).toLocaleString(),
      }));
      zip.file('jobs.csv', generateCSVContent(jobsData));
    }

    if (workers.length > 0) {
      const workersData = workers.map((w: Worker) => ({
        id: w.id,
        name: w.name,
        email: w.email,
        phone: w.phone || '',
        departmentId: w.departmentId,
        role: w.role || '',
        status: w.status,
        hireDate: w.hireDate ? new Date(w.hireDate).toLocaleDateString() : '',
        skills: w.skills || '',
        certifications: w.certifications || '',
        emergencyContact: w.emergencyContact || '',
        notes: w.notes || '',
        createdAt: new Date(w.createdAt).toLocaleString(),
      }));
      zip.file('workers.csv', generateCSVContent(workersData));
    }

    if (inventory.length > 0) {
      const inventoryData = inventory.map((i: InventoryItem) => ({
        id: i.id,
        name: i.name,
        description: i.description || '',
        sku: i.sku,
        category: i.category,
        supplier: i.supplier || '',
        quantity: i.quantity,
        minStockLevel: i.minStockLevel,
        maxStockLevel: i.maxStockLevel,
        reorderPoint: i.reorderPoint,
        unitPrice: i.unitPrice,
        location: i.location || '',
        status: i.status,
        departmentId: i.departmentId,
        lastRestocked: i.lastRestocked ? new Date(i.lastRestocked).toLocaleDateString() : '',
        expirationDate: i.expirationDate ? new Date(i.expirationDate).toLocaleDateString() : '',
        createdAt: new Date(i.createdAt).toLocaleString(),
      }));
      zip.file('inventory.csv', generateCSVContent(inventoryData));
    }

    if (contracts.length > 0) {
      const contractsData = contracts.map((c: RentalContract) => ({
        id: c.id,
        contractNumber: c.contractNumber,
        clientId: c.clientId,
        equipmentType: c.equipmentType,
        quantity: c.quantity,
        monthlyRate: c.monthlyRate,
        status: c.status,
        startDate: new Date(c.startDate).toLocaleDateString(),
        endDate: c.endDate ? new Date(c.endDate).toLocaleDateString() : '',
        autoRenewal: c.autoRenewal ? 'Yes' : 'No',
        paymentFrequency: c.paymentFrequency,
        totalValue: c.totalValue,
        notes: c.notes || '',
        terms: c.terms || '',
        createdAt: new Date(c.createdAt).toLocaleString(),
      }));
      zip.file('contracts.csv', generateCSVContent(contractsData));
    }

    if (invoices.length > 0) {
      const invoicesData = invoices.map((i: Invoice) => ({
        id: i.id,
        invoiceNumber: i.invoiceNumber,
        clientId: i.clientId,
        status: i.status,
        issueDate: new Date(i.issueDate).toLocaleDateString(),
        dueDate: new Date(i.dueDate).toLocaleDateString(),
        paidDate: i.paidDate ? new Date(i.paidDate).toLocaleDateString() : '',
        subtotal: i.subtotal,
        taxAmount: i.taxAmount,
        totalAmount: i.totalAmount,
        paymentTerms: i.paymentTerms || '',
        notes: i.notes || '',
        createdAt: new Date(i.createdAt).toLocaleString(),
      }));
      zip.file('invoices.csv', generateCSVContent(invoicesData));
    }

    if (invoiceItems.length > 0) {
      zip.file('invoice_items.csv', generateCSVContent(invoiceItems));
    }

    if (suppliers.length > 0) {
      const suppliersData = suppliers.map((s: Supplier) => ({
        id: s.id,
        name: s.name,
        email: s.email,
        phone: s.phone || '',
        address: s.address || '',
        contactPerson: s.contactPerson || '',
        category: s.category,
        paymentTerms: s.paymentTerms || '',
        taxNumber: s.taxNumber || '',
        website: s.website || '',
        notes: s.notes || '',
        isActive: s.isActive ? 'Yes' : 'No',
        rating: s.rating || '',
        createdAt: new Date(s.createdAt).toLocaleString(),
      }));
      zip.file('suppliers.csv', generateCSVContent(suppliersData));
    }

    if (purchaseOrders.length > 0) {
      const poData = purchaseOrders.map((po: PurchaseOrder) => ({
        id: po.id,
        poNumber: po.poNumber,
        supplierId: po.supplierId,
        requestedById: po.requestedById,
        approvedById: po.approvedById || '',
        status: po.status,
        totalAmount: po.totalAmount,
        requestDate: new Date(po.requestDate).toLocaleDateString(),
        approvalDate: po.approvalDate ? new Date(po.approvalDate).toLocaleDateString() : '',
        sentDate: po.sentDate ? new Date(po.sentDate).toLocaleDateString() : '',
        expectedDeliveryDate: po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate).toLocaleDateString() : '',
        actualDeliveryDate: po.actualDeliveryDate ? new Date(po.actualDeliveryDate).toLocaleDateString() : '',
        notes: po.notes || '',
        rejectionReason: po.rejectionReason || '',
        createdAt: new Date(po.createdAt).toLocaleString(),
      }));
      zip.file('purchase_orders.csv', generateCSVContent(poData));
    }

    if (poItems.length > 0) {
      zip.file('purchase_order_items.csv', generateCSVContent(poItems));
    }

    if (departments.length > 0) {
      zip.file('departments.csv', generateCSVContent(departments));
    }

    // Generate ZIP file and download
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(zipBlob);
    link.setAttribute('href', url);
    link.setAttribute('download', `terminators-database-export-${exportDate}.zip`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    return true;
  } catch (error) {
    console.error('Failed to export all data:', error);
    throw error;
  }
}