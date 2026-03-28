export function asDate(value: unknown): Date | null {
  if (!value) {
    return null;
  }

  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const maybeTimestamp = value as { toDate?: () => Date };
    const converted = maybeTimestamp.toDate?.();
    if (converted instanceof Date && !Number.isNaN(converted.getTime())) {
      return converted;
    }
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
}
