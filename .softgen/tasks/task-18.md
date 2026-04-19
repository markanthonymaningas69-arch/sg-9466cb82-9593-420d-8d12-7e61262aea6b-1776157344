---
title: Read-Only Mode - Supply Chain
status: todo
priority: high
type: feature
tags: [warehouse, purchasing, read-only]
created_by: agent
created_at: 2026-04-19T12:45:00Z
position: 18
---
## Notes
Enforce `isLocked` read-only state on Warehouse and Purchasing.

## Checklist
- [ ] Disable "Create PO", "Approve", "Reject" in purchasing.tsx
- [ ] Disable "Receive Delivery", "Add Item", "Deploy" in warehouse.tsx

## Acceptance
- Expired users can track inventory and POs but cannot execute transactions.