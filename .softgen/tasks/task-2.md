---
title: Fix labor cost calculation logic
status: in_progress
priority: high
type: bug
tags: ["accounting", "labor", "calculation"]
created_by: agent
created_at: 2026-04-10T19:08:00Z
position: 2
---

## Notes
The user reports that labor cost calculations are not working correctly. Investigate the accounting and labor-related pages and services to find where labor costs are computed, then fix the calculation and ensure values persist and display correctly in the UI.

## Checklist
- [x] Search the codebase for labor-related calculation logic and identify the primary computation paths
- [ ] Review accounting and labor-related pages and services to understand current formulas and data flow
- [ ] Fix incorrect labor cost calculation logic and ensure values update as inputs change
- [ ] Verify that labor cost values persist correctly via Supabase where applicable
- [ ] Manually test main labor-related flows in the accounting UI to confirm expected totals
- [ ] Run a project error check and finalize the bugfix