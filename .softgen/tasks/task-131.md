---
title: PWA installable shell
status: in_progress
priority: high
type: feature
tags: [pwa, mobile, install]
created_by: agent
created_at: 2026-10-09T17:25:00Z
position: 132
---

## Notes
Make the existing Next.js app installable on phones (PWA). No separate codebase — staff open the site and use "Add to Home Screen" / "Install App". Modern Chrome (108+) only needs HTTPS + manifest + 192/512 icons for installability; skip a service worker with offline caching initially to avoid stale-cache problems in the dev preview. Offline caching can be a follow-up task if requested.

## Checklist
- [ ] Inspect _document.tsx, SEO.tsx, globals.css for existing head structure and brand colors
- [ ] Create public/manifest.webmanifest (name, short_name, start_url, display: standalone, icons, theme/background colors matching brand)
- [ ] Generate app icon (512px) and maskable variant via generate_image
- [ ] Add manifest link, theme-color, apple-mobile-web-app meta tags to document head
- [ ] Validate with check_for_errors

## Acceptance
- Chrome (Android/desktop) shows Install App prompt and installs with correct icon/name
- Installed app opens standalone (no browser chrome) on the app's start page