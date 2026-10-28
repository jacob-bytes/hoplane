import * as React from "react";
import { X } from "lucide-react";

import {
  Dialog as DialogPrimitive,
  DialogContent as BaseDialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface DisclosureOptions {
  isOpen?: boolean;
}

type OpenChangeHandler = (open?: boolean) => void;

export function useDisclosure(options: DisclosureOptions = {}) {
  const [isOpen, setIsOpen] = React.useState(Boolean(options.isOpen));

  const onOpen = React.useCallback(() => {
    setIsOpen(true);
  }, []);

  const onClose = React.useCallback(() => {
    setIsOpen(false);
  }, []);

  const onOpenChange = React.useCallback<OpenChangeHandler>((open) => {
    setIsOpen((prev) => (typeof open === "boolean" ? open : !prev));
  }, []);

  return {
    isOpen,
    onClose,
    onOpen,
    onOpenChange,
  };
}

interface DialogContextValue {
  classNames?: Record<string, string>;
  onClose: () => void;
  scrollBehavior?: "inside" | "outside";
  size?: DialogSize;
}

const DialogContext = React.createContext<DialogContextValue | null>(null);

function useDialogContext() {
  return React.useContext(DialogContext);
}

interface ScrollPosition {
  element: HTMLElement | null;
  left: number;
  top: number;
}

function captureScrollPositions(): ScrollPosition[] {
  const positions: ScrollPosition[] = [
    { element: null, left: window.scrollX, top: window.scrollY },
  ];

  for (const element of Array.from(
    document.querySelectorAll<HTMLElement>("main, [data-scroll-container]"),
  )) {
    positions.push({
      element,
      left: element.scrollLeft,
      top: element.scrollTop,
    });
  }

  return positions;
}

function restoreScrollPositions(positions: ScrollPosition[]) {
  for (const position of positions) {
    if (position.element) {
      position.element.scrollLeft = position.left;
      position.element.scrollTop = position.top;
    } else {
      window.scrollTo(position.left, position.top);
    }
  }
}

type DialogSize = "sm" | "md" | "lg" | "xl" | "2xl" | "4xl" | "full";

function mapSize(size: DialogSize | undefined) {
  if (size === "sm") {
    return "max-w-md";
  }
  if (size === "lg") {
    return "max-w-2xl";
  }
  if (size === "xl") {
    return "max-w-3xl";
  }
  if (size === "2xl") {
    return "max-w-5xl";
  }
  if (size === "4xl") {
    return "max-w-6xl";
  }
  if (size === "full") {
    return "w-[95vw] max-w-[95vw] h-[95vh] max-h-[95vh]";
  }

  // Default to a width that fits a two-column form without scrolling.
  return "max-w-xl";
}

export interface DialogProps {
  backdrop?: "blur" | "opaque" | "transparent";
  children: React.ReactNode;
  className?: string;
  classNames?: Record<string, string>;
  isDismissable?: boolean;
  open?: boolean;
  onClose?: () => void;
  onOpenChange?: (open: boolean) => void;
  placement?: "center" | "top" | "bottom";
  scrollBehavior?: "inside" | "outside";
  size?: DialogSize;
}

export function Dialog({
  children,
  classNames,
  open = false,
  onClose,
  onOpenChange,
  scrollBehavior,
  size,
}: DialogProps) {
  const previousScrollPositionsRef = React.useRef<ScrollPosition[] | null>(
    null,
  );

  // Radix focus management and scroll locking can move an ancestor scroll
  // container when a modal is opened from a card/grid item. Capture the
  // current positions before the open render and restore them after focus
  // settles so opening a modal never changes the page position.
  React.useLayoutEffect(() => {
    return () => {
      if (!open) {
        previousScrollPositionsRef.current = captureScrollPositions();
      }
    };
  }, [open]);

  React.useLayoutEffect(() => {
    const positions = previousScrollPositionsRef.current;

    if (!open || !positions) {
      return;
    }

    restoreScrollPositions(positions);
    let nestedFrame = 0;
    const frame = window.requestAnimationFrame(() => {
      restoreScrollPositions(positions);
      nestedFrame = window.requestAnimationFrame(() =>
        restoreScrollPositions(positions),
      );
    });

    previousScrollPositionsRef.current = null;

    return () => {
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(nestedFrame);
    };
  }, [open]);

  const lastFocused = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (open) {
      lastFocused.current = document.activeElement as HTMLElement | null;

      return;
    }

    const element = lastFocused.current;

    if (element?.isConnected) {
      element.focus({ preventScroll: true });
    }
  }, [open]);

  const handleOpenChange = (open: boolean) => {
    onOpenChange?.(open);
    if (!open) {
      onClose?.();
    }
  };

  const contextValue = {
    classNames,
    onClose: () => {
      handleOpenChange(false);
    },
    scrollBehavior,
    size,
  };

  return (
    <DialogPrimitive open={open} onOpenChange={handleOpenChange}>
      <DialogContext.Provider value={contextValue}>
        {children}
      </DialogContext.Provider>
    </DialogPrimitive>
  );
}

