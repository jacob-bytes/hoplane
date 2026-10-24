import { useEffect, useState } from "react";
import { Inbox } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
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
            variant="secondary"
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
    <Skeleton className="h-6 w-40" />
    <Skeleton className="mt-2 h-4 w-64" />
    <Skeleton className="mt-5 h-9 w-full max-w-sm rounded-lg" />
    <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b border-border px-4 py-4 last:border-0"
        >
          <Skeleton className="h-2 w-2 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3 w-64" />
          </div>
          <Skeleton className="hidden h-3 w-24 sm:block" />
          <Skeleton className="hidden h-3 w-16 md:block" />
          <Skeleton className="h-5 w-9 rounded-full" />
        </div>
      ))}
    </div>
  </div>
);
