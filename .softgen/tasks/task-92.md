---
title: Approval notifications engine
status: in_progress
priority: high
type: feature
tags: [notifications, approval-center, requests]
created_by: agent
created_at: 2026-04-26T18:48:00 UTC
position: 92
---

## Notes
Create or update the notifications engine so approval-related events surface clearly to users. Start with the approval workflow created for Site Personnel requests and reuse existing app patterns if a notification system already exists.

## Checklist
- [x] Inspect existing notification-related UI, state, and services
- [x] Define the approval events that create notifications
- [x] Store and fetch notifications through the connected backend
- [x] Show unread notification state in an existing user-facing surface
- [ ] Validate the notification flow for new approval requests and status changes

## Acceptance
Submitting a request creates a visible approval notification.
Approval status updates can be surfaced back through the notification flow.