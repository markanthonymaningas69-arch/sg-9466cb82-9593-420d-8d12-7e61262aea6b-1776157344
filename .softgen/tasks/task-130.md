---
title: Cash Advances Tab in Accounting Module
status: in_progress
priority: high
type: feature
tags: [accounting, cash-advances, personnel]
created_by: agent
created_at: 2026-10-04T15:01:06Z
position: 1
---

## Notes
Add a Cash Advances management tab to the accounting module where users can:
- Record new cash advances given to workers/staff
- Track deduction history for each worker
- View complete cash advance history per worker
- See outstanding balances

## Checklist
- [x] Create cash_advances table with worker_id, amount, date, status, deduction tracking
- [x] Create cash_advance_deductions table for tracking repayment history
- [x] Create CashAdvancesTab.tsx component with advance entry form and history view
- [x] Add cashAdvancesService.ts for database operations
- [x] Update accounting.tsx to include the new Cash Advances tab
- [x] Add RLS policies for cash advances tables

## Acceptance
- Users can record new cash advances for any worker
- Each worker's advance history shows all advances and deductions
- Outstanding balance calculation is accurate
- Deductions can be recorded against advances