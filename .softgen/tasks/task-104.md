---
title: Site receiving confirmation flow
status: in_progress
priority: high
type: feature
tags: [site-personnel, receiving, deliveries]
created_by: agent
created_at: 2026-04-26T19:45:30 UTC
position: 104
---

## Notes
Add the final receiving step in Site Personnel so ready-for-delivery requests can be confirmed on site. Only items with an approved voucher number and ready-for-delivery lifecycle should allow Mark as Received, and the receiving action must preserve traceability back to the site request, purchase, and voucher.

## Checklist
- [ ] Inspect the Site Purchase and Deliveries surface and current receiving actions
- [ ] Load ready-for-delivery records from request execution tracking
- [ ] Show voucher number, voucher status, and lifecycle state in the site receiving list
- [ ] Add Mark as Received action with received by, timestamp, actual quantity, and remarks
- [ ] Restrict receiving to items with voucher number and ready-for-delivery status
- [ ] Trigger notifications back to Purchasing and Accounting after receiving
- [ ] Validate the final receiving flow end to end

## Acceptance
Site Personnel can see ready-for-delivery records with linked voucher information.
Mark as Received is only available for eligible records.
The final received state is linked back to the original request, purchasing, and voucher records.