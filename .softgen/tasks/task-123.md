---
title: Site request history delete action
status: in_progress
priority: high
type: feature
tags:
  - site-personnel
  - requests
  - recycle-bin
created_by: agent
created_at: 2026-04-28 18:17:36 UTC
position: 123
---

## Notes
Add a delete action to the request history area inside the Site Personnel requests tab. The action should fit the existing row/card controls, remove the request from the active history view, and follow the established Site Personnel deletion pattern so users can recover it if the tab already uses the recycle bin flow.

## Checklist
- [ ] Inspect the request history rendering and current request actions in the Site Personnel requests tab
- [ ] Add a visible delete control for each history item in the request history view
- [ ] Connect the delete action to the correct service flow and refresh the history list after deletion
- [ ] Keep the delete affordance consistent with the existing Site Personnel action styling and messaging

## Acceptance
Users can delete an item directly from the request history tab in Site Personnel.

After deletion, the request disappears from the active history list.

The action uses the module’s existing delete/archive behavior instead of leaving stale data on screen.