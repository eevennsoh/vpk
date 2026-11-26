"use client";

import SearchIcon from "@atlaskit/icon/core/search";

import { Badge } from "@/components/ui/badge";
import {
	InputGroup,
	InputGroupSearchAddon,
	InputGroupInput,
} from "@/components/ui/input-group";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { token } from "@/lib/tokens";

import type { JiraForYouTab } from "./jira-for-you-types";

/** Tab bar beside the heading; omit it for a feed with no tab filters. */
export interface JiraForYouHeaderTabs {
	activeTabId: string;
	onTabChange: (tabId: string) => void;
	tabs: readonly JiraForYouTab[];
}

export function JiraForYouHeader({
	onQueryChange,
	query,
	tabNavigation,
}: Readonly<{
	onQueryChange: (query: string) => void;
	query: string;
	tabNavigation?: JiraForYouHeaderTabs;
}>) {
	return (
		<div
			className="@container flex min-w-0 flex-col gap-4 overflow-x-hidden"
			data-testid="jira-for-you-header"
		>
			{/*
			 * One line: a 56px band (min-h-14) sits flush at the top to align with
			 * the chat/detail headers. Wrapped (@max-[28rem]): the heading stacks
			 * over the tabs and regains a top gap equal to the feed's horizontal
			 * padding via --feed-stack-top (falls back to 0 when the var is unset,
			 * e.g. the standalone JiraForYouPage which pads its own wrapper).
			 */}
			<div
				className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 @min-[28rem]:min-h-14 @max-[28rem]:mt-[var(--feed-stack-top)] @max-[28rem]:flex-col @max-[28rem]:items-stretch @max-[28rem]:justify-start @max-[28rem]:gap-y-4"
				data-testid="jira-for-you-heading-tabs-row"
			>
				<h2 className="shrink-0 text-text" style={{ font: token("font.heading.small") }}>
					For you
				</h2>
				{tabNavigation ? <Tabs
					className="min-w-0 max-w-full flex-none @max-[28rem]:w-full"
					onValueChange={(value) => tabNavigation.onTabChange(String(value))}
					value={tabNavigation.activeTabId}
				>
					<TabsList className="h-auto w-max max-w-full flex-nowrap justify-start overflow-x-auto @max-[28rem]:w-full">
						{tabNavigation.tabs.map((tab) => (
							<TabsTrigger
								className="shrink-0 flex-none @max-[28rem]:min-w-12 @max-[28rem]:flex-[1_1_auto] @max-[28rem]:overflow-hidden"
								key={tab.id}
								value={tab.id}
							>
								<span className="min-w-0 flex-1 truncate">{tab.label}</span>
								{typeof tab.count === "number" ? <Badge>{tab.count}</Badge> : null}
							</TabsTrigger>
						))}
					</TabsList>
				</Tabs> : null}
			</div>
			<InputGroup className="min-w-0">
				<InputGroupSearchAddon>
					<SearchIcon label="" />
				</InputGroupSearchAddon>
				<InputGroupInput
					type="search"
					aria-label="Search work items"
					onChange={(event) => onQueryChange(event.currentTarget.value)}
					placeholder="Search"
					value={query}
				/>
			</InputGroup>
		</div>
	);
}
