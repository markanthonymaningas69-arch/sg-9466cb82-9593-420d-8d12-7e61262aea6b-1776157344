---
title: Read-Only Mode - HR & Site
status: todo
priority: high
type: feature
tags: [hr, site, read-only]
created_by: agent
created_at: 2026-04-19T12:45:00Z
position: 19
---
## Notes
Enforce `isLocked` read-only state on Personnel and Site Personnel modules.

## Checklist
- [ ] Disable "Add Personnel", "Edit", "Approve Leave" in personnel.tsx
- [ ] Disable "New Request", "Submit Delivery", "Request Advance" in site-personnel.tsx

## Acceptance
- Expired users can view personnel records and site logs but cannot add or request items.