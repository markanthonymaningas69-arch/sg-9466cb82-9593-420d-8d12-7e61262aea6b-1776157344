---
title: Read-Only Mode - HR & Site
status: done
priority: high
type: feature
tags: [hr, site, read-only]
created_by: agent
created_at: 2026-04-19T12:45:00Z
position: 19
---
## Notes
Enforce `isLocked` read-only state on Personnel and Site Personnel pages.

## Checklist
- [x] Disable Add Personnel, Leave, Visa actions in personnel.tsx
- [x] Disable attendance logging and manual edits in site-personnel.tsx
- [x] Disable delivery tracking and consumption logs
- [x] Disable Site Requests and Cash Advance creation
- [x] Disable Scope progress updates

## Acceptance
- Expired users can view personnel records and site logs but cannot add or request items.