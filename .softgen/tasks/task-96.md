---
title: Approval Center request details panel
status: done
priority: urgent
type: feature
tags: [approval-center, request-details, audit-trail]
created_by: agent
created_at: 2026-04-26T19:25:15 UTC
position: 96
---

## Notes
Enhance the Approval Center request list with a dedicated View Details action that opens a full Request Details panel. The panel must show general info, linked request details, summary, comments, audit trail access, and pending-only approval actions. Keep approved and rejected requests read-only.

## Checklist
- [x] Inspect the current Approval Center list, detail card, and dialog flow
- [x] Add a View Details button on the right side of each request row
- [x] Replace or expand the current detail modal into a structured Request Details panel
- [x] Show general info, request details, summary, comments, and audit trail access
- [x] Keep action buttons visible only for pending requests
- [x] Require comment for Reject and Return with Comment
- [x] Keep approved and rejected requests in read-only mode

## Acceptance
Every Approval Center row has a View Details action.
The Request Details panel shows full context and audit trail access.
Pending requests can be approved, rejected, or returned from the panel.