import * as React from "react";

import { Badge as BaseBadge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type BadgeVariant =
  | "default"
  | "secondary"
  | "outline"
  | "destructive"
  | "success"
  | "warning";

type LegacyColor =
  | "default"
  | "primary"
  | "secondary"
  | "success"
  | "warning"
  | "danger";

const COLOR_TO_VARIANT: Record<LegacyColor, BadgeVariant> = {
  default: "outline",
  primary: "default",
  secondary: "secondary",
  success: "success",
  warning: "warning",
  danger: "destructive",
};

export interface BadgeProps
  extends Omit<React.ComponentProps<"span">, "color"> {
  variant?: BadgeVariant;
  /** Legacy dynamic tone; overrides `variant` when set. */
  color?: LegacyColor;
  /** Legacy HeroUI size; kept so older call sites keep their padding. */
  size?: "sm" | "md" | "lg";
}

/** shadcn Badge with the HeroUI size scale kept for existing call sites. */
export function Badge({
  className,
  color,
  size = "md",
  variant = "outline",
  ...props
}: BadgeProps) {
  const resolved = color ? COLOR_TO_VARIANT[color] : variant;

  return (
    <BaseBadge
      className={cn(
        size === "sm" ? "px-2 py-0 text-[11px]" : "",
        size === "lg" ? "px-3 py-1 text-sm" : "",
        className,
      )}
      variant={resolved}
      {...props}
    />
  );
}

export type { BadgeVariant };
