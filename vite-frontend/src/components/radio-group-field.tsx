import { useId } from "react";

import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

/** Label + shadcn RadioGroup, preserving the app's horizontal/vertical forms. */
export function RadioGroupField({
  label,
  orientation = "vertical",
  value,
  onValueChange,
  className,
  children,
}: {
  label?: React.ReactNode;
  orientation?: "horizontal" | "vertical";
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {label ? <p className="text-sm font-medium">{label}</p> : null}
      <RadioGroup
        className={
          orientation === "horizontal"
            ? "flex flex-wrap items-center gap-4"
            : "grid gap-3"
        }
        value={value}
        onValueChange={onValueChange}
      >
        {children}
      </RadioGroup>
    </div>
  );
}

export function RadioOption({
  value,
  children,
}: {
  value: string;
  children: React.ReactNode;
}) {
  const id = useId();

  return (
    <div className="flex items-center gap-2">
      <RadioGroupItem id={id} value={value} />
      <Label htmlFor={id}>{children}</Label>
    </div>
  );
}
