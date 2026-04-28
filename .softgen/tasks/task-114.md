---
title: Planning integration for manpower teams
status: in_progress
priority: high
type: feature
tags:
  - project-manager
  - planning
  - schedule
created_by: agent
created_at: 2026-04-28 15:35:34 UTC
position: 114
---

## Notes
Use the new project-based manpower team composition data for labor cost computation, task duration estimation, scheduling outputs, and downstream planning logic in Project Manager. Remove the practical dependency on HR-based manpower rates for these planning calculations.

## Checklist
- [x] Update schedule data shaping so task team composition feeds role allocations used by manpower loading and planning outputs
- [x] Compute labor cost summaries from project-level team composition instead of HR rates
- [x] Add the Project Manager Manpower Catalog workspace view and load project-specific catalog records when the selected project changes
- [x] Keep scheduling, duration estimation, calendar loading, and S-curve manpower calculations aligned with the new team structure
- [ ] Polish the Material Delivery Planning layout so controls and computed distribution details are clearly visible inside the panel
- [ ] Fix even distribution computation so planned quantities and schedule breakdown render correctly per generated delivery date

## Acceptance
Project Manager calculations use the project manpower catalog and team composition data instead of HR manpower rates.
The schedule workspace compiles cleanly and continues to support labor summaries, duration estimation, and planning views.