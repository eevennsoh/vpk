"use client";

// oxlint-disable react-doctor/jsx-no-jsx-as-prop -- DropdownMenuTrigger uses a render-node so the View button owns the visual state.
import { useRef, useState, type ComponentType } from "react";
import type { NewCoreIconProps } from "@atlaskit/icon/base-new";
import AiAgentIcon from "@atlaskit/icon/core/ai-agent";
import CrossIcon from "@atlaskit/icon/core/cross";
import EpicIcon from "@atlaskit/icon/core/epic";
import MergeFailureIcon from "@atlaskit/icon/core/merge-failure";
import MergeSuccessIcon from "@atlaskit/icon/core/merge-success";
import PersonIcon from "@atlaskit/icon/core/person";
import PriorityHighestIcon from "@atlaskit/icon/core/priority-highest";
import PriorityTrivialIcon from "@atlaskit/icon/core/priority-trivial";
import ProjectIcon from "@atlaskit/icon/core/project";
import PullRequestIcon from "@atlaskit/icon/core/pull-request";
import ScreenIcon from "@atlaskit/icon/core/screen";
import StatusSuccessIcon from "@atlaskit/icon/core/status-success";
import SubtasksIcon from "@atlaskit/icon/core/subtasks";
import TagIcon from "@atlaskit/icon/core/tag";
import CloudIcon from "@atlaskit/icon-lab/core/cloud";
import GroupIcon from "@atlaskit/icon-lab/core/group";
import MergeQueueIcon from "@atlaskit/icon-lab/core/merge-queue";
import StrokeWeightLargeIcon from "@atlaskit/icon/core/stroke-weight-large";

import { BOARD_GROUP_OPTIONS, BOARD_SWIMLANE_OPTIONS, TABLE_WORK_ITEM_GROUP_OPTIONS, type BoardGroupOptionId, type BoardSwimlaneOptionId } from "../data/board-group-options";
import {
	BOARD_AGENT_HOST_OPTIONS,
	BOARD_AGENT_STATE_OPTIONS,
	type BoardAgentFilterId,
	type BoardAgentSessionStateId,
	BOARD_PR_STATE_OPTIONS,
	type BoardPrStateId,
	isBoardAgentSessionStateId,
} from "../data/board-view-options";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { IconTile } from "@/components/ui/icon-tile";
import { Spinner } from "@/components/ui/spinner";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

export interface BoardGroupingControl {
	value: BoardSwimlaneOptionId | null;
	onChange: (group: BoardSwimlaneOptionId | null) => void;
	table?: boolean;
}

interface BoardViewMenuProps {
	compact?: boolean;
	grouping?: BoardGroupingControl;
	showGrouping?: boolean;
	/** Kept for the experimental header's shared control contract. */
	simpleViews?: boolean;
	surfaceLabel?: string;
	/** Writes Untracked session visibility. */
	showUntracked?: boolean;
	onShowUntrackedChange?: (showUntracked: boolean) => void;
	/** Writes linked session-state visibility. */
	shownSessionStateIds?: ReadonlySet<BoardAgentSessionStateId>;
	onShownSessionStateIdsChange?: (shownSessionStateIds: Set<BoardAgentSessionStateId>) => void;
	/**
	 * Agents focus row. The page owns this so a temporary tab switch does not
	 * drop the overlay or the Clear restore path.
	 */
	agentFilterId?: BoardAgentFilterId | null;
	onAgentFilterIdChange?: (agentFilterId: BoardAgentFilterId | null) => void;
}

type BoardSessionTypeOption = Exclude<(typeof BOARD_AGENT_HOST_OPTIONS)[number], { id: "all" }>;
type BoardSessionTypeId = BoardSessionTypeOption["id"];

const BOARD_SESSION_TYPE_OPTIONS = BOARD_AGENT_HOST_OPTIONS.filter(
	(option): option is BoardSessionTypeOption => option.id !== "all",
);

interface QuickViewOption<TId extends string = string> {
	id: TId;
	label: string;
	icon?: ComponentType<NewCoreIconProps>;
}

