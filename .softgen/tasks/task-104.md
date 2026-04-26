---
title: Site receiving confirmation flow
status: todo
priority: high
type: feature
tags: [site-personnel, receiving, deliveries]
created_by: agent
created_at: 2026-04-26T19:41:54 UTC
position: 104
---

## Notes
Add final receiving confirmation in Site Personnel so delivered requests can be marked as received only after voucher approval and delivery readiness. The receiving flow must record who received the items, when they were received, optional actual quantity, and remarks, while updating the linked workflow and notifications.

## Checklist
- [ ] Inspect the current Site Purchase and Deliveries surface and related warehouse or delivery records
- [ ] Detect linked approved requests that are ready for delivery
- [ ] Show Mark as Received only when voucher number exists and the workflow is ready for delivery
- [ ] Record received by, received at, actual quantity, and remarks
- [ ] Update final workflow status to received and notify Purchasing and Accounting
- [ ] Show received status clearly in the site receiving list

## Acceptance
Site Personnel can mark eligible delivered requests as received from the Site Purchase and Deliveries area.
Receiving is blocked until voucher approval and readiness conditions are met.
The final received state is linked back to the original request, purchasing, and voucher records.