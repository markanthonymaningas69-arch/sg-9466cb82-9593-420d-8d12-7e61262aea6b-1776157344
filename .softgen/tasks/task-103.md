---
title: Approval and accounting voucher routing
status: done
priority: high
type: feature
tags: [approval-center, accounting, vouchers]
created_by: agent
created_at: 2026-04-26T19:45:30 UTC
position: 103
---

## Notes
Route voucher requests back through Approval Center as a second approval step and then into Accounting after approval. Accounting should surface the voucher-linked requests and show the linked voucher context clearly for payment preparation.

## Checklist
- [x] Inspect current Approval Center and Accounting voucher-related surfaces
- [x] Ensure voucher requests appear in Approval Center as a second-step approval item
- [x] Generate voucher number and create the accounting-facing voucher record after approval
- [x] Show linked voucher request context in Accounting
- [x] Trigger notifications for voucher approval and accounting handoff
- [x] Validate the second approval and accounting routing flow

## Acceptance
Voucher requests return to Approval Center for approval.
Approved voucher requests generate a voucher number and route into Accounting.
Accounting receives linked voucher-approved requests with visible status and references.