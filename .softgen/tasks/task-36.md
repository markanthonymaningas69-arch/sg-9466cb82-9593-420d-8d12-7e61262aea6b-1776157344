---
title: Site request form refinement
status: done
priority: high
type: feature
tags:
  - site-personnel
  - requests
  - materials
  - tools
created_by: agent
created_at: 2026-04-23
position: 36
---

## Notes
Refine the Site Personnel request dialog in two ways. First, Materials requests must only show materials linked to the selected scope of work in the dropdown list. Second, Tools & Equipments requests need a more appropriate modal form with tool-specific labels, options, and request-list presentation instead of reusing the generic materials layout.

The existing request submission flow should remain intact for materials, tools and equipments, petty cash, and cash advance.

## Checklist
- [x] Reset request form state cleanly when opening each request type
- [x] Limit Materials dropdown options to items linked to the selected scope
- [x] Add clear empty-state guidance when no scope-linked materials are available
- [x] Create a dedicated Tools & Equipments request form layout with tool-specific fields and labels
- [x] Preserve request list add/remove behavior for both Materials and Tools & Equipments
- [x] Validate the Site Personnel request modal behavior and page integrity

## Acceptance
Materials requests only show materials tied to the chosen scope in the item dropdown.
When creating a Tools & Equipments request, the dialog presents fields appropriate to tools and equipment requests.