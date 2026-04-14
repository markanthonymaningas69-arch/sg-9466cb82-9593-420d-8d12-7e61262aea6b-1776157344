---
title: "Create Onboarding Page & Simplify Registration"
status: todo
priority: high
type: feature
tags: ["auth", "onboarding"]
---

## Notes
- The current registration page includes an invite code field. We want to move this to a dedicated initial onboarding page.
- Users who just signed up will have a null or 'pending' module.
- The onboarding page will offer two distinct paths: "Create a Company" (becomes GM) or "Join a Company" (inputs invite code to get a specific module assignment).

## Checklist
- [ ] Update `src/pages/auth/register.tsx`: Remove the invite code field to simplify sign up.
- [ ] Create `src/pages/onboarding.tsx`:
  - [ ] Add a split-screen or two-card layout for "Create Company" vs "Join Company".
  - [ ] Implement "Join Company" logic: Validate invite code against `invite_codes` table, update profile's `assigned_module`, and mark code as used.
  - [ ] Implement "Create Company" logic: Update profile's `assigned_module` to 'GM', and optionally initialize basic company settings.
  - [ ] Redirect to `/` after successful onboarding.