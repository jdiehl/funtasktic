# Funtasktic Project Brief (Agentic Development)

## 1. Product Summary
Funtasktic helps private households and friend groups remember recurring chores and complete them in a fun, competitive way. The product promotes fair task distribution through points and transparent completion history.

## 2. Product Vision
Help people consistently complete recurring chores by making progress visible, playful, and collaborative.

## 3. Target Users
- Private individuals and households with recurring chores.
- Smartphone-literate users who want low-friction task tracking.
- Small groups (friends/family/roommates) that share responsibilities.

## 4. Core User Activities (MVP)
1. Create recurring tasks with configurable recurrence behavior.
2. Organize tasks into lists.
3. Invite others to collaborate on a list.
4. Mark task progress/completion and earn points.
5. View leaderboard/ranking against others in the same list.

## 5. Scope
### In Scope (MVP this week)
- Web app only.
- Google and Apple authentication.
- List-based collaboration and access control.
- Recurring task engine with two recurrence modes.
- Completion events and point tracking.
- List-level leaderboard.

### Out of Scope (MVP)
- One-off todo tasks.
- Business/enterprise workflows.
- Calendar integration.
- External system integrations.
- Social feed/community features.
- Mobile apps (planned after MVP).
- Notifications (explicitly excluded from MVP).

## 6. Functional Requirements
### 6.1 Lists
- Users can create lists.
- A default personal list is auto-created for every new user, which cannot be shared.
- Users can invite others to lists via shareable invite links; invitations expire after 7 days.
- Invitations are single-use share links and can be forwarded.
- List members can see and revoke all pending invitations for their list.
- All list members have full management rights for that list and associated tasks.
- Users must not access lists/tasks they are not a member of.

### 6.2 Tasks
- Tasks always belong to exactly one list.
- Task fields include at least: title, description (optional), points_per_completion (user-defined), recurrence_mode, recurrence_config, active status.
- No assignment model for MVP: any list member can complete any task.

### 6.3 Recurrence
- Support two recurrence modes:
  - Fixed schedule mode (for example weekly on selected weekdays).
  - Interval-after-completion mode (for example every X days/weeks/months after last completion).
- List timezone is the canonical scheduling timezone.
- UI displays task times converted to each user local timezone.

### 6.4 Completion and Points
- Users can mark task completion.
- Each completion grants the task configured base points.
- No streak bonuses or multipliers in MVP.
- Leaderboard ranks members by total points in the selected list.

### 6.5 Membership Removal Rule
- If a member is removed from a list, their historical completions are not shown in the current leaderboard context.

## 7. Data Model (Firestore Document Model, Optimized)
Use Firestore as a document store with selective denormalization to optimize read-heavy screens (task list, due tasks, leaderboard) while preserving list-based access control.

### 7.1 Top-Level Collections
- `users/{userId}`
  - `displayName`
  - `avatarUrl`
  - `email`
  - `createdAt`
  - `lastSeenAt`
  - `status` (`waiting_for_email_verification` | `active` | `waiting_for_deletion`)

- `lists/{listId}`
  - `name`
  - `timezone`
  - `ownerId`
  - `createdAt`
  - `isArchived`
  - `isPersonal`

- `invitations/{token}` (token is document ID, cryptographically random)
  - `listId`
  - `listName` (denormalized for invite landing page)
  - `invitedByUserId`
  - `invitedByDisplayName` (denormalized)
  - `status` (`pending` | `accepted` | `revoked` | `expired`)
  - `createdAt`
  - `expiresAt`

### 7.2 List Sub-Collections
- `lists/{listId}/tasks/{taskId}`
  - `title`
  - `description`
  - `pointsPerCompletion`
  - `isActive`
  - `isArchived`
  - `createdAt`
  - `updatedAt`
  - `recurrenceMode` (`fixed_schedule` | `interval_after_completion`)
  - `recurrenceConfig` (mode-specific object)
  - `nextDueAt`
  - `lastCompletedAt`

