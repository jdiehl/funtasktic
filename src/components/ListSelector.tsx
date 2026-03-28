export interface ListOption {
  id: string;
  name: string;
  timezone: string;
}

interface ListSelectorProps {
  lists: ListOption[];
  value: string | null;
  onChange: (nextListId: string) => void;
  disabled?: boolean;
}

export function ListSelector({ lists, value, onChange, disabled }: ListSelectorProps) {
  if (lists.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-muted-text)]">
        No lists yet.
      </div>
    );
  }

  return (
    <label className="flex w-full flex-col gap-1 text-sm font-medium text-[var(--color-muted-text)] sm:max-w-xs">
      Active list
      <select
        className="rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-accent-strong)]"
        value={value ?? lists[0]?.id}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      >
        {lists.map((list) => (
          <option key={list.id} value={list.id}>
            {list.name}
          </option>
        ))}
      </select>
    </label>
  );
}
