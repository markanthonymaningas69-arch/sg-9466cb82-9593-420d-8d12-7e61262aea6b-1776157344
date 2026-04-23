---
title: Material delivery planning
status: in_progress
priority: high
type: feature
tags:
  - schedule
  - materials
  - procurement
  - forecasting
created_by: agent
created_at: 2026-04-23
position: 38
---

## Notes
Add Material Delivery Planning inside the Project Manager Resources tab so each task can schedule linked BOM materials using one-time or staggered delivery settings. The resulting delivery timeline must persist per task and store the data needed later for procurement planning and budget forecasting.

This task covers the Resources UI, delivery schedule generation, task-linked storage, and auto-save behavior.

## Checklist
- [x] Inspect the current task resources UI and confirm how BOM materials are linked to schedule tasks
- [x] Add task-level storage and service methods for material delivery planning data
- [x] Add Material Delivery Planning UI with delivery type, start date, frequency, duration, and timeline output
- [x] Auto-link materials from the task BOM scope into delivery planning
- [x] Auto-save per-task material delivery settings and timeline output
- [ ] Validate delivery planning behavior when task schedule dates change

## Acceptance
Each task shows linked BOM materials in the Resources tab under Material Delivery Planning.
Users can set one-time or staggered deliveries with dates that generate a delivery timeline.
Material delivery data is stored per task and ready for future budget forecasting.