---
title: Site deliveries compact table
status: todo
priority: high
type: feature
tags: [site-personnel, deliveries, compact-ui]
created_by: agent
created_at: 2026-04-26T19:57:11 UTC
position: 106
---

## Notes
Apply the same compact, no-wrap table treatment to the Site Purchase and Deliveries tab. Keep receiving actions intact, but reduce container padding, tighten the table, show voucher-related fields clearly, and ensure long text stays single-line with tooltips.

## Checklist
- [ ] Inspect the Site Purchase and Deliveries layout, ready-for-receiving table, and receipt history tables
- [ ] Reduce font sizes, spacing, and row height throughout the deliveries surface
- [ ] Prevent wrapping in headers and cells with ellipsis for long values
- [ ] Add tooltips for truncated values and keep status badges compact
- [ ] Make action buttons smaller and preserve receiving actions
- [ ] Keep tables horizontally scrollable with sticky headers where practical

## Acceptance
The deliveries tab fits more operational data on screen without wrapping.
Voucher, supplier, and item fields truncate cleanly and show full text on hover.
Receiving and delivery actions remain usable in the compact layout.