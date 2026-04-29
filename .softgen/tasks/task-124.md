---
title: Approval Center workflow connection fix
status: in_progress
priority: urgent
type: bug
tags:
  - approval-center
  - purchasing
  - site-personnel
  - workflow
  - supabase
created_by: agent
created_at: 2026-04-29 17:28:17 UTC
position: 124
---

## Notes
Investigate and fix the broken workflow connection between Site Personnel, Approval Center, and Purchasing. The current issue is that requests are not moving cleanly through the approval workflow, and Purchasing is not staying connected to the originating Site Personnel request state. Verify the data flow, routing logic, linked record IDs, and status transitions before applying a targeted fix.

## Checklist
- [x] Inspect the current Site Personnel request submission flow and Approval Center request creation
- [x] Inspect the Approval Center routing logic for Purchasing-bound requests
- [x] Inspect the Purchasing inbox/unified list loading logic and linked request matching
- [x] Verify the database schema and required linking fields for site requests, approval requests, purchases, and workflow tracking
- [x] Fix the broken connection points between Site Personnel, Approval Center, and Purchasing
- [ ] Validate the workflow from submitted request to Approval Center to Purchasing

## Acceptance
A Site Personnel request appears in Approval Center with the correct routing and linked IDs.
Approved Purchasing-bound requests appear correctly in Purchasing with the expected source linkage.
The workflow keeps the originating request and Purchasing record connected across status updates.