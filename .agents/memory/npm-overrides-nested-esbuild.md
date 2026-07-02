---
name: npm overrides don't retroactively re-resolve untouched packages
description: Why adding/editing package.json "overrides" for a deeply-nested dependency can leave old lockfile entries unpatched until something forces npm to re-resolve that specific branch.
---

Adding or changing a scoped `"overrides"` entry (e.g. `{"someParent": {"esbuild": "0.25.0"}}`) does not retroactively rewrite an already-resolved `package-lock.json` entry for a parent package that npm doesn't otherwise touch during that install. If the parent (`someParent`) isn't itself being installed/changed in the same `npm install` invocation, its nested copy can stay pinned to the old, vulnerable version even though the override is present in `package.json`.

**Why:** npm only recomputes the dependency tree for the packages it decides need re-resolution during a given install run; unrelated branches of the lockfile are left alone for speed. Overrides apply during resolution, not retroactively to a stable lockfile.

**How to apply:** After adding/editing an override for a nested package, verify the fix actually landed by inspecting `package-lock.json` (grep for all instances of the target package + version). If a scoped override didn't take effect, force resolution by reinstalling the specific parent package at its current version (e.g. `installLanguagePackages(["drizzle-kit@<same-version>"])`) — this forces npm to recompute that branch and pick up the override. Repeat per-parent until all nested copies converge on the patched version.
