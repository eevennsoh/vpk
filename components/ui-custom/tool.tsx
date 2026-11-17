"use client";

import type { DynamicToolUIPart, ToolUIPart } from "ai";
import type { ComponentProps, ReactNode } from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Icon } from "@/components/ui/icon";
import { Lozenge } from "@/components/ui/lozenge";
import { cn } from "@/lib/utils";
import CheckCircleIcon from "@atlaskit/icon/core/check-circle";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import ClockIcon from "@atlaskit/icon/core/clock";
import CrossCircleIcon from "@atlaskit/icon/core/cross-circle";
import StatusInformationIcon from "@atlaskit/icon/core/status-information";
import ToolsIcon from "@atlaskit/icon/core/tools";
import { isValidElement, useState } from "react";

import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockCopyButton,
  CodeBlockDownloadButton,
  CodeBlockHeader,
  type CodeBlockProps,
  CodeBlockTitle,
  CodeBlockFilename,
} from "@/components/ui/code-block";
import { HighlightedCodeContent } from "./highlighted-code-content";

type CodeBlockSize = NonNullable<CodeBlockProps["size"]>;

function ToolCodeBlock({
  code,
  label,
  language,
  size,
}: Readonly<{ code: string; label: string; language: string; size: CodeBlockSize }>) {
  return (
    <CodeBlock className="text-xs" size={size}>
      <CodeBlockHeader>
        <CodeBlockTitle>
          <CodeBlockFilename>{label}</CodeBlockFilename>
        </CodeBlockTitle>
        <CodeBlockActions>
          <CodeBlockDownloadButton value={code} language={language} />
          <CodeBlockCopyButton value={code} />
        </CodeBlockActions>
      </CodeBlockHeader>
      <HighlightedCodeContent className="leading-5" code={code} language={language} />
    </CodeBlock>
  );
}

export type ToolProps = ComponentProps<typeof Collapsible>;

export const Tool = ({
  className,
  defaultOpen,
  onOpenChange,
  open,
  ...props
}: ToolProps) => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen ?? false);
  const resolvedOpen = open ?? uncontrolledOpen;

  const handleOpenChange: NonNullable<ToolProps["onOpenChange"]> = (
    nextOpen,
    eventDetails
  ) => {
    if (open === undefined) {
      setUncontrolledOpen(nextOpen);
    }
    onOpenChange?.(nextOpen, eventDetails);
  };

  return (
    <Collapsible
      className={cn(
        "group not-prose mb-4 w-full rounded-md border",
        "transition-[opacity,transform] duration-normal ease-out data-starting-style:opacity-0 data-starting-style:-translate-y-1",
        className
      )}
      onOpenChange={handleOpenChange}
      open={resolvedOpen}
      {...props}
    />
  );
};

export type ToolPart = ToolUIPart | DynamicToolUIPart;

export type ToolHeaderProps = {
  title?: string;
  className?: string;
  statusIcon?: ReactNode;
  leadingIcon?: ReactNode;
} & (
  | { type: ToolUIPart["type"]; state: ToolUIPart["state"]; toolName?: never }
  | {
      type: DynamicToolUIPart["type"];
      state: DynamicToolUIPart["state"];
      toolName: string;
    }
);

const statusLabels: Record<ToolPart["state"], string> = {
  "approval-requested": "Awaiting Approval",
  "approval-responded": "Responded",
  "input-available": "Running",
  "input-streaming": "Pending",
  "output-available": "Completed",
  "output-denied": "Denied",
  "output-error": "Error",
};

