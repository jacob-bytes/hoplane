import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type ProgressTone =
  | "default"
  | "primary"
  | "secondary"
  | "success"
  | "warning"
  | "danger";

const TONE: Record<ProgressTone, string> = {
  default: "bg-primary",
  primary: "bg-primary",
  secondary: "bg-secondary-foreground/60",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
};

/**
 * Progress with the label/percent/tone options the app uses, built on the
 * shadcn Progress primitive. Presentational only — no HeroUI API.
 */
export function ProgressBar({
  value = 0,
  color = "primary",
  size = "md",
  label,
  showValueLabel,
  className,
  "aria-label": ariaLabel,
}: {
  value?: number;
  color?: ProgressTone;
  size?: "sm" | "md" | "lg";
  label?: React.ReactNode;
  showValueLabel?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  const hasHeader = Boolean(label) || Boolean(showValueLabel);

  return (
    <div className="flex w-full flex-col gap-1">
      {hasHeader && (
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="truncate">{label}</span>
          {showValueLabel && (
            <span className="tabular-nums">{Math.round(value)}%</span>
          )}
        </div>
      )}
      <Progress
        aria-label={ariaLabel}
        className={cn(size === "sm" && "h-1.5", size === "lg" && "h-3", className)}
        indicatorClassName={TONE[color]}
        value={value}
      />
    </div>
  );
}
