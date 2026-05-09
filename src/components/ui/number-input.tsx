"use client";

import * as React from "react";
import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type NumberInputProps = {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  inputClassName?: string;
  id?: string;
  ariaLabel?: string;
};

/**
 * Mobile-friendly numeric input with explicit − / + steppers.
 * Avoids the "tap-to-edit appends digits" problem on Android Chrome.
 */
export function NumberInput({
  value,
  onValueChange,
  min = 0,
  max = 99,
  step = 1,
  className,
  inputClassName,
  id,
  ariaLabel,
}: NumberInputProps) {
  function clamp(n: number) {
    if (Number.isNaN(n)) return min;
    return Math.min(max, Math.max(min, n));
  }

  function dec() {
    onValueChange(clamp(value - step));
  }
  function inc() {
    onValueChange(clamp(value + step));
  }

  return (
    <div
      className={cn(
        "flex items-stretch rounded-md border bg-transparent shadow-xs overflow-hidden",
        className,
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={dec}
        disabled={value <= min}
        aria-label="Decrease"
        className="h-9 w-9 rounded-none border-r"
      >
        <Minus className="size-3.5" />
      </Button>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        value={value}
        min={min}
        max={max}
        step={step}
        aria-label={ariaLabel}
        onChange={(e) => {
          const parsed = parseInt(e.target.value, 10);
          onValueChange(Number.isNaN(parsed) ? min : clamp(parsed));
        }}
        className={cn(
          "h-9 flex-1 min-w-0 rounded-none border-0 text-center shadow-none focus-visible:ring-0 focus-visible:border-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
          inputClassName,
        )}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={inc}
        disabled={value >= max}
        aria-label="Increase"
        className="h-9 w-9 rounded-none border-l"
      >
        <Plus className="size-3.5" />
      </Button>
    </div>
  );
}
