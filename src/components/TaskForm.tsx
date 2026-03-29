import { FormEvent, useState } from 'react';
import { Card, Button, Input, Textarea, Select, FormField, Heading } from '@/components/ui';

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
    <Card shadow={false} className="!p-4">
      <form className="grid gap-3" onSubmit={handleSubmit}>
        <Heading level={4}>Add recurring task</Heading>
        <Input
          value={values.title}
          onChange={(event) => setValues((prev) => ({ ...prev, title: event.target.value }))}
          placeholder="Task title"
          required
          maxLength={160}
        />
        <Textarea
          value={values.description}
          onChange={(event) => setValues((prev) => ({ ...prev, description: event.target.value }))}
          placeholder="Optional details"
          maxLength={2000}
          className="min-h-20"
        />
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Points">
            <Input
              type="number"
              min={1}
              value={values.pointsPerCompletion}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, pointsPerCompletion: Number(event.target.value) || 1 }))
              }
            />
          </FormField>
          <FormField label="Recurrence">
            <Select
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
            </Select>
          </FormField>
        </div>

        {values.recurrenceMode === 'interval_after_completion' ? (
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Every">
              <Input
                type="number"
                min={1}
                value={values.intervalValue}
                onChange={(event) =>
                  setValues((prev) => ({ ...prev, intervalValue: Number(event.target.value) || 1 }))
                }
              />
            </FormField>
            <FormField label="Unit">
              <Select
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
              </Select>
            </FormField>
          </div>
        ) : (
          <p className="text-xs text-[var(--color-muted-text)]">Fixed schedule currently defaults to every Monday.</p>
        )}

        <Button type="submit" size="md" disabled={disabled} className="w-fit">
          Save task
        </Button>
      </form>
    </Card>
  );
}
