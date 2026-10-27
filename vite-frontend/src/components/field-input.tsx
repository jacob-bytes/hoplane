import { useId } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type FieldClassNames = {
  base?: string;
  label?: string;
  input?: string;
  inputWrapper?: string;
  description?: string;
  errorMessage?: string;
};

type FieldProps = {
  label?: React.ReactNode;
  description?: React.ReactNode;
  errorMessage?: React.ReactNode;
  isInvalid?: boolean;
  isDisabled?: boolean;
  isRequired?: boolean;
  classNames?: FieldClassNames;
  startContent?: React.ReactNode;
  endContent?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  variant?: string;
  minRows?: number;
  maxRows?: number;
};

function sizeClass(size?: FieldProps["size"]) {
  if (size === "sm") return "h-8 text-xs";
  if (size === "lg") return "h-10 text-base";

  return "";
}

/** Label + ui Input + description/error, keeping the call-site prop names. */
export function TextField({
  label,
  description,
  errorMessage,
  isInvalid,
  isDisabled,
  isRequired,
  classNames,
  startContent,
  endContent,
  size,
  variant: _variant,
  className,
  id,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> & FieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const descId = `${fieldId}-description`;
  const errorId = `${fieldId}-error`;
  const invalid = Boolean(isInvalid) || Boolean(errorMessage);

  return (
    <div
      className={cn("flex w-full flex-col gap-1.5", classNames?.base)}
      data-invalid={invalid || undefined}
    >
      {label ? (
        <Label className={classNames?.label} htmlFor={fieldId}>
          {label}
          {isRequired && (
            <span aria-hidden className="text-destructive">
              *
            </span>
          )}
        </Label>
      ) : null}
      <div
        className={cn("relative flex items-center", classNames?.inputWrapper)}
      >
        {startContent ? (
          <span className="pointer-events-none absolute left-3 flex items-center text-muted-foreground">
            {startContent}
          </span>
        ) : null}
        <Input
          aria-describedby={
            cn(description && descId, errorMessage && errorId) || undefined
          }
          aria-invalid={invalid || undefined}
          className={cn(
            sizeClass(size),
            startContent && "pl-9",
            endContent && "pr-9",
            classNames?.input,
            className,
          )}
          disabled={isDisabled}
          id={fieldId}
          required={isRequired}
          {...props}
        />
        {endContent ? (
          <span className="absolute right-3 flex items-center text-muted-foreground">
            {endContent}
          </span>
        ) : null}
      </div>
      {description && !errorMessage ? (
        <p
          className={cn(
            "text-xs text-muted-foreground",
            classNames?.description,
          )}
          id={descId}
        >
          {description}
        </p>
      ) : null}
      {errorMessage ? (
        <p
          className={cn("text-xs text-destructive", classNames?.errorMessage)}
          id={errorId}
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}

export function TextAreaField({
  label,
  description,
  errorMessage,
  isInvalid,
  isDisabled,
  isRequired,
  classNames,
  size,
  variant: _variant,
  minRows,
  maxRows: _maxRows,
  className,
  id,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const descId = `${fieldId}-description`;
  const errorId = `${fieldId}-error`;
  const invalid = Boolean(isInvalid) || Boolean(errorMessage);

  return (
    <div
      className={cn("flex w-full flex-col gap-1.5", classNames?.base)}
      data-invalid={invalid || undefined}
    >
      {label ? (
        <Label className={classNames?.label} htmlFor={fieldId}>
          {label}
          {isRequired && (
            <span aria-hidden className="text-destructive">
              *
            </span>
          )}
        </Label>
      ) : null}
      <Textarea
        aria-describedby={
          cn(description && descId, errorMessage && errorId) || undefined
        }
        aria-invalid={invalid || undefined}
        className={cn(sizeClass(size), classNames?.input, className)}
        disabled={isDisabled}
        id={fieldId}
        required={isRequired}
        rows={props.rows ?? minRows}
        {...props}
      />
      {description && !errorMessage ? (
        <p
          className={cn(
            "text-xs text-muted-foreground",
            classNames?.description,
          )}
          id={descId}
        >
          {description}
        </p>
      ) : null}
      {errorMessage ? (
        <p
          className={cn("text-xs text-destructive", classNames?.errorMessage)}
          id={errorId}
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
