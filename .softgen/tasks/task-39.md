---
title: Manpower rate catalog and labor costing
status: todo
priority: high
type: feature
tags:
  - hr
  - rates
  - labor-cost
  - schedule
created_by: agent
created_at: 2026-04-23
position: 39
---

## Notes
Enhance the HR module with a Manpower Rate Catalog master reference and integrate it with Project Manager task resources so labor cost is calculated automatically from team composition, number of teams, duration, and role-based rates.

The rate catalog must support position name, daily rate, and overtime rate. Task resources must show rate per person, daily labor cost, and total labor cost. Data must auto-save and be ready for later budget forecast use.

## Checklist
- [ ] Inspect existing HR/personnel data structures, role catalogs, and admin edit patterns
- [ ] Add storage and services for manpower rate catalog records
- [ ] Build HR module UI for maintaining rate catalog with admin-only editing
- [ ] Link task resource roles to HR catalog rates inside Task Configuration
- [ ] Add daily and total labor cost calculations based on team composition, number of teams, and task duration
- [ ] Persist labor cost summary data for each task and validate auto-updates when inputs or rates change

## Acceptance
HR module includes a Manpower Rate Catalog with position name, daily rate, and overtime rate.
Task Resources automatically display rate per person, Daily Labor Cost, and Total Labor Cost.
Updating team composition, duration, or rates refreshes labor cost without a manual save action.