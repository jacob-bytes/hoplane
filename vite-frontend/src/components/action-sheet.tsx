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
          <div className="overflow-hidden rounded-lg border border-border">
            {actions.map((a) => (
              <button
                key={a.key}
                className={`flex w-full items-center justify-between gap-3 border-b border-border px-4 py-3 text-left text-sm transition-colors last:border-b-0 hover:bg-accent/50 disabled:pointer-events-none disabled:opacity-50 ${
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
                <span className="min-w-0 truncate">{a.label}</span>
                <ChevronRight className="h-4 w-4 shrink-0 opacity-50" />
              </button>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
