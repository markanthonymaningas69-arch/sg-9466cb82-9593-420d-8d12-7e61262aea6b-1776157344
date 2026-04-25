---
title: Human resource staff labels and rate catalog switch
status: done
priority: high
type: feature
tags:
  - personnel
  - hr
  - ui
  - catalog
created_by: agent
created_at: 2026-04-25
position: 64
---

## Notes
Update the Human Resource tab so "Office Staff" is renamed to "Admin Staff" anywhere it appears in the relevant personnel UI.

Also update the Manpower Rate Catalog so users can switch the catalog view between Admin Staff and Construction Workers from the same area, instead of being limited to one staff type.

Keep the change scoped to the Human Resource tab and the manpower rate catalog behavior and labels.

## Checklist
- [x] Inspect the Human Resource tab and manpower rate catalog implementation
- [x] Rename Office Staff to Admin Staff in the relevant HR UI
- [x] Add a clear switch or filter so the Manpower Rate Catalog can toggle between Admin Staff and Construction Workers
- [x] Ensure the catalog data and empty states reflect the selected staff type
- [x] Validate lint, type, CSS, and runtime behavior

## Acceptance
The Human Resource tab shows Admin Staff instead of Office Staff.
Users can switch the Manpower Rate Catalog between Admin Staff and Construction Workers.
The catalog content updates correctly for the selected staff type.