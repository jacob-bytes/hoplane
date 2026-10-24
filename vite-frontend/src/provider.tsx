import * as React from "react";
import { useHref, useNavigate } from "react-router-dom";
import { Toaster } from "sonner";
import { I18nProvider } from "@react-aria/i18n";

import { HeroUIProvider } from "@/shadcn-bridge/heroui/system";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

export interface ProvidersProps {
  children: React.ReactNode;
}

export function Provider({ children }: ProvidersProps) {
  const navigate = useNavigate();

  return (
    <I18nProvider locale="zh-CN">
      <HeroUIProvider navigate={navigate} useHref={useHref}>
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
      </HeroUIProvider>
    </I18nProvider>
  );
}
