---
title: Planning integration for manpower teams
status: done
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
- [x] Feed project manpower catalog rates into task labor cost summaries
- [x] Use team composition totals for manpower and duration calculations
- [x] Preserve scheduling and planning outputs with the new team structure
- [x] Remove the remaining HR manpower loading path from Project Manager schedule logic
- [x] Validate the updated implementation with lint and type checks

## Acceptance
Project Manager calculations use the project manpower catalog and team composition data instead of HR manpower rates.
The schedule workspace compiles cleanly and continues to support labor summaries, duration estimation, and planning views.