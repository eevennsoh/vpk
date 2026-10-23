// vpk-lab runtime · index: idempotent init, the document-lab queue and window.vpkLab (references/lab-kit.md).
// installLab() installs the shared frame loop and window.vpkLab, then runs init() at DOMContentLoaded (or a microtask
// once parsed), after every inline script, the enhancer included. Labs push [id, def] onto self.vpkLabQueue.
import { getFrameLoop } from "../../runtime/frame-loop.mjs";
import { EASE, clamp, clockAt, cubicBezier, filmFromClock, fixed, hash01, keyframes, lerp, mulberry32, progress, signed, smooth, spring, springStats } from "./core.mjs";
import { alpha, mix, onTheme, readTokens, resolveColor, swatches } from "./color.mjs";
import { getLoop, makeLoop, reducedMotion } from "./loop-adapter.mjs";
import { lab, roundRect, setupCanvas } from "./frame.mjs";
import { film } from "./film.mjs";
import { wireGantt } from "./gantt.mjs";
import { legacyLightboxFallback, wireFilters, wireFlip, wireSelect } from "./widgets.mjs";

/** Every kit root; each carries a static data-vpkh-no-lightbox (lab/kit.mjs checks it). */
export const LAB_ROOTS = "[data-vpk-film], [data-vpk-cues], [data-vpk-gantt], [data-vpk-lab], [data-vpk-filters], [data-vpk-flip-deck], [data-vpk-layers]";
const LAB_RESET_CLASSES = ["is-current", "is-selected", "vpk-is-filtered", "is-warn"];
const LAB_READY_MS = 4000;

const labFilmTarget = element => element.getAttribute("data-film-target") ?? element.closest("[data-film-target]")?.getAttribute("data-film-target") ?? null;
/** Reading vpkLab.ready means a reader wants the finished page (pdf.mjs): start every film's thumbnails now, or at init. */
const labDrawThumbs = state => { state.eager = true; state.films.forEach(api => api.drawThumbs()); };

/** Steps 1–7 of init (lab-kit.md, Idempotent init). Returns { films, gantts, labs, fallback, ready }. */
export function labInit(env, state) {
	const doc = env.document;
	const roots = [...doc.querySelectorAll(LAB_ROOTS)];
	for (const root of roots) root.querySelectorAll("[data-vpk-generated]").forEach(node => node.remove());
	for (const node of doc.querySelectorAll(LAB_RESET_CLASSES.map(name => `.${name}`).join(", "))) {
		if (node.closest(`${LAB_ROOTS}, [data-vpk-filter-scope], [data-vpk-select-target]`)) node.classList.remove(...LAB_RESET_CLASSES);
	}
	state.tokens = readTokens(env);
	onTheme(next => { state.tokens = next; }, env);
	const fallback = legacyLightboxFallback(roots, env);
	const films = new Map();
	const filmRoots = [...doc.querySelectorAll("[data-vpk-film]")];
	const cueButtons = [...doc.querySelectorAll("[data-vpk-cues] [data-vpk-cue]")];
	filmRoots.forEach((root, index) => {
		const mine = cueButtons.filter(button => (labFilmTarget(button) ? labFilmTarget(button) === root.id : index === 0));
		films.set(root.id || `vpk-film-${index + 1}`, film(root, { env, cueButtons: mine, tokens: () => state.tokens }));
	});
	const gantts = [...doc.querySelectorAll("[data-vpk-gantt]")].map(element => {
		const target = films.get(labFilmTarget(element)) ?? films.values().next().value;
		return target ? wireGantt(element, target, { env }) : null;
	}).filter(Boolean);
	doc.querySelectorAll("[data-vpk-filters]").forEach(group => wireFilters(group, env));
	doc.querySelectorAll("button[data-vpk-flip]").forEach(button => wireFlip(button));
	new Set([...doc.querySelectorAll("[data-vpk-select]")].map(button => button.getAttribute("data-vpk-select"))).forEach(name => wireSelect(name, env));
	state.films = films;
	if (state.eager) labDrawThumbs(state);
	state.inited = true;
	const queued = Array.isArray(env.vpkLabQueue) ? env.vpkLabQueue : [];
	env.vpkLabQueue = Object.freeze({ push: (...entries) => { for (const entry of entries) state.define(...entry); return 0; } });
	for (const entry of queued) state.define(...entry);
	const thumbs = Promise.all([...films.values()].map(api => api.thumbs.catch(() => {})));
	const ready = Promise.race([thumbs, new Promise(resolve => env.setTimeout(resolve, LAB_READY_MS))]).then(() => true);
	return { films, gantts, fallback, ready };
}

/** Install window.vpkLab and schedule init. Idempotent per window: a second block on the same page is a no-op. */
export function installLab(env = globalThis) {
	if (env.vpkLab?.version) return env.vpkLab;
	getFrameLoop(env);
	const state = { tokens: null, films: new Map(), labs: new Map(), inited: false, eager: false, define: null };
	let settle;
	const ready = new Promise(resolve => { settle = resolve; });
	state.define = (id, def) => {
		if (!state.inited) {
			(Array.isArray(env.vpkLabQueue) ? env.vpkLabQueue : (env.vpkLabQueue = [])).push([id, def]);
			return null;
		}
		if (state.labs.has(id)) return state.labs.get(id);
		try {
			const api = lab(id, def, { env, tokens: state.tokens });
			if (api) state.labs.set(id, api);
			return api;
		} catch (error) {
			env.console?.error?.(error);
			return null;
		}
	};
	const filmApi = target => {
		if (target == null) return state.films.values().next().value ?? null;
		const id = typeof target === "string" ? target : target.id;
		return state.films.get(id) ?? null;
	};
	const api = Object.freeze({
		version: "1", get ready() { labDrawThumbs(state); return ready; },
		clamp, lerp, progress, smooth, cubicBezier, EASE, spring, springStats, mulberry32, hash01, keyframes, fixed, signed,
		get tokens() { return state.tokens ?? readTokens(env); },
		resolveColor: css => resolveColor(css, env), alpha: (color, a) => alpha(color, a, env), mix: (a, b, t) => mix(a, b, t, env),
		swatches: selector => swatches(selector, env), onTheme: fn => onTheme(fn, env),
		get loop() { return getLoop(env); },
		makeLoop: (element, step, options) => makeLoop(element, step, { loop: getLoop(env), ...options }),
		reducedMotion: () => reducedMotion(env),
		setupCanvas: canvas => setupCanvas(canvas, env), roundRect,
		lab: (id, def) => state.define(id, def), film: filmApi, clockAt, filmFromClock,
		inspect: () => ({ labs: [...state.labs.keys()], films: [...state.films.keys()], inited: state.inited }),
	});
	env.vpkLab = api;
	const boot = () => {
		try {
			labInit(env, state).ready.then(settle, () => settle(false));
		} catch (error) {
			env.console?.error?.(error);
			settle(false);
		}
	};
	if (env.document.readyState === "loading") env.document.addEventListener("DOMContentLoaded", boot, { once: true });
	else env.queueMicrotask(boot);
	return api;
}
