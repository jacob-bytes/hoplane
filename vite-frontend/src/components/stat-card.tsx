import type * as React from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** A single KPI: label, big tabular number, optional unit and hint. */
export function StatCard({
  label,
  value,
  unit,
  hint,
  icon,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  unit?: string;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("gap-1 py-4", className)}>
      <CardHeader className="px-4">
        <CardDescription className="flex items-center justify-between gap-2 text-xs">
          <span className="truncate">{label}</span>
          {icon && (
            <span aria-hidden className="text-muted-foreground">
              {icon}
            </span>
          )}
        </CardDescription>
        <div className="flex items-baseline gap-1">
          <span className="font-mono text-2xl font-semibold tabular-nums text-foreground">
            {value}
          </span>
          {unit && (
            <span className="text-xs text-muted-foreground">{unit}</span>
          )}
        </div>
      </CardHeader>
      {hint && (
        <CardContent className="px-4">
          <p className="text-xs text-muted-foreground">{hint}</p>
        </CardContent>
      )}
    </Card>
  );
}
