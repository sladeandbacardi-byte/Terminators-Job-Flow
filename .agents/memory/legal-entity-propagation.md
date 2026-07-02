---
name: Legal entity propagation pattern
description: How the issuing legal entity (Terminators CC vs Pty Ltd) flows through quote → accepted workflow → invoice, and the UX contract for the entity picker.
---

The issuing legal entity is chosen once, on the quote (`quoteSubmissions.legalEntityId`/`legalEntityName`), and must be carried forward by copying those two fields at each downstream creation point rather than re-deriving or re-selecting it:
- Quote → Accepted Workflow: copied when `CreateWorkflowDialog` POSTs to `/api/accepted-workflows`.
- Job → Invoice: `/api/jobs/:id/create-invoice` looks up the job's `linkedQuoteId` via `storage.getQuoteSubmission()` and copies the entity fields onto the new invoice (jobs themselves don't store entity fields).

**Why:** the entity is a business/legal decision made at quoting time (which company is contracting), not something that should be re-picked or defaulted downstream — doing so risks a workflow/invoice being issued under the wrong legal entity.

**How to apply:** if a new downstream document/record is added to this chain (e.g. a new report or export), copy `legalEntityId`/`legalEntityName` forward from the nearest upstream record with those fields set, don't add a fresh entity picker.

Entity-picker UX contract (both `quotes.tsx` New Quote modal and shared `document-form.tsx`): must handle `isLoading` / `isError` / empty-active-list distinctly, each with a "Reload entities" retry action, not just `array.length === 0` treated as "still loading".
