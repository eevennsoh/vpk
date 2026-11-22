import { useRef, useState, type RefObject } from "react";
import GrowVerticalIcon from "@atlaskit/icon/core/grow-vertical";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TOOLTIP_CONTENT_CLASS_NAME } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useSprintBoundaryDrag } from "./use-sprint-boundary-drag";
import type { JiraBacklogItem, JiraBacklogProps, JiraBacklogSection } from "./types";

function BoundaryRule({ dragging = false }: Readonly<{ dragging?: boolean }>) {
	return <span aria-hidden data-slot="sprint-boundary-rule" className={dragging ? "h-px flex-1 bg-icon-subtlest" : "h-px flex-1 bg-border [mask-image:repeating-linear-gradient(to_right,#000_0_3px,transparent_3px_9px)]"} />;
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
						className="-my-3 h-11 w-full cursor-ns-resize touch-none gap-2 px-0 hover:bg-transparent active:bg-transparent in-data-[dragging-sprint-boundary]:opacity-0 [&:hover_[data-slot=sprint-boundary-rule]]:[mask-image:none] [&:not([aria-expanded=true])_svg]:text-icon-disabled! [&:hover:not([aria-expanded=true])_svg]:text-icon-subtlest! [&:focus-visible:not([aria-expanded=true])_svg]:text-icon-subtlest!"
						selectedAppearance="icon-only"
						variant="ghost"
					/>}
				>
					<BoundaryRule />
					<Icon render={<GrowVerticalIcon label="" />} />
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
				<div className="flex -translate-y-1/2 items-center gap-2 text-icon-subtlest">
					<BoundaryRule dragging />
					<Icon render={<GrowVerticalIcon label="" />} />
					<BoundaryRule dragging />
				</div>
				<span className={cn(TOOLTIP_CONTENT_CLASS_NAME, "absolute top-0 left-2 -translate-y-1/2")} ref={labelRef} />
			</div>
			<span className="sr-only" role="status">{announcement}</span>
		</>
	);
}
