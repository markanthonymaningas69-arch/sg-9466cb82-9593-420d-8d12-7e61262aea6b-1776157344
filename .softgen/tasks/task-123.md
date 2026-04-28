---
title: Site request history delete action
status: done
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
- [x] Inspect the Site Personnel request history table and existing site request data flow
- [x] Add a delete action in each request history row without disrupting the existing review action
- [x] Wire deletion to the module's request archive/delete flow so the record leaves the active table state
- [x] Validate the request history table still renders correctly with the new action cell

## Acceptance
Users can delete an item directly from the request history tab in Site Personnel.

After deletion, the request disappears from the active history list.

The action uses the module’s existing delete/archive behavior instead of leaving stale data on screen.