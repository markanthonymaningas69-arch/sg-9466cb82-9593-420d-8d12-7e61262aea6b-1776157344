---
title: Central approval routing and audit trail
status: in_progress
priority: urgent
type: feature
tags:
  - approvals
  - database
  - audit
  - workflow
created_by: agent
created_at: 2026-04-24
position: 57
---

## Notes
Centralize all approval-related requests from Site Personnel, Purchasing, Accounting, HR, and Project Manager into a single approval data flow.

Every approval request must support Pending, Approved, Rejected, and Returned for revision statuses. All approval actions must be logged with actor, timestamp, comments, and status change history.

New requests created in source modules should flow into Approval Center automatically instead of relying only on local module-specific approval handling.

Implementation in progress:
- centralized approval tables and audit trail storage were added
- initial source request tables and module flows were inspected
- approval source status sync in `src/services/approvalCenterService.ts` was updated to use explicit typed table branches so validation can continue cleanly
- shared approval request creation is now available in `src/services/approvalCenterService.ts`
- Site Personnel requests and cash advances now create Approval Center records at submission time
- Purchasing approvals now create Approval Center records when submitted to GM
- HR leave requests now create Approval Center records at submission time
- downstream side effects for approved site requests and cash advances now run from Approval Center instead of local module approval buttons

## Checklist
- [x] Inspect existing request tables and source module submission flows
- [x] Add or update database structures for centralized approval records and action history
- [x] Build shared approval services for create, list, update, and history logging
- [x] Connect source modules so new approval-worthy requests create Approval Center entries
- [x] Ensure requester-facing status updates stay in sync with Approval Center actions
- [ ] Validate the centralized approval lifecycle end to end

## Acceptance
Requests from the listed modules appear in one centralized approval system.
Approval actions are stored with full audit history.
Status changes stay synchronized between source modules and Approval Center.