import type { CanvasController } from "./canvas-controller.ts";

const PAN_KEY_STEP = 48;
const DRAG_SLOP = 3;
const EDITABLE_SELECTOR = "input, textarea, select, [contenteditable=''], [contenteditable='true']";
const INTERACTIVE_SELECTOR = `${EDITABLE_SELECTOR}, button, a[href], [role='button'], [role='menuitem'], [role='option'], [role='slider'], [role='tab']`;

/** Elements marked with this attribute are empty canvas space: primary drag there pans. */
export const CANVAS_SURFACE_ATTR = "data-canvas-surface";

function canScroll(element: HTMLElement, dx: number, dy: number): boolean {
	const style = getComputedStyle(element);
	if (dy !== 0 && /(auto|scroll|overlay)/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 1) {
		if (dy < 0 ? element.scrollTop > 0 : element.scrollTop + element.clientHeight < element.scrollHeight - 1) return true;
	}
	if (dx !== 0 && /(auto|scroll|overlay)/.test(style.overflowX) && element.scrollWidth > element.clientWidth + 1) {
		if (dx < 0 ? element.scrollLeft > 0 : element.scrollLeft + element.clientWidth < element.scrollWidth - 1) return true;
	}
	return false;
}

/** True when a nested scroll area between `target` and the viewport can still scroll in the wheel direction. */
function nestedScrollWants(target: EventTarget | null, viewport: HTMLElement, dx: number, dy: number): boolean {
	let node = target instanceof Element ? target : null;
	while (node && node !== viewport) {
		if (node instanceof HTMLElement && canScroll(node, dx, dy)) return true;
		node = node.parentElement;
	}
	return false;
}

function isSurface(target: EventTarget | null): boolean {
	return target instanceof Element && target.hasAttribute(CANVAS_SURFACE_ATTR);
}

function focusBlocksSpacePan(): boolean {
	const active = document.activeElement;
	return active instanceof Element && active.closest(INTERACTIVE_SELECTOR) != null;
}

