---
title: Material usage log fields
status: in_progress
priority: high
type: feature
tags: [site-personnel, material-usage, form]
created_by: agent
created_at: 2026-04-26T15:23:26 UTC
position: 77
---

## Notes
Update the Site Personnel material usage log so the form only includes these fields: Scope of Works, Material name, Quantity Used, Unit, Usage date, and Notes optional. Remove extra inputs from the user-facing form and align the save/list flow if it still depends on removed fields.

## Checklist
- [ ] Review the current Material Usage tab component and related site service methods for the existing form and persistence flow
- [ ] Reduce the log form to Scope of Works, Material name, Quantity Used, Unit, Usage date, and Notes optional
- [ ] Update save and render logic so the simplified field set works cleanly in the Material Usage flow
- [ ] Validate the updated Material Usage surface after the changes