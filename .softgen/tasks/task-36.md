---
title: Site request form refinement
status: in_progress
priority: high
type: feature
tags:
  - site-personnel
  - requests
  - boq
created_by: agent
created_at: 2026-04-23
position: 36
---

## Notes
Refine the Site Personnel create request flow so Materials only shows items linked to the selected scope of work, based on the BOQ/BOM data source used by the project. Tools & Equipments should keep an appropriate request form layout separate from materials.

This follow-up specifically verifies the actual source table and scope relationship for project material items before changing the dropdown logic again.

## Checklist
- [x] Separate materials and tools request form experiences in the Site Request dialog
- [x] Scope-filter the materials request list from the current project material source
- [ ] Verify the actual BOQ/BOM table and scope-linking field used by the project material items
- [ ] Update the Material Request dropdown to use only scope-linked BOQ/BOM items for the selected scope
- [ ] Validate that changing the selected scope updates the available material choices correctly

## Acceptance
In Material Request, only materials linked to the selected scope appear in the material dropdown.
In Tools & Equipments request, the dialog presents fields appropriate to tools and equipment requests.