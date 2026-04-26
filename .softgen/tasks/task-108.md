---
title: Site Personnel compact tab rail
status: in_progress
priority: urgent
type: feature
tags: [site-personnel, tabs, layout, compact-ui]
created_by: agent
created_at: 2026-04-26T20:04:19 UTC
position: 108
---

## Notes
Refine the Site Personnel tab layout so all tabs stay inside the body card area, remain in one horizontal row, and never wrap onto a second line. The tab strip should use compact sizing, horizontal scrolling, and clear active-state styling without overflowing the card.

## Checklist
- [ ] Inspect the current Site Personnel tab shell and body card structure
- [ ] Move or align the tab strip so it sits cleanly inside the card area
- [ ] Keep tabs in one row with nowrap and horizontal scrolling
- [ ] Reduce tab height, padding, and font size for a compact ERP-style rail
- [ ] Prevent label wrapping and tighten long labels where needed
- [ ] Validate the Site Personnel tab rail on smaller widths without overflow outside the card

## Acceptance
The Site Personnel tabs stay inside the card container.
All tabs remain on a single row with horizontal scrolling instead of wrapping.
The active tab is clearly highlighted in a compact layout.