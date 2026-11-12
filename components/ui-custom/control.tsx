"use client";

import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";
import { Controls as ControlPrimitive } from "@xyflow/react";

export type ControlProps = ComponentProps<typeof ControlPrimitive>;

export const Control = ({ className, ...props }: ControlProps) => (
  <ControlPrimitive
    className={cn(
      "gap-px overflow-hidden rounded-md border bg-card p-1 shadow-none!",
      "[&>button]:rounded-md [&>button]:border-none! [&>button]:bg-transparent! [&>button]:hover:bg-secondary!",
      className
    )}
    {...props}
  />
);
