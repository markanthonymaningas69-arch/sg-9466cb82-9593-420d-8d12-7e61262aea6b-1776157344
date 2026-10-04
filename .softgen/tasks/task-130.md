---
title: Cash Advances Tab in Accounting Module
status: done
priority: high
type: feature
tags: [accounting, cash-advances, personnel, payroll]
created_by: agent
created_at: 2026-10-04T15:01:06Z
position: 1
---

## Notes
Created a comprehensive cash advances tracking system in the accounting module where users can:
- Record cash advances given to construction workers and staff
- Track deduction history for each worker
- Auto-fill project assignments from HR data
- Link payroll deductions to cash advance repayments
- View outstanding balances and summary statistics

The system automatically updates cash advance balances when deductions are recorded through payroll processing.

## Checklist
- [x] Create cash_advances table with worker_id, amount, date, status, deduction tracking
- [x] Create cash_advance_deductions table for tracking repayment history
- [x] Create CashAdvancesTab.tsx component with advance entry form and history view
- [x] Add cashAdvancesService.ts for database operations
- [x] Update accounting.tsx to include the new Cash Advances tab
- [x] Add RLS policies for cash advances tables
- [x] Fix personnel dropdown to use 'role' field instead of 'position'
- [x] Add auto-fill for project based on HR assignment
- [x] Integrate with PayrollTab - add deduction columns (amount, type, date)
- [x] Link payroll deductions to cash advances tab
- [x] Add createCashAdvanceDeduction method to service

## Acceptance
- ✅ Users can record new cash advances for workers with auto-filled project assignments
- ✅ Each worker's cash advance history with deductions is visible and tracked
- ✅ Payroll generation includes deduction tracking with cash advance integration
- ✅ Cash advance balances automatically update when payroll deductions are processed