---
title: BOM edit access lock control
status: in_progress
priority: high
type: feature
tags:
  - dashboard
  - bom
  - projects
  - access-control
created_by: agent
created_at: 2026-04-25
position: 62
---

## Notes
Add a General Manager control in the dashboard that can lock or unlock Bill of Materials editing for a specific project.

The lock is intended to prevent users from adding or editing BOM data after a project is approved or already ongoing, depending on the GM's decision. The control must persist per project and apply consistently anywhere BOM editing is available.

The implementation should:
- add a per-project persisted flag for BOM edit access if it does not already exist
- expose a clear lock/unlock control in the dashboard for GM use
- block BOM add/edit actions when the project is locked
- keep BOM viewing available unless the existing app flow requires otherwise
- show a clear message when a user tries to edit a locked BOM

Follow-up validation:
- fix the remaining missing Alert component imports in the BOM page
- rerun validation after the import fix

## Checklist
- [x] Inspect the current dashboard project controls and BOM editing entry points
- [x] Validate the database schema for a persisted per-project BOM lock field
- [x] Add the database field if missing and wire it into project reads/writes
- [x] Add GM lock/unlock control in the dashboard for each project
- [x] Block BOM add/edit access in the BOM page and related entry buttons when locked
- [x] Show a clear locked-state message to users
- [ ] Validate lint, type, CSS, and runtime behavior

## Acceptance
A GM can lock or unlock BOM editing for a specific project from the dashboard.
When BOM editing is locked for a project, users cannot add or edit BOM data for that project.
Users see a clear message explaining that BOM editing is locked by GM control.