---
title: Site personnel request button fix
status: done
priority: high
type: bug
tags:
  - site-personnel
  - requests
  - ui
created_by: agent
created_at: 2026-04-23
position: 35
---

## Notes
The Site Personnel Request action buttons stopped working because the shared request dialog was no longer mounted in the page. The button handlers still called `openRequestDialog`, but no dialog existed with `requestDialogOpen`, so clicks produced no visible result.

Restore the request dialog for Material Request, Tools & Equipments, Petty Cash, and Cash Advance, keeping the header layout inside the card and preserving the existing request submission handlers.

## Checklist
- [x] Verify the four request buttons still call the dialog open handler
- [x] Confirm the request dialog mount is missing from the page
- [x] Restore the request dialog and reconnect it to `requestDialogOpen`
- [x] Preserve request form handling for materials, tools, petty cash, and cash advance
- [x] Validate the buttons open the correct dialog again

## Acceptance
Clicking any of the four Site Personnel request buttons opens the corresponding dialog.
The Request header still fits within the card without blocking interactions.