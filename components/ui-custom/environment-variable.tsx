"use client";

import type { ComponentProps, HTMLAttributes } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  CheckIcon,
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
} from "@/components/ui/vpk-icons";
import { cn } from "@/lib/utils";
import {
  createContext,
  useCallback,
  use,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

interface EnvironmentVariableContextType {
  showValues: boolean;
  setShowValues: (show: boolean) => void;
}

// Default noop for context default value
// oxlint-disable-next-line eslint(no-empty-function)
const noop = () => {};

const EnvironmentVariableContext =
  createContext<EnvironmentVariableContextType>({
    setShowValues: noop,
    showValues: false,
  });

export type EnvironmentVariableProps = HTMLAttributes<HTMLDivElement> & {
  showValues?: boolean;
  defaultShowValues?: boolean;
  onShowValuesChange?: (show: boolean) => void;
};

export function EnvironmentVariable({
  showValues: controlledShowValues,
  defaultShowValues = false,
  onShowValuesChange,
  className,
  children,
  ...props
}: Readonly<EnvironmentVariableProps>) {
  const [internalShowValues, setInternalShowValues] =
    useState(defaultShowValues);
  const showValues = controlledShowValues ?? internalShowValues;

  const setShowValues = useCallback(
    (show: boolean) => {
      setInternalShowValues(show);
      onShowValuesChange?.(show);
    },
    [onShowValuesChange]
  );

  const contextValue = useMemo(
    () => ({ setShowValues, showValues }),
    [setShowValues, showValues]
  );

  return (
    <EnvironmentVariableContext value={contextValue}>
      <div
        className={cn("rounded-lg border bg-background", className)}
        {...props}
      >
        {children}
      </div>
    </EnvironmentVariableContext>
  );
}

export type EnvironmentVariableHeaderProps = HTMLAttributes<HTMLDivElement>;

export function EnvironmentVariableHeader({
  className,
  children,
  ...props
}: Readonly<EnvironmentVariableHeaderProps>) {
  return (
    <div
      className={cn(
        "flex items-center justify-between border-b px-4 py-3",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export type EnvironmentVariableTitleProps = HTMLAttributes<HTMLHeadingElement>;

export function EnvironmentVariableTitle({
  className,
  children,
  ...props
}: Readonly<EnvironmentVariableTitleProps>) {
  return (
    <h3 className={cn("font-medium text-sm", className)} {...props}>
      {children ?? "Environment Variables"}
    </h3>
  );
}

export type EnvironmentVariableToggleProps = ComponentProps<typeof Switch>;

export function EnvironmentVariableToggle({
  className,
  ...props
}: Readonly<EnvironmentVariableToggleProps>) {
  const { showValues, setShowValues } = use(EnvironmentVariableContext);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="text-muted-foreground text-xs">
        {showValues ? <EyeIcon size={14} /> : <EyeOffIcon size={14} />}
      </span>
      <Switch
        aria-label="Toggle value visibility"
        checked={showValues}
        onCheckedChange={setShowValues}
        {...props}
      />
    </div>
  );
}

export type EnvironmentVariableContentProps = HTMLAttributes<HTMLDivElement>;

export function EnvironmentVariableContent({
  className,
  children,
  ...props
}: Readonly<EnvironmentVariableContentProps>) {
  return (
    <div className={cn("divide-y", className)} {...props}>
      {children}
    </div>
  );
}

interface EnvironmentVariableItemContextType {
  name: string;
  value: string;
}

const EnvironmentVariableItemContext =
  createContext<EnvironmentVariableItemContextType>({
    name: "",
    value: "",
  });

export type EnvironmentVariableItemProps = HTMLAttributes<HTMLDivElement> & {
  name: string;
  value: string;
};

export function EnvironmentVariableItem({
  name,
  value,
  className,
  children,
  ...props
}: Readonly<EnvironmentVariableItemProps>) {
  const envVarContextValue = useMemo(() => ({ name, value }), [name, value]);

  return (
    <EnvironmentVariableItemContext value={envVarContextValue}>
      <div
        className={cn(
          "flex items-center justify-between gap-4 px-4 py-3",
          className
        )}
        {...props}
      >
        {children ?? (
          <>
            <div className="flex items-center gap-2">
              <EnvironmentVariableName />
            </div>
            <EnvironmentVariableValue />
          </>
        )}
      </div>
    </EnvironmentVariableItemContext>
  );
}

export type EnvironmentVariableGroupProps = HTMLAttributes<HTMLDivElement>;

export function EnvironmentVariableGroup({
  className,
  children,
  ...props
}: Readonly<EnvironmentVariableGroupProps>) {
  return (
    <div className={cn("flex items-center gap-2", className)} {...props}>
      {children}
    </div>
  );
}

export type EnvironmentVariableNameProps = HTMLAttributes<HTMLSpanElement>;

export function EnvironmentVariableName({
  className,
  children,
  ...props
}: Readonly<EnvironmentVariableNameProps>) {
  const { name } = use(EnvironmentVariableItemContext);

  return (
    <span className={cn("font-mono text-sm", className)} {...props}>
      {children ?? name}
    </span>
  );
}

export type EnvironmentVariableValueProps = HTMLAttributes<HTMLSpanElement>;

export function EnvironmentVariableValue({
  className,
  children,
  ...props
}: Readonly<EnvironmentVariableValueProps>) {
  const { value } = use(EnvironmentVariableItemContext);
  const { showValues } = use(EnvironmentVariableContext);

  const displayValue = showValues
    ? value
    : "•".repeat(Math.min(value.length, 20));

  return (
    <span
      className={cn(
        "font-mono text-muted-foreground text-sm",
        !showValues && "select-none",
        className
      )}
      {...props}
    >
      {children ?? displayValue}
    </span>
  );
}

export type EnvironmentVariableCopyButtonProps = ComponentProps<
  typeof Button
> & {
  onCopy?: () => void;
  onError?: (error: Error) => void;
  timeout?: number;
  copyFormat?: "name" | "value" | "export";
};

export function EnvironmentVariableCopyButton({
  onCopy,
  onError,
  timeout = 2000,
  copyFormat = "value",
  children,
  className,
  ...props
}: Readonly<EnvironmentVariableCopyButtonProps>) {
  const [isCopied, setIsCopied] = useState(false);
  const timeoutRef = useRef<number>(0);
  const { name, value } = use(EnvironmentVariableItemContext);

  const getTextToCopy = useCallback((): string => {
    const formatMap = {
      export: () => `export ${name}="${value}"`,
      name: () => name,
      value: () => value,
    };
    return formatMap[copyFormat]();
  }, [name, value, copyFormat]);

  const copyToClipboard = useCallback(async () => {
    if (typeof window === "undefined" || !navigator?.clipboard?.writeText) {
      onError?.(new Error("Clipboard API not available"));
      return;
    }

    try {
      await navigator.clipboard.writeText(getTextToCopy());
      setIsCopied(true);
      onCopy?.();
      timeoutRef.current = window.setTimeout(() => setIsCopied(false), timeout);
    } catch (error) {
      onError?.(error as Error);
    }
  }, [getTextToCopy, onCopy, onError, timeout]);

  useEffect(
    () => () => {
      window.clearTimeout(timeoutRef.current);
    },
    []
  );

  const Icon = isCopied ? CheckIcon : CopyIcon;

  return (
    <Button
      className={cn("size-6 shrink-0", className)}
      onClick={copyToClipboard}
      size="icon"
      variant="ghost"
      {...props}
    >
      {children ?? <Icon size={12} />}
    </Button>
  );
}

export type EnvironmentVariableRequiredProps = ComponentProps<typeof Badge>;

export function EnvironmentVariableRequired({
  className,
  children,
  ...props
}: Readonly<EnvironmentVariableRequiredProps>) {
  return (
    <Badge className={cn("text-xs", className)} variant="neutral" {...props}>
      {children ?? "Required"}
    </Badge>
  );
}
