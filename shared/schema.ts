w()`),
});

export const teamMembers = pgTable("team_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id").notNull(),
  workerId: varchar("worker_id").notNull(),
});

export const attendanceRecords = pgTable("attendance_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  date: text("date").notNull(),           // YYYY-MM-DD
  teamId: varchar("team_id").notNull(),
  teamName: text("team_name").notNull(),
  departmentId: varchar("department_id").notNull(),
  supervisorId: varchar("supervisor_id").notNull(),
  supervisorName: text("supervisor_name").notNull(),
  submittedBy: varchar("submitted_by"),
  submittedAt: timestamp("submitted_at"),
  status: text("status").notNull().default("not_submitted"), // not_submitted | submitted
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const attendanceMemberRecords = pgTable("attendance_member_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  attendanceId: varchar("attendance_id").notNull(),
  workerId: varchar("worker_id").notNull(),
  employeeName: text("employee_name").notNull(),
  role: text("role"),
  status: text("status").notNull().default("not_confirmed"), // present | absent | not_confirmed
  absenceReason: text("absence_reason"), // sick | leave | no_show | off_duty | other
  notes: text("notes"),
});

export const employeeAttendanceRecords = pgTable("employee_attendance_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull(),
  workDate: text("work_date").notNull(), // YYYY-MM-DD in Africa/Johannesburg
  startAt: timestamp("start_at").notNull(),
  endAt: timestamp("end_at"),
  vehicleId: varchar("vehicle_id"),
  startVehicleKm: integer("start_vehicle_km"),
  endVehicleKm: integer("end_vehicle_km"),
  vehicleDistanceKm: integer("vehicle_distance_km"),
  vehicleKmLogId: varchar("vehicle_km_log_id"),
  totalMinutes: integer("total_minutes"),
  lateStartMinutes: integer("late_start_minutes").notNull().default(0),
  earlyFinishMinutes: integer("early_finish_minutes").notNull().default(0),
  status: text("status").notNull().default("WORKING"), // WORKING | FINISHED
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
  correctedBy: varchar("corrected_by"),
  correctionReason: text("correction_reason"),
});

export const employeeAttendanceAudits = pgTable("employee_attendance_audits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  attendanceId: varchar("attendance_id").notNull(),
  employeeId: varchar("employee_id").notNull(),
  actorId: varchar("actor_id").notNull(),
  actorName: text("actor_name").notNull(),
  action: text("action").notNull(), // START_WORK | END_WORK | ATTENDANCE_EDITED | ATTENDANCE_EMAIL_SENT | ATTENDANCE_EMAIL_FAILED
  originalValues: text("original_values"),
  newValues: text("new_values"),
  reason: text("reason"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertTeamSchema = createInsertSchema(teams).omit({ id: true, createdAt: true });
export const insertTeamMemberSchema = createInsertSchema(teamMembers).omit({ id: true });
export const insertAttendanceRecordSchema = createInsertSchema(attendanceRecords).omit({ id: true, createdAt: true });
export const insertAttendanceMemberRecordSchema = createInsertSchema(attendanceMemberRecords).omit({ id: true });
export const insertEmployeeAttendanceRecordSchema = createInsertSchema(employeeAttendanceRecords).omit({ id: true, createdAt: true });
export const insertEmployeeAttendanceAuditSchema = createInsertSchema(employeeAttendanceAudits).omit({ id: true, createdAt: true });

export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Team = typeof teams.$inferSelect;
export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;
export type TeamMember = typeof teamMembers.$inferSelect;
export type InsertAttendanceRecord = z.infer<typeof insertAttendanceRecordSchema>;
export type AttendanceRecord = typeof attendanceRecords.$inferSelect;
export type InsertAttendanceMemberRecord = z.infer<typeof insertAttendanceMemberRecordSchema>;
export type AttendanceMemberRecord = typeof attendanceMemberRecords.$inferSelect;
export type InsertEmployeeAttendanceRecord = z.infer<typeof insertEmployeeAttendanceRecordSchema>;
export type EmployeeAttendanceRecord = typeof employeeAttendanceRecords.$inferSelect;
export type InsertEmployeeAttendanceAudit = z.infer<typeof insertEmployeeAttendanceAuditSchema>;
export type EmployeeAttendanceAudit = typeof employeeAttendanceAudits.$inferSelect;

// Service Contracts — recurring jobs (Outlook-style)
// Frequency: Daily | 2 x a week | Weekly | Twice a month | Monthly | Every 2 months | Quarterly | Every 6 months | Annually | Once-off
export const serviceContracts = pgTable("service_contracts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull(),
  customerName: text("customer_name").notNull(),
  departmentId: varchar("department_id").notNull(),
  serviceType: text("service_type").notNull(),
  assignedTechnicianId: varchar("assigned_technician_id"),
  assignedTechnicianName: text("assigned_technician_name"),
  assignedTeamId: varchar("assigned_team_id"),
  assignedTeamName: text("assigned_team_name"),
  frequency: text("frequency").notNull(),                  // service frequency (how often the visit happens)
  invoicingFrequency: text("invoicing_frequency"),         // how often the customer is invoiced
  startDate: timestamp("start_date"),                      // first date (for Once-off this IS the date)
  endDate: timestamp("end_date"),                          // optional end
  weekOfMonth: integer("week_of_month"),                   // 1..4 or 5 = Last
  dayOfWeek: text("day_of_week"),                          // Monday..Sunday
  secondWeekOfMonth: integer("second_week_of_month"),      // Twice-a-month
  secondDayOfWeek: text("second_day_of_week"),             // 2x-a-week / Twice-a-month
  secondStartTime: text("second_start_time"),              // Twice-a-month
  annualMonth: integer("annual_month"),                    // 1..12 for Annually
  startTime: text("start_time"),                           // HH:MM
  estimatedDuration: integer("estimated_duration"),        // minutes
  googleMapsLink: text("google_maps_link"),
  address: text("address"),
  siteId: varchar("site_id"),          // optional link to client_sites
  notes: text("notes"),
  // Pricing / contract admin
  contractPrice: text("contract_price"),              // stored as text to allow decimals without precision loss
  isServiceContract: boolean("is_service_contract").default(true),
  isRentalContract: boolean("is_rental_contract").default(false),
  increaseDate: text("increase_date"),                // YYYY-MM-DD
  increasePercentage: text("increase_percentage"),    // e.g. "10" for 10%
  routeOrder: integer("route_order"),                 // position within the week/day slot
  contractNumber: text("contract_number"),
  ppu: text("ppu"),                                   // price per unit (if applicable)
  fixedTime: boolean("fixed_time").default(false),    // if true, job must run at exact startTime
  invoiceRule: text("invoice_rule"),                  // Invoice per completed job | monthly | on demand | do not invoice
  mustBeInvoiced: boolean("must_be_invoiced").default(true),
  financeNotes: text("finance_notes"),
  stockTrackingRequired: boolean("stock_tracking_required").default(false),
  refillRule: text("refill_rule"),                    // Refills Included | Excluded | On Demand | Not Applicable
  stockNotes: text("stock_notes"),
  confirmWithClient: boolean("confirm_with_client").default(false),
  activeStatus: boolean("active_status").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// ─── SALES DIARY ────────────────────────────────────────────────────────────

export const SALES_APPT_TYPES = [
  { value: "new_lead_meeting",       label: "New Lead Meeting" },
  { value: "site_visit",             label: "Site Visit" },
  { value: "quote_followup",         label: "Quote Follow-up" },
  { value: "contract_renewal",       label: "Contract Renewal" },
  { value: "existing_client_visit",  label: "Existing Client Visit" },
  { value: "complaint_visit",        label: "Complaint / Issue Visit" },
  { value: "internal_meeting",       label: "Internal Sales Meeting" },
  { value: "other",                  label: "Other" },
] as const;

export const SALES_APPT_STATUSES = [
  { value: "planned",     label: "Planned",     color: "blue" },
  { value: "confirmed",   label: "Confirmed",   color: "green" },
  { value: "completed",   label: "Completed",   color: "gray" },
  { value: "cancelled",   label: "Cancelled",   color: "red" },
  { value: "rescheduled", label: "Rescheduled", color: "yellow" },
  { value: "no_show",     label: "No Show",     color: "orange" },
] as const;

export type SalesApptType   = typeof SALES_APPT_TYPES[number]["value"];
export type SalesApptStatus = typeof SALES_APPT_STATUSES[number]["value"];

export const salesAppointments = pgTable("sales_appointments", {
  id:                   varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title:                text("title").notNull(),
  clientName:           text("client_name").notNull(),
  contactPerson:        text("contact_person"),
  phone:                text("phone"),
  siteAddress:          text("site_address"),
  appointmentType:      text("appointment_type").notNull().default("new_lead_meeting"),
  appointmentTypeOther: text("appointment_type_other"),
  assignedToId:         varchar("assigned_to_id").references(() => workers.id),
  date:                 text("date").notNull(),          // "YYYY-MM-DD"
  startTime:            text("start_time").notNull(),    // "HH:MM"
  endTime:              text("end_time").notNull(),      // "HH:MM"
  estimatedDuration:    integer("estimated_duration"),   // minutes
  status:               text("status").notNull().default("planned"),
  notes:                text("notes"),
  completionNote:       text("completion_note"),
  clientFeedback:       text("client_feedback"),
  nextAction:           text("next_action"),
  followUpDate:         text("follow_up_date"),          // "YYYY-MM-DD"
  leadId:               varchar("lead_id").references(() => quoteSubmissions.id),
  quoteId:              varchar("quote_id"),
  departmentId:         varchar("department_id").references(() => departments.id),
  createdAt:            timestamp("created_at").notNull().default(sql`now()`),
});

export const insertSalesAppointmentSchema = createInsertSchema(salesAppointments).omit({
  id: true,
  createdAt: true,
});
export type InsertSalesAppointment = z.infer<typeof insertSalesAppointmentSchema>;
export type SalesAppointment = typeof salesAppointments.$inferSelect;

export const insertServiceContractSchema = createInsertSchema(serviceContracts, {
  startDate: z.coerce.date().optional().nullable(),
  endDate: z.coerce.date().optional().nullable(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertServiceContract = z.infer<typeof insertServiceContractSchema>;
export type ServiceContract = typeof serviceContracts.$inferSelect;

// ─── CONTRACT OCCURRENCE EXCEPTIONS ─────────────────────────────────────────
// A single overridden calendar occurrence of a recurring service/rental
// contract — e.g. dragged to a different date/time or reassigned to a
// different technician "for this occurrence only". Never mutates the master
// contract's recurrence rule, and never creates a duplicate occurrence: the
// expander (server/db-storage.ts getContractOccurrences) matches by
// contractId + contractKind + originalDate and overlays these fields onto
// the generated occurrence.
export const contractOccurrenceExceptions = pgTable("contract_occurrence_exceptions", {
  id:                     varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId:             varchar("contract_id").notNull(),
  contractKind:           text("contract_kind").notNull(), // 'service' | 'rental'
  originalDate:           text("original_date").notNull(), // "YYYY-MM-DD" — the date this occurrence would fall on before the override
  newDate:                text("new_date"),                 // "YYYY-MM-DD", if rescheduled
  newStartTime:           text("new_start_time"),           // "HH:MM", if rescheduled
  durationMinutes:        integer("duration_minutes"),
  assignedTechnicianId:   varchar("assigned_technician_id"),
  assignedTechnicianName: text("assigned_technician_name"),
  assignedTeamId:         varchar("assigned_team_id"),
  assignedTeamName:       text("assigned_team_name"),
  status:                 text("status").default("scheduled"), // scheduled | cancelled
  notes:                  text("notes"),
  createdAt:              timestamp("created_at").notNull().default(sql`now()`),
  updatedAt:              timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertContractOccurrenceExceptionSchema = createInsertSchema(contractOccurrenceExceptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertContractOccurrenceException = z.infer<typeof insertContractOccurrenceExceptionSchema>;
export type ContractOccurrenceException = typeof contractOccurrenceExceptions.$inferSelect;

// ── Captured Expenses ─────────────────────────────────────────────────────────
export const EXPENSE_CATEGORIES = [
  "Wages",
  "Rent",
  "Fuel",
  "Vehicle repairs",
  "Chemicals",
  "Hygiene consumables",
  "Paper products",
  "Insurance",
  "Telephone / Internet",
  "Electricity / Water",
  "Bank charges",
  "Repairs and maintenance",
  "Other",
] as const;

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];
export type ExpensePaymentStatus = "unpaid" | "paid" | "part_paid";

export const expenses = pgTable("expenses", {
  id:            varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  date:          text("date").notNull(),                                          // "YYYY-MM-DD"
  supplier:      text("supplier").notNull(),
  category:      text("category").notNull(),
  description:   text("description").notNull(),
  amount:        decimal("amount", { precision: 10, scale: 2 }).notNull(),
  vatIncluded:   boolean("vat_included").notNull().default(false),
  departmentId:  varchar("department_id"),
  invoiceUrl:    text("invoice_url"),
  paymentStatus: text("payment_status").notNull().default("unpaid"),             // unpaid | paid | part_paid
  notes:         text("notes"),
  createdAt:     timestamp("created_at").notNull().default(sql`now()`),
});

export const insertExpenseSchema = createInsertSchema(expenses).omit({
  id: true,
  createdAt: true,
});
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expenses.$inferSelect;

// ─── SERVICE SCHEDULING ─────────────────────────────────────────────────────

export const SERVICE_SCHEDULE_SERVICE_TYPES = [
  { value: "sanitary_bins",              label: "Sanitary Bins" },
  { value: "washroom_contract",          label: "Washroom Contracts" },
  { value: "washroom_adhoc",             label: "Washroom Ad-Hoc" },
  { value: "washroom_dispensers",        label: "Washroom Dispensers" },
  { value: "washroom_refills_included",  label: "Washroom Refills (Included)" },
  { value: "washroom_refills_excluded",  label: "Washroom Refills (Excluded)" },
  { value: "washroom_on_demand",         label: "Washroom On Demand" },
  { value: "dustmats",                   label: "Dustmats" },
  { value: "urinal_mats",                label: "Urinal Mats" },
  { value: "paper_towel_refills",        label: "Paper Towel Refills" },
  { value: "auto_towel_dispensers",      label: "Auto Towel Dispensers" },
  { value: "hygiene_deep_cleaning",      label: "Hygiene Deep Cleaning" },
  { value: "pest_control",               label: "Pest Control" },
  { value: "deep_cleaning",              label: "Deep Cleaning" },
  { value: "other",                      label: "Other" },
] as const;

export type ServiceScheduleServiceType = typeof SERVICE_SCHEDULE_SERVICE_TYPES[number]["value"];

export const SERVICE_SCHEDULE_DAYS = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
] as const;

export type ServiceScheduleDay = typeof SERVICE_SCHEDULE_DAYS[number];

// Week-of-month labels used in service scheduling
export const SERVICE_SCHEDULE_WEEKS = [
  "Week 1", "Week 2", "Week 3", "Week 4", "Last Week", "Every Week",
] as const;
export type ServiceScheduleWeek = typeof SERVICE_SCHEDULE_WEEKS[number];

export const serviceScheduleEntries = pgTable("service_schedule_entries", {
  id:                  varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId:            varchar("client_id"),
  clientName:          text("client_name").notNull(),
  contractId:          varchar("contract_id"),
  contractRef:         text("contract_ref"),
  address:             text("address"),
  suburb:              text("suburb"),
  serviceType:         text("service_type").notNull().default("other"),
  frequency:           text("frequency"),
  // Primary occurrence
  weekOfMonth:         text("week_of_month"),               // Week 1..4 | Last Week | Every Week
  dayOfWeek:           text("day_of_week").notNull().default("Monday"),
  serviceTime:         text("service_time"),                // HH:MM
  // Second occurrence (2x a week / Twice a month)
  secondWeekOfMonth:   text("second_week_of_month"),
  secondDayOfWeek:     text("second_day_of_week"),
  secondServiceTime:   text("second_service_time"),
  // Once-off specific date
  onceOffDate:         text("once_off_date"),               // YYYY-MM-DD
  estimatedDuration:   integer("estimated_duration"),       // minutes
  assignedTeam:        text("assigned_team"),
  routeOrder:          integer("route_order").notNull().default(0),
  contractStatus:      text("contract_status").default("active"),
  jobStatus:           text("job_status"),
  googleMapsLink:      text("google_maps_link"),
  notes:               text("notes"),
  isActive:            boolean("is_active").notNull().default(true),
  createdAt:           timestamp("created_at").notNull().default(sql`now()`),
  updatedAt:           timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertServiceScheduleEntrySchema = createInsertSchema(serviceScheduleEntries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertServiceScheduleEntry = z.infer<typeof insertServiceScheduleEntrySchema>;
export type ServiceScheduleEntry = typeof serviceScheduleEntries.$inferSelect;

// ─── TREATMENT REPORTS ──────────────────────────────────────────────────────

export const treatmentReports = pgTable("treatment_reports", {
  id:                   varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId:             varchar("client_id").notNull(),
  jobId:                varchar("job_id"),
  contractId:           varchar("contract_id"),
  technicianId:         varchar("technician_id"),
  technicianName:       text("technician_name"),
  reportDate:           text("report_date").notNull(),        // YYYY-MM-DD
  reportNumber:         text("report_number"),
  serviceType:          text("service_type"),
  pestType:             text("pest_type"),
  treatmentType:        text("treatment_type"),
  siteArea:             text("site_area"),
  chemicalsUsed:        text("chemicals_used"),
  quantityUsed:         text("quantity_used"),
  batchNumber:          text("batch_number"),
  activeIngredient:     text("active_ingredient"),
  treatmentNotes:       text("treatment_notes"),
  recommendations:      text("recommendations"),
  followUpRequired:     boolean("follow_up_required").default(false),
  followUpDate:         text("follow_up_date"),
  customerName:         text("customer_name"),
  customerSignature:    text("customer_signature"),
  technicianSignature:  text("technician_signature"),
  status:               text("status").default("completed"),
  tradingName:          text("trading_name"),
  siteAddress:          text("site_address"),
  jobNumber:            text("job_number"),
  contractNumber:       text("contract_number"),
  salespersonName:      text("salesperson_name"),
  pcoRegistrationNumber:text("pco_registration_number"),
  startTime:            timestamp("start_time"),
  finishTime:           timestamp("finish_time"),
  timeOnSiteMinutes:    integer("time_on_site_minutes"),
  cleanlinessAssessment:text("cleanliness_assessment"),
  cleanlinessComments:  text("cleanliness_comments"),
  noProductUsed:        boolean("no_product_used").notNull().default(false),
  recommendationChoices:text("recommendation_choices"),
  otherRecommendationDetails: text("other_recommendation_details"),
  signatureUnavailable: boolean("signature_unavailable").notNull().default(false),
  signatureUnavailableReason: text("signature_unavailable_reason"),
  actionRequired:       boolean("action_required").notNull().default(false),
  actionReason:         text("action_reason"),
  pdfUrl:               text("pdf_url"),
  pdfGeneratedAt:       timestamp("pdf_generated_at"),
  completedAt:          timestamp("completed_at"),
  completedByWorkerId:  varchar("completed_by_worker_id"),
  createdAt:            timestamp("created_at").notNull().default(sql`now()`),
  updatedAt:            timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertTreatmentReportSchema = createInsertSchema(treatmentReports).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTreatmentReport = z.infer<typeof insertTreatmentReportSchema>;
export type TreatmentReport = typeof treatmentReports.$inferSelect;

// ─── DIGITAL PEST CONTROL TREATMENT REPORT CHILD RECORDS ────────────────────
// These retain the detailed evidence captured in the mobile report while the
// legacy treatment_reports fields keep older reports and desktop forms working.
export const pestControlProducts = pgTable("pest_control_products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  formulation: text("formulation").notNull(),
  registrationNumber: text("registration_number"),
  defaultUnit: text("default_unit").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const treatmentReportAreas = pgTable("treatment_report_areas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reportId: varchar("report_id").notNull(),
  area: text("area").notNull(),
  otherDescription: text("other_description"),
});

export const treatmentReportPests = pgTable("treatment_report_pests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reportId: varchar("report_id").notNull(),
  pestType: text("pest_type").notNull(),
  infestationLevel: text("infestation_level").notNull(),
  otherDescription: text("other_description"),
});

export const treatmentReportEquipment = pgTable("treatment_report_equipment", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reportId: varchar("report_id").notNull(),
  equipmentType: text("equipment_type").notNull(),
  quantity: integer("quantity").notNull().default(1),
  productType: text("product_type"),
  notes: text("notes"),
});

export const treatmentReportProducts = pgTable("treatment_report_products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reportId: varchar("report_id").notNull(),
  productId: varchar("product_id"),
  productName: text("product_name").notNull(),
  formulation: text("formulation"),
  registrationNumber: text("registration_number"),
  unit: text("unit").notNull(),
  quantityUsed: text("quantity_used").notNull(),
  mixtureDilution: text("mixture_dilution"),
});

export const treatmentReportPhotos = pgTable("treatment_report_photos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reportId: varchar("report_id").notNull(),
  fileUrl: text("file_url").notNull(),
  fileName: text("file_name"),
  uploadedByWorkerId: varchar("uploaded_by_worker_id"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const treatmentReportAudits = pgTable("treatment_report_audits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reportId: varchar("report_id").notNull(),
  actorId: varchar("actor_id"),
  actorName: text("actor_name").notNull(),
  action: text("action").notNull(),
  fieldName: text("field_name"),
  previousValue: text("previous_value"),
  nextValue: text("next_value"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const treatmentReportFollowUps = pgTable("treatment_report_follow_ups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reportId: varchar("report_id").notNull(),
  clientId: varchar("client_id").notNull(),
  jobId: varchar("job_id"),
  reason: text("reason").notNull(),
  recommendation: text("recommendation"),
  identifiedDate: text("identified_date").notNull(),
  assignedWorkerId: varchar("assigned_worker_id"),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertPestControlProductSchema = createInsertSchema(pestControlProducts).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type PestControlProduct = typeof pestControlProducts.$inferSelect;
export type InsertPestControlProduct = z.infer<typeof insertPestControlProductSchema>;
export type TreatmentReportArea = typeof treatmentReportAreas.$inferSelect;
export type TreatmentReportPest = typeof treatmentReportPests.$inferSelect;
export type TreatmentReportEquipment = typeof treatmentReportEquipment.$inferSelect;
export type TreatmentReportProduct = typeof treatmentReportProducts.$inferSelect;
export type TreatmentReportPhoto = typeof treatmentReportPhotos.$inferSelect;
export type TreatmentReportAudit = typeof treatmentReportAudits.$inferSelect;
export type TreatmentReportFollowUp = typeof treatmentReportFollowUps.$inferSelect;

// ─── COMMUNICATION NOTES ────────────────────────────────────────────────────

export const communicationNotes = pgTable("communication_notes", {
  id:                   varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId:             varchar("client_id").notNull(),
  jobId:                varchar("job_id"),
  contractId:           varchar("contract_id"),
  noteDate:             text("note_date").notNull(),           // YYYY-MM-DD
  noteTime:             text("note_time"),                     // HH:MM
  type:                 text("type").notNull(),                // WhatsApp | Phone | Email | In Person | Other
  contactPerson:        text("contact_person"),
  notes:                text("notes").notNull(),
  confirmationReceived: boolean("confirmation_received").default(false),
  createdBy:            text("created_by"),
  createdAt:            timestamp("created_at").notNull().default(sql`now()`),
  updatedAt:            timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertCommunicationNoteSchema = createInsertSchema(communicationNotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCommunicationNote = z.infer<typeof insertCommunicationNoteSchema>;
export type CommunicationNote = typeof communicationNotes.$inferSelect;

// ─── ACCEPTED QUOTE WORKFLOWS ────────────────────────────────────────────────

export const WORKFLOW_STATUSES = [
  { value: "pending_registration",  label: "Pending Registration",  color: "bg-slate-100 text-slate-700",   borderColor: "border-l-slate-400"   },
  { value: "registration_sent",     label: "Registration Sent",     color: "bg-amber-100 text-amber-700",   borderColor: "border-l-amber-400"   },
  { value: "registration_received", label: "Registration Received", color: "bg-yellow-100 text-yellow-700", borderColor: "border-l-yellow-400"  },
  { value: "contract_drafted",      label: "Contract Drafted",      color: "bg-blue-100 text-blue-700",     borderColor: "border-l-blue-400"    },
  { value: "contract_sent",         label: "Contract Sent",         color: "bg-indigo-100 text-indigo-700", borderColor: "border-l-indigo-400"  },
  { value: "contract_signed",       label: "Contract Signed",       color: "bg-violet-100 text-violet-700", borderColor: "border-l-violet-400"  },
  { value: "scheduled",             label: "Scheduled",             color: "bg-cyan-100 text-cyan-700",     borderColor: "border-l-cyan-400"    },
  { value: "ready_to_invoice",      label: "Ready to Invoice",      color: "bg-orange-100 text-orange-700", borderColor: "border-l-orange-400"  },
  { value: "invoiced",              label: "Invoiced",              color: "bg-lime-100 text-lime-700",     borderColor: "border-l-lime-400"    },
  { value: "after_sales_due",       label: "After-sales Due",       color: "bg-pink-100 text-pink-700",     borderColor: "border-l-pink-400"    },
  { value: "complete",              label: "Complete",              color: "bg-green-100 text-green-700",   borderColor: "border-l-green-400"   },
] as const;
export type WorkflowStatusValue = typeof WORKFLOW_STATUSES[number]["value"];

export const acceptedWorkflows = pgTable("accepted_workflows", {
  id:                          varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId:                     varchar("quote_id").notNull(),
  quoteNumber:                 text("quote_number"),
  companyName:                 text("company_name").notNull(),
  contactPerson:               text("contact_person"),
  serviceType:                 text("service_type"),
  quoteAmount:                 text("quote_amount"),
  monthlyRecurring:            text("monthly_recurring"),
  installationCost:            text("installation_cost"),
  frequency:                   text("frequency"),
  address:                     text("address"),
  specialInstructions:         text("special_instructions"),
  salesRepId:                  varchar("sales_rep_id"),
  afterHoursRequired:          text("after_hours_required"),
  existingCompetitorContract:  text("existing_competitor_contract"),
  competitorName:              text("competitor_name"),
  cancellationNoticeRequired:  text("cancellation_notice_required"),
  noticePeriod:                text("notice_period"),
  departmentId:                varchar("department_id"),
  legalEntityId:               varchar("legal_entity_id"),
  legalEntityName:             text("legal_entity_name"),
  // ── Client Registration ──────────────────────────────────────────────────
  regFormSent:                 boolean("reg_form_sent").notNull().default(false),
  regFormSentAt:               timestamp("reg_form_sent_at"),
  regFormReceived:             boolean("reg_form_received").notNull().default(false),
  regFormReceivedAt:           timestamp("reg_form_received_at"),
  vatNumber:                   text("vat_number"),
  companyRegNumber:            text("company_reg_number"),
  accountsContact:             text("accounts_contact"),
  accountsEmail:               text("accounts_email"),
  paymentTerms:                text("payment_terms"),
  regComplete:                 boolean("reg_complete").notNull().default(false),
  // ── Service Contract ─────────────────────────────────────────────────────
  contractDrafted:             boolean("contract_drafted").notNull().default(false),
  contractSent:                boolean("contract_sent").notNull().default(false),
  contractSentAt:              timestamp("contract_sent_at"),
  contractSigned:              boolean("contract_signed").notNull().default(false),
  contractSignedAt:            timestamp("contract_signed_at"),
  linkedContractId:            varchar("linked_contract_id"),
  // ── Service Handover & Scheduling ───────────────────────────────────────
  handoverSent:                boolean("handover_sent").notNull().default(false),
  serviceScheduled:            boolean("service_scheduled").notNull().default(false),
  scheduledDate:               text("scheduled_date"),
  linkedJobId:                 varchar("linked_job_id"),
  // ── Invoice ──────────────────────────────────────────────────────────────
  readyToInvoice:              boolean("ready_to_invoice").notNull().default(false),
  readyToInvoiceAt:            timestamp("ready_to_invoice_at"),
  linkedInvoiceId:             varchar("linked_invoice_id"),
  invoiceStatus:               text("invoice_status"),
  // ── After-sales Follow-up ────────────────────────────────────────────────
  afterSalesFollowupDate:      text("after_sales_followup_date"),
  afterSalesAssignedTo:        varchar("after_sales_assigned_to"),
  afterSalesNotes:             text("after_sales_notes"),
  afterSalesComplete:          boolean("after_sales_complete").notNull().default(false),
  // ── Overall ──────────────────────────────────────────────────────────────
  workflowStatus:              text("workflow_status").notNull().default("pending_registration"),
  notes:                       text("notes"),
  createdAt:                   timestamp("created_at").notNull().default(sql`now()`),
  updatedAt:                   timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertAcceptedWorkflowSchema = createInsertSchema(acceptedWorkflows).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAcceptedWorkflow = z.infer<typeof insertAcceptedWorkflowSchema>;
export type AcceptedWorkflow = typeof acceptedWorkflows.$inferSelect;

// ─── EQUIPMENT CHECKLISTS ────────────────────────────────────────────────────

export const equipmentChecklists = pgTable("equipment_checklists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  checklistType: text("checklist_type").notNull().default("daily"),
  date: text("date").notNull(),
  teamId: varchar("team_id"),
  teamName: text("team_name"),
  vehicleId: varchar("vehicle_id"),
  vehicleRegistration: text("vehicle_registration"),
  technicianId: varchar("technician_id").notNull(),
  technicianName: text("technician_name").notNull(),
  status: text("status").notNull().default("pending"),
  submittedAt: timestamp("submitted_at"),
  notes: text("notes"),
  jobId: varchar("job_id"),
  serviceTypes: text("service_types").array(),
  hasCriticalMissing: boolean("has_critical_missing").notNull().default(false),
  supervisorOverride: boolean("supervisor_override").notNull().default(false),
  supervisorName: text("supervisor_name"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const equipmentChecklistItems = pgTable("equipment_checklist_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  checklistId: varchar("checklist_id").notNull(),
  itemName: text("item_name").notNull(),
  category: text("category").notNull(),
  isCritical: boolean("is_critical").notNull().default(false),
  present: text("present").notNull().default("yes"),
  condition: text("condition").notNull().default("good"),
  quantityTaken: integer("quantity_taken"),
  notes: text("notes"),
  photoUrl: text("photo_url"),
  serviceType: text("service_type"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export type EquipmentChecklist = typeof equipmentChecklists.$inferSelect;
export type EquipmentChecklistItem = typeof equipmentChecklistItems.$inferSelect;

// ── Field Diaries ──────────────────────────────────────────────────────────────
export const fieldDiaries = pgTable("field_diaries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  diaryNumber: text("diary_number").notNull(),
  jobId: varchar("job_id"),
  jobNumber: text("job_number"),
  clientId: varchar("client_id"),
  clientName: text("client_name"),
  workerId: varchar("worker_id"),
  workerName: text("worker_name"),
  departmentId: varchar("department_id"),
  serviceDate: text("service_date"),
  arrivalTime: text("arrival_time"),
  departureTime: text("departure_time"),
  workCompleted: text("work_completed"),
  productsUsed: text("products_used"),
  notes: text("notes"),
  customerName: text("customer_name"),
  customerSignature: text("customer_signature"),
  technicianSignature: text("technician_signature"),
  status: text("status").notNull().default("submitted"),
  submittedAt: timestamp("submitted_at"),
  invoiceId: varchar("invoice_id"),
  invoiceNumber: text("invoice_number"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});
export const insertFieldDiarySchema = createInsertSchema(fieldDiaries).omit({ id: true, createdAt: true });
export type InsertFieldDiary = z.infer<typeof insertFieldDiarySchema>;
export type FieldDiary = typeof fieldDiaries.$inferSelect;

// ── Company Settings (singleton row id="singleton") ───────────────────────────
export const companySettings = pgTable("company_settings", {
  id: varchar("id").primaryKey(),
  companyName: text("company_name"),
  tradingName: text("trading_name"),
  vatNumber: text("vat_number"),
  registrationNumber: text("registration_number"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  city: text("city"),
  postalCode: text("postal_code"),
  bankName: text("bank_name"),
  bankAccount: text("bank_account"),
  bankBranch: text("bank_branch"),
  bankReference: text("bank_reference"),
  defaultVatRate: text("default_vat_rate"),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});
export type CompanySettings = typeof companySettings.$inferSelect;

// ═══════════════════════════════════════════════════════════════════════════
// STOCK MANAGEMENT SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

// ── Stock Locations ──────────────────────────────────────────────────────────
// WHERE stock physically lives: warehouse, vehicles, technicians, teams
export const stockLocations = pgTable("stock_locations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  locationType: text("location_type").notNull(), // Warehouse, Vehicle, Technician, Team, Supplier, Client Site, Adjustment
  assignedTechnicianId: varchar("assigned_technician_id"),
  assignedTechnicianName: text("assigned_technician_name"),
  assignedTeamId: varchar("assigned_team_id"),
  assignedTeamName: text("assigned_team_name"),
  vehicleRegistration: text("vehicle_registration"),
  activeStatus: boolean("active_status").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});
export const insertStockLocationSchema = createInsertSchema(stockLocations).omit({ id: true, createdAt: true });
export type InsertStockLocation = z.infer<typeof insertStockLocationSchema>;
export type StockLocation = typeof stockLocations.$inferSelect;

// ── Stock Balances ────────────────────────────────────────────────────────────
// Quantity of each stock item at each location
export const stockBalances = pgTable("stock_balances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stockItemId: varchar("stock_item_id").notNull(), // references inventory_items.id
  locationId: varchar("location_id").notNull(),    // references stock_locations.id
  quantityOnHand: decimal("quantity_on_hand", { precision: 10, scale: 2 }).notNull().default("0"),
  quantityAllocated: decimal("quantity_allocated", { precision: 10, scale: 2 }).notNull().default("0"),
  quantityAvailable: decimal("quantity_available", { precision: 10, scale: 2 }).notNull().default("0"),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});
export const insertStockBalanceSchema = createInsertSchema(stockBalances).omit({ id: true, updatedAt: true });
export type InsertStockBalance = z.infer<typeof insertStockBalanceSchema>;
export type StockBalance = typeof stockBalances.$inferSelect;

// ── Stock Movements ───────────────────────────────────────────────────────────
// Full audit trail of every stock movement
export const stockMovements = pgTable("stock_movements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stockItemId: varchar("stock_item_id").notNull(),
  stockItemName: text("stock_item_name").notNull(),
  movementType: text("movement_type").notNull(),
  // Received from Supplier | Issued to Technician | Issued to Vehicle | Used on Job |
  // Returned to Store | Transferred Between Locations | Adjustment |
  // Damaged / Lost | Stock Check Correction
  fromLocationId: varchar("from_location_id"),
  fromLocationName: text("from_location_name"),
  toLocationId: varchar("to_location_id"),
  toLocationName: text("to_location_name"),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  unitOfMeasure: text("unit_of_measure"),
  jobId: varchar("job_id"),
  jobNumber: text("job_number"),
  clientId: varchar("client_id"),
  clientName: text("client_name"),
  contractId: varchar("contract_id"),
  technicianId: varchar("technician_id"),
  technicianName: text("technician_name"),
  purchaseOrderId: varchar("purchase_order_id"),
  pickingListId: varchar("picking_list_id"),
  notes: text("notes"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});
export const insertStockMovementSchema = createInsertSchema(stockMovements).omit({ id: true, createdAt: true });
export type InsertStockMovement = z.infer<typeof insertStockMovementSchema>;
export type StockMovement = typeof stockMovements.$inferSelect;

// ── Picking Lists ─────────────────────────────────────────────────────────────
// Prepare stock before a job dispatch
export const pickingLists = pgTable("picking_lists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pickingListNumber: text("picking_list_number"),
  jobId: varchar("job_id"),
  contractId: varchar("contract_id"),
  clientId: varchar("client_id"),
  clientName: text("client_name"),
  assignedTechnicianId: varchar("assigned_technician_id"),
  assignedTechnicianName: text("assigned_technician_name"),
  assignedTeamId: varchar("assigned_team_id"),
  assignedTeamName: text("assigned_team_name"),
  status: text("status").notNull().default("Draft"),
  // Draft | Ready to Pick | Picked | Issued | Cancelled
  requiredDate: timestamp("required_date"),
  notes: text("notes"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});
export const insertPickingListSchema = createInsertSchema(pickingLists).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPickingList = z.infer<typeof insertPickingListSchema>;
export type PickingList = typeof pickingLists.$inferSelect;

export const pickingListItems = pgTable("picking_list_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pickingListId: varchar("picking_list_id").notNull(),
  stockItemId: varchar("stock_item_id").notNull(),
  itemName: text("item_name").notNull(),
  unitOfMeasure: text("unit_of_measure"),
  quantityRequired: decimal("quantity_required", { precision: 10, scale: 2 }).notNull(),
  quantityPicked: decimal("quantity_picked", { precision: 10, scale: 2 }).notNull().default("0"),
  fromLocationId: varchar("from_location_id"),
  fromLocationName: text("from_location_name"),
  toLocationId: varchar("to_location_id"),
  toLocationName: text("to_location_name"),
  notes: text("notes"),
});
export const insertPickingListItemSchema = createInsertSchema(pickingListItems).omit({ id: true });
export type InsertPickingListItem = z.infer<typeof insertPickingListItemSchema>;
export type PickingListItem = typeof pickingListItems.$inferSelect;

// ── Stock Checks ──────────────────────────────────────────────────────────────
// Periodic physical stock counts
export const stockChecks = pgTable("stock_checks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  checkNumber: text("check_number"),
  locationId: varchar("location_id").notNull(),
  locationName: text("location_name"),
  checkedBy: text("checked_by").notNull(),
  checkDate: timestamp("check_date").notNull().default(sql`now()`),
  status: text("status").notNull().default("In Progress"),
  // In Progress | Pending Approval | Approved | Cancelled
  notes: text("notes"),
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});
export const insertStockCheckSchema = createInsertSchema(stockChecks).omit({ id: true, createdAt: true });
export type InsertStockCheck = z.infer<typeof insertStockCheckSchema>;
export type StockCheck = typeof stockChecks.$inferSelect;

export const stockCheckItems = pgTable("stock_check_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stockCheckId: varchar("stock_check_id").notNull(),
  stockItemId: varchar("stock_item_id").notNull(),
  itemName: text("item_name").notNull(),
  unitOfMeasure: text("unit_of_measure"),
  expectedQuantity: decimal("expected_quantity", { precision: 10, scale: 2 }).notNull().default("0"),
  countedQuantity: decimal("counted_quantity", { precision: 10, scale: 2 }),
  variance: decimal("variance", { precision: 10, scale: 2 }),
  notes: text("notes"),
});
export const insertStockCheckItemSchema = createInsertSchema(stockCheckItems).omit({ id: true });
export type InsertStockCheckItem = z.infer<typeof insertStockCheckItemSchema>;
export type StockCheckItem = typeof stockCheckItems.$inferSelect;

// ── Unified Contracts ─────────────────────────────────────────────────────────
// Single contract table replacing separate service/rental split
export const unifiedContracts = pgTable("unified_contracts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Client
  clientId: varchar("client_id").notNull(),
  contactPerson: text("contact_person"),
  contactPhone: text("contact_phone"),
  contactEmail: text("contact_email"),
  address: text("address"),
  googleMapsLink: text("google_maps_link"),
  // Contract details
  contractNumber: text("contract_number"),
  department: text("department").notNull(),       // Pest Control | Hygiene | Washroom | Sanitary Bins | Dustmats | Deep Cleaning | Other
  contractStartDate: text("contract_start_date"), // YYYY-MM-DD
  contractEndDate: text("contract_end_date"),     // YYYY-MM-DD
  lastPriceIncreaseDate: text("last_price_increase_date"),
  nextIncreaseDate: text("next_increase_date"),
  increasePercentage: text("increase_percentage"),
  activeStatus: boolean("active_status").notNull().default(true),
  specialInstructions: text("special_instructions"),
  internalNotes: text("internal_notes"),
  // Scheduling
  frequency: text("frequency"),                   // Daily | Weekly | Monthly | etc.
  weekOfMonth: integer("week_of_month"),           // 1-4, 5=Last
  dayOfWeek: text("day_of_week"),
  secondDayOfWeek: text("second_day_of_week"),
  startTime: text("start_time"),                  // HH:MM
  secondStartTime: text("second_start_time"),
  estimatedDuration: integer("estimated_duration"), // minutes
  fixedTime: boolean("fixed_time").default(false),
  routeSequence: integer("route_sequence"),
  assignedTeamId: varchar("assigned_team_id"),
  assignedTeamName: text("assigned_team_name"),
  assignedTechnicianId: varchar("assigned_technician_id"),
  assignedTechnicianName: text("assigned_technician_name"),
  confirmWithClientBeforeService: boolean("confirm_with_client_before_service").default(false),
  // Pricing / invoicing
  invoiceRule: text("invoice_rule"),
  mustBeInvoiced: boolean("must_be_invoiced").default(true),
  financeNotes: text("finance_notes"),
  // Notes
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});
export const insertUnifiedContractSchema = createInsertSchema(unifiedContracts).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertUnifiedContract = z.infer<typeof insertUnifiedContractSchema>;
export type UnifiedContract = typeof unifiedContracts.$inferSelect;

// ── Contract Line Items ───────────────────────────────────────────────────────
export const contractLineItems = pgTable("contract_line_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").notNull(),
  clientId: varchar("client_id").notNull(),
  stockItemId: varchar("stock_item_id"), // optional, references inventory_items.id
  lineType: text("line_type").notNull().default("Service"), // Inventory Item | Service | Refill / Consumable | Rental Equipment | Other
  itemServiceName: text("item_service_name").notNull(),
  serviceCategory: text("service_category"),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }),
  standardSellingPrice: decimal("standard_selling_price", { precision: 10, scale: 2 }),
  discountPercentage: decimal("discount_percentage", { precision: 5, scale: 2 }).default("0"),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }),
  finalUnitPrice: decimal("final_unit_price", { precision: 10, scale: 2 }),
  manualPriceOverride: boolean("manual_price_override").default(false),
  refillRule: text("refill_rule").default("Not Applicable"),
  // ── Consumable arrangement (all departments) ──────────────────────────────
  consumableArrangement: text("consumable_arrangement").default("Not Applicable"),
  consumableIncludedInPrice: boolean("consumable_included_in_price").default(false),
  consumableBillableSeparately: boolean("consumable_billable_separately").default(false),
  clientSuppliesOwnConsumables: boolean("client_supplies_own_consumables").default(false),
  consumableStockItemId: varchar("consumable_stock_item_id"),
  consumableItemName: text("consumable_item_name"),
  separateConsumablePrice: decimal("separate_consumable_price", { precision: 10, scale: 2 }),
  // ─────────────────────────────────────────────────────────────────────────
  stockTrackingRequired: boolean("stock_tracking_required").default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});
export const insertContractLineItemSchema = createInsertSchema(contractLineItems).omit({
  id: true, createdAt: true,
});
export type InsertContractLineItem = z.infer<typeof insertContractLineItemSchema>;
export type ContractLineItem = typeof contractLineItems.$inferSelect;

// ── Department Defaults ───────────────────────────────────────────────────────
// Admin-configurable defaults for team/technician per department
export const departmentDefaults = pgTable("department_defaults", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  department: text("department").notNull().unique(), // Pest Control | Hygiene | Washroom | etc.
  defaultTeamId: varchar("default_team_id"),
  defaultTeamName: text("default_team_name"),
  defaultTechnicianId: varchar("default_technician_id"),
  defaultTechnicianName: text("default_technician_name"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});
export const insertDepartmentDefaultSchema = createInsertSchema(departmentDefaults).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertDepartmentDefault = z.infer<typeof insertDepartmentDefaultSchema>;
export type DepartmentDefault = typeof departmentDefaults.$inferSelect;

// ── Legal Entities ────────────────────────────────────────────────────────────
export const legalEntities = pgTable("legal_entities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  tradingName: text("trading_name"),
  registrationNumber: text("registration_number"),
  vatNumber: text("vat_number"),
  physicalAddress: text("physical_address"),
  postalAddress: text("postal_address"),
  phone: text("phone"),
  email: text("email"),
  bankName: text("bank_name"),
  bankAccount: text("bank_account"),
  bankBranch: text("bank_branch"),
  bankAccountType: text("bank_account_type"),
  defaultPaymentTerms: text("default_payment_terms"),
  invoiceFooter: text("invoice_footer"),
  quoteFooter: text("quote_footer"),
  isActive: boolean("is_active").notNull().default(true),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});
export const insertLegalEntitySchema = createInsertSchema(legalEntities).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertLegalEntity = z.infer<typeof insertLegalEntitySchema>;
export type LegalEntity = typeof legalEntities.$inferSelect;

// ── Client Contacts ───────────────────────────────────────────────────────────
// Multiple contacts per client (key people at the account)
export const clientContacts = pgTable("client_contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name"),
  jobTitle: text("job_title"),
  email: text("email"),
  phone: text("phone"),
  mobile: text("mobile"),
  preferredContact: text("preferred_contact").default("Email"), // Email | Phone | Mobile | WhatsApp
  isPrimary: boolean("is_primary").notNull().default(false),
  isBilling: boolean("is_billing").notNull().default(false),
  isSite: boolean("is_site").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});
export const insertClientContactSchema = createInsertSchema(clientContacts).omit({
  id: true, createdAt: true,
});
export type InsertClientContact = z.infer<typeof insertClientContactSchema>;
export type ClientContact = typeof clientContacts.$inferSelect;

// ── Client Sites ──────────────────────────────────────────────────────────────
// Multiple service sites / locations per client
export const clientSites = pgTable("client_sites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull(),
  siteName: text("site_name").notNull(),
  streetNumber: text("street_number"),
  streetName: text("street_name"),
  suburb: text("suburb"),
  city: text("city"),
  province: text("province"),
  postalCode: text("postal_code"),
  gpsLink: text("gps_link"),          // renamed from googleMapsLink; same concept
  googleMapsLink: text("google_maps_link"), // kept for backward compat
  isPrimary: boolean("is_primary").notNull().default(false),
  contactName: text("contact_name"),
  contactPhone: text("contact_phone"),
  contactEmail: text("contact_email"),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});
export const insertClientSiteSchema = createInsertSchema(clientSites).omit({
  id: true, createdAt: true,
});
export type InsertClientSite = z.infer<typeof insertClientSiteSchema>;
export type ClientSite = typeof clientSites.$inferSelect;

// ── Document Number Sequences (atomic, year-scoped) ─────────────────────────
// Each row tracks the last-used sequence number for one document type per year.
// Use an UPSERT+increment to get the next value — safe under concurrent inserts.
export const sequences = pgTable("sequences", {
  type: text("type").notNull(),     // JOB | INV | QT | RC | CON | FD | PAY
  year: integer("year").notNull(),
  lastSeq: integer("last_seq").notNull().default(0),
}, (t) => ({
  pk: primaryKey({ columns: [t.type, t.year] }),
}));

// ── Client Payments ───────────────────────────────────────────────────────────
// Payment records (can link to an invoice, or be a standalone receipt)
export const clientPayments = pgTable("client_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull(),
  invoiceId: varchar("invoice_id"),
  paymentNumber: text("payment_number"), // PAY-YYYY-NNNN — auto-generated
  paymentDate: text("payment_date").notNull(), // YYYY-MM-DD
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  method: text("method").notNull().default("Bank Transfer"), // Bank Transfer | Cash | EFT | Cheque | Card | Other
  reference: text("reference"),
  notes: text("notes"),
  allocatedBy: text("allocated_by"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});
export const insertClientPaymentSchema = createInsertSchema(clientPayments).omit({
  id: true, createdAt: true, paymentNumber: true,
});
export type InsertClientPayment = z.infer<typeof insertClientPaymentSchema>;
export type ClientPayment = typeof clientPayments.$inferSelect;
