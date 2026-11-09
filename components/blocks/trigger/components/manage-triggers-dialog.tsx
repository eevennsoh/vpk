"use client";

import { useMemo } from "react";
import {
	DndContext,
	KeyboardSensor,
	PointerSensor,
	closestCenter,
	useSensor,
	useSensors,
	type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import AutomationIcon from "@atlaskit/icon/core/automation";
import CrossIcon from "@atlaskit/icon/core/cross";

import {
	TriggerPicker,
	AgentTriggerProviderTileIcon,
	type AgentAutomationRule,
} from "@/components/blocks/trigger/page";
import {
	getAgentAutomationRuleLabel,
	getAgentTriggerReadableLabel,
	getTriggerProvider,
	type AgentTriggerProviderId,
} from "@/components/blocks/trigger/data/trigger-catalog";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogTitle,
} from "@/components/ui/dialog";
import { IconTile } from "@/components/ui/icon-tile";
import { Switch } from "@/components/ui/switch";
import { DeleteIcon, GripVerticalIcon } from "@/components/ui/vpk-icons";
import { cn } from "@/lib/utils";

interface ManageTriggersDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	automationRules: ReadonlyArray<AgentAutomationRule>;
	/** Picking a provider event from the header starts a new automation draft. */
	onAddAutomation: (providerId: AgentTriggerProviderId, eventId: string) => void;
	onReorderAutomations: (activeId: string, overId: string) => void;
	onToggleAutomation: (id: string, enabled: boolean) => void;
	onDeleteAutomation: (id: string) => void;
	onEditAutomation: (automationRule: AgentAutomationRule) => void;
}

/**
 * Compact list-management modal for automation rules. Event triggers stay
 * nested inside each automation editor so this surface never lists individual
 * event rows as standalone automations.
 */
