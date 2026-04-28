---
title: Manpower Catalog tab
status: done
priority: high
type: feature
tags:
  - project-manager
  - manpower
  - supabase
created_by: agent
created_at: 2026-04-28 15:35:34 UTC
position: 112
---

## Notes
Add a project-level Manpower Catalog inside Project Manager so each project maintains its own manpower positions and rates without any HR dependency. This tab must support create, edit, and delete actions and become the single source of default positions and rates for Team Composition inside task configuration.

## Checklist
- [x] Add a project-scoped manpower catalog data source and service independent from HR
- [x] Add a Manpower Catalog workspace tab inside Project Manager
- [x] Support add, edit, and delete for position name, standard rate, unit, and optional description
- [x] Ensure Team Composition dropdown options come only from this catalog

## Acceptance
Users can open Project Manager and manage manpower positions in a dedicated Manpower Catalog tab.
Catalog positions and rates are stored per project and are not pulled from HR.