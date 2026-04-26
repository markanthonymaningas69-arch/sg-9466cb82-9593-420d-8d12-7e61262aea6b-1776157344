---
title: Approval Center archive action
status: in_progress
priority: high
type: feature
tags: [approval-center, archive, navigation]
created_by: agent
created_at: 2026-04-26T14:43:48 UTC
position: 75
---

## Notes
Add an Action column to the Approval Center so approved items can be archived and linked into the GM vault flow. Also expose Approval Center through a dedicated tab/navigation entry in the interface. Preserve the current approval listing behavior and existing project data wiring.

## Checklist
- [ ] Review the Approval Center page, related service layer, and current navigation/tab structure
- [ ] Add an Action column in Approval Center with an Archive action for eligible records
- [ ] Connect the archive action to the GM vault/archive destination used by the app
- [ ] Add an Approval Center tab/navigation entry in the main interface
- [ ] Validate the updated Approval Center flow builds cleanly without type or runtime errors

## Acceptance
Approval Center shows an Action column with an Archive action where appropriate.
Using Archive sends the record into the GM vault/archive flow instead of leaving it only in the active list.
Approval Center is reachable from a visible tab/navigation entry in the app.