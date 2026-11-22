import { useId, useState, type CSSProperties, type ReactNode } from "react";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";
import EpicIcon from "@atlaskit/icon/core/epic";
import SubtasksIcon from "@atlaskit/icon/core/subtasks";
import TagIcon from "@atlaskit/icon/core/tag";
import { PRIORITY_COLORS, PRIORITY_ICONS } from "@/components/blocks/jira-issue/priority-model";
import { Avatar, AvatarFallback, AvatarImage, AvatarUnassigned } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";
import { cn } from "@/lib/utils";
import type { BoardSwimlane as Swimlane } from "../lib/board-swimlanes";

function SwimlaneVisual({ identity, label }: Readonly<Pick<Swimlane, "identity" | "label">>) {
	switch (identity.kind) {
		case "assignee":
			return identity.assignee ? (
				<Avatar size="sm" label={label}>
					<AvatarImage alt="" src={identity.assignee.avatarSrc} />
					<AvatarFallback>{label.slice(0, 1)}</AvatarFallback>
				</Avatar>
			) : <AvatarUnassigned kind="person" size="sm" label={label} />;
		case "agent":
			return <AgentAvatarVisual appearance="coding" label={label} sizePx={24} avatarSrc={identity.avatarSrc} brandName={identity.brandName} vpkLogo={identity.vpkLogo} fallbackText={label.slice(0, 1)} />;
		case "priority": {
			const PriorityIcon = PRIORITY_ICONS[identity.priority];
			return <Icon render={<PriorityIcon color={PRIORITY_COLORS[identity.priority]} label="" />} />;
		}
		case "epic":
			return <Icon render={<EpicIcon label="" />} />;
		case "labels":
			return <Icon render={<TagIcon label="" />} />;
		case "subtask":
			return <Icon render={<SubtasksIcon label="" />} />;
	}
}

interface SwimlaneHeaderInsets {
	inlineStart: string;
	paddingBlockStart: CSSProperties["paddingBlockStart"];
	insetBlockStart: CSSProperties["insetBlockStart"];
}

function BoardSwimlane({ lane, children, headerInsets, onCollapse }: Readonly<{
	lane: Swimlane;
	children: (lane: Swimlane) => ReactNode;
	headerInsets: SwimlaneHeaderInsets;
	onCollapse: () => void;
}>) {
	const id = useId();
	const [expanded, setExpanded] = useState(true);
	return (
		<div data-board-swimlane={lane.id} className="min-w-0">
			<div className="sticky z-20 bg-surface pb-2" style={{ insetBlockStart: headerInsets.insetBlockStart, paddingBlockStart: headerInsets.paddingBlockStart }}>
				<Button
					aria-controls={id}
					aria-expanded={expanded}
					aria-label={`${lane.label}, ${lane.count} ${lane.count === 1 ? "work item" : "work items"}`}
					className="group/swimlane sticky max-w-[min(28rem,75vw)]"
					onClick={() => {
						if (expanded) onCollapse();
						setExpanded(!expanded);
					}}
					style={{ insetInlineStart: headerInsets.inlineStart, marginInlineStart: headerInsets.inlineStart }}
					variant="disclosure"
				>
					<span aria-hidden="true" className="flex shrink-0 items-center">
						<SwimlaneVisual identity={lane.identity} label={lane.label} />
					</span>
					<span className="min-w-0 truncate text-text">{lane.label}</span>
					<span className="shrink-0 font-normal text-text-subtlest">{lane.count}</span>
					<Icon aria-hidden className={cn("shrink-0 text-icon-subtle", expanded && "rotate-90 opacity-0 group-hover/swimlane:opacity-100 group-focus-visible/swimlane:opacity-100")} render={<ChevronRightIcon label="" size="small" />} />
				</Button>
			</div>
			<div id={id} hidden={!expanded}>{expanded ? children(lane) : null}</div>
		</div>
	);
}

export function BoardSwimlanes({ lanes, fluid, headerInsets, children, onCollapse }: Readonly<{
	lanes?: readonly Swimlane[];
	fluid: boolean;
	headerInsets: SwimlaneHeaderInsets;
	children: (lane?: Swimlane) => ReactNode;
	onCollapse: (lane: Swimlane) => void;
}>) {
	if (!lanes) return children();
	return (
		<div className={cn("flex shrink-0 flex-col gap-4", fluid ? "w-full min-w-min" : "w-max min-w-full")} data-board-swimlanes="">
			{lanes.length ? lanes.map((lane) => (
				<BoardSwimlane key={lane.id} lane={lane} headerInsets={headerInsets} onCollapse={() => onCollapse(lane)}>
					{children}
				</BoardSwimlane>
			)) : <p className="px-6 text-sm text-text-subtle">No work items to group.</p>}
		</div>
	);
}
