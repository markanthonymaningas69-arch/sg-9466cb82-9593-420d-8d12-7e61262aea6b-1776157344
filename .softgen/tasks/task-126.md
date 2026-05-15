---
title: Approval Center recycle bin
status: in_progress
priority: high
type: feature
tags: [approval-center, delete, recycle-bin, workflow]
created_by: agent
created_at: 2026-05-15T13:05:59 UTC
position: 126
---

## Notes
Add delete controls to Approval Center items and introduce a recycle bin flow so removed requests can still be reviewed and restored if needed. The implementation should preserve the current approval workflow, keep deleted items out of the active lists, and provide a clear way to inspect or recover deleted records.

## Checklist
- [x] Inspect the current Approval Center page structure, tabs, and request actions
- [x] Inspect the request service and database schema for approval request lifecycle fields
- [x] Add a safe soft-delete model for approval requests
- [x] Add delete buttons to active Approval Center request items
- [x] Add a recycle bin surface for deleted Approval Center items
- [x] Add restore and permanent removal behavior if supported by the current schema
- [ ] Validate that deleted items disappear from active Approval Center lists without breaking linked modules

## Acceptance
Approval Center items show a delete action in the active lists.
Deleted Approval Center items move to a recycle bin instead of disappearing permanently.
Users can review deleted requests separately from active approval items.