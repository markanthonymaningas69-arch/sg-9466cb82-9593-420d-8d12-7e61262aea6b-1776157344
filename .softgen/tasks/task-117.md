---
title: Gantt task selection
status: in_progress
priority: high
type: feature
tags:
  - schedule
  - gantt
  - usability
created_by: agent
created_at: 2026-04-28 17:21:45 UTC
position: 117
---

## Notes
Enable direct activity selection from the Gantt chart so users can click a task bar and open that activity in the existing schedule editor flow without returning to the task list. Preserve the current Gantt visualization while making the selected task visually obvious.

## Checklist
- [ ] Update the Gantt view to accept the currently selected task id and a click handler for task selection
- [ ] Make each visible task bar clickable with clear hover and selected states
- [ ] Connect Gantt bar selection to the schedule page's existing task selection behavior so the side panel opens for the clicked activity

## Acceptance
Clicking a task bar in the Gantt view selects that activity and opens it in the existing task configuration panel.

The currently selected Gantt activity is visually distinct from the other bars.