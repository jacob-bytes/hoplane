import { useEffect, useState } from "react";
import { Inbox } from "lucide-react";

import { Button } from "@/shadcn-bridge/heroui/button";
import { Spinner } from "@/shadcn-bridge/heroui/spinner";

// After this long a load is probably stuck (requests time out after 30s).
const SLOW_LOAD_MS = 10_000;

interface BaseStateProps {
  message: string;
  className?: string;
}

export const PageLoadingState = ({
  message,
  className = "h-64",
}: BaseStateProps) => {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), SLOW_LOAD_MS);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 ${className}`}
    >
      <div className="flex items-center gap-3">
        <Spinner size="sm" />
        <span className="text-muted-foreground">{message}</span>
      </div>
      {slow && (
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="text-xs text-muted-foreground">
            加载时间比平时长，可能是网络不稳定或面板没有响应
          </span>
          <Button
            size="sm"
            variant="flat"
            onPress={() => window.location.reload()}
          >
            重新加载
          </Button>
        </div>
      )}
    </div>
  );
};

export const PageEmptyState = ({
  message,
  className = "h-48",
}: BaseStateProps) => {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 ${className}`}
    >
      <Inbox aria-hidden className="h-5 w-5 text-muted-foreground" />
      <span className="text-sm text-muted-foreground">{message}</span>
    </div>
  );
};

export const PageErrorState = ({
  message,
  className = "h-48",
}: BaseStateProps) => {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <span className="text-danger">{message}</span>
    </div>
  );
};

/** Placeholder rows while a list page loads its first data. */
export const ListPageSkeleton = ({ rows = 6 }: { rows?: number }) => (
  <div className="mx-auto w-full max-w-[1440px] px-6 py-6">
    <div className="h-6 w-40 animate-pulse rounded-md bg-muted" />
    <div className="mt-2 h-4 w-64 animate-pulse rounded-md bg-muted" />
    <div className="mt-5 h-9 w-full max-w-sm animate-pulse rounded-lg bg-muted" />
    <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b border-border px-4 py-4 last:border-0"
        >
          <div className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3.5 w-40 animate-pulse rounded bg-muted" />
            <div className="h-3 w-64 animate-pulse rounded bg-muted" />
          </div>
          <div className="hidden h-3 w-24 animate-pulse rounded bg-muted sm:block" />
          <div className="hidden h-3 w-16 animate-pulse rounded bg-muted md:block" />
          <div className="h-5 w-9 animate-pulse rounded-full bg-muted" />
        </div>
      ))}
    </div>
  </div>
);
