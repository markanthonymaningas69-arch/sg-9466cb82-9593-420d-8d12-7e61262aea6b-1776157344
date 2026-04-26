---
title: Site request approval routing
status: in_progress
priority: high
type: feature
tags: [site-personnel, requests, approval-center]
created_by: agent
created_at: 2026-04-26T18:48:00 UTC
position: 91
---

## Notes
Link Site Personnel Requests into the Approval Center so submitted requests appear in the approval workflow instead of living only in the request list. Reuse the current approval data model and current site request records where possible. Keep the existing request form intact.

## Checklist
- [x] Inspect the current Site Requests save flow and the Approval Center data model
- [x] Route new Site Personnel requests into the Approval Center with enough metadata to review them
- [x] Show linked request details clearly in the Approval Center UI
- [x] Keep current Site Requests behavior working after approval routing is added
- [ ] Validate the new request-to-approval flow end to end

## Acceptance
A newly submitted Site Personnel request appears in the Approval Center.
Approvers can identify the request type and source from the Approval Center entry.