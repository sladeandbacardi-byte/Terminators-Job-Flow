---
name: Spreadsheet export integrity
description: Security boundary for CSV data opened in spreadsheet applications.
---

Treat every dynamic CSV producer, including downloadable reports and emailed backups, as a spreadsheet execution boundary. Neutralize string cells whose leading whitespace or control characters are followed by `=`, `+`, `-`, or `@`; continue to serialize genuine numeric values as numbers.

**Why:** Protecting one visible export is insufficient when the same untrusted business data can reach independent browser, API, report, or backup serializers. CSV quoting handles delimiters but does not prevent spreadsheet formula interpretation.

**How to apply:** Inventory all CSV content types, filenames, blobs, buffers, and manual row joins whenever export security changes. Route dynamic writers through a shared tested cell escaper on both client and server.