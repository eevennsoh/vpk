import { FINALE_CONFETTI_TIMING, SMALL_CONFETTI_TIMING, finaleConfettiRealTime, type FinaleConfettiColumn, type FinaleConfettiStage } from "./finale-confetti";
import { createFinaleConfettiPlayer, type FinaleConfettiCommand, type FinaleConfettiEvent } from "./finale-confetti-renderer";

/** A running burst, handed from the board's completion to the finale's ignition. */
export interface FinaleConfettiShow {
	/** Every piece has landed on the column's foot (or the burst was cleared early): the flash may ignite. */
	readonly gathered: Promise<void>;
	/** Re-enter the top layer above a dialog that opened after the burst began. */
	readonly raise: () => void;
	/** The flash has ignited: the border glow blooms into it, then the layer removes itself. */
	readonly release: () => void;
	/** Clear everything now (exit, replay, unmount). */
	readonly cancel: () => void;
}

export interface FinaleConfetti {
	/** Boot the renderer (worker, GL context and shaders) ahead of the show. */
	readonly prewarm: () => void;
	/** Fire both sizes from the viewport's lower corners, draining onto the column's bottom border. */
	readonly play: (column: FinaleConfettiColumn, size?: FinaleConfettiStage["size"]) => FinaleConfettiShow;
	/** Rehearsal: freeze the running burst on an exact second, or resume from it with `null`. */
	readonly hold: (time: number | null) => void;
	readonly dispose: () => void;
}

/** A stalled renderer may delay the flash by at most this much past the planned gather. */
const GATHER_GRACE_MS = 2500;
/** Longest a released layer stays up if its renderer never reports `done`. */
const RELEASE_GRACE_MS = 1000;

interface Host {
	readonly layer: HTMLElement;
	readonly send: (command: FinaleConfettiCommand) => void;
	/** Stop its renderer and take its layer off the page. */
	readonly dispose: () => void;
}

/** `idle` while parked between shows, `playing` while a burst is up. */
type FinaleConfettiState = "idle" | "playing";

const inTopLayer = (layer: HTMLElement) => layer.hasAttribute("popover") && layer.matches(":popover-open");

function removeLayer(layer: HTMLElement): void {
	if (inTopLayer(layer)) layer.hidePopover();
	layer.remove();
}

function viewportSize(): { width: number; height: number; dpr: number } {
	return { width: window.innerWidth, height: window.innerHeight, dpr: Math.min(window.devicePixelRatio || 1, 2) };
}

function createLayer(): { layer: HTMLElement; canvas: HTMLCanvasElement } {
	const layer = document.createElement("div");
	layer.setAttribute("aria-hidden", "true");
	layer.inert = true;
	layer.dataset.finaleConfetti = "idle" satisfies FinaleConfettiState;
	// A manual popover lives in the top layer, so it can be raised above the finale's modal dialog.
	if (typeof layer.showPopover === "function") layer.setAttribute("popover", "manual");
	layer.className = "pointer-events-none fixed inset-0 z-[10000] m-0 size-full max-h-none max-w-none overflow-hidden border-0 bg-transparent p-0";
	const canvas = document.createElement("canvas");
	canvas.className = "block size-full";
	layer.append(canvas);
	return { layer, canvas };
}

function createHost(onEvent: (event: FinaleConfettiEvent) => void, allowWorker: boolean): Host {
	const { layer, canvas } = createLayer();
	if (allowWorker && typeof Worker === "function" && typeof canvas.transferControlToOffscreen === "function") {
		try {
			const worker = new Worker(new URL("./finale-confetti.worker.ts", import.meta.url), { type: "module" });
			worker.onmessage = (event: MessageEvent<FinaleConfettiEvent>) => onEvent(event.data);
			worker.onerror = (event) => onEvent({ type: "failed", reason: event.message || "worker error" });
			const offscreen = canvas.transferControlToOffscreen();
			worker.postMessage({ type: "init", canvas: offscreen } satisfies FinaleConfettiCommand, [offscreen]);
			return {
				layer,
				send: (command) => worker.postMessage(command),
				dispose: () => {
					worker.terminate();
					removeLayer(layer);
				},
			};
		} catch {
			// No module workers here: render on the main thread instead.
			return createHost(onEvent, false);
		}
	}
	// Same player, same frames; only exposed to main-thread long tasks.
	const player = createFinaleConfettiPlayer((event) => queueMicrotask(() => onEvent(event)));
	player.handle({ type: "init", canvas });
	return {
		layer,
		send: (command) => player.handle(command),
		dispose: () => {
			player.handle({ type: "dispose" });
			removeLayer(layer);
		},
	};
}

interface ActiveShow {
	readonly id: number;
	readonly gather: () => void;
	readonly done: () => void;
	readonly fail: () => void;
	readonly cancel: () => void;
	/** A rehearsal hold (`null` resumes): the stall backstop waits with the frozen show. */
	readonly hold: (time: number | null) => void;
}

/**
 * Owns the confetti's renderer across shows: one top-layer canvas, driven by a
 * worker when the browser can hand it an OffscreenCanvas. The burst must never
 * hold the finale: a failure, a stall or a resize all release `gathered`.
 *
 * Between shows the canvas stays parked on the page: in the top layer,
 * transparent and sized to the viewport. A worker's frames reach the screen
 * only through a surface the page has embedded, and embedding a new or resized
 * canvas takes a main-thread commit, while the main thread prints the Done
 * column just as the burst launches. Parked ahead of time, the launch presents
 * from its first frame; the cost is one viewport-sized buffer kept while the
 * board is open.
 */