const GROUP_OPTION_ICONS = {
	agent: AiAgentIcon,
	assignee: PersonIcon,
	"atlassian-project": ProjectIcon,
	epic: EpicIcon,
	labels: TagIcon,
	priority: PriorityHighestIcon,
	subtask: SubtasksIcon,
	status: GroupIcon,
	"work-type": ProjectIcon,
	parent: EpicIcon,
} satisfies Record<BoardGroupOptionId, ComponentType<NewCoreIconProps>>;

function GroupOptionIcon({ icon: Glyph }: Readonly<{ icon: ComponentType<NewCoreIconProps> }>) {
	return <IconTile aria-hidden as="span" className="mr-3 shrink-0 text-icon-subtle" icon={<Glyph label="" size="small" />} iconSize="small" label="" size="xxsmall" variant="transparent" />;
}

interface GlyphStateIcon {
	glyph: ComponentType<NewCoreIconProps>;
	color: NewCoreIconProps["color"];
}

interface AvatarSpinnerStateIcon {
	spinner: "bloom-avatar";
}

type StateIcon = GlyphStateIcon | AvatarSpinnerStateIcon;

type StateIcons = Readonly<Record<string, StateIcon>>;

const MENU_LEADING_ICON_CLASS_NAME = "size-3 [&_svg]:size-3!";
/** Scale the 20px orb so its ~13.4px ring fills the 12px leading slot. */
const MENU_LEADING_SPINNER_CLASS_NAME = "origin-center scale-[1.49]";

function MenuLeadingIcon({ icon }: Readonly<{ icon: StateIcon }>) {
	if ("spinner" in icon) {
		switch (icon.spinner) {
			case "bloom-avatar":
				return (
					<Icon
						className={cn(
							MENU_LEADING_ICON_CLASS_NAME,
							"overflow-hidden text-icon-subtlest! [&_svg]:text-icon-subtlest!",
						)}
						render={(
							<Spinner
								className={MENU_LEADING_SPINNER_CLASS_NAME}
								label=""
								size="xs"
								variant="bloom-avatar"
							/>
						)}
					/>
				);
			default: {
				const _exhaustive: never = icon.spinner;
				return _exhaustive;
			}
		}
	}

	return (
		<Icon
			className={MENU_LEADING_ICON_CLASS_NAME}
			render={<icon.glyph color={icon.color} label="" size="small" />}
		/>
	);
}

interface BoardNeedsInputButtonProps {
	count: number;
	agentFilterId?: BoardAgentFilterId | null;
	onAgentFilterIdChange?: (agentFilterId: BoardAgentFilterId | null) => void;
}

export function BoardNeedsInputButton({
	count,
	agentFilterId = null,
	onAgentFilterIdChange,
}: Readonly<BoardNeedsInputButtonProps>) {
	const selected = agentFilterId === "needs-input";
	const agentLabel = count === 1 ? "agent" : "agents";

	return (
		<Button
			aria-label={`Needs input: ${count} ${agentLabel}`}
			aria-pressed={selected}
			onClick={() => onAgentFilterIdChange?.(selected ? null : "needs-input")}
			variant="outline"
		>
			Needs input
		</Button>
	);
}

