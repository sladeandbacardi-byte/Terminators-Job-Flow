import type { 
  Job, Worker, Client, InventoryItem, RentalContract, Invoice, InvoiceItem,
  Supplier, PurchaseOrder, PurchaseOrderItem, EmailLog, Notification,
  QuoteSubmission
} from "@shared/schema";
import { ORIGINATION_LABELS } from "@shared/schema";
import JSZip from 'jszip';

// Spreadsheet applications may evaluate formula-like cell values when opening a
// CSV. Prefix untrusted strings with an apostrophe so they remain plain text.
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
        return escapeCSVValue(value);
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
        return escapeCSVValue(value);
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

type TimeBalanceExportReport = {
  period: { from: string; to: string };
  rows: Array<{
    employeeId: string;
    name: string;
    departmentName: string;
    approvedOvertimeMinutes: number;
    approvedTimeOffMinutes: number;
    pendingOvertimeMinutes: number;
    pendingTimeOffMinutes: number;
    netMinutes: number;
    attendanceDays: number;
    averageStart: string | null;
    lateStarts: number;
    earlyFinishes: number;
    vehicleKmTravelled: number;
  }>;
  totals: {
    approvedOvertimeMinutes: number;
    approvedTimeOffMinutes: number;
    pendingOvertimeMinutes: number;
    pendingTimeOffMinutes: number;
    netMinutes: number;
    employeesOver: number;
    employeesUnder: number;
    employeesBalanced: number;
  };
  transactions: Array<{
    id: string;
    employeeName: string;
    date: string;
    typeLabel: string;
    clientName: string;
    jobLabel: string | null;
    startTime: string;
    finishTime: string;
    minutes: number;
    displayDuration: string;
    status: string;
    approver: string | null;
    approvalDate: string | null;
    reason: string;
    notes: string;
    runningBalanceMinutes: number;
  }>;
};

