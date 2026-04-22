---
title: Update BOM Service for AI Material Processing
status: done
priority: high
type: feature
tags: [bom, service, data]
created_by: agent
created_at: 2026-04-22T18:45:00Z
position: 25
---

## Notes
Integrate the AI output with the Master Materials Catalog and the BOM tables.

## Checklist
- [ ] Add `generateMaterialsWithAI` function in `src/services/bomService.ts`
- [ ] Call the new AI endpoint
- [ ] Fetch existing `warehouse_materials`
- [ ] Match AI output against catalog; insert missing materials into `warehouse_materials`
- [ ] Insert matched/new materials into `bom_materials` for the specific scope
- [ ] Handle duplicate merging/updating

## Acceptance
- AI materials are successfully saved to the database.
- Missing materials are added to the Master Catalog.