interface DialogContentProps
  extends Omit<React.ComponentProps<"div">, "children"> {
  children: React.ReactNode | ((onClose: () => void) => React.ReactNode);
  scrollBehavior?: "inside" | "outside";
  size?: DialogSize;
}

export function DialogContent({
  children,
  className,
  scrollBehavior,
  size,
  ...props
}: DialogContentProps) {
  const context = useDialogContext();
  const resolvedScrollBehavior =
    scrollBehavior ?? context?.scrollBehavior ?? "inside";
  const resolvedSize = size ?? context?.size;
  const renderedChildren =
    typeof children === "function"
      ? children(() => context?.onClose())
      : children;

  return (
    <BaseDialogContent
      className={cn(
        mapSize(resolvedSize),
        context?.classNames?.base,
        resolvedScrollBehavior === "outside"
          ? "max-h-[90vh] overflow-y-auto scrollbar-hide"
          : "",
        resolvedScrollBehavior === "inside"
          ? "max-h-[90vh] flex flex-col overflow-hidden [&_[data-slot=dialog-body]]:min-h-0 [&_[data-slot=dialog-body]]:flex-1 [&_[data-slot=dialog-body]]:overflow-y-auto [&_[data-slot=dialog-body]]:scrollbar-hide"
          : "",
        className,
      )}
      showCloseButton={false}
      onOpenAutoFocus={(event) => {
        // Focusing the first field on open pops the native picker for a
        // select and the keyboard for an input on phones. Focus the dialog
        // itself instead; fields with autoFocus still take it.
        event.preventDefault();
        if (!(event.target as HTMLElement).contains(document.activeElement)) {
          (event.target as HTMLElement).focus({ preventScroll: true });
        }
      }}
      {...props}
    >
      {renderedChildren}
    </BaseDialogContent>
  );
}

export function DialogHeader({
  className,
  closable,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  /**
   * Puts a × in the top right corner. Dialogs that only show something
   * close with it; dialogs that edit something close with 取消 instead.
   */
  closable?: boolean;
}) {
  const context = useDialogContext();

  return (
    <DialogTitle asChild>
      <div
        className={cn(
          "text-lg font-semibold",
          closable && "relative pr-10",
          context?.classNames?.header,
          className,
        )}
        data-slot="dialog-header"
        {...props}
      >
        {children}
        {closable && (
          <button
            aria-label="关闭"
            className="absolute -right-1.5 -top-1 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            type="button"
            onClick={() => context?.onClose()}
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
    </DialogTitle>
  );
}

export function DialogBody({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const context = useDialogContext();

  return (
    <div
      className={cn(
        "min-h-0 max-h-[60vh] flex-1 flex flex-col gap-4 overflow-y-auto pr-3 [scrollbar-gutter:stable]",
        context?.classNames?.body,
        className,
      )}
      data-slot="dialog-body"
      {...props}
    />
  );
}

export function DialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const context = useDialogContext();

  return (
    <div
      className={cn(
        "mt-1 flex flex-wrap justify-end gap-2 border-t border-hairline pt-4",
        context?.classNames?.footer,
        className,
      )}
      data-slot="dialog-footer"
      {...props}
    />
  );
}
