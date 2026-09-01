import { storage } from "./storage";
import { buildCsvRow } from "./csv-utils";

export async function generateCsvBackupBuffer(): Promise<{
  buffer: Buffer;
  filename: string;
  sizeBytes: number;
}> {
  const backup = await storage.exportBackup();
  const dateStr = (d: any) =>
    d ? new Date(d).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" }) : "";
  const zar = (v: any) =>
    v !== null && v !== undefined && v !== "" ? `ZAR ${parseFloat(String(v)).toFixed(2)}` : "";

  const clientMap = new Map((backup.clients as any[]).map((c: any) => [c.id, c.name]));
  const workerMap = new Map((backup.workers as any[]).map((w: any) => [w.id, w.name]));
  const deptMap   = new Map((backup.departments as any[]).map((d: any) => [d.id, d.name]));

  const sections: string[] = [];

  // ── Clients ──────────────────────────────────────────────────────────────
  sections.push("# CLIENTS");
  sections.push(buildCsvRow(["Name", "Phone", "Email", "Business Type", "Address", "Status"]));
  for (const c of backup.clients as any[]) {
    sections.push(buildCsvRow([c.name, c.phone, c.email, c.businessType, c.address, c.status]));
  }

  // ── Jobs ─────────────────────────────────────────────────────────────────
  sections.push("");
  sections.push("# JOBS");
  sections.push(buildCsvRow(["Job #", "Date", "Client", "Worker", "Department", "Status", "Priority", "Notes"]));
  for (const j of backup.jobs as any[]) {
    sections.push(buildCsvRow([
      j.jobNumber ?? j.id,
      dateStr(j.scheduledDate ?? j.date),
      clientMap.get(j.clientId) ?? j.clientId,
      workerMap.get(j.workerId) ?? (j.workerId ?? "Unassigned"),
      deptMap.get(j.departmentId ?? j.divisionId) ?? "",
      j.status, j.priority ?? "", j.notes ?? "",
    ]));
  }

  // ── Invoices ─────────────────────────────────────────────────────────────
  sections.push("");
  sections.push("# INVOICES");
  sections.push(buildCsvRow(["Invoice #", "Issue Date", "Due Date", "Client", "Total (ZAR)", "Status"]));
  for (const inv of backup.invoices as any[]) {
    sections.push(buildCsvRow([
      inv.invoiceNumber ?? inv.id,
      dateStr(inv.issueDate ?? inv.date),
      dateStr(inv.dueDate),
      clientMap.get(inv.clientId) ?? inv.clientId,
      zar(inv.totalAmount ?? inv.total ?? inv.amount),
      inv.status ?? "",
    ]));
  }

  // ── Workers ───────────────────────────────────────────────────────────────
  sections.push("");
  sections.push("# STAFF");
  sections.push(buildCsvRow(["Name", "Role", "Email", "Phone", "Department", "Active"]));
  for (const w of backup.workers as any[]) {
    sections.push(buildCsvRow([
      w.name, w.role ?? "", w.email ?? "", w.phone ?? "",
      deptMap.get(w.departmentId) ?? "", w.isActive ? "Yes" : "No",
    ]));
  }

  const csvContent = sections.join("\n");
  const buffer = Buffer.from(csvContent, "utf-8");
  const filename = `job-flow-backup-${new Date().toISOString().split("T")[0]}.csv`;
  return { buffer, filename, sizeBytes: buffer.length };
}

export async function generateJsonBackupBuffer(): Promise<{
  buffer: Buffer;
  filename: string;
  sizeBytes: number;
}> {
  const data = await storage.exportBackup();
  const json = JSON.stringify(data, null, 2);
  const buffer = Buffer.from(json, "utf-8");
  const dateStr = new Date().toISOString().split("T")[0];
  return {
    buffer,
    filename: `job-flow-restore-backup-${dateStr}.json`,
    sizeBytes: buffer.length,
  };
}

