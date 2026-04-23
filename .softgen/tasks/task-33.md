---
title: Project warehouse sync
status: done
priority: high
type: bug
tags:
  - warehouse
  - site-personnel
  - inventory
created_by: agent
created_at: 2026-04-23
position: 33
---

## Notes
Sync Site Personnel warehouse activity with the Inventory Management module so the Warehouse page Project tab reflects the same on-site stock balance. The Warehouse Project tab reads project inventory records, while Site Personnel currently updates deliveries and consumption separately. Material consumption create, edit, and archive flows must adjust project inventory records automatically.

## Checklist
- [x] Confirm the shared data source used by the Warehouse Project tab
- [x] Sync Site Personnel material consumption creation to project inventory balance
- [x] Sync Site Personnel material consumption edits to project inventory balance
- [x] Sync Site Personnel material consumption archive actions to project inventory balance
- [x] Validate Warehouse Project tab records reflect Site Personnel warehouse changes

## Acceptance
The Warehouse page Project tab shows updated project stock after Site Personnel logs material usage.
Editing or archiving a material consumption record updates the same project inventory balance used by Warehouse.