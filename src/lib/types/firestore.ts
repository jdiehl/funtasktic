/**
 * Firestore document types
 * Shared type definitions for all collections
 */

export type UserStatus = 'waiting_for_email_verification' | 'active' | 'waiting_for_deletion';
export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';
export type RecurrenceMode = 'fixed_schedule' | 'interval_after_completion';
export type MemberRole = 'admin';

export interface User {
  displayName: string;
  avatarUrl?: string;
  email: string;
  createdAt: FirebaseFirestore.Timestamp;
  lastSeenAt: FirebaseFirestore.Timestamp;
  status: UserStatus;
}

export interface List {
  name: string;
  timezone: string;
  ownerId: string;
  createdAt: FirebaseFirestore.Timestamp;
  isArchived: boolean;
  isPersonal: boolean;
}

export interface Task {
  title: string;
  description?: string;
  pointsPerCompletion: number;
  isActive: boolean;
  isArchived: boolean;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
  recurrenceMode: RecurrenceMode;
  recurrenceConfig: FixedScheduleConfig | IntervalAfterCompletionConfig;
  nextDueAt: FirebaseFirestore.Timestamp;
  lastCompletedAt?: FirebaseFirestore.Timestamp;
}

export interface FixedScheduleConfig {
  type: 'fixed_schedule';
  dayOfWeek?: number[]; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  weekOfMonth?: number; // for monthly on specific week
}

export interface IntervalAfterCompletionConfig {
  type: 'interval_after_completion';
  intervalValue: number;
  intervalUnit: 'days' | 'weeks' | 'months';
}

export interface TaskCompletion {
  taskId: string;
  completedByUserId: string;
  completedAt: FirebaseFirestore.Timestamp;
  pointsAwarded: number;
  taskTitle: string;
  taskPointsAtCompletion: number;
}

export interface ListMember {
  role: MemberRole;
  joinedAt: FirebaseFirestore.Timestamp;
  displayName: string;
  avatarUrl?: string;
}

export interface Leaderboard {
  listId: string;
  periodKey: string; // format: yymm
  updatedAt: FirebaseFirestore.Timestamp;
  users: LeaderboardEntry[];
}

export interface LeaderboardEntry {
  userId: string;
  pointsTotal: number;
}

export interface Invitation {
  listId: string;
  listName: string;
  invitedByUserId: string;
  invitedByDisplayName: string;
  status: InvitationStatus;
  createdAt: FirebaseFirestore.Timestamp;
  expiresAt: FirebaseFirestore.Timestamp;
}

export interface ListRef {
  listId: string;
  name: string;
  timezone: string;
  role: MemberRole;
  joinedAt: FirebaseFirestore.Timestamp;
}
