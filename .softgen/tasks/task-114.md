---
title: Planning integration for manpower teams
status: todo
priority: high
type: feature
tags:
  - project-manager
  - scheduling
  - scurve
  - labor-cost
created_by: agent
created_at: 2026-04-28T15:11:46Z
position: 114
---

## Notes
Use the new team composition data for labor cost computation, task duration estimation, scheduling manpower loading, and S-Curve manpower distribution. Keep the implementation project-based and independent from HR records.

## Checklist
- [ ] Trace where task parameters feed labor cost, scheduling, calendar loading, and S-Curve calculations
- [ ] Update the relevant computation helpers and services to consume the new team composition structure
- [ ] Preserve compatibility for existing tasks without new team data by using safe fallbacks
- [ ] Verify that downstream modules receive team counts, total members, and effective rates correctly

## Acceptance
Task planning outputs use the project-based team composition data for manpower and labor cost calculations.
Existing planning screens continue to load without HR dependencies.