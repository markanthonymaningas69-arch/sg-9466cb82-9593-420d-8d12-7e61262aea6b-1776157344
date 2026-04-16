---
title: Create Public Landing Page and Legal Pages
status: done
priority: high
type: feature
tags: ["frontend", "landing-page", "design"]
---

## Notes
- User requested a public-facing main page (landing page) for the system.
- Needs to include: About, Privacy Statement, Terms and Conditions.
- Must feature a "Start Now" button leading to the login page (`/auth/login`).
- Needs a premium design aesthetic (construction/accounting theme).

## Checklist
- [x] Review current `index.tsx` to see if it needs relocating (if it's currently the app dashboard).
- [x] Create or update `src/pages/index.tsx` to be the new public landing page with Hero and "Start Now" button.
- [x] Create `src/pages/about.tsx`.
- [x] Create `src/pages/privacy.tsx`.
- [x] Create `src/pages/terms.tsx`.
- [x] Ensure all public pages have a unified public layout (header with logo, footer with links).