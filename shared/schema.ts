import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, decimal, integer, boolean, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const departments = pgTable("departments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  colorCode: text("color_code").notNull(),
  description: text("description"),
});

export const workers = pgTable("workers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull(),
  departmentId: varchar("department_id").notNull(),
  role: text("role"),
  userType: text("user_type").notNull().default("Staff"),
  mobileAccessEnabled: boolean("mobile_access_enabled").notNull().default(false),
  employeeId: text("employee_id").unique(), // For mobile login
  pin: text("pin"), // 4-digit PIN for mobile login (hashed)
  isActive: boolean("is_active").notNull().default(true),
  // HR Profile fields
  idNumber: text("id_number"),
  startDate: text("start_date"), // YYYY-MM-DD
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  leaveBalance: integer("leave_balance").default(15), // remaining annual leave days
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  tradingName: text("trading_name"),
  email: text("email"),
  alternateEmailAddress: text("alternate_email_address"),
  phone: text("phone"),
  alternatePhoneNumber: text("alternate_phone_number"),
  // Legacy single-line address — kept for backwards compatibility.
  // New structured address fields below should be used going forward.
  address: text("address"),
  streetNumber: text("street_number"),
  streetName: text("street_name"),
  suburb: text("suburb"),
  city: text("city"),
  province: text("province"),
  postalCode: text("postal_code"),
  googleMapsLink: text("google_maps_link"),
  contactPerson: text("contact_person"),
  businessType: text("business_type"),
  status: text("status").notNull().default('active'), // active, inactive, suspended
  departmentId: varchar("department_id"),
  taxNumber: text("tax_number"), // VAT Number
  companyRegistrationNumber: text("company_registration_number"),
  paymentTerms: text("payment_terms"),
  creditLimit: decimal("credit_limit", { precision: 10, scale: 2 }),
  // Billing contact (may differ from main contact)
  billingName: text("billing_name"),
  billingEmail: text("billing_email"),
  billingPhone: text("billing_phone"),
  notes: text("notes"),
  sageCustomerCode: text("sage_customer_code"),
  // ── Rental Contract flags (separate from service contracts) ──
  hasRentalContract: boolean("has_rental_contract").notNull().default(false),
  rentalContractStatus: text("rental_contract_status").notNull().default("None"), // Active | Inactive | None
  rentalContractType: text("rental_contract_type"),
  rentalNotes: text("rental_notes"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const inventoryItems = pgTable("inventory_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull().default("Consumable"),
  sku: text("sku").unique(), // optional — auto-generated if not supplied
  quantity: integer("quantity").notNull().default(0),
  minStockLevel: integer("min_stock_level").notNull().default(10),
  maxStockLevel: integer("max_stock_level").notNull().default(100),
  reorderPoint: integer("reorder_point").notNull().default(20),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }),
  description: text("description"),
  departmentId: varchar("department_id"),
  location: text("location"),
  supplier: text("supplier"),
  lastRestocked: timestamp("last_restocked"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at"),
  // Enhanced stock management fields
  itemCode: text("item_code"),
  category: text("category"),
  unitOfMeasure: text("unit_of_measure").default("units"),
  costPrice: decimal("cost_price", { precision: 10, scale: 2 }),
  sellingPrice: decimal("selling_price", { precision: 10, scale: 2 }),
  preferredSupplierId: varchar("preferred_supplier_id"),
  activeStatus: boolean("active_status").default(true),
});

