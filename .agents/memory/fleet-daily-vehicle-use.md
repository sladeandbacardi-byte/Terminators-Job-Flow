---
name: Fleet daily vehicle use
description: Rules for current driver/vehicle selection, transfers, swaps, and preserved Fleet history.
---

Treat FleetGuard driver/vehicle links as synchronized current-use pointers, not assignment history. In JobFlow, only a mobile selection made on the current Johannesburg day requires transfer/swap confirmation; defaults and prior-day selections must not block today’s choice.

**Why:** FleetGuard exposes current driver pointers and a session start timestamp, but not durable assignment history. Legitimate daily driver swaps must remain possible without reassigning historical KM, fuel, checks, inspections, or faults.

**How to apply:** End old active assignment rows and append current-use rows atomically. Exchange the two current vehicles when both drivers have one; otherwise transfer the target. Keep one active driver per vehicle and one active vehicle per driver, exclude KTD136EC, and never update child Fleet records during a swap.