- `lists/{listId}/members/{userId}`
  - `role` (`admin`)
  - `joinedAt`
  - `displayName`, `avatarUrl` (denormalized from user)

- `lists/{listId}/taskCompletions/{completionId}`
  - `taskId`
  - `completedByUserId`
  - `completedAt`
  - `pointsAwarded`
  - `taskTitle`, `taskPointsAtCompletion` (immutable snapshot from task at completion time)

- `lists/{listId}/leaderboards/{periodKey}` (user format `yymm`)
  - `listId`
  - `periodKey` (use format `yymm`)
  - `updatedAt`
  - `users` (sorted array of `{ userId, pointsTotal }`)

### 7.3 User Sub-Collections
- `users/{userId}/listRefs/{listId}` (list cache)
  - `listId`
  - `name`
  - `timezone`
  - `role`
  - `joinedAt`

### 7.4 Query and Index Optimization
- Due tasks view:
  - query `lists/{listId}/tasks` with filters: `isActive == true`, `nextDueAt <= now`, order by `nextDueAt asc`
  - composite index: `(isActive, nextDueAt)`

- Task history per list:
  - query `lists/{listId}/taskCompletions` order by `completedAt desc`
  - composite index: `(completedAt desc)`

- Member list:
  - query `lists/{listId}/members` ordered by `displayName`

- Pending invitations per list:
  - member read path (direct Firestore): query `invitations` with filters: `listId == X`, `status == pending`
  - composite index: `(listId, status)`
  
### 7.5 Write Patterns and Consistency
- All writes are executed server-side via API routes using Firebase Admin SDK.
- Completion write transaction (single atomic Firestore transaction, scoped to list):
  1. create `lists/{listId}/taskCompletions/{completionId}` with immutable point snapshot
  2. update `lists/{listId}/tasks/{taskId}` with `lastCompletedAt` and recalculated `nextDueAt`
  3. update `lists/{listId}/leaderboards/{periodKey}` aggregate (periodKey is current `yymm`)

- Keep points immutable at completion time via `taskPointsAtCompletion` and `pointsAwarded`.
- All writes are scoped to a single list, simplifying transactional safety and authorization.
- Leaderboard documents are created/updated monthly; queries should be for current period unless historical views are needed post-MVP.

## 8. Architecture (MVP)
### 8.1 Style
- Modular monolith.

### 8.2 Stack
- Frontend: Next.js (React + TypeScript)
- Backend API: Next.js APIs
- Primary platform: Firebase (Auth, Firestore, Analytics, Crashlytics).
- Hosting: Next.js on Vercel.

### 8.3 Data Access Strategy
Clients have read-only access to Firestore. All user-initiated writes go through Next.js API routes using the Firebase Admin SDK, which bypasses Security Rules and enforces authorization and business logic server-side.

**Client SDK (read-only):**
- All reads: lists, tasks, members, completions, leaderboard, invitations.
- Real-time subscriptions (`onSnapshot`) for task list and leaderboard views.
- No direct client writes to Firestore.
- Invitation list management views use direct Firestore reads for list members.
- Invite-link landing page uses `GET /api/invitations/[token]` for safe public preview.

**Firebase Cloud Function Triggers (automatic, no client call needed):**
- `Auth onCreate` — Fires on first sign-in (Google/Apple); creates `users/{userId}` document from Firebase Auth profile (`displayName`, `email`, `avatarUrl` from `photoURL`), sets `status: active`, and creates the default personal list via Firebase Admin SDK.

