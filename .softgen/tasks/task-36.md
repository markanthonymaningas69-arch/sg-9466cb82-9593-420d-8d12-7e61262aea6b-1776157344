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

Latest follow-up changes:
- keep the Tools & Equipments modal blank for now
- remove duplicated field sections across all request types
- in Material Request, show the Estimated Amount field only when the selected material is not listed in the BOQ/BOM
- remove the "Material Request, Only BOQ/BOM..." helper copy
- remove the "Requested By" field from the Material Request modal

## Checklist
- [x] Separate materials and tools request form experiences in the Site Request dialog
- [x] Scope-filter the materials request list from the current project material source
- [x] Verify the actual BOQ/BOM table and scope-linking field used by the project material items
- [x] Update the Material Request dropdown to use only scope-linked BOQ/BOM items for the selected scope
- [x] Validate that changing the selected scope updates the available material choices correctly
- [x] Remove extra fields from the Tools & Equipments request modal
- [x] Remove any remaining input boxes from the Tools & Equipments modal
- [x] Identify the duplicated field blocks in the shared request modal
- [x] Remove duplicated inputs for Materials, Tools & Equipments, Cash Advance, and Petty Cash
- [x] Validate each request type shows only its intended fields
- [x] Remove the Requested By field from Material Request
- [x] Hide Estimated Amount for BOQ/BOM-listed materials and show it only for non-listed materials
- [x] Remove the Material Request helper copy above the form
- [ ] Validate the material modal behavior for listed versus manual items

## Acceptance
In Material Request, only materials linked to the selected scope appear in the material dropdown.
In Material Request, Estimated Amount only appears for materials not listed in the BOQ/BOM and the Requested By field is removed.
In Tools & Equipments request, the modal opens as a blank shell with no input fields until the final field list is provided.
Each request button opens a modal without duplicated field sections.