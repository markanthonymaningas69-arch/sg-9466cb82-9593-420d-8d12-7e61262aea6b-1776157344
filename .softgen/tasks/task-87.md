---
title: Site purchase multi-material receipt flow
status: done
priority: high
type: feature
tags: [site-purchase, warehouse, receipts, mobile]
created_by: agent
created_at: 2026-04-26T18:25:09 UTC
position: 87
---

## Notes
Update the Record Site Purchase flow so one receipt number can contain one or more material entries. Keep the current fields and overall form structure. Only change the form logic and related save/display behavior needed to support multiple materials under the same receipt number.

## Checklist
- [x] Locate the current Record Site Purchase form and storage flow
- [x] Preserve the existing field set and labels
- [x] Add logic so one receipt number can include multiple material lines
- [x] Keep save behavior aligned with the current purchase records structure
- [x] Validate the updated purchase flow does not break existing usage

## Acceptance
A user can record multiple materials under one receipt number without losing the existing fields.
The Record Site Purchase form still looks familiar and uses the same field set.