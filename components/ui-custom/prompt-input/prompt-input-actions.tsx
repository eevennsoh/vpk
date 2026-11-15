"use client";

import type { ComponentProps } from "react";
import { useCallback } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  type DropdownMenuItemProps,
} from "@/components/ui/dropdown-menu";
import { ImageIcon, MonitorIcon, PlusIcon } from "@/components/ui/vpk-icons";
import { cn } from "@/lib/utils";
import {
  PromptInputButton,
  type PromptInputButtonProps,
} from "@/components/ui-custom/prompt-input-button";
import { usePromptInputAttachments } from "@/components/ui-custom/prompt-input/prompt-input-context";
import { captureScreenshot } from "@/components/ui-custom/prompt-input/prompt-input-helpers";

export type PromptInputActionAddAttachmentsProps = ComponentProps<
  typeof DropdownMenuItem
> & {
  label?: string;
};

export const PromptInputActionAddAttachments = ({
  label = "Add photos or files",
  children,
  onClick,
  ...props
}: Readonly<PromptInputActionAddAttachmentsProps>) => {
  const attachments = usePromptInputAttachments();

  const handleClick: NonNullable<DropdownMenuItemProps["onClick"]> = useCallback(
    (e) => {
      onClick?.(e);
      attachments.openFileDialog();
    },
    [onClick, attachments]
  );

  return (
    <DropdownMenuItem {...props} onClick={handleClick}>
      {children ?? <><ImageIcon className="mr-2 size-4" /> {label}</>}
    </DropdownMenuItem>
  );
};

export type PromptInputActionAddScreenshotProps = ComponentProps<
  typeof DropdownMenuItem
> & {
  label?: string;
};

export const PromptInputActionAddScreenshot = ({
  label = "Take screenshot",
  children,
  onClick,
  ...props
}: Readonly<PromptInputActionAddScreenshotProps>) => {
  const attachments = usePromptInputAttachments();

  const handleClick: NonNullable<DropdownMenuItemProps["onClick"]> = useCallback(
    async (e) => {
      onClick?.(e);

      try {
        const screenshot = await captureScreenshot();
        if (screenshot) {
          attachments.add([screenshot]);
        }
      } catch (error) {
        if (
          error instanceof DOMException &&
          (error.name === "NotAllowedError" || error.name === "AbortError")
        ) {
          return;
        }
        throw error;
      }
    },
    [onClick, attachments]
  );

  return (
    <DropdownMenuItem {...props} onClick={handleClick}>
      {children ?? <><MonitorIcon className="mr-2 size-4" />{label}</>}
    </DropdownMenuItem>
  );
};

export type PromptInputActionMenuProps = ComponentProps<typeof DropdownMenu>;
export const PromptInputActionMenu = (props: Readonly<PromptInputActionMenuProps>) => (
  <DropdownMenu {...props} />
);

export type PromptInputActionMenuTriggerProps = PromptInputButtonProps;

export const PromptInputActionMenuTrigger = ({
  className,
  children,
  ...props
}: Readonly<PromptInputActionMenuTriggerProps>) => (
  <DropdownMenuTrigger render={<PromptInputButton className={className} {...props} />}>{children ?? <PlusIcon className="size-4" />}</DropdownMenuTrigger>
);

export type PromptInputActionMenuContentProps = ComponentProps<
  typeof DropdownMenuContent
>;
export const PromptInputActionMenuContent = ({
  className,
  ...props
}: Readonly<PromptInputActionMenuContentProps>) => (
  <DropdownMenuContent
    align="start"
    className={cn("w-auto min-w-[200px]", className)}
    {...props}
  />
);

export type PromptInputActionMenuItemProps = ComponentProps<
  typeof DropdownMenuItem
>;
export const PromptInputActionMenuItem = ({
  className,
  ...props
}: Readonly<PromptInputActionMenuItemProps>) => (
  <DropdownMenuItem className={cn(className)} {...props} />
);

// Note: Actions that perform side-effects (like opening a file dialog)
// are provided in opt-in modules (e.g., prompt-input-attachments).
