import type * as React from "react";
import type { ViewMode } from "@/components/view-mode";

import { Inbox, MoreHorizontal, Search, X } from "lucide-react";

import { AnimatedPage } from "@/components/animated-page";
import { ViewModeToggle } from "@/components/view-mode";
import { Button } from "@/components/ui/button";
import { Checkbox, checkboxHandler } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
} from "@/components/ui/empty";

/*
 * Building blocks every page uses, so pages look alike:
 *   PageHeader   title, one line of help, one primary action
 *   PageTabs     the only tab style
 *   PageToolbar  search, filters, and secondary actions behind "更多"
 *   ListRow      one item per row; tapping opens its actions
 *   EmptyHint    what to do when a list is empty
 */

export interface PageAction {
  key: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
  icon?: React.ReactNode;
}

export function PageHeader({
  title,
  description,
  primary,
  secondary,
}: {
  title: string;
  description?: React.ReactNode;
  primary?: PageAction;
  /** A second, quieter action left of the primary one. */
  secondary?: PageAction;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[22px] leading-[30px] font-semibold tracking-[-0.01em] text-ink">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 text-[13px] leading-5 text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {(primary || secondary) && (
        <div className="flex shrink-0 gap-2">
          {secondary && (
            <Button
              className="gap-1.5"
              disabled={secondary.disabled}
              size="sm"
              variant="outline"
              onClick={secondary.onPress}
            >
              {secondary.icon}
              {secondary.label}
            </Button>
          )}
          {primary && (
            <Button
              disabled={primary.disabled}
              size="sm"
              onClick={primary.onPress}
            >
              {primary.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export interface PageTab<T extends string> {
  key: T;
  label: string;
  badge?: React.ReactNode;
}

export function PageTabs<T extends string>({
  value,
  tabs,
  onChange,
}: {
  value: T;
  tabs: Array<PageTab<T>>;
  onChange: (key: T) => void;
}) {
  return (
    <div
      className="mb-4 flex gap-1 overflow-x-auto border-b border-border scrollbar-hide"
      role="tablist"
      style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
    >
      {tabs.map((t) => (
        <button
          key={t.key}
          aria-selected={value === t.key}
          className={`relative flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap px-3 pb-2.5 pt-1 text-[13px] transition-colors duration-150 after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:transition-opacity ${
            value === t.key
              ? "font-medium text-foreground after:bg-primary after:opacity-100"
              : "text-muted-foreground after:opacity-0 hover:text-foreground"
          }`}
          role="tab"
          type="button"
          onClick={() => onChange(t.key)}
        >
          <span className="truncate">{t.label}</span>
          {t.badge !== undefined && t.badge !== null && (
            <span
              className={`shrink-0 rounded-full px-1.5 text-[11px] leading-4 tabular ${
                value === t.key
                  ? "bg-primary/10 text-primary"
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

export function PageToolbar({
  search,
  onSearch,
  placeholder = "搜索",
  children,
  extra,
  more,
  primary,
  view,
}: {
  search?: string;
  onSearch?: (v: string) => void;
  placeholder?: string;
  /** Filters shown next to the search box. */
  children?: React.ReactNode;
  /** Extra icon buttons rendered before the view switch. */
  extra?: React.ReactNode;
  /** Secondary actions, behind a "更多" menu. */
  more?: PageAction[];
  /**
   * The main action, for a tab inside a page whose header holds no
   * action of its own.
   */
  primary?: PageAction;
  /** The list / card switch, kept at the right end. */
  view?: { value: ViewMode; onChange: (m: ViewMode) => void };
}) {
  const actions = (more ?? []).filter(Boolean);

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 sm:flex-nowrap">
      {onSearch && (
        // With a main action too, the search gets a row of its own on a
        // phone instead of shrinking to its icon.
        <label
          className={`flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border border-hairline bg-raised px-3 text-[13px] transition-[border-color,box-shadow] duration-150 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30 sm:max-w-xs ${primary ? "basis-full sm:basis-auto" : ""}`}
        >
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            aria-label={placeholder}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            enterKeyHint="search"
            placeholder={placeholder}
            type="text"
            value={search ?? ""}
            onChange={(e) => onSearch(e.target.value)}
          />
          {search && (
            <button
              aria-label="清除搜索"
              className="text-muted-foreground"
              type="button"
              onClick={() => onSearch("")}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </label>
      )}
      {children}
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {extra}
        {view && <ViewModeToggle value={view.value} onChange={view.onChange} />}
        {actions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="更多操作"
                className="flex h-9 items-center gap-1 rounded-md border border-hairline bg-raised px-2.5 text-[13px] text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground"
                type="button"
              >
                <MoreHorizontal className="h-4 w-4" />
                <span className="hidden sm:inline">更多</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {actions.map((a) => (
                <DropdownMenuItem
                  key={a.key}
                  className={a.danger ? "text-destructive" : undefined}
                  disabled={a.disabled}
                  onSelect={a.onPress}
                >
                  {a.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {primary && (
          <Button
            className="shrink-0"
            disabled={primary.disabled}
            size="sm"
            onClick={primary.onPress}
          >
            {primary.label}
          </Button>
        )}
      </div>
    </div>
  );
}

/** A filter button for the toolbar; highlighted while a filter is on. */
export function ToolbarButton({
  active,
  children,
  onPress,
}: {
  active?: boolean;
  children: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <button
      className={`flex h-9 shrink-0 items-center gap-1 rounded-md border px-3 text-[13px] transition-colors ${
        active
          ? "border-primary bg-primary-soft font-medium text-primary"
          : "border-hairline bg-raised text-muted-foreground hover:bg-surface"
      }`}
      type="button"
      onClick={onPress}
    >
      {children}
    </button>
  );
}

/** Bar shown while picking items for a batch action. */
export function SelectionBar({
  count,
  allSelected,
  onToggleAll,
  actions,
  onExit,
}: {
  count: number;
  allSelected: boolean;
  onToggleAll: () => void;
  actions: PageAction[];
  onExit: () => void;
}) {
  return (
    <div className="sticky top-0 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-hairline bg-raised/95 px-3 py-2 shadow-sm ">
      <span className="text-sm text-muted-foreground">已选 {count} 个</span>
      <div className="ml-auto flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="outline" onClick={onToggleAll}>
          {allSelected ? "取消全选" : "全选"}
        </Button>
        {actions.map((a) => (
          <Button
            key={a.key}
            disabled={a.disabled || count === 0}
            size="sm"
            variant={a.danger ? "destructive" : "outline"}
            onClick={a.onPress}
          >
            {a.label}
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={onExit}>
          完成
        </Button>
      </div>
    </div>
  );
}

export type RowStatus = "ok" | "warn" | "bad" | "off";

export const STATUS_DOT: Record<RowStatus, string> = {
  ok: "bg-success",
  warn: "bg-warning",
  bad: "bg-destructive",
  off: "bg-muted-foreground/40",
};

/**
 * A desktop table built from rows: one bordered container, a shared column
 * template, and an optional header. Phones keep the card rows (each row's own
 * mobile layout), so nothing here applies below `lg`.
 */
export function ListTable({
  columns,
  head,
  label,
  className,
  children,
}: {
  /** CSS grid-template-columns used by the header and every row. */
  columns: string;
  /** Column labels; same order and count as the rows' `cells`. */
  head?: React.ReactNode[];
  /** Accessible name for the table, e.g. "服务器". */
  label?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      aria-label={label}
      className={`flex flex-col gap-2 lg:gap-0 lg:divide-y lg:divide-border lg:overflow-hidden lg:rounded-xl lg:border lg:border-hairline lg:bg-raised list-enter ${className ?? ""}`}
      role="table"
      style={{ "--list-cols": columns } as React.CSSProperties}
    >
      {head && (
        <div
          className="sticky top-0 z-10 hidden items-center gap-4 border-b border-hairline bg-surface px-4 py-2 text-[11px] font-medium tracking-[0.02em] text-muted-foreground lg:grid lg:[grid-template-columns:var(--list-cols)]"
          data-slot="list-head"
          role="row"
        >
          {head.map((cell, i) => (
            <div key={i} className="min-w-0 truncate" role="columnheader">
              {cell}
            </div>
          ))}
        </div>
      )}
      {children}
    </div>
  );
}

/** One item of a list. Tapping it opens its actions. */
export function ListRow({
  status,
  statusTitle,
  title,
  badges,
  meta,
  footer,
  right,
  cells,
  selectMode,
  selected,
  onSelect,
  onPress,
}: {
  status?: RowStatus;
  statusTitle?: string;
  title: React.ReactNode;
  badges?: React.ReactNode;
  meta?: React.ReactNode;
  /** Below the meta line, e.g. a usage bar. */
  footer?: React.ReactNode;
  /** Shown at the end of the row; clicks on it do not open the row. */
  right?: React.ReactNode;
  /**
   * Desktop cells: one node per column of the parent ListTable template.
   * When set, the row renders these as a grid on `lg` and falls back to the
   * title/meta/right layout on phones.
   */
  cells?: React.ReactNode[];
  selectMode?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  onPress: () => void;
}) {
  const activate = (selectMode ? onSelect : onPress) ?? (() => {});
  const label =
    typeof title === "string" || typeof title === "number"
      ? String(title)
      : "打开详情";

  const rowClass = `group relative w-full cursor-pointer text-left transition-colors duration-150 max-lg:rounded-lg max-lg:border ${
    cells ? "" : "flex items-center gap-3 px-3 py-3 lg:px-4"
  } ${
    selected
      ? "border-primary/40 bg-primary/5 max-lg:border-primary/40 lg:bg-primary/5"
      : "border-border bg-card hover:border-hairline-strong hover:bg-surface lg:border-0 lg:bg-transparent lg:hover:border-0 lg:hover:bg-surface"
  }`;

  return (
    <div className={rowClass} data-slot="list-row">
      {/* The row's single action sits underneath the content, so the row is
          no longer an interactive element wrapping other controls. */}
      <button
        aria-label={label}
        aria-pressed={selectMode ? selected : undefined}
        className="absolute inset-0 z-0 cursor-pointer rounded-[inherit] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset"
        type="button"
        onClick={activate}
      />

      {cells && (
        <div
          className="hidden items-center gap-4 px-4 py-3.5 lg:grid lg:[grid-template-columns:var(--list-cols)]"
          data-slot="list-row-body"
          role="row"
        >
          {cells.map((cell, i) => (
            <div key={i} className="min-w-0" role="cell">
              {cell}
            </div>
          ))}
        </div>
      )}
      {cells ? (
        <div
          className="flex flex-col gap-2 px-3 py-3 lg:hidden"
          data-slot="list-row-body"
        >
          <div className="flex items-center gap-3">
            {selectMode && (
              <div
                className="relative z-10 flex shrink-0"
                role="presentation"
                onClick={(e) => e.stopPropagation()}
              >
                <Checkbox
                  checked={selected}
                  onCheckedChange={checkboxHandler(() => onSelect?.())}
                />
              </div>
            )}
            {status && (
              <span
                className={`size-1.5 shrink-0 rounded-full ${STATUS_DOT[status]}`}
                title={statusTitle}
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-medium text-foreground">
                  {title}
                </span>
                {badges}
              </div>
              {meta && (
                <div className="truncate text-xs text-muted-foreground tabular">
                  {meta}
                </div>
              )}
            </div>
            {right && !selectMode && (
              <div
                className="relative z-10 flex shrink-0 items-center gap-2"
                role="presentation"
                onClick={(e) => e.stopPropagation()}
              >
                {right}
              </div>
            )}
          </div>
          {footer && <div>{footer}</div>}
        </div>
      ) : (
        <div className="contents" data-slot="list-row-body">
          {selectMode && (
            <div
              className="relative z-10 flex shrink-0"
              role="presentation"
              onClick={(e) => e.stopPropagation()}
            >
              <Checkbox
                checked={selected}
                onCheckedChange={checkboxHandler(() => onSelect?.())}
              />
            </div>
          )}
          {status && (
            <span
              className={`size-1.5 shrink-0 rounded-full ${STATUS_DOT[status]}`}
              title={statusTitle}
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-medium text-foreground">
                {title}
              </span>
              {badges}
            </div>
            {meta && (
              <div className="truncate text-xs text-muted-foreground tabular">
                {meta}
              </div>
            )}
            {footer && <div className="mt-1.5">{footer}</div>}
          </div>
          {right && !selectMode && (
            <div
              className="relative z-10 flex shrink-0 items-center gap-2"
              role="presentation"
              onClick={(e) => e.stopPropagation()}
            >
              {right}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ListGroup({
  title,
  count,
  columns,
  head,
  label,
  children,
}: {
  title?: React.ReactNode;
  count?: number;
  /** Desktop grid template shared by the header and every row. */
  columns?: string;
  /** Column labels; pass together with `columns`. */
  head?: React.ReactNode[];
  /** Accessible name for the table, e.g. "服务器". */
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      {title && (
        <h2 className="flex items-baseline gap-2 px-1 text-sm font-medium text-muted-foreground">
          {title}
          {count !== undefined && (
            <span className="text-xs font-normal text-muted-foreground">
              {count}
            </span>
          )}
        </h2>
      )}
      <div
        aria-label={label}
        className="list-enter flex flex-col gap-2 bg-transparent lg:gap-0 lg:divide-y lg:divide-border lg:overflow-hidden lg:rounded-xl lg:border lg:border-hairline lg:bg-raised"
        role={columns ? "table" : undefined}
        style={
          columns
            ? ({ "--list-cols": columns } as React.CSSProperties)
            : undefined
        }
      >
        {columns && head && (
          <div
            className="sticky top-0 z-10 hidden items-center gap-4 border-b border-hairline bg-surface px-4 py-2 text-[11px] font-medium tracking-[0.02em] text-muted-foreground lg:grid lg:[grid-template-columns:var(--list-cols)]"
            data-slot="list-head"
          >
            {head.map((cell, i) => (
              <div key={i} className="min-w-0 truncate">
                {cell}
              </div>
            ))}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

export function EmptyHint({
  text,
  action,
}: {
  text: React.ReactNode;
  action?: PageAction;
}) {
  return (
    <Empty className="rounded-xl border border-dashed border-border bg-card/50">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Inbox aria-hidden />
        </EmptyMedia>
        <EmptyDescription className="text-balance">{text}</EmptyDescription>
      </EmptyHeader>
      {action && (
        <Button size="sm" variant="outline" onClick={action.onPress}>
          {action.label}
        </Button>
      )}
    </Empty>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");

/** 2030-01-01; with time: 2030-01-01 08:00. Empty for no date. */
export function formatDate(ms?: number | string | null, withTime = false) {
  if (ms === undefined || ms === null || ms === "" || ms === 0) return "";
  const d = new Date(typeof ms === "string" && /^\d+$/.test(ms) ? +ms : ms);

  if (Number.isNaN(d.getTime())) return "";
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  return withTime
    ? `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}`
    : date;
}

/**
 * A page that can also sit inside another page's tab (the 用户 page hosts
 * 分组 and 限速): embedded, it drops its own padding and header.
 */
export function PageShell({
  embedded,
  children,
}: {
  embedded?: boolean;
  children: React.ReactNode;
}) {
  return embedded ? (
    <div>{children}</div>
  ) : (
    <AnimatedPage className="mx-auto w-full max-w-[1440px] px-6 py-6">
      {children}
    </AnimatedPage>
  );
}

export type SortDir = "asc" | "desc";

/** A clickable column label that reports the current sort direction. */
export function SortHeader({
  label,
  active,
  dir,
  onToggle,
  align = "start",
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onToggle: () => void;
  align?: "start" | "end";
}) {
  return (
    <button
      aria-label={`按${label}排序`}
      className={`inline-flex items-center gap-1 transition-colors hover:text-foreground ${
        align === "end" ? "justify-end" : ""
      } ${active ? "text-foreground" : ""}`}
      type="button"
      onClick={onToggle}
    >
      {label}
      <span className="text-[9px] leading-none">
        {active ? (dir === "asc" ? "▲" : "▼") : ""}
      </span>
    </button>
  );
}

/** Client-side paging footer for long lists. */
export function TablePagination({
  page,
  pageSize,
  total,
  onPageChange,
  unit = "条",
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  unit?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));

  if (total <= pageSize) return null;

  return (
    <div className="flex items-center justify-between gap-3 px-1 pt-2 text-xs text-muted-foreground">
      <span className="tabular">
        第 {page} / {pages} 页 · 共 {total} {unit}
      </span>
      <div className="flex items-center gap-2">
        <Button
          disabled={page <= 1}
          size="sm"
          variant="outline"
          onClick={() => onPageChange(page - 1)}
        >
          上一页
        </Button>
        <Button
          disabled={page >= pages}
          size="sm"
          variant="outline"
          onClick={() => onPageChange(page + 1)}
        >
          下一页
        </Button>
      </div>
    </div>
  );
}
