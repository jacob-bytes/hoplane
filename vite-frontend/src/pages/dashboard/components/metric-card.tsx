import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";

interface MetricCardProps {
  title: string;
  value: string | number;
  iconClassName: string;
  icon: ReactNode;
  bottomContent?: ReactNode;
}

export const MetricCard = ({
  title,
  value,
  iconClassName,
  icon,
  bottomContent,
  onClick,
}: MetricCardProps & { onClick?: () => void }) => {
  return (
    <Card
      className={`flex h-auto min-w-0 flex-col justify-between overflow-hidden ${onClick ? "cursor-pointer transition-colors hover:border-hairline-strong" : ""}`}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(event) => {
        if (!onClick || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        onClick();
      }}
    >
      <CardContent className="flex h-full min-w-0 flex-col justify-between overflow-visible !p-4">
        <div className="flex flex-col">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground truncate">
              {title}
            </p>
            <div className={`flex-shrink-0 rounded-md p-1.5 ${iconClassName}`}>
              {icon}
            </div>
          </div>
          <p className="mt-1 truncate text-xl font-semibold tracking-tight text-foreground tabular sm:text-2xl">
            {value}
          </p>
        </div>
        <div className="mt-2.5">{bottomContent}</div>
      </CardContent>
    </Card>
  );
};
