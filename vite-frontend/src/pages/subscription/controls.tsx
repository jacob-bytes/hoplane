import type { ReactNode } from "react";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { Switch } from "@/components/ui/switch";

/** Small controls shared by the subscription editors. */

/**
 * A choice between a few options: bordered buttons, the picked one
 * outlined in the primary colour, so it reads on a white page too.
 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  columns,
}: {
  value: T;
  options: Array<[T, string]>;
  onChange: (v: T) => void;
  columns?: number;
}) {
  return (
    <div
      className="grid gap-2"
      role="radiogroup"
      style={{
        gridTemplateColumns: `repeat(${columns ?? options.length}, minmax(0, 1fr))`,
      }}
    >
      {options.map(([k, label]) => (
        <button
          key={k}
          aria-checked={value === k}
          className={`rounded-xl border px-2 py-2 text-sm transition-colors ${
            value === k
              ? "border-primary bg-primary-soft font-medium text-primary dark:bg-primary-900/30"
              : "border-border bg-raised text-muted-foreground hover:border-hairline-strong dark:border-border"
          }`}
          role="radio"
          type="button"
          onClick={() => onChange(k)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/**
 * The editor's page tabs: a rounded segmented bar whose tabs share the width
 * equally. It never scrolls, so on a phone it can't be dragged around and
 * every page stays one tap away; keep labels short (two characters).
 */
export function EditorTabs<T extends string>({
  value,
  tabs,
  onChange,
}: {
  value: T;
  tabs: Array<{ key: T; label: string; badge?: string | number }>;
  onChange: (v: T) => void;
}) {
  return (
    <div
      className="grid gap-1 rounded-md border border-hairline bg-surface p-1"
      role="tablist"
      style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
    >
      {tabs.map((t) => (
        <button
          key={t.key}
          aria-selected={value === t.key}
          className={`flex items-center justify-center gap-1.5 whitespace-nowrap rounded-sm border px-3 py-1.5 text-[13px] transition-colors ${
            value === t.key
              ? "border-hairline bg-raised font-medium text-foreground shadow-sm"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          role="tab"
          type="button"
          onClick={() => onChange(t.key)}
        >
          {t.label}
          {t.badge !== undefined && t.badge !== "" && (
            <span
              className={`rounded-full px-1.5 text-[11px] leading-4 ${
                value === t.key
                  ? "bg-primary-soft text-primary"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {t.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/**
 * A text field followed by three equal quick-pick buttons. The buttons take
 * the same fixed width in every row, so stacked rows line up.
 */
export function QuickPickRow({
  children,
  picks,
}: {
  children: ReactNode;
  picks: Array<{ label: string; onPick: () => void }>;
}) {
  return (
    <div className="flex gap-2">
      <div className="relative min-w-0 flex-1">{children}</div>
      <div className="grid w-40 shrink-0 grid-cols-3 gap-1.5">
        {picks.map((p) => (
          <button
            key={p.label}
            className="h-10 rounded-lg bg-muted text-sm text-foreground transition-colors hover:bg-muted"
            type="button"
            onClick={p.onPick}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ToggleRow({
  id,
  label,
  hint,
  value,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-3">
      <Switch
        aria-labelledby={`${id}-label`}
        checked={value}
        disabled={disabled}
        id={id}
        onCheckedChange={onChange}
      />
      <label
        className="flex min-w-0 cursor-pointer flex-col gap-0.5"
        htmlFor={id}
        id={`${id}-label`}
      >
        <span className="text-sm">{label}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </label>
    </div>
  );
}

export function ChipPicker({
  options,
  selected,
  onChange,
  emptyText,
}: {
  options: Array<[string, string]>;
  selected: string[];
  onChange: (v: string[]) => void;
  emptyText: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        className={`rounded-full border px-2.5 py-1 text-xs ${
          selected.length === 0
            ? "border-primary bg-primary-soft text-primary dark:bg-primary-900/30"
            : "border-hairline text-muted-foreground"
        }`}
        type="button"
        onClick={() => onChange([])}
      >
        {emptyText}
      </button>
      {options.map(([value, label]) => {
        const on = selected.includes(value);

        return (
          <button
            key={value}
            className={`rounded-full border px-2.5 py-1 text-xs ${
              on
                ? "border-primary bg-primary-soft text-primary dark:bg-primary-900/30"
                : "border-hairline text-muted-foreground"
            }`}
            type="button"
            onClick={() =>
              onChange(
                on ? selected.filter((x) => x !== value) : [...selected, value],
              )
            }
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function Section({
  title,
  hint,
  summary,
  collapsible,
  defaultOpen = true,
  children,
}: {
  title: string;
  hint?: string;
  /** Shown next to the title (while collapsed, for a collapsible one). */
  summary?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const shown = !collapsible || open;

  return (
    <section className="space-y-3 border-t border-hairline pt-4 first:border-t-0 first:pt-0">
      {collapsible ? (
        <button
          aria-expanded={open}
          className="flex w-full items-start gap-2 text-left"
          type="button"
          onClick={() => setOpen((v) => !v)}
        >
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold">
              {title}
              {!open && summary && (
                <span className="ml-2 text-xs font-normal text-primary">
                  {summary}
                </span>
              )}
            </h3>
            {open && hint && (
              <p className="text-xs text-muted-foreground">{hint}</p>
            )}
          </div>
          <ChevronDown
            className={`mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      ) : (
        <div>
          <h3 className="text-sm font-semibold">
            {title}
            {summary && (
              <span className="ml-2 text-xs font-normal text-primary">
                {summary}
              </span>
            )}
          </h3>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      )}
      {shown && children}
    </section>
  );
}
