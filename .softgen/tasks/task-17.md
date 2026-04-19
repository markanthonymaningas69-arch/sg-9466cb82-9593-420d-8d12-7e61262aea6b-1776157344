---
title: Read-Only Mode - Accounting
status: done
priority: high
type: feature
tags: [accounting, read-only]
created_by: agent
created_at: 2026-04-19T12:45:00Z
position: 17
---
## Notes
Enforce `isLocked` read-only state on all accounting tabs.

## Checklist
- [x] Disable "New Entry" and edit/delete actions in JournalOpEx.tsx
- [x] Disable "Send to Vouchers" in PayrollTab.tsx
- [x] Disable "Issue Voucher", approve, issue, and archive actions in VouchersTab.tsx
- [x] Disable Cash Advance log/edit/approve in LiquidationsTab.tsx

## Acceptance
- Expired users can view accounting records but cannot create or approve financial documents.