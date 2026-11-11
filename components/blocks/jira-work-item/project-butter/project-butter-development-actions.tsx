"use client";

import { useEffect, useState, type ReactElement, type ReactNode } from "react";
import BranchIcon from "@atlaskit/icon/core/branch";
import CopyIcon from "@atlaskit/icon/core/copy";
import { CopyFeedbackIcon } from "@/components/ui-custom/copy-feedback-icon";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import { cn } from "@/lib/utils";

const ACTION_ROW_CLASS = "h-8 w-full justify-start gap-2 border-0 px-2 font-normal";
const COPY_LABELS = { idle: "Copy prompt", copied: "Prompt copied", error: "Could not copy prompt" } as const;

function CopyPromptAction({ code, description, presentation, summary }: Readonly<{
	code: string;
	description: string;
	presentation: "default" | "menu";
	summary: string;
}>) {
	const [feedback, setFeedback] = useState<keyof typeof COPY_LABELS>("idle");
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
	const label = COPY_LABELS[feedback];
	const menu = presentation === "menu";
	return <><Button aria-label={label} className={menu ? "h-8 min-h-8 w-full justify-start gap-3 border-0 pl-2 pr-3 py-0 text-left text-sm font-normal" : ACTION_ROW_CLASS} onClick={() => { void copyPrompt(); }} type="button" variant="ghost">
			<CopyFeedbackIcon className={menu ? "size-6 [&_svg]:size-4!" : undefined} copied={feedback === "copied"} idleIcon={<CopyIcon label="" size={menu ? "medium" : "small"} />} />
			<span aria-hidden className={cn("grid text-left", menu && "text-text-subtle")}>
				<span className={cn("col-start-1 row-start-1 transition-opacity duration-normal ease-out-practical", feedback === "idle" ? "opacity-100" : "opacity-0")}>Copy prompt</span>
				<span className={cn("col-start-1 row-start-1 transition-opacity duration-normal ease-out-practical", feedback !== "idle" ? "opacity-100" : "opacity-0")}>{label}</span>
			</span>
		</Button>
		<span className="sr-only" role="status">{feedback === "idle" ? "" : label}</span></>;
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
	const startCoding = <Button className={ACTION_ROW_CLASS} type="button" variant="ghost"><IconTile aria-hidden as="span" className="text-icon-subtle" icon={<BranchIcon label="" size="small" />} label="" size="xxsmall" variant="transparent" />Start coding</Button>;
	return <div className="-mx-2 flex flex-col">
		{showStartCoding ? renderStartCoding ? renderStartCoding(startCoding) : startCoding : null}
		{showCopyPrompt ? <CopyPromptAction code={code} description={description} presentation={presentation} summary={summary} /> : null}
	</div>;
}
