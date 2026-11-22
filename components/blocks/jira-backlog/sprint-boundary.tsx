import { useRef, useState, type RefObject } from "react";
import DragHandleHorizontalIcon from "@atlaskit/icon/core/drag-handle-horizontal";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useSprintBoundaryDrag } from "./use-sprint-boundary-drag";
import type { JiraBacklogItem, JiraBacklogProps, JiraBacklogSection } from "./types";

function BoundaryRule() {
	return <span aria-hidden className="h-px flex-1 bg-border" />;
}

export function SprintBoundary({
	rootRef,
	sprint,
	backlog,
	disabledReason,
	onMove,
}: Readonly<{
	rootRef: RefObject<HTMLDivElement | null>;
	sprint: JiraBacklogSection;
	backlog: readonly JiraBacklogItem[];
	disabledReason?: string;
	onMove: NonNullable<JiraBacklogProps["sprintBoundary"]>["onMove"];
}>) {
	const [open, setOpen] = useState(false);
	const [announcement, setAnnouncement] = useState("");
	const lineRef = useRef<HTMLDivElement>(null);
	const labelRef = useRef<HTMLSpanElement>(null);

	function commit(delta: number) {
		const intoSprint = delta > 0;
		const items = intoSprint ? backlog.slice(0, delta) : sprint.items.slice(delta);
		const destination = intoSprint ? "sprint" : "backlog";
		if (items.length === 0) return;
		onMove({ sprintId: sprint.id, itemIds: items.map(({ id }) => id), destination });
		setAnnouncement(`Moved ${items.length} work ${items.length === 1 ? "item" : "items"} ${intoSprint ? `into ${sprint.title}` : "to the backlog"}.`);
	}

	const dragHandlers = useSprintBoundaryDrag({
		rootRef,
		lineRef,
		labelRef,
		sprintItems: sprint.items,
		backlogItems: backlog,
		disabled: Boolean(disabledReason || open),
		onMove: commit,
	});

	if (disabledReason) {
		return (
			<div className="flex min-h-10 items-center gap-2 text-xs text-text-subtle">
				<BoundaryRule />{disabledReason}<BoundaryRule />
			</div>
		);
	}

	return (
		<>
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger
					render={<Button
						{...dragHandlers}
						aria-label="Move work items between sprint and backlog"
						className="-my-3 h-11 w-full cursor-ns-resize touch-none gap-2 px-0 hover:bg-transparent"
						selectedAppearance="icon-only"
						variant="ghost"
					/>}
				>
					<BoundaryRule />
					<Icon render={<DragHandleHorizontalIcon label="" />} />
					<BoundaryRule />
				</PopoverTrigger>
				<PopoverContent aria-label="Move work items" className="w-max max-w-(--available-width) gap-1 p-2">
					<Button
						className="justify-start"
						disabled={backlog.length === 0}
						onClick={() => { commit(1); setOpen(false); }}
						variant="ghost"
					>
						Move first backlog item into sprint
					</Button>
					<Button
						className="justify-start"
						disabled={sprint.items.length === 0}
						onClick={() => { commit(-1); setOpen(false); }}
						variant="ghost"
					>
						Move last sprint item to backlog
					</Button>
				</PopoverContent>
			</Popover>
			<div
				aria-hidden
				className="pointer-events-none absolute inset-x-0 top-0 z-20"
				data-testid="sprint-boundary-preview"
				hidden
				ref={lineRef}
			>
				<div className="h-0.5 bg-border-selected" />
				<span className="absolute top-0 left-2 -translate-y-1/2 rounded-sm bg-bg-neutral-bold px-2 py-1 text-xs text-text-inverse shadow-sm" ref={labelRef} />
			</div>
			<span className="sr-only" role="status">{announcement}</span>
		</>
	);
}
