---
title: Read-Only Mode - Accounting
status: todo
priority: high
type: feature
tags: [accounting, read-only]
created_by: agent
created_at: 2026-04-19T12:45:00Z
position: 17
---
## Notes
Enforce `isLocked` read-only state across the Accounting module.

## Checklist
- [ ] Disable adding entries in JournalOpEx.tsx
- [ ] Disable generating payroll in PayrollTab.tsx
- [ ] Disable issuing vouchers in VouchersTab.tsx
- [ ] Disable approving/rejecting in LiquidationsTab.tsx and RequestsViewTab.tsx

## Acceptance
- Expired users can view accounting records but cannot create or approve financial documents.