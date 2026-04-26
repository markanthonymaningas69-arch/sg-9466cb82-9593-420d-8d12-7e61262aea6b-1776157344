---
title: Approval lifecycle workflow
status: in_progress
priority: urgent
type: feature
tags: [approval-center, workflow, statuses, routing]
created_by: agent
created_at: 2026-04-26T19:02:02 UTC
position: 93
---

## Notes
Extend the current request approval implementation into a complete lifecycle workflow. Site Personnel requests must move through Approval Center, retain project/requester/history links, and continue into the correct execution module after approval. Keep the existing request forms intact while adding the missing workflow states and routing logic.

## Checklist
- [x] Inspect current request, approval, and routing data structures across Site Personnel, Approval Center, Purchasing, and Accounting
- [x] Add lifecycle statuses and target-module routing data needed for end-to-end tracking
- [x] Update Approval Center actions to move requests through approval and execution states with audit history
- [x] Ensure approved requests are routed to Purchasing or Accounting based on request type
- [x] Keep project, requester, approval history, and target module links attached to each request
- [ ] Validate the request lifecycle from creation to routed execution

## Acceptance
A Site Personnel request moves from pending approval into the correct destination module after approval.
Approval Center shows the correct lifecycle status and preserves audit history plus project/request links.