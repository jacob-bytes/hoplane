import type { SheetAction } from "@/components/action-sheet";

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * The one action surface for a server, used by both the list row and the
 * card's 配置 button. Actions are grouped into tabs by their `section`.
 */
export function NodeActionsSheet({
  open,
  title,
  subtitle,
  children,
  actions,
  onClose,
}: {
  open: boolean;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Read-only facts shown above the tabs (IP, version, uptime …). */
  children?: React.ReactNode;
  actions: SheetAction[];
  onClose: () => void;
}) {
  const groups = useMemo(() => {
    const next: Array<[string, SheetAction[]]> = [];

    for (const action of actions) {
      const section = action.section ?? "";
      const last = next[next.length - 1];

      if (last && last[0] === section) last[1].push(action);
      else next.push([section, [action]]);
    }

    return next;
  }, [actions]);

  const [tab, setTab] = useState<string | null>(null);
  const activeKey =
    groups.find(([key]) => key === tab)?.[0] ?? groups[0]?.[0] ?? "";

  return (
    <Sheet open={open} onOpenChange={(open) => !open && onClose()}>
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

          <Tabs value={activeKey} onValueChange={setTab}>
            <TabsList className="w-full">
              {groups.map(([key]) => (
                <TabsTrigger
                  key={key || "other"}
                  className="flex-1"
                  value={key || "other"}
                >
                  {key || "操作"}
                </TabsTrigger>
              ))}
            </TabsList>

            {groups.map(([key, items]) => (
              <TabsContent key={key || "other"} value={key || "other"}>
                <div className="overflow-hidden rounded-lg border border-border">
                  {items.map((action) => (
                    <button
                      key={action.key}
                      className={`flex w-full items-center justify-between gap-3 border-b border-border px-4 py-2.5 text-left text-sm transition-colors last:border-b-0 hover:bg-accent/50 disabled:pointer-events-none disabled:opacity-50 ${
                        action.color === "danger"
                          ? "text-danger"
                          : action.color === "primary"
                            ? "text-primary"
                            : "text-foreground"
                      }`}
                      disabled={action.disabled}
                      type="button"
                      onClick={() => {
                        onClose();
                        action.onPress();
                      }}
                    >
                      <span className="min-w-0">
                        <span className="block truncate">{action.label}</span>
                        {action.description && (
                          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                            {action.description}
                          </span>
                        )}
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 opacity-50" />
                    </button>
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
