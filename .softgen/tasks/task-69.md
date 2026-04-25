---
title: Site personnel rate-linked manpower form
status: todo
priority: high
type: feature
tags:
  - site-personnel
  - manpower
  - rates
  - form
created_by: agent
created_at: 2026-04-25
position: 69
---

## Notes
Add manpower rate support to the Site Personnel add-manpower flow.

The add form should include a manpower rate input or selector that is linked to the existing HR Rates tab data, so Site Personnel users can use the same approved rate source when adding manpower.

Keep the work scoped to the Site Personnel page, the shared rate catalog source, and any directly related services.

## Checklist
- [ ] Inspect the Site Personnel add-manpower flow and its current saved fields
- [ ] Add manpower rate selection or auto-fill to the Site Personnel add-manpower form
- [ ] Reuse the HR Rates tab source for available rates
- [ ] Save and display the linked manpower rate in the Site Personnel manpower flow
- [ ] Validate lint, type, and runtime behavior

## Acceptance
The Site Personnel add-manpower flow includes manpower rate support.
The available manpower rates come from the HR Rates tab source.
Both HR and Site Personnel use the same rate source for manpower rates.