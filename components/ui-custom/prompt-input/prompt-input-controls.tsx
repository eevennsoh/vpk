"use client";

import type { ChatStatus } from "ai";
import type { ComponentProps, HTMLAttributes } from "react";
import { useCallback } from "react";
import RandomizeIcon from "@atlaskit/icon-lab/core/randomize";
import { InputGroupButton } from "@/components/ui/input-group";
import { ArrowUpIcon, MicIcon, XIcon } from "@/components/ui/vpk-icons";
import { cn } from "@/lib/utils";
import {
  PromptInputButton,
  type PromptInputButtonProps,
} from "@/components/ui-custom/prompt-input-button";
import { TWGAppstack, type TwgToolSource } from "@/components/ui-custom/twg-appstack";

export type PromptInputAutoButtonProps = PromptInputButtonProps;

export const PromptInputAutoButton = ({
  children,
  className,
  size = "sm",
  variant = "ghost",
  ...props
}: Readonly<PromptInputAutoButtonProps>) => (
  <PromptInputButton
    className={cn("min-w-[78px]", className)}
    size={size}
    variant={variant}
    {...props}
  >
    {children ?? (
      <>
        <RandomizeIcon label="" />
        <span>Auto</span>
      </>
    )}
  </PromptInputButton>
);

export type PromptInputSendControlsProps = HTMLAttributes<HTMLDivElement> & {
  autoButtonProps?: PromptInputAutoButtonProps;
  submitProps?: PromptInputSubmitProps;
};

export const PromptInputSendControls = ({
  autoButtonProps = {},
  className,
  submitProps = {},
  ...props
}: Readonly<PromptInputSendControlsProps>) => {
  const { children: autoChildren, ...resolvedAutoButtonProps } = autoButtonProps;
  const { children: submitChildren, ...resolvedSubmitProps } = submitProps;

  return (
    <div className={cn("flex shrink-0 items-center gap-1", className)} {...props}>
      <PromptInputAutoButton {...resolvedAutoButtonProps}>
        {autoChildren}
      </PromptInputAutoButton>
      <PromptInputSubmit {...resolvedSubmitProps}>
        {submitChildren ?? <ArrowUpIcon className="size-4" />}
      </PromptInputSubmit>
    </div>
  );
};

const PROMPT_INPUT_PREFERENCE_SOURCES: ReadonlyArray<TwgToolSource> = [
	{ id: "google-drive", label: "Google Drive", provider: "google-drive" },
	{ id: "microsoft-teams", label: "Microsoft Teams", provider: "twg", name: "microsoft-teams" },
	{ id: "teams", label: "Teams", provider: "teams" },
	{ id: "jira", label: "Jira", provider: "jira" },
];

export type PromptInputPreferencesButtonProps = Omit<
  PromptInputButtonProps,
  "children" | "size"
> & {
  overflowCount?: number;
};

export const PromptInputPreferencesButton = ({
  "aria-label": ariaLabel = "Customize",
  className,
  overflowCount = 5,
  variant = "ghost",
  ...props
}: Readonly<PromptInputPreferencesButtonProps>) => (
  <PromptInputButton
    aria-label={ariaLabel}
    className={cn(
      "h-8 gap-1 px-3 text-text hover:text-text",
      className
    )}
    size="sm"
    type="button"
    variant={variant}
    {...props}
  >
	<TWGAppstack
		aria-hidden
		animated={false}
		iconSize="xxsmall"
		maxVisible={4}
		overflowCount={overflowCount}
		sources={PROMPT_INPUT_PREFERENCE_SOURCES}
	/>
  </PromptInputButton>
);

export type PromptInputMicrophoneProps = ComponentProps<typeof InputGroupButton>;

export const PromptInputMicrophone = ({
  className,
  variant = "ghost",
  size = "icon-sm",
  children,
  ...props
}: Readonly<PromptInputMicrophoneProps>) => {
  return (
    <InputGroupButton
      aria-label="Voice"
      className={cn(className)}
      size={size}
      type="button"
      variant={variant}
      {...props}
    >
      {children ?? <MicIcon className="size-4" />}
    </InputGroupButton>
  );
};

export type PromptInputSubmitProps = ComponentProps<typeof InputGroupButton> & {
  status?: ChatStatus;
  onStop?: () => void;
};

export const PromptInputSubmit = ({
  className,
  variant = "default",
  size = "icon-sm",
  status,
  onStop,
  onClick,
  disabled,
  children,
  ...props
}: Readonly<PromptInputSubmitProps>) => {
  const isGenerating = status === "submitted" || status === "streaming";
  const canStopGeneration = isGenerating && Boolean(onStop);
  const shouldUseStatusIcon =
    status === "submitted" || status === "streaming" || status === "error";
  const resolvedVariant = isGenerating ? "ghost" : variant;
  const stateClassName = isGenerating
    ? "bg-transparent text-icon-rovo [&_svg]:text-icon-rovo hover:bg-bg-neutral-hovered active:bg-bg-neutral-pressed"
    : variant === "default" && status !== "error"
      ? "enabled:bg-rovo-brand enabled:text-rovo-icon-inverse enabled:hover:bg-rovo-brand/90 enabled:active:bg-rovo-brand/80"
      : undefined;

  const glyphSize = size === "icon-xs" ? "small" : undefined;
  let Icon = glyphSize ? (
    <ArrowUpIcon size={glyphSize} />
  ) : (
    <ArrowUpIcon className="size-4" />
  );

  if (status === "submitted" || status === "streaming") {
    Icon = <span aria-hidden className="size-3 rounded-xs bg-current" />;
  } else if (status === "error") {
    Icon = <XIcon className="size-4" />;
  }

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (canStopGeneration && onStop) {
        e.preventDefault();
        onStop();
        return;
      }
      onClick?.(e as React.MouseEvent<HTMLButtonElement> & { preventBaseUIHandler: () => void });
    },
    [canStopGeneration, onStop, onClick]
  );

  return (
    <InputGroupButton
      aria-label={isGenerating ? "Stop" : "Submit"}
      className={cn("rounded-md", stateClassName, className)}
      disabled={canStopGeneration ? false : disabled}
      onClick={handleClick}
      size={size}
      type={canStopGeneration ? "button" : "submit"}
      variant={resolvedVariant}
      {...props}
    >
      {shouldUseStatusIcon ? Icon : children ?? Icon}
    </InputGroupButton>
  );
};
