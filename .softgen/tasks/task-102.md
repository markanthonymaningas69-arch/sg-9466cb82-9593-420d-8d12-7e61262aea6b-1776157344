---
title: Purchasing voucher workflow
status: todo
priority: high
type: feature
tags: [purchasing, vouchers, incoming-requests]
created_by: agent
created_at: 2026-04-26T19:41:54 UTC
position: 102
---

## Notes
Enhance Purchasing so approved material and tool requests can be processed into purchasing records and then converted into voucher requests. Purchasing must show voucher number, voucher status, a clear action to create a voucher request, and readiness for release or delivery after voucher approval.

## Checklist
- [ ] Inspect the current Incoming Requests and purchase record flows in Purchasing
- [ ] Add Create Voucher Request action for eligible purchasing items
- [ ] Generate linked voucher request data with project, supplier, amount, and description
- [ ] Show voucher number and voucher status in Purchasing after approval
- [ ] Add View Voucher access and ready-for-delivery state in Purchasing
- [ ] Keep compact list behavior intact while adding the new workflow controls

## Acceptance
Purchasing users can create a voucher request from an approved purchasing item.
Approved voucher data appears back in Purchasing with voucher number and status.
Purchasing items move into a ready-for-delivery state after voucher approval.