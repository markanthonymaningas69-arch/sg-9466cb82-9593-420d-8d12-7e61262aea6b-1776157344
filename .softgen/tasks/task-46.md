---
title: AI assistant floating workspace
status: in_progress
priority: high
type: feature
tags:
  - ai
  - assistant
  - floating-ui
  - workspace
created_by: agent
created_at: 2026-04-23
position: 46
---

## Notes
Enhance the AI assistant UI so it can float across the application without blocking critical modules like Gantt, Calendar, S-Curve, or Task Configuration. The assistant should be draggable, dockable, resizable, collapsible, and restore the user's last position.

The desktop experience should behave like a movable workspace window with docking and edge snapping. On smaller screens, the assistant should default to a compact floating trigger and expand as an overlay.

Follow-up fix:
- simplify the desktop assistant controls so the window is draggable only
- remove docking and manual positioning options from the visible UI while preserving saved drag position

## Checklist
- [x] Inspect the existing AI assistant component and where it is mounted in the app shell
- [x] Implement draggable assistant window with movement constrained to the viewport
- [x] Set default position to the bottom-right corner with margin from edges
- [x] Save and restore position, size, dock state, and collapsed state from local storage
- [x] Add docking options and edge snapping behavior
- [x] Add collapse and restore behavior with minimized floating trigger
- [x] Add resizable window behavior with viewport-based min and max constraints
- [x] Ensure z-index and pointer behavior keep the assistant non-blocking when idle or minimized
- [x] Support responsive mobile overlay behavior
- [x] Validate interaction smoothness and app stability
- [ ] Remove docking and positioning controls from the AI assistant while keeping drag-to-move behavior

## Acceptance
Users can drag, resize, collapse, and restore the AI assistant without blocking the main workspace.
The assistant remembers its last position and size after reload.
On smaller screens, the assistant opens from a compact floating button in overlay mode.