import type { ReactNode } from "react";

import { Card, CardBody } from "@/shadcn-bridge/heroui/card";

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
}: MetricCardProps) => {
  return (
    <Card className="flex h-auto min-w-0 flex-col justify-between overflow-hidden sm:h-48">
      <CardBody className="flex h-full min-w-0 flex-col justify-between overflow-visible !p-4">
        <div className="flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground truncate">
              {title}
            </p>
            <div className={`p-2 rounded-xl flex-shrink-0 ${iconClassName}`}>
              {icon}
            </div>
          </div>
          <p className="mt-2 truncate text-2xl font-semibold tracking-tight text-foreground tabular lg:text-3xl">
            {value}
          </p>
        </div>
        <div className="mt-auto pt-4">{bottomContent}</div>
      </CardBody>
    </Card>
  );
};
