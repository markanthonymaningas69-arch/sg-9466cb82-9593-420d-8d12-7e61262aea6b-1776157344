---
title: Team Composition parameters
status: in_progress
priority: urgent
type: feature
tags:
  - project-manager
  - manpower
  - task-configuration
created_by: agent
created_at: 2026-04-28 15:35:34 UTC
position: 113
---

## Notes
Replace the old team composition flow in Project Manager → Task Configuration → Parameters with a clean project-based manpower setup. Users should be able to add team types, add members inside each team, select positions from the project Manpower Catalog only, auto-fill rates, override rates manually, and set the number of identical teams for each composition.

## Checklist
- [x] Replace legacy team template flow with editable team composition blocks
- [x] Allow users to add teams and add members inside each team
- [x] Populate member positions from the project Manpower Catalog only
- [x] Auto-fill member rates from the selected catalog position with manual override support
- [x] Add Number of Teams per team setup for multiple identical teams
- [x] Show automatic summaries for total manpower and total labor cost
- [x] Enforce validation for member count, valid position, positive rate, and number of teams
- [ ] Tighten Team Composition field widths and responsive layout so inputs fit inside the panel body
- [ ] Add a direct Manpower Catalog link/action from the Team Composition setup area

## Acceptance
A user can define one team composition once and apply it to multiple identical teams.
Each team summary shows total members and labor cost updating automatically as members or team count change.