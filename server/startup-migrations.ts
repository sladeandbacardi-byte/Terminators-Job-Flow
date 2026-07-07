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

  console.log("[migrations] Startup migrations complete.");
}
