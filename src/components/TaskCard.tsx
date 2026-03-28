interface TaskCardProps {
  taskId: string;
  title: string;
  description?: string | null;
  pointsPerCompletion: number;
  nextDueLabel: string;
  isActive: boolean;
  onComplete: (taskId: string) => void;
  onArchive: (taskId: string) => void;
  busy?: boolean;
}

export function TaskCard({
  taskId,
  title,
  description,
  pointsPerCompletion,
  nextDueLabel,
  isActive,
  onComplete,
  onArchive,
  busy,
}: TaskCardProps) {
  return (
    <article className="rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-[0_8px_24px_rgba(13,32,44,0.06)]">
      <div className="mb-2 flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-[var(--color-text)]">{title}</h3>
        <span className="rounded-full bg-[var(--color-accent-soft)] px-2 py-1 text-xs font-semibold text-[var(--color-accent-strong)]">
          {pointsPerCompletion} pts
        </span>
      </div>
      {description ? <p className="mb-3 text-sm text-[var(--color-muted-text)]">{description}</p> : null}
      <p className="mb-4 text-xs text-[var(--color-muted-text)]">Due: {nextDueLabel}</p>
      <div className="flex gap-2">
        <button
          type="button"
          className="rounded-xl bg-[var(--color-accent-strong)] px-3 py-2 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!isActive || busy}
          onClick={() => onComplete(taskId)}
        >
          Complete
        </button>
        <button
          type="button"
          className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-muted-text)] transition hover:bg-[var(--color-surface-muted)] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={busy}
          onClick={() => onArchive(taskId)}
        >
          Archive
        </button>
      </div>
    </article>
  );
}
