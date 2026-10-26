import type * as React from "react";

import { cloneElement, isValidElement } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * label + control + description/error, wired for a11y:
 *
 *   <FormField id="name" label="名称" error={err}>
 *     <Input />
 *   </FormField>
 *
 * The control receives `id`, `aria-invalid` and `aria-describedby`; no need
 * to repeat them at the call site.
 */
export function FormField({
  id,
  label,
  description,
  error,
  required,
  className,
  children,
}: {
  id: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const descId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [descId, errorId].filter(Boolean).join(" ") || undefined;

  const control = isValidElement(children)
    ? cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
      })
    : children;

  return (
    <div
      className={cn("flex flex-col gap-1.5", className)}
      data-invalid={error ? "" : undefined}
    >
      <Label className="gap-1" htmlFor={id}>
        {label}
        {required && (
          <span aria-hidden className="text-destructive">
            *
          </span>
        )}
      </Label>
      {control}
      {description && !error && (
        <p className="text-xs text-muted-foreground" id={descId}>
          {description}
        </p>
      )}
      {error && (
        <p className="text-xs text-destructive" id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
