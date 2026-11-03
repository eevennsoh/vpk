import {
	clampCamera,
	clampCoordinate,
	DEFAULT_CAMERA,
	fitCamera,
	panBy,
	revealDelta,
	unionRects,
	zoomAt,
	type CanvasCamera,
	type CanvasPoint,
	type CanvasRect,
} from "./camera.ts";
import { loadCanvasLayout, saveCanvasLayout } from "./layout-storage.ts";

const SAVE_DEBOUNCE_MS = 400;
export const ZOOM_STEP = 1.2;

export interface CanvasItemPlacement {
	id: string;
	initial: CanvasPoint;
}

type Listener = () => void;

/**
 * Owns camera, item positions and measured item sizes outside React state.
 * Gestures mutate it and it writes at most one transform per animation frame, so previews never rerender while
 * the camera or an item moves. React subscribes only for the zoom readout.
 */
export class CanvasController {
	camera: CanvasCamera = DEFAULT_CAMERA;
	private readonly positions = new Map<string, CanvasPoint>();
	private readonly sizes = new Map<string, { width: number; height: number }>();
	private readonly itemElements = new Map<string, HTMLElement>();
	private readonly dirtyItems = new Set<string>();
	private readonly knownIds: ReadonlySet<string>;
	private readonly listeners = new Set<Listener>();
	private viewport: HTMLElement | null = null;
	private world: HTMLElement | null = null;
	private frame = 0;
	private cameraDirty = false;
	private saveTimer = 0;
	private hadSavedCamera = false;
	private resizeObserver: ResizeObserver | null = null;

	constructor(placements: readonly CanvasItemPlacement[]) {
		this.knownIds = new Set(placements.map((placement) => placement.id));
		for (const placement of placements) this.positions.set(placement.id, placement.initial);
	}

	/** Apply a saved layout. Called once on the client before the first paint of item positions. */
	hydrate(): void {
		const saved = loadCanvasLayout(this.knownIds);
		if (!saved) return;
		this.hadSavedCamera = true;
		this.camera = saved.camera;
		for (const [id, point] of Object.entries(saved.positions)) this.positions.set(id, point);
	}

	get hasSavedCamera(): boolean {
		return this.hadSavedCamera;
	}

	subscribe = (listener: Listener): (() => void) => {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	};

	getZoom = (): number => this.camera.zoom;

	attach(viewport: HTMLElement, world: HTMLElement): () => void {
		this.viewport = viewport;
		this.world = world;
		this.resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const id = (entry.target as HTMLElement).dataset.canvasItemId;
				if (!id) continue;
				const box = entry.borderBoxSize[0];
				// Layout box, unaffected by the world's scale transform.
				if (box) this.sizes.set(id, { width: box.inlineSize, height: box.blockSize });
			}
		});
		for (const element of this.itemElements.values()) this.resizeObserver.observe(element);
		this.cameraDirty = true;
		this.schedule();
		return () => {
			this.flushSave();
			cancelAnimationFrame(this.frame);
			window.clearTimeout(this.saveTimer);
			this.resizeObserver?.disconnect();
			this.resizeObserver = null;
			this.viewport = null;
			this.world = null;
		};
	}

	registerItem = (id: string, element: HTMLElement | null): void => {
		const previous = this.itemElements.get(id);
		if (previous && previous !== element) this.resizeObserver?.unobserve(previous);
		if (!element) {
			this.itemElements.delete(id);
			return;
		}
		this.itemElements.set(id, element);
		this.resizeObserver?.observe(element);
		this.dirtyItems.add(id);
		this.schedule();
	};

	positionOf(id: string): CanvasPoint {
		return this.positions.get(id) ?? { x: 0, y: 0 };
	}

	viewportSize(): { width: number; height: number } {
		return { width: this.viewport?.clientWidth ?? 0, height: this.viewport?.clientHeight ?? 0 };
	}

	setCamera(next: CanvasCamera, options: { save?: boolean } = {}): void {
		this.camera = clampCamera(next);
		this.cameraDirty = true;
		this.schedule();
		if (options.save !== false) this.requestSave();
	}

	pan(dx: number, dy: number): void {
		this.setCamera(panBy(this.camera, dx, dy));
	}

	zoomAround(anchor: CanvasPoint, nextZoom: number): void {
		this.setCamera(zoomAt(this.camera, anchor, nextZoom));
	}

	/** Button and keyboard zoom: centred on the viewport. */
	zoomStep(direction: 1 | -1): void {
		const { width, height } = this.viewportSize();
		this.zoomAround({ x: width / 2, y: height / 2 }, this.camera.zoom * (direction > 0 ? ZOOM_STEP : 1 / ZOOM_STEP));
	}

	moveItem(id: string, point: CanvasPoint): void {
		this.positions.set(id, { x: clampCoordinate(point.x), y: clampCoordinate(point.y) });
		this.dirtyItems.add(id);
		this.schedule();
	}

	commitItemMove(): void {
		this.requestSave();
	}

	itemBounds(id: string): CanvasRect | null {
		const size = this.sizes.get(id);
		const element = this.itemElements.get(id);
		const width = size?.width ?? element?.offsetWidth ?? 0;
		const height = size?.height ?? element?.offsetHeight ?? 0;
		if (width === 0 || height === 0) return null;
		const position = this.positionOf(id);
		return { x: position.x, y: position.y, width, height };
	}

	fitAll(): void {
		const bounds = unionRects([...this.itemElements.keys()].map((id) => this.itemBounds(id)).filter((rect): rect is CanvasRect => rect != null));
		if (!bounds) return;
		this.setCamera(fitCamera(bounds, this.viewportSize()));
	}

	/** Show one item at 100% (or smaller when it cannot fit), keeping its label in view. */
	revealItem(id: string): void {
		const bounds = this.itemBounds(id);
		if (!bounds) return;
		const viewport = this.viewportSize();
		const fitted = fitCamera(bounds, viewport, 72);
		const zoom = fitted.zoom;
		this.setCamera({ x: fitted.x, y: Math.min(fitted.y, 72 - bounds.y * zoom), zoom });
	}

	resetCamera(): void {
		this.setCamera(DEFAULT_CAMERA);
	}

	/** Pan just enough to bring a screen-space rect (e.g. a focused control) into view. */
	revealRect(rect: CanvasRect): void {
		const delta = revealDelta(rect, this.viewportSize());
		if (delta.x !== 0 || delta.y !== 0) this.pan(delta.x, delta.y);
	}

	private schedule(): void {
		if (this.frame !== 0) return;
		this.frame = requestAnimationFrame(() => {
			this.frame = 0;
			this.write();
		});
	}

	private write(): void {
		if (this.cameraDirty && this.world) {
			const { x, y, zoom } = this.camera;
			this.world.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${zoom})`;
			this.cameraDirty = false;
			for (const listener of this.listeners) listener();
		}
		for (const id of this.dirtyItems) {
			const element = this.itemElements.get(id);
			const position = this.positions.get(id);
			if (element && position) element.style.transform = `translate(${position.x}px, ${position.y}px)`;
		}
		this.dirtyItems.clear();
	}

	private requestSave(): void {
		window.clearTimeout(this.saveTimer);
		this.saveTimer = window.setTimeout(() => this.flushSave(), SAVE_DEBOUNCE_MS);
	}

	flushSave(): void {
		if (this.saveTimer === 0) return;
		window.clearTimeout(this.saveTimer);
		this.saveTimer = 0;
		saveCanvasLayout({ camera: this.camera, positions: Object.fromEntries(this.positions) }, this.knownIds);
	}
}
