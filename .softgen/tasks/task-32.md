---
title: Project manager task configuration
status: in_progress
priority: high
type: feature
tags:
  - project-manager
  - bom
  - scheduling
  - resources
created_by: agent
created_at: 2026-04-23
position: 32
---

## Notes
Update the Project Manager module so it matches the requested workflow. Remove the export button, make the Auto generate from BOM action pull the current scopes from the active BOM, and upgrade Task configuration into a functional setup with Parameters, Schedule, and Resources.

In Parameters, users should be able to define a team productivity rate such as 1 mason + 1 helper per hour or per day. That configuration should be used to calculate the required number of days to finish a selected scope.

Current follow-up: add a fully functional Calendar View to Project Manager alongside List View and Gantt View. The calendar must aggregate active tasks by day and show required workforce, material names from BOM-linked scope data, and tools/equipment. Clicking a day should open a detail panel with that day’s tasks and full breakdowns. Filters are required for project, phase, team, and resource type. The aggregation must stay efficient for large task sets and update instantly when task data changes.

## Checklist
- [ ] Remove the export action from the Project Manager toolbar
- [ ] Connect Auto generate from BOM to the current project scopes in the active BOM
- [ ] Refactor Task configuration into Parameters, Schedule, and Resources sections
- [ ] Add functional productivity inputs for team composition and rate unit
- [ ] Calculate required duration for a scope from the configured productivity rate
- [ ] Persist and load task configuration through the existing project_tasks data model
- [ ] Fix current schedule typing/runtime issues caused by mismatched task shapes
- [ ] Add a new Calendar View tab beside List View and Gantt View
- [ ] Build month, week, and day calendar layouts with efficient daily task aggregation
- [ ] Aggregate active-task workforce totals and role breakdowns for each calendar day
- [ ] Aggregate unique material names from BOM-linked tasks for each calendar day
- [ ] Aggregate unique tools and equipment for each calendar day
- [ ] Add a clickable day detail modal with tasks, workforce, materials, and equipment
- [ ] Add filters for phase, team, and resource type within the calendar view
- [ ] Validate the updated Project Manager flow