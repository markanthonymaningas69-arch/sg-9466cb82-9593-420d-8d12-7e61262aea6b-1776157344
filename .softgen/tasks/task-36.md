---
title: Site request form refinement
status: done
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

Latest follow-up change: keep the Tools & Equipments modal blank for now. Do not show any form inputs until the user provides the final list of required fields.

Additional follow-up: remove any remaining input boxes from the Tools & Equipments modal so the dialog is fully empty except for its shell.

## Checklist
- [x] Separate materials and tools request form experiences in the Site Request dialog
- [x] Scope-filter the materials request list from the current project material source
- [x] Verify the actual BOQ/BOM table and scope-linking field used by the project material items
- [x] Update the Material Request dropdown to use only scope-linked BOQ/BOM items for the selected scope
- [x] Validate that changing the selected scope updates the available material choices correctly
- [x] Remove extra fields from the Tools & Equipments request modal
- [x] Remove any remaining input boxes from the Tools & Equipments modal
- [x] Preserve the Material Request behavior while the tools modal remains blank

## Acceptance
In Material Request, only materials linked to the selected scope appear in the material dropdown.
In Tools & Equipments request, the modal opens as a blank shell with no input fields until the final field list is provided.