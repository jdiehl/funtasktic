# Funtasktic Workspace Instructions

## Mission
Build a playful, low-friction chore collaboration app where recurring tasks are completed fairly across friends/family groups.

## Product Constraints
- Prioritize recurring chores, list collaboration, completions, and leaderboard.
- Respect out-of-scope items for MVP: one-off todos, notifications, calendar, social feed, enterprise features.
- Maintain list-based access control on all task and completion operations.

## Technical Direction
- Frontend: React + TypeScript.
- Backend: Next.js API routes (modular monolith style).
- Platform: Firebase-first for auth and data.
- Keep clear boundaries: auth, lists, membership, tasks, recurrence, completions, leaderboard.

## Code Quality Expectations
- Add tests for business-critical logic (recurrence, authz guards, scoring).
- Keep changes small and composable.
- Prefer explicit data contracts and validated DTOs.
- Do not introduce features that are not in MVP scope unless explicitly requested.

## UX Direction
- Playful but clear UI language.
- Fast first-run onboarding and obvious primary actions.
- Mobile web responsiveness is required even in web-only MVP.

## Delivery Heuristics
- Solve vertical slices end-to-end.
- Implement simplest working version first, then harden with tests.
- Surface assumptions and unresolved product decisions in markdown docs.
