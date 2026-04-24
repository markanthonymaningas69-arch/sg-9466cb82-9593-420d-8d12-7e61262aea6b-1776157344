---
title: Approval notifications and GM badge logic
status: done
priority: high
type: feature
tags:
  - approvals
  - notifications
  - gm
  - badges
created_by: agent
created_at: 2026-04-24
position: 58
---

## Notes
Refine the notification system so GM receives only approval-related alerts and summary-style approval notifications instead of general system noise.

Approval Center should also show live badge counts so pending items are visible from navigation and from the tabbed approval screen.

Implementation completed:
- shared layout now loads pending Approval Center requests directly from `approval_requests`
- GM notification dropdown now shows approval-related summary alerts only
- legacy GM noise from deliveries, leaves, vouchers, site requests, and other module-level alerts is no longer included in the GM notification feed
- shared layout subscribes to `approval_requests` realtime changes so counts and alerts refresh immediately
- Approval Center navigation item now shows the current pending approval count

## Checklist
- [x] Inspect the current notification system and identify GM-specific notification paths
- [x] Restrict GM notifications to approval-related alerts
- [x] Add or connect real-time badge counts for Approval Center and category counts
- [x] Validate badge counts and GM notification behavior

## Acceptance
GM only receives approval-related alerts instead of general system notifications.
Approval Center badges show pending approval counts per category.
Badge counts and approval notifications update immediately when request status changes.