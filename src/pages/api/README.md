/**
 * API routes implemented in this folder.
 *
 * Auth/session
 * - POST /api/auth/session
 * - DELETE /api/auth/session
 *
 * Users
 * - POST /api/users/bootstrap
 * - PATCH /api/users/[userId]
 *
 * Lists
 * - POST /api/lists
 * - PATCH /api/lists/[listId]
 * - DELETE /api/lists/[listId]
 *
 * Tasks
 * - POST /api/lists/[listId]/tasks
 * - PATCH /api/lists/[listId]/tasks/[taskId]
 * - DELETE /api/lists/[listId]/tasks/[taskId]
 *
 * Completions
 * - POST /api/lists/[listId]/completions
 * - DELETE /api/lists/[listId]/completions/[completionId]
 *
 * Invitations
 * - POST /api/lists/[listId]/invitations
 * - DELETE /api/lists/[listId]/invitations/[token]
 * - GET /api/invitations/[token]
 * - POST /api/invitations/[token]/accept
 *
 * Membership
 * - DELETE /api/lists/[listId]/members/[userId]
 */
