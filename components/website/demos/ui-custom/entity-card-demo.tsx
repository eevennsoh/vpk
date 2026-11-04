"use client";

import { useState } from "react";
import PageIcon from "@atlaskit/icon/core/page";
import SearchIcon from "@atlaskit/icon/core/search";

import {
	DEFAULT_KNOWLEDGE_APPS,
	getKnowledgeAppIcon,
} from "@/app/data/directory/knowledge";
import {
	EntityCardAgentCard,
	EntityCardAppCard,
	EntityCardKnowledgeCard,
	EntityCardSkillCard,
	EntityCardToolCard,
} from "@/components/ui-custom/entity-card";
import { ConfluenceLogo } from "@/components/ui/logo";
import { LogoThirdParty } from "@/components/ui/logo-third-party";

const KNOWLEDGE_DEMO_STATS = [
	{ starCount: 38, verified: true, teammateCount: 6273 },
	{ starCount: 124, verified: false, teammateCount: 18400 },
] as const;

function DemoKnowledgeCard({
	added = false,
	index = 0,
	onSelect,
	selected,
}: Readonly<{ added?: boolean; index?: number; onSelect?: (checked?: boolean) => void; selected?: boolean }>) {
	const app = DEFAULT_KNOWLEDGE_APPS[index] ?? DEFAULT_KNOWLEDGE_APPS[0];

	if (!app) {
		return null;
	}

	const stats = KNOWLEDGE_DEMO_STATS[index] ?? KNOWLEDGE_DEMO_STATS[0];

	return (
		<EntityCardKnowledgeCard
			added={added}
			description={app.description}
			icon={getKnowledgeAppIcon(app)}
			name={app.name}
			onSelect={onSelect ?? (() => {})}
			publisher={app.providerName}
			selected={selected}
			starCount={stats.starCount}
			verified={stats.verified}
			teammateCount={stats.teammateCount}
		/>
	);
}

function AddRemoveEntityCardsDemo() {
	const [addedIds, setAddedIds] = useState<ReadonlySet<string>>(() => new Set(["find-similar-work"]));

	function setSkillAdded(id: string, checked: boolean): void {
		setAddedIds((current) => {
			const next = new Set(current);
			if (checked) {
				next.add(id);
			} else {
				next.delete(id);
			}
			return next;
		});
	}

	const createPageAdded = addedIds.has("create-page");
	const findSimilarWorkAdded = addedIds.has("find-similar-work");

	return (
		<div className="flex flex-col gap-3">
			<p className="text-sm font-semibold leading-5 text-text-subtle">Add/remove</p>
			<div className="columns-1 gap-3 sm:columns-2 [&>*]:mb-3 [&>*]:break-inside-avoid">
				<EntityCardSkillCard
					added={createPageAdded}
					description="Create a new formatted, rich text document or page in Confluence."
					icon={<PageIcon label="" />}
					iconVariant="blue"
					name="Create page"
					onMoreActions={() => {}}
					onAddedChange={(checked) => setSkillAdded("create-page", checked)}
					source={{ type: "custom", name: "Venn", avatarSrc: "/avatar-human/maia-ma.png" }}
					starCount={38}
					teammateCount={6273}
				/>
				<EntityCardSkillCard
					added={findSimilarWorkAdded}
					description="Find related issues and pages across your team's workspace."
					icon={<SearchIcon label="" />}
					iconVariant="purple"
					name="Find similar work"
					onMoreActions={() => {}}
					onAddedChange={(checked) => setSkillAdded("find-similar-work", checked)}
					source={{ type: "app", name: "Slack", brandName: "slack" }}
					starCount={120}
					teammateCount={4100}
				/>
			</div>
		</div>
	);
}

/**
 * Multi-select state — passing a `selected` boolean opts a directory card into
 * select mode: the leading icon swaps to a 16×16 checkbox on hover and while
 * selected, and the card gains a persistent blue selected border. `onSelect`
 * toggles the state (fired by both the whole-card click and the checkbox).
 */
