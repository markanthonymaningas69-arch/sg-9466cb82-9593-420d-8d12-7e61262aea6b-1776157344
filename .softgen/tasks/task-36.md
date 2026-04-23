---
title: Site request form refinement
status: in_progress
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
Refine the Site Personnel request dialog behavior. For the Materials request type, the item dropdown should only show materials linked to the selected scope of work. For the Tools & Equipments request type, provide a more appropriate modal form instead of reusing the materials-oriented fields unchanged.

Keep the existing request submission flow working for the other request types and preserve the current request dialog behavior unless required for the new scoped filtering and tools form experience.

## Checklist
- [ ] Review the current Site Request dialog logic for request type handling and item dropdown sourcing
- [ ] Restrict the Materials item dropdown to materials linked to the selected scope of work
- [ ] Add an appropriate Tools & Equipments request form layout in the dialog
- [ ] Preserve Petty Cash and Cash Advance form behavior
- [ ] Validate the request dialog opens and submits without errors

## Acceptance
When creating a Materials request, the item dropdown only shows materials tied to the selected scope.
When creating a Tools & Equipments request, the dialog presents fields appropriate to tools and equipment requests.