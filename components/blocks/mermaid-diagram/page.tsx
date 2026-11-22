"use client"

import { MessageResponse } from "@/components/ui-custom/message-markdown"

const DEFAULT_MERMAID = `\`\`\`mermaid
flowchart TD
	start["New request"] --> inspect{"Mermaid fence?"}
	inspect -->|"yes"| render["Render with Streamdown mermaid plugin"]
	inspect -->|"no"| code["Render with CodeBlock"]
	render --> result["SVG diagram with controls"]
	code --> result2["Syntax-highlighted code"]
\`\`\``

export default function MermaidDiagramBlock() {
	return (
		<div className="flex min-h-full w-full items-center justify-center bg-background">
			<div className="w-full max-w-[800px] [&_[data-streamdown=mermaid-block]]:my-0 [&_[data-streamdown=mermaid-block]]:w-full [&_[data-streamdown=mermaid-block]>div:last-child]:flex [&_[data-streamdown=mermaid-block]>div:last-child]:min-h-[320px] [&_[data-streamdown=mermaid-block]>div:last-child]:items-center [&_[data-streamdown=mermaid-block]>div:last-child]:justify-center">
				<MessageResponse mode="static" controls>
					{DEFAULT_MERMAID}
				</MessageResponse>
			</div>
		</div>
	)
}
