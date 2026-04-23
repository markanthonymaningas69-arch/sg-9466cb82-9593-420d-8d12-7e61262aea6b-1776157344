---
title: AI assistant floating workspace
status: in_progress
priority: high
type: feature
tags:
  - ai
  - assistant
  - floating-ui
  - drag
  - resize
created_by: agent
created_at: 2026-04-23
position: 46
---

## Notes
Upgrade the global AI assistant interface so it behaves like a movable workspace panel instead of a fixed blocking widget.

The assistant must support dragging within the viewport, edge docking, snap behavior, resize controls, collapse and restore behavior, and saved placement so it reopens where the user left it. The default desktop position should be bottom-right with a small margin. On smaller screens, it should fall back to a modal-style overlay opened from a compact floating button.

The assistant must stay available across modules without obstructing schedule, calendar, or task configuration views.

## Checklist
- [ ] Inspect the current AI assistant component and global mounting point
- [ ] Implement draggable desktop window behavior constrained to the viewport
- [ ] Add dock and snap support for left, right, bottom-left, and bottom-right placements
- [ ] Add resize behavior with minimum and maximum bounds
- [ ] Add collapse and restore behavior with minimized floating trigger
- [ ] Persist window position, size, dock state, and collapsed state in local storage
- [ ] Add mobile behavior that opens the assistant as an overlay from a floating button
- [ ] Validate interaction smoothness and non-blocking behavior across modules

## Acceptance
The AI assistant can be dragged, resized, collapsed, restored, and docked without blocking the main module workspace.
The assistant restores its last desktop position and size after reload.
On smaller screens, the assistant opens from a compact floating button in overlay mode.