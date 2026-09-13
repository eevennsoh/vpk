"use client";

import { useEffect, useLayoutEffect, useRef, type KeyboardEvent, type PointerEvent, type RefObject } from "react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
	isSessionColumnRepositionPointerTarget,
	resolveSessionColumnRepositionCaptureElement,
	resolveSessionColumnPreviewIndex,
} from "../lib/session-column-reposition-pointer";
import { useSessionColumnPlacement } from "./session-column-placement";

const SESSION_COLUMN_GAP_PROXIMITY_RANGE_PX = 120;
/** Collapsed options trigger fills its header slot (wider than icon-compact 24). */
const SESSION_COLUMN_DRAG_CHIP_FALLBACK_WIDTH_PX = 56;
const SESSION_COLUMN_DRAG_CHIP_FALLBACK_HEIGHT_PX = 24;

interface ColumnDrag {
	pointerId: number;
	startX: number;
	startY: number;
	x: number;
	startLeft: number;
	startWidth: number;
	active: boolean;
	preview: number;
	highlightedIndex: number | null;
	frame: number;
	element: HTMLDivElement;
	source: HTMLDivElement | null;
	chip: HTMLButtonElement | null;
	captureElement: HTMLElement;
	centers: number[];
	scrollLeft: number;
	sourceScrollsWithBoard: boolean;
	scrollport: HTMLElement;
}

const SESSION_COLUMN_DRAG_CHIP_CLASS_NAME = cn(
	buttonVariants({ variant: "outline", size: "icon-compact" }),
	"pointer-events-none fixed z-50 cursor-grabbing border-border bg-surface text-icon-subtle",
	"[&_svg]:size-3 [&_svg]:text-icon-subtle",
);

const SESSION_COLUMN_DRAG_CHIP_GLYPH = `<svg aria-hidden="true" viewBox="0 0 16 16" class="size-3 text-icon-subtle" fill="currentColor"><circle cx="5" cy="3.25" r="1.25"/><circle cx="11" cy="3.25" r="1.25"/><circle cx="5" cy="8" r="1.25"/><circle cx="11" cy="8" r="1.25"/><circle cx="5" cy="12.75" r="1.25"/><circle cx="11" cy="12.75" r="1.25"/></svg>`;

function resolveSessionColumnDragChipSize(host: HTMLElement): { width: number; height: number } {
	const source = host.querySelector<HTMLElement>("[data-agent-session-column-options]");
	const box = source?.getBoundingClientRect();
	if (box && box.width > 0 && box.height > 0) {
		return { width: box.width, height: box.height };
	}
	return {
		width: SESSION_COLUMN_DRAG_CHIP_FALLBACK_WIDTH_PX,
		height: SESSION_COLUMN_DRAG_CHIP_FALLBACK_HEIGHT_PX,
	};
}

function createSessionColumnDragChip(
	host: HTMLElement,
	clientX: number,
	clientY: number,
): HTMLButtonElement {
	const chip = document.createElement("button");
	const size = resolveSessionColumnDragChipSize(host);
	chip.type = "button";
	chip.setAttribute("aria-hidden", "true");
	chip.setAttribute("data-session-column-drag-chip", "");
	chip.setAttribute("data-slot", "button");
	chip.setAttribute("inert", "");
	chip.className = SESSION_COLUMN_DRAG_CHIP_CLASS_NAME;
	chip.innerHTML = SESSION_COLUMN_DRAG_CHIP_GLYPH;
	chip.style.boxSizing = "border-box";
	chip.style.width = `${size.width}px`;
	chip.style.height = `${size.height}px`;
	chip.style.minWidth = `${size.width}px`;
	chip.style.minHeight = `${size.height}px`;
	positionSessionColumnDragChip(chip, clientX, clientY);
	return chip;
}

function positionSessionColumnDragChip(chip: HTMLButtonElement, clientX: number, clientY: number) {
	chip.style.left = `${clientX}px`;
	chip.style.top = `${clientY}px`;
	chip.style.transform = "translate(-50%, -50%)";
}

function copyDescendantScrollOffsets(source: HTMLElement, clone: HTMLElement) {
	const sourceDescendants = [...source.querySelectorAll<HTMLElement>("*")];
	const cloneDescendants = [...clone.querySelectorAll<HTMLElement>("*")];
	for (const [index, sourceDescendant] of sourceDescendants.entries()) {
		const cloneDescendant = cloneDescendants[index];
		if (!cloneDescendant) break;
		if (sourceDescendant.scrollTop !== 0) cloneDescendant.scrollTop = sourceDescendant.scrollTop;
		if (sourceDescendant.scrollLeft !== 0) cloneDescendant.scrollLeft = sourceDescendant.scrollLeft;
	}
}

