---
name: GitHub connector push fallback
description: Safe fallback for pushing local commits when workspace HTTPS Git credentials are stale but the attached GitHub OAuth connection works.
---

When ordinary Git push authentication fails, use the attached GitHub OAuth connection’s Git Data API rather than requesting or exposing a token. Recreate blobs, trees, and commits in small batches, requiring every returned SHA to match the corresponding local Git object, then update the branch ref once with force disabled. Build commit messages from the raw commit object bytes after the header separator; formatted Git output can append an extra newline and produce a different commit SHA.

**Why:** Large all-history connector operations can fail in the durable execution replay layer before the branch update, even though the OAuth connection itself is healthy. Small per-commit operations succeeded and preserved the exact local commit history.

**How to apply:** Verify the remote branch still points to the expected base before staging objects. If it advanced, fetch and rebase rather than overwriting it. Upload larger commits in sub-megabyte file batches, verify each object SHA, and only fast-forward the ref after the full target chain exists and its final SHA matches local HEAD.