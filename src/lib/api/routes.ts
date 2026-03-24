import type { NextApiRequest, NextApiResponse } from 'next';
import { Timestamp } from 'firebase-admin/firestore';
import {
  calculateNextDueFixedSchedule,
  calculateNextDueIntervalAfterCompletion,
} from '@/lib/recurrence/recurrence';
import type {
  FixedScheduleConfig,
  IntervalAfterCompletionConfig,
  LeaderboardEntry,
  RecurrenceMode,
} from '@/lib/types/firestore';

export function methodNotAllowed(res: NextApiResponse): void {
  res.status(405).json({ error: 'Method not allowed' });
}

export function getQueryStringParam(
  req: NextApiRequest,
  key: string
): string | null {
  const raw = req.query[key];
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return raw;
  }
  return null;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function parseOptionalString(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value === 'string') {
    return value.trim();
  }
  return undefined;
}

export function parseOptionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  return undefined;
}

export function parseOptionalPositiveInt(value: unknown): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    return undefined;
  }
  return value;
}

export function parseOptionalIsoDate(value: unknown): Date | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string') {
    return undefined;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return parsed;
}

export function getPeriodKey(date: Date): string {
  const year = date.getUTCFullYear().toString().slice(-2);
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}${month}`;
}

export function sortLeaderboardUsers(users: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...users].sort((a, b) => {
    if (b.pointsTotal !== a.pointsTotal) {
      return b.pointsTotal - a.pointsTotal;
    }
    return a.userId.localeCompare(b.userId);
  });
}

export function applyLeaderboardDelta(
  users: LeaderboardEntry[],
  userId: string,
  delta: number
): LeaderboardEntry[] {
  const entries = [...users];
  const existing = entries.find((entry) => entry.userId === userId);

  if (!existing && delta > 0) {
    entries.push({ userId, pointsTotal: delta });
    return sortLeaderboardUsers(entries);
  }

  if (!existing) {
    return sortLeaderboardUsers(entries);
  }

  existing.pointsTotal += delta;

  if (existing.pointsTotal <= 0) {
    return sortLeaderboardUsers(entries.filter((entry) => entry.userId !== userId));
  }

  return sortLeaderboardUsers(entries);
}

function isValidDayOfWeekArray(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)
  );
}

function isValidFixedScheduleConfig(value: unknown): value is FixedScheduleConfig {
  if (!isRecord(value) || value.type !== 'fixed_schedule') {
    return false;
  }

  if (value.dayOfWeek !== undefined && !isValidDayOfWeekArray(value.dayOfWeek)) {
    return false;
  }

  if (
    value.dayOfMonth !== undefined &&
    (typeof value.dayOfMonth !== 'number' ||
      !Number.isInteger(value.dayOfMonth) ||
      value.dayOfMonth < 1 ||
      value.dayOfMonth > 31)
  ) {
    return false;
  }

  if (value.dayOfWeek === undefined && value.dayOfMonth === undefined) {
    return false;
  }

  return true;
}

function isValidIntervalConfig(value: unknown): value is IntervalAfterCompletionConfig {
  if (!isRecord(value) || value.type !== 'interval_after_completion') {
    return false;
  }

  if (
    typeof value.intervalValue !== 'number' ||
    !Number.isInteger(value.intervalValue) ||
    value.intervalValue <= 0
  ) {
    return false;
  }

  return value.intervalUnit === 'days' || value.intervalUnit === 'weeks' || value.intervalUnit === 'months';
}

export function isValidRecurrence(
  recurrenceMode: RecurrenceMode,
  recurrenceConfig: unknown
): recurrenceConfig is FixedScheduleConfig | IntervalAfterCompletionConfig {
  if (recurrenceMode === 'fixed_schedule') {
    return isValidFixedScheduleConfig(recurrenceConfig);
  }

  if (recurrenceMode === 'interval_after_completion') {
    return isValidIntervalConfig(recurrenceConfig);
  }

  return false;
}

export function computeNextDueAt(
  recurrenceMode: RecurrenceMode,
  recurrenceConfig: FixedScheduleConfig | IntervalAfterCompletionConfig,
  timezone: string,
  baseDate: Date
): Timestamp {
  if (recurrenceMode === 'fixed_schedule') {
    const next = calculateNextDueFixedSchedule(recurrenceConfig as FixedScheduleConfig, baseDate, timezone);
    return Timestamp.fromDate(next);
  }

  const next = calculateNextDueIntervalAfterCompletion(
    recurrenceConfig as IntervalAfterCompletionConfig,
    baseDate,
    baseDate
  );
  return Timestamp.fromDate(next);
}
