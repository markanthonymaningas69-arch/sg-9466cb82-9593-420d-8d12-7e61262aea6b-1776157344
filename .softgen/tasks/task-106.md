---
title: Site deliveries compact table
status: done
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
- [x] Inspect the current Site Purchase and Deliveries tables and receiving controls
- [x] Reduce font sizes, row height, card padding, and vertical spacing
- [x] Prevent wrapping in headers and cells with ellipsis for long delivery and receipt values
- [x] Add hover tooltips for truncated supplier, item, receipt, and notes fields
- [x] Keep horizontal scroll, sticky headers, and aligned compact status and action controls
- [x] Validate the compact deliveries and receiving layout in the Site Personnel module

## Acceptance
The deliveries tab fits more operational data on screen without wrapping.
Voucher, supplier, and item fields truncate cleanly and show full text on hover.
Receiving and delivery actions remain usable in the compact layout.