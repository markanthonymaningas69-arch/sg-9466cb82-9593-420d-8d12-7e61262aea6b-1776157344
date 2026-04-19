---
title: Read-Only Mode - Supply Chain
status: done
priority: high
type: feature
tags: [warehouse, purchasing, read-only]
created_by: agent
created_at: 2026-04-19T12:45:00Z
position: 18
---
## Notes
Enforce `isLocked` read-only state on Purchasing and Warehouse.

## Checklist
- [x] Disable PO creation and supplier registration in purchasing.tsx
- [x] Disable PO submit-to-GM and approve/reject flows
- [x] Disable Add Item, Deploy, Edit, and Archive actions in warehouse.tsx

## Acceptance
- Expired users can track inventory and POs but cannot execute transactions.