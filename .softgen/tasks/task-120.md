---
title: Site Personnel recycle bin data flow
status: done
priority: high
type: feature
tags:
  - site-personnel
  - recycle-bin
  - supabase
created_by: agent
created_at: 2026-04-28 17:58:41 UTC
position: 120
---

## Notes
Add a recycle bin capability for the Site Personnel module so deleted records from linked tabs can be restored or permanently removed instead of disappearing immediately. The implementation should use the existing Supabase-backed data flow and preserve enough item context to show where each deleted record came from.

## Checklist
- [ ] Inspect current Site Personnel delete flows, tab structure, and service methods used by linked tabs
- [ ] Verify database tables and whether current records support soft delete fields or need a schema update
- [ ] Add shared service logic to list deleted Site Personnel records and restore or permanently delete them by source tab
- [ ] Keep recycle bin records labeled by source tab and record type so users can identify what they are restoring or deleting

## Acceptance
Deleted Site Personnel records appear in a recycle bin instead of being lost immediately.

Users can restore a deleted record and see it return to its original tab.

Users can permanently delete a recycle bin record so it no longer appears anywhere in the module.