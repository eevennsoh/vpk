"use client";

import type { ComponentProps, CSSProperties, HTMLAttributes, ReactNode } from "react";
import type {
  BundledLanguage,
  BundledTheme,
  HighlighterGeneric,
  ThemedToken,
} from "shiki";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  type DropdownMenuContentProps,
  DropdownMenuGroup,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  type DropdownMenuRadioItemProps,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CheckIcon,
  ChevronDownIcon as ChevronDown,
  CopyIcon,
  DownloadIcon,
} from "@/components/ui/vpk-icons";
import { cn } from "@/lib/utils";
import {
  createContext,
  memo,
  useCallback,
  use,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createHighlighter } from "shiki";
import { getTokensCacheKey } from "@/components/ui-custom/code-block-cache-key";

// react-doctor-disable-next-line react-doctor/only-export-components -- Preserve the existing public cache-key API.
export { getTokensCacheKey } from "@/components/ui-custom/code-block-cache-key";

// Shiki uses bitflags for font styles: 1=italic, 2=bold, 4=underline
// biome-ignore lint/suspicious/noBitwiseOperators: shiki bitflag check
const isItalic = (fontStyle: number | undefined) => fontStyle && fontStyle & 1;
// biome-ignore lint/suspicious/noBitwiseOperators: shiki bitflag check
// oxlint-disable-next-line eslint(no-bitwise)
const isBold = (fontStyle: number | undefined) => fontStyle && fontStyle & 2;
const isUnderline = (fontStyle: number | undefined) =>
  // biome-ignore lint/suspicious/noBitwiseOperators: shiki bitflag check
  // oxlint-disable-next-line eslint(no-bitwise)
  fontStyle && fontStyle & 4;

// Transform tokens to include pre-computed keys to avoid noArrayIndexKey lint
interface KeyedToken {
  token: ThemedToken;
  key: string;
}
interface KeyedLine {
  tokens: KeyedToken[];
  key: string;
}

const addKeysToTokens = (lines: ThemedToken[][]): KeyedLine[] =>
  lines.map((line, lineIdx) => ({
    key: `line-${lineIdx}`,
    tokens: line.map((token, tokenIdx) => ({
      key: `line-${lineIdx}-${tokenIdx}`,
      token,
    })),
  }));

// Token rendering component
const TokenSpan = ({ token }: { token: ThemedToken }) => (
  <span
    className="dark:!bg-[var(--shiki-dark-bg)] dark:!text-[var(--shiki-dark)]"
    style={
      {
        backgroundColor: token.bgColor,
        color: token.color,
        fontStyle: isItalic(token.fontStyle) ? "italic" : undefined,
        fontWeight: isBold(token.fontStyle) ? "bold" : undefined,
        textDecoration: isUnderline(token.fontStyle) ? "underline" : undefined,
        ...token.htmlStyle,
      } as CSSProperties
    }
  >
    {token.content}
  </span>
);

// Line rendering component
const LineSpan = ({
  keyedLine,
  showLineNumbers,
}: {
  keyedLine: KeyedLine;
  showLineNumbers: boolean;
}) => (
  <span className={showLineNumbers ? LINE_NUMBER_CLASSES : "block"}>
    {keyedLine.tokens.length === 0
      ? "\n"
      : keyedLine.tokens.map(({ token, key }) => (
          <TokenSpan key={key} token={token} />
        ))}
  </span>
);

// Types
export type CodeBlockSize = "default" | "sm";

const CODE_BLOCK_TEXT_SIZE_CLASSES: Record<CodeBlockSize, string> = {
  default: "text-sm",
  sm: "text-xs",
};

type CodeBlockProps = HTMLAttributes<HTMLDivElement> & {
  code: string;
  language: BundledLanguage;
  showLineNumbers?: boolean;
  size?: CodeBlockSize;
};

export interface TokenizedCode {
  tokens: ThemedToken[][];
  fg: string;
  bg: string;
}

