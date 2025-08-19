import type { 
  Job, Worker, Client, InventoryItem, RentalContract, Invoice, InvoiceItem,
  Supplier, PurchaseOrder, PurchaseOrderItem, EmailLog, Notification
} from "@shared/schema";

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
    divisionId: job.divisionId,
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
    divisionId: worker.divisionId,
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
    divisionId: client.divisionId,
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
    divisionId: item.divisionId,
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

// Export all data as a comprehensive report
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
      fetch('/api/suppliers').then(r => r.json()),
      fetch('/api/purchase-orders').then(r => r.json()),
      fetch('/api/notifications').then(r => r.json()),
    ]);

    const [jobs, workers, clients, inventory, contracts, invoices, suppliers, purchaseOrders, notifications] = responses;

    // Create a comprehensive report
    const report = {
      exportDate: new Date().toLocaleString(),
      summary: {
        totalJobs: jobs.length,
        totalWorkers: workers.length,
        totalClients: clients.length,
        totalInventoryItems: inventory.length,
        totalContracts: contracts.length,
        totalInvoices: invoices.length,
        totalSuppliers: suppliers.length,
        totalPurchaseOrders: purchaseOrders.length,
        totalNotifications: notifications.length,
      },
      jobsData: jobs,
      workersData: workers,
      clientsData: clients,
      inventoryData: inventory,
      contractsData: contracts,
      invoicesData: invoices,
      suppliersData: suppliers,
      purchaseOrdersData: purchaseOrders,
      notificationsData: notifications,
    };

    // Export as JSON for complete data preservation
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `terminators-complete-export-${new Date().toISOString().split('T')[0]}.json`);
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