---
title: Approval and accounting voucher routing
status: todo
priority: high
type: feature
tags: [approval-center, accounting, vouchers, notifications]
created_by: agent
created_at: 2026-04-26T19:41:54 UTC
position: 103
---

## Notes
Add the second approval step for voucher requests in Approval Center and route approved voucher requests into Accounting. Accounting must receive voucher-approved work with enough linked detail to prepare disbursement and keep notifications and audit history in sync.

## Checklist
- [ ] Inspect the current Approval Center actions and Accounting incoming request surfaces
- [ ] Route voucher requests into Approval Center with Voucher Request tagging
- [ ] Generate voucher numbers on approval and send approved voucher records into Accounting
- [ ] Update notifications for new voucher approvals and accounting handoff
- [ ] Show voucher-related lifecycle state and linked references in Approval Center and Accounting
- [ ] Validate the approval-to-accounting handoff

## Acceptance
Voucher requests appear in Approval Center as a second approval step.
Approving a voucher generates a voucher number and routes the item to Accounting.
Accounting receives linked voucher-approved requests with visible status and references.