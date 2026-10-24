import * as React from "react";

import { Badge } from "./badge";

type ChipColor =
  | "default"
  | "primary"
  | "secondary"
  | "success"
  | "warning"
  | "danger";
type ChipVariant = "solid" | "flat" | "light" | "bordered";
type ChipSize = "sm" | "md" | "lg";

export interface ChipProps extends React.ComponentProps<"span"> {
  color?: ChipColor;
  size?: ChipSize;
  variant?: ChipVariant;
}

/** Legacy HeroUI name; prefer `Badge` in new code. */
export function Chip({ variant = "flat", ...props }: ChipProps) {
  return (
    <Badge
      {...props}
      variant={variant === "bordered" ? "outline" : "secondary"}
    />
  );
}
