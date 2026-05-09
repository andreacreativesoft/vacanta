"use client";

import * as React from "react";
import { CheckIcon } from "lucide-react";

import { cn } from "@/lib/utils";

function Checkbox({
  className,
  checked,
  defaultChecked,
  onCheckedChange,
  ...props
}: Omit<React.ComponentProps<"input">, "type" | "onChange"> & {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}) {
  return (
    <label className={cn("relative inline-flex items-center", className)}>
      <input
        type="checkbox"
        data-slot="checkbox"
        checked={checked}
        defaultChecked={defaultChecked}
        onChange={(e) => onCheckedChange?.(e.target.checked)}
        className="peer border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 size-4 shrink-0 cursor-pointer appearance-none rounded-[4px] border shadow-xs transition-shadow outline-none checked:bg-primary checked:text-primary-foreground focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
        {...props}
      />
      <CheckIcon className="absolute left-0 size-4 pointer-events-none opacity-0 peer-checked:opacity-100 text-primary-foreground" />
    </label>
  );
}

export { Checkbox };