const statusIcons: Record<ToolPart["state"], ReactNode> = {
  "approval-requested": (
    <Icon
      render={<ClockIcon label="" size="small" />}
      label="Awaiting"
      className="size-4"
    />
  ),
  "approval-responded": (
    <Icon
      render={<CheckCircleIcon label="" size="small" />}
      label="Responded"
      className="size-4"
    />
  ),
  "input-available": (
    <Icon
      render={<ClockIcon label="" size="small" />}
      label="Running"
      className="size-4 animate-pulse"
    />
  ),
  "input-streaming": (
    <Icon
      render={<StatusInformationIcon label="" size="small" />}
      label="Pending"
      className="size-4"
    />
  ),
  "output-available": (
    <Icon
      render={<CheckCircleIcon label="" size="small" />}
      label="Completed"
      className="size-4"
    />
  ),
  "output-denied": (
    <Icon
      render={<CrossCircleIcon label="" size="small" />}
      label="Denied"
      className="size-4"
    />
  ),
  "output-error": (
    <Icon
      render={<CrossCircleIcon label="" size="small" />}
      label="Error"
      className="size-4"
    />
  ),
};

const MAX_TOOL_PREVIEW_CHARS = 1200;
const MAX_TOOL_PREVIEW_LINES = 20;
const MAX_SERIALIZE_DEPTH = 4;
const MAX_SERIALIZE_ARRAY_ITEMS = 50;
const MAX_SERIALIZE_OBJECT_KEYS = 50;

const truncateTextByLines = (value: string, maxLines: number) => {
  if (maxLines <= 0) {
    return { text: "", truncated: value.length > 0 };
  }

  const lines = value.split(/\r?\n/u);
  if (lines.length <= maxLines) {
    return { text: value, truncated: false };
  }

  return {
    text: lines.slice(0, maxLines).join("\n"),
    truncated: true,
  };
};

const truncateTextByChars = (value: string, maxChars: number) => {
  if (maxChars <= 0) {
    return { text: "", truncated: value.length > 0 };
  }

  if (value.length <= maxChars) {
    return { text: value, truncated: false };
  }

  return {
    text: `${value.slice(0, Math.max(0, maxChars - 1))}…`,
    truncated: true,
  };
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Object.prototype.toString.call(value) === "[object Object]";

const toBoundedSerializableValue = (
  value: unknown,
  depth: number,
  seen: WeakSet<object>
): unknown => {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value !== "object") {
    return value;
  }

  if (seen.has(value)) {
    return "[Circular]";
  }

  if (depth >= MAX_SERIALIZE_DEPTH) {
    if (Array.isArray(value)) {
      return `[Array(${value.length})]`;
    }
    return "[Object]";
  }

  seen.add(value);
  try {
    if (Array.isArray(value)) {
      const truncatedArray = value
        .slice(0, MAX_SERIALIZE_ARRAY_ITEMS)
        .map((item) => toBoundedSerializableValue(item, depth + 1, seen));
      if (value.length > MAX_SERIALIZE_ARRAY_ITEMS) {
        truncatedArray.push(
          `[+${value.length - MAX_SERIALIZE_ARRAY_ITEMS} more items]`
        );
      }
      return truncatedArray;
    }

    if (isPlainObject(value)) {
      const entries = Object.entries(value);
      const boundedObject: Record<string, unknown> = {};
      for (const [key, entryValue] of entries.slice(0, MAX_SERIALIZE_OBJECT_KEYS)) {
        boundedObject[key] = toBoundedSerializableValue(entryValue, depth + 1, seen);
      }
      if (entries.length > MAX_SERIALIZE_OBJECT_KEYS) {
        boundedObject.__truncated__ = `+${entries.length - MAX_SERIALIZE_OBJECT_KEYS} more keys`;
      }
      return boundedObject;
    }

    return String(value);
  } finally {
    seen.delete(value);
  }
};

const stringifyToolValue = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  try {
    const boundedValue = toBoundedSerializableValue(value, 0, new WeakSet<object>());
    return JSON.stringify(boundedValue, null, 2);
  } catch {
    return String(value);
  }
};