**API Routes (writes via Firebase Admin SDK, plus safe invitation token read):**
| Method | Route | Description |
|--------|-------|-----------|
| `PATCH` | `pages/api/users/[userId]/` | Update display name or avatar |
| `POST` | `pages/api/lists/` | Create a list |
| `PATCH` | `pages/api/lists/[listId]/` | Update list name, timezone |
| `DELETE` | `pages/api/lists/[listId]/` | Archive a list by setting `isArchived: true`; blocked if `isPersonal` |
| `POST` | `pages/api/lists/[listId]/tasks/` | Create task; validates recurrence config and computes `nextDueAt` |
| `PATCH` | `pages/api/lists/[listId]/tasks/[taskId]/` | Update task fields; recomputes `nextDueAt` if recurrence or active status changes |
| `DELETE` | `pages/api/lists/[listId]/tasks/[taskId]/` | Archive a task |
| `POST` | `pages/api/lists/[listId]/completions/` | Record completion; recomputes `nextDueAt` and updates leaderboard atomically |
| `DELETE` | `pages/api/lists/[listId]/completions/[completionId]/` | Revert own completion only; deletes completion doc, deducts points from leaderboard, recomputes `nextDueAt` atomically |
| `POST` | `pages/api/lists/[listId]/invitations/` | Create shareable invitation token and write `invitations/{token}` doc |
| `DELETE` | `pages/api/lists/[listId]/invitations/[token]/` | Revoke pending invitation (`status: revoked`) |
| `GET` | `pages/api/invitations/[token]` | Public (no auth); returns only safe fields: `listName`, `invitedByDisplayName`, `status`, `expiresAt` |
| `POST` | `pages/api/invitations/[token]/accept` | Authenticated; validates token, creates membership doc, marks invitation `accepted` |
| `DELETE` | `pages/api/lists/[listId]/members/[userId]/` | Remove a member from a list |
| `POST` | `pages/api/auth/session` | Create Firebase Auth session cookie |
| `DELETE` | `pages/api/auth/session` | Destroy session cookie (sign-out) |

### 8.4 Frontend Structure (Next.js + React)
- `pages/auth/` — Sign-in, sign-up, auth flows.
- `pages/lists/` — List browser, create list flow.
- `pages/lists/[listId]/` — List detail, task management, completions.
- `pages/lists/[listId]/leaderboard` — List leaderboard view.
- `pages/invite/[token]/` — Invite landing page; calls token preview API then accepts invite after sign-in.
- `components/` — Shared UI components (task cards, forms, leaderboards).
- `hooks/` — Firebase auth context, Firestore subscription hooks (useList, useTasks, useLeaderboard).
- `lib/recurrence/` — Recurrence calculation logic (also used server-side in API routes).
- `lib/firestore/` — Firestore client utilities, typed collection helpers.

### 8.5 Security and Access
- Firebase Security Rules restrict all client access to **read-only**. No client writes are permitted directly to Firestore.
- Security Rules enforce membership-based read access: clients may only read lists, tasks, completions, leaderboards, and invitation docs where they are a member of the invitation's `listId`.
- All writes use Firebase Admin SDK in API routes, which bypasses Security Rules — authorization is enforced in API route handlers instead.
- Every API route verifies the Firebase Auth ID token from the `Authorization` header before processing any request.
- Membership check is performed server-side in every list-scoped API route before executing any write.
- Invitation APIs enforce additional constraints: token status is `pending` and token is not expired.
- Public invitation GET endpoint returns a safe subset only (`listName`, `invitedByDisplayName`, `status`, `expiresAt`) and never exposes internal identifiers.
- Firestore invitation document reads are allowed only for list members; non-members must use token preview API.
- Input validation and schema enforcement on all API route request bodies.
- Deny-by-default: any unrecognized route or missing auth returns 401/403.

### 8.6 Invitation Read Contract
- Member read path (authenticated list members): direct Firestore query for pending invitations in their list.
- Public token read path: `GET /api/invitations/[token]` for invite-link landing and preview.
- Safe response shape for token read: `listName`, `invitedByDisplayName`, `status`, `expiresAt`.
- Never return internal identifiers (for example `listId`, `invitedByUserId`) in public token responses.
- Token status behavior for public token read:
  - `pending`: return safe preview payload.
  - `accepted`, `revoked`, `expired`: return status-only payload or `410 Gone` (implementation choice, must be consistent).
  - unknown token: `404 Not Found`.

