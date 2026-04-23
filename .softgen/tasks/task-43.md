---
title: S-Curve module integration
status: todo
priority: high
type: feature
tags:
  - s-curve
  - integration
  - automation
  - execution
created_by: agent
created_at: 2026-04-23
position: 43
---

## Notes
Integrate the S-Curve module with Project Manager, Resources, HR, and Site Personnel so planned and actual values stay current. The system must refresh when task schedule, delivery planning, labor costing, or actual progress data changes.

This task covers wiring the calculation pipeline into the existing modules and exposing the new module in the app.

## Checklist
- [ ] Inspect existing module navigation and project-specific page structure
- [ ] Wire S-Curve recalculation triggers into schedule, resource, labor cost, and actual progress updates
- [ ] Expose the S-Curve module in the appropriate project-facing navigation or page flow
- [ ] Validate end-to-end updates from planned and actual data changes into the chart

## Acceptance
The S-Curve module is reachable from the project workflow.
Changing planned or actual inputs updates the S-Curve data.
Project users can monitor cost and schedule deviation in near real time.