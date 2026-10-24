import * as React from "react";

import { cn } from "@/lib/utils";

type LinkColor = "default" | "foreground" | "primary";

export interface LinkProps extends React.ComponentProps<"a"> {
  color?: LinkColor;
}

function mapColor(color: LinkColor) {
  if (color === "primary") {
    return "text-primary hover:text-primary/80";
  }
  if (color === "foreground") {
    return "text-foreground hover:text-foreground/80";
  }

  return "text-muted-foreground hover:text-foreground";
}

export function Link({
  className,
  color = "default",
  children,
  ...props
}: LinkProps) {
  return (
    <a
      className={cn("transition-colors", mapColor(color), className)}
      {...props}
    >
      {children}
    </a>
  );
}
