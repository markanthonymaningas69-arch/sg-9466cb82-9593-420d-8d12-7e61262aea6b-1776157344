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
Update the Project Manager module so it matches the requested workflow. Remove the export button, make the Auto generate from BOM action pull the current scopes from the BOM, and upgrade Task configuration into a functional setup with Parameters, Schedule, and Resources.

In Parameters, users should be able to define a team productivity rate such as 1 mason + 1 helper per hour or per day. That configuration should be used to calculate the required number of days to finish a selected scope.

The implementation should stay extensible so more scope/task rules can be added later without rewriting the whole module.

## Checklist
- [ ] Locate the Project Manager UI and remove the export action
- [ ] Connect Auto generate from BOM to the current project scopes in the BOM
- [ ] Refactor Task configuration into Parameters, Schedule, and Resources sections
- [ ] Add functional productivity inputs for team composition and rate unit
- [ ] Calculate required duration for a scope from the configured productivity rate
- [ ] Persist or load task configuration from the existing backend structure if available
- [ ] Validate the updated Project Manager flow