interface CodeBlockContextType {
  code: string;
  language?: BundledLanguage;
  size: CodeBlockSize;
}

// Context
const CodeBlockContext = createContext<CodeBlockContextType>({
  code: "",
  size: "default",
});

// Highlighter cache (singleton per language)
const highlighterCache = new Map<
  string,
  Promise<HighlighterGeneric<BundledLanguage, BundledTheme>>
>();

// Token cache
const tokensCache = new Map<string, TokenizedCode>();

// Subscribers for async token updates
const subscribers = new Map<string, Set<(result: TokenizedCode) => void>>();

const getHighlighter = (
  language: BundledLanguage
): Promise<HighlighterGeneric<BundledLanguage, BundledTheme>> => {
  const cached = highlighterCache.get(language);
  if (cached) {
    return cached;
  }

  const highlighterPromise = createHighlighter({
    langs: [language],
    themes: ["github-light", "github-dark"],
  });

  highlighterCache.set(language, highlighterPromise);
  return highlighterPromise;
};

// Create raw tokens for immediate display while highlighting loads
// react-doctor-disable-next-line react-doctor/only-export-components -- This component module intentionally exports colocated non-component API used by consumers.
export const createRawTokens = (code: string): TokenizedCode => ({
  bg: "transparent",
  fg: "inherit",
  tokens: code.split("\n").map((line) =>
    line === ""
      ? []
      : [
          {
            color: "inherit",
            content: line,
          } as ThemedToken,
        ]
  ),
});

// Synchronous highlight with callback for async results
// react-doctor-disable-next-line react-doctor/only-export-components -- This component module intentionally exports colocated non-component API used by consumers.
export const highlightCode = (
  code: string,
  language: BundledLanguage,
  // oxlint-disable-next-line eslint-plugin-promise(prefer-await-to-callbacks)
  callback?: (result: TokenizedCode) => void
): TokenizedCode | null => {
  const tokensCacheKey = getTokensCacheKey(code, language);

  // Return cached result if available
  const cached = tokensCache.get(tokensCacheKey);
  if (cached) {
    return cached;
  }

  // Subscribe callback if provided
  if (callback) {
    if (!subscribers.has(tokensCacheKey)) {
      subscribers.set(tokensCacheKey, new Set());
    }
    subscribers.get(tokensCacheKey)?.add(callback);
  }

  // Start highlighting in background - fire-and-forget async pattern
  getHighlighter(language)
    // oxlint-disable-next-line eslint-plugin-promise(prefer-await-to-then)
    .then((highlighter) => {
      const availableLangs = highlighter.getLoadedLanguages();
      const langToUse = availableLangs.includes(language) ? language : "text";

      const result = highlighter.codeToTokens(code, {
        lang: langToUse,
        themes: {
          dark: "github-dark",
          light: "github-light",
        },
      });

      const tokenized: TokenizedCode = {
        bg: result.bg ?? "transparent",
        fg: result.fg ?? "inherit",
        tokens: result.tokens,
      };

      // Cache the result
      tokensCache.set(tokensCacheKey, tokenized);

      // Notify all subscribers
      const subs = subscribers.get(tokensCacheKey);
      if (subs) {
        for (const sub of subs) {
          sub(tokenized);
        }
        subscribers.delete(tokensCacheKey);
      }
    })
    // oxlint-disable-next-line eslint-plugin-promise(prefer-await-to-then), eslint-plugin-promise(prefer-await-to-callbacks)
    .catch((error) => {
      console.error("Failed to highlight code:", error);
      subscribers.delete(tokensCacheKey);
    });

  return null;
};

// Line number styles using CSS counters
const LINE_NUMBER_CLASSES = cn(
  "block",
  "before:content-[counter(line)]",
  "before:inline-block",
  "before:[counter-increment:line]",
  "before:w-8",
  "before:mr-4",
  "before:text-right",
  "before:text-text-disabled",
  "before:font-mono",
  "before:select-none"
);

