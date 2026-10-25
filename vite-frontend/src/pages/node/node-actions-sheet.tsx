import type { SheetAction } from "@/components/action-sheet";

import { useMemo, useState } from "react";
import { ChevronRight, Copy } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="break-all pr-8">{title}</DialogTitle>
          {subtitle && <DialogDescription>{subtitle}</DialogDescription>}
        </DialogHeader>

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
                    className={`flex w-full items-center gap-3 border-b border-border px-4 py-2.5 text-left text-sm transition-colors last:border-b-0 hover:bg-accent/50 disabled:pointer-events-none disabled:opacity-50 ${
                      action.color === "danger"
                        ? "text-danger"
                        : "text-foreground"
                    }`}
                    disabled={action.disabled}
                    type="button"
                    onClick={() => {
                      if (action.closeOnSelect !== false) onClose();
                      action.onPress();
                    }}
                  >
                    {action.icon && (
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <action.icon className="h-4 w-4" />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{action.label}</span>
                      {action.description && (
                        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                          {action.description}
                        </span>
                      )}
                    </span>
                    <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                      {action.hint}
                      {action.kind === "copy" ? (
                        <Copy className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-4 w-4 opacity-50" />
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
