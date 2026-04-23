---
title: Material delivery planning
status: todo
priority: high
type: feature
tags:
  - schedule
  - materials
  - bom
  - forecast
created_by: agent
created_at: 2026-04-23
position: 38
---

## Notes
Add a Material Delivery Planning subsection under Resources in the task configuration panel. Materials must be auto-linked from the BOM for the selected task and support delivery planning aligned to task schedule.

Store task-linked delivery planning data so it is ready for future budget forecast, cash flow forecast, and procurement planning features.

## Checklist
- [ ] Inspect how task resources and BOM-linked materials are currently loaded
- [ ] Add persistence for material delivery planning data keyed by task and material
- [ ] Build Material Delivery Planning UI with delivery type, start date, frequency, duration, and distribution settings
- [ ] Generate per-task delivery timelines aligned with task schedule
- [ ] Store forecast-ready fields including material_id, task_id, delivery_dates, and planned_usage_period
- [ ] Validate that delivery planning updates auto-save in real time

## Acceptance
Resources includes a Material Delivery Planning section for BOM-linked task materials.
Each planned material delivery stores task-linked forecast-ready schedule data.
Changing task schedule can be reflected in the material delivery planning output.