## 9. UX and Product Principles
- Playful and polished visual identity aligned with the Funtasktic name.
- Dead easy first-run flow: sign in -> default list exists -> create first recurring task.
- Keep primary actions one tap/click away.
- Make fairness transparent with completion history and leaderboard visibility.

## 10. Non-Functional Requirements
- High usability and low cognitive load.
- Responsive web experience (mobile web and desktop).
- GDPR-aligned data handling (consent language, deletion/export hooks planned early).
- Observability baseline: error logging, structured API logs.

## 11. Testing Strategy (MVP)
- Unit tests for recurrence calculations (`lib/recurrence/__tests__/`).
- Firestore Security Rules tests (Firebase emulator): verify read-only client access and membership-based read restrictions.
- API route tests for all write endpoints (Jest + mock Firebase Admin SDK): authorization checks, input validation, business logic correctness.
- Invitation lifecycle tests: create, safe preview-by-token response shape, revoke, accept, single-use enforcement, and expiry handling.
- Frontend component tests (Jest + React Testing Library) for task forms, leaderboard.
- End-to-end smoke test: auth → list creation → task creation → completion → leaderboard update.

## 12. Agent Action Sequence Plan (MVP)
### 12.1 Sequential Foundation (run in order)
1. Run **Funtasktic Product Brief Agent** to confirm final MVP boundaries, acceptance criteria, and out-of-scope guardrails.
2. Run **Funtasktic Solution Architect** to finalize Next.js + Firebase architecture decisions, route contracts, and data model constraints.
3. Run **Funtasktic Release Execution Agent** to produce the implementation sequence, dependency map, and go/no-go checkpoints.

### 12.2 Bootstrap Build Sequence (run in order)
1. Run **Funtasktic Backend API Agent** to initialize backend foundations: auth/session routes, API route scaffolding, authorization middleware, Firebase Admin integration.
2. Run **Funtasktic Frontend React Agent** to implement app shell and core reads/writes against the approved API contracts.

### 12.3 Parallel Feature Execution (after foundation)
1. **Funtasktic Backend API Agent** and **Funtasktic Frontend React Agent** run in parallel per vertical slice:
  - Slice A: list creation and membership visibility.
  - Slice B: task CRUD and recurrence behavior.
  - Slice C: completions and leaderboard updates.
  - Slice D: invitation create/revoke/preview/accept flow.
2. **Funtasktic QA Testing Agent** runs in parallel with each slice to add and validate unit/integration coverage before merge.

### 12.4 Sequential Hardening and Release
1. Run **Funtasktic QA Testing Agent** for final regression sweep (authz, recurrence, leaderboard correctness, invitation lifecycle).
2. Run **Funtasktic Release Execution Agent** to verify release readiness checklist and scope-cut decisions.
3. Run **Funtasktic Product Brief Agent** only if scope decisions changed and the brief must be updated.

## 13. Definition of Done (MVP)
- All five core user activities work end-to-end in production web app.
- Access control rules are enforced and tested.
- Recurrence behaves correctly in both supported modes.
- Leaderboard updates correctly from completion data.
- Architecture and module boundaries support post-MVP mobile clients.

## 14. Risks and Mitigations
- Recurrence complexity risk: isolate and heavily unit-test recurrence engine.
- Fairness disputes risk: keep completion audit trail immutable.
- Scope risk (one-week MVP): lock out-of-scope items and avoid notification/social/calendar expansion.
- Timezone confusion risk: centralize conversion utilities and test edge cases around day boundaries.

## 15. Open Decisions for Next Iteration
- Add push notifications
- Add mobile apps (iOS and Android)
- Investigate and add additional capabilities
