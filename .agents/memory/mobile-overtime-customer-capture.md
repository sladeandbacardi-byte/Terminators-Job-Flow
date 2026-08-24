---
name: Mobile overtime customer capture
description: Rules for the simplified technician overtime form and its customer/job data.
---

Mobile overtime is a simple customer-facing capture form: date, manually entered customer name, start/end times, and optional notes. A job may prefill context when the user arrives from a job, but it is not a required field or a visible mobile-form choice.

**Why:** Technicians may work at a customer before a formal job exists. Requiring a job or a technical work-type selection turns a simple time submission into a blocker.

**How to apply:** Persist the typed customer name independently of the optional client/job relationship, and use the job only after checking it belongs to the authenticated technician's authorized scope. Keep calculated overtime server-derived from the fixed 08:00–16:00 window; zero calculated minutes warn the technician but may still be submitted for manager review.