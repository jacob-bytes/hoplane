import { useId } from "react";
import { ChevronDown } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type MultiSelectOption = {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
};

/** Checkbox list in a dropdown; stays open while toggling. */
export function MultiSelectField({
  label,
  description,
  errorMessage,
  isDisabled,
  isRequired,
  placeholder = "请选择",
  values,
  onValuesChange,
  options,
  className,
  labelClassName,
  size = "md",
  side = "bottom",
  emptyText = "暂无可选项",
}: {
  label?: React.ReactNode;
  description?: React.ReactNode;
  errorMessage?: React.ReactNode;
  isInvalid?: boolean;
  isDisabled?: boolean;
  isRequired?: boolean;
  placeholder?: string;
  values: string[];
  onValuesChange: (values: string[]) => void;
  options: MultiSelectOption[];
  className?: string;
  labelClassName?: string;
  size?: "sm" | "md";
  side?: "top" | "bottom";
  emptyText?: string;
}) {
  const id = useId();
  const selected = options.filter((option) => values.includes(option.value));
  const textLabels = selected.map((option) =>
    typeof option.label === "string" ? option.label : null,
  );
  const summary =
    selected.length === 0
      ? placeholder
      : textLabels.every(Boolean)
        ? textLabels.join("、")
        : `已选 ${selected.length} 项`;

  const toggle = (value: string, checked: boolean) => {
    onValuesChange(
      checked ? [...values, value] : values.filter((item) => item !== value),
    );
  };

  return (
    <div className="flex w-full min-w-0 flex-col gap-1.5">
      {label ? (
        <Label className={labelClassName} htmlFor={id}>
          {label}
          {isRequired ? <span className="ml-1 text-destructive">*</span> : null}
        </Label>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              "flex w-full min-w-0 items-center justify-between gap-2 rounded-md border border-hairline bg-raised px-3 text-left text-[13px] transition-[border-color,box-shadow] duration-150 hover:border-hairline-strong focus:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-50",
              size === "sm" ? "h-8 text-xs" : "h-9",
              className,
            )}
            disabled={isDisabled}
            id={id}
            type="button"
          >
            <span
              className={cn(
                "min-w-0 flex-1 truncate",
                selected.length === 0 && "text-muted-foreground",
              )}
              title={selected.length > 0 ? String(summary) : undefined}
            >
              {summary}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="max-h-72 w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto"
          side={side}
        >
          {options.length === 0 ? (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              {emptyText}
            </div>
          ) : (
            options.map((option) => (
              <DropdownMenuItem
                key={option.value}
                className="gap-2"
                disabled={option.disabled}
                onSelect={(event) => {
                  event.preventDefault();
                  toggle(option.value, !values.includes(option.value));
                }}
              >
                <Checkbox
                  checked={values.includes(option.value)}
                  className="pointer-events-none"
                  tabIndex={-1}
                />
                <span className="min-w-0">{option.label}</span>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {description && !errorMessage ? (
        <p className="text-xs text-muted-foreground">{description}</p>
      ) : null}
      {errorMessage ? (
        <p className="text-xs text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
