"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import AddIcon from "@atlaskit/icon/core/add";
import MaximizeIcon from "@atlaskit/icon/core/maximize";
import RefreshIcon from "@atlaskit/icon/core/refresh";
import MinusIcon from "@atlaskit/icon/core/minus";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ThemeSelector } from "@/components/utils/theme-wrapper";
import { token } from "@/lib/tokens";

import { CanvasController } from "./canvas-controller";
import { CanvasItemFrame } from "./canvas-item-frame";
import { attachCanvasGestures, CANVAS_SURFACE_ATTR } from "./gestures";

export interface CanvasEntry {
	/** Stable id: keys saved positions. Never reuse a removed id for a different preview. */
	id: string;
	/** Unique readable name shown above the preview and copied on click. */
	name: string;
	width: number;
	height: number;
	x: number;
	y: number;
	render: () => ReactNode;
}

const subscribeNever = () => () => {};

function ControlButton({ label, shortcut, onClick, children }: Readonly<{ label: string; shortcut: string; onClick: () => void; children: ReactNode }>) {
	return (
		<Tooltip>
			<TooltipTrigger render={<Button aria-label={label} onClick={onClick} size="icon" type="button" variant="ghost" />}>{children}</TooltipTrigger>
			<TooltipContent>{label} · {shortcut}</TooltipContent>
		</Tooltip>
	);
}

function ZoomReadout({ controller }: Readonly<{ controller: CanvasController }>) {
	const zoom = useSyncExternalStore(controller.subscribe, controller.getZoom, () => 1);
	return <span aria-live="off" className="w-12 text-center text-xs tabular-nums text-text-subtle">{Math.round(zoom * 100)}%</span>;
}

function CanvasControls({ controller }: Readonly<{ controller: CanvasController }>) {
	return (
		<div className="pointer-events-auto flex items-center gap-1 rounded-lg bg-surface-overlay p-1" style={{ boxShadow: token("elevation.shadow.overlay") }} role="toolbar" aria-label="Canvas camera">
			<ControlButton label="Zoom out" onClick={() => controller.zoomStep(-1)} shortcut="−"><MinusIcon label="" /></ControlButton>
			<ZoomReadout controller={controller} />
			<ControlButton label="Zoom in" onClick={() => controller.zoomStep(1)} shortcut="+"><AddIcon label="" /></ControlButton>
			<span aria-hidden="true" className="mx-1 h-5 w-px bg-border" />
			<ControlButton label="Fit all" onClick={() => controller.fitAll()} shortcut="1"><MaximizeIcon label="" /></ControlButton>
			<ControlButton label="Reset camera" onClick={() => controller.resetCamera()} shortcut="0"><RefreshIcon label="" /></ControlButton>
		</div>
	);
}

/** Freeform workspace: pan, zoom and arrange live previews defined in a source registry. */
export function CanvasWorkspace({ entries, title }: Readonly<{ entries: readonly CanvasEntry[]; title: string }>) {
	const [controller] = useState(() => {
		const created = new CanvasController(entries.map((entry) => ({ id: entry.id, initial: { x: entry.x, y: entry.y } })));
		if (typeof window !== "undefined") created.hydrate();
		return created;
	});
	// Previews mount on the client only, after the saved layout is applied, so items never jump.
	const hydrated = useSyncExternalStore(subscribeNever, () => true, () => false);
	const viewportRef = useRef<HTMLDivElement>(null);
	const worldRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const viewport = viewportRef.current;
		const world = worldRef.current;
		if (!hydrated || !viewport || !world) return;
		const detach = controller.attach(viewport, world);
		const detachGestures = attachCanvasGestures(controller, viewport);
		const requested = new URLSearchParams(window.location.search).get("item");
		// Wait for previews to lay out (fonts, images) before measuring bounds.
		const settle = window.setTimeout(() => {
			if (requested && entries.some((entry) => entry.id === requested)) controller.revealItem(requested);
			else if (!controller.hasSavedCamera) controller.fitAll();
		}, 120);
		const onPageHide = () => controller.flushSave();
		window.addEventListener("pagehide", onPageHide);
		return () => {
			window.clearTimeout(settle);
			window.removeEventListener("pagehide", onPageHide);
			detachGestures();
			detach();
		};
	}, [controller, entries, hydrated]);

	return (
		<div className="fixed inset-0 overflow-hidden bg-bg-neutral-subtle text-text">
			<div
				aria-label={`${title}. Arrow keys pan, plus and minus zoom, 1 fits all, 0 resets. Hold Space and drag to pan anywhere.`}
				className="absolute inset-0 cursor-default overflow-hidden overscroll-none outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring data-[canvas-panning]:select-none"
				{...{ [CANVAS_SURFACE_ATTR]: "" }}
				ref={viewportRef}
				role="application"
				tabIndex={0}
			>
				<div className="absolute top-0 left-0 origin-top-left" ref={worldRef} style={{ transform: "translate3d(48px, 48px, 0)" }}>
					{hydrated ? entries.map((entry) => (
						<CanvasItemFrame controller={controller} height={entry.height} id={entry.id} key={entry.id} name={entry.name} width={entry.width}>
							{entry.render()}
						</CanvasItemFrame>
					)) : null}
				</div>
			</div>
			<div className="pointer-events-none absolute inset-x-4 top-4 flex items-start justify-between gap-4">
				<h1 className="pointer-events-auto rounded-md bg-surface-overlay px-3 py-1.5 text-sm font-medium text-text" style={{ boxShadow: token("elevation.shadow.overlay") }}>{title}</h1>
				<div className="pointer-events-auto w-36"><ThemeSelector /></div>
			</div>
			<div className="pointer-events-none absolute right-4 bottom-4 flex justify-end">
				<CanvasControls controller={controller} />
			</div>
		</div>
	);
}
