---
title: Site personnel request button fix
status: in_progress
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
Investigate why the Site Personnel Request action buttons for Material Request, Tools & Equipments, Petty Cash, and Cash Advance are no longer working. The issue persisted after the responsive header layout change, so the fix must verify the actual button click path, dialog state updates, and any disabling logic such as `isLocked`.

## Checklist
- [ ] Inspect the Request section button JSX and click handlers
- [ ] Verify whether `isLocked` is preventing interaction
- [ ] Inspect `openRequestDialog` and related dialog state
- [ ] Apply the smallest fix that restores button interaction
- [ ] Validate the Request buttons open the correct dialog again

## Acceptance
Each Request action button opens its corresponding dialog.
The Request header still fits within the card without blocking interactions.