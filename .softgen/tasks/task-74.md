---
title: Master Engine Catalog item form cleanup
status: in_progress
priority: high
type: feature
tags: [catalog, materials, form]
created_by: agent
created_at: 2026-04-26T14:00:19 UTC
position: 74
---

## Notes
Update the Master Engine Catalog materials and tools surface so the add item flow no longer asks for a category field, and rename the visible "Materials and Tools" label to "Materials". Keep the existing add-item workflow intact aside from those user-facing changes.

## Checklist
- [ ] Review the current Master Engine Catalog page and locate the add-item form and the "Materials and Tools" label
- [ ] Remove the category field from the add-item form while preserving submit behavior
- [ ] Rename visible "Materials and Tools" copy to "Materials" on the affected surface
- [ ] Validate the catalog page still builds cleanly after the form update

## Acceptance
The Add New Item form no longer shows a category field.
The relevant catalog tab/label reads "Materials" instead of "Materials and Tools".
The catalog page continues to load and submit without build errors.