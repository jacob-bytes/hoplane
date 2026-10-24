import { Button } from "@/shadcn-bridge/heroui/button";
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
          <div className="grid grid-cols-3 gap-2">
            {actions.map((a) => (
              <Button
                key={a.key}
                className="w-full min-w-0 px-1"
                color={
                  a.color === "primary" ? "primary" : (a.color ?? "default")
                }
                isDisabled={a.disabled}
                size="sm"
                variant="secondary"
                onPress={() => {
                  onClose();
                  a.onPress();
                }}
              >
                {a.label}
              </Button>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
