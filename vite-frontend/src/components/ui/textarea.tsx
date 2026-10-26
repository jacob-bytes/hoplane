import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "flex min-h-[84px] w-full rounded-md border border-hairline bg-raised px-3 py-2 text-[13px] shadow-none transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground hover:border-hairline-strong focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        className,
      )}
      data-slot="textarea"
      {...props}
    />
  );
}

export { Textarea };
