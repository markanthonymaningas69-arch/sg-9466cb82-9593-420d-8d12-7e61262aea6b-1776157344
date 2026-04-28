---
title: Critical path highlighting
status: in_progress
priority: high
type: feature
tags:
  - schedule
  - gantt
  - dependencies
  - planning
created_by: agent
created_at: 2026-04-28 17:13:10 UTC
position: 116
---

## Notes
Add critical path visibility to the schedule workspace so users can immediately identify bottleneck activities. The highlight should be driven by task dependencies and durations, and it should surface clearly in the schedule view without making the chart harder to read. Keep the implementation inside the existing scheduling flow so recalculated task dates and dependency changes update the critical path automatically.

## Checklist
- [ ] Inspect the current dependency scheduling and Gantt rendering flow
- [ ] Compute critical path task ids from the scheduled task network using current durations and dependencies
- [ ] Highlight critical-path tasks in the schedule view with a clear visual treatment and summary signal
- [ ] Validate the schedule build after the critical-path feature is added

## Acceptance
Tasks on the critical path are visually distinct in the schedule view.

When dependencies or durations change, the highlighted critical path updates accordingly.