const CodeBlockBody = memo(
  ({
    tokenized,
    showLineNumbers,
    size,
    className,
  }: {
    tokenized: TokenizedCode;
    showLineNumbers: boolean;
    size: CodeBlockSize;
    className?: string;
  }) => {
    const preStyle = useMemo(
      () => ({
        backgroundColor: tokenized.bg,
        color: tokenized.fg,
      }),
      [tokenized.bg, tokenized.fg]
    );

    const keyedLines = useMemo(
      () => addKeysToTokens(tokenized.tokens),
      [tokenized.tokens]
    );
    const paddingClass = showLineNumbers
      ? size === "sm"
        ? "py-3 pr-3 pl-0"
        : "py-4 pr-4 pl-0"
      : size === "sm"
        ? "p-3"
        : "p-4";

    return (
      <pre
        className={cn(
          "dark:!bg-[var(--shiki-dark-bg)] dark:!text-[var(--shiki-dark)] m-0",
          CODE_BLOCK_TEXT_SIZE_CLASSES[size],
          paddingClass,
          className
        )}
        style={preStyle}
      >
        <code
          className={cn(
            "font-mono",
            CODE_BLOCK_TEXT_SIZE_CLASSES[size],
            showLineNumbers
              ? "[counter-increment:line_0] [counter-reset:line]"
              : "block"
          )}
        >
          {keyedLines.map((keyedLine) => (
            <LineSpan
              key={keyedLine.key}
              keyedLine={keyedLine}
              showLineNumbers={showLineNumbers}
            />
          ))}
        </code>
      </pre>
    );
  },
  (prevProps, nextProps) =>
    prevProps.tokenized === nextProps.tokenized &&
    prevProps.showLineNumbers === nextProps.showLineNumbers &&
    prevProps.size === nextProps.size &&
    prevProps.className === nextProps.className
);

CodeBlockBody.displayName = "CodeBlockBody";

export function CodeBlockContainer({
  className,
  language,
  size = "default",
  style,
  ...props
}: Readonly<HTMLAttributes<HTMLDivElement> & { language: string; size?: CodeBlockSize }>) {
  return (
    <div
      className={cn(
        "group relative w-full overflow-hidden rounded-md border border-border bg-surface-raised text-text",
        className
      )}
      data-language={language}
      data-size={size}
      style={{
        containIntrinsicSize: "auto 200px",
        contentVisibility: "auto",
        ...style,
      }}
      {...props}
    />
  );
}

export function CodeBlockHeader({
  children,
  className,
  ...props
}: Readonly<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div
      className={cn(
        "flex items-center justify-between border-border border-b bg-bg-neutral px-3 py-2 text-text-subtle text-xs group-data-[size=sm]:py-1",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CodeBlockTitle({
  children,
  className,
  ...props
}: Readonly<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)} {...props}>
      {children}
    </div>
  );
}

export function CodeBlockFilename({
  children,
  className,
  ...props
}: Readonly<HTMLAttributes<HTMLSpanElement>>) {
  return (
    <span className={cn("font-mono text-text-subtle", className)} {...props}>
      {children}
    </span>
  );
}

