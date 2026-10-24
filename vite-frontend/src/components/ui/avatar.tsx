import { cn } from "@/lib/utils";

const SIZES = {
  sm: "h-7 w-7 text-[11px]",
  md: "h-12 w-12 text-base",
  lg: "h-16 w-16 text-2xl",
} as const;

/**
 * Initials avatar. There is no image upload, so the fallback is the only
 * state, which keeps it dependency-free.
 */
export function Avatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const initial = (name || "?").slice(0, 1).toUpperCase();

  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 select-none items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground",
        SIZES[size],
        className,
      )}
    >
      {initial}
    </span>
  );
}
