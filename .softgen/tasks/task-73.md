---
title: Site Personnel Warehouse Tab
status: done
priority: high
type: feature
tags: [site-personnel, warehouse, ui]
created_by: agent
created_at: 2026-04-26T13:49:20 UTC
position: 73
---

## Notes
Bring back the Site Warehouse section inside the Site Personnel module without removing the restored Deliveries flow. Reuse the current clean module structure and existing Supabase-backed warehouse component behavior where possible.

## Checklist
- [x] Review the current Site Personnel tab layout and the existing Site Warehouse component behavior
- [x] Add a dedicated Site Warehouse tab entry in the Site Personnel navigation
- [x] Wire the Site Warehouse tab to the warehouse surface while preserving the Deliveries tab
- [x] Verify project filtering still works for both warehouse-related surfaces
- [x] Validate the Site Personnel module builds cleanly after the warehouse tab is restored

## Acceptance
The Site Personnel module shows both Deliveries and Site Warehouse tabs.
Users can open the Site Warehouse tab and use the warehouse workflow for the selected project.
The Site Personnel page loads without build or type errors after the warehouse tab is restored.