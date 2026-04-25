---
title: Site personnel warehouse label and request action
status: done
priority: high
type: feature
tags:
  - site-personnel
  - ui
  - dark-mode
  - requests
created_by: agent
created_at: 2026-04-25
position: 66
---

## Notes
Update the Site Personnel module in two areas.

First, rename the visible "Warehouse" label to "Site Warehouse" in the relevant Site Personnel section. Also make sure the related body card and its text remain clearly visible in dark mode.

Second, add a visible "Submit Request" button inside the Tools & Equipment request form so users can submit the form directly from that section.

Keep the work scoped to the Site Personnel module and the specific request form it already uses.

## Checklist
- [x] Inspect the Site Personnel module sections for Warehouse and Tools & Equipment request form
- [x] Rename Warehouse to Site Warehouse in the relevant Site Personnel UI
- [x] Fix the affected body card and text contrast so the section is readable in dark mode
- [x] Add a Submit Request button to the Tools & Equipment request form
- [x] Validate lint, type, CSS, and runtime behavior

## Acceptance
The Site Personnel module shows Site Warehouse instead of Warehouse in the updated section.
The affected card and text remain readable in dark mode.
Users can submit the Tools & Equipment request form with a visible Submit Request button.