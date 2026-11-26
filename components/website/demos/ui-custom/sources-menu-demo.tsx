"use client";

import {
	SOURCE_PREVIEW_PAGES,
	SourcesMenu,
} from "@/components/ui-custom/sources-menu";

const SOURCE_PREVIEW_TOASTER_ID = "sources-menu-demo";
const DEMO_SOURCES = [
	...SOURCE_PREVIEW_PAGES,
	{
		id: "vpk-repository",
		title: "VPK repository",
		href: "https://github.com/eevennsoh/vpk",
		updatedAt: new Date(2025, 9, 31),
		owner: "VPK team",
		snippet: "Source code and components for Venn Prototype Kit.",
	},
	{
		id: "team-conversation",
		title: "Team conversation",
		href: "https://atlassian.slack.com/",
		updatedAt: new Date(2025, 9, 31),
		owner: "VPK team",
		snippet: "Discussion and shared context from Slack.",
	},
];

export default function SourcesMenuDemo() {
	return (
		<div className="not-prose mb-4 flex flex-wrap items-start gap-8">
			<div className="flex flex-col items-start gap-2">
				<span className="text-xs text-text-subtle">Simple</span>
				<SourcesMenu pages={DEMO_SOURCES} variant="simple" />
			</div>
			<div className="flex flex-col items-start gap-2">
				<span className="text-xs text-text-subtle">Verbose</span>
				<SourcesMenu pages={DEMO_SOURCES} toasterId={SOURCE_PREVIEW_TOASTER_ID} />
			</div>
		</div>
	);
}
