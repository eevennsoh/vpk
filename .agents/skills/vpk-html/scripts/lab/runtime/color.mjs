// vpk-lab runtime · color: grayscale tokens, colour normaliser, alpha and mix (lab-kit.md C9). No colour literal lives
// here: the browser normalises custom properties (a hidden probe resolves var() and color-mix(), a 1x1 canvas reads the
// bytes back) into 8-digit hex. Readback is premultiplied, so translucent inputs are approximate; kit tokens are opaque.
import { clamp } from "./core.mjs";

/** Canvas token keys (grayscale plus one focal) and their custom properties. Status hues are deliberately absent. */
export const LAB_TOKEN_VARS = Object.freeze({
	ink: "--ink", muted: "--muted-text", subtle: "--subtlest-text", rule: "--rule", ruleStrong: "--rule-strong",
	paper: "--paper", raised: "--surface-raised", sunken: "--surface-sunken",
	tone1: "--ill-tone1", tone2: "--ill-tone2", tone3: "--ill-tone3", line: "--ill-line", guide: "--ill-guide",
	guideDashed: "--ill-guide-dashed", hatch: "--ill-hatch", ink50: "--ill-ink50", focal: "--focal", inverse: "--inverse-text",
});

/** Font keys: [custom property, fallback family]. */
export const LAB_FONT_VARS = Object.freeze({ mono: ["--font-mono", "monospace"], sans: ["--font-body", "sans-serif"], numeric: ["--font-numeric", "monospace"] });

/** Minimum length of the data-vpk-lab-swatches reason that unlocks product colour. */
export const SWATCH_REASON_MIN = 12;
const colorStates = new WeakMap();

function colorState(env) {
	if (!colorStates.has(env)) colorStates.set(env, { epoch: 0, cache: new Map(), probe: null, ctx: undefined, listeners: new Set(), stop: null, pending: false, snapshot: "" });
	return colorStates.get(env);
}

/** [r, g, b, a?] bytes to an 8-digit hex colour string. */
export function bytesToHex(bytes) {
	const h = n => Math.round(clamp(Number(n) || 0, 0, 255)).toString(16).padStart(2, "0");
	const [r, g, b, a = 255] = bytes;
	return `#${h(r)}${h(g)}${h(b)}${h(a)}`;
}

/** Hex colour text (3, 4, 6 or 8 digits) to [r, g, b, a] bytes, else null. */
export function hexToBytes(text) {
	const match = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(String(text ?? "").trim());
	if (!match) return null;
	const full = match[1].length <= 4 ? [...match[1]].map(digit => digit + digit).join("") : match[1];
	return [0, 2, 4, 6].map(index => parseInt((full.length === 6 ? `${full}ff` : full).slice(index, index + 2), 16));
}

function colorProbe(env, state) {
	const doc = env.document;
	if (!doc?.documentElement || typeof env.getComputedStyle !== "function") return null;
	if (state.probe?.isConnected && state.probe.ownerDocument === doc) return state.probe;
	let probe = doc.querySelector("[data-vpk-color-probe]");
	if (!probe) {
		probe = doc.createElement("span");
		for (const [name, value] of [["data-vpk-color-probe", ""], ["data-vpk-generated", ""], ["hidden", ""], ["aria-hidden", "true"]]) probe.setAttribute(name, value);
		(doc.head ?? doc.documentElement).append(probe);
	}
	return (state.probe = probe);
}

function colorFromProbe(text, env, state, probe) {
	probe.style.color = "";
	probe.style.color = text;
	if (!probe.style.color) return null;
	const computed = env.getComputedStyle(probe).color;
	const direct = hexToBytes(computed);
	if (direct || !computed) return direct && bytesToHex(direct);
	if (state.ctx === undefined) {
		const canvas = Object.assign(env.document.createElement("canvas"), { width: 1, height: 1 });
		state.ctx = canvas.getContext?.("2d", { willReadFrequently: true }) ?? null;
	}
	if (!state.ctx) return null;
	state.ctx.clearRect(0, 0, 1, 1);
	state.ctx.fillStyle = computed;
	state.ctx.fillRect(0, 0, 1, 1);
	return bytesToHex(state.ctx.getImageData(0, 0, 1, 1).data);
}

/** Any CSS colour (hex, var(), color-mix(), modern syntaxes) to 8-digit hex, else null. Cached per theme epoch. */
export function resolveColor(css, env = globalThis) {
	const text = String(css ?? "").trim();
	const direct = hexToBytes(text);
	if (direct || !text) return direct && bytesToHex(direct);
	const state = colorState(env);
	if (!state.cache.has(text)) {
		const probe = colorProbe(env, state);
		if (!probe) return null;
		if (state.cache.size >= 256) state.cache.clear();
		state.cache.set(text, colorFromProbe(text, env, state, probe));
	}
	return state.cache.get(text);
}

