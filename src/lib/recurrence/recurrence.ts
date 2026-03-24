/**
 * Recurrence calculation engine
 * Used both client-side and server-side to compute nextDueAt timestamps
 */

import { FixedScheduleConfig, IntervalAfterCompletionConfig } from '@/lib/types/firestore';

/**
 * Calculate next due timestamp for fixed schedule recurrence
 */
export function calculateNextDueFixedSchedule(
  config: FixedScheduleConfig,
  now: Date,
  timezone: string
): Date {
  // TODO: Implement with timezone support
  // For now, use UTC
  const date = new Date(now);

  if (config.dayOfWeek) {
    // Weekly: find next occurrence of specified weekday
    const currentDayOfWeek = date.getUTCDay();
    const nextDayOfWeek = config.dayOfWeek.find((day) => day >= currentDayOfWeek);

    if (nextDayOfWeek !== undefined) {
      // Next occurrence is this week
      const daysToAdd = nextDayOfWeek - currentDayOfWeek;
      date.setUTCDate(date.getUTCDate() + daysToAdd);
    } else {
      // Next occurrence is next week
      const firstDayOfWeek = config.dayOfWeek[0];
      const daysToAdd = 7 - currentDayOfWeek + firstDayOfWeek;
      date.setUTCDate(date.getUTCDate() + daysToAdd);
    }
  } else if (config.dayOfMonth) {
    // Monthly: next occurrence of specified day
    const currentDay = date.getUTCDate();
    const targetDay = config.dayOfMonth;

    if (targetDay > currentDay) {
      // Same month
      date.setUTCDate(targetDay);
    } else {
      // Next month
      date.setUTCMonth(date.getUTCMonth() + 1);
      date.setUTCDate(targetDay);
    }
  }

  // Reset time to start of day
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

/**
 * Calculate next due timestamp for interval-after-completion recurrence
 */
export function calculateNextDueIntervalAfterCompletion(
  config: IntervalAfterCompletionConfig,
  lastCompletedAt: Date,
  now: Date
): Date {
  const date = new Date(lastCompletedAt);

  switch (config.intervalUnit) {
    case 'days':
      date.setUTCDate(date.getUTCDate() + config.intervalValue);
      break;
    case 'weeks':
      date.setUTCDate(date.getUTCDate() + config.intervalValue * 7);
      break;
    case 'months':
      date.setUTCMonth(date.getUTCMonth() + config.intervalValue);
      break;
  }

  return date;
}

/**
 * Determine if task is due (nextDueAt <= now)
 */
export function isTaskDue(nextDueAt: Date, now: Date): boolean {
  return nextDueAt <= now;
}
