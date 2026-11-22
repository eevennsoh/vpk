"use client";

import { useState } from "react";

import AiAgentIcon from "@atlaskit/icon/core/ai-agent";

import {
	filterMetadataSearchItems,
	METADATA_PICKER_POPOVER_CLASS,
	METADATA_PICKER_POSITIONER_CLASS,
	METADATA_PICKER_SIDE_OFFSET,
} from "@/components/blocks/jira-work-item/experimental/components/detail-field-editors";
import { DetailValueTrigger } from "@/components/blocks/jira-work-item/experimental/components/detail-field-row";
import { BOARD_AGENTS } from "@/components/projects/jira/data/board-agents";
import { AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CheckIcon } from "@/components/ui/vpk-icons";
import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";
import {
	RichTextCommandMenuSearchField,
	RichTextSuggestionEmptyState,
	RichTextSuggestionMenu,
	type RichTextSuggestionMenuItem,
} from "@/components/ui-custom/rich-text-editor/menus";

const ARTIFACT_PANE_AGENTS = BOARD_AGENTS.filter((agent) => Boolean(agent.avatarSrc || agent.brandName));

function ArtifactAgentsSearchPicker({
	items,
	onEscape,
	onSelect,
	selectedItemIds,
}: Readonly<{
	items: readonly RichTextSuggestionMenuItem[];
	onEscape: () => void;
	onSelect: (item: RichTextSuggestionMenuItem) => void;
	selectedItemIds: ReadonlySet<string>;
}>) {
	const [query, setQuery] = useState("");
	const visibleItems = filterMetadataSearchItems(items, query);

	return (
		<RichTextSuggestionMenu
			className="rich-text-command-menu-borderless"
			emptyLabel="No agents found"
			emptyState={<RichTextSuggestionEmptyState label="No agents found" />}
			header={(
				<RichTextCommandMenuSearchField
					autoFocus
					label="Search agents"
					onClear={() => setQuery("")}
					onEscape={onEscape}
					onValueChange={setQuery}
					value={query}
				/>
			)}
			items={visibleItems}
			onSelect={onSelect}
			selectedIndex={-1}
			selectedItemIds={selectedItemIds}
			title="Search agents"
		/>
	);
}

/** Shared Artifact Pane agents trigger, avatar group, and multi-select picker. */
export function ArtifactPaneAgentsField({
	value,
	onChange,
}: Readonly<{ value: readonly string[]; onChange: (ids: string[]) => void }>) {
	const [open, setOpen] = useState(false);
	const items = ARTIFACT_PANE_AGENTS.map((agent): RichTextSuggestionMenuItem => ({
		description: agent.byline,
		icon: <AiAgentIcon label="" size="small" />,
		id: agent.id,
		label: agent.name,
		leadingVisual: (
			<AgentAvatarVisual
				avatarSrc={agent.avatarSrc}
				brandName={agent.brandName}
				fallbackText={agent.name.slice(0, 2).toUpperCase()}
				sizePx={24}
			/>
		),
		trailing: value.includes(agent.id) ? <CheckIcon className="size-4 text-icon-subtle" /> : undefined,
	}));
	const selectedAgents = value
		.map((id) => ARTIFACT_PANE_AGENTS.find((agent) => agent.id === id))
		.filter((agent): agent is (typeof ARTIFACT_PANE_AGENTS)[number] => Boolean(agent));

	const toggleAgent = (id: string) => {
		onChange(value.includes(id) ? value.filter((agentId) => agentId !== id) : [...value, id]);
	};

	return (
		<Popover onOpenChange={setOpen} open={open}>
			<PopoverTrigger render={<DetailValueTrigger aria-label="Edit agents" />}>
				{selectedAgents.length > 0 ? (
					<AvatarGroup className="relative shrink-0" label={`${selectedAgents.length} agents`}>
						{selectedAgents.slice(0, 3).map((agent) => (
							<AgentAvatarVisual
								avatarClassName="shrink-0"
								avatarSrc={agent.avatarSrc}
								brandName={agent.brandName}
								fallbackText={agent.name.slice(0, 2).toUpperCase()}
								key={agent.id}
								sizePx={24}
							/>
						))}
						{selectedAgents.length > 3 ? (
							<AvatarGroupCount>+{selectedAgents.length - 3}</AvatarGroupCount>
						) : null}
					</AvatarGroup>
				) : (
					<span className="text-sm text-text-subtlest">Add agents</span>
				)}
			</PopoverTrigger>
			<PopoverContent
				align="start"
				className={METADATA_PICKER_POPOVER_CLASS}
				positionerClassName={METADATA_PICKER_POSITIONER_CLASS}
				sideOffset={METADATA_PICKER_SIDE_OFFSET}
			>
				<ArtifactAgentsSearchPicker
					items={items}
					onEscape={() => setOpen(false)}
					onSelect={(item) => toggleAgent(item.id)}
					selectedItemIds={new Set(value)}
				/>
			</PopoverContent>
		</Popover>
	);
}
