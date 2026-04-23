---
title: Manpower rate catalog and labor costing
status: in_progress
priority: high
type: feature
tags:
  - hr
  - schedule
  - labor
  - forecasting
created_by: agent
created_at: 2026-04-23
position: 39
---

## Notes
Enhance the HR module with a Manpower Rate Catalog that acts as the master labor rate reference for Project Manager. The catalog should feed task resource costing automatically so schedule edits, duration changes, team composition changes, and rate updates can recalculate daily and total labor cost without manual save actions.

This task also covers the shared data structure needed for budget forecasting, including task labor cost storage and rate snapshots.

## Checklist
- [x] Verify the current HR module structure and project scheduling data model
- [x] Add persistent database storage for the manpower rate catalog
- [x] Add persistent database storage for task labor cost summaries
- [x] Add HR service methods for listing, creating, updating, and deleting rate catalog entries
- [x] Add Manpower Rate Catalog UI inside the HR module
- [x] Connect Project Manager task resources to the manpower rate catalog
- [x] Show daily labor cost and total labor cost in the Resources section
- [x] Persist labor cost summaries for downstream budget forecasting
- [x] Auto-refresh labor cost when task duration, team composition, or catalog rates change

## Acceptance
HR includes a Manpower Rate Catalog for positions with daily and overtime rates.
Project Manager can use catalog rates to compute daily and total labor cost per task.
Labor cost data is stored in a structure ready for budget forecasting.