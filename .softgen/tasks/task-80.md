---
title: Site warehouse balance display
status: done
priority: high
type: feature
tags: [site-warehouse, ui, reconciliation, inventory]
created_by: agent
created_at: 2026-04-26T16:16:13 UTC
position: 80
---

## Notes
Update the Site Warehouse interface so it displays linked material balance information sourced from Site Purchase & Deliveries and Usage. Include total restock material, total usage, remaining materials, and missing/excess materials in a user-readable layout.

## Checklist
- [x] Update the Site Warehouse tab UI to show total restock, total usage, remaining materials, and missing/excess values
- [x] Keep material naming and units aligned with the linked purchase and usage records
- [x] Preserve existing warehouse interactions while adding the new linked balance information
- [x] Validate the updated Site Warehouse presentation in the running app

## Acceptance
The Site Warehouse tab shows total restock and total usage for each tracked material.
Users can see remaining material quantities directly in the Site Warehouse tab.
Missing and excess material status is visible without opening another tab.