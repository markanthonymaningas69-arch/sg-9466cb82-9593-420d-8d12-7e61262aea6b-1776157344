---
title: Dependency scheduling upgrade
status: done
priority: urgent
type: feature
tags:
  - schedule
  - gantt
  - dependencies
  - autosave
created_by: agent
created_at: 2026-04-23
position: 37
---

## Notes
Enhance the Project Manager scheduling flow so task configuration supports full dependency-driven scheduling with FS, SS, FF, and SF links, multiple predecessors, lag time, and real-time auto-save. Remove Save Task and Delete Task from the task configuration panel. Task deletion must remain only in the main task list.

This task covers the schedule UI, persistence model, and scheduling logic required for dependency-based updates and visual dependency support in the Gantt view.

## Checklist
- [x] Inspect the existing schedule page, task configuration panel, task data model, and persistence flow
- [x] Remove Save Task and Delete Task actions from the task configuration panel and keep auto-save only
- [x] Extend task dependency data to support dependency type, multiple predecessors, and lag time
- [x] Update schedule logic so task dates recalculate dynamically from dependency relationships
- [x] Update Gantt rendering to reflect dependency relationship data
- [x] Validate that task edits auto-save and deletion remains available only from the main task list

## Acceptance
Task Configuration no longer shows Save Task or Delete Task buttons.
Each task can store multiple predecessors with FS, SS, FF, or SF dependency type and lag time.
Changing dependency settings updates schedule behavior without a manual save action.