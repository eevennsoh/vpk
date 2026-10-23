// vpk-lab runtime · frame: canvas setup and the lab frame (references/lab-kit.md, Lab frame). A lab is a root
// [data-vpk-lab="<id>"] holding canvases, [data-vpk-param] inputs, [data-vpk-out] outputs, play/reset/rate controls,
// a readout, a note and the required [data-vpk-lab-source]. Per-frame writes are Text.data only (no childList
// mutations, no markup strings), so the enhancer and the review runtime never see a lab animate.
import { clamp, fixed } from "./core.mjs";
import { alpha, mix, onTheme, readTokens } from "./color.mjs";
import { makeLoop, reducedMotion } from "./loop-adapter.mjs";

export const LAB_ID = /^[a-z][a-z0-9-]{0,63}$/;
const FRAME_FORMATS = Object.freeze({
	fixed1: n => fixed(n, 1), fixed2: n => fixed(n, 2), fixed3: n => fixed(n, 3),
	x: n => `${fixed(n, 2)}×`, s: n => `${fixed(n, 2)} s`, int: n => String(Math.round(Number(n))), pt: n => `${fixed(n, 1)} pt`,
});

/** Set an element's text through its single Text child (Text.data), creating it once. Writes only on change. */
export function labSetText(element, text) {
	if (!element) return;
	const value = String(text ?? "");
	const node = element.firstChild;
	if (node && node.nodeType === 3 && node === element.lastChild) {
		if (node.data !== value) node.data = value;
	} else element.textContent = value;
}

/** A runtime-created element: carries data-vpk-generated so init can remove it and WS1 never anchors to it. */
export function labMake(doc, tag, { className, text, attrs } = {}) {
	const element = doc.createElement(tag);
	element.setAttribute("data-vpk-generated", "");
	if (className) element.className = className;
	for (const [name, value] of Object.entries(attrs ?? {})) element.setAttribute(name, value);
	if (text != null) element.append(doc.createTextNode(String(text)));
	return element;
}

/** Size the backing store to the authored width/height × min(2, devicePixelRatio). The authored size is kept in
 * data-vpk-canvas-size, so re-running init on a serialised copy does not double it. → { ctx, w, h, dpr } */
export function setupCanvas(canvas, env = globalThis) {
	const authored = String(canvas.getAttribute("data-vpk-canvas-size") ?? "").split(" ").map(Number);
	const w = authored[0] > 0 ? authored[0] : Number(canvas.getAttribute("width")) || 300;
	const h = authored[1] > 0 ? authored[1] : Number(canvas.getAttribute("height")) || 150;
	const dpr = Math.min(2, env.devicePixelRatio || 1);
	if (!(authored[0] > 0)) canvas.setAttribute("data-vpk-canvas-size", `${w} ${h}`);
	if (canvas.width !== Math.round(w * dpr)) canvas.width = Math.round(w * dpr);
	if (canvas.height !== Math.round(h * dpr)) canvas.height = Math.round(h * dpr);
	const ctx = canvas.getContext?.("2d") ?? null;
	ctx?.setTransform?.(dpr, 0, 0, dpr, 0, 0);
	return { ctx, w, h, dpr };
}

/** Keep a lab's canvases fitted to their rendered width through a ResizeObserver (no geometry reads). api.scale is the
 * first canvas's CSS px per canvas unit; api.px(n) is n CSS px in canvas units, never below n. A canvas with
 * data-vpk-canvas-min-height="<css px>" grows its logical height (never its width) to render at least that tall. */
function fitCanvases(api, items, first, env) {
	if (typeof env.ResizeObserver !== "function" || !items.length) return;
	const observer = new env.ResizeObserver(entries => {
		let changed = false;
		for (const entry of entries) {
			const item = items.find(candidate => candidate.canvas === entry.target);
			const width = entry.contentRect?.width;
			if (!item || !(width > 0) || !(item.w > 0)) continue;
			const authored = Number(String(item.canvas.getAttribute("data-vpk-canvas-size") ?? "").split(" ")[1]) || item.h;
			const minHeight = Number(item.canvas.getAttribute("data-vpk-canvas-min-height")) || 0;
			const h = minHeight > 0 ? Math.max(authored, Math.round((minHeight * item.w) / width)) : authored;
			if (h !== item.h) {
				item.h = h;
				item.canvas.height = Math.round(h * item.dpr);
				item.ctx?.setTransform?.(item.dpr, 0, 0, item.dpr, 0, 0);
				changed = true;
			}
			if (item === first && (Math.abs(width / item.w - api.scale) > 0.005 || api.h !== item.h)) {
				api.scale = width / item.w;
				api.h = item.h;
				changed = true;
			}
		}
		if (changed) api.requestDraw();
	});
	for (const item of items) observer.observe(item.canvas);
}

/** True in the presenter window (scripts/presentation.mjs marks <html data-vpk-presenter="true">, body.vpk-presenter-window). */
export function labInPresenter(doc) {
	return doc?.documentElement?.getAttribute?.("data-vpk-presenter") === "true" || Boolean(doc?.body?.classList?.contains("vpk-presenter-window"));
}

