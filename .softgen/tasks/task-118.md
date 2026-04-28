---
title: Schedule duration calculation
status: in_progress
priority: high
type: bug
tags:
  - schedule
  - duration
  - planning
created_by: agent
created_at: 2026-04-28T17:32:03 UTC
position: 118
---

## Notes
The user reported that the calculated duration in the schedule shows the wrong answer. Investigate the duration formula used by task configuration, confirm how scope quantity, productivity, work hours, and team composition are combined, then fix the calculation at the source and verify the visible duration updates correctly in the schedule editor.

## Checklist
- [ ] Inspect the duration calculation utility and the task configuration panel that displays calculated duration
- [ ] Verify how productivity per hour/day, scope quantity, and team composition affect calculated duration
- [ ] Fix the incorrect duration formula or normalization path at the source
- [ ] Validate that the schedule page reflects the corrected calculated duration without breaking autosave

## Acceptance
Calculated duration matches the configured scope and productivity inputs in the schedule editor.

Changing task productivity or quantity updates the computed duration to the correct value.

The corrected duration persists through the existing schedule save flow.