"use client";

import ClockIcon from "@atlaskit/icon/core/clock";

import { AtlassianLogo } from "@/components/ui/logo";
import { SlackLogo } from "@/components/ui/logo-third-party";
import { cn } from "@/lib/utils";

import type { SuggestionEvidenceKind } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";

/** 16px product mark for an evidence source. Jira history has no product of its own, so it gets a neutral clock tile. */
export function SourceIcon({ kind, className }: Readonly<{ kind: SuggestionEvidenceKind; className?: string }>) {
	switch (kind) {
		case "confluence":
		case "jira":
		case "loom":
			return <span className={cn("inline-flex size-4 shrink-0", className)}><AtlassianLogo label="" name={kind} size="xxsmall" /></span>;
		case "slack":
			return <span className={cn("inline-flex size-4 shrink-0", className)}><SlackLogo label="" size="xxsmall" /></span>;
		case "history":
			return (
				<span aria-hidden="true" className={cn("inline-flex size-4 shrink-0 items-center justify-center rounded-sm bg-bg-neutral text-icon-subtle [&_svg]:size-3", className)}>
					<ClockIcon color="currentColor" label="" size="small" />
				</span>
			);
		default: {
			const unreachable: never = kind;
			return unreachable;
		}
	}
}
