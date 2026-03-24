/**
 * Sample tests for recurrence calculation logic
 */

import {
  calculateNextDueFixedSchedule,
  calculateNextDueIntervalAfterCompletion,
  isTaskDue,
} from '@/lib/recurrence/recurrence';
import { FixedScheduleConfig, IntervalAfterCompletionConfig } from '@/lib/types/firestore';

describe('Recurrence calculations', () => {
  const now = new Date('2024-01-15T10:00:00Z'); // Monday

  describe('Fixed schedule - weekly', () => {
    it('should calculate next Monday', () => {
      const config: FixedScheduleConfig = {
        type: 'fixed_schedule',
        dayOfWeek: [1], // Monday
      };
      const result = calculateNextDueFixedSchedule(config, now, 'UTC');
      expect(result.getUTCDay()).toBe(1); // Monday
    });

    it('should calculate next occurrence in next week if already passed this week', () => {
      const wednesday = new Date('2024-01-17T10:00:00Z');
      const config: FixedScheduleConfig = {
        type: 'fixed_schedule',
        dayOfWeek: [1], // Monday
      };
      const result = calculateNextDueFixedSchedule(config, wednesday, 'UTC');
      expect(result.getUTCDate()).toBe(22); // Next Monday
    });
  });

  describe('Fixed schedule - monthly', () => {
    it('should calculate next 15th of month', () => {
      const config: FixedScheduleConfig = {
        type: 'fixed_schedule',
        dayOfMonth: 20,
      };
      const result = calculateNextDueFixedSchedule(config, now, 'UTC');
      expect(result.getUTCDate()).toBe(20);
      expect(result.getUTCMonth()).toBe(0); // January
    });

    it('should move to next month if day already passed', () => {
      const late = new Date('2024-01-25T10:00:00Z');
      const config: FixedScheduleConfig = {
        type: 'fixed_schedule',
        dayOfMonth: 15,
      };
      const result = calculateNextDueFixedSchedule(config, late, 'UTC');
      expect(result.getUTCDate()).toBe(15);
      expect(result.getUTCMonth()).toBe(1); // February
    });
  });

  describe('Interval after completion', () => {
    it('should calculate next due 7 days after completion', () => {
      const completed = new Date('2024-01-15T10:00:00Z');
      const config: IntervalAfterCompletionConfig = {
        type: 'interval_after_completion',
        intervalValue: 7,
        intervalUnit: 'days',
      };
      const result = calculateNextDueIntervalAfterCompletion(config, completed, now);
      expect(result.getUTCDate()).toBe(22);
    });

    it('should calculate next due 2 weeks after completion', () => {
      const completed = new Date('2024-01-15T10:00:00Z');
      const config: IntervalAfterCompletionConfig = {
        type: 'interval_after_completion',
        intervalValue: 2,
        intervalUnit: 'weeks',
      };
      const result = calculateNextDueIntervalAfterCompletion(config, completed, now);
      expect(result.getUTCDate()).toBe(29);
    });

    it('should calculate next due 1 month after completion', () => {
      const completed = new Date('2024-01-15T10:00:00Z');
      const config: IntervalAfterCompletionConfig = {
        type: 'interval_after_completion',
        intervalValue: 1,
        intervalUnit: 'months',
      };
      const result = calculateNextDueIntervalAfterCompletion(config, completed, now);
      expect(result.getUTCDate()).toBe(15);
      expect(result.getUTCMonth()).toBe(1); // February
    });
  });

  describe('Task due check', () => {
    it('should return true if nextDueAt <= now', () => {
      const nextDue = new Date('2024-01-15T09:00:00Z');
      expect(isTaskDue(nextDue, now)).toBe(true);
    });

    it('should return false if nextDueAt > now', () => {
      const nextDue = new Date('2024-01-15T11:00:00Z');
      expect(isTaskDue(nextDue, now)).toBe(false);
    });
  });
});
