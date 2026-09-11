import { type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ *
 * Small form primitives for the /studio content editor (dev only).
 * ------------------------------------------------------------------ */

export function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="text-xs font-medium text-muted">{children}</span>;
}

export function Field({
  label,
  value,
  onChange,
  placeholder,
  hint,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string | undefined;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <FieldLabel>{label}</FieldLabel>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? ""}
        className={cn(error && "border-red-500")}
      />
      {hint ? <span className="text-[11px] text-muted">{hint}</span> : null}
      {error ? <span className="text-[11px] text-red-500">{error}</span> : null}
    </label>
  );
}

export function AreaField({
  label,
  value,
  onChange,
  rows = 3,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <FieldLabel>{label}</FieldLabel>
      <Textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
      {hint ? <span className="text-[11px] text-muted">{hint}</span> : null}
    </label>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: readonly T[];
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <FieldLabel>{label}</FieldLabel>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function RowButton({
  onClick,
  children,
  title,
}: {
  onClick: () => void;
  children: ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      className="flex h-7 w-7 items-center justify-center rounded border border-rule text-xs text-muted transition-colors hover:border-accent hover:text-accent"
    >
      {children}
    </button>
  );
}

/** Editor for a plain `string[]` — bullet points, notes, marquee terms, tech tags. */
export function StringList({
  label,
  items,
  onChange,
  placeholder,
  multiline = true,
}: {
  label: string;
  items: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  const set = (i: number, v: string) => onChange(items.map((x, j) => (j === i ? v : x)));
  const remove = (i: number) => onChange(items.filter((_, j) => j !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j] as string, next[i] as string];
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel>{label}</FieldLabel>
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2">
          {multiline ? (
            <Textarea rows={2} value={item} onChange={(e) => set(i, e.target.value)} />
          ) : (
            <Input value={item} onChange={(e) => set(i, e.target.value)} />
          )}
          <div className="flex shrink-0 gap-1">
            <RowButton title="Move up" onClick={() => move(i, -1)}>
              ↑
            </RowButton>
            <RowButton title="Move down" onClick={() => move(i, 1)}>
              ↓
            </RowButton>
            <RowButton title="Remove" onClick={() => remove(i)}>
              ✕
            </RowButton>
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        onClick={() => onChange([...items, ""])}
      >
        + Add {placeholder ?? "item"}
      </Button>
    </div>
  );
}

/** Editor for an array of objects. Each item is a collapsible card. */
export function ArrayEditor<T>({
  label,
  items,
  onChange,
  create,
  title,
  children,
  addLabel,
}: {
  label: string;
  items: T[];
  onChange: (next: T[]) => void;
  create: () => T;
  title: (item: T, i: number) => string;
  children: (item: T, patch: (next: T) => void, i: number) => ReactNode;
  addLabel?: string;
}) {
  const set = (i: number, next: T) => onChange(items.map((x, j) => (j === i ? next : x)));
  const remove = (i: number) => onChange(items.filter((_, j) => j !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j] as T, next[i] as T];
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{label}</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...items, create()])}
        >
          + Add {addLabel ?? ""}
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-rule px-3 py-6 text-center text-xs text-muted">
          Nothing here yet.
        </p>
      ) : null}

      {items.map((item, i) => (
        <details key={i} open className="overflow-hidden rounded-lg border border-rule bg-paper">
          <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm">
            <span className="truncate font-medium">{title(item, i) || `Item ${i + 1}`}</span>
            <span className="flex shrink-0 gap-1">
              <RowButton title="Move up" onClick={() => move(i, -1)}>
                ↑
              </RowButton>
              <RowButton title="Move down" onClick={() => move(i, 1)}>
                ↓
              </RowButton>
              <RowButton title="Remove" onClick={() => remove(i)}>
                ✕
              </RowButton>
            </span>
          </summary>
          <div className="flex flex-col gap-3 border-t border-rule p-3">
            {children(item, (next) => set(i, next), i)}
          </div>
        </details>
      ))}
    </div>
  );
}
