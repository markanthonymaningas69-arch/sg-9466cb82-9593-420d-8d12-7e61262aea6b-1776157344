---
title: S-Curve data pipeline
status: in_progress
priority: urgent
type: feature
tags:
  - s-curve
  - forecasting
  - project-manager
  - resources
  - hr
created_by: agent
created_at: 2026-04-23
position: 41
---

## Notes
Build the S-Curve calculation pipeline for each project using planned schedule and resource cost data from Project Manager, Resources, and HR, plus actual execution data from Site Personnel / execution tracking. The system must calculate daily and cumulative Planned Value (PV), Actual Value (AV), and Earned Value (EV), then store daily aggregates for dashboard use and future reporting.

This task covers baseline cost extraction, actual cost/progress extraction, daily aggregation, cumulative calculations, and persistence of project daily S-Curve snapshots.

## Checklist
- [x] Inspect current project schedule, labor cost, material delivery, and execution progress data sources
- [x] Add persistent storage for daily S-Curve aggregates with project_id, date, planned_value, actual_value, earned_value
- [x] Create calculation utilities for daily PV, AV, EV and cumulative totals
- [x] Create service methods to generate and read S-Curve aggregates per project
- [ ] Recalculate aggregates when schedule, planned cost, or actual execution data changes

## Acceptance
Each project can produce daily PV, AV, and EV aggregate records.
The stored aggregate data can be queried by project and charted over time.
Recalculation uses planned schedule/resource data and actual execution data together.