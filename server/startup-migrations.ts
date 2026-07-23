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

  const run = async (label: string, statement: string) => {
    try {
      await db.execute(sql.raw(statement));
      console.log(`[migrations]   ✓ ${label}`);
    } catch (err: any) {
      // Non-fatal — log and continue so one bad migration doesn't crash the server
      console.warn(`[migrations]   ✗ ${label}: ${err.message}`);
    }
  };

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

  // ── Initialise sequences table from existing MAX values ────────────────────
  // Run this ONCE per type+year so new numbers never collide with existing ones.
  // Uses INSERT … ON CONFLICT DO UPDATE so it's safe to re-run on every boot.
  await run(
    "sequences: init from existing document numbers",
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

  // ── Backfill null job_number values ────────────────────────────────────────
  // Any job missing a number gets one. We assign year-2026 CON-… safe numbers
  // using row_number so no two rows get the same number.
  await run(
    "backfill: jobs missing job_number",
    `WITH numbered AS (
       SELECT id,
              EXTRACT(YEAR FROM scheduled_date)::int AS yr,
              ROW_NUMBER() OVER (PARTITION BY EXTRACT(YEAR FROM scheduled_date)::int ORDER BY created_at) AS rn
       FROM jobs
       WHERE job_number IS NULL OR job_number = ''
     )
     UPDATE jobs
     SET job_number = 'JOB-' || n.yr || '-' || LPAD(
       ((SELECT COALESCE(last_seq, 0) FROM sequences WHERE type='JOB' AND year = n.yr) + n.rn)::text,
       4, '0')
     FROM numbered n
     WHERE jobs.id = n.id`
  );

  // ── Backfill null service_contract contract_number values ──────────────────
  await run(
    "backfill: service_contracts missing contract_number",
    `WITH numbered AS (
       SELECT id,
              EXTRACT(YEAR FROM created_at)::int AS yr,
              ROW_NUMBER() OVER (PARTITION BY EXTRACT(YEAR FROM created_at)::int ORDER BY created_at) AS rn
       FROM service_contracts
       WHERE contract_number IS NULL OR contract_number = ''
     )
     UPDATE service_contracts
     SET contract_number = 'CON-' || n.yr || '-' || LPAD(
       (COALESCE((SELECT last_seq FROM sequences WHERE type='CON' AND year = n.yr), 0) + n.rn)::text,
       4, '0')
     FROM numbered n
     WHERE service_contracts.id = n.id`
  );

  // ── Backfill null rental_contract contract_number values ───────────────────
  await run(
    "backfill: rental_contracts missing contract_number",
    `WITH numbered AS (
       SELECT id,
              EXTRACT(YEAR FROM start_date)::int AS yr,
              ROW_NUMBER() OVER (PARTITION BY EXTRACT(YEAR FROM start_date)::int ORDER BY created_at) AS rn
       FROM rental_contracts
       WHERE contract_number IS NULL OR contract_number = ''
     )
     UPDATE rental_contracts
     SET contract_number = 'RC-' || n.yr || '-' || LPAD(
       (COALESCE((SELECT last_seq FROM sequences WHERE type='RC' AND year = n.yr), 0) + n.rn)::text,
       4, '0')
     FROM numbered n
     WHERE rental_contracts.id = n.id`
  );

  // ── Field diaries: add invoice_id / invoice_number columns if missing ──────
  await run(
    "field_diaries.invoice_id",
    `ALTER TABLE field_diaries ADD COLUMN IF NOT EXISTS invoice_id varchar`
  );
  await run(
    "field_diaries.invoice_number",
    `ALTER TABLE field_diaries ADD COLUMN IF NOT EXISTS invoice_number text`
  );

  // ── Invoices: add linked_contract_id column if missing ─────────────────────
  await run(
    "invoices.linked_contract_id",
    `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS linked_contract_id varchar`
  );

  // ── Client payments: add payment_number column if missing ──────────────────
  await run(
    "client_payments.payment_number",
    `ALTER TABLE client_payments ADD COLUMN IF NOT EXISTS payment_number text`
  );

  console.log("[migrations] Startup migrations complete.");
}
