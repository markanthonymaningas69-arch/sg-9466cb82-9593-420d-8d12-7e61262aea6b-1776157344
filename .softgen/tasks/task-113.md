---
title: Team Composition parameters
status: todo
priority: urgent
type: feature
tags:
  - project-manager
  - team-composition
  - manpower
created_by: agent
created_at: 2026-04-28T15:11:46Z
position: 113
---

## Notes
Enhance Project Manager → Task Configuration → Parameters → Team Composition so users can define multiple team types, assign members from the project manpower catalog, override rates when needed, and set Number of Teams for repeated identical crews. The composition is defined once per team type and multiplied by team count.

## Checklist
- [ ] Inspect the existing Team Composition UI and current parameter data structure
- [ ] Add team-level fields for team name and number of teams with validation for values greater than or equal to 1
- [ ] Add member rows inside each team with position dropdown sourced only from Manpower Catalog and auto-filled rate
- [ ] Support manual rate override per member while keeping catalog default as the starting value
- [ ] Add computed summaries per team for total members and total labor cost multiplied by number of teams
- [ ] Enforce validation: at least one member per team, valid catalog position, rate greater than 0, number of teams greater than or equal to 1

## Acceptance
Users can create a team type once, set the number of identical teams, and see total manpower and cost update automatically.
Each member position is selected from the project Manpower Catalog and starts with its default rate.