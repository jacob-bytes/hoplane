import { ChevronRight } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export interface SheetAction {
  key: string;
  label: string;
  /** Optional one-liner under the label, for actions that need context. */
  description?: string;
  /** Actions with the same section are grouped under one small heading. */
  section?: string;
  color?: "primary" | "secondary" | "success" | "warning" | "danger";
  disabled?: boolean;
  onPress: () => void;
}

/** A small menu of actions for one item, opened by tapping it. */
export function ActionSheet({
  isOpen,
  title,
  subtitle,
  children,
  actions,
  onClose,
}: {
  isOpen: boolean;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
  actions: SheetAction[];
  onClose: () => void;
}) {
  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        className="max-h-[85dvh] sm:bottom-6 sm:left-1/2 sm:max-w-md sm:-translate-x-1/2 sm:rounded-xl sm:border"
        side="bottom"
      >
        <SheetHeader>
          <SheetTitle className="break-all">{title}</SheetTitle>
          {subtitle && <SheetDescription>{subtitle}</SheetDescription>}
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {children}

          <div className="space-y-3">
            {groupActions(actions).map(([section, items]) => (
              <div key={section || "actions"}>
                {section && (
                  <div className="mb-1.5 px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {section}
                  </div>
                )}
                <div className="overflow-hidden rounded-lg border border-border">
                  {items.map((a) => (
                    <button
                      key={a.key}
                      className={`flex w-full items-center justify-between gap-3 border-b border-border px-4 py-2 text-left text-sm transition-colors last:border-b-0 hover:bg-accent/50 disabled:pointer-events-none disabled:opacity-50 ${
                        a.color === "danger"
                          ? "text-danger"
                          : a.color === "primary"
                            ? "text-primary"
                            : "text-foreground"
                      }`}
                      disabled={a.disabled}
                      type="button"
                      onClick={() => {
                        onClose();
                        a.onPress();
                      }}
                    >
                      <span className="min-w-0">
                        <span className="block truncate">{a.label}</span>
                        {a.description && (
                          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                            {a.description}
                          </span>
                        )}
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 opacity-50" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Keeps the original order while grouping actions by their section. */
function groupActions(actions: SheetAction[]): Array<[string, SheetAction[]]> {
  const groups: Array<[string, SheetAction[]]> = [];

  for (const action of actions) {
    const section = action.section ?? "";
    const last = groups[groups.length - 1];

    if (last && last[0] === section) last[1].push(action);
    else groups.push([section, [action]]);
  }

  return groups;
}
