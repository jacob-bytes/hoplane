import * as React from "react";
import { Toaster } from "sonner";

import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

export interface ProvidersProps {
  children: React.ReactNode;
}

export function Provider({ children }: ProvidersProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <ThemeProvider>
        {children}
        <Toaster
          closeButton
          position="top-center"
          toastOptions={{
            className:
              "rounded-xl border border-border bg-popover text-sm text-popover-foreground shadow-lg",
            duration: 2400,
          }}
        />
      </ThemeProvider>
    </TooltipProvider>
  );
}
