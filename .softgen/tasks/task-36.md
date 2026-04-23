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

Follow-up change: simplify the Tools & Equipments request modal by clearing the existing fields and keeping only the inputs required by the user: Date Required, Tools/Equipment Name, Qty, and Unit.

## Checklist
- [x] Separate materials and tools request form experiences in the Site Request dialog
- [x] Scope-filter the materials request list from the current project material source
- [x] Verify the actual BOQ/BOM table and scope-linking field used by the project material items
- [x] Update the Material Request dropdown to use only scope-linked BOQ/BOM items for the selected scope
- [x] Validate that changing the selected scope updates the available material choices correctly
- [ ] Remove extra fields from the Tools & Equipments request modal
- [ ] Keep only Date Required, Tools/Equipment Name, Qty, and Unit in the Tools & Equipments form
- [ ] Validate that the simplified Tools & Equipments request still submits correctly

## Acceptance
In Material Request, only materials linked to the selected scope appear in the material dropdown.
In Tools & Equipments request, the dialog presents only Date Required, Tools/Equipment Name, Qty, and Unit.