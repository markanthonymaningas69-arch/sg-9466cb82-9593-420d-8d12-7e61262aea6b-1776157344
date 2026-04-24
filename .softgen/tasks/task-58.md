---
title: Approval notifications and GM badge logic
status: todo
priority: high
type: feature
tags:
  - approvals
  - notifications
  - badges
  - realtime
created_by: agent
created_at: 2026-04-24
position: 58
---

## Notes
Refine the notification system so GM receives only approval-related alerts and summary-style approval notifications instead of general system noise.

Approval Center tabs should show NEW badges with pending counts per category, and those counts should update in real time when requests are created or reviewed.

Requesters should be notified immediately when their request is approved, rejected, or returned for revision.

## Checklist
- [ ] Inspect the current notification system and identify GM-specific notification paths
- [ ] Restrict GM notifications to approval-related alerts
- [ ] Add per-tab pending badge counts for Approval Center categories
- [ ] Implement real-time updates for new approval requests and status changes
- [ ] Notify requesters immediately after approval actions
- [ ] Validate badge counts and GM notification behavior

## Acceptance
GM only receives approval-related alerts instead of general system notifications.
Approval Center tabs show pending badge counts for their categories.
Badge counts and approval notifications update immediately when request status changes.