"use client";

import ClockIcon from "@atlaskit/icon/core/clock";

import { ConfluenceIcon, JiraIcon, LoomIcon } from "@/components/ui/logo";
import { SlackLogo } from "@/components/ui/logo-third-party";
import { Tile } from "@/components/ui/tile";

import type { SuggestionEvidenceKind } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";

type MarkSize = "xxsmall" | "xsmall" | "small";

/** Product mark for an evidence kind. Jira history uses a neutral clock tile: it is a pattern, not one item. */
export function SourceMark({ kind, size = "small" }: Readonly<{ kind: SuggestionEvidenceKind; size?: MarkSize }>) {
	switch (kind) {
		case "confluence":
			return <ConfluenceIcon label="" size={size} />;
		case "loom":
			return <LoomIcon label="" size={size} />;
		case "jira":
			return <JiraIcon label="" size={size} />;
		case "slack":
			return <SlackLogo label="" size={size} />;
		case "history":
			return (
				<Tile className="text-icon-subtle" label="" size={size} variant="neutral">
					<ClockIcon color="currentColor" label="" />
				</Tile>
			);
		default: {
			const unreachable: never = kind;
			return unreachable;
		}
	}
}
