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

In Parameters, users should be able to define productivity using structured team composition from the Master Catalog Engine. Task name and scope quantity must stay locked to the linked BOM scope and update only from the BOM module. Priority and progress should no longer appear in the Parameters workflow. Duration must be calculated from output per team per day multiplied by number of teams, rounded up to the nearest whole day.

Current follow-up: extend the task and catalog data model so tasks can store `team_template_id`, `number_of_teams`, productivity settings, and calculated duration while reading team composition templates from the Master Catalog Engine.

## Checklist
- [ ] Remove the export action from the Project Manager toolbar
- [ ] Connect Auto generate from BOM to the current project scopes in the active BOM
- [ ] Refactor Task configuration into Parameters, Schedule, and Resources sections
- [ ] Lock Task Name and Scope Quantity to BOM-linked scope data and auto-sync them
- [ ] Remove priority and progress from the Parameters UI and related schedule editing flow
- [ ] Add Master Catalog-driven Team Type selection in Parameters
- [ ] Auto-populate team member breakdown from the selected team template
- [ ] Add Number of Teams input with validation
- [ ] Update productivity logic to use output per team per day multiplied by number of teams
- [ ] Calculate required duration from scope quantity and total daily output
- [ ] Persist and load task configuration through the existing project_tasks data model
- [ ] Extend the Master Catalog data model to support team composition templates if missing
- [ ] Fix current schedule typing/runtime issues caused by mismatched task shapes
- [x] Add a new Calendar View tab beside List View and Gantt View
- [x] Build month, week, and day calendar layouts with efficient daily task aggregation
- [x] Aggregate active-task workforce totals and role breakdowns for each calendar day
- [x] Aggregate unique material names from BOM-linked tasks for each calendar day
- [x] Aggregate unique tools and equipment for each calendar day
- [x] Add a clickable day detail modal with tasks, workforce, materials, and equipment
- [x] Add filters for phase, team, and resource type within the calendar view
- [ ] Validate the updated Project Manager flow