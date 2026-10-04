"use client";

import {
	useEffect,
	useRef,
	useState,
	type PointerEvent as ReactPointerEvent,
	type ReactElement,
} from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "motion/react";

import { AgentSessionDragPill } from "@/components/blocks/agent-session/agent-session-drag-chip";
import { sessionDragChipViewportStyle } from "@/components/blocks/jira-issue/agent-session-drag";
import { useSessionDragChipPointer } from "@/components/blocks/jira-issue/use-session-drag-chip-pointer";
import {
	usePointerDrag,
	type PointerDragPosition,
} from "@/components/ui-custom/hooks/use-pointer-drag";
import { cn } from "@/lib/utils";

import type { JiraDropzoneMember, ViewportPoint } from "./lib/jira-dropzone-types";

const DRAG_ORIGIN: PointerDragPosition = { x: 0, y: 0 };
const PUBLISH_THRESHOLD_PX = 2;

export function JiraDropzoneDemoChip({
	members,
	onDragCancel,
	onDragEnd,
	onDragMove,
	onDragStart,
}: Readonly<{
	members: readonly [JiraDropzoneMember, ...JiraDropzoneMember[]];
	onDragCancel: () => void;
	onDragEnd: (pointer: ViewportPoint) => void;
	onDragMove: (pointer: ViewportPoint) => void;
	onDragStart: (members: readonly [JiraDropzoneMember, ...JiraDropzoneMember[]]) => void;
}>): ReactElement {
	const shouldReduceMotion = useReducedMotion();
	const [offset, setOffset] = useState<PointerDragPosition>(DRAG_ORIGIN);
	const [published, setPublished] = useState(false);
	const drag = usePointerDrag(offset, setOffset);
	const chipPointer = useSessionDragChipPointer(shouldReduceMotion);
	const originRef = useRef<ViewportPoint | null>(null);
	const publishedRef = useRef(false);
	const hostRef = useRef<HTMLButtonElement>(null);
	const label = `${members.length} ${members.length === 1 ? "agent" : "agents"}`;
	const agent = { name: label };

	function toHostEvent(
		event: ReactPointerEvent<HTMLElement> | PointerEvent,
	): ReactPointerEvent<HTMLElement> {
		return {
			currentTarget: hostRef.current ?? (event.target as HTMLElement),
			pointerId: event.pointerId,
			clientX: event.clientX,
			clientY: event.clientY,
		} as ReactPointerEvent<HTMLElement>;
	}

	function finish(
		event: ReactPointerEvent<HTMLElement> | PointerEvent,
		cancelled: boolean,
	) {
		if (originRef.current === null) {
			return;
		}
		const hostEvent = toHostEvent(event);
		if (cancelled) {
			drag.bind.onPointerCancel(hostEvent);
		} else {
			drag.bind.onPointerUp(hostEvent);
		}
		originRef.current = null;
		const wasPublished = publishedRef.current;
		publishedRef.current = false;
		setPublished(false);
		setOffset(DRAG_ORIGIN);
		if (!wasPublished) {
			return;
		}
		if (cancelled) {
			onDragCancel();
			return;
		}
		onDragEnd({ x: event.clientX, y: event.clientY });
	}

	const finishRef = useRef(finish);

	useEffect(() => {
		finishRef.current = finish;
	});

	useEffect(() => {
		if (!published) {
			return undefined;
		}

		function onPointerUp(event: PointerEvent) {
			finishRef.current(event, false);
		}

		function onPointerCancel(event: PointerEvent) {
			finishRef.current(event, true);
		}

		window.addEventListener("pointerup", onPointerUp);
		window.addEventListener("pointercancel", onPointerCancel);
		return () => {
			window.removeEventListener("pointerup", onPointerUp);
			window.removeEventListener("pointercancel", onPointerCancel);
		};
	}, [published]);

	const { onKeyDown: _ignoredKeyDown, ...dragBind } = drag.bind;
	void _ignoredKeyDown;

	return (
		<div className="relative">
			<button
				{...dragBind}
				aria-label={`Drag ${label}`}
				className={cn(
					"cursor-grab touch-none select-none rounded-md",
					published ? "pointer-events-none opacity-0" : null,
					drag.dragging ? "cursor-grabbing" : null,
				)}
				data-jira-dropzone-demo-chip={members.length === 1 ? members[0].id : "cohort"}
				draggable={false}
				ref={hostRef}
				onPointerCancel={(event) => {
					finish(event, true);
				}}
				onPointerDown={(event) => {
					publishedRef.current = false;
					originRef.current = { x: event.clientX, y: event.clientY };
					drag.bind.onPointerDown(event);
					chipPointer.snapToPointer({ x: event.clientX, y: event.clientY });
				}}
				onPointerMove={(event) => {
					drag.bind.onPointerMove(event);
					chipPointer.followPointer({ x: event.clientX, y: event.clientY });
					const origin = originRef.current;
					if (!origin) {
						return;
					}
					const moved = Math.abs(event.clientX - origin.x) > PUBLISH_THRESHOLD_PX
						|| Math.abs(event.clientY - origin.y) > PUBLISH_THRESHOLD_PX;
					if (moved && !publishedRef.current) {
						publishedRef.current = true;
						setPublished(true);
						onDragStart(members);
					}
					if (publishedRef.current) {
						onDragMove({ x: event.clientX, y: event.clientY });
					}
				}}
				onPointerUp={(event) => {
					finish(event, false);
				}}
				type="button"
			>
				<AgentSessionDragPill agent={agent} />
			</button>
			{typeof document === "undefined" || !published
				? null
				: createPortal(
					<motion.div
						aria-hidden
						className="pointer-events-none left-0 top-0 z-[400] w-fit"
						data-jira-dropzone-demo-drag-overlay=""
						style={{
							x: chipPointer.x,
							y: chipPointer.y,
							...sessionDragChipViewportStyle(true),
						}}
					>
						<div className="pointer-events-none flex w-fit max-w-full -translate-x-1/2 -translate-y-1/2 items-center justify-start">
							<AgentSessionDragPill agent={agent} elevated />
						</div>
					</motion.div>,
					document.body,
				)}
		</div>
	);
}
