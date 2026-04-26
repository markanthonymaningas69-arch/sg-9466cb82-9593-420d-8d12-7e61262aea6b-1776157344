---
title: Request and voucher workflow backbone
status: in_progress
priority: urgent
type: feature
tags: [workflow, approval-center, vouchers, traceability]
created_by: agent
created_at: 2026-04-26T19:41:54 UTC
position: 101
---

## Notes
Extend the current request workflow into a complete end-to-end chain from Site Personnel request submission through Approval Center, Purchasing, voucher approval, Accounting, and final receiving. The workflow must preserve traceability between the originating site request, purchasing record, voucher request, voucher number, and receiving confirmation. Approval history and comments must remain attached at each step.

## Checklist
- [x] Inspect the current request, approval, purchasing, accounting, and site receiving data flow
- [x] Add workflow fields and linking fields needed for request → purchase → voucher → receiving traceability
- [x] Support voucher request records that can be routed back into Approval Center as a second approval step
- [ ] Track lifecycle states: pending approval, in purchasing, voucher pending approval, voucher approved, ready for delivery, received
- [ ] Preserve audit trail entries, comments, users, timestamps, and linked module references
- [ ] Validate the linked workflow end to end

## Acceptance
A site request can be traced from initial submission to final receiving.
Voucher approval creates linked voucher workflow data without breaking the original request history.
The workflow retains project, requester, approval, voucher, and receiving references.