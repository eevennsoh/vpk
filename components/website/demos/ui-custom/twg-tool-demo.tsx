"use client";

import { useState, type ReactNode } from "react";
import RefreshIcon from "@atlaskit/icon/core/refresh";
import {
	TwgTool,
	TwgToolSourceIcon,
	type TwgToolSource,
} from "@/components/ui-custom/twg-tool";
import {
	ChainOfThoughtSearchResult,
	ChainOfThoughtSearchResults,
	ChainOfThoughtStep,
} from "@/components/ui/chain-of-thought";
import { Button } from "@/components/ui/button";
import SearchIcon from "@atlaskit/icon/core/search";

const TWG_SOURCE: TwgToolSource = {
	id: "twg",
	label: "Teamwork Graph",
	provider: "twg",
};

const CONFLUENCE_SOURCE: TwgToolSource = {
	id: "confluence",
	label: "Confluence",
	provider: "confluence",
};

const DRIVE_SOURCE: TwgToolSource = {
	id: "google-drive",
	label: "Google Drive",
	provider: "google-drive",
};

const JIRA_SOURCE: TwgToolSource = {
	id: "jira",
	label: "Jira",
	provider: "jira",
};

const TEAMS_SOURCE: TwgToolSource = {
	id: "teams",
	label: "Teams",
	provider: "teams",
};

const SALESFORCE_SOURCE: TwgToolSource = {
	id: "salesforce",
	label: "Salesforce",
	provider: "salesforce",
};

const ALL_SOURCES = [
	TWG_SOURCE,
	CONFLUENCE_SOURCE,
	DRIVE_SOURCE,
	JIRA_SOURCE,
	TEAMS_SOURCE,
	SALESFORCE_SOURCE,
] as const;

const SEARCH_RESULT_CHIPS = [
	"www.atlassian.com",
	"www.vercel.com",
	"www.github.com",
	"www.npmjs.com",
] as const;

function InlineSource({
	children,
	source,
}: {
	children: string;
	source: TwgToolSource;
}) {
	return (
		<span className="inline-flex min-w-0 items-center gap-1">
			<TwgToolSourceIcon source={source} size="xxsmall" />
			<span className="truncate">{children}</span>
		</span>
	);
}

function ExpandedSearchResults({
	results = SEARCH_RESULT_CHIPS,
}: {
	results?: ReadonlyArray<string>;
}) {
	return (
		<ChainOfThoughtStep
			icon={SearchIcon}
			label="Evaluating sources"
			description="Ranking sources by recency and authority"
			status="complete"
			collapsible
			defaultOpen
		>
			<ChainOfThoughtSearchResults>
				{results.map((result) => (
					<ChainOfThoughtSearchResult key={result}>
						{result}
					</ChainOfThoughtSearchResult>
				))}
			</ChainOfThoughtSearchResults>
		</ChainOfThoughtStep>
	);
}

function TwgToolDemoFrame({ children }: Readonly<{ children: ReactNode }>) {
	return (
		<div className="flex min-h-full w-full items-center justify-center p-4">
			{children}
		</div>
	);
}

export default function TwgToolDemo() {
	const [replayKey, setReplayKey] = useState(0);

	return (
		<TwgToolDemoFrame>
			<div className="flex w-full max-w-3xl flex-col gap-4">
				<div className="flex justify-end">
					<Button
						aria-label="Replay TWG source stack animation"
						onClick={() => setReplayKey((currentKey) => currentKey + 1)}
						size="default"
						variant="outline"
					>
						<RefreshIcon label="" size="small" />
						Replay
					</Button>
				</div>
				<div key={replayKey} className="flex flex-col gap-8">
					<TwgTool
						description={<InlineSource source={TWG_SOURCE}>Upper arm strain repair</InlineSource>}
						sources={[TWG_SOURCE]}
						defaultOpen={false}
					>
						<ExpandedSearchResults />
					</TwgTool>
					<TwgTool
						description={<InlineSource source={CONFLUENCE_SOURCE}>Kerb collision post-incident analysis</InlineSource>}
						sources={[TWG_SOURCE, CONFLUENCE_SOURCE]}
						defaultOpen={false}
					>
						<ExpandedSearchResults />
					</TwgTool>
					<TwgTool
						description={<InlineSource source={DRIVE_SOURCE}>Upper arm faring refinement</InlineSource>}
						sources={[TWG_SOURCE, CONFLUENCE_SOURCE, DRIVE_SOURCE]}
						defaultOpen={false}
					>
						<ExpandedSearchResults />
					</TwgTool>
					<TwgTool
						description="Read through 6 sources"
						sources={ALL_SOURCES}
						status="complete"
						showLoader={false}
						contentClassName="pl-2"
						defaultOpen
					>
						<ExpandedSearchResults />
					</TwgTool>
				</div>
			</div>
		</TwgToolDemoFrame>
	);
}

export function TwgToolDemoSingleSource() {
	return (
		<TwgToolDemoFrame>
			<TwgTool
				className="w-full max-w-2xl"
				description={<InlineSource source={TWG_SOURCE}>Upper arm strain repair</InlineSource>}
				sources={[TWG_SOURCE]}
				defaultOpen
			>
				<ExpandedSearchResults />
			</TwgTool>
		</TwgToolDemoFrame>
	);
}

export function TwgToolDemoMultipleSources() {
	return (
		<TwgToolDemoFrame>
			<TwgTool
				className="w-full max-w-2xl"
				description={<InlineSource source={DRIVE_SOURCE}>Upper arm faring refinement</InlineSource>}
				sources={[TWG_SOURCE, CONFLUENCE_SOURCE, DRIVE_SOURCE, JIRA_SOURCE]}
				defaultOpen
			>
				<ExpandedSearchResults />
			</TwgTool>
		</TwgToolDemoFrame>
	);
}

export function TwgToolDemoCompleted() {
	return (
		<TwgToolDemoFrame>
			<TwgTool
				className="w-full max-w-2xl"
				description="Read through 6 sources"
				sources={ALL_SOURCES}
				status="complete"
				showLoader={false}
				contentClassName="pl-2"
				defaultOpen
			>
				<ExpandedSearchResults />
			</TwgTool>
		</TwgToolDemoFrame>
	);
}