export function BoardGroupByMenu({ compact = false, grouping }: Readonly<{ compact?: boolean; grouping?: BoardGroupingControl }>) {
	const triggerRef = useRef<HTMLButtonElement>(null);
	const [previewGroupId, setPreviewGroupId] = useState<BoardGroupOptionId | null>(null);
	const options = grouping?.table ? TABLE_WORK_ITEM_GROUP_OPTIONS : grouping ? BOARD_SWIMLANE_OPTIONS : BOARD_GROUP_OPTIONS;
	const selected = options.find((option) => option.id === (grouping ? grouping.value : previewGroupId));
	const selectGroup = (id: string | null) => {
		if (grouping) {
			grouping.onChange((grouping.table ? TABLE_WORK_ITEM_GROUP_OPTIONS : BOARD_SWIMLANE_OPTIONS).find((option) => option.id === id)?.id ?? null);
		} else {
			setPreviewGroupId(BOARD_GROUP_OPTIONS.find((option) => option.id === id)?.id ?? null);
		}
	};

	return (
		<ButtonGroup aria-label="Board grouping">
			<DropdownMenu>
				<DropdownMenuTrigger
					render={<Button ref={triggerRef} aria-label={selected ? `Group by ${selected.label}` : "Group"} aria-pressed={Boolean(selected)} size={compact ? "icon" : undefined} variant="outline" />}
				>
					<Icon aria-hidden data-icon={compact ? undefined : "inline-start"} render={<GroupIcon label="" />} />
					{compact ? null : "Group"}
				</DropdownMenuTrigger>
				<DropdownMenuContent align={compact ? "end" : "start"} className="min-w-56">
					<DropdownMenuRadioGroup aria-label="Group by" onValueChange={selectGroup} value={selected?.id ?? ""}>
						{options.map((option) => (
							<DropdownMenuRadioItem
								closeOnClick
								indicatorPlacement="end"
								key={option.id}
								onClick={option.id === selected?.id ? () => selectGroup(null) : undefined}
								value={option.id}
							>
								<GroupOptionIcon icon={GROUP_OPTION_ICONS[option.id]} />
								{option.label}
							</DropdownMenuRadioItem>
						))}
					</DropdownMenuRadioGroup>
				</DropdownMenuContent>
			</DropdownMenu>
			{selected ? (
				<Button
					aria-label="Clear grouping"
					className="border-border-selected bg-bg-selected text-text-selected hover:bg-bg-selected-hovered focus-visible:border-ring active:bg-bg-selected-pressed [&_svg]:text-icon-selected"
					data-selected=""
					onClick={() => {
						selectGroup(null);
						triggerRef.current?.focus();
					}}
					size="icon"
					variant="outline"
				>
					<Icon render={<CrossIcon label="" size="small" />} />
				</Button>
			) : null}
		</ButtonGroup>
	);
}

const PR_STATE_ICONS = {
	open: { glyph: PullRequestIcon, color: token("color.icon.success") },
	draft: { glyph: PullRequestIcon, color: token("color.icon.subtlest") },
	queued: { glyph: MergeQueueIcon, color: token("color.icon.information") },
	merged: { glyph: MergeSuccessIcon, color: token("color.icon.discovery") },
	closed: { glyph: MergeFailureIcon, color: token("color.icon.danger") },
} as const satisfies Record<BoardPrStateId, StateIcon>;

const AGENT_STATE_ICONS = {
	working: { spinner: "bloom-avatar" },
	"needs-input": { glyph: StrokeWeightLargeIcon, color: token("color.icon.information") },
	finished: { glyph: StatusSuccessIcon, color: token("color.icon.success") },
	untracked: { glyph: PriorityTrivialIcon, color: token("color.icon.subtlest") },
} as const satisfies Record<BoardAgentFilterId, StateIcon>;

const SESSION_TYPE_ICONS = {
	cloud: { glyph: CloudIcon, color: token("color.icon.subtle") },
	local: { glyph: ScreenIcon, color: token("color.icon.subtle") },
} as const satisfies Record<BoardSessionTypeId, StateIcon>;

interface QuickViewActionSubmenuProps<TId extends string> {
	label: string;
	options: readonly QuickViewOption<TId>[];
	icons?: StateIcons;
	selectedId?: TId | null;
	onSelect: (id: TId) => void;
}

function QuickViewActionSubmenu<TId extends string>({
	label,
	options,
	icons,
	selectedId = null,
	onSelect,
}: Readonly<QuickViewActionSubmenuProps<TId>>) {
	return (
		<DropdownMenuSub>
			<DropdownMenuSubTrigger>{label}</DropdownMenuSubTrigger>
			<DropdownMenuSubContent>
				<DropdownMenuRadioGroup
					aria-label={label}
					onValueChange={(id) => {
						const option = options.find((entry) => entry.id === id);
						if (option) {
							onSelect(option.id);
						}
					}}
					value={selectedId ?? ""}
				>
					{options.map((option) => {
						const stateIcon = icons?.[option.id];
						return (
							<DropdownMenuRadioItem
								className={stateIcon ? "gap-2" : undefined}
								indicatorPlacement="end"
								key={option.id}
								value={option.id}
							>
								{option.icon ? <GroupOptionIcon icon={option.icon} /> : stateIcon ? <MenuLeadingIcon icon={stateIcon} /> : null}
								{option.label}
							</DropdownMenuRadioItem>
						);
					})}
				</DropdownMenuRadioGroup>
			</DropdownMenuSubContent>
		</DropdownMenuSub>
	);
}