const stringifyExactToolValue = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const toToolValuePreview = (
  value: unknown,
  { maxChars = MAX_TOOL_PREVIEW_CHARS, maxLines = MAX_TOOL_PREVIEW_LINES } = {}
) => {
  const rawText = stringifyToolValue(value);
  const lineResult = truncateTextByLines(rawText, maxLines);
  const charResult = truncateTextByChars(lineResult.text, maxChars);
  return {
    text: charResult.text,
    truncated: lineResult.truncated || charResult.truncated,
    rawLength: rawText.length,
  };
};

const formatByteSize = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return null;
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const statusVariants: Record<ToolPart["state"], ComponentProps<typeof Lozenge>["variant"]> = {
  "approval-requested": "warning",
  "approval-responded": "information",
  "input-available": "information",
  "input-streaming": "neutral",
  "output-available": "success",
  "output-denied": "warning",
  "output-error": "danger",
};

// react-doctor-disable-next-line react-doctor/only-export-components -- This component module intentionally exports colocated non-component API used by consumers.
export const getStatusLozenge = (
  status: ToolPart["state"],
  { icon }: { icon?: ReactNode } = {}
) => (
  <Lozenge variant={statusVariants[status]} icon={icon ?? statusIcons[status]} maxWidth={110}>
    {statusLabels[status]}
  </Lozenge>
);

export const ToolHeader = ({
  className,
  statusIcon,
  leadingIcon,
  title,
  type,
  state,
  toolName,
  ...props
}: ToolHeaderProps) => {
  const derivedName =
    type === "dynamic-tool" ? toolName : type.split("-").slice(1).join("-");

  return (
    <CollapsibleTrigger
      className={cn(
        "flex w-full items-center justify-between gap-4 overflow-hidden p-3 group-data-[open]:border-b",
        className
      )}
      {...props}
    >
      <div className="flex min-w-0 items-center gap-2">
        {leadingIcon ?? (
          <Icon
            render={<ToolsIcon label="" size="small" />}
            label="Tool"
            className="size-4 shrink-0 text-muted-foreground"
          />
        )}
        <span className="truncate font-medium text-sm" title={title ?? derivedName}>{title ?? derivedName}</span>
        {getStatusLozenge(state, { icon: statusIcon })}
      </div>
      <Icon
        render={<ChevronDownIcon label="" size="small" />}
        label="Expand"
        className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[open]:rotate-180"
      />
    </CollapsibleTrigger>
  );
};

export type ToolContentProps = ComponentProps<typeof CollapsibleContent>;

export const ToolContent = ({ className, ...props }: ToolContentProps) => (
  <CollapsibleContent
    className={cn(
      "space-y-4 p-4 text-popover-foreground outline-none",
      className
    )}
    {...props}
  />
);

export type ToolInputProps = ComponentProps<"div"> & {
  codeBlockSize?: CodeBlockSize;
  input: ToolPart["input"];
};

export const ToolInput = ({
  className,
  codeBlockSize = "default",
  input,
  ...props
}: ToolInputProps) => {
  const inputPreview = toToolValuePreview(input);
  if (!inputPreview.text) return null;

  return (
    <div className={cn("space-y-2 overflow-hidden", className)} {...props}>
      <h4 className="font-medium text-muted-foreground text-[12px]">
        Parameters
      </h4>
      <div className="rounded-md bg-muted/50">
        <ToolCodeBlock code={inputPreview.text} label="json" language="json" size={codeBlockSize} />
      </div>
      {inputPreview.truncated ? (
        <p className="text-[11px] leading-4 text-text-subtle">
          Parameters truncated for performance.
        </p>
      ) : null}
    </div>
  );
};

export type ToolOutputProps = ComponentProps<"div"> & {
  codeBlockSize?: CodeBlockSize;
  output: ToolPart["output"];
  outputPreview?: string;
  errorText: ToolPart["errorText"];
  outputTruncated?: boolean;
  outputBytes?: number;
  suppressedRawOutput?: boolean;
};