export const rentalContracts = pgTable("rental_contracts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull(),
  customerName: text("customer_name"),
  departmentId: varchar("department_id"),
  // Legacy single-item field — kept for backward compatibility; new contracts use rentalContractItems
  inventoryItemId: varchar("inventory_item_id"),
  // Legacy field — kept for backward compatibility
  monthlyPrice: decimal("monthly_price", { precision: 10, scale: 2 }),
  // Structured pricing fields
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }),
  quantity: integer("quantity").default(1),
  billingFrequency: text("billing_frequency").default("monthly"),
  calculatedTotal: decimal("calculated_total", { precision: 10, scale: 2 }),
  // Contract dates
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  lastPriceIncreaseDate: timestamp("last_price_increase_date"),
  nextIncreaseDate: timestamp("next_increase_date"),
  increasePercentage: text("increase_percentage"),
  // Legacy column alias
  lastPriceIncrease: timestamp("last_price_increase"),
  isActive: boolean("is_active").notNull().default(true),
  activeStatus: boolean("active_status").notNull().default(true),
  notes: text("notes"),
  contractNumber: text("contract_number"),
  // Scheduling
  frequency: text("frequency"),
  weekOfMonth: integer("week_of_month"),
  dayOfWeek: text("day_of_week"),
  startTime: text("start_time"),
  estimatedDuration: integer("estimated_duration"),
  assignedTeamId: varchar("assigned_team_id"),
  assignedTeamName: text("assigned_team_name"),
  assignedTechnicianId: varchar("assigned_technician_id"),
  assignedTechnicianName: text("assigned_technician_name"),
  routeSequence: integer("route_sequence"),
  fixedTime: boolean("fixed_time").default(false),
  invoiceRule: text("invoice_rule"),
  address: text("address"),
  googleMapsLink: text("google_maps_link"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const rentalContractItems = pgTable("rental_contract_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  rentalContractId: varchar("rental_contract_id").notNull(),
  clientId: varchar("client_id").notNull(),
  itemName: text("item_name").notNull(),
  refillRule: text("refill_rule").default("Not Applicable"),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const jobs = pgTable("jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  clientId: varchar("client_id").notNull(),
  workerId: varchar("worker_id"),
  departmentId: varchar("department_id").notNull(),
  serviceType: text("service_type").notNull(),
  status: text("status").notNull().default('scheduled'),
  scheduledDate: timestamp("scheduled_date").notNull(),
  scheduledTime: text("scheduled_time"),
  startTime: timestamp("start_time"),
  endTime: timestamp("end_time"),
  priority: text("priority").notNull().default('medium'),
  estimatedDuration: integer("estimated_duration"),
  actualDuration: integer("actual_duration"),
  location: text("location"),
  notes: text("notes"),
  completionNotes: text("completion_notes"),
  isRecurring: boolean("is_recurring").notNull().default(false),
  recurringPattern: text("recurring_pattern"),
  parentJobId: varchar("parent_job_id"),
  diary: text("diary"),
  howInvoiced: text("how_invoiced"),
  email: text("email"),
  areaCode: text("area_code"),
  salesperson: text("salesperson"),
  contractNo: text("contract_no"),
  isContract: boolean("is_contract").notNull().default(false),
  service: text("service"),
  insects: text("insects"),
  price: decimal("price", { precision: 10, scale: 2 }),
  pricePerUnit: decimal("price_per_unit", { precision: 10, scale: 2 }),
  increaseDate: text("increase_date"),
  specialInstructions: text("special_instructions"),
  internalInstructions: text("internal_instructions"),
  isFixed: boolean("is_fixed").notNull().default(false),
  orderNo: text("order_no"),
  recurrenceInterval: integer("recurrence_interval"),
  recurrencePeriod: text("recurrence_period"),
  recurrenceDay: text("recurrence_day"),
  recurrenceCount: integer("recurrence_count"),
  recurrenceYears: integer("recurrence_years"),
  completedDate: timestamp("completed_date"),
  jobNumber: text("job_number"),
  linkedQuoteId: varchar("linked_quote_id"),
  invoiceStatus: text("invoice_status").default('not_invoiced'), // not_invoiced | ready_to_invoice | exported | invoiced | do_not_invoice
  mustBeInvoiced: boolean("must_be_invoiced").default(true),
  invoiceRef: text("invoice_ref"),
  financeNotes: text("finance_notes"),
  quantity: decimal("quantity", { precision: 10, scale: 2 }),
  vatIncluded: boolean("vat_included").default(false),
  linkedContractId: varchar("linked_contract_id"),
  siteId: varchar("site_id"),          // optional link to client_sites
  treatmentType: text("treatment_type"),
  otherPestType: text("other_pest_type"),
  serviceCategory: text("service_category"),
  completionAllUnitsChecked: text("completion_all_units_checked"), // yes | no | na
  completionExtraFaultFound: boolean("completion_extra_fault_found").default(false),
  completionCustomerSignature: text("completion_customer_signature"),
  googleMapsLink: text("google_maps_link"),
  legalEntityId: varchar("legal_entity_id"),
  legalEntityName: text("legal_entity_name"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const overtimeEntries = pgTable("overtime_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull(),
  workDate: text("work_date").notNull(), // YYYY-MM-DD
  clientId: varchar("client_id").notNull(),
  jobId: varchar("job_id"),
  startTime: text("start_time").notNull(), // HH:mm
  finishTime: text("finish_time").notNull(), // HH:mm
  notes: text("notes").notNull(),
  overtimeMinutes: integer("overtime_minutes").notNull(),
  status: text("status").notNull().default("pending"), // pending | approved | rejected
  approvedById: varchar("approved_by_id"),
  approvedByName: text("approved_by_name"),
  approvalTimestamp: timestamp("approval_timestamp"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const overtimeAuditEntries = pgTable("overtime_audit_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  overtimeEntryId: varchar("overtime_entry_id").notNull(),
  actorId: varchar("actor_id").notNull(),
  actorName: text("actor_name").notNull(),
  action: text("action").notNull(), // submitted | edited | approved | rejected | reopened
  details: text("details"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceNumber: text("invoice_number").notNull().unique(),
  clientId: varchar("client_id").notNull(),
  status: text("status").notNull().default('draft'), // draft, sent, paid, overdue, cancelled
  issueDate: timestamp("issue_date").notNull(),
  dueDate: timestamp("due_date").notNull(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).notNull().default('0'),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  paidAmount: decimal("paid_amount", { precision: 10, scale: 2 }).notNull().default('0'),
  paymentDate: timestamp("payment_date"),
  notes: text("notes"),
  terms: text("terms"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
  sageInvoiceId: varchar("sage_invoice_id"), // Store Sage invoice ID for integration
  sageStatus: varchar("sage_status"), // Store Sage invoice status
  linkedJobId: varchar("linked_job_id"),
  linkedQuoteId: varchar("linked_quote_id"),
  linkedContractId: varchar("linked_contract_id"), // link to service or rental contract
  legalEntityId: varchar("legal_entity_id"),
  legalEntityName: text("legal_entity_name"),
});

export const invoiceItems = pgTable("invoice_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").notNull(),
  description: text("description").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  jobId: varchar("job_id"), // link to job if invoice item is for a job
  contractId: varchar("contract_id"), // link to contract if invoice item is for rental
  inventoryItemId: varchar("inventory_item_id"), // link to inventory item
});

export const jobInventoryItems = pgTable("job_inventory_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull(),
  inventoryItemId: varchar("inventory_item_id").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }),
  notes: text("notes"),
  isRental: boolean("is_rental").notNull().default(false),
  rentalStartDate: timestamp("rental_start_date"),
  rentalEndDate: timestamp("rental_end_date"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  // Stock tracking fields
  clientId: varchar("client_id"),
  technicianId: varchar("technician_id"),
  technicianName: text("technician_name"),
  contractId: varchar("contract_id"),
  locationId: varchar("location_id"), // from which stock location was used
  itemName: text("item_name"), // denormalized for quick display
  unitOfMeasure: text("unit_of_measure"),
});

export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull(), // info, warning, error, success
  priority: text("priority").notNull().default('medium'), // low, medium, high, urgent
  isRead: boolean("is_read").notNull().default(false),
  userId: varchar("user_id"),
  relatedEntityType: text("related_entity_type"), // job, contract, worker, inventory, invoice
  relatedEntityId: varchar("related_entity_id"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const emailTemplates = pgTable("email_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  htmlContent: text("html_content").notNull(),
  textContent: text("text_content"),
  type: text("type").notNull(), // invoice, notification, reminder
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const emailLogs = pgTable("email_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  toEmail: text("to_email").notNull(),
  subject: text("subject").notNull(),
  status: text("status").notNull(), // sent, failed, pending
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at"),
  templateId: varchar("template_id"),
  relatedEntityId: varchar("related_entity_id"), // invoice id, job id, etc.
  relatedEntityType: text("related_entity_type"), // invoice, job, etc.
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const customReports = pgTable("custom_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  reportType: text("report_type").notNull(), // 'sales', 'expenses', 'financial', 'operational', 'custom'
  template: text("template"), // 'sales_summary', 'expense_breakdown', 'financial_overview', 'department_performance', 'custom'
  configuration: text("configuration").notNull(), // JSON string with report configuration
  filters: text("filters"), // JSON string with filter settings (departments, date ranges, etc.)
  createdBy: varchar("created_by").notNull(),
  isTemplate: boolean("is_template").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  lastRun: timestamp("last_run"),
  runCount: integer("run_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertDepartmentSchema = createInsertSchema(departments).omit({
  id: true,
});

export const insertWorkerSchema = createInsertSchema(workers).omit({
  id: true,
  createdAt: true,
});

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
});

export const insertInventoryItemSchema = createInsertSchema(inventoryItems).omit({
  id: true,
  createdAt: true,
});

export const insertRentalContractSchema = createInsertSchema(rentalContracts).omit({
  id: true,
  createdAt: true,
  contractNumber: true,
});

export const insertRentalContractItemSchema = createInsertSchema(rentalContractItems).omit({
  id: true,
  createdAt: true,
});

export type RentalContractItem = typeof rentalContractItems.$inferSelect;
export type InsertRentalContractItem = z.infer<typeof insertRentalContractItemSchema>;

export const contractDeletionHistory = pgTable("contract_deletion_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").notNull(),
  contractNumber: text("contract_number"),
  clientName: text("client_name").notNull(),
  itemName: text("item_name").notNull(),
  monthlyPrice: decimal("monthly_price", { precision: 10, scale: 2 }),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  reason: text("reason").notNull(),
  deletedBy: text("deleted_by"),
  deletedAt: timestamp("deleted_at").notNull().default(sql`now()`),
  notes: text("notes"),
});

export const insertJobSchema = createInsertSchema(jobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  jobNumber: true,
});

export const insertOvertimeEntrySchema = createInsertSchema(overtimeEntries).omit({
  id: true,
  overtimeMinutes: true,
  status: true,
  approvedById: true,
  approvedByName: true,
  approvalTimestamp: true,
  rejectionReason: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOvertimeAuditEntrySchema = createInsertSchema(overtimeAuditEntries).omit({
  id: true,
  createdAt: true,
});

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInvoiceItemSchema = createInsertSchema(invoiceItems).omit({
  id: true,
});

export const insertEmailTemplateSchema = createInsertSchema(emailTemplates).omit({
  id: true,
  createdAt: true,
});

export const insertEmailLogSchema = createInsertSchema(emailLogs).omit({
  id: true,
  createdAt: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export const insertJobInventoryItemSchema = createInsertSchema(jobInventoryItems).omit({
  id: true,
  createdAt: true,
});

export const insertCustomReportSchema = createInsertSchema(customReports).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastRun: true,
  runCount: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;
export type Department = typeof departments.$inferSelect;

export type InsertWorker = z.infer<typeof insertWorkerSchema>;
export type Worker = typeof workers.$inferSelect;

export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

/**
 * Render the structured address as a clean multi-line string.
 * Falls back to the legacy single-line `address` field when the new
 * structured fields are all blank.
 *
 * Format (blank lines are skipped):
 *   streetNumber streetName
 *   suburb
 *   city
 *   province
 *   postalCode
 */
export function formatClientAddress(
  client: Pick<Client, "streetNumber" | "streetName" | "suburb" | "city" | "province" | "postalCode" | "address">,
): string {
  const streetLine = [client.streetNumber, client.streetName].filter(Boolean).join(" ").trim();
  const lines = [
    streetLine,
    client.suburb ?? "",
    client.city ?? "",
    client.province ?? "",
    client.postalCode ?? "",
  ]
    .map((l) => (l ?? "").trim())
    .filter((l) => l.length > 0);

  if (lines.length > 0) return lines.join("\n");
  return (client.address ?? "").trim();
}

export function hasStructuredAddress(
  client: Pick<Client, "streetNumber" | "streetName" | "suburb" | "city" | "province" | "postalCode">,
): boolean {
  return Boolean(
    client.streetNumber || client.streetName || client.suburb ||
    client.city || client.province || client.postalCode,
  );
}

export type InsertInventoryItem = z.infer<typeof insertInventoryItemSchema>;
export type InventoryItem = typeof inventoryItems.$inferSelect;

export type InsertRentalContract = z.infer<typeof insertRentalContractSchema>;
export type RentalContract = typeof rentalContracts.$inferSelect;

export type InsertOvertimeEntry = z.infer<typeof insertOvertimeEntrySchema>;
export type OvertimeEntry = typeof overtimeEntries.$inferSelect;
export type InsertOvertimeAuditEntry = z.infer<typeof insertOvertimeAuditEntrySchema>;
export type OvertimeAuditEntry = typeof overtimeAuditEntries.$inferSelect;

export type ContractDeletionHistory = typeof contractDeletionHistory.$inferSelect;

export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobs.$inferSelect;

export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;

export type InsertInvoiceItem = z.infer<typeof insertInvoiceItemSchema>;
export type InvoiceItem = typeof invoiceItems.$inferSelect;

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;
export type EmailTemplate = typeof emailTemplates.$inferSelect;

export type InsertEmailLog = z.infer<typeof insertEmailLogSchema>;
export type EmailLog = typeof emailLogs.$inferSelect;

export type InsertJobInventoryItem = z.infer<typeof insertJobInventoryItemSchema>;
export type JobInventoryItem = typeof jobInventoryItems.$inferSelect;

export type InsertCustomReport = z.infer<typeof insertCustomReportSchema>;
export type CustomReport = typeof customReports.$inferSelect;

// Suppliers table
export const suppliers = pgTable("suppliers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  contactPerson: text("contact_person"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  website: text("website"),
  category: text("category").notNull(), // e.g., "hygiene", "pest_control", "equipment"
  departmentId: varchar("department_id"), // link to department for department-specific suppliers
  paymentTerms: text("payment_terms"), // e.g., "30 days", "Net 15"
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertSupplierSchema = createInsertSchema(suppliers).omit({
  id: true,
  createdAt: true,
});

export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type Supplier = typeof suppliers.$inferSelect;

// Purchase Orders table
export const purchaseOrders = pgTable("purchase_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  poNumber: text("po_number").notNull().unique(), // PO-2024-001, etc.
  supplierId: varchar("supplier_id").notNull(),
  requestedById: varchar("requested_by_id").notNull(), // User who created the PO
  approvedById: varchar("approved_by_id"), // User who approved the PO
  status: text("status").notNull().default("pending"), // pending, approved, rejected, sent, received, cancelled
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  requestDate: timestamp("request_date").notNull().default(sql`now()`),
  approvalDate: timestamp("approval_date"),
  sentDate: timestamp("sent_date"),
  expectedDeliveryDate: timestamp("expected_delivery_date"),
  actualDeliveryDate: timestamp("actual_delivery_date"),
  notes: text("notes"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// Purchase Order Items table
export const purchaseOrderItems = pgTable("purchase_order_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  purchaseOrderId: varchar("purchase_order_id").notNull(),
  inventoryItemId: varchar("inventory_item_id").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  quantityReceived: integer("quantity_received").default(0),
  itemName: text("item_name"), // denormalized
});

export const insertPurchaseOrderSchema = createInsertSchema(purchaseOrders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPurchaseOrderItemSchema = createInsertSchema(purchaseOrderItems).omit({
  id: true,
  createdAt: true,
});

export type InsertPurchaseOrder = z.infer<typeof insertPurchaseOrderSchema>;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type InsertPurchaseOrderItem = z.infer<typeof insertPurchaseOrderItemSchema>;
export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;

// Admin users for authentication and authorization
export const adminUsers = pgTable("admin_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: varchar("username").unique().notNull(),
  email: varchar("email").unique().notNull(),
  passwordHash: varchar("password_hash").notNull(),
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  role: varchar("role").notNull().default("admin"), // admin, superadmin
  isActive: boolean("is_active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Activity logs for tracking admin user actions
export const activityLogs = pgTable("activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // No FK reference: this app has two parallel user types (admin_users and
  // workers), and this column records the id of whichever one performed the
  // action, so it can't be constrained to a single table.
  userId: varchar("user_id").notNull(),
  clientId: varchar("client_id"),     // optional — allows filtering logs by client
  action: varchar("action").notNull(), // login, logout, create_invoice, update_client, etc.
  resource: varchar("resource"), // invoices, clients, workers, etc.
  resourceId: varchar("resource_id"), // specific record ID
  details: text("details"), // additional action details as JSON string
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  timestamp: timestamp("timestamp").defaultNow(),
});

// Sessions for managing user login state
export const userSessions = pgTable("user_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => adminUsers.id),
  sessionToken: varchar("session_token").unique().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas for new tables
export const insertAdminUserSchema = createInsertSchema(adminUsers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
});

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({
  id: true,
  timestamp: true,
});

export const insertUserSessionSchema = createInsertSchema(userSessions).omit({
  id: true,
  createdAt: true,
});

// Calendar events for appointment scheduling
export const calendarEvents = pgTable("calendar_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  description: text("description"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  type: varchar("type").notNull().default("appointment"), // job, appointment, meeting, reminder
  priority: varchar("priority").notNull().default("medium"), // low, medium, high
  clientId: varchar("client_id").references(() => clients.id),
  workerId: varchar("worker_id").references(() => workers.id),
  departmentId: varchar("department_id").references(() => departments.id),
  location: text("location"),
  status: varchar("status").notNull().default("scheduled"), // scheduled, in_progress, completed, cancelled
  color: varchar("color"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCalendarEventSchema = createInsertSchema(calendarEvents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types for new tables
export type InsertAdminUser = z.infer<typeof insertAdminUserSchema>;
export type AdminUser = typeof adminUsers.$inferSelect;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertUserSession = z.infer<typeof insertUserSessionSchema>;
export type UserSession = typeof userSessions.$inferSelect;
export type InsertCalendarEvent = z.infer<typeof insertCalendarEventSchema>;
export type CalendarEvent = typeof calendarEvents.$inferSelect;

// Quote submissions from public website
export const quoteSubmissions = pgTable("quote_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyName: text("company_name").notNull(),
  contactPerson: text("contact_person").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  serviceType: varchar("service_type").notNull(), // pest_control, sanitary_bins, washroom, deep_cleaning
  description: text("description").notNull(),
  address: text("address"),
  preferredContactMethod: varchar("preferred_contact_method").notNull().default("email"), // email, phone, either
  status: varchar("status").notNull().default("new"), // new, contacted, quoted, converted, declined
  assignedTo: varchar("assigned_to"), // Worker ID who handles this quote
  notes: text("notes"), // Internal notes about the quote
  quoteAmount: text("quote_amount"), // Quoted price sent to client
  lineItemsJson: text("line_items_json"), // JSON array of line items from the lead form
  quoteSentAt: timestamp("quote_sent_at"), // When the quote email was sent
  submittedAt: timestamp("submitted_at").notNull().default(sql`now()`),
  followUpDate: timestamp("follow_up_date"),
  quoteNumber: text("quote_number"),
  frequency: text("frequency"), // e.g. "monthly", "weekly", "once_off"
  specialInstructions: text("special_instructions"),
  origination: text("origination").notNull().default("other"), // marketing channel — see ORIGINATION_OPTIONS
  originationOther: text("origination_other"), // free text when origination === "other"
  // Extended lead/sales pipeline fields
  tradingName: text("trading_name"),
  leadType: text("lead_type"),               // Once-off, Contract, Rental, Outright Purchase, Unknown
  priority: text("priority").default("medium"), // low, medium, high
  stage: text("stage"),                      // full 16-stage pipeline value
  quoteType: text("quote_type"),             // Once-off, Contract, Rental, Outright Purchase
  lostReason: text("lost_reason"),
  lostReasonOther: text("lost_reason_other"),
  validUntil: text("valid_until"),           // YYYY-MM-DD
  monthlyRecurring: text("monthly_recurring"),
  installationCost: text("installation_cost"),
  internalNotes: text("internal_notes"),
  clientId: varchar("client_id").references(() => clients.id),
  // Site & service detail fields
  afterHoursRequired: text("after_hours_required"),           // yes / no / unknown
  existingCompetitorContract: text("existing_competitor_contract"), // yes / no / unknown
  competitorName: text("competitor_name"),
  cancellationNoticeRequired: text("cancellation_notice_required"), // yes / no / unknown
  noticePeriod: text("notice_period"),
  earliestStartDate: text("earliest_start_date"),             // YYYY-MM-DD
  clientFlags: text("client_flags"),                          // JSON array: ["bad_payer","high_profile",...]
  expectedServiceTime: text("expected_service_time"),         // e.g. "Monthly", "Bi-weekly"
  departmentId: varchar("department_id"),
  legalEntityId: varchar("legal_entity_id"),
  legalEntityName: text("legal_entity_name"),
  siteVisitDone: boolean("site_visit_done").notNull().default(false),
});

// Marketing channel options for the Origination field on every lead
export const ORIGINATION_OPTIONS = [
  { value: "facebook",        label: "Facebook" },
  { value: "google",          label: "Google" },
  { value: "vehicles",        label: "Vehicles" },
  { value: "phone",           label: "Phone / Incoming Call" },
  { value: "cold_call",       label: "Cold Call" },
  { value: "referral",        label: "Word of Mouth / Referral" },
  { value: "website",         label: "Website" },
  { value: "existing_client", label: "Existing Client" },
  { value: "walk_in",         label: "Walk-in" },
  { value: "email",           label: "Email" },
  { value: "other",           label: "Other" },
] as const;

export type OriginationValue = typeof ORIGINATION_OPTIONS[number]["value"];

export const ORIGINATION_LABELS: Record<string, string> =
  Object.fromEntries(ORIGINATION_OPTIONS.map(o => [o.value, o.label]));

// ── Lead pipeline stages ────────────────────────────────────────────────────

export const LEAD_STAGES = [
  { value: "new",                    label: "New Lead",                          color: "bg-blue-100 text-blue-700" },
  { value: "contacted",              label: "Contacted",                         color: "bg-indigo-100 text-indigo-700" },
  { value: "appointment_scheduled",  label: "Appointment Scheduled",             color: "bg-purple-100 text-purple-700" },
  { value: "site_assessment_done",   label: "Site Assessment Done",              color: "bg-violet-100 text-violet-700" },
  { value: "quote_needed",           label: "Quote Needed",                      color: "bg-amber-100 text-amber-700" },
  { value: "quote_sent",             label: "Quote Sent",                        color: "bg-yellow-100 text-yellow-700" },
  { value: "follow_up_due",          label: "Follow-up Due",                     color: "bg-orange-100 text-orange-700" },
  { value: "accepted",               label: "Accepted",                          color: "bg-green-100 text-green-700" },
  { value: "declined",               label: "Declined / Lost",                   color: "bg-red-100 text-red-700" },
  { value: "contract_pending",       label: "Contract Pending",                  color: "bg-teal-100 text-teal-700" },
  { value: "converted_contract",     label: "Converted to Contract",             color: "bg-emerald-100 text-emerald-700" },
  { value: "converted_job",          label: "Converted to Once-off Job",         color: "bg-cyan-100 text-cyan-700" },
  { value: "installation_scheduled", label: "Installation / Service Scheduled",  color: "bg-sky-100 text-sky-700" },
  { value: "invoiced",               label: "Invoiced",                          color: "bg-lime-100 text-lime-700" },
  { value: "after_sales_followup",   label: "After-sales Follow-up Due",         color: "bg-pink-100 text-pink-700" },
  { value: "complete",               label: "Complete",                          color: "bg-gray-100 text-gray-600" },
] as const;
export type LeadStage = typeof LEAD_STAGES[number]["value"];
export const LEAD_STAGE_LABELS: Record<string, string> = Object.fromEntries(LEAD_STAGES.map(s => [s.value, s.label]));

// ── Simplified lead pipeline (Lead -> Quote -> Job -> Invoice redesign) ─────
// This is the ONLY set of statuses the Leads board renders as columns.
// Everything that used to be a separate "hidden" pipeline stage (site visits,
// contracts, registration, scheduling, invoicing, after-sales) now lives as
// an activity/record on the lead, quote, Accepted Work item, job or invoice
// instead of a board stage — so a lead can never disappear from the board.
export const LEAD_STATUSES = [
  { value: "new",                 label: "New",                color: "bg-blue-100 text-blue-700" },
  { value: "contacted",           label: "Contacted",           color: "bg-indigo-100 text-indigo-700" },
  { value: "appointment_booked",  label: "Appointment Booked",  color: "bg-purple-100 text-purple-700" },
  { value: "quote_required",      label: "Quote Required",      color: "bg-amber-100 text-amber-700" },
  { value: "quoted",              label: "Quoted",               color: "bg-yellow-100 text-yellow-700" },
  { value: "lost",                label: "Lost",                color: "bg-red-100 text-red-700" },
  { value: "converted",           label: "Converted",           color: "bg-green-100 text-green-700" },
] as const;
export type LeadStatus = typeof LEAD_STATUSES[number]["value"];
export const LEAD_STATUS_LABELS: Record<string, string> = Object.fromEntries(LEAD_STATUSES.map(s => [s.value, s.label]));

// Fallback bucket for any status value that doesn't map cleanly — a lead must
// NEVER be hidden just because its status is unrecognised.
export const NEEDS_REVIEW_STATUS = "needs_review" as const;

// Maps every legacy/hidden LEAD_STAGES value (and any stray `stage` value) to
// one of the 7 canonical LEAD_STATUSES above. Pure function — safe to call at
// read time (normalizing old DB rows on the fly) or as a one-time migration.
export function normalizeLeadStatus(status?: string | null, stage?: string | null): LeadStatus | "needs_review" {
  const canonical = new Set(LEAD_STATUSES.map(s => s.value));
  const raw = (status || "").trim();
  if (canonical.has(raw as LeadStatus)) return raw as LeadStatus;

  const LEGACY_MAP: Record<string, LeadStatus> = {
    appointment_scheduled: "appointment_booked",
    appointment_set:       "appointment_booked",
    site_assessment_done:  "quote_required",
    assessment_done:       "quote_required",
    site_done:             "quote_required",
    quote_needed:          "quote_required",
    quote_sent:            "quoted",
    follow_up_due:         "quoted",
    declined:              "lost",
    accepted:              "converted",
    won:                   "converted",
    contract_pending:      "converted",
    client_registration_pending: "converted",
    installation_scheduled: "converted",
    invoiced:              "converted",
    after_sales_followup:  "converted",
    after_sales_follow_up_due: "converted",
    complete:              "converted",
    converted_contract:    "converted",
    converted_job:         "converted",
  };
  if (LEGACY_MAP[raw]) return LEGACY_MAP[raw];

  // Fall back to the legacy `stage` column if `status` itself was unusable.
  const rawStage = (stage || "").trim();
  if (canonical.has(rawStage as LeadStatus)) return rawStage as LeadStatus;
  if (LEGACY_MAP[rawStage]) return LEGACY_MAP[rawStage];

  return NEEDS_REVIEW_STATUS;
}

export const QUOTE_STATUSES = [
  "Draft","Sent","Follow-up Due","Followed Up","Accepted","Declined",
  "Expired","Contract Pending","Converted to Contract","Converted to Job",
] as const;

export const LOST_REASONS = [
  { value: "price_too_high",  label: "Price too high" },
  { value: "competitor",      label: "Client chose competitor" },
  { value: "no_response",     label: "No response" },
  { value: "not_ready",       label: "Not ready yet" },
  { value: "wrong_service",   label: "Wrong service" },
  { value: "bad_timing",      label: "Bad timing" },
  { value: "duplicate",       label: "Duplicate lead" },
  { value: "other",           label: "Other" },
] as const;

export const insertQuoteSubmissionSchema = createInsertSchema(quoteSubmissions).omit({
  id: true,
  submittedAt: true,
  quoteNumber: true,
}).extend({
  origination: z.enum([
    "facebook","google","vehicles","phone","cold_call","referral",
    "website","existing_client","walk_in","email","other",
  ], { required_error: "Origination is required" }),
  originationOther: z.string().optional().nullable(),
  // email and phone are NOT NULL in DB but are optional when staff create a lead internally
  email: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  // companyName and contactPerson: make the Zod message friendly
  companyName: z.string().min(1, "Company / client name is required"),
  contactPerson: z.string().optional().default(""),
});

export type InsertQuoteSubmission = z.infer<typeof insertQuoteSubmissionSchema>;
export type QuoteSubmission = typeof quoteSubmissions.$inferSelect;

// ── Lead activity timeline ──────────────────────────────────────────────────
// A simple append-only log of what happened on a lead (status changes,
// appointments booked, site visits completed, quotes created, etc). Rendered
// on the lead card as its history; never used to drive board visibility.
export const leadActivities = pgTable("lead_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").notNull().references(() => quoteSubmissions.id),
  type: text("type").notNull(),          // status_change, appointment_booked, site_visit_done, quote_created, note, etc.
  description: text("description").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertLeadActivitySchema = createInsertSchema(leadActivities).omit({
  id: true,
  createdAt: true,
});
export type InsertLeadActivity = z.infer<typeof insertLeadActivitySchema>;
export type LeadActivity = typeof leadActivities.$inferSelect;

// ─── PRICING LIBRARY ────────────────────────────────────────────────────────

export const pricingLibrary = pgTable("pricing_library", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(),  // sanitary_bins, washroom, pest_control, deep_cleaning, installation, dustmats, other
  serviceType: text("service_type"),
  unit: text("unit"),                    // per month, per visit, each, per sqm, etc.
  unitPrice: text("unit_price").notNull(),
  departmentId: varchar("department_id"),
  isActive: boolean("is_active").notNull().default(true),
  cost: text("cost"),
  itemCode: text("item_code"),
  vatStatus: text("vat_status").default("inclusive"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertPricingLibrarySchema = createInsertSchema(pricingLibrary).omit({ id: true, createdAt: true });
export type InsertPricingLibraryItem = z.infer<typeof insertPricingLibrarySchema>;
export type PricingLibraryItem = typeof pricingLibrary.$inferSelect;

// ─── SALES FOLLOW-UPS ───────────────────────────────────────────────────────

export const salesFollowUps = pgTable("sales_follow_ups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id"),
  type: text("type"),                   // first_followup, second_followup, manual, after_sales
  method: text("method"),               // Phone call, Email, WhatsApp, Client visit, Other
  dueDate: text("due_date"),            // YYYY-MM-DD
  completedAt: text("completed_at"),
  status: text("status").notNull().default("pending"),  // pending, completed, rescheduled
  result: text("result"),               // accepted, declined, reschedule, no_answer
  notes: text("notes"),
  assignedTo: varchar("assigned_to"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertSalesFollowUpSchema = createInsertSchema(salesFollowUps).omit({ id: true, createdAt: true });
export type InsertSalesFollowUp = z.infer<typeof insertSalesFollowUpSchema>;
export type SalesFollowUp = typeof salesFollowUps.$inferSelect;

// ─── FLEET MODULE ──────────────────────────────────────────────────────────

export const vehicles = pgTable("vehicles", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  registration: text("registration").notNull(),
  make: text("make"),
  model: text("model"),
  year: text("year"),
  departmentId: varchar("department_id"),
  isActive: boolean("is_active").notNull().default(true),
  vehicleStatus: text("vehicle_status").notNull().default("active"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const vehicleAssignments = pgTable("vehicle_assignments", {
  id: varchar("id").primaryKey(),
  vehicleId: varchar("vehicle_id").notNull(),
  workerId: varchar("worker_id").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"),
  assignedAt: timestamp("assigned_at").notNull().default(sql`now()`),
});

export const kmLogs = pgTable("km_logs", {
  id: varchar("id").primaryKey(),
  vehicleId: varchar("vehicle_id").notNull(),
  workerId: varchar("worker_id").notNull(),
  logDate: timestamp("log_date").notNull(),
  startOdometer: integer("start_odometer").notNull(),
  endOdometer: integer("end_odometer").notNull(),
  totalKm: integer("total_km").notNull(),
  businessKm: integer("business_km").notNull().default(0),
  privateKm: integer("private_km").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const fuelFillups = pgTable("fuel_fillups", {
  id: varchar("id").primaryKey(),
  vehicleId: varchar("vehicle_id").notNull(),
  workerId: varchar("worker_id").notNull(),
  fillDate: timestamp("fill_date").notNull(),
  odometer: integer("odometer"),
  litres: decimal("litres", { precision: 8, scale: 2 }).notNull(),
  cost: decimal("cost", { precision: 10, scale: 2 }).notNull(),
  fuelStation: text("fuel_station"),
  receiptPhoto: text("receipt_photo"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const vehicleInspections = pgTable("vehicle_inspections", {
  id: varchar("id").primaryKey(),
  vehicleId: varchar("vehicle_id").notNull(),
  workerId: varchar("worker_id").notNull(),
  inspectionDate: timestamp("inspection_date").notNull(),
  overallResult: text("overall_result").notNull().default("pass"),
  itemsJson: text("items_json"),
  comments: text("comments"),
  photoUrl: text("photo_url"),
  failAlertSent: boolean("fail_alert_sent").notNull().default(false),
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: varchar("reviewed_by"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertVehicleSchema = createInsertSchema(vehicles).omit({ id: true, createdAt: true });
export const insertVehicleAssignmentSchema = createInsertSchema(vehicleAssignments).omit({ id: true, assignedAt: true });
export const insertKmLogSchema = createInsertSchema(kmLogs).omit({ id: true, createdAt: true });
export const insertFuelFillupSchema = createInsertSchema(fuelFillups).omit({ id: true, createdAt: true });
export const insertVehicleInspectionSchema = createInsertSchema(vehicleInspections).omit({ id: true, createdAt: true, failAlertSent: true });

export type InsertVehicle = z.infer<typeof insertVehicleSchema>;
export type Vehicle = typeof vehicles.$inferSelect;
export type InsertVehicleAssignment = z.infer<typeof insertVehicleAssignmentSchema>;
export type VehicleAssignment = typeof vehicleAssignments.$inferSelect;
export type InsertKmLog = z.infer<typeof insertKmLogSchema>;
export type KmLog = typeof kmLogs.$inferSelect;
export type InsertFuelFillup = z.infer<typeof insertFuelFillupSchema>;
export type FuelFillup = typeof fuelFillups.$inferSelect;
export type InsertVehicleInspection = z.infer<typeof insertVehicleInspectionSchema>;
export type VehicleInspection = typeof vehicleInspections.$inferSelect;

// ─── FLEET MAINTENANCE ──────────────────────────────────────────────────────

export const vehicleIssues = pgTable("vehicle_issues", {
  id: varchar("id").primaryKey(),
  vehicleId: varchar("vehicle_id").notNull(),
  workerId: varchar("worker_id").notNull(),
  reportedAt: timestamp("reported_at").notNull(),
  category: text("category").notNull(), // tyres, engine, brakes, electrical, body, lights, fluids, windscreen, other
  description: text("description").notNull(),
  urgency: text("urgency").notNull().default("medium"), // low, medium, high, not_safe
  status: text("status").notNull().default("open"), // open, in_progress, booked, completed, not_required
  photoUrl: text("photo_url"),
  managerNotes: text("manager_notes"),
  resolvedAt: timestamp("resolved_at"),
  serviceRecordId: varchar("service_record_id"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const serviceRecords = pgTable("service_records", {
  id: varchar("id").primaryKey(),
  vehicleId: varchar("vehicle_id").notNull(),
  serviceDate: timestamp("service_date").notNull(),
  odometer: integer("odometer").notNull(),
  serviceProvider: text("service_provider").notNull(),
  workDone: text("work_done").notNull(),
  issuesFixed: text("issues_fixed"),
  cost: decimal("cost", { precision: 10, scale: 2 }),
  invoiceNumber: text("invoice_number"),
  invoiceUrl: text("invoice_url"),
  notes: text("notes"),
  nextServiceDate: timestamp("next_service_date"),
  nextServiceOdometer: integer("next_service_odometer"),
  createdByWorkerId: varchar("created_by_worker_id"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const workshopJobs = pgTable("workshop_jobs", {
  id: varchar("id").primaryKey(),
  vehicleId: varchar("vehicle_id").notNull(),
  assignedDriverId: varchar("assigned_driver_id"),
  issueSource: text("issue_source").notNull().default("manual"),
  sourceInspectionId: varchar("source_inspection_id"),
  sourceIssueId: varchar("source_issue_id"),
  description: text("description").notNull(),
  reportedByWorkerId: varchar("reported_by_worker_id"),
  scheduledDate: timestamp("scheduled_date"),
  priority: text("priority").notNull().default("medium"),
  status: text("status").notNull().default("open"),
  serviceProvider: text("service_provider"),
  cost: decimal("cost", { precision: 10, scale: 2 }),
  notes: text("notes"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertVehicleIssueSchema = createInsertSchema(vehicleIssues).omit({ id: true, createdAt: true });
export const insertServiceRecordSchema = createInsertSchema(serviceRecords).omit({ id: true, createdAt: true });
export const insertWorkshopJobSchema = createInsertSchema(workshopJobs).omit({ id: true, createdAt: true });

export type InsertVehicleIssue = z.infer<typeof insertVehicleIssueSchema>;
export type VehicleIssue = typeof vehicleIssues.$inferSelect;
export type InsertServiceRecord = z.infer<typeof insertServiceRecordSchema>;
export type ServiceRecord = typeof serviceRecords.$inferSelect;
export type InsertWorkshopJob = z.infer<typeof insertWorkshopJobSchema>;
export type WorkshopJob = typeof workshopJobs.$inferSelect;

// ─── TEAM ATTENDANCE MODULE ──────────────────────────────────────────────────

export const teams = pgTable("teams", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  departmentId: varchar("department_id").notNull(),
  supervisorId: varchar("supervisor_id").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
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

export const insertTeamSchema = createInsertSchema(teams).omit({ id: true, createdAt: true });
export const insertTeamMemberSchema = createInsertSchema(teamMembers).omit({ id: true });
export const insertAttendanceRecordSchema = createInsertSchema(attendanceRecords).omit({ id: true, createdAt: true });
export const insertAttendanceMemberRecordSchema = createInsertSchema(attendanceMemberRecords).omit({ id: true });

export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Team = typeof teams.$inferSelect;
export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;
export type TeamMember = typeof teamMembers.$inferSelect;
export type InsertAttendanceRecord = z.infer<typeof insertAttendanceRecordSchema>;
export type AttendanceRecord = typeof attendanceRecords.$inferSelect;
export type InsertAttendanceMemberRecord = z.infer<typeof insertAttendanceMemberRecordSchema>;
export type AttendanceMemberRecord = typeof attendanceMemberRecords.$inferSelect;

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