export function BoardViewMenu({
	compact = false,
	grouping,
	showGrouping = true,
	surfaceLabel = "board",
	agentFilterId: controlledAgentFilterId,
	onAgentFilterIdChange,
}: Readonly<BoardViewMenuProps>) {
	const [pullRequestFilterId, setPullRequestFilterId] = useState<BoardPrStateId | null>(null);
	const [sessionTypeFilterId, setSessionTypeFilterId] = useState<BoardSessionTypeId | null>(null);
	const [uncontrolledAgentFilterId, setUncontrolledAgentFilterId] = useState<BoardAgentFilterId | null>(null);
	const [previewGroupId, setPreviewGroupId] = useState<BoardGroupOptionId | null>(null);
	const groupByFilterId = grouping ? grouping.value : previewGroupId;
	const isAgentFilterControlled = onAgentFilterIdChange !== undefined;
	const agentFilterId = isAgentFilterControlled
		? (controlledAgentFilterId ?? null)
		: uncontrolledAgentFilterId;
	const setAgentFilterId = (nextFilterId: BoardAgentFilterId | null) => {
		if (isAgentFilterControlled) {
			onAgentFilterIdChange(nextFilterId);
			return;
		}
		setUncontrolledAgentFilterId(nextFilterId);
	};
	const selectedQuickViewCount = [
		pullRequestFilterId,
		agentFilterId,
		sessionTypeFilterId,
		groupByFilterId,
	].filter((id) => id !== null).length;
	const hasQuickViewSelection = selectedQuickViewCount > 0;

	const handlePullRequestSelect = (id: BoardPrStateId) => {
		setPullRequestFilterId(id);
	};

	const handleSessionTypeSelect = (id: BoardSessionTypeId) => {
		setSessionTypeFilterId(id);
	};

	const handleAgentSelect = (id: string) => {
		if (id !== "untracked" && !isBoardAgentSessionStateId(id)) {
			return;
		}
		setAgentFilterId(id);
	};

	const handleGroupBySelect = (id: BoardGroupOptionId) => {
		if (grouping) {
			const option = BOARD_SWIMLANE_OPTIONS.find((candidate) => candidate.id === id);
			if (option) grouping.onChange(option.id);
		} else {
			setPreviewGroupId(id);
		}
	};

	const clearQuickViewSelection = () => {
		setPullRequestFilterId(null);
		setAgentFilterId(null);
		setSessionTypeFilterId(null);
		if (grouping) grouping.onChange(null);
		else setPreviewGroupId(null);
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						aria-label={`Configure ${surfaceLabel} view`}
						aria-pressed={hasQuickViewSelection}
						size={compact ? "icon" : undefined}
						variant="outline"
					/>
				}
			>
				<Icon render={<GroupIcon label="" />} />
				{compact ? null : "View"}
				{hasQuickViewSelection && !compact ? (
					<Badge variant="information">{selectedQuickViewCount}</Badge>
				) : null}
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="min-w-56">
				<QuickViewActionSubmenu
					icons={PR_STATE_ICONS}
					label="Pull request"
					onSelect={handlePullRequestSelect}
					options={BOARD_PR_STATE_OPTIONS}
					selectedId={pullRequestFilterId}
				/>

				<QuickViewActionSubmenu
					icons={AGENT_STATE_ICONS}
					label="Agents"
					onSelect={handleAgentSelect}
					options={BOARD_AGENT_STATE_OPTIONS}
					selectedId={agentFilterId}
				/>

				<QuickViewActionSubmenu
					icons={SESSION_TYPE_ICONS}
					label="Session type"
					onSelect={handleSessionTypeSelect}
					options={BOARD_SESSION_TYPE_OPTIONS}
					selectedId={sessionTypeFilterId}
				/>

				{showGrouping ? <QuickViewActionSubmenu
					label="Group by"
					onSelect={handleGroupBySelect}
					options={(grouping ? BOARD_SWIMLANE_OPTIONS : BOARD_GROUP_OPTIONS).map((option) => ({ ...option, icon: GROUP_OPTION_ICONS[option.id] }))}
					selectedId={groupByFilterId}
				/> : null}

				{hasQuickViewSelection ? (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuItem onSelect={clearQuickViewSelection}>Clear selection</DropdownMenuItem>
					</>
				) : null}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
