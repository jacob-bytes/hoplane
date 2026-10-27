import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium leading-5 transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary:
          "border-transparent bg-secondary/10 text-secondary-700 dark:text-secondary-300",
        destructive: "border-transparent bg-destructive/10 text-destructive",
        outline: "border-border text-foreground",
        success:
          "border-transparent bg-success/10 text-success-700 dark:text-success-400",
        warning:
          "border-transparent bg-warning/10 text-warning-700 dark:text-warning-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      className={cn(badgeVariants({ className, variant }))}
      data-slot="badge"
      {...props}
    />
  );
}

/** Map legacy HeroUI tones (incl. primary/danger) to a badge variant. */
export function badgeTone(tone: string) {
  if (tone === "danger" || tone === "destructive")
    return "destructive" as const;
  if (tone === "primary" || tone === "default") return "default" as const;
  if (tone === "success" || tone === "warning" || tone === "secondary") {
    return tone;
  }

  return "outline" as const;
}

export { Badge, badgeVariants };
