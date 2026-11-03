"use client";

import { useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import CheckMarkIcon from "@atlaskit/icon/core/check-mark";
import DragHandleVerticalIcon from "@atlaskit/icon/core/drag-handle-vertical";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import type { CanvasController } from "./canvas-controller";

const KEY_MOVE_STEP = 8;

type CopyState = "idle" | "copied" | "failed";

function useCopyName(name: string) {
	const [state, setState] = useState<CopyState>("idle");
	const timer = useRef(0);
	const copy = async () => {
		window.clearTimeout(timer.current);
		try {
			if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
			await navigator.clipboard.writeText(name);
			setState("copied");
			timer.current = window.setTimeout(() => setState("idle"), 1600);
		} catch {
			setState("failed");
		}
	};
	return { state, copy, clearFailure: () => setState("idle") };
}

function CanvasItemLabel({ name }: Readonly<{ name: string }>) {
	const { state, copy, clearFailure } = useCopyName(name);
	if (state === "failed") {
		return (
			<span className="flex items-center gap-2 text-sm text-text-subtle">
				<input
					aria-label={`${name} (copy unavailable — select to copy)`}
					autoFocus
					className="min-w-0 rounded-sm bg-transparent px-1 text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-ring"
					onBlur={clearFailure}
					onFocus={(event) => event.currentTarget.select()}
					readOnly
					size={name.length}
					value={name}
				/>
				<span className="text-xs text-text-subtlest">Press ⌘C to copy</span>
			</span>
		);
	}
	return (
		<Tooltip>
			<TooltipTrigger
				render={<button type="button" />}
				className="flex min-w-0 items-center gap-1.5 rounded-sm px-1 text-left text-sm font-medium text-text-subtle outline-none hover:text-text focus-visible:ring-2 focus-visible:ring-ring"
				onClick={() => void copy()}
			>
				<span>{name}</span>
				{state === "copied" ? (
					<span className="flex items-center gap-0.5 text-xs font-normal text-text-success">
						<CheckMarkIcon label="" size="small" />
						Copied
					</span>
				) : null}
			</TooltipTrigger>
			<TooltipContent>Copy name</TooltipContent>
			<span aria-live="polite" className="sr-only">{state === "copied" ? `Copied ${name}` : ""}</span>
		</Tooltip>
	);
}

function MoveHandle({ controller, id, name }: Readonly<{ controller: CanvasController; id: string; name: string }>) {
	const instructionsId = useId();
	const drag = useRef<{ pointerId: number; startX: number; startY: number; origin: { x: number; y: number } } | null>(null);

	const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
		if (event.button !== 0) return;
		event.currentTarget.setPointerCapture(event.pointerId);
		drag.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, origin: controller.positionOf(id) };
	};
	const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
		const current = drag.current;
		if (!current || current.pointerId !== event.pointerId) return;
		const zoom = controller.camera.zoom;
		controller.moveItem(id, { x: current.origin.x + (event.clientX - current.startX) / zoom, y: current.origin.y + (event.clientY - current.startY) / zoom });
	};
	const onPointerEnd = (event: PointerEvent<HTMLButtonElement>) => {
		if (drag.current?.pointerId !== event.pointerId) return;
		drag.current = null;
		controller.commitItemMove();
	};
	const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
		const step = event.shiftKey ? KEY_MOVE_STEP * 5 : KEY_MOVE_STEP;
		const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
		if (!delta) return;
		event.preventDefault();
		const position = controller.positionOf(id);
		controller.moveItem(id, { x: position.x + delta[0], y: position.y + delta[1] });
		controller.commitItemMove();
	};

	return (
		<>
			<button
				aria-describedby={instructionsId}
				aria-label={`Move ${name}`}
				className="flex size-6 shrink-0 cursor-default touch-none items-center justify-center rounded-sm text-icon-subtlest outline-none hover:bg-bg-neutral-subtle-hovered hover:text-icon-subtle focus-visible:ring-2 focus-visible:ring-ring"
				onKeyDown={onKeyDown}
				onLostPointerCapture={onPointerEnd}
				onPointerCancel={onPointerEnd}
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={onPointerEnd}
				type="button"
			>
				<DragHandleVerticalIcon label="" size="small" />
			</button>
			<span className="sr-only" id={instructionsId}>Drag, or use arrow keys to move. Hold Shift for larger steps.</span>
		</>
	);
}

export interface CanvasItemFrameProps {
	controller: CanvasController;
	id: string;
	name: string;
	width: number;
	height: number;
	children: ReactNode;
}

/** One placed preview: name and handle above, the preview at its intended size below. */
export function CanvasItemFrame({ controller, id, name, width, height, children }: Readonly<CanvasItemFrameProps>) {
	const position = controller.positionOf(id);
	return (
		<section
			aria-label={name}
			className="absolute top-0 left-0 flex flex-col gap-2"
			data-canvas-item-id={id}
			ref={(element) => controller.registerItem(id, element)}
			style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
		>
			<div className="flex items-center gap-1">
				<MoveHandle controller={controller} id={id} name={name} />
				<CanvasItemLabel name={name} />
			</div>
			<div className="relative overflow-hidden rounded-xl bg-surface outline outline-1 outline-border" style={{ width, height }}>
				{children}
			</div>
		</section>
	);
}
