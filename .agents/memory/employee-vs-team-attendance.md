---
name: Employee vs team attendance
description: Why JobFlow keeps personal clock-in sessions separate from team attendance sheets.
---

Server-timestamped employee Start Work / End Work records must remain separate from the existing supervisor-managed team attendance sheets.

**Why:** The team attendance model represents a dated team checklist with many member rows, while personal attendance requires exactly one immutable employee/day start-end session. Reusing the team tables would weaken uniqueness and risk breaking historical team attendance.

**How to apply:** New personal attendance features, corrections, notifications, and reports use the employee attendance model. Existing team attendance routes and storage remain unchanged.