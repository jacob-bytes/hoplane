import * as React from "react";
import { useHref, useNavigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { I18nProvider } from "@react-aria/i18n";

import { HeroUIProvider } from "@/shadcn-bridge/heroui/system";
import { ThemeProvider } from "@/components/theme-provider";

export interface ProvidersProps {
  children: React.ReactNode;
}

export function Provider({ children }: ProvidersProps) {
  const navigate = useNavigate();

  return (
    <I18nProvider locale="zh-CN">
      <HeroUIProvider navigate={navigate} useHref={useHref}>
        <ThemeProvider>
          {children}
          <Toaster
            position="top-center"
            toastOptions={{
              duration: 2000,
              className: "text-sm",
              style: {
                background: "var(--popover)",
                color: "var(--popover-foreground)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: "8px 12px",
                boxShadow: "0 8px 24px rgb(0 0 0 / 0.12)",
              },
              success: {
                duration: 2000,
                iconTheme: {
                  primary: "var(--success)",
                  secondary: "var(--popover)",
                },
              },
              error: {
                duration: 2000,
                iconTheme: {
                  primary: "var(--destructive)",
                  secondary: "var(--popover)",
                },
              },
            }}
          />
        </ThemeProvider>
      </HeroUIProvider>
    </I18nProvider>
  );
}
