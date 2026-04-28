---
title: Gantt drag reorder
status: in_progress
priority: high
type: feature
tags:
  - schedule
  - gantt
  - interaction
created_by: agent
created_at: 2026-04-28 17:49:49 UTC
position: 119
---

## Notes
Add drag-and-drop reordering directly inside the Gantt view so users can change activity order without returning to the task list. Preserve existing task selection behavior, keep dependency rendering intact during normal viewing, and persist the new sort order through the existing schedule save flow.

## Checklist
- [x] Inspect the current Gantt rendering, task selection flow, and sort_order persistence path
- [x] Add drag handles or draggable row behavior in the Gantt view for task reordering
- [x] Update the schedule page state flow to reorder tasks in memory and persist revised sort_order values
- [x] Keep selected task opening behavior working after reorder
- [ ] Validate the schedule build and confirm the Gantt still renders dependencies and task bars correctly

## Acceptance
Dragging a task in the Gantt changes its position in the activity order immediately.

Reloading the page keeps the reordered task sequence.

Selecting a task from the Gantt still opens the activity editor after reorder.