/** Start a new theme epoch and forget resolved colours (onTheme does this on every change). */
export function resetColorCache(env = globalThis) {
	colorState(env).cache.clear();
	return (colorState(env).epoch += 1);
}

function colorBytes(color, env) {
	return hexToBytes(color) ?? hexToBytes(resolveColor(color, env));
}

/** `color` with its alpha byte set to `a` (0..1); null when the colour does not resolve. */
export function alpha(color, a, env = globalThis) {
	const bytes = colorBytes(color, env);
	if (!bytes) return null;
	bytes[3] = Math.round(clamp(Number(a)) * 255);
	return bytesToHex(bytes);
}

/** sRGB byte mix of two colours at `t` (0 = a, 1 = b); null when either does not resolve. */
export function mix(a, b, t, env = globalThis) {
	const from = colorBytes(a, env);
	const to = colorBytes(b, env);
	if (!from || !to) return null;
	return bytesToHex(from.map((value, index) => value + (to[index] - value) * clamp(Number(t))));
}

/** Frozen canvas tokens: LAB_TOKEN_VARS keys as 8-digit hex (null when unset), plus mono, sans and numeric fonts. */
export function readTokens(env = globalThis) {
	const style = typeof env.getComputedStyle === "function" && env.document?.documentElement ? env.getComputedStyle(env.document.documentElement) : null;
	const raw = name => (style ? style.getPropertyValue(name).trim() : "");
	const tokens = {};
	for (const [key, name] of Object.entries(LAB_TOKEN_VARS)) tokens[key] = raw(name) ? resolveColor(raw(name), env) : null;
	for (const [key, [name, fallback]] of Object.entries(LAB_FONT_VARS)) tokens[key] = raw(name) || fallback;
	return Object.freeze(tokens);
}

/** The declared hue exception: fills of `selector` nodes inside svg[data-vpk-external-asset][data-vpk-lab-swatches="<reason>"]. */
export function swatches(selector = "[data-vpk-swatch]", env = globalThis) {
	const found = [];
	for (const node of env.document?.querySelectorAll(selector) ?? []) {
		const host = node.closest("svg[data-vpk-external-asset][data-vpk-lab-swatches]");
		if ((host?.getAttribute("data-vpk-lab-swatches") ?? "").trim().length < SWATCH_REASON_MIN) continue;
		const value = resolveColor(node.getAttribute("fill"), env);
		if (value) found.push(value);
	}
	return found;
}

const colorSnapshot = tokens => Object.values(tokens).join(";");

function colorThemeChanged(env, state) {
	resetColorCache(env);
	if (state.pending) return;
	state.pending = true;
	const frame = typeof env.requestAnimationFrame === "function" ? env.requestAnimationFrame.bind(env) : callback => env.setTimeout(callback, 16);
	frame(() => {
		state.pending = false;
		const tokens = state.listeners.size ? readTokens(env) : null;
		if (!tokens || colorSnapshot(tokens) === state.snapshot) return;
		state.snapshot = colorSnapshot(tokens);
		// One microtask per listener, so a throwing listener reports itself without starving the others.
		for (const listener of [...state.listeners]) queueMicrotask(() => listener(tokens));
	});
}

/** `fn(tokens)` at most once per frame after a theme change (html data-theme, style, data-vpk-theme-choice
 * or the system scheme) that changes the tokens. One shared observer and media listener; no DOM writes. */
export function onTheme(fn, env = globalThis) {
	const state = colorState(env);
	state.listeners.add(fn);
	if (state.listeners.size === 1) {
		const changed = () => colorThemeChanged(env, state);
		const root = env.document?.documentElement;
		const observer = root && typeof env.MutationObserver === "function" ? new env.MutationObserver(changed) : null;
		observer?.observe(root, { attributes: true, attributeFilter: ["data-theme", "style", "data-vpk-theme-choice"] });
		const media = env.matchMedia?.("(prefers-color-scheme: dark)");
		media?.addEventListener?.("change", changed);
		state.stop = () => { observer?.disconnect(); media?.removeEventListener?.("change", changed); };
		state.snapshot = colorSnapshot(readTokens(env));
	}
	return () => {
		if (state.listeners.delete(fn) && !state.listeners.size) state.stop?.();
	};
}
