import type * as React from "react";

import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

/** One collapsible group of settings: title and current values, then fields. */
export function ConfigSection({
  id,
  title,
  summary,
  changed,
  children,
}: {
  id: string;
  title: string;
  /** Current values, shown under the title. */
  summary?: React.ReactNode;
  /** Has edits that are not saved yet. */
  changed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <AccordionItem
      className="border-b border-border last:border-b-0"
      value={id}
    >
      <AccordionTrigger className="px-4 py-3 hover:no-underline">
        <div className="min-w-0 flex-1 text-left">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            {title}
            {changed && (
              <span className="rounded-full bg-warning/10 px-1.5 py-0.5 text-[11px] font-normal text-warning-700 dark:text-warning-400">
                未保存
              </span>
            )}
          </h2>
          {summary && (
            <p className="mt-0.5 truncate text-xs font-normal text-muted-foreground">
              {summary}
            </p>
          )}
        </div>
      </AccordionTrigger>
      <AccordionContent className="space-y-4 border-t border-border px-4 pt-4">
        {children}
      </AccordionContent>
    </AccordionItem>
  );
}

/** Label above the control with a line of help; `inline` puts the control on the right (switches). */
export function Field({
  label,
  help,
  inline,
  children,
}: {
  label: React.ReactNode;
  help?: React.ReactNode;
  inline?: boolean;
  children: React.ReactNode;
}) {
  if (inline) {
    return (
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{label}</p>
          {help && <p className="text-xs text-muted-foreground">{help}</p>}
        </div>
        <div className="shrink-0">{children}</div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{label}</p>
      {children}
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
    </div>
  );
}

/** Small heading inside a section, for a group of fields. */
export function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-t border-hairline pt-3 text-xs font-semibold text-muted-foreground first:border-t-0 first:pt-0">
      {children}
    </p>
  );
}
