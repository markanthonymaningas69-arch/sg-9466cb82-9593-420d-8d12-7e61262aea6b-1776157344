---
title: Approval Center module
status: in_progress
priority: urgent
type: feature
tags:
  - approvals
  - dashboard
  - workflow
  - ui
created_by: agent
created_at: 2026-04-24
position: 56
---

## Notes
Create a new Approval Center module that centralizes approval workflows across the system.

The module must include tabs for All Requests, Purchasing, Accounting, HR, Site Personnel, and Project Manager. Each tab should show relevant requests with source module, request type, requested by, date and time, related project, current status, and available actions.

Approval Center should replace scattered module-level approval handling and become the single place where GM reviews and acts on requests.

## Checklist
- [ ] Add Approval Center to the shared module navigation
- [ ] Create the Approval Center page with tab-based category views
- [ ] Show unified request cards or rows with module, type, requester, timestamp, related project, and status
- [ ] Add action controls for Approve, Reject, and Return for revision with comments
- [ ] Show audit history and latest status changes in the request detail area
- [ ] Validate the Approval Center UI and navigation flow

## Acceptance
A new Approval Center module is visible in the main system navigation.
GM can open one page and review approval requests grouped by the required tabs.
Each request shows enough detail to review and act on it without returning to the source module.