export const ToolOutput = ({
  className,
  codeBlockSize = "default",
  output,
  outputPreview,
  errorText,
  outputTruncated,
  outputBytes,
  suppressedRawOutput,
  ...props
}: ToolOutputProps) => {
  if ((output === undefined || output === null) && !errorText) {
    return null;
  }

  const outputValuePreview =
    typeof outputPreview === "string" && outputPreview.length > 0
      ? {
          text: outputPreview,
          truncated: outputTruncated === true,
          rawLength: outputPreview.length,
        }
      : toToolValuePreview(output);
  const errorPreview = errorText
    ? toToolValuePreview(errorText, { maxChars: 320, maxLines: 6 })
    : null;
  const formattedOutputBytes =
    typeof outputBytes === "number" ? formatByteSize(outputBytes) : null;
  const exactRawOutputText =
    output !== undefined && output !== null ? stringifyExactToolValue(output) : "";
  const hasExactRawOutput = exactRawOutputText.length > 0;
  const shouldPreferExactRawOutput =
    !errorText &&
    hasExactRawOutput &&
    !isValidElement(output) &&
    suppressedRawOutput !== true;
  const displayedOutputText = shouldPreferExactRawOutput
    ? exactRawOutputText
    : outputValuePreview.text;
  const shouldShowTruncationNotice =
    !shouldPreferExactRawOutput &&
    (outputTruncated === true || outputValuePreview.truncated);
  const previewMatchesExactRaw =
    hasExactRawOutput && displayedOutputText === exactRawOutputText;
  const shouldShowRawOutputDisclosure =
    hasExactRawOutput &&
    suppressedRawOutput !== true &&
    !shouldPreferExactRawOutput &&
    (!previewMatchesExactRaw || shouldShowTruncationNotice || Boolean(errorText));

  const outputLanguage =
    typeof output === "object" && !isValidElement(output) ? "json" : "markdown";
  const outputLabel =
    outputLanguage === "json" ? "json" : "result";

  const Output = (
    <ToolCodeBlock code={displayedOutputText} label={outputLabel} language={outputLanguage} size={codeBlockSize} />
  );

  return (
    <div className={cn("space-y-2", className)} {...props}>
      <h4 className="font-medium text-muted-foreground text-[12px]">
        {errorText ? "Error" : "Result"}
      </h4>
      {errorText ? (
        <>
          <Lozenge variant="danger" size="compact" className="max-w-full shrink">
            {errorPreview?.text ?? errorText}
          </Lozenge>
          {displayedOutputText ? (
            <div
              className={cn(
                "overflow-x-auto rounded-md text-xs [&_table]:w-full bg-muted/50 text-foreground"
              )}
            >
              {Output}
            </div>
          ) : null}
        </>
      ) : displayedOutputText ? (
        <>
          <div
            className={cn(
              "overflow-x-auto rounded-md text-xs [&_table]:w-full bg-muted/50 text-foreground"
            )}
          >
            {Output}
          </div>
          {shouldShowTruncationNotice ? (
            <p className="text-[11px] leading-4 text-text-subtle">
              Result preview truncated for display
              {formattedOutputBytes ? ` (${formattedOutputBytes} received)` : ""}.
            </p>
          ) : null}
        </>
      ) : null}
      {suppressedRawOutput === true ? (
        <p className="text-[11px] leading-4 text-text-subtle">
          Raw output is unavailable for this event. Showing the best preserved preview.
        </p>
      ) : null}
      {shouldShowRawOutputDisclosure ? (
        <details className="rounded-md border border-border/60 bg-background/60 px-3 py-2">
          <summary className="cursor-pointer select-none font-medium text-[12px] text-muted-foreground">
            Raw output
          </summary>
          <div className="mt-2 overflow-x-auto rounded-md bg-muted/50 text-foreground">
            <ToolCodeBlock code={exactRawOutputText} label="raw" language={outputLanguage} size={codeBlockSize} />
          </div>
        </details>
      ) : null}
    </div>
  );
};
