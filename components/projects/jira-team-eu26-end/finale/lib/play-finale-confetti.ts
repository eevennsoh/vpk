import { FINALE_CONFETTI_TIMING, type FinaleConfettiColumn } from "./finale-confetti";
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
	/** Fire the burst from the viewport's lower corners, draining onto `column`'s bottom border. */
	readonly play: (column: FinaleConfettiColumn) => FinaleConfettiShow;
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
	readonly dispose: () => void;
}

function createLayer(): { layer: HTMLElement; canvas: HTMLCanvasElement } {
	const layer = document.createElement("div");
	layer.setAttribute("aria-hidden", "true");
	layer.inert = true;
	layer.dataset.finaleConfetti = "";
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
			return { layer, send: (command) => worker.postMessage(command), dispose: () => worker.terminate() };
		} catch {
			// No module workers here: render on the main thread instead.
			return createHost(onEvent, false);
		}
	}
	// Same player, same frames; only exposed to main-thread long tasks.
	const player = createFinaleConfettiPlayer((event) => queueMicrotask(() => onEvent(event)));
	player.handle({ type: "init", canvas });
	return { layer, send: (command) => player.handle(command), dispose: () => player.handle({ type: "dispose" }) };
}

interface ActiveShow {
	readonly id: number;
	readonly gather: () => void;
	readonly done: () => void;
	readonly fail: () => void;
	readonly cancel: () => void;
}

/**
 * Owns the confetti's renderer across shows: one top-layer canvas, driven by a
 * worker when the browser can hand it an OffscreenCanvas. The burst must never
 * hold the finale: a failure, a stall or a resize all release `gathered`.
 */
export function createFinaleConfetti(): FinaleConfetti {
	let host: Host | null = null;
	let failures = 0;
	let sequence = 0;
	let active: ActiveShow | null = null;

	const onEvent = (event: FinaleConfettiEvent) => {
		if (event.type === "failed") {
			if (process.env.NODE_ENV !== "production") console.warn("Finale confetti renderer failed:", event.reason);
			// Retry once on the main thread; after that, the finale runs without confetti.
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

	const play = (column: FinaleConfettiColumn): FinaleConfettiShow => {
		active?.cancel();
		let resolveGathered = () => {};
		const gathered = new Promise<void>((resolve) => {
			resolveGathered = resolve;
		});
		const current = ensureHost();
		if (!current) {
			resolveGathered();
			return { gathered, raise: () => {}, release: () => {}, cancel: () => {} };
		}
		const id = ++sequence;
		const { layer } = current;
		const inTopLayer = () => layer.hasAttribute("popover") && layer.matches(":popover-open");
		let alive = true;
		let releaseTimer = 0;
		const unmount = () => {
			alive = false;
			window.clearTimeout(gatherTimer);
			window.clearTimeout(releaseTimer);
			window.removeEventListener("resize", onResize);
			if (inTopLayer()) layer.hidePopover();
			layer.remove();
			if (active?.id === id) active = null;
		};
		const cancel = () => {
			if (!alive) return;
			current.send({ type: "cancel", id });
			unmount();
		};
		// A resized viewport clears the burst; the finale goes on with fresh geometry.
		const onResize = () => {
			cancel();
			resolveGathered();
		};
		const gatherTimer = window.setTimeout(resolveGathered, FINALE_CONFETTI_TIMING.gathered * 1000 + GATHER_GRACE_MS);
		active = {
			id,
			gather: resolveGathered,
			done: unmount,
			fail: () => {
				unmount();
				resolveGathered();
			},
			cancel,
		};
		document.body.append(layer);
		if (layer.hasAttribute("popover")) layer.showPopover();
		window.addEventListener("resize", onResize);
		current.send({
			type: "play",
			id,
			width: window.innerWidth,
			height: window.innerHeight,
			dpr: Math.min(window.devicePixelRatio || 1, 2),
			column: { x: column.x, y: column.y, width: column.width, height: column.height, radius: column.radius },
		});
		return {
			gathered,
			raise: () => {
				// Re-showing moves it to the top of the top layer, above the dialog.
				if (!alive || !inTopLayer()) return;
				layer.hidePopover();
				layer.showPopover();
			},
			release: () => {
				if (!alive || releaseTimer) return;
				current.send({ type: "release", id });
				releaseTimer = window.setTimeout(unmount, RELEASE_GRACE_MS);
			},
			cancel,
		};
	};

	return {
		prewarm: () => {
			ensureHost();
		},
		play,
		hold: (time) => {
			if (active) host?.send({ type: "hold", id: active.id, time });
		},
		dispose: () => {
			active?.cancel();
			host?.dispose();
			host = null;
		},
	};
}
