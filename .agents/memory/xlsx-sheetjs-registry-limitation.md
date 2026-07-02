---
name: xlsx (SheetJS) npm registry is permanently stale for security fixes
description: Why `npm audit`/OSV scanners keep flagging xlsx as vulnerable even after installing a patched version, and how to actually fix it.
---

The `xlsx` package published on the npm registry stopped receiving updates at 0.18.5, which has known prototype-pollution and ReDoS advisories. SheetJS (the maintainer) publishes newer patched builds only via their own CDN (`https://cdn.sheetjs.com/xlsx-<version>/xlsx-<version>.tgz`), not to npm.

**Why:** Because the vulnerability database's "fixed version" data is derived from npm registry publish history, and no fixed version was ever published there, OSV/npm-audit-style scanners record `fixed: null` for these advisories — meaning they will report `xlsx` as vulnerable *no matter what version string you install*, even if you install a genuinely patched build from SheetJS's CDN.

**How to apply:** To actually fix these CVEs, install directly from the SheetJS CDN tarball URL as the `xlsx` dependency version in `package.json` (e.g. `"xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"`), then verify the fix landed by checking `node_modules/xlsx/CHANGELOG.md` for the specific CVE fix entries — do not rely on the scanner going green, since it structurally cannot recognize this fix. Document the scanner's continued false-positive report as expected/known when reporting audit results.
