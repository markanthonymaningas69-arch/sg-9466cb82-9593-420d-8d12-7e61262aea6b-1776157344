---
title: Scope-linked material usage selection
status: done
priority: high
type: feature
tags: [site-personnel, material-usage, scope, materials]
created_by: agent
created_at: 2026-04-26T15:27:31 UTC
position: 78
---

## Notes
Update the Site Personnel Material Usage flow so the Material name field is linked to the selected Scope of Works. When a user selects a scope, the material options should narrow to materials that belong to that scope. Preserve the simplified field set already requested: Scope of Works, Material name, Quantity Used, Unit, Usage date, and Notes optional.

## Checklist
- [x] Review the Material Usage tab and related services to find the current scope and material option sources
- [x] Update the Material name options so they depend on the selected Scope of Works
- [x] Keep unit behavior aligned with the selected material when scope-filtered materials change
- [x] Validate the updated Material Usage flow after the change

## Acceptance
Selecting a Scope of Works filters the Material name options to materials for that scope.
Changing the scope clears stale material selections that no longer belong to the chosen scope.
The Material Usage form still saves with the simplified field set.