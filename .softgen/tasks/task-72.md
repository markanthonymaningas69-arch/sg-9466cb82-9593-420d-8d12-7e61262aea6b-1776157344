---
title: Site Personnel Deliveries Tab
status: done
priority: high
type: feature
tags: [site-personnel, deliveries, ui]
created_by: agent
created_at: 2026-04-26T13:46:33 UTC
position: 72
---

## Notes
Add a dedicated Deliveries tab to the Site Personnel module and restore the delivery management flow that existed before the module became corrupted. Reuse the current clean module structure and align with the existing Supabase-backed site personnel surfaces.

## Checklist
- [x] Review the current Site Personnel page and related tab components to confirm the existing tab structure and data flow
- [x] Reintroduce a dedicated Deliveries tab entry in the Site Personnel navigation
- [x] Implement or reconnect the Deliveries tab component with the previous delivery management behavior using the current deliveries table
- [x] Ensure project filtering, create/delete actions, and delivery listing work from the Site Personnel module
- [x] Validate the Site Personnel page builds cleanly with the restored Deliveries tab

## Acceptance
A Deliveries tab is visible in Site Personnel and can be opened from the tab bar.
Users can view and manage delivery records for the selected project from that tab.
The Site Personnel module builds and loads without type or runtime errors after the tab is restored.