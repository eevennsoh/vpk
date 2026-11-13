"use client";

import type { CSSProperties, Ref, TextareaHTMLAttributes } from "react";
import { Fragment, useEffect, useMemo, useState } from "react";

import {
	createRawTokens,
	getTokensCacheKey,
	highlightCode,
	type TokenizedCode,
} from "@/components/ui-custom/code-block";
import { cn } from "@/lib/utils";

// Highlight the source as Markdown using the same Shiki highlighter + cache the
// CodeBlock uses, so we get GitHub's own colors (github-light / github-dark) and
// never load Shiki twice.
const LANGUAGE = "markdown";

// The editable <textarea> and the highlighted overlay <pre> must share identical
// text metrics (font, size, line-height, wrapping, tab-size). Any mismatch makes
// the colored layer drift away from the caret. Keep this list authoritative.
const SHARED_TEXT_CLASSES =
	"m-0 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words [tab-size:2]";

function useMarkdownTokens(code: string): TokenizedCode {
	const rawTokens = useMemo(() => createRawTokens(code), [code]);
	const cacheKey = useMemo(() => getTokensCacheKey(code, LANGUAGE), [code]);
	const [highlighted, setHighlighted] = useState<{
		key: string;
		value: TokenizedCode;
	} | null>(null);

	useEffect(() => {
		let cancelled = false;
		// Returns cached tokens synchronously when available; otherwise resolves
		// via the callback once Shiki finishes in the background.
		const cached = highlightCode(code, LANGUAGE, (result) => {
			if (!cancelled) {
				setHighlighted({ key: cacheKey, value: result });
			}
		});
		if (cached) {
			setHighlighted({ key: cacheKey, value: cached });
		}
		return () => {
			cancelled = true;
		};
	}, [cacheKey, code]);

	// Fall back to uncolored tokens until the async highlight lands.
	return highlighted?.key === cacheKey ? highlighted.value : rawTokens;
}

export interface MarkdownSourceEditorProps
	extends Omit<
		TextareaHTMLAttributes<HTMLTextAreaElement>,
		"value" | "onChange"
	> {
	value: string;
	onValueChange: (value: string) => void;
	className?: string;
	textareaClassName?: string;
	ref?: Ref<HTMLTextAreaElement>;
}

export function MarkdownSourceEditor({
	value,
	onValueChange,
	className,
	textareaClassName,
	ref,
	...props
}: MarkdownSourceEditorProps) {
	const tokenized = useMarkdownTokens(value);

	return (
		<div className={cn("relative w-full", className)}>
			{/*
			 * Highlight layer. Sits behind the textarea and is purely visual:
			 * pointer-events-none + aria-hidden so it never intercepts focus or
			 * gets announced. Lines are joined with explicit "\n" text nodes so the
			 * reconstructed string matches the textarea's value exactly and wraps
			 * the same way under `whitespace-pre-wrap`.
			 */}
			<pre
				aria-hidden="true"
				className={cn(
					"pointer-events-none absolute inset-0 select-none overflow-hidden text-text",
					SHARED_TEXT_CLASSES,
				)}
			>
				<code className={SHARED_TEXT_CLASSES}>
					{tokenized.tokens.map((line, lineIndex) => (
						<Fragment key={`line-${lineIndex}`}>
							{lineIndex > 0 ? "\n" : null}
							{line.map((tokenItem, tokenIndex) => (
								<span
									key={`token-${lineIndex}-${tokenIndex}`}
									className="dark:!text-[var(--shiki-dark)]"
									style={
										{
											color: tokenItem.color,
											...tokenItem.htmlStyle,
										} as CSSProperties
									}
								>
									{tokenItem.content}
								</span>
							))}
						</Fragment>
					))}
				</code>
			</pre>
			{/*
			 * Editable layer. Transparent glyphs reveal the highlight behind it,
			 * while `caret-text` keeps the cursor visible. `field-sizing-content`
			 * grows the box with its content so we never need to sync scroll.
			 */}
			<textarea
				ref={ref}
				className={cn(
					"relative block w-full resize-none bg-transparent text-transparent caret-text outline-none field-sizing-content placeholder:text-text-subtlest",
					SHARED_TEXT_CLASSES,
					textareaClassName,
				)}
				spellCheck={false}
				value={value}
				onChange={(event) => onValueChange(event.target.value)}
				{...props}
			/>
		</div>
	);
}
