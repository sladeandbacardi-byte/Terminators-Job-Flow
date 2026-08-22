---
name: Opportunity lifecycle integrity
description: Authorization and lifecycle rules for technician-reported additional opportunities.
---

Mobile opportunity reports must require a source job and derive the client relationship from the authenticated technician's authorized job list. Never trust a client ID supplied by the handset for this workflow.

**Why:** A UI selector is not an authorization boundary; direct API calls could otherwise attach a report to any customer, and a source job is evidence only until a separate fulfilment job is created.

**How to apply:** Use the same authorized-job resolver as other mobile job actions. Only a fulfilment `jobId`, not the reporting `sourceJobId`, may advance an opportunity to invoice/won.

Quote creation from an opportunity must lock the opportunity, create the quote and relationship in one transaction, and claim the standard quote sequence in that transaction.

**Why:** Concurrent conversion requests can otherwise create duplicate or unnumbered quotes that break the normal quote-to-job workflow.

**How to apply:** Preserve the pre-quote state gate, the row lock, and the canonical `QT` sequence whenever this conversion path is changed.

Service Wallet service state must start from the client's existing jobs and service/rental contracts. Opportunity history is supplemental, and an explicit office override takes precedence.

**Why:** A client can be actively serviced without ever having a newly reported opportunity; treating opportunity history as the only evidence produces misleading cross-sell guidance.

**How to apply:** Classify active contracts and scheduled/in-progress jobs as active, historical jobs/contracts as previously used, then layer opportunity evidence and manual overrides in that precedence order.