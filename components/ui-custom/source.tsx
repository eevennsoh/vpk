"use client";

import type { ComponentProps } from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  BookIcon,
  ChevronDownIcon,
} from "@/components/ui/vpk-icons";
import { cn } from "@/lib/utils";

export type SourceProps = ComponentProps<"div">;

export const Source = ({ className, ...props }: SourceProps) => (
  <Collapsible
    className={cn("not-prose mb-4 text-primary text-xs", className)}
    {...props}
  />
);

export type SourceTriggerProps = ComponentProps<typeof CollapsibleTrigger> & {
  count: number;
};

export const SourceTrigger = ({
  className,
  count,
  children,
  ...props
}: SourceTriggerProps) => (
  <CollapsibleTrigger
    className={cn("flex items-center gap-2", className)}
    {...props}
  >
    {children ?? (
      <>
        <p className="font-medium">Used {count} sources</p>
        <ChevronDownIcon size="small" />
      </>
    )}
  </CollapsibleTrigger>
);

export type SourceContentProps = ComponentProps<typeof CollapsibleContent>;

export const SourceContent = ({
  className,
  ...props
}: SourceContentProps) => (
  <CollapsibleContent
    className={cn(
      "mt-3 flex w-fit flex-col gap-2",
      "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 outline-none data-[state=closed]:animate-out data-[state=open]:animate-in",
      className
    )}
    {...props}
  />
);

export type SourceItemProps = ComponentProps<"a">;

export const SourceItem = ({ href, title, children, ...props }: SourceItemProps) => (
  <a
    className="flex items-center gap-2"
    href={href}
    rel="noreferrer"
    target="_blank"
    {...props}
  >
    {children ?? (
      <>
        <BookIcon size="small" />
        <span className="block font-medium">{title}</span>
      </>
    )}
  </a>
);
