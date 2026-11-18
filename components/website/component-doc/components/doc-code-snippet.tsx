"use client";

import {
	CodeBlock,
	CodeBlockHeader,
	CodeBlockTitle,
	CodeBlockActions,
	CodeBlockCopyButton,
	CodeBlockDownloadButton,
} from "@/components/ui/code-block";
import { HighlightedCodeContent } from "@/components/ui-custom/highlighted-code-content";

interface DocCodeSnippetProps {
	code: string;
	language?: string;
	title?: string;
}

export function DocCodeSnippet({ code, language = "tsx", title }: Readonly<DocCodeSnippetProps>) {
	return (
		<CodeBlock>
			<CodeBlockHeader>
				<CodeBlockTitle>{title}</CodeBlockTitle>
				<CodeBlockActions>
					<CodeBlockDownloadButton value={code} language={language} />
					<CodeBlockCopyButton value={code} />
				</CodeBlockActions>
			</CodeBlockHeader>
			<HighlightedCodeContent code={code} language={language} />
		</CodeBlock>
	);
}
