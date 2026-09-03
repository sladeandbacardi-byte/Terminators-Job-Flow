import { db } from "./db";
import { sql } from "drizzle-orm";

/**
 * Startup migrations — runs automatically before the server starts listening.
 * Each migration is idempotent (uses IF NOT EXISTS / IF EXISTS guards) so it
 * is completely safe to run on every deploy, including on an already-up-to-date
 * database.
 *
 * Add new migrations at the bottom as the schema evolves.
 */
export async function runStartupMigrations(): Promise<void> {
  console.log("[migrations] Running startup schema migrations…");

  const run = async (label: string, statement: string, critical = false) => {
    try {
      await db.execute(sql.raw(statement));
      console.log(`[migrations]   ✓ ${label}`);
    } catch (err: any) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[migrations]   ✗ ${label}: ${message}`);
      if (critical) {
        throw new Error(`[migrations] Critical migration failed (${label}): ${message}`);
      }
    }
  };

  await run(
    "fleet email outbox",
    `CREATE TABLE IF NOT EXISTS fleet_email_outbox (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      event_key text NOT NULL UNIQUE,
      kind text NOT NULL,
      recipients text[] NOT NULL,
      subject text NOT NULL,
      text_body text NOT NULL,
      html_body text NOT NULL,
      attempts integer NOT NULL DEFAULT 0,
      next_attempt_at timestamp NOT NULL DEFAULT now(),
      locked_at timestamp,
      sent_at timestamp,
      last_error text,
      created_at timestamp NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS fleet_email_outbox_ready_idx
      ON fleet_email_outbox (next_attempt_at, created_at) WHERE sent_at IS NULL;`,
    true,
  );
  await run(
    "fleet submission idempotency",
    `ALTER TABLE fuel_fillups ADD COLUMN IF NOT EXISTS submission_key text;
     ALTER TABLE vehicle_inspections ADD COLUMN IF NOT EXISTS submission_key text;
     ALTER TABLE vehicle_issues ADD COLUMN IF NOT EXISTS submission_key text;
     CREATE UNIQUE INDEX IF NOT EXISTS fuel_fillups_submission_key_idx ON fuel_fillups (submission_key) WHERE submission_key IS NOT NULL;
     CREATE UNIQUE INDEX IF NOT EXISTS vehicle_inspections_submission_key_idx ON vehicle_inspections (submission_key) WHERE submission_key IS NOT NULL;
     CREATE UNIQUE INDEX IF NOT EXISTS vehicle_issues_submission_key_idx ON vehicle_issues (submission_key) WHERE submission_key IS NOT NULL;`,
    true,
  );

  await run(
    "FleetGuard assignment provenance and exclusivity",
    `ALTER TABLE vehicle_assignments ADD COLUMN IF NOT EXISTS unassigned_at timestamp;
     ALTER TABLE vehicle_assignments ADD COLUMN IF NOT EXISTS source_system varchar;
     ALTER TABLE vehicle_assignments ADD COLUMN IF NOT EXISTS source_assignment_id varchar;
     CREATE UNIQUE INDEX IF NOT EXISTS vehicle_assignments_source_unique
       ON vehicle_assignments(source_system, source_assignment_id)
       WHERE source_system IS NOT NULL AND source_assignment_id IS NOT NULL;`,
    true,
  );
  await run(
    "FleetGuard active vehicle exclusivity",
    `CREATE UNIQUE INDEX IF NOT EXISTS vehicle_assignments_active_vehicle_unique
       ON vehicle_assignments(vehicle_id) WHERE is_active;
     CREATE UNIQUE INDEX IF NOT EXISTS vehicle_assignments_active_worker_unique
       ON vehicle_assignments(worker_id) WHERE is_active;`,
    true,
  );

  await run(
    "mobile_worker_sessions",
    `CREATE TABLE IF NOT EXISTS mobile_worker_sessions (
       id varchar PRIMARY KEY,
       worker_id varchar NOT NULL REFERENCES workers(id),
       session_token varchar UNIQUE NOT NULL,
       expires_at timestamp NOT NULL,
       created_at timestamp DEFAULT now()
     );
     CREATE INDEX IF NOT EXISTS mobile_worker_sessions_worker_idx
       ON mobile_worker_sessions(worker_id, expires_at);`,
    true,
  );

  await run(
    "office_worker_sessions",
    `CREATE TABLE IF NOT EXISTS office_worker_sessions (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      worker_id varchar NOT NULL REFERENCES workers(id),
      session_token varchar UNIQUE NOT NULL,
      expires_at timestamp NOT NULL,
      created_at timestamp DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS office_worker_sessions_worker_id_idx ON office_worker_sessions(worker_id);
    CREATE INDEX IF NOT EXISTS office_worker_sessions_expires_at_idx ON office_worker_sessions(expires_at);`,
    true,
  );

  await run(
    "private growth and capital planning tables",
    `CREATE TABLE IF NOT EXISTS growth_ideas (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      description text NOT NULL DEFAULT '',
      category text NOT NULL DEFAULT 'Business',
      stage text NOT NULL DEFAULT 'Idea',
      setup_cost numeric(14,2) NOT NULL DEFAULT 0,
      monthly_revenue numeric(14,2) NOT NULL DEFAULT 0,
      monthly_expenses numeric(14,2) NOT NULL DEFAULT 0,
      monthly_cost_saving numeric(14,2) NOT NULL DEFAULT 0,
      staffing text NOT NULL DEFAULT '',
      property_space text NOT NULL DEFAULT '',
      start_date text,
      notes text NOT NULL DEFAULT '',
      expected_free_cash numeric(14,2) NOT NULL DEFAULT 0,
      property_fund_allocation numeric(14,2) NOT NULL DEFAULT 0,
      priority_score integer NOT NULL DEFAULT 0,
      archived_at timestamp,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS jan_capital_account (
      id integer PRIMARY KEY DEFAULT 1,
      original_amount numeric(14,2) NOT NULL DEFAULT 8550000,
      extra_payments numeric(14,2) NOT NULL DEFAULT 900000,
      position_date text NOT NULL DEFAULT '2026-08-25',
      planned_monthly_payment numeric(14,2) NOT NULL DEFAULT 300000,
      updated_at timestamp NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS jan_capital_payments (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      payment_date text NOT NULL,
      amount numeric(14,2) NOT NULL,
      payment_type text NOT NULL DEFAULT 'Normal',
      notes text NOT NULL DEFAULT '',
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS jan_capital_payments_date_amount_idx ON jan_capital_payments(payment_date, amount);
    CREATE TABLE IF NOT EXISTS property_fund_transactions (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      transaction_date text NOT NULL,
      amount numeric(14,2) NOT NULL,
      transaction_type text NOT NULL,
      notes text NOT NULL DEFAULT '',
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS growth_capital_settings (
      id integer PRIMARY KEY DEFAULT 1,
      cash_growth_target numeric(14,2) NOT NULL DEFAULT 100000,
      jan_allocation_percent numeric(5,2) NOT NULL DEFAULT 70,
      property_allocation_percent numeric(5,2) NOT NULL DEFAULT 30,
      property_target numeric(14,2) NOT NULL DEFAULT 0,
      updated_at timestamp NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS growth_capital_audit_log (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      actor_id text NOT NULL,
      action text NOT NULL,
      entity_type text NOT NULL,
      entity_id text,
      details text NOT NULL DEFAULT '',
      created_at timestamp NOT NULL DEFAULT now()
    );
    ALTER TABLE growth_ideas ADD COLUMN IF NOT EXISTS archived_at timestamp;
    CREATE TABLE IF NOT EXISTS growth_categories (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL UNIQUE,
      archived_at timestamp,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS growth_ecosystem_relationships (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      from_idea_id varchar NOT NULL REFERENCES growth_ideas(id) ON DELETE CASCADE,
      to_idea_id varchar NOT NULL REFERENCES growth_ideas(id) ON DELETE CASCADE,
      relationship text NOT NULL,
      notes text NOT NULL DEFAULT '',
      archived_at timestamp,
      created_at timestamp NOT NULL DEFAULT now(),
      CONSTRAINT growth_ecosystem_no_self_link CHECK (from_idea_id <> to_idea_id)
    );
    CREATE TABLE IF NOT EXISTS growth_internal_transactions (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      transaction_date text NOT NULL,
      from_entity text NOT NULL,
      to_entity text NOT NULL,
      amount numeric(14,2) NOT NULL DEFAULT 0,
      transaction_type text NOT NULL DEFAULT 'Allocation',
      notes text NOT NULL DEFAULT '',
      archived_at timestamp,
      created_at timestamp NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS growth_property_support_plans (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      idea_id varchar REFERENCES growth_ideas(id) ON DELETE SET NULL,
      property_name text NOT NULL,
      support_type text NOT NULL DEFAULT 'Space',
      phase text NOT NULL DEFAULT 'Research',
      requirements text NOT NULL DEFAULT '',
      estimated_cost numeric(14,2) NOT NULL DEFAULT 0,
      monthly_support numeric(14,2) NOT NULL DEFAULT 0,
      notes text NOT NULL DEFAULT '',
      archived_at timestamp,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS growth_linked_records (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      idea_id varchar NOT NULL REFERENCES growth_ideas(id) ON DELETE CASCADE,
      record_type text NOT NULL,
      record_id text NOT NULL,
      label text NOT NULL,
      notes text NOT NULL DEFAULT '',
      archived_at timestamp,
      created_at timestamp NOT NULL DEFAULT now(),
      UNIQUE (idea_id, record_type, record_id)
    )`,
    true,
  );
  await run(
    "private growth and capital seed data",
    `INSERT INTO jan_capital_account (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
     INSERT INTO growth_capital_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
     INSERT INTO jan_capital_payments (payment_date, amount, payment_type, notes) VALUES
       ('2025-02-25',150000,'Normal','Historical payment'),('2025-03-25',150000,'Normal','Historical payment'),
       ('2025-04-25',150000,'Normal','Historical payment'),('2025-05-25',150000,'Normal','Historical payment'),
       ('2025-06-25',150000,'Normal','Historical payment'),('2025-07-25',150000,'Normal','Historical payment'),
       ('2025-08-25',150000,'Normal','Historical payment'),('2025-09-25',150000,'Normal','Historical payment'),
       ('2025-10-25',150000,'Normal','Historical payment'),('2025-11-25',150000,'Normal','Historical payment'),
       ('2025-12-25',150000,'Normal','Historical payment'),('2026-01-25',150000,'Normal','Historical payment'),
       ('2026-02-25',150000,'Normal','Historical payment'),('2026-03-25',300000,'Normal','Historical payment'),
       ('2026-04-25',0,'Normal','Historical payment'),('2026-05-25',450000,'Normal','Historical payment'),
       ('2026-06-25',300000,'Normal','Historical payment'),('2026-07-25',300000,'Normal','Historical payment'),
       ('2026-08-25',150000,'Normal','Historical payment')
     ON CONFLICT (payment_date, amount) DO NOTHING;
     INSERT INTO growth_ideas (id, name, description, category, stage, notes) VALUES
       ('growth-integrated-property','Integrated Group Property','Acquire or develop an integrated property that supports the operating group and builds long-term owner capital.','Property','Research','Link property decisions to sustainable operating cash, not turnover.'),
       ('growth-coffee-shop','Coffee Shop','Evaluate a group-supported coffee shop with realistic foot traffic, staffing, margin and property requirements.','New Business','Idea','Keep internal transfers visible so losses are never concealed.'),
       ('growth-vehicle-wash','Vehicle Wash','Evaluate an internal and external vehicle wash that can reduce fleet cleaning costs and create third-party income.','Cost Saving','Testing','Separate genuine cost saving from internal revenue.'),
       ('growth-lea-nail-bar','Lea Nail Bar','Plan a viable nail bar opportunity for Lea, including the private objective of sustainable income that can support her Jimny.','Family Venture','Idea','Private owner objective: build sustainable Lea income toward the Jimny goal.'),
       ('growth-ist-accounting','IST Accounting Growth','Grow IST accounting services through recurring clients, efficient delivery and cross-group support.','Existing Business','Approved','Measure external revenue separately from internal group billings.'),
       ('growth-integrated-services','Integrated Business Services','Build shared business services that improve group efficiency and can earn external recurring revenue.','Shared Services','Research','Prioritise services with repeatable delivery and measurable free cash.')
      ON CONFLICT (id) DO NOTHING;
      INSERT INTO growth_categories (name) VALUES
        ('Property'),('New Business'),('Cost Saving'),('Family Venture'),('Existing Business'),('Shared Services')
      ON CONFLICT (name) DO NOTHING`,
    true,
  );
  await run(
    "future growth full editing schema",
    `ALTER TABLE growth_ideas ADD COLUMN IF NOT EXISTS archived_at timestamp;
     CREATE TABLE IF NOT EXISTS growth_categories (
       id varchar PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL UNIQUE,
       archived_at timestamp, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
     );
     CREATE TABLE IF NOT EXISTS growth_ecosystem_relationships (
       id varchar PRIMARY KEY DEFAULT gen_random_uuid(), from_idea_id varchar NOT NULL REFERENCES growth_ideas(id) ON DELETE CASCADE,
       to_idea_id varchar NOT NULL REFERENCES growth_ideas(id) ON DELETE CASCADE, relationship text NOT NULL,
       notes text NOT NULL DEFAULT '', archived_at timestamp, created_at timestamp NOT NULL DEFAULT now(),
       CONSTRAINT growth_ecosystem_no_self_link CHECK (from_idea_id <> to_idea_id)
     );
     CREATE TABLE IF NOT EXISTS growth_internal_transactions (
       id varchar PRIMARY KEY DEFAULT gen_random_uuid(), transaction_date text NOT NULL, from_entity text NOT NULL,
       to_entity text NOT NULL, amount numeric(14,2) NOT NULL DEFAULT 0, transaction_type text NOT NULL DEFAULT 'Allocation',
       notes text NOT NULL DEFAULT '', archived_at timestamp, created_at timestamp NOT NULL DEFAULT now()
     );
     CREATE TABLE IF NOT EXISTS growth_property_support_plans (
       id varchar PRIMARY KEY DEFAULT gen_random_uuid(), idea_id varchar REFERENCES growth_ideas(id) ON DELETE SET NULL,
       property_name text NOT NULL, support_type text NOT NULL DEFAULT 'Space', phase text NOT NULL DEFAULT 'Research',
       requirements text NOT NULL DEFAULT '', estimated_cost numeric(14,2) NOT NULL DEFAULT 0,
       monthly_support numeric(14,2) NOT NULL DEFAULT 0, notes text NOT NULL DEFAULT '', archived_at timestamp,
       created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
     );
     CREATE TABLE IF NOT EXISTS growth_linked_records (
       id varchar PRIMARY KEY DEFAULT gen_random_uuid(), idea_id varchar NOT NULL REFERENCES growth_ideas(id) ON DELETE CASCADE,
       record_type text NOT NULL, record_id text NOT NULL, label text NOT NULL, notes text NOT NULL DEFAULT '',
       archived_at timestamp, created_at timestamp NOT NULL DEFAULT now(), UNIQUE (idea_id, record_type, record_id)
     );
     INSERT INTO growth_categories (name) VALUES
       ('Property'),('New Business'),('Cost Saving'),('Family Venture'),('Existing Business'),('Shared Services')
     ON CONFLICT (name) DO NOTHING`,
    true,
  );

  // ── quote_submissions columns ──────────────────────────────────────────────
  await run(
    "quote_submissions.site_visit_done",
    `ALTER TABLE quote_submissions ADD COLUMN IF NOT EXISTS site_visit_done boolean NOT NULL DEFAULT false`
  );
  await run(
    "quote_submissions.lead_type",
    `ALTER TABLE quote_submissions ADD COLUMN IF NOT EXISTS lead_type text`
  );
  await run(
    "quote_submissions.priority",
    `ALTER TABLE quote_submissions ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium'`
  );
  await run(
    "quote_submissions.opportunity",
    `ALTER TABLE quote_submissions ADD COLUMN IF NOT EXISTS opportunity boolean NOT NULL DEFAULT false`
  );
  await run(
    "quote_submissions.estimated_value",
    `ALTER TABLE quote_submissions ADD COLUMN IF NOT EXISTS estimated_value text`
  );
  await run(
    "quote_submissions.expected_close_date",
    `ALTER TABLE quote_submissions ADD COLUMN IF NOT EXISTS expected_close_date text`
  );
  await run(
    "quote_submissions.probability",
    `ALTER TABLE quote_submissions ADD COLUMN IF NOT EXISTS probability integer`
  );
  await run(
    "quote_submissions.next_action",
    `ALTER TABLE quote_submissions ADD COLUMN IF NOT EXISTS next_action text`
  );
  await run(
    "quote_submissions.trading_name",
    `ALTER TABLE quote_submissions ADD COLUMN IF NOT EXISTS trading_name text`
  );
  await run(
    "quote_submissions.stage",
    `ALTER TABLE quote_submissions ADD COLUMN IF NOT EXISTS stage text`
  );
  await run(
    "quote_submissions.quote_type",
    `ALTER TABLE quote_submissions ADD COLUMN IF NOT EXISTS quote_type text`
  );
  await run(
    "quote_submissions.lost_reason",
    `ALTER TABLE quote_submissions ADD COLUMN IF NOT EXISTS lost_reason text`
  );
  await run(
    "quote_submissions.lost_reason_other",
    `ALTER TABLE quote_submissions ADD COLUMN IF NOT EXISTS lost_reason_other text`
  );
  await run(
    "quote_submissions.valid_until",
    `ALTER TABLE quote_submissions ADD COLUMN IF NOT EXISTS valid_until text`
  );
  await run(
    "quote_submissions.monthly_recurring",
    `ALTER TABLE quote_submissions ADD COLUMN IF NOT EXISTS monthly_recurring text`
  );
  await run(
    "quote_submissions.installation_cost",
    `ALTER TABLE quote_submissions ADD COLUMN IF NOT EXISTS installation_cost text`
  );
  await run(
    "quote_submissions.internal_notes",
    `ALTER TABLE quote_submissions ADD COLUMN IF NOT EXISTS internal_notes text`
  );
  await run(
    "quote_submissions.client_id",
    `ALTER TABLE quote_submissions ADD COLUMN IF NOT EXISTS client_id varchar REFERENCES clients(id)`
  );
  await run(
    "quote_submissions.after_hours_required",
    `ALTER TABLE quote_submissions ADD COLUMN IF NOT EXISTS after_hours_required text`
  );
  await run(
    "quote_submissions.existing_competitor_contract",
    `ALTER TABLE quote_submissions ADD COLUMN IF NOT EXISTS existing_competitor_contract text`
  );
  await run(
    "quote_submissions.competitor_name",
    `ALTER TABLE quote_submissions ADD COLUMN IF NOT EXISTS competitor_name text`
  );
  await run(
    "quote_submissions.cancellation_notice_required",
    `ALTER TABLE quote_submissions ADD COLUMN IF NOT EXISTS cancellation_notice_required text`
  );
  await run(
    "quote_submissions.notice_period",
    `ALTER TABLE quote_submissions ADD COLUMN IF NOT EXISTS notice_period text`
  );
  await run(
    "quote_submissions.earliest_start_date",
    `ALTER TABLE quote_submissions ADD COLUMN IF NOT EXISTS earliest_start_date text`
  );
  await run(
    "quote_submissions.client_flags",
    `ALTER TABLE quote_submissions ADD COLUMN IF NOT EXISTS client_flags text`
  );
  await run(
    "quote_submissions.expected_service_time",
    `ALTER TABLE quote_submissions ADD COLUMN IF NOT EXISTS expected_service_time text`
  );
  await run(
    "quote_submissions.department_id",
    `ALTER TABLE quote_submissions ADD COLUMN IF NOT EXISTS department_id varchar`
  );
  await run(
    "quote_submissions.legal_entity_id",
    `ALTER TABLE quote_submissions ADD COLUMN IF NOT EXISTS legal_entity_id varchar`
  );
  await run(
    "quote_submissions.legal_entity_name",
    `ALTER TABLE quote_submissions ADD COLUMN IF NOT EXISTS legal_entity_name text`
  );

  // ── lead_activities table ──────────────────────────────────────────────────
  await run(
    "lead_activities table",
    `CREATE TABLE IF NOT EXISTS lead_activities (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      lead_id varchar NOT NULL REFERENCES quote_submissions(id),
      type text NOT NULL,
      description text NOT NULL,
      created_at timestamp NOT NULL DEFAULT now()
    )`
  );

  // ── sales_appointments columns ─────────────────────────────────────────────
  await run(
    "sales_appointments.lead_id",
    `ALTER TABLE sales_appointments ADD COLUMN IF NOT EXISTS lead_id varchar REFERENCES quote_submissions(id)`
  );
  await run(
    "sales_appointments.quote_id",
    `ALTER TABLE sales_appointments ADD COLUMN IF NOT EXISTS quote_id varchar`
  );
  await run(
    "sales_appointments.department_id",
    `ALTER TABLE sales_appointments ADD COLUMN IF NOT EXISTS department_id varchar`
  );
  await run(
    "sales_appointments.completion_note",
    `ALTER TABLE sales_appointments ADD COLUMN IF NOT EXISTS completion_note text`
  );
  await run(
    "sales_appointments.client_feedback",
    `ALTER TABLE sales_appointments ADD COLUMN IF NOT EXISTS client_feedback text`
  );
  await run(
    "sales_appointments.next_action",
    `ALTER TABLE sales_appointments ADD COLUMN IF NOT EXISTS next_action text`
  );
  await run(
    "sales_appointments.follow_up_date",
    `ALTER TABLE sales_appointments ADD COLUMN IF NOT EXISTS follow_up_date text`
  );
  await run(
    "sales_appointments.appointment_type_other",
    `ALTER TABLE sales_appointments ADD COLUMN IF NOT EXISTS appointment_type_other text`
  );

  // ── accepted_workflows columns ─────────────────────────────────────────────
  await run(
    "accepted_workflows.department_id",
    `ALTER TABLE accepted_workflows ADD COLUMN IF NOT EXISTS department_id varchar`
  );
  await run(
    "accepted_workflows.after_hours_required",
    `ALTER TABLE accepted_workflows ADD COLUMN IF NOT EXISTS after_hours_required text`
  );
  await run(
    "accepted_workflows.existing_competitor_contract",
    `ALTER TABLE accepted_workflows ADD COLUMN IF NOT EXISTS existing_competitor_contract text`
  );
  await run(
    "accepted_workflows.competitor_name",
    `ALTER TABLE accepted_workflows ADD COLUMN IF NOT EXISTS competitor_name text`
  );
  await run(
    "accepted_workflows.cancellation_notice_required",
    `ALTER TABLE accepted_workflows ADD COLUMN IF NOT EXISTS cancellation_notice_required text`
  );
  await run(
    "accepted_workflows.notice_period",
    `ALTER TABLE accepted_workflows ADD COLUMN IF NOT EXISTS notice_period text`
  );
  await run(
    "accepted_workflows.ready_to_invoice",
    `ALTER TABLE accepted_workflows ADD COLUMN IF NOT EXISTS ready_to_invoice boolean NOT NULL DEFAULT false`
  );
  await run(
    "accepted_workflows.ready_to_invoice_at",
    `ALTER TABLE accepted_workflows ADD COLUMN IF NOT EXISTS ready_to_invoice_at timestamp`
  );
  await run(
    "accepted_workflows.linked_invoice_id",
    `ALTER TABLE accepted_workflows ADD COLUMN IF NOT EXISTS linked_invoice_id varchar`
  );
  await run(
    "accepted_workflows.linked_job_id",
    `ALTER TABLE accepted_workflows ADD COLUMN IF NOT EXISTS linked_job_id varchar`
  );

  // ── Normalize lead statuses (same as the admin button) ────────────────────
  // Maps every legacy status value to the 7 canonical ones so no leads are hidden.
  const statusMappings: Array<{ from: string[]; to: string }> = [
    { from: ["appointment_scheduled", "appointment_set"],                to: "appointment_booked" },
    { from: ["site_assessment_done", "assessment_done", "site_done", "quote_needed"], to: "quote_required" },
    { from: ["quote_sent", "follow_up_due"],                            to: "quoted" },
    { from: ["declined"],                                               to: "lost" },
    { from: ["accepted", "won", "contract_pending", "client_registration_pending",
             "installation_scheduled", "invoiced", "after_sales_followup",
             "after_sales_follow_up_due", "complete", "converted_contract", "converted_job"], to: "converted" },
  ];
  for (const mapping of statusMappings) {
    for (const fromStatus of mapping.from) {
      await run(
        `normalize status: ${fromStatus} → ${mapping.to}`,
        `UPDATE quote_submissions SET status = '${mapping.to}' WHERE status = '${fromStatus}'`
      );
    }
  }

  // ── Fix sales_appointments.estimated_duration: recalculate from start/end times ─
  // Any appointment that has both startTime and endTime gets its estimatedDuration
  // recalculated so old records with hardcoded 60-minute values are corrected.
  await run(
    "sales_appointments.recalc_estimated_duration",
    `UPDATE sales_appointments
     SET estimated_duration = (
       EXTRACT(HOUR FROM (end_time::time - start_time::time)) * 60 +
       EXTRACT(MINUTE FROM (end_time::time - start_time::time))
     )
     WHERE start_time IS NOT NULL
       AND end_time IS NOT NULL
       AND end_time > start_time
       AND (
         estimated_duration IS NULL
         OR estimated_duration = 60
         OR estimated_duration != (
           EXTRACT(HOUR FROM (end_time::time - start_time::time)) * 60 +
           EXTRACT(MINUTE FROM (end_time::time - start_time::time))
         )
       )`
  );

  // ── New schema columns (idempotent ADD COLUMN guards) ────────────────────
  await run("workers.user_type", `ALTER TABLE workers ADD COLUMN IF NOT EXISTS user_type text NOT NULL DEFAULT 'Staff'`);
  await run("workers.mobile_access_enabled", `ALTER TABLE workers ADD COLUMN IF NOT EXISTS mobile_access_enabled boolean NOT NULL DEFAULT false`);
  await run("field_diaries.invoice_id",       `ALTER TABLE field_diaries   ADD COLUMN IF NOT EXISTS invoice_id varchar`);
  await run("field_diaries.invoice_number",   `ALTER TABLE field_diaries   ADD COLUMN IF NOT EXISTS invoice_number text`);
  await run("invoices.linked_contract_id",    `ALTER TABLE invoices         ADD COLUMN IF NOT EXISTS linked_contract_id varchar`);
  await run("client_payments.payment_number", `ALTER TABLE client_payments  ADD COLUMN IF NOT EXISTS payment_number text`);
  await run("jobs.legal_entity_id",           `ALTER TABLE jobs             ADD COLUMN IF NOT EXISTS legal_entity_id varchar`);
  await run("jobs.legal_entity_name",         `ALTER TABLE jobs             ADD COLUMN IF NOT EXISTS legal_entity_name text`);

  // ── Document-number sequences table (idempotent) ─────────────────────────
  // This guard ensures the table exists even on deployments that haven't
  // run db:push yet.  The composite PK (type, year) is the conflict target
  // used by the atomic UPSERT generator in db-storage.ts.
  await run(
    "sequences: create table if not exists",
    `CREATE TABLE IF NOT EXISTS sequences (
       type     text    NOT NULL,
       year     integer NOT NULL,
       last_seq integer NOT NULL DEFAULT 0,
       PRIMARY KEY (type, year)
     )`
  );

  // ── Step 1 – Backfill all entities with missing document numbers ──────────
  // Numbers are assigned using row_number starting AFTER the current MAX found
  // in the actual data (so backfill never collides with existing numbers).
  // We run backfill BEFORE syncing sequences so the sync captures everything.

  // Jobs
  await run(
    "backfill: jobs missing job_number",
    `WITH base AS (
       SELECT yr,
              COALESCE(MAX(CASE WHEN job_number ~ ('^JOB-' || yr || '-[0-9]+$')
                           THEN CAST(SPLIT_PART(job_number,'-',3) AS INTEGER) END), 0) AS cur_max
       FROM (SELECT EXTRACT(YEAR FROM scheduled_date)::int AS yr, job_number FROM jobs) sub
       GROUP BY yr
     ),
     numbered AS (
       SELECT j.id,
              EXTRACT(YEAR FROM j.scheduled_date)::int AS yr,
              ROW_NUMBER() OVER (PARTITION BY EXTRACT(YEAR FROM j.scheduled_date)::int ORDER BY j.created_at) AS rn
       FROM jobs j
       WHERE j.job_number IS NULL OR j.job_number = ''
     )
     UPDATE jobs
     SET job_number = 'JOB-' || n.yr || '-' || LPAD((b.cur_max + n.rn)::text, 4, '0')
     FROM numbered n
     JOIN base b ON b.yr = n.yr
     WHERE jobs.id = n.id`
  );

  // Quote submissions
  await run(
    "backfill: quote_submissions missing quote_number",
    `WITH base AS (
       SELECT yr,
              COALESCE(MAX(CASE WHEN quote_number ~ ('^QT-' || yr || '-[0-9]+$')
                           THEN CAST(SPLIT_PART(quote_number,'-',3) AS INTEGER) END), 0) AS cur_max
       FROM (SELECT EXTRACT(YEAR FROM COALESCE(submitted_at, now()))::int AS yr, quote_number FROM quote_submissions) sub
       GROUP BY yr
     ),
     numbered AS (
       SELECT q.id,
              EXTRACT(YEAR FROM COALESCE(q.submitted_at, now()))::int AS yr,
              ROW_NUMBER() OVER (PARTITION BY EXTRACT(YEAR FROM COALESCE(q.submitted_at, now()))::int ORDER BY q.submitted_at) AS rn
       FROM quote_submissions q
       WHERE q.quote_number IS NULL OR q.quote_number = ''
     )
     UPDATE quote_submissions
     SET quote_number = 'QT-' || n.yr || '-' || LPAD((b.cur_max + n.rn)::text, 4, '0')
     FROM numbered n
     JOIN base b ON b.yr = n.yr
     WHERE quote_submissions.id = n.id`
  );

  // Service contracts
  await run(
    "backfill: service_contracts missing contract_number",
    `WITH base AS (
       SELECT yr,
              COALESCE(MAX(CASE WHEN contract_number ~ ('^CON-' || yr || '-[0-9]+$')
                           THEN CAST(SPLIT_PART(contract_number,'-',3) AS INTEGER) END), 0) AS cur_max
       FROM (SELECT EXTRACT(YEAR FROM created_at)::int AS yr, contract_number FROM service_contracts) sub
       GROUP BY yr
     ),
     numbered AS (
       SELECT s.id,
              EXTRACT(YEAR FROM s.created_at)::int AS yr,
              ROW_NUMBER() OVER (PARTITION BY EXTRACT(YEAR FROM s.created_at)::int ORDER BY s.created_at) AS rn
       FROM service_contracts s
       WHERE s.contract_number IS NULL OR s.contract_number = ''
     )
     UPDATE service_contracts
     SET contract_number = 'CON-' || n.yr || '-' || LPAD((b.cur_max + n.rn)::text, 4, '0')
     FROM numbered n
     JOIN base b ON b.yr = n.yr
     WHERE service_contracts.id = n.id`
  );

  // Rental contracts
  await run(
    "backfill: rental_contracts missing contract_number",
    `WITH base AS (
       SELECT yr,
              COALESCE(MAX(CASE WHEN contract_number ~ ('^RC-' || yr || '-[0-9]+$')
                           THEN CAST(SPLIT_PART(contract_number,'-',3) AS INTEGER) END), 0) AS cur_max
       FROM (SELECT EXTRACT(YEAR FROM start_date)::int AS yr, contract_number FROM rental_contracts WHERE start_date IS NOT NULL) sub
       GROUP BY yr
     ),
     numbered AS (
       SELECT r.id,
              EXTRACT(YEAR FROM r.start_date)::int AS yr,
              ROW_NUMBER() OVER (PARTITION BY EXTRACT(YEAR FROM r.start_date)::int ORDER BY r.created_at) AS rn
       FROM rental_contracts r
       WHERE (r.contract_number IS NULL OR r.contract_number = '')
         AND r.start_date IS NOT NULL
     )
     UPDATE rental_contracts
     SET contract_number = 'RC-' || n.yr || '-' || LPAD((b.cur_max + n.rn)::text, 4, '0')
     FROM numbered n
     JOIN base b ON b.yr = n.yr
     WHERE rental_contracts.id = n.id`
  );

  // Field diaries
  await run(
    "backfill: field_diaries missing diary_number",
    `WITH base AS (
       SELECT yr,
              COALESCE(MAX(CASE WHEN diary_number ~ ('^FD-' || yr || '-[0-9]+$')
                           THEN CAST(SPLIT_PART(diary_number,'-',3) AS INTEGER) END), 0) AS cur_max
       FROM (SELECT EXTRACT(YEAR FROM created_at)::int AS yr, diary_number FROM field_diaries) sub
       GROUP BY yr
     ),
     numbered AS (
       SELECT f.id,
              EXTRACT(YEAR FROM f.created_at)::int AS yr,
              ROW_NUMBER() OVER (PARTITION BY EXTRACT(YEAR FROM f.created_at)::int ORDER BY f.created_at) AS rn
       FROM field_diaries f
       WHERE f.diary_number IS NULL OR f.diary_number = ''
     )
     UPDATE field_diaries
     SET diary_number = 'FD-' || n.yr || '-' || LPAD((b.cur_max + n.rn)::text, 4, '0')
     FROM numbered n
     JOIN base b ON b.yr = n.yr
     WHERE field_diaries.id = n.id`
  );

  // Client payments
  await run(
    "backfill: client_payments missing payment_number",
    `WITH base AS (
       SELECT yr,
              COALESCE(MAX(CASE WHEN payment_number ~ ('^PAY-' || yr || '-[0-9]+$')
                           THEN CAST(SPLIT_PART(payment_number,'-',3) AS INTEGER) END), 0) AS cur_max
       FROM (SELECT EXTRACT(YEAR FROM created_at)::int AS yr, payment_number FROM client_payments) sub
       GROUP BY yr
     ),
     numbered AS (
       SELECT p.id,
              EXTRACT(YEAR FROM p.created_at)::int AS yr,
              ROW_NUMBER() OVER (PARTITION BY EXTRACT(YEAR FROM p.created_at)::int ORDER BY p.created_at) AS rn
       FROM client_payments p
       WHERE p.payment_number IS NULL OR p.payment_number = ''
     )
     UPDATE client_payments
     SET payment_number = 'PAY-' || n.yr || '-' || LPAD((b.cur_max + n.rn)::text, 4, '0')
     FROM numbered n
     JOIN base b ON b.yr = n.yr
     WHERE client_payments.id = n.id`
  );

  // ── Step 2 – Sync sequences table from actual MAX values (runs AFTER backfill) ─
  // Uses GREATEST so existing higher values are never overwritten.
  await run(
    "sequences: sync from actual document number MAXes",
    `INSERT INTO sequences (type, year, last_seq)
     SELECT type, year, last_seq FROM (
       SELECT 'JOB' AS type,
              EXTRACT(YEAR FROM scheduled_date)::int AS year,
              COALESCE(MAX(CAST(SPLIT_PART(job_number,'-',3) AS INTEGER)), 0) AS last_seq
       FROM jobs
       WHERE job_number ~ '^JOB-[0-9]{4}-[0-9]+'
       GROUP BY EXTRACT(YEAR FROM scheduled_date)::int
       UNION ALL
       SELECT 'INV',
              EXTRACT(YEAR FROM created_at)::int,
              COALESCE(MAX(CAST(SPLIT_PART(invoice_number,'-',3) AS INTEGER)), 0)
       FROM invoices
       WHERE invoice_number ~ '^INV-[0-9]{4}-[0-9]+'
       GROUP BY EXTRACT(YEAR FROM created_at)::int
       UNION ALL
       SELECT 'QT',
              EXTRACT(YEAR FROM COALESCE(submitted_at, now()))::int,
              COALESCE(MAX(CAST(SPLIT_PART(quote_number,'-',3) AS INTEGER)), 0)
       FROM quote_submissions
       WHERE quote_number ~ '^QT-[0-9]{4}-[0-9]+'
       GROUP BY EXTRACT(YEAR FROM COALESCE(submitted_at, now()))::int
       UNION ALL
       SELECT 'RC',
              EXTRACT(YEAR FROM start_date)::int,
              COALESCE(MAX(CAST(SPLIT_PART(contract_number,'-',3) AS INTEGER)), 0)
       FROM rental_contracts
       WHERE contract_number ~ '^RC-[0-9]{4}-[0-9]+'
         AND start_date IS NOT NULL
       GROUP BY EXTRACT(YEAR FROM start_date)::int
       UNION ALL
       SELECT 'CON',
              EXTRACT(YEAR FROM created_at)::int,
              COALESCE(MAX(CAST(SPLIT_PART(contract_number,'-',3) AS INTEGER)), 0)
       FROM service_contracts
       WHERE contract_number ~ '^CON-[0-9]{4}-[0-9]+'
       GROUP BY EXTRACT(YEAR FROM created_at)::int
       UNION ALL
       SELECT 'FD',
              EXTRACT(YEAR FROM created_at)::int,
              COALESCE(MAX(CAST(SPLIT_PART(diary_number,'-',3) AS INTEGER)), 0)
       FROM field_diaries
       WHERE diary_number ~ '^FD-[0-9]{4}-[0-9]+'
       GROUP BY EXTRACT(YEAR FROM created_at)::int
       UNION ALL
       SELECT 'PAY',
              EXTRACT(YEAR FROM created_at)::int,
              COALESCE(MAX(CAST(SPLIT_PART(payment_number,'-',3) AS INTEGER)), 0)
       FROM client_payments
       WHERE payment_number ~ '^PAY-[0-9]{4}-[0-9]+'
       GROUP BY EXTRACT(YEAR FROM created_at)::int
     ) sub
     WHERE last_seq > 0
     ON CONFLICT (type, year) DO UPDATE
       SET last_seq = GREATEST(sequences.last_seq, EXCLUDED.last_seq)`
  );

  // ── Overtime ──────────────────────────────────────────────────────────────
  await run(
    "overtime_entries table",
    `CREATE TABLE IF NOT EXISTS overtime_entries (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      employee_id varchar NOT NULL,
      work_date text NOT NULL,
      client_id varchar NOT NULL,
      job_id varchar,
      start_time text NOT NULL,
      finish_time text NOT NULL,
      notes text NOT NULL,
      overtime_minutes integer NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      approved_by_id varchar,
      approved_by_name text,
      approval_timestamp timestamp,
      rejection_reason text,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )`,
    true
  );
  await run(
    "overtime_audit_entries table",
    `CREATE TABLE IF NOT EXISTS overtime_audit_entries (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      overtime_entry_id varchar NOT NULL,
      actor_id varchar NOT NULL,
      actor_name text NOT NULL,
      action text NOT NULL,
      details text,
      created_at timestamp NOT NULL DEFAULT now()
    )`,
    true
  );
  await run(
    "overtime entries lookup indexes",
    `CREATE INDEX IF NOT EXISTS overtime_entries_employee_work_date_idx
       ON overtime_entries (employee_id, work_date DESC);
     CREATE INDEX IF NOT EXISTS overtime_entries_status_work_date_idx
       ON overtime_entries (status, work_date DESC);
     CREATE INDEX IF NOT EXISTS overtime_audit_entries_entry_created_idx
       ON overtime_audit_entries (overtime_entry_id, created_at DESC)`,
    true
  );

  // ── Overtime: additional columns added in later revision ───────────────────
  await run(
    "overtime_entries.work_type",
    `ALTER TABLE overtime_entries ADD COLUMN IF NOT EXISTS work_type text NOT NULL DEFAULT 'client_job'`,
    true
  );
  await run(
    "overtime_entries.other_description",
    `ALTER TABLE overtime_entries ADD COLUMN IF NOT EXISTS other_description text`,
    true
  );
  await run(
    "overtime_entries.before_hours_minutes",
    `ALTER TABLE overtime_entries ADD COLUMN IF NOT EXISTS before_hours_minutes integer NOT NULL DEFAULT 0`,
    true
  );
  await run(
    "overtime_entries.after_hours_minutes",
    `ALTER TABLE overtime_entries ADD COLUMN IF NOT EXISTS after_hours_minutes integer NOT NULL DEFAULT 0`,
    true
  );
  // client_id is now optional (for internal/workshop overtime)
  await run(
    "overtime_entries.client_id nullable",
    `ALTER TABLE overtime_entries ALTER COLUMN client_id DROP NOT NULL`,
    true
  );
  await run(
    "overtime_entries.customer_name",
    `ALTER TABLE overtime_entries ADD COLUMN IF NOT EXISTS customer_name text`,
    true
  );
  await run(
    "overtime_entries.job_number",
    `ALTER TABLE overtime_entries ADD COLUMN IF NOT EXISTS job_number text`,
    true
  );
  await run(
    "overtime_entries.authorised_time_off",
    `ALTER TABLE overtime_entries ADD COLUMN IF NOT EXISTS entry_type text NOT NULL DEFAULT 'OVERTIME';
     ALTER TABLE overtime_entries ADD COLUMN IF NOT EXISTS time_off_reason text;
     ALTER TABLE overtime_entries ADD COLUMN IF NOT EXISTS time_off_other_reason text;
     ALTER TABLE overtime_entries ADD COLUMN IF NOT EXISTS conflict_override_reason text;
      CREATE INDEX IF NOT EXISTS overtime_entries_type_employee_date_idx
        ON overtime_entries (entry_type, employee_id, work_date DESC)`,
    true
  );

  // ── Employee day attendance ───────────────────────────────────────────────
  // This is intentionally separate from the existing team attendance tables:
  // the team module stores a supervisor's daily checklist, while these rows
  // are server-timestamped employee start/end evidence.
  await run(
    "employee_attendance_records table",
    `CREATE TABLE IF NOT EXISTS employee_attendance_records (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      employee_id varchar NOT NULL,
      work_date text NOT NULL,
      start_at timestamp NOT NULL,
      end_at timestamp,
      total_minutes integer,
      late_start_minutes integer NOT NULL DEFAULT 0,
      early_finish_minutes integer NOT NULL DEFAULT 0,
      status text NOT NULL DEFAULT 'WORKING',
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now(),
      corrected_by varchar,
      correction_reason text
    )`,
    true
  );
  // Attendance remains separate from team sheets. These fields connect a
  // personal workday to the existing Fleet vehicle and kilometre records.
  await run(
    "employee attendance vehicle usage",
    `ALTER TABLE employee_attendance_records
       ADD COLUMN IF NOT EXISTS vehicle_id varchar,
       ADD COLUMN IF NOT EXISTS start_vehicle_km integer,
       ADD COLUMN IF NOT EXISTS end_vehicle_km integer,
       ADD COLUMN IF NOT EXISTS vehicle_distance_km integer,
       ADD COLUMN IF NOT EXISTS vehicle_km_log_id varchar`,
    true
  );
  await run(
    "employee_attendance_audits table",
    `CREATE TABLE IF NOT EXISTS employee_attendance_audits (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      attendance_id varchar NOT NULL,
      employee_id varchar NOT NULL,
      actor_id varchar NOT NULL,
      actor_name text NOT NULL,
      action text NOT NULL,
      original_values text,
      new_values text,
      reason text,
      created_at timestamp NOT NULL DEFAULT now()
    )`,
    true
  );
  await run(
    "employee attendance indexes",
    `CREATE UNIQUE INDEX IF NOT EXISTS employee_attendance_employee_date_key
       ON employee_attendance_records (employee_id, work_date);
     CREATE INDEX IF NOT EXISTS employee_attendance_date_status_idx
       ON employee_attendance_records (work_date, status);
     CREATE INDEX IF NOT EXISTS employee_attendance_audits_record_created_idx
       ON employee_attendance_audits (attendance_id, created_at DESC)`,
    true
  );

  // ── Additional opportunities ─────────────────────────────────────────────
  // These tables deliberately link to the existing client, worker, lead, job,
  // and invoice records instead of copying their information into a new sales
  // subsystem. Foreign keys are omitted here because older production databases
  // can contain legacy row IDs; application routes still verify referenced rows.
  await run(
    "opportunities table",
    `CREATE TABLE IF NOT EXISTS opportunities (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id varchar NOT NULL,
      site_id varchar,
      source_job_id varchar,
      reported_by_worker_id varchar NOT NULL,
      assigned_to_worker_id varchar,
      opportunity_type text NOT NULL,
      custom_type text,
      description text NOT NULL,
      urgency text NOT NULL DEFAULT 'normal',
      status text NOT NULL DEFAULT 'new',
      estimated_value numeric(12,2),
      quote_id varchar,
      job_id varchar,
      invoice_id varchar,
      won_at timestamp,
      lost_reason text,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )`
  );
  await run(
    "opportunity_photos table",
    `CREATE TABLE IF NOT EXISTS opportunity_photos (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      opportunity_id varchar NOT NULL,
      file_url text NOT NULL,
      file_name text,
      uploaded_by_worker_id varchar NOT NULL,
      created_at timestamp NOT NULL DEFAULT now()
    )`
  );
  await run(
    "service_wallet_overrides table",
    `CREATE TABLE IF NOT EXISTS service_wallet_overrides (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id varchar NOT NULL,
      service_type text NOT NULL,
      state text NOT NULL,
      updated_by_user_id varchar,
      updated_at timestamp NOT NULL DEFAULT now()
    )`
  );
  await run(
    "opportunity lookup indexes",
    `CREATE INDEX IF NOT EXISTS opportunities_client_created_idx ON opportunities (client_id, created_at DESC);
     CREATE INDEX IF NOT EXISTS opportunities_reporter_created_idx ON opportunities (reported_by_worker_id, created_at DESC);
     CREATE INDEX IF NOT EXISTS opportunities_status_created_idx ON opportunities (status, created_at DESC);
     CREATE INDEX IF NOT EXISTS opportunities_job_idx ON opportunities (source_job_id);
     CREATE INDEX IF NOT EXISTS opportunity_photos_opportunity_idx ON opportunity_photos (opportunity_id, created_at);
     CREATE UNIQUE INDEX IF NOT EXISTS service_wallet_overrides_client_service_idx ON service_wallet_overrides (client_id, service_type)`
  );

  // ── Digital Pest Control Treatment Reports ────────────────────────────────
  // Keep the long-standing treatment_reports table intact while ensuring a
  // fresh database gets a safe baseline before the structured child records.
  await run(
    "treatment_reports table",
    `CREATE TABLE IF NOT EXISTS treatment_reports (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id varchar NOT NULL,
      job_id varchar,
      contract_id varchar,
      technician_id varchar,
      technician_name text,
      report_date text NOT NULL,
      report_number text,
      service_type text,
      pest_type text,
      treatment_type text,
      site_area text,
      chemicals_used text,
      quantity_used text,
      batch_number text,
      active_ingredient text,
      treatment_notes text,
      recommendations text,
      follow_up_required boolean DEFAULT false,
      follow_up_date text,
      customer_name text,
      customer_signature text,
      technician_signature text,
      status text DEFAULT 'completed',
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )`
  );
  await run("workers.pco_registration_number", `ALTER TABLE workers ADD COLUMN IF NOT EXISTS pco_registration_number text`);
  await run(
    "treatment_reports digital columns",
    `ALTER TABLE treatment_reports
      ADD COLUMN IF NOT EXISTS trading_name text,
      ADD COLUMN IF NOT EXISTS site_address text,
      ADD COLUMN IF NOT EXISTS job_number text,
      ADD COLUMN IF NOT EXISTS contract_number text,
      ADD COLUMN IF NOT EXISTS salesperson_name text,
      ADD COLUMN IF NOT EXISTS pco_registration_number text,
      ADD COLUMN IF NOT EXISTS start_time timestamp,
      ADD COLUMN IF NOT EXISTS finish_time timestamp,
      ADD COLUMN IF NOT EXISTS time_on_site_minutes integer,
      ADD COLUMN IF NOT EXISTS cleanliness_assessment text,
      ADD COLUMN IF NOT EXISTS cleanliness_comments text,
      ADD COLUMN IF NOT EXISTS no_product_used boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS recommendation_choices text,
      ADD COLUMN IF NOT EXISTS other_recommendation_details text,
      ADD COLUMN IF NOT EXISTS signature_unavailable boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS signature_unavailable_reason text,
      ADD COLUMN IF NOT EXISTS action_required boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS action_reason text,
      ADD COLUMN IF NOT EXISTS pdf_url text,
      ADD COLUMN IF NOT EXISTS pdf_generated_at timestamp,
      ADD COLUMN IF NOT EXISTS completed_at timestamp,
      ADD COLUMN IF NOT EXISTS completed_by_worker_id varchar`
  );
  await run(
    "pest_control_products table",
    `CREATE TABLE IF NOT EXISTS pest_control_products (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      formulation text NOT NULL,
      registration_number text,
      default_unit text NOT NULL,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )`
  );
  await run(
    "treatment report child tables",
    `CREATE TABLE IF NOT EXISTS treatment_report_areas (
       id varchar PRIMARY KEY DEFAULT gen_random_uuid(), report_id varchar NOT NULL, area text NOT NULL, other_description text
     );
     CREATE TABLE IF NOT EXISTS treatment_report_pests (
       id varchar PRIMARY KEY DEFAULT gen_random_uuid(), report_id varchar NOT NULL, pest_type text NOT NULL, infestation_level text NOT NULL, other_description text
     );
     CREATE TABLE IF NOT EXISTS treatment_report_equipment (
       id varchar PRIMARY KEY DEFAULT gen_random_uuid(), report_id varchar NOT NULL, equipment_type text NOT NULL, quantity integer NOT NULL DEFAULT 1, product_type text, notes text
     );
     CREATE TABLE IF NOT EXISTS treatment_report_products (
       id varchar PRIMARY KEY DEFAULT gen_random_uuid(), report_id varchar NOT NULL, product_id varchar, product_name text NOT NULL, formulation text, registration_number text, unit text NOT NULL, quantity_used text NOT NULL, mixture_dilution text
     );
     CREATE TABLE IF NOT EXISTS treatment_report_photos (
       id varchar PRIMARY KEY DEFAULT gen_random_uuid(), report_id varchar NOT NULL, file_url text NOT NULL, file_name text, uploaded_by_worker_id varchar, created_at timestamp NOT NULL DEFAULT now()
     );
     CREATE TABLE IF NOT EXISTS treatment_report_audits (
       id varchar PRIMARY KEY DEFAULT gen_random_uuid(), report_id varchar NOT NULL, actor_id varchar, actor_name text NOT NULL, action text NOT NULL, field_name text, previous_value text, next_value text, created_at timestamp NOT NULL DEFAULT now()
     );
     CREATE TABLE IF NOT EXISTS treatment_report_follow_ups (
       id varchar PRIMARY KEY DEFAULT gen_random_uuid(), report_id varchar NOT NULL, client_id varchar NOT NULL, job_id varchar, reason text NOT NULL, recommendation text, identified_date text NOT NULL, assigned_worker_id varchar, status text NOT NULL DEFAULT 'open', created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
     )`
  );
  await run(
    "treatment report lookup indexes",
    `CREATE UNIQUE INDEX IF NOT EXISTS pest_control_products_name_key ON pest_control_products (name);
     CREATE INDEX IF NOT EXISTS treatment_reports_client_date_idx ON treatment_reports (client_id, report_date DESC);
     CREATE INDEX IF NOT EXISTS treatment_reports_job_idx ON treatment_reports (job_id);
     CREATE INDEX IF NOT EXISTS treatment_report_areas_report_idx ON treatment_report_areas (report_id);
     CREATE INDEX IF NOT EXISTS treatment_report_pests_report_idx ON treatment_report_pests (report_id);
     CREATE INDEX IF NOT EXISTS treatment_report_equipment_report_idx ON treatment_report_equipment (report_id);
     CREATE INDEX IF NOT EXISTS treatment_report_products_report_idx ON treatment_report_products (report_id);
     CREATE INDEX IF NOT EXISTS treatment_report_photos_report_idx ON treatment_report_photos (report_id);
     CREATE INDEX IF NOT EXISTS treatment_report_audits_report_idx ON treatment_report_audits (report_id, created_at DESC);
     CREATE INDEX IF NOT EXISTS treatment_report_followups_report_idx ON treatment_report_follow_ups (report_id, status)`
  );
  await run(
    "seed pest control product library",
    `INSERT INTO pest_control_products (name, formulation, registration_number, default_unit) VALUES
      ('Ultrakill Crack & Crevice', 'Aerosol', 'L4598', 'ml'),
      ('Nuvan Profi', 'Aerosol', 'L1301', 'ml'),
      ('Avistelspuit', 'Aerosol', 'L4003', 'ml'),
      ('Maxforce Quantum Ant', 'Gel', 'L8460', 'g'),
      ('Ultrakill RoachForce', 'Gel', 'L8652', 'ml'),
      ('Proroach Gel', 'Gel', NULL, 'g'),
      ('Maxforce Ant', 'Granules', 'L5658', 'g'),
      ('Snail Bait', 'Granules', 'L70096', 'g'),
      ('Deltakill CS', 'Liquid', 'L9528', 'ml'),
      ('Dorine EC', 'Liquid', 'L4913', 'ml'),
      ('Fendona', 'Liquid', 'L5678', 'ml'),
      ('Thermidor 25 EC', 'Liquid', 'L6616', 'ml'),
      ('Rodex Liquid Concentrate', 'Liquid', 'L9290', 'ml'),
      ('Rossi 200 Super', 'Liquid', 'L8376', 'ml'),
      ('Tobaccoguard', 'Liquid', 'L4619', 'ml'),
      ('Promethrin', 'Liquid', 'L10291', 'ml'),
      ('Racumin Tracking', 'Powder', 'L2800', 'ml'),
      ('Roach Dust', 'Powder', 'L4567', 'ml'),
      ('Tomcat Blox', 'Wax Blocks', 'L5524', 'blocks'),
      ('Ultrakill Blox', 'Wax Blocks', 'L9739', 'blocks'),
      ('Non Toxic Blocks', 'Wax Blocks', '-', 'blocks'),
      ('Jaguar Blox', 'Wax Blocks', 'L8259', 'blocks'),
      ('Racumin Wax Blocks', 'Wax Blocks', 'L8465', 'blocks'),
      ('Delta 7 WP', 'WP', 'L8605', 'ml')
     ON CONFLICT (name) DO NOTHING`
  );

  await run(
    "client contact and site profile tables",
    `CREATE TABLE IF NOT EXISTS client_contacts (
       id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
       client_id varchar NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
       first_name text NOT NULL,
       last_name text,
       job_title text,
       email text,
       phone text,
       mobile text,
       preferred_contact text DEFAULT 'Email',
       is_primary boolean NOT NULL DEFAULT false,
       is_billing boolean NOT NULL DEFAULT false,
       is_site boolean NOT NULL DEFAULT false,
       notes text,
       created_at timestamp NOT NULL DEFAULT now()
     );
     CREATE INDEX IF NOT EXISTS client_contacts_client_id_idx ON client_contacts(client_id);
     CREATE TABLE IF NOT EXISTS client_sites (
       id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
       client_id varchar NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
       site_name text NOT NULL,
       street_number text,
       street_name text,
       suburb text,
       city text,
       province text,
       postal_code text,
       gps_link text,
       google_maps_link text,
       is_primary boolean NOT NULL DEFAULT false,
       contact_name text,
       contact_phone text,
       contact_email text,
       notes text,
       is_active boolean NOT NULL DEFAULT true,
       created_at timestamp NOT NULL DEFAULT now()
     );
     CREATE INDEX IF NOT EXISTS client_sites_client_id_idx ON client_sites(client_id);`,
    true,
  );

  await run(
    "canonical mobile supervisor teams",
    `INSERT INTO teams (id, name, department_id, supervisor_id, is_active, notes)
     VALUES
       ('mobile-team-sanitary-a', 'Sanitary Bin Service A Team', 'div-2', 'mobile-tech-01', true, 'Canonical mobile access scope'),
       ('mobile-team-sanitary-b', 'Sanitary Bin Service B Team', 'div-2', 'mobile-tech-04', true, 'Canonical mobile access scope'),
       ('mobile-team-washroom', 'Washroom Services', 'div-3', 'mobile-tech-06', true, 'Canonical mobile access scope'),
       ('mobile-team-ablution', 'Ablution Deep Cleaning', 'div-4', 'mobile-tech-10', true, 'Canonical mobile access scope')
     ON CONFLICT (id) DO NOTHING;
     DO $$
     BEGIN
       IF EXISTS (
         SELECT 1 FROM teams
         WHERE (id = 'mobile-team-sanitary-a' AND (name <> 'Sanitary Bin Service A Team' OR department_id <> 'div-2' OR supervisor_id <> 'mobile-tech-01'))
            OR (id = 'mobile-team-sanitary-b' AND (name <> 'Sanitary Bin Service B Team' OR department_id <> 'div-2' OR supervisor_id <> 'mobile-tech-04'))
            OR (id = 'mobile-team-washroom' AND (name <> 'Washroom Services' OR department_id <> 'div-3' OR supervisor_id <> 'mobile-tech-06'))
            OR (id = 'mobile-team-ablution' AND (name <> 'Ablution Deep Cleaning' OR department_id <> 'div-4' OR supervisor_id <> 'mobile-tech-10'))
       ) THEN
         RAISE EXCEPTION 'Canonical mobile team ID collision; refusing to overwrite production data';
       END IF;
     END $$;
     INSERT INTO team_members (id, team_id, worker_id)
     SELECT gen_random_uuid(), seed.team_id, seed.worker_id
     FROM (VALUES
       ('mobile-team-sanitary-a', 'mobile-tech-01'),
       ('mobile-team-sanitary-b', 'mobile-tech-04'),
       ('mobile-team-washroom', 'mobile-tech-06'),
       ('mobile-team-ablution', 'mobile-tech-10')
     ) AS seed(team_id, worker_id)
     WHERE NOT EXISTS (
       SELECT 1 FROM team_members existing
       WHERE existing.team_id = seed.team_id AND existing.worker_id = seed.worker_id
     );`,
    true,
  );

  await run(
    "Julien-only stored credentials",
    `UPDATE workers
       SET pin = NULL
     WHERE pin IS NOT NULL;
     UPDATE admin_users
       SET password_hash = '', is_active = false, updated_at = now()
     WHERE id <> 'worker-1'
       AND (password_hash <> '' OR is_active = true);
     UPDATE users
       SET password = ''
     WHERE password <> '';`,
    true,
  );

  // ── Fuel-station removal ──────────────────────────────────────────────────
  // Runs as one guarded transaction at startup.  The temporary recursive
  // function removes only exact fuel-station field names, case-insensitively;
  // it does not touch unrelated values such as pest-control bait-station data.
  await run(
    "remove fuel station data",
    `BEGIN;
     SET LOCAL check_function_bodies = off;
     CREATE OR REPLACE FUNCTION pg_temp.scrub_fuel_station_keys(value jsonb)
     RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
       SELECT CASE jsonb_typeof(value)
         WHEN 'object' THEN COALESCE((
           SELECT jsonb_object_agg(key, pg_temp.scrub_fuel_station_keys(item))
           FROM jsonb_each(value) AS object_item(key, item)
           WHERE lower(key) NOT IN ('station', 'station_name', 'fuel_station', 'fuelstation')
         ), '{}'::jsonb)
         WHEN 'array' THEN COALESCE((
           SELECT jsonb_agg(pg_temp.scrub_fuel_station_keys(item))
           FROM jsonb_array_elements(value) AS element(item)
         ), '[]'::jsonb)
         ELSE value
       END;
     $$;
     DO $$
     DECLARE target record;
     BEGIN
       FOR target IN SELECT * FROM (VALUES
         ('fleetguard_source_records', 'payload_json'),
         ('fleetguard_record_mappings', 'metadata_json'),
         ('fleetguard_conflicts', 'details_json'),
         ('fleetguard_import_runs', 'counts_json')
       ) AS scrub_targets(table_name, column_name)
       LOOP
         IF to_regclass(target.table_name) IS NOT NULL THEN
           EXECUTE format(
             'UPDATE %I SET %I = pg_temp.scrub_fuel_station_keys(%I)
              WHERE %I IS NOT NULL
                AND %I IS DISTINCT FROM pg_temp.scrub_fuel_station_keys(%I)',
             target.table_name, target.column_name, target.column_name,
             target.column_name, target.column_name, target.column_name
           );
         END IF;
       END LOOP;
     END $$;
     ALTER TABLE IF EXISTS fuel_fillups
        ADD COLUMN IF NOT EXISTS fuel_type text;
      ALTER TABLE IF EXISTS fuel_fillups
        ALTER COLUMN fuel_type DROP DEFAULT;
     ALTER TABLE IF EXISTS fuel_fillups DROP COLUMN IF EXISTS fuel_station;
     COMMIT;`,
    true,
  );

  // Historical reconciliation builds could materialise the prohibited KTD 136
  // EC vehicle.  This is deliberately target-only and is guarded for partial /
  // older schemas.  Mapping rows remain as exclusion audit evidence, but every
  // payload-bearing JSON field is removed rather than retaining KTD data.
  await run(
    "remove historical KTD136EC FleetGuard materialisation",
    `DO $$
     DECLARE ktd_vehicle_ids text[];
     BEGIN
       IF to_regclass('vehicles') IS NULL THEN RETURN; END IF;
       SELECT array_agg(id) INTO ktd_vehicle_ids
       FROM vehicles
       WHERE regexp_replace(upper(COALESCE(registration, '')), '[^A-Z0-9]', '', 'g') = 'KTD136EC';
       IF COALESCE(array_length(ktd_vehicle_ids, 1), 0) = 0 THEN RETURN; END IF;

       -- Native records are identified through their real vehicle relationship,
       -- never through source payload text.
       IF to_regclass('fuel_fillups') IS NOT NULL THEN
         DELETE FROM fuel_fillups WHERE vehicle_id = ANY(ktd_vehicle_ids);
       END IF;
       IF to_regclass('km_logs') IS NOT NULL THEN
         DELETE FROM km_logs WHERE vehicle_id = ANY(ktd_vehicle_ids);
       END IF;
       IF to_regclass('vehicle_inspections') IS NOT NULL THEN
         DELETE FROM vehicle_inspections WHERE vehicle_id = ANY(ktd_vehicle_ids);
       END IF;
       IF to_regclass('service_records') IS NOT NULL THEN
         DELETE FROM service_records WHERE vehicle_id = ANY(ktd_vehicle_ids);
       END IF;

       IF to_regclass('fleetguard_record_mappings') IS NOT NULL THEN
         IF to_regclass('fleetguard_source_records') IS NOT NULL THEN
           -- Follow the preserved source relationship before its payload is
           -- erased, so dependent mapping evidence is retained as excluded too.
           WITH forbidden_source_vehicles AS (
             SELECT source_id
             FROM fleetguard_record_mappings
             WHERE source_system = 'fleetguard' AND entity_type = 'vehicles'
               AND target_table = 'vehicles' AND target_id = ANY(ktd_vehicle_ids)
           )
           UPDATE fleetguard_record_mappings mapping
              SET status = 'excluded', target_table = NULL, target_id = NULL,
                  match_method = 'forbidden-vehicle-policy',
                  metadata_json = jsonb_build_object('cleanup', 'forbidden KTD136EC policy')
             FROM fleetguard_source_records source_record
            WHERE mapping.source_system = 'fleetguard'
              AND source_record.source_system = 'fleetguard'
              AND mapping.entity_type = source_record.entity_type
              AND mapping.source_id = source_record.source_id
              AND COALESCE(
                    source_record.payload_json ->> 'vehicle_id',
                    source_record.payload_json ->> 'vehicleId'
                  ) IN (SELECT source_id FROM forbidden_source_vehicles);
         END IF;
         UPDATE fleetguard_record_mappings
            SET status = 'excluded', target_table = NULL, target_id = NULL,
                match_method = 'forbidden-vehicle-policy',
                metadata_json = jsonb_build_object('cleanup', 'forbidden KTD136EC policy')
          WHERE source_system = 'fleetguard'
            AND target_table = 'vehicles'
            AND target_id = ANY(ktd_vehicle_ids);
       END IF;
       DELETE FROM vehicles WHERE id = ANY(ktd_vehicle_ids);
     END $$;
     DO $$
     DECLARE target record;
     BEGIN
       -- Clear every raw/conflict payload attached to mappings excluded above,
       -- including children which only held the source vehicle ID.
       IF to_regclass('fleetguard_source_records') IS NOT NULL
          AND to_regclass('fleetguard_record_mappings') IS NOT NULL THEN
         UPDATE fleetguard_source_records source_record
            SET payload_json = '{}'::jsonb
           WHERE source_system = 'fleetguard'
             AND EXISTS (
               SELECT 1 FROM fleetguard_record_mappings mapping
               WHERE mapping.source_system = 'fleetguard'
                 AND mapping.entity_type = source_record.entity_type
                 AND mapping.source_id = source_record.source_id
                 AND mapping.status = 'excluded'
                 AND mapping.match_method = 'forbidden-vehicle-policy'
             );
         IF to_regclass('fleetguard_conflicts') IS NOT NULL THEN
           UPDATE fleetguard_conflicts conflict
              SET details_json = '{}'::jsonb
             WHERE source_system = 'fleetguard'
               AND EXISTS (
                 SELECT 1 FROM fleetguard_record_mappings mapping
                 WHERE mapping.source_system = 'fleetguard'
                   AND mapping.entity_type = conflict.entity_type
                   AND mapping.source_id = conflict.source_id
                   AND mapping.status = 'excluded'
                   AND mapping.match_method = 'forbidden-vehicle-policy'
               );
         END IF;
       END IF;
       FOR target IN SELECT * FROM (VALUES
         ('fleetguard_source_records', 'payload_json'),
         ('fleetguard_conflicts', 'details_json'),
         ('fleetguard_record_mappings', 'metadata_json')
       ) AS targets(table_name, column_name)
       LOOP
         IF to_regclass(target.table_name) IS NOT NULL THEN
           EXECUTE format(
             'UPDATE %I SET %I = ''{}''::jsonb
               WHERE %I IS NOT NULL
                 AND regexp_replace(upper(%I::text), ''[^A-Z0-9]'', '''', ''g'') LIKE ''%%KTD136EC%%''',
             target.table_name, target.column_name, target.column_name, target.column_name
           );
         END IF;
       END LOOP;
     END $$;`,
    true,
  );

  console.log("[migrations] Startup migrations complete.");
}
