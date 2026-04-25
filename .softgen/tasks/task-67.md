---
title: Approval center layout refinement
status: done
priority: high
type: feature
tags:
  - approval-center
  - ui
  - layout
  - audit-trail
created_by: agent
created_at: 2026-04-25
position: 67
---

## Notes
Refine the Approval Center page for denser review workflows.

Requested updates:
- reduce font sizes across the main approval center UI where appropriate
- apply distinct colors to each approval tab such as Purchasing, Accounting, and other module tabs
- maximize vertical space so more content is visible without excessive empty spacing
- move the audit trail into the View button flow instead of showing it separately in the current layout

Keep this scoped to the Approval Center page and any directly related approval-center UI components it uses.

## Checklist
- [x] Inspect the current Approval Center page structure, tabs, spacing, and view dialog flow
- [x] Reduce typography scale in the approval center UI while keeping readability
- [x] Add per-tab color treatment for approval modules
- [x] Compress spacing and layout to maximize vertical content space
- [x] Move audit trail content into the View action flow
- [x] Validate lint, type, CSS, and runtime behavior

## Acceptance
The Approval Center shows a denser layout with smaller, readable typography.
Each module tab has its own clear color treatment.
Audit trail details appear from the View action instead of occupying separate page space.