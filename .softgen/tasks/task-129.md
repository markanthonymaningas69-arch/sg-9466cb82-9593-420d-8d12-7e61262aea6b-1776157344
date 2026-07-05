---
title: Project Billing Module
status: in_progress
priority: high
type: feature
tags: [accounting, billing, invoicing]
created_by: agent
created_at: 2026-07-05T11:39:15Z
position: 129
---

## Notes
Create a comprehensive Project Billing tab in the Accounting module that tracks client invoicing, payment collection, and billing status. Data must integrate with Dashboard for financial analysis (billing vs costs for profit tracking).

## Checklist
- [ ] Create database table for project billing records (billing_id, project_id, billing_number, billing_date, description, amount, status, payment_received, payment_date, balance, notes)
- [ ] Create ProjectBillingTab component with billing records table
- [ ] Add "Create Billing" dialog with fields: Billing #, Date, Description, Amount, Status
- [ ] Add "Record Payment" function to update payment received and status
- [ ] Display billing summary cards: Total Billed, Total Paid, Outstanding Balance
- [ ] Add billing status filter (All, Draft, Sent, Paid, Overdue)
- [ ] Add Edit and Delete actions for billing records
- [ ] Integrate billing data into Dashboard project details
- [ ] Calculate and display: Total Billed, Total Paid, Outstanding, Billing vs Cost analysis

## Acceptance
- Users can create and manage billing records with status tracking
- Payment collection updates billing status and balance automatically
- Dashboard shows billing amounts alongside cost data for profit analysis