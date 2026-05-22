import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, decimal, integer, boolean } from "drizzle-orm/pg-core";
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
  employeeId: text("employee_id").unique(), // For mobile login
  pin: text("pin"), // 4-digit PIN for mobile login (hashed)
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
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
  departmentId: varchar("department_id").notNull(),
  taxNumber: text("tax_number"),
  paymentTerms: text("payment_terms"),
  creditLimit: decimal("credit_limit", { precision: 10, scale: 2 }),
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
  type: text("type").notNull(), // 'product' or 'rental_equipment'
  sku: text("sku").notNull().unique(),
  quantity: integer("quantity").notNull().default(0),
  minStockLevel: integer("min_stock_level").notNull().default(10),
  maxStockLevel: integer("max_stock_level").notNull().default(100),
  reorderPoint: integer("reorder_point").notNull().default(20),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }),
  description: text("description"),
  departmentId: varchar("department_id"),
  location: text("location"), // Storage location/warehouse
  supplier: text("supplier"), // Supplier information
  lastRestocked: timestamp("last_restocked"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const rentalContracts = pgTable("rental_contracts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull(),
  inventoryItemId: varchar("inventory_item_id").notNull(),
  // Legacy field — kept for backward compatibility
  monthlyPrice: decimal("monthly_price", { precision: 10, scale: 2 }),
  // Structured pricing fields
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }),
  quantity: integer("quantity").default(1),
  billingFrequency: text("billing_frequency").default("monthly"),
  calculatedTotal: decimal("calculated_total", { precision: 10, scale: 2 }),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  lastPriceIncrease: timestamp("last_price_increase"),
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"),
  contractNumber: text("contract_number"),
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
  jobNumber: text("job_number"),
  linkedQuoteId: varchar("linked_quote_id"),
  invoiceStatus: text("invoice_status").default('not_invoiced'), // not_invoiced | ready_to_invoice | exported | invoiced
  googleMapsLink: text("google_maps_link"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
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

export const insertJobSchema = createInsertSchema(jobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  jobNumber: true,
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
  divisionId: varchar("division_id"), // link to division for department-specific suppliers
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
  userId: varchar("user_id").notNull().references(() => adminUsers.id),
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
});

export const insertQuoteSubmissionSchema = createInsertSchema(quoteSubmissions).omit({
  id: true,
  submittedAt: true,
  quoteNumber: true,
});

export type InsertQuoteSubmission = z.infer<typeof insertQuoteSubmissionSchema>;
export type QuoteSubmission = typeof quoteSubmissions.$inferSelect;

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
  customerId: varchar("customer_id").notNull(),
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
  notes: text("notes"),
  activeStatus: boolean("active_status").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

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