export function ManageTriggersDialog({
	automationRules,
	open,
	onOpenChange,
	onAddAutomation,
	onReorderAutomations,
	onToggleAutomation,
	onDeleteAutomation,
	onEditAutomation,
}: Readonly<ManageTriggersDialogProps>) {
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	);
	const itemIds = useMemo(() => automationRules.map((rule) => rule.id), [automationRules]);

	function handleDragEnd(event: DragEndEvent): void {
		const { active, over } = event;
		if (!over || active.id === over.id) {
			return;
		}

		onReorderAutomations(String(active.id), String(over.id));
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="gap-0 overflow-hidden p-0" showCloseButton={false} size="md">
				<div className="flex items-center justify-between gap-3 p-6">
					<DialogTitle className="text-xl font-semibold leading-6 text-text">
						Manage flows
					</DialogTitle>
					<div className="flex items-center gap-2">
						{open ? (
							<TriggerPicker
								label="Add flow"
								onSelectEvent={onAddAutomation}
								trigger={
									<Button type="button" variant="outline">
										Add flow
									</Button>
								}
							/>
						) : null}
						<DialogClose render={<Button aria-label="Close" size="icon" variant="ghost" />}>
							<CrossIcon label="" />
						</DialogClose>
					</div>
				</div>

				<div className="px-6 pb-6">
					<DndContext
						id="manage-triggers-dnd"
						collisionDetection={closestCenter}
						modifiers={[restrictToVerticalAxis]}
						onDragEnd={handleDragEnd}
						sensors={sensors}
					>
						<SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
							<div className="flex flex-col gap-2">
								{automationRules.length > 0 ? (
									automationRules.map((rule, index) => (
										<ManageTriggersRow
											index={index}
											key={rule.id}
											onDelete={onDeleteAutomation}
											onEdit={onEditAutomation}
											onToggle={onToggleAutomation}
											automationRule={rule}
										/>
									))
								) : (
									<div className="rounded-lg border border-dashed border-border bg-surface p-4 text-center text-sm text-text-subtlest">
										No flows yet.
									</div>
								)}
							</div>
						</SortableContext>
					</DndContext>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function getAutomationRuleSecondary(rule: AgentAutomationRule): string {
	const triggerCount = rule.triggers.length;
	const providers = Array.from(new Set(
		rule.triggers
			.map((trigger) => getTriggerProvider(trigger.providerId)?.label)
			.filter((label): label is string => Boolean(label)),
	));
	const providerSummary = providers.slice(0, 2).join(", ");
	const countLabel = `${triggerCount} event trigger${triggerCount === 1 ? "" : "s"}`;
	return providerSummary ? `${countLabel} · ${providerSummary}` : countLabel;
}

function ManageAutomationFlowVisual({ rule }: Readonly<{ rule: AgentAutomationRule }>) {
	const visibleTriggers = rule.triggers.slice(0, 5);
	const overflowCount = Math.max(0, rule.triggers.length - visibleTriggers.length);

	return (
		<div className="flex items-center gap-2" aria-hidden={true}>
			<div className="flex min-w-0 items-center gap-1">
				{visibleTriggers.length > 0 ? (
					visibleTriggers.map((trigger) => (
						<span key={trigger.id} className="rich-text-command-menu-avatar inline-flex size-8 shrink-0 items-center justify-center">
							<AgentTriggerProviderTileIcon
								fallback={<AutomationIcon label="" size="small" />}
								trigger={trigger}
							/>
						</span>
					))
				) : (
					<IconTile
						aria-hidden={true}
						icon={<AutomationIcon label="" size="small" />}
						label="Trigger"
						size="medium"
						variant="blue"
					/>
				)}
				{overflowCount > 0 ? (
					<span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-border bg-bg-input px-1.5 text-xs font-medium leading-4 text-text-subtle">
						+{overflowCount}
					</span>
				) : null}
			</div>
		</div>
	);
}

function ManageTriggersRow({
	automationRule,
	index,
	onDelete,
	onEdit,
	onToggle,
}: Readonly<{
	automationRule: AgentAutomationRule;
	index: number;
	onDelete: (id: string) => void;
	onEdit: (automationRule: AgentAutomationRule) => void;
	onToggle: (id: string, enabled: boolean) => void;
}>) {
	const {
		attributes,
		listeners,
		setNodeRef,
		setActivatorNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: automationRule.id });
	const label = getAgentAutomationRuleLabel(automationRule, index);
	const enabled = automationRule.enabled !== false;
	const secondary = getAutomationRuleSecondary(automationRule);
	const firstTriggerLabel = automationRule.triggers[0]
		? getAgentTriggerReadableLabel(automationRule.triggers[0])
		: "No event triggers";
	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	return (
		<div
			className={cn(
				"flex w-full items-center gap-2 rounded-lg border border-border bg-surface p-2 transition-[box-shadow,opacity] duration-normal",
				!enabled && "opacity-60",
				isDragging && "z-10 opacity-80 shadow-lg",
			)}
			ref={setNodeRef}
			style={style}
		>
			<button
				aria-label={`Reorder flow ${index + 1}`}
				className="flex cursor-grab touch-none items-center rounded-md p-1 text-icon-subtlest transition-colors duration-normal hover:bg-bg-neutral-subtle-hovered hover:text-icon-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-selected active:cursor-grabbing"
				ref={setActivatorNodeRef}
				type="button"
				{...attributes}
				{...listeners}
			>
				<GripVerticalIcon size="small" />
			</button>
			<button
				className="flex min-w-0 flex-1 flex-col items-start gap-2 rounded-md px-1 py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-border-selected"
				onClick={() => onEdit(automationRule)}
				type="button"
			>
				<ManageAutomationFlowVisual rule={automationRule} />
				<div className="min-w-0 self-stretch">
					<div className="truncate text-sm font-medium leading-5 text-text">
						{label}
					</div>
					<div className="truncate text-xs leading-4 text-text-subtle">
						{secondary}
					</div>
					<div className="mt-2 truncate text-xs leading-4 text-text">
						Starts with {firstTriggerLabel}
					</div>
				</div>
			</button>
			<Switch
				checked={enabled}
				label={`${enabled ? "Disable" : "Enable"} ${label}`}
				onCheckedChange={(nextEnabled) => onToggle(automationRule.id, nextEnabled)}
			/>
			<button
				aria-label={`Delete ${label}`}
				className="flex size-8 shrink-0 items-center justify-center rounded-md text-text-subtlest transition-colors duration-normal hover:bg-bg-danger-hovered hover:text-text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-selected"
				onClick={() => onDelete(automationRule.id)}
				type="button"
			>
				<DeleteIcon />
			</button>
		</div>
	);
}