/** Wire every camera gesture to `viewport`. Returns a teardown that releases listeners, captures and styles. */
export function attachCanvasGestures(controller: CanvasController, viewport: HTMLElement): () => void {
	let spaceHeld = false;
	let pan: { pointerId: number; lastX: number; lastY: number; moved: boolean } | null = null;
	let suppressClick = false;
	const touches = new Map<number, { x: number; y: number }>();
	let pinch: { distance: number; centerX: number; centerY: number } | null = null;

	const viewportPoint = (clientX: number, clientY: number) => {
		const rect = viewport.getBoundingClientRect();
		return { x: clientX - rect.left, y: clientY - rect.top };
	};

	const onWheel = (event: WheelEvent) => {
		if (event.ctrlKey || event.metaKey) {
			event.preventDefault();
			const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
			controller.zoomAround(viewportPoint(event.clientX, event.clientY), controller.camera.zoom * Math.exp(-delta * 0.01));
			return;
		}
		const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1;
		const dx = (event.shiftKey && event.deltaX === 0 ? event.deltaY : event.deltaX) * scale;
		const dy = (event.shiftKey && event.deltaX === 0 ? 0 : event.deltaY) * scale;
		if (nestedScrollWants(event.target, viewport, dx, dy)) return;
		event.preventDefault();
		controller.pan(-dx, -dy);
	};

	const startPan = (event: PointerEvent) => {
		pan = { pointerId: event.pointerId, lastX: event.clientX, lastY: event.clientY, moved: false };
		viewport.setPointerCapture(event.pointerId);
		viewport.dataset.canvasPanning = "";
	};

	const endPan = () => {
		if (!pan) return;
		if (viewport.hasPointerCapture(pan.pointerId)) viewport.releasePointerCapture(pan.pointerId);
		suppressClick = pan.moved;
		pan = null;
		delete viewport.dataset.canvasPanning;
	};

	const onPointerDown = (event: PointerEvent) => {
		if (event.pointerType === "touch") {
			if (!isSurface(event.target)) return;
			touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
			viewport.setPointerCapture(event.pointerId);
			if (touches.size === 1) startPan(event);
			else {
				endPan();
				pinch = null;
			}
			return;
		}
		const explicit = event.button === 1 || (event.button === 0 && spaceHeld);
		if (explicit) {
			// Explicit pans win over item moves, label copies and middle-click autoscroll.
			event.preventDefault();
			event.stopPropagation();
			startPan(event);
			return;
		}
		if (event.button === 0 && isSurface(event.target)) startPan(event);
	};

	const onPointerMove = (event: PointerEvent) => {
		if (event.pointerType === "touch" && touches.has(event.pointerId)) {
			touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
			if (touches.size >= 2) {
				const [a, b] = [...touches.values()];
				const distance = Math.hypot(a.x - b.x, a.y - b.y);
				const center = viewportPoint((a.x + b.x) / 2, (a.y + b.y) / 2);
				if (pinch) {
					controller.pan(center.x - pinch.centerX, center.y - pinch.centerY);
					controller.zoomAround(center, controller.camera.zoom * (distance / Math.max(1, pinch.distance)));
				}
				pinch = { distance, centerX: center.x, centerY: center.y };
				return;
			}
		}
		if (!pan || pan.pointerId !== event.pointerId) return;
		const dx = event.clientX - pan.lastX;
		const dy = event.clientY - pan.lastY;
		if (!pan.moved && Math.hypot(dx, dy) < DRAG_SLOP) return;
		pan.moved = true;
		pan.lastX = event.clientX;
		pan.lastY = event.clientY;
		controller.pan(dx, dy);
	};

	const onPointerEnd = (event: PointerEvent) => {
		if (touches.delete(event.pointerId) && touches.size < 2) pinch = null;
		if (pan?.pointerId === event.pointerId) endPan();
	};

	const onClickCapture = (event: MouseEvent) => {
		if (!suppressClick) return;
		suppressClick = false;
		event.preventDefault();
		event.stopPropagation();
	};

	const onAuxClick = (event: MouseEvent) => {
		if (event.button === 1) event.preventDefault();
	};

	const clearHeld = () => {
		spaceHeld = false;
		delete viewport.dataset.canvasSpace;
		endPan();
		touches.clear();
		pinch = null;
	};

	const onKeyDown = (event: KeyboardEvent) => {
		if (event.code === "Space" && !event.repeat && !focusBlocksSpacePan()) {
			spaceHeld = true;
			viewport.dataset.canvasSpace = "";
			event.preventDefault();
			return;
		}
		if (event.code === "Space" && spaceHeld) event.preventDefault();
		// Camera keys only when the canvas shell itself has focus, so preview arrows, Escape and undo stay native.
		if (document.activeElement !== viewport || event.altKey || event.ctrlKey || event.metaKey) return;
		const step = event.shiftKey ? PAN_KEY_STEP * 4 : PAN_KEY_STEP;
		const keys: Record<string, () => void> = {
			ArrowLeft: () => controller.pan(step, 0),
			ArrowRight: () => controller.pan(-step, 0),
			ArrowUp: () => controller.pan(0, step),
			ArrowDown: () => controller.pan(0, -step),
			"+": () => controller.zoomStep(1),
			"=": () => controller.zoomStep(1),
			"-": () => controller.zoomStep(-1),
			"0": () => controller.resetCamera(),
			"1": () => controller.fitAll(),
		};
		const action = keys[event.key];
		if (!action) return;
		event.preventDefault();
		action();
	};

	const onKeyUp = (event: KeyboardEvent) => {
		if (event.code === "Space") {
			spaceHeld = false;
			delete viewport.dataset.canvasSpace;
		}
	};

	const onVisibility = () => {
		if (document.hidden) clearHeld();
	};

	// Focus moving offscreen scrolls the overflow-hidden viewport natively; convert that into a camera pan.
	const onScroll = () => {
		const { scrollLeft, scrollTop } = viewport;
		if (scrollLeft === 0 && scrollTop === 0) return;
		viewport.scrollLeft = 0;
		viewport.scrollTop = 0;
		controller.pan(-scrollLeft, -scrollTop);
	};

	const onFocusIn = (event: FocusEvent) => {
		if (!(event.target instanceof HTMLElement) || event.target === viewport || !event.target.matches(":focus-visible")) return;
		const viewportRect = viewport.getBoundingClientRect();
		const rect = event.target.getBoundingClientRect();
		controller.revealRect({ x: rect.left - viewportRect.left, y: rect.top - viewportRect.top, width: rect.width, height: rect.height });
	};

	const html = document.documentElement;
	const body = document.body;
	const previous = { html: html.style.overscrollBehaviorX, body: body.style.overscrollBehaviorX };
	html.style.overscrollBehaviorX = "none";
	body.style.overscrollBehaviorX = "none";

	viewport.addEventListener("wheel", onWheel, { passive: false });
	viewport.addEventListener("pointerdown", onPointerDown, { capture: true });
	viewport.addEventListener("pointermove", onPointerMove);
	viewport.addEventListener("pointerup", onPointerEnd);
	viewport.addEventListener("pointercancel", onPointerEnd);
	viewport.addEventListener("lostpointercapture", onPointerEnd);
	viewport.addEventListener("click", onClickCapture, { capture: true });
	viewport.addEventListener("auxclick", onAuxClick);
	viewport.addEventListener("scroll", onScroll);
	viewport.addEventListener("focusin", onFocusIn);
	window.addEventListener("keydown", onKeyDown);
	window.addEventListener("keyup", onKeyUp);
	window.addEventListener("blur", clearHeld);
	document.addEventListener("visibilitychange", onVisibility);

	return () => {
		clearHeld();
		viewport.removeEventListener("wheel", onWheel);
		viewport.removeEventListener("pointerdown", onPointerDown, { capture: true });
		viewport.removeEventListener("pointermove", onPointerMove);
		viewport.removeEventListener("pointerup", onPointerEnd);
		viewport.removeEventListener("pointercancel", onPointerEnd);
		viewport.removeEventListener("lostpointercapture", onPointerEnd);
		viewport.removeEventListener("click", onClickCapture, { capture: true });
		viewport.removeEventListener("auxclick", onAuxClick);
		viewport.removeEventListener("scroll", onScroll);
		viewport.removeEventListener("focusin", onFocusIn);
		window.removeEventListener("keydown", onKeyDown);
		window.removeEventListener("keyup", onKeyUp);
		window.removeEventListener("blur", clearHeld);
		document.removeEventListener("visibilitychange", onVisibility);
		html.style.overscrollBehaviorX = previous.html;
		body.style.overscrollBehaviorX = previous.body;
	};
}
