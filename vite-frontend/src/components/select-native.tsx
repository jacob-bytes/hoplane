import { useId } from "react";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type SelectOption = {
  value: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
};

/** Label + shadcn Select + error/description, with a plain string value API. */
export function SelectField({
  label,
  description,
  errorMessage,
  isInvalid,
  isDisabled,
  isRequired,
  placeholder,
  value,
  onValueChange,
  options,
  className,
  labelClassName,
  size,
  onClick,
  "aria-label": ariaLabel,
}: {
  label?: React.ReactNode;
  description?: React.ReactNode;
  errorMessage?: React.ReactNode;
  isInvalid?: boolean;
  isDisabled?: boolean;
  isRequired?: boolean;
  placeholder?: string;
  value?: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  className?: string;
  labelClassName?: string;
  size?: "sm" | "md" | "lg";
  "aria-label"?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
}) {
  const autoId = useId();
  const id = autoId;
  const invalid = Boolean(isInvalid) || Boolean(errorMessage);
  const sizeClass =
    size === "sm" ? "h-8 text-xs" : size === "lg" ? "h-10 text-base" : "";

  return (
    <div className="flex w-full flex-col gap-1.5">
      {label ? (
        <Label className={labelClassName} htmlFor={id}>
          {label}
          {isRequired ? <span className="ml-1 text-destructive">*</span> : null}
        </Label>
      ) : null}
      <Select
        disabled={isDisabled}
        required={isRequired}
        value={value || undefined}
        onValueChange={onValueChange}
      >
        <SelectTrigger
          aria-invalid={invalid || undefined}
          aria-label={ariaLabel}
          className={cn(sizeClass, className)}
          id={id}
          onClick={onClick}
        >
          <SelectValue placeholder={placeholder ?? "请选择"} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem
              key={option.value}
              disabled={option.disabled}
              value={option.value}
            >
              <div className="flex flex-col gap-0.5">
                <span>{option.label}</span>
                {option.description ? (
                  <span className="text-[11px] text-muted-foreground">
                    {option.description}
                  </span>
                ) : null}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
