---
title: Request and voucher workflow backbone
status: done
priority: urgent
type: feature
tags: [workflow, approvals, vouchers, receiving]
created_by: agent
created_at: 2026-04-26T19:45:30 UTC
position: 101
---

## Notes
Build the core end-to-end workflow that links Site Personnel requests, Approval Center approvals, Purchasing execution, voucher requests, Accounting handoff, and final site receiving. The system must preserve traceability across every stage and keep lifecycle states and audit history consistent.

## Checklist
- [x] Inspect the current request, approval, purchasing, accounting, and site receiving data flow
- [x] Add workflow fields and linking fields needed for request → purchase → voucher → receiving traceability
- [x] Support voucher request records that can be routed back into Approval Center as a second approval step
- [x] Track lifecycle states: pending approval, in purchasing, voucher pending approval, voucher approved, ready for delivery, received
- [x] Preserve audit trail entries, comments, users, timestamps, and linked module references
- [x] Validate the linked workflow end to end

## Acceptance
A site request can move through approval, purchasing, voucher approval, accounting, and receiving without losing linked references or status history.
The workflow retains project, requester, approval, voucher, and receiving references.