export function CodeBlockActions({
  children,
  className,
  ...props
}: Readonly<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div
      className={cn("-my-1 -mr-1 flex items-center gap-0", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function CodeBlockContent({
  code,
  language,
  showLineNumbers = false,
  size = "default",
}: Readonly<{
  code: string;
  language: BundledLanguage;
  showLineNumbers?: boolean;
  size?: CodeBlockSize;
}>) {
  const rawTokens = useMemo(() => createRawTokens(code), [code]);
  const cacheKey = useMemo(
    () => getTokensCacheKey(code, language),
    [code, language]
  );
  const [highlightedTokens, setHighlightedTokens] = useState<{
    key: string;
    value: TokenizedCode;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const cached = highlightCode(code, language, (result) => {
      if (!cancelled) {
        setHighlightedTokens({
          key: cacheKey,
          value: result,
        });
      }
    });

    if (cached) {
      setHighlightedTokens({
        key: cacheKey,
        value: cached,
      });
    }

    return () => {
      cancelled = true;
    };
  }, [cacheKey, code, language]);

  const tokenized =
    highlightedTokens?.key === cacheKey ? highlightedTokens.value : rawTokens;

  return (
    <div
      className="relative overflow-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
      data-slot="code-block-scroll-area"
      tabIndex={0}
      title={`${language} code example`}
    >
      <CodeBlockBody
        showLineNumbers={showLineNumbers}
        size={size}
        tokenized={tokenized}
      />
    </div>
  );
}

export function CodeBlock({
  code,
  language,
  showLineNumbers = false,
  size = "default",
  className,
  children,
  ...props
}: Readonly<CodeBlockProps>) {
  const contextValue = useMemo(() => ({ code, language, size }), [code, language, size]);

  return (
    <CodeBlockContext value={contextValue}>
      <CodeBlockContainer className={className} language={language} size={size} {...props}>
        {children}
        <CodeBlockContent
          code={code}
          language={language}
          size={size}
          showLineNumbers={showLineNumbers}
        />
      </CodeBlockContainer>
    </CodeBlockContext>
  );
}

export type CodeBlockCopyButtonProps = ComponentProps<typeof Button> & {
  onCopy?: () => void;
  onError?: (error: Error) => void;
  timeout?: number;
};

const CODE_BLOCK_DOWNLOAD_EXTENSION_MAP: Partial<Record<BundledLanguage, string>> = {
  bash: "sh",
  shell: "sh",
  sh: "sh",
  zsh: "sh",
  javascript: "js",
  jsx: "jsx",
  typescript: "ts",
  tsx: "tsx",
  python: "py",
  json: "json",
  yaml: "yml",
  yml: "yml",
  markdown: "md",
  md: "md",
  html: "html",
  css: "css",
  scss: "scss",
  sql: "sql",
  xml: "xml",
  log: "log",
};

const getCodeBlockDownloadFilename = (language?: BundledLanguage) => {
  const extension = language ? (CODE_BLOCK_DOWNLOAD_EXTENSION_MAP[language] ?? language) : "txt";
  return `snippet.${extension}`;
};

export type CodeBlockDownloadButtonProps = ComponentProps<typeof Button> & {
  filename?: string;
  onDownload?: () => void;
  onError?: (error: Error) => void;
};

export function CodeBlockDownloadButton({
  filename,
  onDownload,
  onError,
  children,
  className,
  ...props
}: Readonly<CodeBlockDownloadButtonProps>) {
  const { code, language, size: codeBlockSize } = use(CodeBlockContext);

  const downloadCode = useCallback(() => {
    if (typeof window === "undefined") {
      onError?.(new Error("Window is not available"));
      return;
    }

    try {
      const blob = new Blob([code], {
        type: "text/plain;charset=utf-8",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename ?? getCodeBlockDownloadFilename(language);
      link.click();
      window.URL.revokeObjectURL(url);
      onDownload?.();
    } catch (error) {
      onError?.(error as Error);
    }
  }, [code, filename, language, onDownload, onError]);

  return (
    <Button
      className={cn("shrink-0 text-text-subtle hover:text-text", className)}
      onClick={downloadCode}
      size={codeBlockSize === "sm" ? "icon-compact" : "icon"}
      variant="ghost"
      aria-label="Download code"
      {...props}
    >
      {children ?? <DownloadIcon size={14} />}
    </Button>
  );
}

export function CodeBlockCopyButton({
  onCopy,
  onError,
  timeout = 2000,
  children,
  className,
  ...props
}: Readonly<CodeBlockCopyButtonProps>) {
  const [isCopied, setIsCopied] = useState(false);
  const timeoutRef = useRef<number>(0);
  const { code, size: codeBlockSize } = use(CodeBlockContext);

  const copyToClipboard = useCallback(async () => {
    if (typeof window === "undefined" || !navigator?.clipboard?.writeText) {
      onError?.(new Error("Clipboard API not available"));
      return;
    }

    try {
      if (!isCopied) {
        await navigator.clipboard.writeText(code);
        setIsCopied(true);
        onCopy?.();
        timeoutRef.current = window.setTimeout(
          () => setIsCopied(false),
          timeout
        );
      }
    } catch (error) {
      onError?.(error as Error);
    }
  }, [code, onCopy, onError, timeout, isCopied]);

  useEffect(
    () => () => {
      window.clearTimeout(timeoutRef.current);
    },
    []
  );

  const Icon = isCopied ? CheckIcon : CopyIcon;

  return (
    <Button
      className={cn("shrink-0 text-text-subtle hover:text-text", className)}
      onClick={copyToClipboard}
      size={codeBlockSize === "sm" ? "icon-compact" : "icon"}
      variant="ghost"
      aria-label="Copy code"
      {...props}
    >
      {children ?? <Icon size={14} />}
    </Button>
  );
}

// Language selector context for threading value/onValueChange through DropdownMenu
interface LanguageSelectorContextType {
  value: string;
  onValueChange: (value: string) => void;
}

const LanguageSelectorContext = createContext<LanguageSelectorContextType>({
  value: "",
  onValueChange: () => {},
});

export interface CodeBlockLanguageSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
}

export function CodeBlockLanguageSelector({
  value,
  onValueChange,
  children,
}: Readonly<CodeBlockLanguageSelectorProps>) {
  const contextValue = useMemo(
    () => ({ value, onValueChange }),
    [value, onValueChange]
  );
  return (
    <LanguageSelectorContext value={contextValue}>
      <DropdownMenu>{children}</DropdownMenu>
    </LanguageSelectorContext>
  );
}

export type CodeBlockLanguageSelectorTriggerProps = ComponentProps<"button">;

export function CodeBlockLanguageSelectorTrigger({
  className,
  children,
  ...props
}: Readonly<CodeBlockLanguageSelectorTriggerProps>) {
  return (
    <DropdownMenuTrigger
      render={
        <button
          type="button"
          className={cn(
            "inline-flex h-7 cursor-default items-center gap-1 rounded-sm bg-transparent px-2 text-text-subtle text-xs outline-none hover:bg-bg-neutral-subtle-hovered hover:text-text",
            className
          )}
          {...props}
        />
      }
    >
      {children}
      <ChevronDown size={12} />
    </DropdownMenuTrigger>
  );
}

export interface CodeBlockLanguageSelectorValueProps {
  children?: ReactNode;
  placeholder?: string;
}

export function CodeBlockLanguageSelectorValue({
  children,
  placeholder,
}: Readonly<CodeBlockLanguageSelectorValueProps>) {
  const { value } = use(LanguageSelectorContext);
  return <>{children ?? value ?? placeholder}</>;
}

export type CodeBlockLanguageSelectorContentProps = Omit<
  DropdownMenuContentProps,
  "children"
> & {
  children: ReactNode;
};

export function CodeBlockLanguageSelectorContent({
  align = "end",
  children,
  className,
  ...props
}: Readonly<CodeBlockLanguageSelectorContentProps>) {
  const { value, onValueChange } = use(LanguageSelectorContext);
  return (
    <DropdownMenuContent
      align={align}
      className={className}
      {...props}
    >
      <DropdownMenuGroup>
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(newValue) => onValueChange(newValue)}
        >
          {children}
        </DropdownMenuRadioGroup>
      </DropdownMenuGroup>
    </DropdownMenuContent>
  );
}

export type CodeBlockLanguageSelectorItemProps = DropdownMenuRadioItemProps;

export function CodeBlockLanguageSelectorItem(
  props: Readonly<CodeBlockLanguageSelectorItemProps>
) {
  return <DropdownMenuRadioItem {...props} />;
}
