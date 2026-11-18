"use client";

import type { ComponentProps, HTMLAttributes } from "react";
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentTitle,
} from "@/components/ui/attachment";
import { InputGroupAddon } from "@/components/ui/input-group";
import { XIcon } from "@/components/ui/vpk-icons";
import { getAttachmentLabel } from "@/lib/attachment-media";
import { cn } from "@/lib/utils";
import { AttachmentPartMedia } from "@/components/ui-custom/attachment-part-media";
import { usePromptInputAttachments } from "@/components/ui-custom/prompt-input/prompt-input-context";

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

const promptInputHeaderClassName = "flex-wrap gap-1";

// Default header content: each pending attachment as a small Attachment chip
// with a remove button, following shadcn's Prompt Input composition.
const PromptInputHeaderAttachments = ({
  className,
  ...props
}: Readonly<PromptInputHeaderProps>) => {
  const attachments = usePromptInputAttachments();

  if (attachments.files.length === 0) {
    return null;
  }

  return (
    <InputGroupAddon
      align="block-start"
      className={cn(promptInputHeaderClassName, className)}
      {...props}
    >
      {attachments.files.map((file) => {
        const label = getAttachmentLabel(file);
        return (
          <Attachment key={file.id} size="sm">
            <AttachmentPartMedia data={file} />
            <AttachmentContent>
              <AttachmentTitle>{label}</AttachmentTitle>
            </AttachmentContent>
            <AttachmentActions>
              <AttachmentAction
                aria-label={`Remove ${label}`}
                onClick={() => attachments.remove(file.id)}
              >
                <XIcon label="" />
              </AttachmentAction>
            </AttachmentActions>
          </Attachment>
        );
      })}
    </InputGroupAddon>
  );
};

/**
 * Top addon row. With children it renders them (tabs, modes, context chips);
 * without children it shows each pending attachment as an `Attachment`.
 */
export const PromptInputHeader = ({
  className,
  children,
  ...props
}: Readonly<PromptInputHeaderProps>) =>
  children == null ? (
    <PromptInputHeaderAttachments className={className} {...props} />
  ) : (
    <InputGroupAddon
      align="block-start"
      className={cn(promptInputHeaderClassName, className)}
      {...props}
    >
      {children}
    </InputGroupAddon>
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
