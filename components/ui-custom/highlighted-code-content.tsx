"use client";

import { CodeBlockContent, CodeBlockLine, type CodeBlockContentProps } from "@/components/ui/code-block";
import { useHighlightedCode } from "@/hooks/use-highlighted-code";

export type HighlightedCodeContentProps = Omit<CodeBlockContentProps, "children"> & {
	code: string;
	language: string;
};

/** `CodeBlockContent` filled with Shiki-highlighted lines; it re-tokenizes only new lines while code streams. */
export function HighlightedCodeContent({ code, language, ...props }: Readonly<HighlightedCodeContentProps>) {
	const lines = useHighlightedCode(code, language);

	return (
		<CodeBlockContent data-language={language} {...props}>
			{lines.map((line, index) => (
				// oxlint-disable-next-line react/no-array-index-key -- Lines have no identity beyond their position.
				<CodeBlockLine key={index}>{line}</CodeBlockLine>
			))}
		</CodeBlockContent>
	);
}
