"use client";

import { useState } from "react";
import CopyIcon from "@atlaskit/icon/core/copy";
import { CopyFeedbackIcon } from "@/components/ui-custom/copy-feedback-icon";
import { Button } from "@/components/ui/button";
import { CodeBlock, CodeBlockActions, CodeBlockContent, CodeBlockHeader, CodeBlockTitle } from "@/components/ui/code-block";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { cn } from "@/lib/utils";

export function AgentLanyardSetupPrompt({ prompt }: Readonly<{ prompt: string }>) {
	const [tooltipOpen, setTooltipOpen] = useState(false);
	const { copied, copy } = useCopyToClipboard({ onCopy: () => setTooltipOpen(true), timeout: 1800 });
	const label = copied ? "Prompt copied" : "Copy setup prompt";

	return (
		<CodeBlock size="sm" className="border border-border bg-transparent ring-0">
			<CodeBlockHeader className="group-data-[size=sm]/code-block:px-4">
				<CodeBlockTitle className="text-xs leading-4 font-semibold whitespace-normal text-text-subtlest">Paste this prompt in your AI client to connect</CodeBlockTitle>
				<CodeBlockActions className="me-0">
					<Tooltip open={tooltipOpen} onOpenChange={setTooltipOpen}>
						<TooltipTrigger render={<Button aria-label={label} size="icon-compact" variant="ghost" onClick={() => { void copy(prompt); }} />}>
							<CopyFeedbackIcon copied={copied} idleIcon={<CopyIcon label="" size="small" />} />
						</TooltipTrigger>
						<TooltipContent>{label}</TooltipContent>
					</Tooltip>
					<span aria-live="polite" className="sr-only">{copied ? label : ""}</span>
				</CodeBlockActions>
			</CodeBlockHeader>
			<CodeBlockContent
				wrap
				aria-label="Atlassian MCP setup prompt"
				className={cn(
					"max-h-24 overflow-x-hidden overscroll-y-contain font-[family-name:inherit] text-xs/4 text-text-subtle group-data-[size=sm]/code-block:px-4",
					"[&_[data-slot=code-block-code]]:wrap-anywhere [&_[data-slot=code-block-code]]:font-[family-name:inherit]",
				)}
			>
				{prompt}
			</CodeBlockContent>
		</CodeBlock>
	);
}
