import { FormEvent, useState } from 'react';

export type TaskRecurrenceMode = 'interval_after_completion' | 'fixed_schedule';

interface TaskFormValues {
  title: string;
  description: string;
  pointsPerCompletion: number;
  recurrenceMode: TaskRecurrenceMode;
  intervalValue: number;
  intervalUnit: 'days' | 'weeks' | 'months';
}

interface TaskFormProps {
  onSubmit: (values: TaskFormValues) => Promise<void>;
  disabled?: boolean;
}

const initialValues: TaskFormValues = {
  title: '',
  description: '',
  pointsPerCompletion: 10,
  recurrenceMode: 'interval_after_completion',
  intervalValue: 1,
  intervalUnit: 'days',
};

export function TaskForm({ onSubmit, disabled }: TaskFormProps) {
  const [values, setValues] = useState<TaskFormValues>(initialValues);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) {
      return;
    }

    await onSubmit(values);
    setValues(initialValues);
  }

  return (
    <form className="grid gap-3 rounded-2xl border border-[var(--color-border)] bg-white p-4" onSubmit={handleSubmit}>
      <h2 className="text-base font-semibold text-[var(--color-text)]">Add recurring task</h2>
      <input
        className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm outline-none transition focus:border-[var(--color-accent-strong)]"
        value={values.title}
        onChange={(event) => setValues((prev) => ({ ...prev, title: event.target.value }))}
        placeholder="Task title"
        required
        maxLength={160}
      />
      <textarea
        className="min-h-20 rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm outline-none transition focus:border-[var(--color-accent-strong)]"
        value={values.description}
        onChange={(event) => setValues((prev) => ({ ...prev, description: event.target.value }))}
        placeholder="Optional details"
        maxLength={2000}
      />
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-[var(--color-muted-text)]">
          Points
          <input
            type="number"
            min={1}
            className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm outline-none transition focus:border-[var(--color-accent-strong)]"
            value={values.pointsPerCompletion}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, pointsPerCompletion: Number(event.target.value) || 1 }))
            }
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-[var(--color-muted-text)]">
          Recurrence
          <select
            className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm outline-none transition focus:border-[var(--color-accent-strong)]"
            value={values.recurrenceMode}
            onChange={(event) =>
              setValues((prev) => ({
                ...prev,
                recurrenceMode: event.target.value as TaskRecurrenceMode,
              }))
            }
          >
            <option value="interval_after_completion">Interval after completion</option>
            <option value="fixed_schedule">Fixed schedule (weekly)</option>
          </select>
        </label>
      </div>

      {values.recurrenceMode === 'interval_after_completion' ? (
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-[var(--color-muted-text)]">
            Every
            <input
              type="number"
              min={1}
              className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm outline-none transition focus:border-[var(--color-accent-strong)]"
              value={values.intervalValue}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, intervalValue: Number(event.target.value) || 1 }))
              }
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-[var(--color-muted-text)]">
            Unit
            <select
              className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm outline-none transition focus:border-[var(--color-accent-strong)]"
              value={values.intervalUnit}
              onChange={(event) =>
                setValues((prev) => ({
                  ...prev,
                  intervalUnit: event.target.value as TaskFormValues['intervalUnit'],
                }))
              }
            >
              <option value="days">Days</option>
              <option value="weeks">Weeks</option>
              <option value="months">Months</option>
            </select>
          </label>
        </div>
      ) : (
        <p className="text-xs text-[var(--color-muted-text)]">Fixed schedule currently defaults to every Monday.</p>
      )}

      <button
        type="submit"
        className="w-fit rounded-xl bg-[var(--color-cta)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled}
      >
        Save task
      </button>
    </form>
  );
}