/** Rounded-rectangle path (no fill or stroke). */
export function roundRect(ctx, x, y, w, h, r) {
	const rr = Math.max(0, Math.min(r, w / 2, h / 2));
	ctx.beginPath();
	ctx.moveTo(x + rr, y);
	ctx.arcTo(x + w, y, x + w, y + h, rr);
	ctx.arcTo(x + w, y + h, x, y + h, rr);
	ctx.arcTo(x, y + h, x, y, rr);
	ctx.arcTo(x, y, x + w, y, rr);
	ctx.closePath();
}

function frameReadParam(input) {
	if (input.type === "checkbox") return Boolean(input.checked);
	if (input.type === "range" || input.type === "number") return Number(input.value);
	const value = input.value;
	return value !== "" && Number.isFinite(Number(value)) ? Number(value) : value;
}

function frameFormat(value, name, def, element) {
	const custom = def.params?.[name]?.format;
	if (typeof custom === "function") return custom(value);
	if (typeof value === "boolean") return value ? "on" : "off";
	const format = FRAME_FORMATS[element.getAttribute("data-format") ?? ""];
	return format && typeof value === "number" ? format(value) : String(value);
}

function frameResetInput(input) {
	if (input.type === "checkbox") input.checked = input.defaultChecked;
	else if (input.tagName === "SELECT") {
		const preset = [...input.options].find(option => option.defaultSelected) ?? input.options[0];
		if (preset) input.value = preset.value;
	} else input.value = input.defaultValue;
}

/**
 * Wire one lab. `def`: { draw(api) (required), time?: { param = "t", min, max, rate = 1, loop = false, reducedMotion },
 * step?(dt, api) → false to stop, setup?(api), reducedMotionState?(api), readout?(api) → [[label, value]],
 * notes?(api) → { text, warn }, params?: { [name]: { format(v) } }, canvases?: { name: selector } }.
 * Returns the api: { root, id, ctx, w, h, dpr, canvases, t, params, state, tokens, alpha, mix, rate,
 * requestDraw(), play(), pause(), seek(t), reset(), get running }.
 */
