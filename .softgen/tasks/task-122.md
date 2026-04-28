---
title: Site Personnel tab deletion hooks
status: todo
priority: high
type: feature
tags:
  - site-personnel
  - recycle-bin
  - tabs
created_by: agent
created_at: 2026-04-28 17:58:41 UTC
position: 122
---

## Notes
Update linked Site Personnel tabs so their delete actions send records to the recycle bin flow. Existing user workflows should stay intact, but deletion should become reversible unless the user explicitly chooses permanent delete from the recycle bin.

## Checklist
- [ ] Identify Site Personnel tabs with delete actions and switch them to recycle-bin aware deletion behavior
- [ ] Update linked tab refresh flows so restored items reappear in their original tab without stale state
- [ ] Ensure permanently deleted items are removed from module state and no longer return on reload
- [ ] Validate that tab-to-bin linking works consistently for the Site Personnel surfaces covered by the feature

## Acceptance
Deleting a record from a linked Site Personnel tab moves it to the recycle bin.

Restoring a record returns it to the original tab data set.

Permanent delete removes the record from the recycle bin and the source tab permanently.