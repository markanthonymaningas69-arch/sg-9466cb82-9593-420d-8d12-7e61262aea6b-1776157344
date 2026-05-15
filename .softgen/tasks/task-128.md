---
title: Cross-module approval center workflow
status: in_progress
priority: urgent
type: bug
tags: [approval-center, workflow, site-personnel, purchasing, accounting, human-resource]
created_by: agent
created_at: 2026-05-15T13:23:52 UTC
position: 128
---

## Notes
Audit and fix the Approval Center workflow so requests originating from Site Personnel, Purchasing, Accounting, and Human Resource are consistently created, routed, visible, and linked back to their source records. The flow should be clean and functional, with each module handing off requests into Approval Center using the same lifecycle expectations.

## Checklist
- [ ] Inspect how Site Personnel creates and links approval requests
- [ ] Inspect how Purchasing creates and links approval requests
- [ ] Inspect how Accounting creates and links approval requests
- [ ] Inspect how Human Resource creates and links approval requests
- [ ] Inspect Approval Center request ingestion, filtering, and routing logic
- [ ] Fix missing or inconsistent request creation/linking across the four modules
- [ ] Validate that module requests appear in Approval Center and retain source linkage

## Acceptance
Requests from Site Personnel, Purchasing, Accounting, and Human Resource appear in Approval Center.
Approval items remain linked to their source records and module flow after submission.