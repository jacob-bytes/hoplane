import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "flex min-h-[84px] w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-xs transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground hover:border-border focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      data-slot="textarea"
      {...props}
    />
  );
}

export { Textarea };
