"use client";

import { useEffect, useState, type ReactElement, type ReactNode } from "react";
import BranchIcon from "@atlaskit/icon/core/branch";
import { CopyPromptButton } from "@/components/ui-custom/copy-prompt-button";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";

const ACTION_ROW_CLASS = "h-auto w-full justify-start gap-2 border-0 px-2 py-1.5 font-normal";

function CopyPromptAction({ code, description, presentation, summary }: Readonly<{
	code: string;
	description: string;
	presentation: "default" | "menu";
	summary: string;
}>) {
	const [feedback, setFeedback] = useState<"idle" | "copied" | "error">("idle");
	useEffect(() => {
		if (feedback === "idle") return;
		const timer = window.setTimeout(() => setFeedback("idle"), 1800);
		return () => window.clearTimeout(timer);
	}, [feedback]);
	async function copyPrompt() {
		const body = [summary, description].filter((part) => part.trim()).join("\n\n");
		try {
			await navigator.clipboard.writeText(body ? `${code}: ${body}` : code);
			setFeedback("copied");
		} catch {
			setFeedback("error");
		}
	}
	return <CopyPromptButton feedback={feedback} onClick={() => { void copyPrompt(); }} presentation={presentation} />;
}

export function ProjectButterDevelopmentActions({ code, description, presentation = "default", renderStartCoding, showCopyPrompt = true, showStartCoding = true, summary }: Readonly<{
	code: string;
	description: string;
	presentation?: "default" | "menu";
	renderStartCoding?: (trigger: ReactElement) => ReactNode;
	showCopyPrompt?: boolean;
	showStartCoding?: boolean;
	summary: string;
}>) {
	const startCoding = <Button className={ACTION_ROW_CLASS} type="button" variant="ghost"><IconTile aria-hidden as="span" className="text-icon-subtle" icon={<BranchIcon label="" />} iconSize="medium" label="" size="small" variant="transparent" />Start coding</Button>;
	return <div className="-mx-2 flex flex-col gap-0.5">
		{showStartCoding ? renderStartCoding ? renderStartCoding(startCoding) : startCoding : null}
		{showCopyPrompt ? <CopyPromptAction code={code} description={description} presentation={presentation} summary={summary} /> : null}
	</div>;
}
