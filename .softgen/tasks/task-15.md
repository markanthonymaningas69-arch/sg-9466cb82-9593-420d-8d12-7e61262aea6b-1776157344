---
title: Read-Only Mode - Layout
status: done
priority: urgent
type: feature
tags: [billing, layout, read-only]
created_by: agent
created_at: 2026-04-19T12:45:00Z
position: 15
---
## Notes
When a plan or trial expires, the app should switch to Read-Only mode instead of completely blocking the screen.

## Checklist
- [x] Create task files for all read-only mode updates
- [x] Remove the full-screen blocking overlay from Layout.tsx
- [x] Add a persistent top banner indicating Read-Only Mode
- [x] Disable Approve/Reject buttons in the Layout notifications if `isLocked` is true

## Acceptance
- Expired users can navigate the app and view data.
- A prominent banner shows the app is in Read-Only mode.
- Notification quick-actions are disabled.