function SelectableEntityCardsDemo() {
	const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(() => new Set(["create-page"]));

	const toggle = (id: string) => {
		setSelectedIds((current) => {
			const next = new Set(current);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	};

	return (
		<div className="flex flex-col gap-3">
			<p className="text-sm font-semibold leading-5 text-text-subtle">Selectable</p>
			<div className="columns-1 gap-3 sm:columns-2 [&>*]:mb-3 [&>*]:break-inside-avoid">
				<EntityCardSkillCard
					description="Create a new formatted, rich text document or page in Confluence."
					icon={<PageIcon label="" />}
					iconVariant="blue"
					name="Create page"
					onSelect={() => toggle("create-page")}
					publisher="Atlassian"
					selected={selectedIds.has("create-page")}
					starCount={38}
					verified
					teammateCount={6273}
				/>
				<EntityCardAppCard
					appLogo={<ConfluenceLogo size="medium" />}
					description="Create, search, and update pages across your Confluence sites."
					knowledgeCount={4}
					name="Confluence"
					onSelect={() => toggle("confluence-app")}
					selected={selectedIds.has("confluence-app")}
					teammateCount={258}
					toolCount={36}
				/>
				<EntityCardToolCard
					appLogo={<LogoThirdParty name="slack" size="medium" label="" />}
					description="Send messages and search conversations from your workspace."
					name="Slack"
					onSelect={() => toggle("slack-tool")}
					selected={selectedIds.has("slack-tool")}
					teammateCount={540}
					toolCount={12}
				/>
				<DemoKnowledgeCard
					onSelect={() => toggle("knowledge-0")}
					selected={selectedIds.has("knowledge-0")}
				/>
			</div>
		</div>
	);
}

export default function EntityCardDemo() {
	return (
		<div className="flex w-full max-w-2xl flex-col gap-8">
			{/* CSS columns (masonry-style) instead of a grid so each card keeps its
			    natural height — a grid forces every card in a row to the tallest
			    card's height, which breaks the design. `break-inside-avoid` keeps a
			    card whole within a column. */}
			<div className="w-full columns-1 gap-3 sm:columns-2 [&>*]:mb-3 [&>*]:break-inside-avoid">
				<EntityCardSkillCard
					description="Create a new formatted, rich text document or page in Confluence."
					icon={<PageIcon label="" />}
					iconVariant="blue"
					name="Create page"
					onMoreActions={() => {}}
					onSelect={() => {}}
					publisher="Atlassian"
					starCount={38}
					verified
					teammateCount={6273}
				/>
				<EntityCardAppCard
					appLogo={<ConfluenceLogo size="medium" />}
					description="Create, search, and update pages across your Confluence sites."
					knowledgeCount={4}
					name="Confluence"
					onMoreActions={() => {}}
					onSelect={() => {}}
					teammateCount={258}
					toolCount={36}
				/>
				<EntityCardToolCard
					appLogo={<ConfluenceLogo size="medium" />}
					description="Create, search, and update pages across your Confluence sites."
					name="Confluence"
					onMoreActions={() => {}}
					onSelect={() => {}}
					teammateCount={258}
					toolCount={36}
				/>
				<EntityCardAgentCard
					avatarSrc="/avatar-agent-new/purple/customer-insight.svg"
					chatCount={9400}
					description="Surfaces themes and sentiment from raw customer feedback in seconds."
					feedbackCount={1280}
					name="Feedback analyzer"
					onMoreActions={() => {}}
					onSelect={() => {}}
					publisher="Atlassian"
					rating={4.6}
					verified
				/>
				<DemoKnowledgeCard />
			</div>

			<SelectableEntityCardsDemo />

			<AddRemoveEntityCardsDemo />
		</div>
	);
}

export function EntityCardDemoAddRemove() {
	return <AddRemoveEntityCardsDemo />;
}

export function EntityCardDemoSkills() {
	return (
		<div className="w-full max-w-2xl columns-1 gap-3 sm:columns-2 [&>*]:mb-3 [&>*]:break-inside-avoid">
			<EntityCardSkillCard
				description="Create a new formatted, rich text document or page in Confluence."
				icon={<PageIcon label="" />}
				iconVariant="blue"
				name="Create page"
				onMoreActions={() => {}}
				onSelect={() => {}}
				source={{ type: "custom", name: "Venn", avatarSrc: "/avatar-human/maia-ma.png" }}
				starCount={38}
				teammateCount={6273}
			/>
			<EntityCardSkillCard
				description="Find related issues and pages across your team's workspace."
				icon={<SearchIcon label="" />}
				iconVariant="purple"
				name="Find similar work"
				onMoreActions={() => {}}
				onSelect={() => {}}
				source={{ type: "app", name: "Slack", brandName: "slack" }}
				starCount={120}
				teammateCount={4100}
			/>
		</div>
	);
}

export function EntityCardDemoApps() {
	return (
		<div className="w-full max-w-2xl columns-1 gap-3 sm:columns-2 [&>*]:mb-3 [&>*]:break-inside-avoid">
			<EntityCardAppCard
				appLogo={<ConfluenceLogo size="medium" />}
				description="Create, search, and update pages across your Confluence sites."
				knowledgeCount={4}
				mentionHandle="confluence"
				name="Confluence"
				onMoreActions={() => {}}
				onSelect={() => {}}
				promptSuggestion="Find the latest release notes and summarize what changed this sprint."
				teammateCount={258}
				toolCount={36}
			/>
			<EntityCardAppCard
				appLogo={<LogoThirdParty name="slack" size="medium" label="" />}
				description="Send messages and search conversations from your workspace."
				mentionHandle="slack"
				name="Slack"
				onMoreActions={() => {}}
				onSelect={() => {}}
				promptSuggestion="Summarize the unread threads in my team channel from today."
				teammateCount={540}
				toolCount={12}
			/>
		</div>
	);
}

export function EntityCardDemoTools() {
	return (
		<div className="w-full max-w-2xl columns-1 gap-3 sm:columns-2 [&>*]:mb-3 [&>*]:break-inside-avoid">
			<EntityCardToolCard
				appLogo={<ConfluenceLogo size="medium" />}
				description="Create, search, and update pages across your Confluence sites."
				name="Confluence"
				onMoreActions={() => {}}
				onSelect={() => {}}
				teammateCount={258}
				toolCount={36}
			/>
			<EntityCardToolCard
				appLogo={<LogoThirdParty name="slack" size="medium" label="" />}
				description="Send messages and search conversations from your workspace."
				name="Slack"
				onMoreActions={() => {}}
				onSelect={() => {}}
				teammateCount={540}
				toolCount={12}
			/>
		</div>
	);
}

export function EntityCardDemoAgents() {
	return (
		<div className="w-full max-w-2xl columns-1 gap-3 sm:columns-2 [&>*]:mb-3 [&>*]:break-inside-avoid">
			<EntityCardAgentCard
				avatarSrc="/avatar-agent-new/purple/customer-insight.svg"
				chatCount={9400}
				description="Surfaces themes and sentiment from raw customer feedback in seconds."
				feedbackCount={1280}
				name="Feedback analyzer"
				onMoreActions={() => {}}
				onSelect={() => {}}
				publisher="Atlassian"
				rating={4.6}
				verified
			/>
			<EntityCardAgentCard
				avatarSrc="/avatar-agent-new/lime/auto-review.svg"
				chatCount={1500}
				description="Reviews PRs for style, correctness, and security gotchas."
				feedbackCount={340}
				name="Code reviewer"
				onMoreActions={() => {}}
				onSelect={() => {}}
				publisher="Mei Tan"
				rating={4.2}
			/>
		</div>
	);
}

export function EntityCardDemoKnowledge() {
	return (
		<div className="w-full max-w-2xl columns-1 gap-3 sm:columns-2 [&>*]:mb-3 [&>*]:break-inside-avoid">
			<DemoKnowledgeCard />
			<DemoKnowledgeCard index={1} />
		</div>
	);
}
