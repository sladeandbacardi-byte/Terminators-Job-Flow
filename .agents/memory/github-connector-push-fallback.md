---
name: GitHub connector push fallback
description: Safe fallback for pushing local commits when workspace HTTPS Git credentials are stale but the attached GitHub OAuth connection works.
---

When ordinary Git push authentication fails, use the attached GitHub OAuth connection’s Git Data API rather than requesting or exposing a token. Recreate blobs, trees, and commits in small batches, requiring every returned SHA to match the corresponding local Git object, then update the branch ref once with force disabled. Read binary blobs directly from the filesystem inside the connector operation; do not transport them through shell-output text.

**Why:** Large all-history connector operations can fail in the durable execution replay layer before the branch update, even though the OAuth connection itself is healthy. Shell callback output can also retain carriage returns in path lists or alter binary transport, creating wrong paths/blobs unless every SHA is checked.

**How to apply:** Verify the remote branch still points to the expected base before staging objects. Normalize line endings in path lists, use binary-safe filesystem reads, verify every blob and full-tree SHA, and only fast-forward the ref after the exact target tree exists.