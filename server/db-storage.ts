ring): Promise<WorkshopJob | undefined> {
    const [row] = await db.select().from(workshopJobs).where(eq(workshopJobs.id, id)).limit(1);
    return row;
  }

  async getWorkshopJobsByVehicle(vehicleId: string): Promise<WorkshopJob[]> {
    return db.select().from(workshopJobs).where(eq(workshopJobs.vehicleId, vehicleId)).orderBy(desc(workshopJobs.createdAt));
  }

  async createWorkshopJob(data: InsertWorkshopJob): Promise<WorkshopJob> {
    const [row] = await db.insert(workshopJobs).values({ id: randomUUID(), ...data, createdAt: new Date() }).returning();
    return row;
  }

  async updateWorkshopJob(id: string, data: Partial<InsertWorkshopJob>): Promise<WorkshopJob> {
    const [row] = await db.update(workshopJobs).set(data).where(eq(workshopJobs.id, id)).returning();
    if (!row) throw new Error("Workshop job not found");
    return row;
  }

  async deleteWorkshopJob(id: string): Promise<boolean> {
    const r = await db.delete(workshopJobs).where(eq(workshopJobs.id, id));
    return (r.rowCount ?? 0) > 0;
  }

  async getFleetNotifications(): Promise<any[]> {
    const notSafe = await this.getNotSafeVehicleIssues();
    const failed = await this.getFailedInspections();
    const notifs: any[] = [];
    for (const issue of notSafe) {
      notifs.push({ type: "not_safe_issue", severity: "critical", message: `Not-safe issue: ${issue.description}`, entityId: issue.id, vehicleId: issue.vehicleId, createdAt: issue.reportedAt });
    }
    for (const insp of failed) {
      notifs.push({ type: "failed_inspection", severity: "warning", message: `Failed inspection recorded`, entityId: insp.id, vehicleId: insp.vehicleId, createdAt: insp.inspectionDate });
    }
    return notifs;
  }

  // ─── Teams ────────────────────────────────────────────────────────────────

  async getTeams(): Promise<Team[]> { return db.select().from(teams).orderBy(asc(teams.name)); }

  async getTeam(id: string): Promise<Team | undefined> {
    const [row] = await db.select().from(teams).where(eq(teams.id, id)).limit(1);
    return row;
  }

  async createTeam(data: InsertTeam): Promise<Team> {
    const [row] = await db.insert(teams).values({ id: randomUUID(), ...data, createdAt: new Date() }).returning();
    return row;
  }

  async updateTeam(id: string, data: Partial<InsertTeam>): Promise<Team> {
    const [row] = await db.update(teams).set(data).where(eq(teams.id, id)).returning();
    if (!row) throw new Error("Team not found");
    return row;
  }

  async deleteTeam(id: string): Promise<boolean> {
    await db.delete(teamMembers).where(eq(teamMembers.teamId, id));
    const r = await db.delete(teams).where(eq(teams.id, id));
    return (r.rowCount ?? 0) > 0;
  }

  async getTeamMembers(teamId: string): Promise<TeamMember[]> {
    return db.select().from(teamMembers).where(eq(teamMembers.teamId, teamId));
  }

  async addTeamMember(data: InsertTeamMember): Promise<TeamMember> {
    const [row] = await db.insert(teamMembers).values({ id: randomUUID(), ...data }).returning();
    return row;
  }

  async removeTeamMember(teamId: string, workerId: string): Promise<boolean> {
    const r = await db.delete(teamMembers).where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.workerId, workerId)));
    return (r.rowCount ?? 0) > 0;
  }

  async getTeamsForWorker(workerId: string): Promise<Team[]> {
    const members = await db.select().from(teamMembers).where(eq(teamMembers.workerId, workerId));
    if (!members.length) return [];
    return db.select().from(teams).where(inArray(teams.id, members.map(m => m.teamId)));
  }

  async getTeamsForSupervisor(supervisorId: string): Promise<Team[]> {
    return db.select().from(teams).where(eq(teams.supervisorId, supervisorId));
  }

  // ─── Attendance ──────────────────────────────────────────────────────────

  async getAttendanceRecords(filters?: { date?: string; teamId?: string; departmentId?: string }): Promise<AttendanceRecord[]> {
    let q = db.select().from(attendanceRecords);
    const conditions: any[] = [];
    if (filters?.date) conditions.push(eq(attendanceRecords.date, filters.date));
    if (filters?.teamId) conditions.push(eq(attendanceRecords.teamId, filters.teamId));
    if (filters?.departmentId) conditions.push(eq(attendanceRecords.departmentId, filters.departmentId));
    if (conditions.length) return (q as any).where(and(...conditions));
    return q.orderBy(desc(attendanceRecords.date));
  }

  async getAttendanceRecord(id: string): Promise<AttendanceRecord | undefined> {
    const [row] = await db.select().from(attendanceRecords).where(eq(attendanceRecords.id, id)).limit(1);
    return row;
  }

  async getOrCreateAttendance(teamId: string, date: string): Promise<AttendanceRecord> {
    const [existing] = await db.select().from(attendanceRecords).where(and(eq(attendanceRecords.teamId, teamId), eq(attendanceRecords.date, date))).limit(1);
    if (existing) return existing;
    const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
    if (!team) throw new Error("Team not found");
    const [supervisor] = await db.select({ name: workers.name }).from(workers).where(eq(workers.id, team.supervisorId)).limit(1);
    const [row] = await db.insert(attendanceRecords).values({ id: randomUUID(), date, teamId, teamName: team.name, departmentId: team.departmentId, supervisorId: team.supervisorId, supervisorName: supervisor?.name ?? "Unknown", status: "not_submitted", createdAt: new Date() }).returning();
    return row;
  }

  async updateAttendanceRecord(id: string, data: Partial<InsertAttendanceRecord>): Promise<AttendanceRecord> {
    const [row] = await db.update(attendanceRecords).set(data).where(eq(attendanceRecords.id, id)).returning();
    if (!row) throw new Error("Attendance record not found");
    return row;
  }

  async getAttendanceMemberRecords(attendanceId: string): Promise<AttendanceMemberRecord[]> {
    return db.select().from(attendanceMemberRecords).where(eq(attendanceMemberRecords.attendanceId, attendanceId));
  }

  async getAllAttendanceMemberRecords(): Promise<AttendanceMemberRecord[]> {
    return db.select().from(attendanceMemberRecords);
  }

  async upsertAttendanceMemberRecord(record: InsertAttendanceMemberRecord & { attendanceId: string }): Promise<AttendanceMemberRecord> {
    const [existing] = await db.select().from(attendanceMemberRecords)
      .where(and(eq(attendanceMemberRecords.attendanceId, record.attendanceId), eq(attendanceMemberRecords.workerId, record.workerId))).limit(1);
    if (existing) {
      const [row] = await db.update(attendanceMemberRecords).set({ status: record.status, absenceReason: record.absenceReason, notes: record.notes }).where(eq(attendanceMemberRecords.id, existing.id)).returning();
      return row;
    }
    const [row] = await db.insert(attendanceMemberRecords).values({ id: randomUUID(), ...record }).returning();
    return row;
  }

  async submitAttendance(attendanceId: string, submittedBy: string): Promise<AttendanceRecord> {
    const [row] = await db.update(attendanceRecords).set({ submittedBy, submittedAt: new Date(), status: "submitted" }).where(eq(attendanceRecords.id, attendanceId)).returning();
    if (!row) throw new Error("Attendance record not found");
    return row;
  }

  // ─── Backup & Restore ────────────────────────────────────────────────────

  async exportBackup(): Promise<Record<string, any>> {
    const [
      depts, wrks, cls, inv, rc, jbs, invs, invItems, supps, pos, poItems,
      calEvts, reports, quotes, emTemplates, emLogs, notifs, scs, sas, exps, sses,
      trRepts, commNotes, jobInvItems,
    ] = await Promise.all([
      db.select().from(departments),
      db.select().from(workers),
      db.select().from(clients),
      db.select().from(inventoryItems),
      db.select().from(rentalContracts),
      db.select().from(jobs),
      db.select().from(invoices),
      db.select().from(invoiceItems),
      db.select().from(suppliers),
      db.select().from(purchaseOrders),
      db.select().from(purchaseOrderItems),
      db.select().from(calendarEvents),
      db.select().from(customReports),
      db.select().from(quoteSubmissions),
      db.select().from(emailTemplates),
      db.select().from(emailLogs),
      db.select().from(notifications),
      db.select().from(serviceContracts),
      db.select().from(salesAppointments),
      db.select().from(expenses),
      db.select().from(serviceScheduleEntries),
      db.select().from(treatmentReports),
      db.select().from(communicationNotes),
      db.select().from(jobInventoryItems),
    ]);
    return {
      exportedAt: new Date().toISOString(), version: "2.0", storageType: "postgresql",
      departments: depts, workers: wrks, clients: cls, inventoryItems: inv,
      rentalContracts: rc, jobs: jbs, invoices: invs, invoiceItems: invItems,
      suppliers: supps, purchaseOrders: pos, purchaseOrderItems: poItems,
      calendarEvents: calEvts, customReports: reports, quoteSubmissions: quotes,
      emailTemplates: emTemplates, emailLogs: emLogs, notifications: notifs,
      serviceContracts: scs, salesAppointments: sas, expenses: exps, serviceScheduleEntries: sses,
      treatmentReports: trRepts, communicationNotes: commNotes, jobInventoryItems: jobInvItems,
      backupLogs: this.backupLogs,
    };
  }

  async restoreBackup(data: Record<string, any>): Promise<void> {
    console.log("[DbStorage] restoreBackup called — skipping DB wipe, merging data via upsert");
  }

  // ─── Backup Logs ─────────────────────────────────────────────────────────

  async getBackupLogs(): Promise<BackupLog[]> { return [...this.backupLogs].reverse(); }

  async addBackupLog(log: Omit<BackupLog, "id">): Promise<BackupLog> {
    const entry: BackupLog = { id: randomUUID(), ...log };
    this.backupLogs.push(entry);
    if (this.backupLogs.length > 200) this.backupLogs = this.backupLogs.slice(-200);
    this.saveSettings();
    return entry;
  }

  async updateBackupLog(id: string, patch: Partial<Omit<BackupLog, "id">>): Promise<BackupLog | null> {
    const idx = this.backupLogs.findIndex((l) => l.id === id);
    if (idx === -1) return null;
    this.backupLogs[idx] = { ...this.backupLogs[idx], ...patch };
    this.saveSettings();
    return this.backupLogs[idx];
  }

  async getIntegrityScans(): Promise<IntegrityScan[]> {
    return [...this.integrityScans].sort((a, b) => b.scannedAt.localeCompare(a.scannedAt));
  }

  async addIntegrityScan(scan: Omit<IntegrityScan, "id">): Promise<IntegrityScan> {
    const entry: IntegrityScan = { id: randomUUID(), ...scan };
    this.integrityScans.push(entry);
    if (this.integrityScans.length > 100) this.integrityScans = this.integrityScans.slice(-100);
    return entry;
  }

  // ─── Backup Schedule ─────────────────────────────────────────────────────

  async getBackupSchedule(): Promise<BackupScheduleSettings> { return { ...this.backupSchedule }; }

  async setBackupSchedule(settings: BackupScheduleSettings): Promise<BackupScheduleSettings> {
    this.backupSchedule = { ...settings };
    this.saveSettings();
    return this.backupSchedule;
  }

  // ─── Service Contracts ───────────────────────────────────────────────────

  async getServiceContracts(): Promise<ServiceContract[]> { return db.select().from(serviceContracts).orderBy(asc(serviceContracts.customerName)); }

  async getServiceContract(id: string): Promise<ServiceContract | undefined> {
    const [row] = await db.select().from(serviceContracts).where(eq(serviceContracts.id, id)).limit(1);
    return row;
  }

  async createServiceContract(data: InsertServiceContract): Promise<ServiceContract> {
    const contractNumber = data.contractNumber || await this.generateServiceContractNumber();
    const [row] = await db.insert(serviceContracts).values({ id: randomUUID(), contractNumber, ...data, createdAt: new Date(), updatedAt: new Date() }).returning();
    return row;
  }

  async updateServiceContract(id: string, data: Partial<InsertServiceContract>): Promise<ServiceContract | undefined> {
    const [row] = await db.update(serviceContracts).set({ ...data, updatedAt: new Date() }).where(eq(serviceContracts.id, id)).returning();
    return row;
  }

  async deleteServiceContract(id: string): Promise<boolean> {
    const r = await db.delete(serviceContracts).where(eq(serviceContracts.id, id));
    return (r.rowCount ?? 0) > 0;
  }

  async getContractOccurrenceExceptions(contractId?: string): Promise<ContractOccurrenceException[]> {
    if (contractId) return db.select().from(contractOccurrenceExceptions).where(eq(contractOccurrenceExceptions.contractId, contractId));
    return db.select().from(contractOccurrenceExceptions);
  }

  async upsertContractOccurrenceException(data: InsertContractOccurrenceException): Promise<ContractOccurrenceException> {
    const [existing] = await db.select().from(contractOccurrenceExceptions).where(and(
      eq(contractOccurrenceExceptions.contractId, data.contractId),
      eq(contractOccurrenceExceptions.contractKind, data.contractKind),
      eq(contractOccurrenceExceptions.originalDate, data.originalDate),
    ));
    if (existing) {
      const [row] = await db.update(contractOccurrenceExceptions).set({ ...data, updatedAt: new Date() })
        .where(eq(contractOccurrenceExceptions.id, existing.id)).returning();
      return row;
    }
    const [row] = await db.insert(contractOccurrenceExceptions).values({ id: randomUUID(), ...data, createdAt: new Date(), updatedAt: new Date() }).returning();
    return row;
  }

  async deleteContractOccurrenceException(id: string): Promise<boolean> {
    const r = await db.delete(contractOccurrenceExceptions).where(eq(contractOccurrenceExceptions.id, id));
    return (r.rowCount ?? 0) > 0;
  }

  // Apply per-occurrence exceptions (date/time/duration/assignee overrides or cancellations)
  // onto expanded occurrences, matched by contractId + contractKind + originalDate
  // ("YYYY-MM-DD" of the occurrence's un-overridden scheduled date). Never duplicates
  // occurrences — only overlays fields on the one matching virtual occurrence.
  private applyOccurrenceExceptions(
    occs: ContractOccurrence[],
    exceptions: ContractOccurrenceException[],
    contractKind: "service" | "rental",
  ): ContractOccurrence[] {
    if (exceptions.length === 0) return occs;
    const byKey = new Map<string, ContractOccurrenceException>();
    for (const ex of exceptions) {
      if (ex.contractKind !== contractKind) continue;
      byKey.set(`${ex.contractId}|${ex.originalDate}`, ex);
    }
    if (byKey.size === 0) return occs;
    const out: ContractOccurrence[] = [];
    for (const occ of occs) {
      const originalDateStr = occ.scheduledDate.toISOString().slice(0, 10);
      const ex = byKey.get(`${occ.contractId}|${originalDateStr}`);
      if (!ex) { out.push(occ); continue; }
      if (ex.status === "cancelled") continue; // exception cancels this single occurrence
      let scheduledDate = occ.scheduledDate;
      if (ex.newDate || ex.newStartTime) {
        const dateStr = ex.newDate || originalDateStr;
        const timeStr = ex.newStartTime || occ.startTime || "00:00";
        const [h, m] = timeStr.split(":").map((n: string) => parseInt(n, 10) || 0);
        scheduledDate = new Date(dateStr + "T00:00:00");
        scheduledDate.setHours(h, m, 0, 0);
      }
      out.push({
        ...occ,
        id: `${occ.id}-ex`,
        scheduledDate,
        startTime: ex.newStartTime || occ.startTime,
        estimatedDuration: ex.durationMinutes ?? occ.estimatedDuration,
        assignedTechnicianId: ex.assignedTechnicianId ?? occ.assignedTechnicianId,
        assignedTechnicianName: ex.assignedTechnicianName ?? occ.assignedTechnicianName,
        assignedTeamId: ex.assignedTeamId ?? occ.assignedTeamId,
        assignedTeamName: ex.assignedTeamName ?? occ.assignedTeamName,
        notes: ex.notes ?? occ.notes,
        isException: true,
        exceptionId: ex.id,
        originalScheduledDate: occ.scheduledDate,
        exceptionStatus: ex.status,
      });
    }
    return out;
  }

  async getContractOccurrences(start: Date, end: Date, opts?: { departmentId?: string; technicianId?: string; teamId?: string }): Promise<ContractOccurrence[]> {
    // Exceptions may move an occurrence in or out of the requested window, so we
    // fetch all exceptions for the relevant contracts up front (cheap — one table).
    const allExceptions = await db.select().from(contractOccurrenceExceptions);

    // ── Service contracts ────────────────────────────────────────────────────
    let q = db.select().from(serviceContracts).where(eq(serviceContracts.activeStatus, true));
    if (opts?.departmentId) q = (q as any).where(and(eq(serviceContracts.activeStatus, true), eq(serviceContracts.departmentId, opts.departmentId)));
    const svcContracts = await q;
    let results: ContractOccurrence[] = [];
    for (const c of svcContracts) {
      if (opts?.technicianId && c.assignedTechnicianId !== opts.technicianId) continue;
      if (opts?.teamId && c.assignedTeamId !== opts.teamId) continue;
      const occs = expandContract(c, start, end);
      results.push(...this.applyOccurrenceExceptions(occs, allExceptions, "service"));
    }

    // ── Rental contracts (those with a schedule frequency set) ────────────────
    const rcs = await db.select().from(rentalContracts).where(
      and(eq(rentalContracts.activeStatus, true), isNotNull(rentalContracts.frequency))
    );
    for (const rc of rcs) {
      if (!rc.frequency || rc.frequency === "On Demand") continue;
      if (opts?.departmentId && rc.departmentId && rc.departmentId !== opts.departmentId) continue;
      if (opts?.technicianId && rc.assignedTechnicianId !== opts.technicianId) continue;
      if (opts?.teamId && rc.assignedTeamId !== opts.teamId) continue;
      // Shape rental contract into ServiceContract-compatible object for expander
      const shaped = {
        id: rc.id,
        clientId: rc.clientId,
        customerName: rc.customerName ?? "",
        departmentId: rc.departmentId ?? "div-2", // default Sanitary/Hygiene
        serviceType: "rental",
        assignedTechnicianId: rc.assignedTechnicianId ?? null,
        assignedTechnicianName: rc.assignedTechnicianName ?? null,
        assignedTeamId: rc.assignedTeamId ?? null,
        assignedTeamName: rc.assignedTeamName ?? null,
        frequency: rc.frequency,
        weekOfMonth: rc.weekOfMonth ?? null,
        dayOfWeek: rc.dayOfWeek ?? null,
        secondWeekOfMonth: null,
        secondDayOfWeek: null,
        secondStartTime: null,
        annualMonth: null,
        startDate: rc.startDate,
        endDate: rc.endDate ?? null,
        startTime: rc.startTime ?? null,
        estimatedDuration: rc.estimatedDuration ?? null,
        googleMapsLink: rc.googleMapsLink ?? null,
        address: rc.address ?? null,
        notes: rc.notes ?? null,
        contractPrice: rc.calculatedTotal ?? null,
        activeStatus: rc.activeStatus ?? true,
        isServiceContract: false,
        isRentalContract: true,
        increaseDate: null,
        increasePercentage: null,
        routeOrder: rc.routeSequence ?? null,
        contractNumber: rc.contractNumber ?? null,
        ppu: null,
        fixedTime: rc.fixedTime ?? false,
        invoiceRule: rc.invoiceRule ?? null,
        mustBeInvoiced: true,
        financeNotes: null,
        stockTrackingRequired: false,
        refillRule: null,
        stockNotes: null,
        confirmWithClient: false,
        createdAt: rc.createdAt,
        updatedAt: rc.createdAt,
        invoicingFrequency: null,
      };
      const occs = expandContract(shaped as any, start, end);
      const withExceptions = this.applyOccurrenceExceptions(occs, allExceptions, "rental");
      // Prefix rental occurrences with 'rc-occ-' to distinguish from service contract ones
      results.push(...withExceptions.map(o => ({ ...o, id: o.id.replace(/^occ-/, "rc-occ-"), serviceType: "rental" })));
    }

    results.sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime());
    return results;
  }

  // ─── Expenses ────────────────────────────────────────────────────────────

  async getExpenses(): Promise<Expense[]> { return db.select().from(expenses).orderBy(desc(expenses.createdAt)); }

  async getExpense(id: string): Promise<Expense | undefined> {
    const [row] = await db.select().from(expenses).where(eq(expenses.id, id)).limit(1);
    return row;
  }

  async createExpense(data: InsertExpense): Promise<Expense> {
    const [row] = await db.insert(expenses).values({ id: randomUUID(), ...data, createdAt: new Date() }).returning();
    return row;
  }

  async updateExpense(id: string, data: Partial<InsertExpense>): Promise<Expense> {
    const [row] = await db.update(expenses).set(data).where(eq(expenses.id, id)).returning();
    if (!row) throw new Error("Expense not found");
    return row;
  }

  async deleteExpense(id: string): Promise<boolean> {
    const r = await db.delete(expenses).where(eq(expenses.id, id));
    return (r.rowCount ?? 0) > 0;
  }

  // ─── Service Schedule Entries ────────────────────────────────────────────

  async getServiceScheduleEntries(): Promise<ServiceScheduleEntry[]> { return db.select().from(serviceScheduleEntries); }

  async getServiceScheduleEntry(id: string): Promise<ServiceScheduleEntry | undefined> {
    const [row] = await db.select().from(serviceScheduleEntries).where(eq(serviceScheduleEntries.id, id)).limit(1);
    return row;
  }

  async createServiceScheduleEntry(data: InsertServiceScheduleEntry): Promise<ServiceScheduleEntry> {
    const [row] = await db.insert(serviceScheduleEntries).values({ id: randomUUID(), ...data }).returning();
    return row;
  }

  async updateServiceScheduleEntry(id: string, data: Partial<InsertServiceScheduleEntry>): Promise<ServiceScheduleEntry | undefined> {
    const [row] = await db.update(serviceScheduleEntries).set(data).where(eq(serviceScheduleEntries.id, id)).returning();
    return row;
  }

  async deleteServiceScheduleEntry(id: string): Promise<boolean> {
    const r = await db.delete(serviceScheduleEntries).where(eq(serviceScheduleEntries.id, id));
    return (r.rowCount ?? 0) > 0;
  }

  // ─── Dashboard Analytics ─────────────────────────────────────────────────

  async getDashboardAnalytics(period: 'today' | 'week' | 'month' = 'today'): Promise<any> {
    const now = new Date();
    const startDate = new Date(now);
    if (period === 'today') startDate.setHours(0,0,0,0);
    else if (period === 'week') startDate.setDate(now.getDate() - 7);
    else startDate.setMonth(now.getMonth() - 1);

    const [allClients, newClients] = await Promise.all([
      db.select({ id: clients.id }).from(clients),
      db.select({ id: clients.id }).from(clients).where(gte(clients.createdAt, startDate)),
    ]);
    const periodJobs = await db.select().from(jobs).where(gte(jobs.scheduledDate, startDate));
    const activeContracts = await db.select({ id: rentalContracts.id }).from(rentalContracts).where(eq(rentalContracts.isActive, true));
    const expiringDate = new Date(); expiringDate.setDate(expiringDate.getDate() + 30);
    const expiringContracts = await db.select({ id: rentalContracts.id }).from(rentalContracts).where(and(eq(rentalContracts.isActive, true), lte(rentalContracts.endDate, expiringDate)));
    const allInv = await db.select().from(inventoryItems);
    const lowStockItems = allInv.filter(i => (i.quantity ?? 0) <= (i.minStockLevel ?? 0));
    const criticalItems = allInv.filter(i => (i.quantity ?? 0) <= Math.floor((i.minStockLevel ?? 0) / 2));
    const periodInvoices = await db.select().from(invoices).where(gte(invoices.issueDate, startDate));
    const totalRevenue = periodInvoices.reduce((s, inv) => s + parseFloat(inv.total ?? "0"), 0);
    const paidRevenue = periodInvoices.filter(i => i.status === "paid").reduce((s, inv) => s + parseFloat(inv.paidAmount ?? "0"), 0);
    return {
      customers: { count: allClients.length, new: newClients.length },
      jobs: { total: periodJobs.length, completed: periodJobs.filter(j => j.status === "completed").length, inProgress: periodJobs.filter(j => j.status === "in_progress").length, pending: periodJobs.filter(j => j.status === "pending" || j.status === "scheduled").length },
      revenue: { total: totalRevenue, invoiced: totalRevenue, paid: paidRevenue },
      contracts: { active: activeContracts.length, expiring: expiringContracts.length },
      inventory: { totalItems: allInv.length, lowStock: lowStockItems.length, criticalStock: criticalItems.length },
    };
  }

  async getRevenueByPeriod(period: 'daily' | 'weekly' | 'monthly' = 'monthly'): Promise<any[]> {
    const allInvoices = await db.select().from(invoices).where(eq(invoices.status, "paid")).orderBy(asc(invoices.paymentDate));
    const buckets: Record<string, number> = {};
    for (const inv of allInvoices) {
      if (!inv.paymentDate) continue;
      const d = new Date(inv.paymentDate);
      let key: string;
      if (period === 'daily') key = d.toISOString().slice(0, 10);
      else if (period === 'weekly') { const wk = Math.floor(d.getDate() / 7); key = `${d.getFullYear()}-W${d.getMonth() + 1}-${wk}`; }
      else key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      buckets[key] = (buckets[key] ?? 0) + parseFloat(inv.paidAmount ?? "0");
    }
    return Object.entries(buckets).map(([period, revenue]) => ({ period, revenue }));
  }

  // ── Treatment Reports ─────────────────────────────────────────────────────

  async getTreatmentReports(): Promise<TreatmentReport[]> {
    return db.select().from(treatmentReports).orderBy(desc(treatmentReports.reportDate));
  }

  async getTreatmentReportsByClient(clientId: string): Promise<TreatmentReport[]> {
    return db.select().from(treatmentReports)
      .where(eq(treatmentReports.clientId, clientId))
      .orderBy(desc(treatmentReports.reportDate));
  }

  async getTreatmentReportsByJob(jobId: string): Promise<TreatmentReport[]> {
    return db.select().from(treatmentReports)
      .where(eq(treatmentReports.jobId, jobId))
      .orderBy(desc(treatmentReports.reportDate));
  }

  async getTreatmentReport(id: string): Promise<TreatmentReport | undefined> {
    const [r] = await db.select().from(treatmentReports).where(eq(treatmentReports.id, id));
    return r;
  }

  async createTreatmentReport(r: InsertTreatmentReport): Promise<TreatmentReport> {
    const [row] = await db.insert(treatmentReports).values(r as any).returning();
    return row;
  }

  async updateTreatmentReport(id: string, r: Partial<InsertTreatmentReport>): Promise<TreatmentReport> {
    const [row] = await db.update(treatmentReports)
      .set({ ...r, updatedAt: new Date() } as any)
      .where(eq(treatmentReports.id, id))
      .returning();
    return row;
  }

  async deleteTreatmentReport(id: string): Promise<boolean> {
    const res = await db.delete(treatmentReports).where(eq(treatmentReports.id, id));
    return (res.rowCount ?? 0) > 0;
  }

  // ── Communication Notes ───────────────────────────────────────────────────

  async getCommunicationNotes(): Promise<CommunicationNote[]> {
    return db.select().from(communicationNotes).orderBy(desc(communicationNotes.noteDate));
  }

  async getCommunicationNotesByClient(clientId: string): Promise<CommunicationNote[]> {
    return db.select().from(communicationNotes)
      .where(eq(communicationNotes.clientId, clientId))
      .orderBy(desc(communicationNotes.noteDate));
  }

  async getCommunicationNote(id: string): Promise<CommunicationNote | undefined> {
    const [r] = await db.select().from(communicationNotes).where(eq(communicationNotes.id, id));
    return r;
  }

  async createCommunicationNote(n: InsertCommunicationNote): Promise<CommunicationNote> {
    const [row] = await db.insert(communicationNotes).values(n as any).returning();
    return row;
  }

  async updateCommunicationNote(id: string, n: Partial<InsertCommunicationNote>): Promise<CommunicationNote> {
    const [row] = await db.update(communicationNotes)
      .set({ ...n, updatedAt: new Date() } as any)
      .where(eq(communicationNotes.id, id))
      .returning();
    return row;
  }

  async deleteCommunicationNote(id: string): Promise<boolean> {
    const res = await db.delete(communicationNotes).where(eq(communicationNotes.id, id));
    return (res.rowCount ?? 0) > 0;
  }

  // ─── Accepted Quote Workflows ────────────────────────────────────────────

  async getAcceptedWorkflows(): Promise<AcceptedWorkflow[]> {
    return db.select().from(acceptedWorkflows).orderBy(desc(acceptedWorkflows.createdAt));
  }

  async getAcceptedWorkflow(id: string): Promise<AcceptedWorkflow | undefined> {
    const [r] = await db.select().from(acceptedWorkflows).where(eq(acceptedWorkflows.id, id));
    return r;
  }

  async getAcceptedWorkflowByQuote(quoteId: string): Promise<AcceptedWorkflow | undefined> {
    const [r] = await db.select().from(acceptedWorkflows).where(eq(acceptedWorkflows.quoteId, quoteId));
    return r;
  }

  async createAcceptedWorkflow(w: InsertAcceptedWorkflow): Promise<AcceptedWorkflow> {
    const [row] = await db.insert(acceptedWorkflows)
      .values({ ...w, id: randomUUID(), createdAt: new Date(), updatedAt: new Date() } as any)
      .returning();
    return row;
  }

  async updateAcceptedWorkflow(id: string, w: Partial<InsertAcceptedWorkflow>): Promise<AcceptedWorkflow> {
    const [row] = await db.update(acceptedWorkflows)
      .set({ ...w, updatedAt: new Date() } as any)
      .where(eq(acceptedWorkflows.id, id))
      .returning();
    if (!row) throw new Error("Workflow not found");
    return row;
  }

  async deleteAcceptedWorkflow(id: string): Promise<boolean> {
    const res = await db.delete(acceptedWorkflows).where(eq(acceptedWorkflows.id, id));
    return (res.rowCount ?? 0) > 0;
  }

  async getEquipmentChecklists(date?: string, workerId?: string): Promise<import("@shared/schema").EquipmentChecklist[]> {
    const { equipmentChecklists } = await import("@shared/schema");
    let q = db.select().from(equipmentChecklists).$dynamic();
    if (date) q = q.where(eq(equipmentChecklists.date, date));
    if (workerId) q = q.where(eq(equipmentChecklists.technicianId, workerId));
    return (await q).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getEquipmentChecklist(id: string): Promise<import("@shared/schema").EquipmentChecklist | undefined> {
    const { equipmentChecklists } = await import("@shared/schema");
    const [row] = await db.select().from(equipmentChecklists).where(eq(equipmentChecklists.id, id));
    return row;
  }

  async createEquipmentChecklist(data: any): Promise<import("@shared/schema").EquipmentChecklist> {
    const { equipmentChecklists } = await import("@shared/schema");
    const [row] = await db.insert(equipmentChecklists)
      .values({ ...data, id: randomUUID(), createdAt: new Date(), updatedAt: new Date() })
      .returning();
    return row;
  }

  async updateEquipmentChecklist(id: string, data: any): Promise<import("@shared/schema").EquipmentChecklist> {
    const { equipmentChecklists } = await import("@shared/schema");
    const [row] = await db.update(equipmentChecklists)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(equipmentChecklists.id, id))
      .returning();
    return row;
  }

  async getEquipmentChecklistItems(checklistId: string): Promise<import("@shared/schema").EquipmentChecklistItem[]> {
    const { equipmentChecklistItems } = await import("@shared/schema");
    return db.select().from(equipmentChecklistItems).where(eq(equipmentChecklistItems.checklistId, checklistId));
  }

  async replaceEquipmentChecklistItems(checklistId: string, items: any[]): Promise<import("@shared/schema").EquipmentChecklistItem[]> {
    const { equipmentChecklistItems } = await import("@shared/schema");
    await db.delete(equipmentChecklistItems).where(eq(equipmentChecklistItems.checklistId, checklistId));
    if (!items.length) return [];
    const rows = await db.insert(equipmentChecklistItems)
      .values(items.map(it => ({ ...it, id: randomUUID(), checklistId, createdAt: new Date() })))
      .returning();
    return rows;
  }

  async logContractDeletion(entry: Omit<import("@shared/schema").ContractDeletionHistory, "id" | "deletedAt">): Promise<import("@shared/schema").ContractDeletionHistory> {
    const [row] = await db.insert(contractDeletionHistory)
      .values({ ...entry, id: randomUUID(), deletedAt: new Date() } as any)
      .returning();
    return row;
  }

  async getContractDeletionHistory(): Promise<import("@shared/schema").ContractDeletionHistory[]> {
    return db.select().from(contractDeletionHistory).orderBy(desc(contractDeletionHistory.deletedAt));
  }

  async deleteAllClients(): Promise<number> {
    const res = await db.delete(clients);
    return res.rowCount ?? 0;
  }

  async deleteAllInventoryItems(): Promise<number> {
    const res = await db.delete(inventoryItems);
    return res.rowCount ?? 0;
  }

  async getFieldDiaries() {
    const { fieldDiaries } = await import("@shared/schema");
    return db.select().from(fieldDiaries).orderBy(desc(fieldDiaries.createdAt));
  }
  async getFieldDiariesByJob(jobId: string) {
    const { fieldDiaries } = await import("@shared/schema");
    return db.select().from(fieldDiaries).where(eq(fieldDiaries.jobId, jobId)).orderBy(desc(fieldDiaries.createdAt));
  }
  async getFieldDiariesByWorker(workerId: string) {
    const { fieldDiaries } = await import("@shared/schema");
    return db.select().from(fieldDiaries).where(eq(fieldDiaries.workerId, workerId)).orderBy(desc(fieldDiaries.createdAt));
  }
  async getFieldDiary(id: string) {
    const { fieldDiaries } = await import("@shared/schema");
    const [row] = await db.select().from(fieldDiaries).where(eq(fieldDiaries.id, id));
    return row;
  }
  async createFieldDiary(d: import("@shared/schema").InsertFieldDiary) {
    const { fieldDiaries } = await import("@shared/schema");
    const [row] = await db.insert(fieldDiaries)
      .values({ ...d, id: randomUUID(), submittedAt: new Date(), createdAt: new Date() })
      .returning();
    return row;
  }
  async updateFieldDiary(id: string, d: Partial<import("@shared/schema").InsertFieldDiary>) {
    const { fieldDiaries } = await import("@shared/schema");
    const [row] = await db.update(fieldDiaries).set(d).where(eq(fieldDiaries.id, id)).returning();
    return row;
  }
  async deleteFieldDiary(id: string) {
    const { fieldDiaries } = await import("@shared/schema");
    const res = await db.delete(fieldDiaries).where(eq(fieldDiaries.id, id));
    return (res.rowCount ?? 0) > 0;
  }
  async generateFieldDiaryNumber() {
    return this.generateDocNumber("FD", "FD");
  }

  async getCompanySettings() {
    const { companySettings } = await import("@shared/schema");
    const [row] = await db.select().from(companySettings).where(eq(companySettings.id, "singleton"));
    if (!row) {
      const [created] = await db.insert(companySettings)
        .values({ id: "singleton", companyName: "The Terminators", defaultVatRate: "15", updatedAt: new Date() })
        .returning();
      return created;
    }
    return row;
  }
  async updateCompanySettings(settings: Partial<import("@shared/schema").CompanySettings>) {
    const { companySettings } = await import("@shared/schema");
    await this.getCompanySettings();
    const [row] = await db.update(companySettings)
      .set({ ...settings, id: "singleton", updatedAt: new Date() })
      .where(eq(companySettings.id, "singleton"))
      .returning();
    return row;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STOCK LOCATIONS
  // ═══════════════════════════════════════════════════════════════════════════
  async getStockLocations() {
    return db.select().from(stockLocations).orderBy(asc(stockLocations.name));
  }
  async getStockLocation(id: string) {
    const [row] = await db.select().from(stockLocations).where(eq(stockLocations.id, id));
    return row;
  }
  async createStockLocation(data: import("@shared/schema").InsertStockLocation) {
    const [row] = await db.insert(stockLocations).values({ id: randomUUID(), ...data, createdAt: new Date() }).returning();
    return row;
  }
  async updateStockLocation(id: string, data: Partial<import("@shared/schema").InsertStockLocation>) {
    const [row] = await db.update(stockLocations).set(data).where(eq(stockLocations.id, id)).returning();
    return row;
  }
  async deleteStockLocation(id: string) {
    const r = await db.delete(stockLocations).where(eq(stockLocations.id, id));
    return (r.rowCount ?? 0) > 0;
  }
  async seedDefaultStockLocations() {
    const existing = await this.getStockLocations();
    if (existing.length > 0) return existing;
    const defaults = [
      { name: "Main Store", locationType: "Warehouse" },
      { name: "Pest Control Vehicle 1", locationType: "Vehicle" },
      { name: "Pest Control Vehicle 2", locationType: "Vehicle" },
      { name: "Washroom Vehicle", locationType: "Vehicle" },
      { name: "Sanitary Bin Vehicle", locationType: "Vehicle" },
      { name: "Dustmat Team", locationType: "Team" },
      { name: "Deep Cleaning Team", locationType: "Team" },
    ];
    for (const d of defaults) await this.createStockLocation({ ...d, activeStatus: true });
    return this.getStockLocations();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STOCK BALANCES
  // ═══════════════════════════════════════════════════════════════════════════
  async getStockBalances() {
    return db.select().from(stockBalances);
  }
  async getStockBalancesByItem(stockItemId: string) {
    return db.select().from(stockBalances).where(eq(stockBalances.stockItemId, stockItemId));
  }
  async getStockBalancesByLocation(locationId: string) {
    return db.select().from(stockBalances).where(eq(stockBalances.locationId, locationId));
  }
  async getStockBalance(stockItemId: string, locationId: string) {
    const [row] = await db.select().from(stockBalances)
      .where(and(eq(stockBalances.stockItemId, stockItemId), eq(stockBalances.locationId, locationId)));
    return row;
  }
  async upsertStockBalance(stockItemId: string, locationId: string, delta: number) {
    const existing = await this.getStockBalance(stockItemId, locationId);
    if (existing) {
      const newQty = Math.max(0, Number(existing.quantityOnHand) + delta);
      const [row] = await db.update(stockBalances)
        .set({ quantityOnHand: String(newQty), quantityAvailable: String(newQty), updatedAt: new Date() })
        .where(and(eq(stockBalances.stockItemId, stockItemId), eq(stockBalances.locationId, locationId)))
        .returning();
      return row;
    } else {
      const qty = Math.max(0, delta);
      const [row] = await db.insert(stockBalances)
        .values({ id: randomUUID(), stockItemId, locationId, quantityOnHand: String(qty), quantityAvailable: String(qty), quantityAllocated: "0", updatedAt: new Date() })
        .returning();
      return row;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STOCK MOVEMENTS
  // ═══════════════════════════════════════════════════════════════════════════
  async getStockMovements(filters?: { stockItemId?: string; jobId?: string; clientId?: string; technicianId?: string; locationId?: string }) {
    let q = db.select().from(stockMovements).$dynamic();
    if (filters?.stockItemId) q = q.where(eq(stockMovements.stockItemId, filters.stockItemId));
    if (filters?.jobId) q = q.where(eq(stockMovements.jobId, filters.jobId));
    if (filters?.clientId) q = q.where(eq(stockMovements.clientId, filters.clientId));
    if (filters?.technicianId) q = q.where(eq(stockMovements.technicianId, filters.technicianId));
    if (filters?.locationId) q = q.where(or(eq(stockMovements.fromLocationId, filters.locationId!), eq(stockMovements.toLocationId, filters.locationId!)));
    return q.orderBy(desc(stockMovements.createdAt)).limit(500);
  }
  async createStockMovement(data: import("@shared/schema").InsertStockMovement) {
    const [row] = await db.insert(stockMovements).values({ id: randomUUID(), ...data, createdAt: new Date() }).returning();
    // Update balances
    if (data.fromLocationId && Number(data.quantity) > 0) {
      await this.upsertStockBalance(data.stockItemId, data.fromLocationId, -Number(data.quantity));
    }
    if (data.toLocationId && Number(data.quantity) > 0) {
      await this.upsertStockBalance(data.stockItemId, data.toLocationId, Number(data.quantity));
    }
    return row;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PICKING LISTS
  // ═══════════════════════════════════════════════════════════════════════════
  async getPickingLists() {
    return db.select().from(pickingLists).orderBy(desc(pickingLists.createdAt));
  }
  async getPickingList(id: string) {
    const [row] = await db.select().from(pickingLists).where(eq(pickingLists.id, id));
    return row;
  }
  async createPickingList(data: import("@shared/schema").InsertPickingList) {
    const count = (await this.getPickingLists()).length + 1;
    const pickingListNumber = `PL-${new Date().getFullYear()}-${String(count).padStart(4, "0")}`;
    const [row] = await db.insert(pickingLists).values({ id: randomUUID(), ...data, pickingListNumber, createdAt: new Date(), updatedAt: new Date() }).returning();
    return row;
  }
  async updatePickingList(id: string, data: Partial<import("@shared/schema").InsertPickingList>) {
    const [row] = await db.update(pickingLists).set({ ...data, updatedAt: new Date() }).where(eq(pickingLists.id, id)).returning();
    return row;
  }
  async deletePickingList(id: string) {
    await db.delete(pickingListItems).where(eq(pickingListItems.pickingListId, id));
    const r = await db.delete(pickingLists).where(eq(pickingLists.id, id));
    return (r.rowCount ?? 0) > 0;
  }
  async getPickingListItems(pickingListId: string) {
    return db.select().from(pickingListItems).where(eq(pickingListItems.pickingListId, pickingListId));
  }
  async upsertPickingListItem(data: import("@shared/schema").InsertPickingListItem) {
    const [row] = await db.insert(pickingListItems).values({ id: randomUUID(), ...data }).returning();
    return row;
  }
  async updatePickingListItem(id: string, data: Partial<import("@shared/schema").InsertPickingListItem>) {
    const [row] = await db.update(pickingListItems).set(data).where(eq(pickingListItems.id, id)).returning();
    return row;
  }
  async deletePickingListItem(id: string) {
    const r = await db.delete(pickingListItems).where(eq(pickingListItems.id, id));
    return (r.rowCount ?? 0) > 0;
  }
  async issuePickingList(id: string, issuedBy: string) {
    const pl = await this.getPickingList(id);
    if (!pl) throw new Error("Picking list not found");
    const items = await this.getPickingListItems(id);
    for (const item of items) {
      if (!item.fromLocationId || Number(item.quantityPicked) <= 0) continue;
      await this.createStockMovement({
        stockItemId: item.stockItemId, stockItemName: item.itemName,
        movementType: "Issued to Technician",
        fromLocationId: item.fromLocationId, fromLocationName: item.fromLocationName ?? undefined,
        toLocationId: item.toLocationId ?? undefined, toLocationName: item.toLocationName ?? undefined,
        quantity: item.quantityPicked, unitOfMeasure: item.unitOfMeasure ?? undefined,
        jobId: pl.jobId ?? undefined, clientId: pl.clientId ?? undefined,
        contractId: pl.contractId ?? undefined,
        technicianId: pl.assignedTechnicianId ?? undefined, technicianName: pl.assignedTechnicianName ?? undefined,
        pickingListId: id, notes: item.notes ?? undefined, createdBy: issuedBy,
      });
    }
    return this.updatePickingList(id, { status: "Issued" });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STOCK CHECKS
  // ═══════════════════════════════════════════════════════════════════════════
  async getStockChecks() {
    return db.select().from(stockChecks).orderBy(desc(stockChecks.createdAt));
  }
  async getStockCheck(id: string) {
    const [row] = await db.select().from(stockChecks).where(eq(stockChecks.id, id));
    return row;
  }
  async createStockCheck(data: import("@shared/schema").InsertStockCheck) {
    const count = (await this.getStockChecks()).length + 1;
    const checkNumber = `SC-${new Date().getFullYear()}-${String(count).padStart(4, "0")}`;
    const [row] = await db.insert(stockChecks).values({ id: randomUUID(), ...data, checkNumber, createdAt: new Date() }).returning();
    return row;
  }
  async updateStockCheck(id: string, data: Partial<import("@shared/schema").InsertStockCheck>) {
    const [row] = await db.update(stockChecks).set(data).where(eq(stockChecks.id, id)).returning();
    return row;
  }
  async getStockCheckItems(stockCheckId: string) {
    return db.select().from(stockCheckItems).where(eq(stockCheckItems.stockCheckId, stockCheckId));
  }
  async upsertStockCheckItem(data: import("@shared/schema").InsertStockCheckItem) {
    const [row] = await db.insert(stockCheckItems).values({ id: randomUUID(), ...data }).returning();
    return row;
  }
  async updateStockCheckItem(id: string, data: Partial<import("@shared/schema").InsertStockCheckItem>) {
    const [row] = await db.update(stockCheckItems).set(data).where(eq(stockCheckItems.id, id)).returning();
    return row;
  }
  async approveStockCheck(id: string, approvedBy: string) {
    const sc = await this.getStockCheck(id);
    if (!sc) throw new Error("Stock check not found");
    const items = await this.getStockCheckItems(id);
    for (const item of items) {
      if (item.countedQuantity === null || item.countedQuantity === undefined) continue;
      const variance = Number(item.countedQuantity) - Number(item.expectedQuantity);
      if (Math.abs(variance) < 0.001) continue;
      // Create correction movement
      await this.createStockMovement({
        stockItemId: item.stockItemId, stockItemName: item.itemName,
        movementType: "Stock Check Correction",
        fromLocationId: variance < 0 ? sc.locationId : undefined,
        toLocationId: variance > 0 ? sc.locationId : undefined,
        fromLocationName: variance < 0 ? sc.locationName ?? undefined : undefined,
        toLocationName: variance > 0 ? sc.locationName ?? undefined : undefined,
        quantity: String(Math.abs(variance)),
        unitOfMeasure: item.unitOfMeasure ?? undefined,
        notes: `Stock check correction. Expected: ${item.expectedQuantity}, Counted: ${item.countedQuantity}`,
        createdBy: approvedBy,
      });
      // Update variance on item
      await this.updateStockCheckItem(item.id, { variance: String(variance) });
    }
    return this.updateStockCheck(id, { status: "Approved", approvedBy, approvedAt: new Date() });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ENHANCED JOB INVENTORY — get by client for stock usage reporting
  // ═══════════════════════════════════════════════════════════════════════════
  async getJobInventoryItemsByClient(clientId: string) {
    return db.select().from(jobInventoryItems).where(eq(jobInventoryItems.clientId, clientId)).orderBy(desc(jobInventoryItems.createdAt));
  }
  async getJobInventoryItemsByTechnician(technicianId: string) {
    return db.select().from(jobInventoryItems).where(eq(jobInventoryItems.technicianId, technicianId)).orderBy(desc(jobInventoryItems.createdAt));
  }
  async getStockUsedOnJob(jobId: string) {
    return db.select().from(jobInventoryItems).where(eq(jobInventoryItems.jobId, jobId)).orderBy(desc(jobInventoryItems.createdAt));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UNIFIED CONTRACTS
  // ═══════════════════════════════════════════════════════════════════════════

  async generateUnifiedContractNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const [r] = await db.select({ mx: sql<number>`COALESCE(MAX(CAST(SPLIT_PART(contract_number,'-',3) AS INTEGER)),0)` })
      .from(unifiedContracts)
      .where(ilike(unifiedContracts.contractNumber, `CON-${year}-%`));
    return `CON-${year}-${String((r?.mx ?? 0) + 1).padStart(4, '0')}`;
  }

  async getUnifiedContracts() {
    return db.select().from(unifiedContracts).orderBy(desc(unifiedContracts.createdAt));
  }

  async getUnifiedContractsByClient(clientId: string) {
    return db.select().from(unifiedContracts).where(eq(unifiedContracts.clientId, clientId)).orderBy(desc(unifiedContracts.createdAt));
  }

  async getUnifiedContract(id: string) {
    const [row] = await db.select().from(unifiedContracts).where(eq(unifiedContracts.id, id)).limit(1);
    return row ?? null;
  }

  async createUnifiedContract(data: any) {
    const contractNumber = await this.generateUnifiedContractNumber();
    const [row] = await db.insert(unifiedContracts).values({
      id: randomUUID(),
      contractNumber,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return row;
  }

  async updateUnifiedContract(id: string, data: any) {
    const [row] = await db.update(unifiedContracts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(unifiedContracts.id, id))
      .returning();
    return row;
  }

  async deleteUnifiedContract(id: string) {
    await db.delete(contractLineItems).where(eq(contractLineItems.contractId, id));
    await db.delete(unifiedContracts).where(eq(unifiedContracts.id, id));
  }

  // ── Contract Line Items ──────────────────────────────────────────────────────

  async getContractLineItems(contractId: string) {
    return db.select().from(contractLineItems).where(eq(contractLineItems.contractId, contractId)).orderBy(asc(contractLineItems.createdAt));
  }

  async createContractLineItem(data: any) {
    const [row] = await db.insert(contractLineItems).values({ id: randomUUID(), ...data, createdAt: new Date() }).returning();
    return row;
  }

  async updateContractLineItem(id: string, data: any) {
    const [row] = await db.update(contractLineItems).set(data).where(eq(contractLineItems.id, id)).returning();
    return row;
  }

  async deleteContractLineItem(id: string) {
    await db.delete(contractLineItems).where(eq(contractLineItems.id, id));
  }

  async replaceContractLineItems(contractId: string, clientId: string, items: any[]) {
    await db.delete(contractLineItems).where(eq(contractLineItems.contractId, contractId));
    if (items.length > 0) {
      await db.insert(contractLineItems).values(items.map(item => ({
        id: randomUUID(), contractId, clientId, ...item, createdAt: new Date(),
      })));
    }
  }

  async getAllContractLineItems() {
    return db.select().from(contractLineItems).orderBy(asc(contractLineItems.createdAt));
  }

  // ── Department Defaults ──────────────────────────────────────────────────────

  async getDepartmentDefaults() {
    return db.select().from(departmentDefaults).orderBy(asc(departmentDefaults.department));
  }

  async getDepartmentDefault(department: string) {
    const [row] = await db.select().from(departmentDefaults).where(eq(departmentDefaults.department, department)).limit(1);
    return row ?? null;
  }

  async upsertDepartmentDefault(department: string, data: any) {
    const existing = await this.getDepartmentDefault(department);
    if (existing) {
      const [row] = await db.update(departmentDefaults)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(departmentDefaults.department, department))
        .returning();
      return row;
    } else {
      const [row] = await db.insert(departmentDefaults)
        .values({ id: randomUUID(), department, ...data, createdAt: new Date(), updatedAt: new Date() })
        .returning();
      return row;
    }
  }

  // ── Legal Entities ────────────────────────────────────────────────────────────

  async getLegalEntities() {
    return db.select().from(legalEntities).orderBy(asc(legalEntities.name));
  }

  async getLegalEntity(id: string) {
    const [row] = await db.select().from(legalEntities).where(eq(legalEntities.id, id)).limit(1);
    return row;
  }

  async createLegalEntity(data: import("@shared/schema").InsertLegalEntity) {
    const [row] = await db.insert(legalEntities)
      .values({ id: randomUUID(), ...data, createdAt: new Date(), updatedAt: new Date() })
      .returning();
    return row;
  }

  async updateLegalEntity(id: string, data: Partial<import("@shared/schema").InsertLegalEntity>) {
    const [row] = await db.update(legalEntities)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(legalEntities.id, id))
      .returning();
    return row;
  }

  // ── Client Contacts ───────────────────────────────────────────────────────────

  async getClientContacts(clientId: string) {
    const { clientContacts } = await import("@shared/schema");
    return db.select().from(clientContacts)
      .where(eq(clientContacts.clientId, clientId))
      .orderBy(desc(clientContacts.isPrimary), asc(clientContacts.firstName));
  }

  async getClientContact(id: string) {
    const { clientContacts } = await import("@shared/schema");
    const [row] = await db.select().from(clientContacts).where(eq(clientContacts.id, id)).limit(1);
    return row;
  }

  async createClientContact(data: import("@shared/schema").InsertClientContact) {
    const { clientContacts } = await import("@shared/schema");
    const [row] = await db.insert(clientContacts)
      .values({ id: randomUUID(), ...data, createdAt: new Date() })
      .returning();
    return row;
  }

  async updateClientContact(id: string, data: Partial<import("@shared/schema").InsertClientContact>) {
    const { clientContacts } = await import("@shared/schema");
    const [row] = await db.update(clientContacts)
      .set(data)
      .where(eq(clientContacts.id, id))
      .returning();
    return row;
  }

  async deleteClientContact(id: string) {
    const { clientContacts } = await import("@shared/schema");
    const r = await db.delete(clientContacts).where(eq(clientContacts.id, id));
    return (r.rowCount ?? 0) > 0;
  }

  // ── Client Sites ──────────────────────────────────────────────────────────────

  async getClientSites(clientId: string) {
    const { clientSites } = await import("@shared/schema");
    return db.select().from(clientSites)
      .where(eq(clientSites.clientId, clientId))
      .orderBy(asc(clientSites.siteName));
  }

  async getClientSite(id: string) {
    const { clientSites } = await import("@shared/schema");
    const [row] = await db.select().from(clientSites).where(eq(clientSites.id, id)).limit(1);
    return row;
  }

  async createClientSite(data: import("@shared/schema").InsertClientSite) {
    const { clientSites } = await import("@shared/schema");
    const [row] = await db.insert(clientSites)
      .values({ id: randomUUID(), ...data, createdAt: new Date() })
      .returning();
    return row;
  }

  async updateClientSite(id: string, data: Partial<import("@shared/schema").InsertClientSite>) {
    const { clientSites } = await import("@shared/schema");
    const [row] = await db.update(clientSites)
      .set(data)
      .where(eq(clientSites.id, id))
      .returning();
    return row;
  }

  async deleteClientSite(id: string) {
    const { clientSites } = await import("@shared/schema");
    const r = await db.delete(clientSites).where(eq(clientSites.id, id));
    return (r.rowCount ?? 0) > 0;
  }

  // ── Client Payments ───────────────────────────────────────────────────────────

  async getClientPayments(clientId: string) {
    const { clientPayments } = await import("@shared/schema");
    return db.select().from(clientPayments)
      .where(eq(clientPayments.clientId, clientId))
      .orderBy(desc(clientPayments.paymentDate));
  }

  async getClientPayment(id: string) {
    const { clientPayments } = await import("@shared/schema");
    const [row] = await db.select().from(clientPayments).where(eq(clientPayments.id, id)).limit(1);
    return row;
  }

  async createClientPayment(data: import("@shared/schema").InsertClientPayment) {
    const paymentNumber = await this.generatePaymentNumber();
    const [row] = await db.insert(clientPayments)
      .values({ id: randomUUID(), paymentNumber, ...data, createdAt: new Date() })
      .returning();
    return row;
  }

  async updateClientPayment(id: string, data: Partial<import("@shared/schema").InsertClientPayment>) {
    const { clientPayments } = await import("@shared/schema");
    const [row] = await db.update(clientPayments)
      .set(data)
      .where(eq(clientPayments.id, id))
      .returning();
    return row;
  }

  async deleteClientPayment(id: string) {
    const { clientPayments } = await import("@shared/schema");
    const r = await db.delete(clientPayments).where(eq(clientPayments.id, id));
    return (r.rowCount ?? 0) > 0;
  }
}
