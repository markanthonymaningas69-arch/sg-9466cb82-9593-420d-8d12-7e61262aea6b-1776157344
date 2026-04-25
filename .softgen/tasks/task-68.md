---
title: HR personnel rate-linked add form
status: in_progress
priority: high
type: feature
tags:
  - hr
  - personnel
  - rates
  - form
created_by: agent
created_at: 2026-04-25
position: 68
---

## Notes
Add manpower rate support to the HR Staff add-personnel flow.

The add form should include a manpower rate input or selector that is linked to the existing HR Rates tab data, so users can assign the correct rate while creating personnel records. Reuse the existing rate catalog source instead of duplicating manual rate data.

Keep the work scoped to the HR personnel page, the existing rates catalog UI/data source, and any directly related services.

## Checklist
- [ ] Inspect the HR personnel add form and the existing HR Rates tab data flow
- [ ] Add manpower rate selection or auto-fill to the HR add-personnel form
- [ ] Link the selected rate to the existing HR Rates tab source of truth
- [ ] Save and display the linked manpower rate in the HR personnel flow
- [ ] Validate lint, type, and runtime behavior

## Acceptance
The HR add-personnel flow includes manpower rate support.
The available rates come from the existing HR Rates tab data.
Selecting or entering a manpower rate in HR uses the same rate source without duplicating separate catalogs.