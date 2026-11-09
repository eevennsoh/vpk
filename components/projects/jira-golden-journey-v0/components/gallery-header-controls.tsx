"use client";

import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import ChevronLeftIcon from "@atlaskit/icon/core/chevron-left";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { FOCUS_RING_CLIP_GUTTER } from "@/components/ui/focus-ring";
import { cn } from "@/lib/utils";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { UseAutoCycleResult } from "../hooks/use-auto-cycle";
import type { TerminalDemoController } from "../hooks/use-terminal-demo";
import { getTerminalScreenProgress } from "../lib/terminal-demo-state";
import { ASX_CARD_KANBAN_STATES } from "../data/card-kanban-data";
import { ASX_GALLERY_ITEMS } from "../data/gallery-items";
import { WORK_ITEM_STATES } from "../data/work-item-states";
import type { WorkItemStageController } from "./work-item-stage";

interface GalleryHeaderControlsProps {
	selectedId: string;
	cardKanbanController: UseAutoCycleResult;
	terminalController: TerminalDemoController;
	workItemController: WorkItemStageController;
}

interface ActiveHeaderState {
	label: string;
	position: number;
	count: number;
	options: readonly { label: string; select: () => void; selected: boolean }[];
	previous: (() => void) | null;
	next: (() => void) | null;
}

function progressLabel(label: string, position: number, count: number): string {
	return count === 1 ? label : `${label} \u00b7 ${position + 1} of ${count}`;
}

function resolveHeaderState({
	selectedId,
	cardKanbanController,
	terminalController,
	workItemController,
}: GalleryHeaderControlsProps): ActiveHeaderState {
	if (selectedId === "terminal") {
		const { position, count } = getTerminalScreenProgress(
			terminalController.state.beatIndex,
			terminalController.beatCount,
		);
		return {
			label: "Terminal",
			position,
			count,
			options: [{ label: "Terminal", select: terminalController.restart, selected: true }],
			previous: terminalController.state.beatIndex >= 0 ? terminalController.stepBack : null,
			next: terminalController.state.finished ? null : terminalController.advance,
		};
	}

	if (selectedId === "card") {
		const { activeIndex, setActiveIndex } = cardKanbanController;
		const count = ASX_CARD_KANBAN_STATES.length;
		return {
			label: "Card kanban",
			position: activeIndex,
			count,
			options: [{ label: "Card kanban", select: cardKanbanController.restart, selected: true }],
			previous: activeIndex > 0 ? () => setActiveIndex(activeIndex - 1) : null,
			next: activeIndex < count - 1 ? () => setActiveIndex(activeIndex + 1) : null,
		};
	}

	if (selectedId === "work-item") {
		const position = Math.max(
			WORK_ITEM_STATES.findIndex((option) => option.value === workItemController.preset),
			0,
		);
		return {
			label: WORK_ITEM_STATES[position]?.label ?? "Work item",
			position,
			count: WORK_ITEM_STATES.length,
			options: WORK_ITEM_STATES.map((option) => ({
				label: option.label,
				select: () => workItemController.selectPreset(option.value),
				selected: option.value === workItemController.preset,
			})),
			previous: position > 0
				? () => workItemController.selectPreset(WORK_ITEM_STATES[position - 1].value)
				: null,
			next: position < WORK_ITEM_STATES.length - 1
				? () => workItemController.selectPreset(WORK_ITEM_STATES[position + 1].value)
				: null,
		};
	}

	const label = ASX_GALLERY_ITEMS.find((item) => item.id === selectedId)?.title ?? "Gallery";
	return {
		label,
		position: 0,
		count: 1,
		options: [],
		previous: null,
		next: null,
	};
}

export function JiraGoldenJourneyV0HeaderControls(
	props: Readonly<GalleryHeaderControlsProps>,
): React.ReactElement {
	const state = resolveHeaderState(props);
	const isAutomatedSequence = props.selectedId === "terminal" || props.selectedId === "card";

	return (
		<div
			className={cn(
				"scrollbar-none max-w-[calc(100vw-12rem)] overflow-x-auto",
				FOCUS_RING_CLIP_GUTTER,
			)}
		>
			<ButtonGroup
				aria-label="Open a Jira Golden Journey v0 section"
				className="w-max [&>[data-slot]~[data-slot]]:-ml-px [&>[data-slot]~[data-slot]]:border-l!"
				data-card-kanban-navigation={props.selectedId === "card" ? "" : undefined}
				variant="connected"
			>
				{isAutomatedSequence || state.count === 1 ? (
					<Button aria-pressed size="compact" type="button" variant="outline">
						{progressLabel(state.label, state.position, state.count)}
					</Button>
				) : state.options.map((option) => (
					<Button
						aria-pressed={option.selected}
						className="aria-pressed:z-10"
						key={option.label}
						onClick={option.select}
						size="compact"
						type="button"
						variant="outline"
					>
						{option.label}
					</Button>
				))}
			</ButtonGroup>
		</div>
	);
}

export function JiraGoldenJourneyV0CompactHeaderControls(
	props: Readonly<GalleryHeaderControlsProps>,
): React.ReactElement {
	const state = resolveHeaderState(props);
	const activeLabel = progressLabel(state.label, state.position, state.count);

	return (
		<div className="flex items-center text-sm text-text" data-card-kanban-navigation={props.selectedId === "card" ? "" : undefined}>
			{props.selectedId !== "card" ? <Button
				aria-label="Previous section step"
				className="mr-2"
				disabled={state.previous === null}
				onClick={() => state.previous?.()}
				size="icon-compact"
				type="button"
				variant="outline"
			>
				<ChevronLeftIcon label="" size="small" />
			</Button> : null}
			{state.options.length > 0 ? (
				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<button
								aria-label="Jump to section"
								className="mr-2 flex items-center gap-1 rounded-sm px-1 py-0.5 tabular-nums text-text outline-none hover:text-text-subtle focus-visible:ring-2 focus-visible:ring-ring/50"
								type="button"
							/>
						}
					>
						<span>{activeLabel}</span>
						<ChevronDownIcon label="" size="small" />
					</DropdownMenuTrigger>
					<DropdownMenuContent align="center" portalled={false}>
						{state.options.map((option) => (
							<DropdownMenuItem
								key={option.label}
								onSelect={option.select}
								selected={option.selected}
							>
								{option.label}
							</DropdownMenuItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
			) : (
				<span className="mr-2 px-1 py-0.5 tabular-nums">{activeLabel}</span>
			)}
			{props.selectedId !== "card" ? <Button
				aria-label="Next section step"
				disabled={state.next === null}
				onClick={() => state.next?.()}
				size="icon-compact"
				type="button"
				variant="outline"
			>
				<ChevronRightIcon label="" size="small" />
			</Button> : null}
		</div>
	);
}
