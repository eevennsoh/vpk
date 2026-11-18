import type { ComponentDetail } from "@/app/data/component-detail-types";

export const CODE_BLOCK_DETAIL: ComponentDetail = {
	description:
		"Displays code, terminal output and diffs with optional line numbers, wrapping, highlighted lines, a header and actions. Pair it with useHighlightedCode for syntax highlighting.",
	usage: `import { useHighlightedCode } from "@/hooks/use-highlighted-code";
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockLine,
  CodeBlockTitle,
} from "@/components/ui/code-block";

const lines = useHighlightedCode(code, "ts");

<CodeBlock>
  <CodeBlockHeader>
    <CodeBlockTitle>app/api/chat/route.ts</CodeBlockTitle>
    <CodeBlockActions>
      <CodeBlockCopyButton value={code} />
    </CodeBlockActions>
  </CodeBlockHeader>
  <CodeBlockContent lineNumbers>
    {lines.map((line, index) => (
      <CodeBlockLine key={index}>{line}</CodeBlockLine>
    ))}
  </CodeBlockContent>
</CodeBlock>`,
	props: [
		{
			name: "variant",
			type: '"default" | "destructive"',
			default: '"default"',
			description: "CodeBlock only. Destructive tints the block for errors and failed output.",
		},
		{
			name: "size",
			type: '"default" | "sm"',
			default: '"default"',
			description: "CodeBlock only. Small tightens padding and text for nested blocks, such as inside a Trace.",
		},
		{
			name: "wrap",
			type: "boolean",
			default: "false",
			description: "CodeBlockContent only. Wraps long lines instead of scrolling horizontally.",
		},
		{
			name: "lineNumbers",
			type: "boolean",
			default: "false",
			description: "CodeBlockContent only. Numbers each CodeBlockLine; a string child is split into lines.",
		},
		{
			name: "startLine",
			type: "number",
			default: "1",
			description: "CodeBlockContent only. The number of the first line.",
		},
		{
			name: "variant (line)",
			type: '"default" | "added" | "removed" | "highlighted"',
			default: '"default"',
			description: "CodeBlockLine only. Marks diff additions and removals or highlights a line.",
		},
		{
			name: "value",
			type: "string",
			description: "CodeBlockCopyButton and CodeBlockDownloadButton. The text to copy or download.",
		},
	],
	subComponents: [
		{ name: "CodeBlock", description: "Root container with variant and size." },
		{ name: "CodeBlockHeader", description: "Row above the code for a title and actions." },
		{ name: "CodeBlockTitle", description: "Truncating title with an optional leading icon." },
		{ name: "CodeBlockActions", description: "Action group; floats over the code when placed directly in CodeBlock." },
		{ name: "CodeBlockCopyButton", description: "Copies value and announces the result." },
		{ name: "CodeBlockContent", description: "Scrollable pre with wrap, lineNumbers and startLine." },
		{ name: "CodeBlockLine", description: "One line, with a default, added, removed or highlighted variant." },
		{ name: "CodeBlockFooter", description: "Row below the code, such as a show more button." },
		{ name: "CodeBlockFilename", description: "VPK extra. Muted monospace filename for a header." },
		{
			name: "CodeBlockDownloadButton",
			description: "VPK extra. Downloads value, naming the file from filename or language.",
		},
		{
			name: "CodeBlockLanguageSelector",
			description:
				"VPK extra. Language dropdown with Trigger, Value, Content and Item parts, controlled by value and onValueChange.",
		},
	],
	examples: [
		{ title: "Basic", demoSlug: "code-block-demo-basic" },
		{ title: "Header", demoSlug: "code-block-demo-header" },
		{ title: "Actions", demoSlug: "code-block-demo-actions" },
		{ title: "Floating Actions", demoSlug: "code-block-demo-floating-actions" },
		{ title: "Line Numbers", demoSlug: "code-block-demo-line-numbers" },
		{ title: "Start Line", demoSlug: "code-block-demo-start-line" },
		{ title: "Wrap", demoSlug: "code-block-demo-wrap" },
		{ title: "Highlighted Lines", demoSlug: "code-block-demo-highlighted-lines" },
		{ title: "Diff", demoSlug: "code-block-demo-diff" },
		{ title: "Height", demoSlug: "code-block-demo-height" },
		{ title: "Show More", demoSlug: "code-block-demo-show-more" },
		{ title: "Max Height", demoSlug: "code-block-demo-max-height" },
		{ title: "Size", demoSlug: "code-block-demo-size" },
		{ title: "Destructive", demoSlug: "code-block-demo-destructive" },
		{ title: "Trace", demoSlug: "code-block-demo-trace" },
		{ title: "Tabs", demoSlug: "code-block-demo-tabs" },
		{ title: "Message", demoSlug: "code-block-demo-message" },
		{ title: "Typeset", demoSlug: "code-block-demo-typeset" },
		{ title: "RTL", demoSlug: "code-block-demo-rtl" },
		{ title: "Syntax Highlighting", demoSlug: "code-block-demo-syntax-highlighting" },
		{ title: "Languages", demoSlug: "code-block-demo-languages" },
		{ title: "Terminal Output", demoSlug: "code-block-demo-terminal-output" },
		{ title: "Streaming", demoSlug: "code-block-demo-streaming" },
		{ title: "Markdown", demoSlug: "code-block-demo-markdown" },
	],
};
