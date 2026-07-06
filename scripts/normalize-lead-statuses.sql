-- One-time data cleanup: normalize quote_submissions.status to the 7 canonical
-- lead pipeline values (new, contacted, appointment_booked, quote_required,
-- quoted, lost, converted). Mirrors the LEGACY_MAP in shared/schema.ts's
-- normalizeLeadStatus(). Safe to re-run (idempotent) — only touches rows whose
-- status is not already canonical.
--
-- Run with: psql "$DATABASE_URL" -f scripts/normalize-lead-statuses.sql

BEGIN;

UPDATE quote_submissions SET status = 'appointment_booked'
  WHERE status = 'appointment_scheduled';

UPDATE quote_submissions SET status = 'quote_required'
  WHERE status IN ('site_assessment_done', 'assessment_done', 'site_done', 'quote_needed');

UPDATE quote_submissions SET status = 'quoted'
  WHERE status IN ('quote_sent', 'follow_up_due');

UPDATE quote_submissions SET status = 'lost'
  WHERE status = 'declined';

UPDATE quote_submissions SET status = 'converted'
  WHERE status IN (
    'accepted', 'contract_pending', 'client_registration_pending',
    'installation_scheduled', 'invoiced', 'after_sales_followup',
    'after_sales_follow_up_due', 'complete', 'converted_contract', 'converted_job'
  );

-- Fall back to the legacy `stage` column for any row whose status is still
-- non-canonical after the mapping above (mirrors normalizeLeadStatus's stage fallback).
UPDATE quote_submissions SET status = 'appointment_booked'
  WHERE status NOT IN ('new','contacted','appointment_booked','quote_required','quoted','lost','converted')
    AND stage = 'appointment_scheduled';

UPDATE quote_submissions SET status = 'quote_required'
  WHERE status NOT IN ('new','contacted','appointment_booked','quote_required','quoted','lost','converted')
    AND stage IN ('site_assessment_done', 'assessment_done', 'site_done', 'quote_needed');

UPDATE quote_submissions SET status = 'quoted'
  WHERE status NOT IN ('new','contacted','appointment_booked','quote_required','quoted','lost','converted')
    AND stage IN ('quote_sent', 'follow_up_due');

UPDATE quote_submissions SET status = 'lost'
  WHERE status NOT IN ('new','contacted','appointment_booked','quote_required','quoted','lost','converted')
    AND stage = 'declined';

UPDATE quote_submissions SET status = 'converted'
  WHERE status NOT IN ('new','contacted','appointment_booked','quote_required','quoted','lost','converted')
    AND stage IN (
      'accepted', 'contract_pending', 'client_registration_pending',
      'installation_scheduled', 'invoiced', 'after_sales_followup',
      'after_sales_follow_up_due', 'complete', 'converted_contract', 'converted_job'
    );

-- Any remaining non-canonical rows are left untouched here; the app's
-- normalizeLeadStatus() will surface them under "Needs Review" on the leads
-- board rather than silently hiding or dropping them.

COMMIT;

-- Verify: this should show only the 7 canonical values (plus any genuinely
-- unrecognized leftovers, which the app labels "Needs Review").
SELECT status, count(*) FROM quote_submissions GROUP BY status ORDER BY count(*) DESC;
