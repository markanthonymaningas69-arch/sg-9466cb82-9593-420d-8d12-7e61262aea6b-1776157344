---
title: Linked materials dropdown
status: done
priority: high
type: feature
tags:
  - bom
  - materials
  - catalog
created_by: agent
created_at: 2026-04-22
position: 27
---

## Notes
Update the BOM material picker so it uses the material catalog engine links for the current scope of work. The dropdown should only show materials linked to that scope. After a material is added to the current scope, it must no longer appear in the dropdown for the next material entry. Keep the existing manual custom-material option unless the current implementation proves otherwise.

## Checklist
- [x] Inspect how the BOM page loads master catalog materials and how scope links are stored
- [x] Update the material dropdown to only show catalog materials linked to the active scope
- [x] Exclude materials already added under the same scope from subsequent dropdown options
- [x] Apply the same filtering for both add and edit flows where appropriate
- [x] Validate the BOM page still compiles cleanly

## Acceptance
In a scope, the material dropdown only lists catalog materials linked to that scope.
After adding a linked material to a scope, that same material no longer appears in the add-material dropdown for that scope.