function restyleSessionColumnDragSourceClone(source: HTMLDivElement) {
	for (const node of source.querySelectorAll("[aria-expanded], [aria-pressed], [aria-selected], [data-popup-open], [data-state]")) {
		node.removeAttribute("aria-expanded");
		node.removeAttribute("aria-pressed");
		node.removeAttribute("aria-selected");
		node.removeAttribute("data-popup-open");
		node.removeAttribute("data-state");
	}

	const isCollapsedRail = Boolean(source.querySelector("[data-agent-session-column-rail]"));
	if (!isCollapsedRail) {
		return false;
	}

	for (const node of source.querySelectorAll("[data-agent-session-column-options]")) {
		node.remove();
	}
	for (const node of source.querySelectorAll<HTMLElement>("[data-agent-session-column-count]")) {
		node.classList.remove("opacity-0");
		node.classList.add("opacity-100");
		node.style.opacity = "1";
	}
	for (const node of source.querySelectorAll<HTMLElement>(".group\\/in-flow-agent-session-column")) {
		node.classList.remove("bg-surface");
		node.classList.add("bg-transparent");
	}
	source.setAttribute("data-session-column-drag-source-rest", "");
	return true;
}

function cloneSessionColumnDragSource(
	element: HTMLDivElement,
	startLeft: number,
	startWidth: number,
): HTMLDivElement {
	const source = element.cloneNode(true) as HTMLDivElement;
	source.removeAttribute("data-agent-session-column-expansion");
	source.removeAttribute("data-session-column-dragging");
	source.setAttribute("aria-hidden", "true");
	source.setAttribute("data-session-column-drag-source", "");
	source.setAttribute("inert", "");
	restyleSessionColumnDragSourceClone(source);
	source.style.cssText += [
		"position: absolute",
		"inset: 0 auto 0 0",
		`width: ${startWidth}px`,
		`transform: translateX(${startLeft}px)`,
		"pointer-events: none",
		"opacity: var(--opacity-disabled)",
		"z-index: 30",
	].join(";");

	for (const node of source.querySelectorAll<HTMLElement>(
		"[id], [data-testid], [data-agent-session-column], [data-board-agent-session-drop-zone], [data-board-agent-session-target]",
	)) {
		if (node.hasAttribute("data-agent-session-column")) {
			node.setAttribute("data-session-column-drag-source-surface", "");
		}
		node.removeAttribute("id");
		node.removeAttribute("data-testid");
		node.removeAttribute("data-agent-session-column");
		node.removeAttribute("data-board-agent-session-drop-zone");
		node.removeAttribute("data-board-agent-session-target");
	}

	return source;
}

function revealSlot(rootRef: RefObject<HTMLDivElement | null>) {
	requestAnimationFrame(() => {
		rootRef.current?.querySelector<HTMLElement>("[data-session-column-slot]")?.scrollIntoView({ block: "nearest", inline: "nearest" });
	});
}

