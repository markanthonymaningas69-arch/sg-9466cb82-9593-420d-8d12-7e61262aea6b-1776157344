---
title: Purchasing unified request list
status: done
priority: urgent
type: feature
tags: [purchasing, consolidation, workflow]
created_by: agent
created_at: 2026-04-29T04:11:59 UTC
position: 112
---

## Notes
Remove the Incoming Requests tab and merge all purchasing-related records (incoming approval requests, purchase orders, voucher-linked items) into a single Purchase Orders list. Group records by Purchase Number, Order Number, or Voucher Number and allow users to view grouped details via a View action. Actions (Price & Submit, Archive, Delete) must follow conditional rules based on status and approval state.

## Checklist
- [x] Remove Incoming Requests tab and related state/effects from Purchasing
- [x] Load incoming approval requests alongside purchase orders
- [x] Merge approval requests and purchases into a unified data structure
- [x] Group records by Purchase Number, Order Number, or Voucher Number
- [x] Add View action to show grouped item details in a dialog
- [x] Implement conditional action visibility:
  - Price & Submit: only for pending PR- items
  - Archive: only if request has approval results (approved/rejected)
  - Delete: only if status is pending
- [x] Wire Delete to remove from both purchases and approval_requests tables
- [x] Wire Archive to only affect purchases table (not approval_requests)
- [x] Validate the unified list with grouped view and conditional actions

## Acceptance
Purchasing shows a single unified list with incoming requests and purchase orders merged.
Records are grouped by Purchase/Order/Voucher number with a View action to see details.
Delete removes pending items from both Purchasing and Approval Center.
Archive removes approved/rejected items from Purchasing only (Approval Center keeps history).
Price & Submit, Archive, and Delete actions follow the specified conditional rules.