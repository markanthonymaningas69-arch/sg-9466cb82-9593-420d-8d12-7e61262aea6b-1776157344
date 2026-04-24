---
title: Material request form cleanup
status: in_progress
priority: medium
type: bug
tags:
  - material-request
  - forms
  - ui
created_by: agent
created_at: 2026-04-24
position: 49
---

## Notes
Fix the material request form where the date input and the requested by input appear twice.

The goal is to keep only one correct instance of each field in the material request flow and preserve the rest of the form behavior.

Current evidence from search:
- `src/pages/site-personnel.tsx` contains the Material Request flow
- `Requested By` appears multiple times there, including around lines 3131 and 3186
- earlier task history also notes that the Requested By field was supposed to be removed from the Material Request modal

## Checklist
- [x] Find the material request form component or page that renders the duplicated fields
- [ ] Remove the extra date input and extra requested by input without changing the intended form submission behavior
- [ ] Validate the material request form renders each field only once

## Acceptance
The material request form shows only one date input.
The material request form shows only one requested by input.
Submitting or viewing the form still works as before.