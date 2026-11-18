"use client";

import type { Ref, TextareaHTMLAttributes } from "react";
import { Fragment } from "react";

import { useHighlightedCode } from "@/hooks/use-highlighted-code";
import { cn } from "@/lib/utils";

// The editable <textarea> and the highlighted overlay <pre> must share identical
// text metrics (font, size, line-height, wrapping, tab-size). Any mismatch makes
// the colored layer drift away from the caret. Keep this list authoritative.
const SHARED_TEXT_CLASSES =
	"m-0 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words [tab-size:2]";

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
	// Same Shiki highlighter and GitHub themes as Code Block, so Shiki loads once.
	const lines = useHighlightedCode(value, "markdown");

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
					{lines.map((line, lineIndex) => (
						// oxlint-disable-next-line react/no-array-index-key -- Lines have no identity beyond their position.
						<Fragment key={lineIndex}>
							{lineIndex > 0 ? "\n" : null}
							{line}
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
