---
name: Refined Zod schemas
description: Avoid deriving mobile request schemas from a schema already wrapped by superRefine.
---

When a Zod object is wrapped with `superRefine`, it becomes a `ZodEffects` wrapper and no longer exposes object-shaping methods such as `.omit()`.

**Why:** Calling `.omit()` at request time throws before route validation or persistence, which can leave an Express request unresolved and make the client appear to be stuck saving.

**How to apply:** Define a dedicated restricted schema (for example, for mobile self-service fields) before applying validation refinement, or apply the same refinement separately to that dedicated object schema. Do not call object-shaping methods on a schema that has already been refined.