export function createFinaleConfetti(): FinaleConfetti {
	let host: Host | null = null;
	let failures = 0;
	let sequence = 0;
	let active: ActiveShow | null = null;
	let parkFrame = 0;
	let listening = false;

	const onEvent = (event: FinaleConfettiEvent) => {
		if (event.type === "failed") {
			if (process.env.NODE_ENV !== "production") console.warn("Finale confetti renderer failed:", event.reason);
			// The first failure falls back to the main thread, and the running show
			// moves there at once: for a keynote this is the only run. After a
			// second failure the finale runs without confetti.
			failures += 1;
			host?.dispose();
			host = null;
			active?.fail();
			return;
		}
		if (!active || event.id !== active.id) return;
		if (event.type === "gathered") active.gather();
		else active.done();
	};
	const ensureHost = () => {
		if (!host && failures < 2) host = createHost(onEvent, failures === 0);
		return host;
	};
	/** On the page, in the top layer and (between shows) sized to the viewport. */
	const park = () => {
		const current = ensureHost();
		if (!current) return null;
		const { layer } = current;
		if (!layer.isConnected) document.body.append(layer);
		if (layer.hasAttribute("popover") && !inTopLayer(layer)) layer.showPopover();
		if (!active) current.send({ type: "park", ...viewportSize() });
		return current;
	};
	// Keep the parked canvas at the viewport's size, once per frame of a resize.
	const onViewportResize = () => {
		if (parkFrame) return;
		parkFrame = window.requestAnimationFrame(() => {
			parkFrame = 0;
			if (host) park();
		});
	};
	const listen = () => {
		if (listening) return;
		listening = true;
		window.addEventListener("resize", onViewportResize);
	};

	const play = (column: FinaleConfettiColumn, size: FinaleConfettiStage["size"] = "large"): FinaleConfettiShow => {
		active?.cancel();
		let resolveGathered = () => {};
		const gathered = new Promise<void>((resolve) => {
			resolveGathered = resolve;
		});
		const id = ++sequence;
		// The host drawing this show; it changes if the worker fails and the show moves to the main thread.
		let current: Host | null = null;
		let alive = true;
		let releaseTimer = 0;
		let gatherTimer = 0;
		let heldAt = 0;
		const completionTime = size === "small" ? SMALL_CONFETTI_TIMING.fadeStart + SMALL_CONFETTI_TIMING.fade : finaleConfettiRealTime(FINALE_CONFETTI_TIMING.gathered);
		const armBackstop = (after: number) => {
			window.clearTimeout(gatherTimer);
			gatherTimer = window.setTimeout(() => {
				if (size === "small") cancel();
				else resolveGathered();
			}, after * 1000 + GATHER_GRACE_MS);
		};
		const setState = (state: FinaleConfettiState) => {
			if (current) current.layer.dataset.finaleConfetti = state;
		};
		const unmount = () => {
			alive = false;
			window.clearTimeout(gatherTimer);
			window.clearTimeout(releaseTimer);
			window.removeEventListener("resize", onResize);
			if (active?.id !== id) return;
			active = null;
			setState("idle");
		};
		const cancel = () => {
			if (!alive) return;
			current?.send({ type: "cancel", id });
			unmount();
		};
		// A resized viewport clears the burst; the finale goes on with fresh geometry.
		const onResize = () => {
			cancel();
			resolveGathered();
		};
		/** (Re)start this show on the current host; false when no renderer is left. */
		const start = () => {
			// Parked already (prewarm), so nothing on the page changes as the burst launches.
			current = park();
			if (!current) return false;
			armBackstop(completionTime);
			setState("playing");
			current.layer.dataset.finaleConfettiSize = size;
			current.send({
				type: "play",
				id,
				size,
				...viewportSize(),
				column: { x: column.x, y: column.y, width: column.width, height: column.height, radius: column.radius },
			});
			return true;
		};
		active = {
			id,
			gather: resolveGathered,
			done: unmount,
			fail: () => {
				// The failed host has taken its layer down; the show moves to a fresh one.
				if (alive && start()) return;
				unmount();
				resolveGathered();
			},
			cancel,
			hold: (time) => {
				// Frozen, the show cannot gather; resumed, it is due from the held second.
				if (time === null) armBackstop(Math.max(0, completionTime - (size === "small" ? heldAt : finaleConfettiRealTime(heldAt))));
				else {
					heldAt = time;
					window.clearTimeout(gatherTimer);
				}
			},
		};
		listen();
		if (!start()) {
			unmount();
			resolveGathered();
			return { gathered, raise: () => {}, release: () => {}, cancel: () => {} };
		}
		window.addEventListener("resize", onResize);
		return {
			gathered,
			raise: () => {
				// Re-showing moves it to the top of the top layer, above the dialog.
				const layer = current?.layer;
				if (!alive || !layer || !inTopLayer(layer)) return;
				layer.hidePopover();
				layer.showPopover();
			},
			release: () => {
				if (!alive || releaseTimer) return;
				current?.send({ type: "release", id });
				releaseTimer = window.setTimeout(unmount, RELEASE_GRACE_MS);
			},
			cancel,
		};
	};

	return {
		prewarm: () => {
			listen();
			park();
		},
		play,
		hold: (time) => {
			if (!active) return;
			active.hold(time);
			host?.send({ type: "hold", id: active.id, time });
		},
		dispose: () => {
			active?.cancel();
			window.cancelAnimationFrame(parkFrame);
			parkFrame = 0;
			window.removeEventListener("resize", onViewportResize);
			listening = false;
			host?.dispose();
			host = null;
		},
	};
}
