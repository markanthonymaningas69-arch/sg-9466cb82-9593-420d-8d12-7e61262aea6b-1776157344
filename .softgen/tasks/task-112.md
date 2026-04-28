---
title: Manpower Catalog tab
status: in_progress
priority: high
type: feature
tags:
  - project-manager
  - manpower
  - supabase
created_by: agent
created_at: 2026-04-28T15:11:46Z
position: 112
---

## Notes
Add a new Project Manager tab named Manpower Catalog that is fully independent from the HR module. It must store project-level position records with position name, standard rate, unit, and optional description. This catalog will be the only source for team composition position options and default rates.

## Checklist
- [ ] Review the current Project Manager / Task Configuration structure and identify where to add the new Manpower Catalog tab
- [ ] Create Supabase storage for project-level manpower catalog entries with project association, rate, unit, and optional description
- [ ] Build add, edit, and delete flows for manpower catalog positions
- [ ] Ensure the catalog does not import, fetch, or depend on HR module data
- [ ] Expose catalog data through a dedicated project-level service for reuse by team composition

## Acceptance
The Project Manager area includes a Manpower Catalog tab where users can manage project-specific positions and rates.
Team Composition position options come only from this catalog, not from HR data.