/** Parks an inert source snapshot and moves only the outlined drag chip. */
export function useSessionColumnReposition({ hostRef, width, onStart, disabled }: Readonly<{
	hostRef: RefObject<HTMLDivElement | null>;
	width: number;
	onStart: () => void;
	disabled: boolean;
}>) {
	const placement = useSessionColumnPlacement();
	const drag = useRef<ColumnDrag | null>(null);
	const suppressClick = useRef(false);
	const shifted = placement !== null && placement.index > 0;
	const setWidth = placement?.setWidth;
	const setPreview = placement?.setPreview;
	const setHighlightedIndex = placement?.setHighlightedIndex;

	useLayoutEffect(() => {
		setWidth?.(width);
	}, [setWidth, width]);

	useLayoutEffect(() => {
		const root = placement?.rootRef.current;
		const host = hostRef.current;
		if (!host) return;
		if (!root) {
			host.style.transform = "";
			host.style.clipPath = "";
			return;
		}
		const sync = () => {
			if (drag.current?.active) return;
			const slot = root.querySelector<HTMLElement>("[data-session-column-slot]");
			if (!shifted || !slot) {
				host.style.transform = "";
				host.style.clipPath = "";
				return;
			}
			const rootBox = root.getBoundingClientRect();
			const slotBox = slot.getBoundingClientRect();
			// Surface translates 24px and owns a 2px leading border; status content
			// begins 6px inside its slot. Keep their painted leading edges aligned.
			const left = slotBox.left - rootBox.left - 20;
			host.style.transform = `translateX(${left}px)`;
			const scrollport = root.querySelector<HTMLElement>("[data-jira-kanban-scrollport]");
			if (scrollport) {
				const box = scrollport.getBoundingClientRect();
				const hostLeft = rootBox.left + left;
				host.style.clipPath = `inset(-8px ${Math.max(0, hostLeft + width + 42 - box.right)}px -8px ${Math.max(0, box.left - hostLeft)}px)`;
			}
		};
		sync();
		// ResizeObserver sees size changes, not a slot moving when its sibling
		// columns collapse. Follow only those bounded width transitions; the
		// mutation path also supplies one final frame when motion is disabled.
		let positionFrame = 0;
		const activeColumnTransitions = new Set<EventTarget>();
		const trackColumnPosition = () => {
			sync();
			if (activeColumnTransitions.size === 0) {
				positionFrame = 0;
				return;
			}
			positionFrame = requestAnimationFrame(trackColumnPosition);
		};
		const schedulePositionSync = () => {
			if (positionFrame === 0) {
				positionFrame = requestAnimationFrame(trackColumnPosition);
			}
		};
		const isColumnWidthTransition = (
			event: TransitionEvent,
		): event is TransitionEvent & { target: HTMLElement } => (
			event.propertyName === "max-width"
			&& event.target instanceof HTMLElement
			&& event.target.hasAttribute("data-jira-kanban-column")
		);
		const handleColumnTransitionRun = (event: TransitionEvent) => {
			if (!isColumnWidthTransition(event)) return;
			activeColumnTransitions.add(event.target);
			schedulePositionSync();
		};
		const handleColumnTransitionEnd = (event: TransitionEvent) => {
			if (!isColumnWidthTransition(event)) return;
			activeColumnTransitions.delete(event.target);
			sync();
		};
		const positionObserver = new MutationObserver(schedulePositionSync);
		positionObserver.observe(root, {
			attributeFilter: ["data-collapsed"],
			attributes: true,
			subtree: true,
		});
		const observer = new ResizeObserver(sync);
		observer.observe(root);
		const slot = root.querySelector("[data-session-column-slot]");
		if (slot) observer.observe(slot);
		root.addEventListener("scroll", sync, true);
		root.addEventListener("transitionrun", handleColumnTransitionRun);
		root.addEventListener("transitionend", handleColumnTransitionEnd);
		root.addEventListener("transitioncancel", handleColumnTransitionEnd);
		return () => {
			if (positionFrame !== 0) cancelAnimationFrame(positionFrame);
			positionObserver.disconnect();
			observer.disconnect();
			root.removeEventListener("scroll", sync, true);
			root.removeEventListener("transitionrun", handleColumnTransitionRun);
			root.removeEventListener("transitionend", handleColumnTransitionEnd);
			root.removeEventListener("transitioncancel", handleColumnTransitionEnd);
		};
	}, [hostRef, placement?.index, placement?.preview, placement?.rootRef, shifted, width]);

	useEffect(() => () => {
		if (drag.current) {
			cancelAnimationFrame(drag.current.frame);
			drag.current.source?.remove();
			drag.current.chip?.remove();
			drag.current.element.style.visibility = "";
			drag.current = null;
			setPreview?.(null);
			setHighlightedIndex?.(null);
		}
	}, [setPreview, setHighlightedIndex]);

	const finish = (commit: boolean) => {
		const current = drag.current;
		if (!current || !placement) return;
		cancelAnimationFrame(current.frame);
		drag.current = null;
		current.source?.remove();
		current.chip?.remove();
		current.element.style.visibility = "";
		if (current.captureElement.hasPointerCapture(current.pointerId)) current.captureElement.releasePointerCapture(current.pointerId);
		if (current.active) {
			suppressClick.current = true;
			current.element.style.transform = `translateX(${current.startLeft}px)`;
			placement.move(commit ? current.preview : placement.index);
			if (commit && current.preview > 0) revealSlot(placement.rootRef);
		}
	};

	const onPointerDownCapture = (event: PointerEvent<HTMLDivElement>) => {
		// Suppress only the click ending the drag, never a new press (including
		// portalled menu items whose React events still pass through this host).
		suppressClick.current = false;
		if (!placement || disabled || event.button !== 0 || !event.isPrimary) return;
		const target = event.target as HTMLElement;
		if (!isSessionColumnRepositionPointerTarget(target)) return;
		const root = placement.rootRef.current;
		const scrollport = root?.querySelector<HTMLElement>("[data-jira-kanban-scrollport]");
		if (!root || !scrollport) return;
		const element = event.currentTarget;
		const captureElement = resolveSessionColumnRepositionCaptureElement(target, element);
		if (!captureElement) return;
		const elementBox = element.getBoundingClientRect();
		const rootBox = root.getBoundingClientRect();
		// Keep short presses targeted at their original header control. The
		// pointer events still bubble to the host once the drag threshold wins.
		captureElement.setPointerCapture(event.pointerId);
		drag.current = {
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			x: event.clientX,
			startLeft: elementBox.left - rootBox.left,
			startWidth: elementBox.width,
			active: false,
			preview: placement.index,
			highlightedIndex: null,
			frame: 0,
			element,
			source: null,
			chip: null,
			captureElement,
			centers: [...scrollport.querySelectorAll<HTMLElement>("[data-jira-kanban-column]")].map((column) => {
				const box = column.getBoundingClientRect();
				return box.left + box.width / 2;
			}),
			scrollLeft: scrollport.scrollLeft,
			sourceScrollsWithBoard: placement.index > 0,
			scrollport,
		};
	};

	const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
		const current = drag.current;
		if (!current || !placement || current.pointerId !== event.pointerId) return;
		current.x = event.clientX;
		if (!current.active && Math.abs(current.x - current.startX) < 6) return;
		event.preventDefault();
		if (current.active) return;
		current.active = true;
		current.source = cloneSessionColumnDragSource(
			current.element,
			current.startLeft,
			current.startWidth,
		);
		placement.rootRef.current?.append(current.source);
		copyDescendantScrollOffsets(current.element, current.source);
		current.chip = createSessionColumnDragChip(current.element, current.x, current.startY);
		document.body.append(current.chip);
		current.element.style.visibility = "hidden";
		const firstColumn = current.scrollport.querySelector<HTMLElement>("[data-jira-kanban-column]");
		const firstCard = firstColumn?.querySelector<HTMLElement>("article");
		if (firstColumn && firstCard) {
			placement.rootRef.current?.style.setProperty(
				"--session-column-marker-top",
				`${Math.max(0, firstCard.getBoundingClientRect().top - firstColumn.getBoundingClientRect().top)}px`,
			);
		}
		placement.setPreview(current.preview);
		placement.setHighlightedIndex(null);
		onStart();
		const track = () => {
			if (drag.current !== current) return;
			if (current.chip) positionSessionColumnDragChip(current.chip, current.x, current.startY);
			const box = current.scrollport.getBoundingClientRect();
			const scroll = current.x > box.right - 40 ? 12 : current.x < box.left + 40 ? -12 : 0;
			if (scroll) current.scrollport.scrollLeft += scroll;
			const offset = current.scrollport.scrollLeft - current.scrollLeft;
			if (current.sourceScrollsWithBoard && current.source) {
				current.source.style.transform = `translateX(${current.startLeft - offset}px)`;
			}
			const next = resolveSessionColumnPreviewIndex({
				centers: current.centers,
				pointerX: current.x,
				scrollOffset: offset,
			});
			if (next !== current.preview) {
				current.preview = next;
				placement.setPreview(next);
			}
			const marker = placement.rootRef.current?.querySelector<HTMLElement>(`[data-session-column-drop-marker="${next}"]`);
			const highlightedIndex = marker
				&& Math.abs(current.x - marker.getBoundingClientRect().left) <= SESSION_COLUMN_GAP_PROXIMITY_RANGE_PX
				? next
				: null;
			if (highlightedIndex !== current.highlightedIndex) {
				current.highlightedIndex = highlightedIndex;
				placement.setHighlightedIndex(highlightedIndex);
			}
			current.frame = requestAnimationFrame(track);
		};
		track();
	};

	const onKeyDownCapture = (event: KeyboardEvent<HTMLDivElement>) => {
		suppressClick.current = false;
		if (event.key === "Escape" && drag.current) {
			event.preventDefault();
			event.stopPropagation();
			finish(false);
			return;
		}
		if (!placement || disabled || !(event.target as HTMLElement).closest("[data-agent-session-column-header]")) return;
		const isMoveHandle = (event.target as HTMLElement).closest("[data-session-column-move-handle]");
		if (!isMoveHandle && !event.altKey) return;
		const next = event.key === "ArrowLeft" ? placement.index - 1
			: event.key === "ArrowRight" ? placement.index + 1
				: event.key === "Home" ? 0 : event.key === "End" ? placement.titles.length : null;
		if (next === null) return;
		event.preventDefault();
		event.stopPropagation();
		onStart();
		placement.move(next);
		if (next > 0) revealSlot(placement.rootRef);
	};

	return {
		available: placement !== null,
		enabled: placement !== null && !disabled,
		shifted,
		dragging: placement?.preview !== null && placement?.preview !== undefined,
		moveToLeadingGutter: () => {
			placement?.move(0);
		},
		bindings: {
			onPointerDownCapture,
			onPointerMove,
			onPointerUp: () => finish(true),
			onPointerCancel: () => finish(false),
			onLostPointerCapture: () => finish(false),
			onKeyDownCapture,
			onClickCapture: (event: React.MouseEvent<HTMLDivElement>) => {
				if (!suppressClick.current) return;
				suppressClick.current = false;
				event.preventDefault();
				event.stopPropagation();
			},
		},
	};
}
