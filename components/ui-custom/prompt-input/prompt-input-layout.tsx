"use client";

import type { ComponentProps, HTMLAttributes } from "react";
import { InputGroupAddon } from "@/components/ui/input-group";
import { cn } from "@/lib/utils";

export type PromptInputBodyProps = HTMLAttributes<HTMLDivElement>;

export const PromptInputBody = ({
  className,
  ...props
}: Readonly<PromptInputBodyProps>) => (
  <div className={cn("contents", className)} {...props} />
);

export type PromptInputHeaderProps = Omit<
  ComponentProps<typeof InputGroupAddon>,
  "align"
>;

export const PromptInputHeader = ({
  className,
  ...props
}: Readonly<PromptInputHeaderProps>) => (
  <InputGroupAddon
    align="block-end"
    className={cn("order-first flex-wrap gap-1", className)}
    {...props}
  />
);

export type PromptInputFooterProps = Omit<
  ComponentProps<typeof InputGroupAddon>,
  "align"
>;

export const PromptInputFooter = ({
  className,
  ...props
}: Readonly<PromptInputFooterProps>) => (
  <InputGroupAddon
    align="block-end"
    className={cn("justify-between gap-1", className)}
    {...props}
  />
);

export type PromptInputToolsProps = HTMLAttributes<HTMLDivElement>;

export const PromptInputTools = ({
  className,
  ...props
}: Readonly<PromptInputToolsProps>) => (
  <div
    className={cn("flex min-w-0 items-center gap-1", className)}
    {...props}
  />
);