export function lab(id, def, { env = globalThis, tokens } = {}) {
	const doc = env.document;
	if (!LAB_ID.test(String(id)) || typeof def?.draw !== "function") throw new TypeError(`vpk-lab: lab("${id}") needs an id matching ${LAB_ID} and a draw(api) function`);
	const root = doc.querySelector(`[data-vpk-lab="${id}"]`);
	if (!root) {
		// The docnav presenter popup loads the same file, then swaps the body for its notes UI: no root is expected there.
		if (!labInPresenter(doc)) env.console?.error?.(`vpk-lab: no [data-vpk-lab="${id}"] element for this lab`);
		return null;
	}
	const canvasList = [...root.querySelectorAll("[data-vpk-lab-canvas]")];
	const canvases = {};
	canvasList.forEach((canvas, index) => { canvases[canvas.getAttribute("data-vpk-lab-canvas") || `canvas${index}`] = { canvas, ...setupCanvas(canvas, env) }; });
	for (const [name, selector] of Object.entries(def.canvases ?? {})) {
		const canvas = root.querySelector(selector);
		if (canvas) canvases[name] = { canvas, ...setupCanvas(canvas, env) };
	}
	const first = canvases[Object.keys(canvases)[0]] ?? { ctx: null, w: 0, h: 0, dpr: 1 };
	const inputs = [...root.querySelectorAll("[data-vpk-param]")];
	const outputs = [...root.querySelectorAll("[data-vpk-out]")];
	const play = root.querySelector("[data-vpk-lab-play]");
	const playLabel = play?.textContent.trim() ?? "Play";
	const pauseLabel = play?.getAttribute("data-pause-label") ?? "Pause";
	const live = [...root.querySelectorAll("[data-vpk-readout], [data-vpk-lab-note]")];
	const readoutEl = root.querySelector("[data-vpk-readout]");
	const noteEl = root.querySelector("[data-vpk-lab-note]");
	const time = def.time ? { param: "t", rate: 1, loop: false, ...def.time } : null;
	const timeInput = time ? inputs.find(input => input.getAttribute("data-vpk-param") === time.param) : null;
	if (time) {
		time.min = Number(time.min ?? timeInput?.min ?? 0);
		time.max = Number(time.max ?? timeInput?.max ?? 1);
	}
	let pending = false;
	let readoutCells = [];
	const api = {
		root, id, ctx: first.ctx, w: first.w, h: first.h, dpr: first.dpr, canvases, t: time ? time.min : 0, params: {}, state: {},
		tokens: tokens ?? readTokens(env), rate: 1, frame: 0, scale: 1,
		px: n => n / Math.min(1, api.scale || 1),
		alpha: (color, a) => alpha(color, a, env),
		mix: (a, b, t) => mix(a, b, t, env),
		requestDraw, play: start, pause, seek, reset,
		get running() { return loop.running; },
	};
	const readParams = () => {
		for (const input of inputs) api.params[input.getAttribute("data-vpk-param")] = frameReadParam(input);
		if (time && timeInput && !loop.running) api.t = clamp(Number(api.params[time.param]), time.min, time.max);
	};
	const writeOutputs = () => {
		for (const output of outputs) {
			const name = output.getAttribute("data-vpk-out");
			const value = time && name === time.param ? api.t : api.params[name];
			if (value !== undefined) labSetText(output, frameFormat(value, name, def, output));
		}
	};
	const writeReadout = () => {
		if (!readoutEl || typeof def.readout !== "function") return;
		const rows = def.readout(api) ?? [];
		if (rows.length !== readoutCells.length) {
			readoutCells.forEach(cell => cell.span.remove());
			readoutCells = rows.map(([label]) => {
				const span = labMake(doc, "span", { text: `${label} ` });
				const value = labMake(doc, "b", { className: "vpk-num", text: "" });
				span.append(value);
				readoutEl.append(span);
				return { span, label: span.firstChild, value };
			});
		}
		rows.forEach(([label, value], index) => {
			if (readoutCells[index].label.data !== `${label} `) readoutCells[index].label.data = `${label} `;
			labSetText(readoutCells[index].value, value);
		});
	};
	const writeNote = () => {
		if (!noteEl || typeof def.notes !== "function") return;
		const note = def.notes(api) ?? { text: "" };
		labSetText(noteEl, note.text ?? "");
		if (noteEl.classList.contains("is-warn") !== Boolean(note.warn)) noteEl.classList.toggle("is-warn", Boolean(note.warn));
	};
	function drawNow() {
		pending = false;
		readParams();
		api.frame += 1;
		def.draw(api);
		writeOutputs();
		writeReadout();
		writeNote();
	}
	function requestDraw() {
		if (loop.running || pending) return;
		pending = true;
		const frame = typeof env.requestAnimationFrame === "function" ? env.requestAnimationFrame.bind(env) : callback => env.setTimeout(callback, 16);
		frame(drawNow);
	}
	const setRunning = running => {
		if (play) {
			labSetText(play, running ? pauseLabel : playLabel);
			play.setAttribute("aria-pressed", String(running));
		}
		for (const element of live) element.setAttribute("aria-live", running ? "off" : "polite");
	};
	const land = () => {
		if (time) {
			api.t = clamp(Number(time.reducedMotion ?? time.max), time.min, time.max);
			if (timeInput) timeInput.value = String(api.t);
		} else def.reducedMotionState?.(api);
		drawNow();
	};
	const loop = makeLoop(root, (dt, now, calm) => {
		if (calm) {
			land();
			setRunning(false);
			return false;
		}
		let more = true;
		if (time) {
			api.t += dt * api.rate * time.rate;
			if (api.t >= time.max) {
				if (time.loop) api.t = time.min + ((api.t - time.max) % Math.max(1e-6, time.max - time.min));
				else {
					api.t = time.max;
					more = false;
				}
			}
			if (timeInput) timeInput.value = String(api.t);
		} else if (def.step?.(dt * api.rate, api) === false) more = false;
		readParams();
		api.frame += 1;
		def.draw(api);
		writeOutputs();
		writeReadout();
		writeNote();
		if (!more) setRunning(false);
		return more;
	}, { loop: env.vpkFrameLoop ?? null, rest: () => pause() });
	function start() {
		if (reducedMotion(env)) {
			land();
			return;
		}
		if (time) {
			readParams();
			if (api.t >= time.max - 1e-9) api.t = time.min;
		} else def.setup?.(api);
		loop.start();
		if (loop.running) setRunning(true);
	}
	function pause() {
		if (!loop.running) return;
		loop.stop();
		setRunning(false);
		drawNow();
	}
	function seek(t) {
		pause();
		if (!time) return;
		api.t = clamp(Number(t), time.min, time.max);
		if (timeInput) timeInput.value = String(api.t);
		drawNow();
	}
	function reset() {
		pause();
		inputs.forEach(frameResetInput);
		readParams();
		if (time) api.t = timeInput ? clamp(Number(api.params[time.param]), time.min, time.max) : time.min;
		def.setup?.(api);
		drawNow();
	}
	for (const input of inputs) {
		input.addEventListener("input", () => {
			if (time && input === timeInput) pause();
			requestDraw();
		});
		input.addEventListener("change", requestDraw);
	}
	play?.addEventListener("click", () => (loop.running ? pause() : start()));
	root.querySelector("[data-vpk-lab-reset]")?.addEventListener("click", reset);
	const rates = [...root.querySelectorAll("[data-vpk-lab-rate] [data-rate]")];
	for (const button of rates) {
		button.addEventListener("click", () => {
			api.rate = Number(button.getAttribute("data-rate")) || 1;
			rates.forEach(other => other.setAttribute("aria-pressed", String(other === button)));
		});
	}
	api.rate = Number(rates.find(button => button.getAttribute("aria-pressed") === "true")?.getAttribute("data-rate")) || 1;
	onTheme(next => {
		api.tokens = next;
		requestDraw();
	}, env);
	env.document.fonts?.ready?.then?.(requestDraw);
	fitCanvases(api, Object.values(canvases), first, env);
	setRunning(false);
	readParams();
	def.setup?.(api);
	drawNow();
	return api;
}