export function exportTimeBalanceReport(report: TimeBalanceExportReport) {
  const displayMinutes = (minutes: number, signed = false) => {
    const absolute = Math.abs(Math.round(minutes || 0));
    const hours = Math.floor(absolute / 60);
    const remainder = absolute % 60;
    const duration = hours ? `${hours} hr${hours === 1 ? "" : "s"}${remainder ? ` ${remainder} min` : ""}` : `${remainder} min`;
    if (!signed || minutes === 0) return duration;
    return `${minutes > 0 ? "+" : "−"}${duration}`;
  };
  const summaryRows = [
    ["STAFF TIME BALANCE REPORT"],
    ["Period from", report.period.from, "Period to", report.period.to],
    [],
    ["EMPLOYEE SUMMARY"],
    ["Employee ID", "Employee", "Department", "Attendance Days", "Average Start", "Late Starts", "Early Finishes", "Vehicle KM", "Approved Overtime Minutes", "Approved Overtime Display", "Approved Time Off Minutes", "Approved Time Off Display", "Pending Overtime Minutes", "Pending Overtime Display", "Pending Time Off Minutes", "Pending Time Off Display", "Net Balance Minutes", "Net Balance Display"],
    ...report.rows.map(row => [
      row.employeeId, row.name, row.departmentName,
      row.attendanceDays, row.averageStart || "", row.lateStarts, row.earlyFinishes, row.vehicleKmTravelled,
      row.approvedOvertimeMinutes, displayMinutes(row.approvedOvertimeMinutes),
      row.approvedTimeOffMinutes, displayMinutes(row.approvedTimeOffMinutes),
      row.pendingOvertimeMinutes, displayMinutes(row.pendingOvertimeMinutes),
      row.pendingTimeOffMinutes, displayMinutes(row.pendingTimeOffMinutes),
      row.netMinutes, displayMinutes(row.netMinutes, true),
    ]),
    [],
    ["COMPANY TOTALS"],
    ["Approved Overtime Minutes", report.totals.approvedOvertimeMinutes, "Display", displayMinutes(report.totals.approvedOvertimeMinutes)],
    ["Approved Time Off Minutes", report.totals.approvedTimeOffMinutes, "Display", displayMinutes(report.totals.approvedTimeOffMinutes)],
    ["Net Staff Balance Minutes", report.totals.netMinutes, "Display", displayMinutes(report.totals.netMinutes, true)],
    ["Pending Overtime Minutes", report.totals.pendingOvertimeMinutes, "Display", displayMinutes(report.totals.pendingOvertimeMinutes)],
    ["Pending Time Off Minutes", report.totals.pendingTimeOffMinutes, "Display", displayMinutes(report.totals.pendingTimeOffMinutes)],
    ["Employees Over", report.totals.employeesOver],
    ["Employees Under", report.totals.employeesUnder],
    ["Employees Balanced", report.totals.employeesBalanced],
    [],
    ["DETAILED TRANSACTIONS"],
    ["Entry ID", "Employee", "Date", "Type", "Client", "Job", "Start Time", "Finish Time", "Minutes", "Display Duration", "Status", "Approver", "Approval Date", "Reason", "Notes", "Running Balance Minutes"],
    ...report.transactions.map(transaction => [
      transaction.id, transaction.employeeName, transaction.date, transaction.typeLabel,
      transaction.clientName, transaction.jobLabel || "", transaction.startTime, transaction.finishTime,
      transaction.minutes, transaction.displayDuration, transaction.status, transaction.approver || "",
      transaction.approvalDate ? transaction.approvalDate.slice(0, 10) : "", transaction.reason,
      transaction.notes, transaction.runningBalanceMinutes,
    ]),
  ];
  const csvContent = summaryRows.map(row => row.map(escapeCSVValue).join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = `staff-time-balance-${report.period.from}-to-${report.period.to}.csv`;
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Specific export functions for each data type
export function exportJobs(jobs: Job[]) {
  const exportData = jobs.map(job => ({
    id: job.id,
    title: job.title,
    description: job.description || '',
    status: job.status,
    priority: job.priority,
    serviceType: job.serviceType,
    clientId: job.clientId,
    workerId: job.workerId || '',
    departmentId: job.departmentId,
    scheduledDate: job.scheduledDate ? new Date(job.scheduledDate).toLocaleDateString() : '',
    scheduledTime: job.scheduledTime || '',
    startTime: job.startTime ? new Date(job.startTime).toLocaleString() : '',
    endTime: job.endTime ? new Date(job.endTime).toLocaleString() : '',
    estimatedDuration: job.estimatedDuration || '',
    actualDuration: job.actualDuration || '',
    location: job.location || '',
    notes: job.notes || '',
    completionNotes: job.completionNotes || '',
    isRecurring: job.isRecurring ? 'Yes' : 'No',
    recurringPattern: job.recurringPattern || '',
    parentJobId: job.parentJobId || '',
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
    phone: worker.phone,
    departmentId: worker.departmentId,
    role: worker.role || '',
    employeeId: worker.employeeId || '',
    isActive: worker.isActive ? 'Yes' : 'No',
    createdAt: new Date(worker.createdAt).toLocaleString(),
  }));
  
  exportToCSV(exportData, 'workers-export');
}

export function exportClients(clients: Client[]) {
  const exportData = clients.map(client => ({
    id: client.id,
    name: client.name,
    email: client.email || '',
    phone: client.phone || '',
    streetNumber: client.streetNumber || '',
    streetName: client.streetName || '',
    suburb: client.suburb || '',
    city: client.city || '',
    province: client.province || '',
    postalCode: client.postalCode || '',
    googleMapsLink: client.googleMapsLink || '',
    legacyAddress: client.address || '',
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
    type: item.type,
    sku: item.sku,
    quantity: item.quantity,
    minStockLevel: item.minStockLevel,
    maxStockLevel: item.maxStockLevel,
    reorderPoint: item.reorderPoint,
    unitPrice: item.unitPrice || '',
    departmentId: item.departmentId || '',
    location: item.location || '',
    supplier: item.supplier || '',
    lastRestocked: item.lastRestocked ? new Date(item.lastRestocked).toLocaleDateString() : '',
    createdAt: new Date(item.createdAt).toLocaleString(),
  }));
  
  exportToCSV(exportData, 'inventory-export');
}

export function exportContracts(contracts: RentalContract[]) {
  const exportData = contracts.map(contract => ({
    id: contract.id,
    clientId: contract.clientId,
    inventoryItemId: contract.inventoryItemId,
    monthlyPrice: contract.monthlyPrice,
    startDate: new Date(contract.startDate).toLocaleDateString(),
    endDate: contract.endDate ? new Date(contract.endDate).toLocaleDateString() : '',
    lastPriceIncrease: contract.lastPriceIncrease ? new Date(contract.lastPriceIncrease).toLocaleDateString() : '',
    isActive: contract.isActive ? 'Yes' : 'No',
    notes: contract.notes || '',
    createdAt: new Date(contract.createdAt).toLocaleString(),
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
      paymentDate: invoice.paymentDate ? new Date(invoice.paymentDate).toLocaleDateString() : '',
      subtotal: invoice.subtotal,
      taxAmount: invoice.taxAmount,
      total: invoice.total,
      paidAmount: invoice.paidAmount,
      terms: invoice.terms || '',
      notes: invoice.notes || '',
      sageInvoiceId: invoice.sageInvoiceId || '',
      sageStatus: invoice.sageStatus || '',
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
    contactPerson: supplier.contactPerson || '',
    email: supplier.email || '',
    phone: supplier.phone || '',
    address: supplier.address || '',
    website: supplier.website || '',
    category: supplier.category,
    divisionId: supplier.divisionId || '',
    paymentTerms: supplier.paymentTerms || '',
    isActive: supplier.isActive ? 'Yes' : 'No',
    notes: supplier.notes || '',
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

export function exportLeads(leads: QuoteSubmission[]) {
  const exportData = leads.map(lead => {
    const originationKey = lead.origination ?? "other";
    return {
      id: lead.id,
      quoteNumber: lead.quoteNumber || '',
      companyName: lead.companyName,
      contactPerson: lead.contactPerson,
      email: lead.email,
      phone: lead.phone,
      serviceType: lead.serviceType,
      status: lead.status,
      origination: ORIGINATION_LABELS[originationKey] ?? originationKey,
      originationOther: lead.originationOther || '',
      preferredContactMethod: lead.preferredContactMethod || '',
      address: lead.address || '',
      description: lead.description || '',
      assignedTo: lead.assignedTo || '',
      notes: lead.notes || '',
      quoteAmount: lead.quoteAmount || '',
      frequency: lead.frequency || '',
      submittedAt: lead.submittedAt ? new Date(lead.submittedAt).toLocaleString() : '',
      followUpDate: lead.followUpDate ? new Date(lead.followUpDate).toLocaleDateString() : '',
      quoteSentAt: lead.quoteSentAt ? new Date(lead.quoteSentAt).toLocaleString() : '',
    };
  });

  exportToCSV(exportData, 'leads-export');
}

export function exportEmailLogs(emailLogs: EmailLog[]) {
  const exportData = emailLogs.map(log => ({
    id: log.id,
    toEmail: log.toEmail,
    subject: log.subject,
    status: log.status,
    errorMessage: log.errorMessage || '',
    sentAt: log.sentAt ? new Date(log.sentAt).toLocaleString() : '',
    templateId: log.templateId || '',
    relatedEntityId: log.relatedEntityId || '',
    relatedEntityType: log.relatedEntityType || '',
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
    createdAt: new Date(notification.createdAt).toLocaleString(),
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
        streetNumber: c.streetNumber || '',
        streetName: c.streetName || '',
        suburb: c.suburb || '',
        city: c.city || '',
        province: c.province || '',
        postalCode: c.postalCode || '',
        googleMapsLink: c.googleMapsLink || '',
        legacyAddress: c.address || '',
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
        description: j.description || '',
        status: j.status,
        priority: j.priority,
        serviceType: j.serviceType,
        clientId: j.clientId,
        workerId: j.workerId || '',
        departmentId: j.departmentId,
        scheduledDate: j.scheduledDate ? new Date(j.scheduledDate).toLocaleDateString() : '',
        scheduledTime: j.scheduledTime || '',
        startTime: j.startTime ? new Date(j.startTime).toLocaleString() : '',
        endTime: j.endTime ? new Date(j.endTime).toLocaleString() : '',
        estimatedDuration: j.estimatedDuration || '',
        actualDuration: j.actualDuration || '',
        location: j.location || '',
        notes: j.notes || '',
        completionNotes: j.completionNotes || '',
        isRecurring: j.isRecurring ? 'Yes' : 'No',
        createdAt: new Date(j.createdAt).toLocaleString(),
      }));
      zip.file('jobs.csv', generateCSVContent(jobsData));
    }

    if (workers.length > 0) {
      const workersData = workers.map((w: Worker) => ({
        id: w.id,
        name: w.name,
        email: w.email,
        phone: w.phone,
        departmentId: w.departmentId,
        role: w.role || '',
        employeeId: w.employeeId || '',
        isActive: w.isActive ? 'Yes' : 'No',
        createdAt: new Date(w.createdAt).toLocaleString(),
      }));
      zip.file('workers.csv', generateCSVContent(workersData));
    }

    if (inventory.length > 0) {
      const inventoryData = inventory.map((i: InventoryItem) => ({
        id: i.id,
        name: i.name,
        description: i.description || '',
        type: i.type,
        sku: i.sku,
        quantity: i.quantity,
        minStockLevel: i.minStockLevel,
        maxStockLevel: i.maxStockLevel,
        reorderPoint: i.reorderPoint,
        unitPrice: i.unitPrice || '',
        departmentId: i.departmentId || '',
        location: i.location || '',
        supplier: i.supplier || '',
        lastRestocked: i.lastRestocked ? new Date(i.lastRestocked).toLocaleDateString() : '',
        createdAt: new Date(i.createdAt).toLocaleString(),
      }));
      zip.file('inventory.csv', generateCSVContent(inventoryData));
    }

    if (contracts.length > 0) {
      const contractsData = contracts.map((c: RentalContract) => ({
        id: c.id,
        clientId: c.clientId,
        inventoryItemId: c.inventoryItemId,
        monthlyPrice: c.monthlyPrice,
        startDate: new Date(c.startDate).toLocaleDateString(),
        endDate: c.endDate ? new Date(c.endDate).toLocaleDateString() : '',
        lastPriceIncrease: c.lastPriceIncrease ? new Date(c.lastPriceIncrease).toLocaleDateString() : '',
        isActive: c.isActive ? 'Yes' : 'No',
        notes: c.notes || '',
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
        paymentDate: i.paymentDate ? new Date(i.paymentDate).toLocaleDateString() : '',
        subtotal: i.subtotal,
        taxAmount: i.taxAmount,
        total: i.total,
        paidAmount: i.paidAmount,
        terms: i.terms || '',
        notes: i.notes || '',
        sageInvoiceId: i.sageInvoiceId || '',
        sageStatus: i.sageStatus || '',
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
        contactPerson: s.contactPerson || '',
        email: s.email || '',
        phone: s.phone || '',
        address: s.address || '',
        website: s.website || '',
        category: s.category,
        divisionId: s.divisionId || '',
        paymentTerms: s.paymentTerms || '',
        isActive: s.isActive ? 'Yes' : 'No',
        notes: s.notes || '',
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

function sanitizeSpreadsheetValue(value: unknown): string {
  const stringValue = String(value);
  if (typeof value === 'string' && /^[\s\x00-\x1F]*[=+\-@]/.test(stringValue)) {
    return `'${stringValue}`;
  }
  return stringValue;
}

export function escapeCSVValue(value: unknown): string {
  const stringValue = sanitizeSpreadsheetValue(value);
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}
