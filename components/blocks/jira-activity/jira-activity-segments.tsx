import * as React from "react";

import ArrowRightIcon from "@atlaskit/icon/core/arrow-right";
import PriorityHighIcon from "@atlaskit/icon/core/priority-high";
import PriorityHighestIcon from "@atlaskit/icon/core/priority-highest";
import PriorityLowIcon from "@atlaskit/icon/core/priority-low";
import PriorityLowestIcon from "@atlaskit/icon/core/priority-lowest";
import PriorityMediumIcon from "@atlaskit/icon/core/priority-medium";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { IconTile } from "@/components/ui/icon-tile";
import { RovoColorIcon } from "@/components/ui/logo";
import { BrandLogoMark } from "@/components/ui/logo-mark";
import { Lozenge } from "@/components/ui/lozenge";
import { Tag } from "@/components/ui/tag";
import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

import type { JiraActivityPriority, JiraActivitySegment } from "./jira-activity-types";

// ADS code family (Atlassian Mono) at body-small 12px / 16px — matches event copy.
const CHIP_BASE = "rounded-xs px-1 text-xs leading-4 align-middle";
const CHIP_FONT_STYLE = { fontFamily: token("font.family.code") } as const;

const PRIORITY_ICON = {
	Highest: PriorityHighestIcon,
	High: PriorityHighIcon,
	Medium: PriorityMediumIcon,
	Low: PriorityLowIcon,
	Lowest: PriorityLowestIcon,
} as const satisfies Record<JiraActivityPriority, typeof PriorityMediumIcon>;

const PRIORITY_ICON_CLASS = {
	Highest: "text-icon-danger",
	High: "text-icon-danger",
	Medium: "text-icon-warning",
	Low: "text-icon-information",
	Lowest: "text-icon-information",
} as const satisfies Record<JiraActivityPriority, string>;

function initialsOf(name: string): string {
	return (
		name
			.split(" ")
			.filter(Boolean)
			.slice(0, 2)
			.map((word) => word[0]?.toUpperCase())
			.join("") || "?"
	);
}

function SegmentContent({
	segment,
	appearance,
}: Readonly<{
	segment: JiraActivitySegment;
	appearance: "chip" | "plain";
}>) {
	if (appearance === "plain") {
		switch (segment.type) {
			case "lozenge":
			case "label":
			case "tag":
			case "app-mention":
				return <span className="text-text">{segment.text}</span>;
			default:
				break;
		}
	}

	switch (segment.type) {
		case "text":
			return segment.text;
		case "code":
			return (
				<code
					className={cn(CHIP_BASE, "bg-bg-neutral text-text")}
					style={CHIP_FONT_STYLE}
				>
					{segment.text}
				</code>
			);
		case "link":
			return (
				<a
					className={cn(
						CHIP_BASE,
						"bg-bg-accent-blue-subtler text-text-accent-blue no-underline hover:underline",
						"focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3 focus-visible:outline-none",
					)}
					href={segment.href ?? "#"}
					style={CHIP_FONT_STYLE}
				>
					{segment.text}
				</a>
			);
		case "user-mention":
			return (
				<Tag
					className="mx-0.5 align-middle text-[length:inherit]"
					color="gray"
					data-jira-activity-user-mention
					elemBefore={
						<span aria-hidden>
							<Avatar size="xs">
								{segment.avatarSrc ? (
									<AvatarImage alt="" src={segment.avatarSrc} />
								) : null}
								<AvatarFallback>{initialsOf(segment.text)}</AvatarFallback>
							</Avatar>
						</span>
					}
					type="user"
					variant="editor"
				>
					{segment.text}
				</Tag>
			);
		case "agent-mention":
			return (
				<Tag
					className="mx-0.5 align-middle text-[length:inherit]"
					color="gray"
					data-jira-activity-agent-mention
					elemBefore={
						<span aria-hidden>
							{segment.vpkLogo === "rovo" ? (
								<IconTile
									aria-hidden
									as="span"
									icon={<RovoColorIcon aria-hidden />}
									label=""
									size="xxsmall"
									variant="transparent"
								/>
							) : (
								<AgentAvatarVisual
									avatarClassName="after:border-0"
									avatarSrc={segment.avatarSrc}
									brandName={segment.brandName}
									fallbackText={segment.text}
									sizePx={16}
								/>
							)}
						</span>
					}
					type="agent"
					variant="editor"
				>
					{segment.text}
				</Tag>
			);
		case "app-mention":
			// Product tag (BrandLogoMark chip) — not a hexagon agent/app avatar.
			// Matches PullRequest repo pills / Tag demos. BrandLogoMark handles the
			// dark-mode treatment for near-black marks itself.
			return (
				<Tag
					className="mx-0.5 align-middle text-[length:inherit]"
					color="gray"
					data-jira-activity-app-mention
					elemBefore={
						segment.brandName ? (
							<BrandLogoMark
								frame="chip"
								label={segment.text}
								name={segment.brandName}
							/>
						) : undefined
					}
					variant="editor"
				>
					@{segment.text}
				</Tag>
			);
		case "lozenge":
			return (
				<Lozenge className="align-middle" variant={segment.variant ?? "neutral"}>
					{segment.text}
				</Lozenge>
			);
		case "label":
			return (
				<Tag
					className="align-middle"
					color={segment.color}
					data-jira-activity-label
				>
					{segment.text}
				</Tag>
			);
		case "tag":
			return (
				<Tag className="align-middle" color={segment.color ?? "gray"}>
					{segment.text}
				</Tag>
			);
		case "transition-arrow":
			return (
				<Icon
					aria-hidden
					className="mx-1 align-middle text-icon-subtle"
					render={<ArrowRightIcon color="currentColor" label="" size="small" />}
				/>
			);
		case "priority": {
			const PriorityIcon = PRIORITY_ICON[segment.text];
			return (
				<span className="inline-flex items-center gap-1 align-middle">
					<Icon
						aria-hidden
						className={PRIORITY_ICON_CLASS[segment.text]}
						render={<PriorityIcon color="currentColor" label="" size="small" />}
					/>
					<span className="text-text">{segment.text}</span>
				</span>
			);
		}
		default: {
			const _exhaustive: never = segment;
			throw new Error(`Unhandled activity segment: ${JSON.stringify(_exhaustive)}`);
		}
	}
}

/**
 * Renders a run of rich inline segments (shared by event lines and comment
 * bodies). Segments carry their own whitespace, so no separators are inserted —
 * this lets punctuation hug a chip (`…in ThreadedComments.tsx:`) while words get
 * spaced (`added Bug and UI polish`).
 */
export function JiraActivitySegments({
	segments,
	className,
	appearance = "chip",
}: Readonly<{
	segments: readonly JiraActivitySegment[];
	className?: string;
	appearance?: "chip" | "plain";
}>) {
	return (
		<span className={className}>
			{segments.map((segment, index) => (
				<React.Fragment
					key={`${segment.type}:${"text" in segment ? segment.text : index}:${index}`}
				>
					<SegmentContent appearance={appearance} segment={segment} />
				</React.Fragment>
			))}
		</span>
	);
}