export async function generateExcelBackupBuffer(): Promise<{
  buffer: Buffer;
  filename: string;
  sizeBytes: number;
}> {
  const XLSX = await import("xlsx");
  const dateStr = (d: any) =>
    d ? new Date(d).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" }) : "";
  const zar = (v: any) =>
    v !== null && v !== undefined && v !== "" ? `ZAR ${parseFloat(String(v)).toFixed(2)}` : "";

  const backup = await storage.exportBackup();
  const [vehicles, fuelFillups, inspections, vehicleIssues, serviceRecords, workshopJobs, teams, attendanceRecords, allMemberRecords] = await Promise.all([
    storage.getVehicles(),
    storage.getFuelFillups(),
    storage.getVehicleInspections(),
    storage.getVehicleIssues(),
    storage.getServiceRecords(),
    storage.getWorkshopJobs(),
    storage.getTeams(),
    storage.getAttendanceRecords(),
    storage.getAllAttendanceMemberRecords(),
  ]);

  const clientMap = new Map((backup.clients as any[]).map((c: any) => [c.id, c.name]));
  const workerMap = new Map((backup.workers as any[]).map((w: any) => [w.id, w.name]));
  const deptMap = new Map((backup.departments as any[]).map((d: any) => [d.id, d.name]));
  const itemMap = new Map((backup.inventoryItems as any[]).map((i: any) => [i.id, i.name]));
  const supplierMap = new Map((backup.suppliers as any[]).map((s: any) => [s.id, s.name]));
  const vehicleMap = new Map(vehicles.map((v: any) => [v.id, v.registrationNumber ?? v.registration ?? v.id]));
  const teamMap = new Map(teams.map((t: any) => [t.id, t.name]));
  const attMap = new Map(attendanceRecords.map((a: any) => [a.id, a]));

  const teamMembersMap = new Map<string, string[]>();
  for (const t of teams) {
    const members = await storage.getTeamMembers(t.id);
    teamMembersMap.set(t.id, members.map((m: any) => workerMap.get(m.workerId) ?? m.workerId));
  }

  const wb = XLSX.utils.book_new();

  const addSheet = (name: string, rows: any[][]) => {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
      if (cell) cell.s = { font: { bold: true } };
    }
    XLSX.utils.book_append_sheet(wb, ws, name);
  };

  addSheet("Clients", [
    ["Name", "Phone", "Email", "Business Type", "Address", "Status", "Payment Terms", "Credit Limit (ZAR)", "Tax Number", "Contact Person", "Notes"],
    ...(backup.clients as any[]).map((c: any) => [
      c.name, c.phone, c.email, c.businessType, c.address, c.status,
      c.paymentTerms, zar(c.creditLimit), c.taxNumber ?? "", c.contactPerson ?? "", c.notes ?? "",
    ]),
  ]);

  addSheet("Jobs", [
    ["Job #", "Date", "Scheduled Time", "Client", "Worker", "Department", "Status", "Job Type", "Priority", "Notes"],
    ...(backup.jobs as any[]).map((j: any) => [
      j.jobNumber ?? j.id,
      dateStr(j.scheduledDate ?? j.date),
      j.scheduledTime ?? "",
      clientMap.get(j.clientId) ?? j.clientId,
      workerMap.get(j.workerId) ?? (j.workerId ?? "Unassigned"),
      deptMap.get(j.departmentId ?? j.divisionId) ?? "",
      j.status, j.jobType ?? "", j.priority ?? "", j.notes ?? "",
    ]),
  ]);

  addSheet("Quotes", [
    ["Quote #", "Company", "Contact Name", "Phone", "Email", "Services Requested", "Status", "Received Date", "Message"],
    ...(backup.quoteSubmissions as any[]).map((q: any) => [
      q.quoteNumber ?? q.id,
      q.companyName ?? "", q.contactName ?? q.name ?? "",
      q.phone ?? "", q.email ?? "",
      Array.isArray(q.servicesRequested) ? q.servicesRequested.join(", ") : (q.servicesRequested ?? ""),
      q.status ?? "", dateStr(q.createdAt), q.message ?? "",
    ]),
  ]);

  addSheet("Invoices", [
    ["Invoice #", "Issue Date", "Due Date", "Client", "Subtotal (ZAR)", "Tax (ZAR)", "Total (ZAR)", "Status", "Notes"],
    ...(backup.invoices as any[]).map((inv: any) => [
      inv.invoiceNumber ?? inv.id,
      dateStr(inv.issueDate ?? inv.date),
      dateStr(inv.dueDate),
      clientMap.get(inv.clientId) ?? inv.clientId,
      zar(inv.subtotal ?? inv.amount),
      zar(inv.tax ?? inv.taxAmount),
      zar(inv.totalAmount ?? inv.total ?? inv.amount),
      inv.status ?? "", inv.notes ?? "",
    ]),
  ]);

  addSheet("Rental Contracts", [
    ["Contract #", "Client", "Item", "Start Date", "End Date", "Monthly Rate (ZAR)", "Status", "Notes"],
    ...(backup.rentalContracts as any[]).map((rc: any) => [
      rc.contractNumber ?? rc.id,
      clientMap.get(rc.clientId) ?? rc.clientId,
      itemMap.get(rc.inventoryItemId) ?? rc.inventoryItemId,
      dateStr(rc.startDate), dateStr(rc.endDate),
      zar(rc.monthlyRate ?? rc.rentalRate),
      rc.status ?? "", rc.notes ?? "",
    ]),
  ]);

  addSheet("Stock", [
    ["SKU", "Name", "Type", "Qty", "Min Stock", "Max Stock", "Unit Price (ZAR)", "Supplier", "Department", "Location"],
    ...(backup.inventoryItems as any[]).map((i: any) => [
      i.sku ?? "", i.name, i.type ?? "",
      i.quantity ?? 0, i.minStockLevel ?? "", i.maxStockLevel ?? "",
      zar(i.unitPrice ?? i.price),
      i.supplier ?? "", deptMap.get(i.departmentId ?? i.divisionId) ?? "", i.location ?? "",
    ]),
  ]);

  addSheet("Staff", [
    ["Name", "Role", "Email", "Phone", "Department", "Active"],
    ...(backup.workers as any[]).map((w: any) => [
      w.name, w.role ?? "", w.email ?? "", w.phone ?? "",
      deptMap.get(w.departmentId) ?? "", w.isActive ? "Yes" : "No",
    ]),
  ]);

  addSheet("Teams", [
    ["Team Name", "Department", "Supervisor", "Active", "Members", "Notes"],
    ...teams.map((t: any) => [
      t.name,
      deptMap.get(t.departmentId) ?? "",
      workerMap.get(t.supervisorId) ?? "",
      t.isActive ? "Yes" : "No",
      (teamMembersMap.get(t.id) ?? []).join(", "),
      t.notes ?? "",
    ]),
  ]);

  addSheet("Attendance", [
    ["Team", "Date", "Status", "Submitted By", "Submitted At"],
    ...attendanceRecords.map((a: any) => [
      teamMap.get(a.teamId) ?? a.teamId,
      dateStr(a.date), a.status ?? "",
      a.submittedBy ?? "", dateStr(a.submittedAt),
    ]),
  ]);

  addSheet("Attendance Members", [
    ["Team", "Date", "Employee", "Role", "Status", "Absence Reason", "Notes"],
    ...allMemberRecords.map((m: any) => {
      const att = attMap.get(m.attendanceId);
      return [
        att ? (teamMap.get(att.teamId) ?? att.teamId) : "",
        att ? dateStr(att.date) : "",
        m.employeeName ?? workerMap.get(m.workerId) ?? m.workerId,
        m.role ?? "", m.status ?? "",
        m.absenceReason ?? "", m.notes ?? "",
      ];
    }),
  ]);

  addSheet("Vehicles", [
    ["Registration", "Make", "Model", "Year", "Type", "Status", "Odometer (km)", "Notes"],
    ...vehicles.map((v: any) => [
      v.registrationNumber ?? v.registration ?? "",
      v.make ?? "", v.model ?? "", v.year ?? "",
      v.vehicleType ?? v.type ?? "", v.status ?? "",
      v.currentOdometer ?? v.odometer ?? "", v.notes ?? "",
    ]),
  ]);

  addSheet("Fuel Fill-ups", [
    ["Date", "Vehicle", "Driver", "Fuel Type", "Litres", "Total Cost (ZAR)", "Odometer (km)", "Full Tank"],
    ...fuelFillups.map((f: any) => [
      dateStr(f.fillupDate ?? f.date),
      vehicleMap.get(f.vehicleId) ?? f.vehicleId,
      workerMap.get(f.workerId) ?? (f.workerId ?? ""),
      f.fuelType ?? "",
      f.litres ?? f.liters ?? f.quantity ?? "",
      zar(f.totalCost ?? f.cost ?? f.amount),
      f.odometer ?? f.odometerReading ?? "",
      f.fullTank ? "Yes" : "No",
    ]),
  ]);

  addSheet("Vehicle Inspections", [
    ["Date", "Vehicle", "Inspector", "Overall Status", "Odometer (km)", "Notes"],
    ...inspections.map((i: any) => [
      dateStr(i.inspectionDate ?? i.date),
      vehicleMap.get(i.vehicleId) ?? i.vehicleId,
      workerMap.get(i.inspectedBy ?? i.workerId) ?? "",
      i.overallStatus ?? i.status ?? "",
      i.odometerReading ?? i.odometer ?? "", i.notes ?? "",
    ]),
  ]);

  addSheet("Maintenance", [
    ["Date", "Vehicle", "Service Type", "Cost (ZAR)", "Odometer (km)", "Performed By", "Next Service (km)", "Notes"],
    ...serviceRecords.map((s: any) => [
      dateStr(s.serviceDate ?? s.date),
      vehicleMap.get(s.vehicleId) ?? s.vehicleId,
      s.serviceType ?? s.type ?? "",
      zar(s.cost ?? s.totalCost),
      s.odometerReading ?? s.odometer ?? "",
      s.performedBy ?? s.technician ?? "",
      s.nextServiceOdometer ?? "", s.notes ?? "",
    ]),
  ]);

  addSheet("Reported Issues", [
    ["Date Reported", "Vehicle", "Issue Type", "Severity", "Description", "Status", "Reported By", "Resolved Date"],
    ...vehicleIssues.map((i: any) => [
      dateStr(i.reportedDate ?? i.createdAt ?? i.date),
      vehicleMap.get(i.vehicleId) ?? i.vehicleId,
      i.issueType ?? i.type ?? "", i.severity ?? "",
      i.description ?? "", i.status ?? "",
      workerMap.get(i.reportedBy ?? i.workerId) ?? "",
      dateStr(i.resolvedDate ?? i.resolvedAt),
    ]),
  ]);

  addSheet("Purchase Orders", [
    ["PO #", "Supplier", "Order Date", "Required Date", "Total (ZAR)", "Status", "Notes"],
    ...(backup.purchaseOrders as any[]).map((po: any) => [
      po.poNumber ?? po.id,
      supplierMap.get(po.supplierId) ?? po.supplierId,
      dateStr(po.orderDate ?? po.createdAt),
      dateStr(po.requiredDate ?? po.dueDate),
      zar(po.totalAmount ?? po.total),
      po.status ?? "", po.notes ?? "",
    ]),
  ]);

  addSheet("Suppliers", [
    ["Name", "Contact Person", "Phone", "Email", "Address", "Payment Terms", "Notes"],
    ...(backup.suppliers as any[]).map((s: any) => [
      s.name, s.contactPerson ?? s.contact ?? "",
      s.phone ?? "", s.email ?? "",
      s.address ?? "", s.paymentTerms ?? "", s.notes ?? "",
    ]),
  ]);

  const fieldDiaries: any[] = Array.isArray((backup as any).fieldDiaries) ? (backup as any).fieldDiaries : [];
  addSheet("Field Diaries", [
    ["Date", "Worker", "Job #", "Client", "Entry", "Notes"],
    ...fieldDiaries.map((d: any) => [
      dateStr(d.date ?? d.createdAt),
      workerMap.get(d.workerId) ?? d.workerName ?? "",
      d.jobNumber ?? d.jobId ?? "",
      clientMap.get(d.clientId) ?? d.clientName ?? "",
      d.entry ?? d.description ?? "",
      d.notes ?? "",
    ]),
  ]);

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const filename = `job-flow-excel-backup-${new Date().toISOString().split("T")[0]}.xlsx`;
  return { buffer, filename, sizeBytes: buffer.length };
}
