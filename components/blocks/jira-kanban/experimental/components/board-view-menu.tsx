"use client";

// oxlint-disable react-doctor/jsx-no-jsx-as-prop -- DropdownMenuTrigger uses a render-node so the View button owns the visual state.
import { useState, type ComponentType } from "react";
import type { NewCoreIconProps } from "@atlaskit/icon/base-new";
import MergeFailureIcon from "@atlaskit/icon/core/merge-failure";
import MergeSuccessIcon from "@atlaskit/icon/core/merge-success";
import PriorityTrivialIcon from "@atlaskit/icon/core/priority-trivial";
import PullRequestIcon from "@atlaskit/icon/core/pull-request";
import QuestionCircleIcon from "@atlaskit/icon/core/question-circle";
import ScreenIcon from "@atlaskit/icon/core/screen";
import StatusSuccessIcon from "@atlaskit/icon/core/status-success";
import CloudIcon from "@atlaskit/icon-lab/core/cloud";
import GroupIcon from "@atlaskit/icon-lab/core/group";
import MergeQueueIcon from "@atlaskit/icon-lab/core/merge-queue";
import QuestionCircleFilledIcon from "@atlaskit/icon-lab/core/question-circle-filled";

import { BOARD_GROUP_OPTIONS, type BoardGroupOptionId } from "../data/board-group-options";
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
import { Spinner } from "@/components/ui/spinner";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

interface BoardViewMenuProps {
	compact?: boolean;
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
}

interface GlyphStateIcon {
	glyph: ComponentType<NewCoreIconProps>;
	color: NewCoreIconProps["color"];
}

interface ExperimentalSpinnerStateIcon {
	spinner: "experimental";
}

type StateIcon = GlyphStateIcon | ExperimentalSpinnerStateIcon;

type StateIcons = Readonly<Record<string, StateIcon>>;

const MENU_LEADING_ICON_CLASS_NAME = "size-3 [&_svg]:size-3!";
/** Scale the 20px orb so its ~13.4px ring fills the 12px leading slot. */
const MENU_LEADING_SPINNER_CLASS_NAME = "origin-center scale-[1.49]";

function MenuLeadingIcon({ icon }: Readonly<{ icon: StateIcon }>) {
	if ("spinner" in icon) {
		switch (icon.spinner) {
			case "experimental":
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
								variant="experimental"
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
			<Icon data-icon="inline-start" render={<QuestionCircleIcon label="" />} />
			Needs input
		</Button>
	);
}

export function BoardGroupByMenu() {
	const [groupByFilterId, setGroupByFilterId] = useState<BoardGroupOptionId | null>(null);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={<Button aria-label="Group" variant="outline" />}
			>
				<Icon data-icon="inline-start" render={<GroupIcon label="" />} />
				Group
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="min-w-56">
				<DropdownMenuRadioGroup
					aria-label="Group by"
					onValueChange={(id) => {
						const option = BOARD_GROUP_OPTIONS.find((candidate) => candidate.id === id);
						if (option) {
							setGroupByFilterId(option.id);
						}
					}}
					value={groupByFilterId ?? ""}
				>
					{BOARD_GROUP_OPTIONS.map((option) => (
						<DropdownMenuRadioItem
							indicatorPlacement="end"
							key={option.id}
							value={option.id}
						>
							{option.label}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
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
	working: { spinner: "experimental" },
	"needs-input": { glyph: QuestionCircleFilledIcon, color: token("color.icon.information") },
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
								{stateIcon ? <MenuLeadingIcon icon={stateIcon} /> : null}
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
	surfaceLabel = "board",
	agentFilterId: controlledAgentFilterId,
	onAgentFilterIdChange,
}: Readonly<BoardViewMenuProps>) {
	const [pullRequestFilterId, setPullRequestFilterId] = useState<BoardPrStateId | null>(null);
	const [sessionTypeFilterId, setSessionTypeFilterId] = useState<BoardSessionTypeId | null>(null);
	const [uncontrolledAgentFilterId, setUncontrolledAgentFilterId] = useState<BoardAgentFilterId | null>(null);
	const [groupByFilterId, setGroupByFilterId] = useState<BoardGroupOptionId | null>(null);
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
		setGroupByFilterId(id);
	};

	const clearQuickViewSelection = () => {
		setPullRequestFilterId(null);
		setAgentFilterId(null);
		setSessionTypeFilterId(null);
		setGroupByFilterId(null);
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

				<QuickViewActionSubmenu
					label="Group by"
					onSelect={handleGroupBySelect}
					options={BOARD_GROUP_OPTIONS}
					selectedId={groupByFilterId}
				/>

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
