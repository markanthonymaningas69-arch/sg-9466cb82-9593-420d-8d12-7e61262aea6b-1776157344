---
title: Create Public Pricing Page
status: in_progress
priority: high
type: feature
tags: [ui, pricing, public]
---

## Notes
- Name: THEA-X Construction Accounting System
- Create a public pricing page (`/pricing`).
- Extract pricing tiers from `src/pages/subscription.tsx` into a shared config file so updates reflect immediately on both pages.
- Update `PublicLayout` and `index.tsx` to reflect the system name.

## Checklist
- [ ] Extract subscription tiers from `subscription.tsx` to `src/config/pricing.ts`.
- [ ] Update `subscription.tsx` to map over the shared pricing config.
- [ ] Create `src/pages/pricing.tsx` using `PublicLayout` and the shared config.
- [ ] Update `PublicLayout.tsx` to include "THEA-X Construction Accounting System" and a link to Pricing.
- [ ] Update `index.tsx` text to use "THEA-X Construction Accounting System".