// Anatomy hero builder (ws4b spec sections 4.7, 4.8 and 6.2; integration K11, K12, K15, R20).
//
// A hero module (`<artifact>/_figures/<id>.hero.mjs`) exports `hero`, `data`, a pure `model(input, data)`,
// a pure `present(state, data)`, `build(kit, { state, data })`, an optional `live(ctx)` and `auditOptions`.
// buildHero() draws the rest pose from model(rest), settles painter's order with the vendored audit, checks
// the markup and the live source against the vpk grammar, and returns one region that is an atomic ws1 block.
// The output is byte-deterministic: no time, no randomness, stable key order.
import vm from "node:vm";
import * as A from "./vendor/kit/audit.mjs";
import * as k from "./vendor/kit/iso-kit.mjs";
import * as G from "./vendor/kit/lathe.mjs";
import * as T from "./vendor/kit/tube.mjs";
import { collectColorTokenIssues } from "../check-html.mjs";
import { FIGURE_CAMERA, cameraAttr } from "../figures/camera.mjs";
import { RED_GREEN_BLUE, STYLE_FILTER, STYLE_PRINT_RESET, styleAttributeValues } from "../figures/check-figures.mjs";
import { serializeJsonIsland } from "../json-island.mjs";

export const HERO_ID = /^[a-z][a-z0-9-]{0,39}$/;
export const TIERS = Object.freeze({ figure: [40, 80], hero: [80, 150] });
export const ROLES = Object.freeze(["slider", "group", "img"]);
export const HERO_LIMITS = Object.freeze({ heroWarnBytes: 300000, liveWarnBytes: 30000 });
// Idle-tour timings in seconds when `stage.tour` leaves them out (spec section 6.3; R33).
export const TOUR_DEFAULTS = Object.freeze({ dwell: 2.2, delay: 1.4, resume: 3.6 });
const CARRIED_ATTRIBUTES = /\s(data-vpk-id|data-vpk-revision)=("[^"]*"|'[^']*')/g;

const escapeAttr = text => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const bytes = text => Buffer.byteLength(text ?? "", "utf8");
const trim = value => Number(value.toFixed(4));

// The kit a hero module's build() receives: the vendored modules plus vpk-safe wrappers.
export function createKit() {
	const faded = (list, style) => k.fadedSvg(list, style).replace(/<g opacity="/g, "<g stroke-opacity=\"");
	return Object.freeze({
		k, G, T, A,
		camera: Object.freeze({
			AZIMUTH: FIGURE_CAMERA.azimuth,
			ELEVATION: FIGURE_CAMERA.elevation,
			fit: (points, width, height, options = {}) => k.fitProjection(points, width, height, { ...options, azimuth: FIGURE_CAMERA.azimuth, elevation: FIGURE_CAMERA.elevation }),
		}),
		S: (paths, style = {}) => k.solidSvg(paths, { ...style, halo: false }),
		L: (d, style) => k.lineSvg(d, style),
		D: (points, style) => k.dotsSvg(points, style),
		fadedSvg: faded,
		faceTextSvg: k.faceTextSvg,
		fadeLineSvg() {
			throw new Error("fadeLineSvg uses a gradient; use fadedSvg");
		},
	});
}

function fail(id, message) {
	throw new Error(`anatomy hero ${id ?? "?"}: ${message}`);
}

const JSON_KINDS = "plain objects, arrays, strings, finite numbers, booleans and null";
const childPath = (path, key) => (/^[A-Za-z_$][\w$]*$/.test(key) ? `${path}.${key}` : `${path}[${JSON.stringify(key)}]`);

// The build reads `data` as written and the page's live model reads it back from the JSON island, so `data`
// must survive JSON unchanged (spec section 0 item 7, section 6.2 step 1). Returns the first problem, or null.
// Shared references are allowed (they read the same after a round trip); cycles are not.
export function jsonSafetyIssue(value, path = "data", ancestors = new Set()) {
	switch (typeof value) {
		case "string":
		case "boolean":
			return null;
		case "number":
			if (!Number.isFinite(value)) return `${path} is ${value}, which JSON writes as null`;
			if (Object.is(value, -0)) return `${path} is -0, which JSON writes as 0`;
			return null;
		case "undefined":
			return `${path} is undefined, which JSON drops or writes as null`;
		case "function":
			return `${path} is a function, which JSON drops`;
		case "symbol":
			return `${path} is a symbol, which JSON drops`;
		case "bigint":
			return `${path} is a BigInt, which JSON cannot write`;
	}
	if (value === null) return null;
	if (ancestors.has(value)) return `${path} is a cycle`;
	const proto = Object.getPrototypeOf(value);
	const isArray = Array.isArray(value) && proto === Array.prototype;
	if (!isArray && proto !== Object.prototype && proto !== null) {
		const kind = typeof value.constructor === "function" && value.constructor.name ? value.constructor.name : "non-plain object";
		return `${path} is a ${kind}; use ${JSON_KINDS}`;
	}
	if (Object.getOwnPropertySymbols(value).length) return `${path} has symbol keys, which JSON drops`;
	const keys = Object.keys(value);
	if (isArray && keys.length !== value.length) return `${path} is an array with holes or extra properties, which JSON does not keep`;
	ancestors.add(value);
	try {
		for (const key of keys) {
			const issue = jsonSafetyIssue(value[key], isArray ? `${path}[${key}]` : childPath(path, key), ancestors);
			if (issue) return issue;
		}
	} finally {
		ancestors.delete(value);
	}
	return null;
}

const shown = value => (typeof value === "string" ? JSON.stringify(value) : typeof value === "bigint" ? `${value}n` : String(value));

// `stage.tour` is optional (null or omitted means no tour). When present it needs at least one stop, every stop a
// finite input in [min, max], and any timing it names a finite number of seconds: dwell > 0, delay and resume >= 0.
function validateTour(tour, { min, max }, id) {
	if (tour === undefined || tour === null) return;
	if (typeof tour !== "object" || Array.isArray(tour)) fail(id, `stage.tour must be an object { stops, dwell?, delay?, resume? } or null, got ${shown(tour)}`);
	if (!Array.isArray(tour.stops) || tour.stops.length === 0) fail(id, "stage.tour.stops must be a non-empty array of inputs; omit stage.tour for no tour");
	for (const stop of tour.stops) {
		if (!Number.isFinite(stop)) fail(id, `tour stop ${shown(stop)} is not a finite number`);
		if (!(stop >= min && stop <= max)) fail(id, `tour stop ${stop} is outside [${min}, ${max}]`);
	}
	for (const name of Object.keys(TOUR_DEFAULTS)) {
		const value = tour[name];
		if (value === undefined) continue;
		const floor = name === "dwell" ? "> 0" : "≥ 0";
		if (!Number.isFinite(value) || value < 0 || (name === "dwell" && value === 0)) fail(id, `stage.tour.${name} must be a finite number of seconds ${floor}, got ${shown(value)}`);
	}
}

// The slider's optional `input.bigStep` (default 5 steps) and `stage.pointer` (null or omitted: keys and tour only)
// reach the mount runtime as written, so a value it would misread fails the build: a string bigStep concatenates,
// a negative one reverses PageUp/PageDown, and a pointer without two distinct fractions maps the hover to NaN.
function validateSliderExtras(bigStep, pointer, id) {
	if (bigStep !== undefined && !(Number.isFinite(bigStep) && bigStep > 0)) fail(id, `input.bigStep must be a finite number > 0 (omit it for 5 steps), got ${shown(bigStep)}`);
	if (pointer === undefined || pointer === null) return;
	if (typeof pointer !== "object" || Array.isArray(pointer)) fail(id, `stage.pointer must be an object { axis, from, to } or null, got ${shown(pointer)}`);
	if (pointer.axis !== "x" && pointer.axis !== "y") fail(id, `stage.pointer.axis must be "x" or "y", got ${shown(pointer.axis)}`);
	for (const name of ["from", "to"]) {
		const value = pointer[name];
		if (!(Number.isFinite(value) && value >= 0 && value <= 1)) fail(id, `stage.pointer.${name} must be a fraction of the drawing in [0, 1], got ${shown(value)}`);
	}
	if (pointer.from === pointer.to) fail(id, `stage.pointer.from and stage.pointer.to must differ, both are ${pointer.from}`);
}

// The island tour carries every timing, so the mount runtime never reads an omitted field. The author's tour
// is spread first, so a tour that spells out every field keeps its key order and serializes unchanged.
export function islandTour(tour) {
	if (!tour) return null;
	const timings = Object.fromEntries(Object.entries(TOUR_DEFAULTS).map(([name, fallback]) => [name, tour[name] ?? fallback]));
	return { ...tour, ...timings };
}

export function validateHeroModule(mod) {
	const hero = mod?.hero;
	const id = hero?.id;
	if (!hero || typeof hero !== "object") fail(id, "the module must export `hero`");
	if (!HERO_ID.test(id ?? "")) fail(id, `id must match ${HERO_ID}`);
	const tier = hero.tier ?? "figure";
	if (!(tier in TIERS)) fail(id, `tier must be "figure" or "hero" (an Epic is never started), got ${JSON.stringify(tier)}`);
	if (!Number.isFinite(hero.width) || !Number.isFinite(hero.height)) fail(id, "width and height are required");
	if (typeof hero.label !== "string" || !hero.label.trim()) fail(id, "a non-empty label is required");
	for (const field of ["fig", "title", "caption"]) {
		if (typeof hero.plate?.[field] !== "string" || !hero.plate[field].trim()) fail(id, `plate.${field} is required`);
	}
	for (const name of ["model", "present", "build"]) if (typeof mod[name] !== "function") fail(id, `the module must export ${name}()`);
	const stage = hero.stage ?? {};
	if (!ROLES.includes(stage.role)) fail(id, `stage.role must be one of ${ROLES.join(", ")}`);
	if (typeof stage.label !== "string" || !stage.label.trim()) fail(id, "stage.label is required");
	if (stage.role === "slider") {
		const { min, max, step, rest } = stage.input ?? {};
		if (![min, max, step, rest].every(Number.isFinite)) fail(id, "a slider needs numeric input.min, max, step and rest");
		if (!(min < rest && rest <= max)) fail(id, "a slider needs input.min < rest ≤ max");
		if (!(step > 0)) fail(id, "input.step must be > 0");
		validateSliderExtras(stage.input.bigStep, stage.pointer, id);
		validateTour(stage.tour, { min, max }, id);
	}
	if (stage.role === "group" && typeof mod.live !== "function") fail(id, "a group stage needs live(ctx) to own its input");
	const dataIssue = jsonSafetyIssue(mod.data ?? {});
	if (dataIssue) fail(id, `data must be JSON-safe: ${dataIssue}`);
	return { hero, tier, stage };
}

function presentAt(mod, input, id) {
	const state = mod.model(input, mod.data ?? {});
	const presented = mod.present(state, mod.data ?? {});
	if (typeof presented?.readout !== "string" || !presented.readout) fail(id, `present(model(${input})).readout must be a non-empty string`);
	if (typeof presented?.valueText !== "string" || !presented.valueText) fail(id, `present(model(${input})).valueText must be a non-empty string`);
	return { state, presented };
}

// The inputs the build replays through the serialized model: the rest, and for a slider its ends, its tour stops
// and nine evenly spaced values (the page also calls the model between steps while the carriage moves).
function truthInputs(input, tour, restInput) {
	if (!input) return [restInput];
	const spaced = Array.from({ length: 9 }, (_, index) => input.min + ((input.max - input.min) * (index + 1)) / 10);
	return [...new Set([input.rest, input.min, input.max, ...(tour?.stops ?? []), ...spaced])];
}

// `model` and `present` reach the page as source text (section 4.7 "Serializable"), where module scope is gone.
// Revived in a context that holds only the standard built-ins, and fed `data` as the island returns it, they
// must give what the module's own functions gave, or the page's readout throws or differs from the stamped one.
function serializedTruthIssue(mod, inputs) {
	const data = mod.data ?? {};
	const islandData = JSON.parse(JSON.stringify(data));
	let page;
	try {
		page = vm.runInContext(`({ model: ${mod.model.toString()}, present: ${mod.present.toString()} })`, vm.createContext(Object.freeze(Object.create(null))));
	} catch (error) {
		return `model and present do not parse as serialized source (${error.message})`;
	}
	for (const input of inputs) {
		const state = mod.model(input, data);
		let pageState;
		try {
			pageState = page.model(input, islandData);
		} catch (error) {
			return `the serialized model throws at input ${input}: ${error.name}: ${error.message}`;
		}
		if (JSON.stringify(pageState) !== JSON.stringify(state)) return `the serialized model gives a different state at input ${input}`;
		let pagePresented;
		try {
			pagePresented = page.present(pageState, islandData);
		} catch (error) {
			return `the serialized present throws at input ${input}: ${error.name}: ${error.message}`;
		}
		if (JSON.stringify(pagePresented) !== JSON.stringify(mod.present(state, data))) return `the serialized present gives a different readout at input ${input}`;
	}
	return null;
}

// Each rule is a pattern or a predicate. The tone and style rules are check-html H3/H4's own patterns, so a
// single-quoted or unquoted attribute fails the build as it would fail check-html.
const MARKUP_RULES = [
	[/iso-halo/, "a halo (iso-halo); vpk figures carry no shadows or glow"],
	[/<(?:linearGradient|radialGradient)\b/i, "a gradient; use fadedSvg for faded lines"],
	[/<filter\b/i, "an SVG <filter>"],
	[/\sfilter\s*=/i, "a filter= attribute"],
	[markup => styleAttributeValues(markup).some(value => STYLE_FILTER.test(value)), "filter: inside a style attribute"],
	[/<canvas\b/i, "a <canvas>"],
	[RED_GREEN_BLUE, "a status hue tone (red, green or blue)"],
	[/\sopacity\s*=/i, "an opacity= attribute (print resets opacity; use fill-opacity or stroke-opacity)"],
	[markup => styleAttributeValues(markup).some(value => STYLE_PRINT_RESET.test(value)), "opacity: or transform: inside a style attribute (print resets both; build at rest and use fill-opacity or stroke-opacity)"],
];

// Throws on anything outside the grayscale, print-safe grammar (section 4.9 H3, H4).
export function sanitizeHeroMarkup(markup, id = "?") {
	for (const [rule, label] of MARKUP_RULES) if (typeof rule === "function" ? rule(markup) : rule.test(markup)) fail(id, `markup contains ${label}`);
	for (const match of markup.matchAll(/\stransform\s*=/gi)) {
		const tag = markup.slice(markup.lastIndexOf("<", match.index), match.index);
		if (!/^<text\b/i.test(tag) || !/class="iso-face-text"/.test(`${tag}${markup.slice(match.index, markup.indexOf(">", match.index))}`)) {
			fail(id, "markup contains a transform= at rest outside .iso-face-text; build moving parts at rest and move them by delta in live()");
		}
	}
	return markup;
}

const SCRIPT_RULES = [
	[/<\/script/i, "</script"],
	[/<svg/i, "<svg"],
	[/<button/i, "<button"],
	[/{{/, "{{ (reads as an unfilled placeholder)"],
	[/requestAnimationFrame/, "requestAnimationFrame (motion goes through ctx and the shared loop)"],
	[/IntersectionObserver/, "IntersectionObserver (the shared loop owns visibility)"],
	[/setInterval/, "setInterval"],
	[/document\.addEventListener/, "document.addEventListener (listen on ctx.stage)"],
];

// Throws on live source that would trip check-html or own a loop (section 4.9 H8, T9).
export function sanitizeHeroScript(script, id = "?") {
	for (const [pattern, label] of SCRIPT_RULES) if (pattern.test(script)) fail(id, `live script contains ${label}`);
	const colors = collectColorTokenIssues(script, "live script");
	if (colors.length) fail(id, `live script contains raw colour literals (${colors[0]})`);
	try {
		new Function(script);
	} catch (error) {
		fail(id, `live script does not parse: ${error.message}`);
	}
	return script;
}

function camera(P) {
	return [P.azimuth, P.elevation, P.scale, P.origin[0], P.origin[1]].map(trim).join(" ");
}

function stageMarkup(stage, svg, aria) {
	const attributes = [`class="iso-stage"`];
	if (stage.role !== "img") attributes.push(`tabindex="0"`);
	attributes.push(`role="${stage.role}"`, `aria-label="${escapeAttr(stage.label)}"`);
	if (aria) {
		for (const [name, value] of Object.entries(aria)) attributes.push(`${name}="${escapeAttr(value)}"`);
	}
	return `<div ${attributes.join(" ")}>${svg}</div>`;
}

// ws1 ids stamped on an existing root start tag, in their original order and quoting (R20).
export function carriedAttributes(previousRoot) {
	if (!previousRoot) return "";
	const tag = previousRoot.match(/^<[^>]*>/)?.[0] ?? previousRoot;
	return [...tag.matchAll(CARRIED_ATTRIBUTES)].map(match => match[0]).join("");
}

function liveScript(mod, id) {
	const source = fn => fn.toString();
	const fields = [`id: ${JSON.stringify(id)}`, `model: ${source(mod.model)}`, `present: ${source(mod.present)}`];
	if (typeof mod.live === "function") fields.push(`live: ${source(mod.live)}`);
	return `(self.vpkAnatomyQueue ??= []).push({ ${fields.join(", ")} });`;
}

export function heroMarkers(id, src) {
	const srcAttr = src ? ` src="${escapeAttr(src)}"` : "";
	return { start: `<!-- vpk-anatomy-hero:start id="${id}"${srcAttr} -->`, end: `<!-- vpk-anatomy-hero:end id="${id}" -->` };
}

export async function buildHero(mod, { audit = false, previousRoot = null, src = null } = {}) {
	const { hero, tier, stage } = validateHeroModule(mod);
	const { id } = hero;
	const data = mod.data ?? {};
	const input = stage.role === "slider" ? stage.input : null;
	const restInput = input ? input.rest : stage.input?.rest ?? 0;
	const { state, presented } = presentAt(mod, restInput, id);
	if (input) {
		presentAt(mod, input.min, id);
		presentAt(mod, input.max, id);
	}

	const built = mod.build(createKit(), { state, data });
	const { P, R } = built ?? {};
	if (!P || !Array.isArray(P.origin)) fail(id, "build() must return the projection P");
	if (!R || !Array.isArray(R.items) || R.items.length === 0) fail(id, "build() must return a recorder R with at least one item");
	const parts = R.items.filter(item => (item.shapes ?? []).some(shape => shape.kind !== "tube")).length;

	A.settle(R, P);
	R.items.sort((a, b) => a.key - b.key);
	const body = [...(built.before ?? []), ...R.items.map(item => item.svg ?? ""), ...(built.after ?? [])].join("");
	sanitizeHeroMarkup(body, id);

	const svg = k.figureSvg({ width: hero.width, height: hero.height, label: hero.label, body }).replace(/^<svg\b/, `<svg data-vpk-anatomy-camera="${camera(P)}"`);
	const aria = input
		? { "aria-valuemin": String(input.min), "aria-valuemax": String(input.max), "aria-valuenow": String(input.rest), "aria-valuetext": presented.valueText }
		: null;
	const plate = k.plateHtml({ ...hero.plate, readout: presented.readout, body: stageMarkup(stage, svg, aria) })
		.replace(/^<figure class="iso-figure">/, `<figure class="iso-figure" data-vpk-review-ignore>`);
	const control = { role: stage.role };
	if (input) Object.assign(control, { min: input.min, max: input.max, step: input.step, bigStep: input.bigStep ?? input.step * 5, rest: input.rest, pointer: stage.pointer ?? null, tour: islandTour(stage.tour) });
	const island = `<script type="application/json" data-vpk-anatomy-data>${serializeJsonIsland({ P, control, data })}</script>`;
	const script = stage.role === "img" && typeof mod.live !== "function" ? "" : sanitizeHeroScript(liveScript(mod, id), id);
	const truthIssue = script ? serializedTruthIssue(mod, truthInputs(input, stage.tour, restInput)) : null;
	if (truthIssue) fail(id, `${truthIssue}; model and present are serialized into the page, so they may read only their arguments, built-ins and their own locals, and must be pure`);

	const rootCamera = cameraAttr({ azimuth: P.azimuth, elevation: P.elevation });
	const root = `<div data-vpk-engine="anatomy-hero" data-vpk-figure="${id}" data-vpk-camera="${rootCamera}" data-vpk-anatomy-tier="${tier}" data-vpk-anatomy-parts="${parts}" data-vpk-block data-vpkh-no-lightbox${carriedAttributes(previousRoot)}>`;
	const markers = heroMarkers(id, src);
	const fragment = [
		markers.start,
		root,
		plate,
		island,
		"</div>",
		...(script ? [`<script data-vpk-anatomy-live="${id}">${script}</script>`] : []),
		markers.end,
	].join("\n");

	let auditResult = null;
	if (audit) {
		const started = performance.now();
		const result = A.audit(R, P, mod.auditOptions ?? {});
		auditResult = { failures: A.failures(result), report: A.report(result), ms: Math.round(performance.now() - started) };
	}

	const warnings = [];
	const [low, high] = TIERS[tier];
	if (parts < low) warnings.push(`anatomy hero ${id}: ${parts} parts is below the ${low}-part bar for the ${tier} tier`);
	if (parts > high) warnings.push(`anatomy hero ${id}: ${parts} parts is above the ${high}-part ${tier} tier`);
	const sizes = { region: bytes(fragment), svg: bytes(svg), script: bytes(script), data: bytes(island) };
	if (sizes.region > HERO_LIMITS.heroWarnBytes) warnings.push(`anatomy hero ${id}: region ${sizes.region} B exceeds ${HERO_LIMITS.heroWarnBytes} B`);
	if (sizes.script + sizes.data > HERO_LIMITS.liveWarnBytes) warnings.push(`anatomy hero ${id}: script and island ${sizes.script + sizes.data} B exceed ${HERO_LIMITS.liveWarnBytes} B`);
	if (P.azimuth !== FIGURE_CAMERA.azimuth || P.elevation !== FIGURE_CAMERA.elevation) warnings.push(`anatomy hero ${id}: camera ${P.azimuth} ${P.elevation} is not the shared 45 30`);

	return {
		id,
		tier,
		fragment,
		sizes,
		parts,
		solids: R.solids.length,
		items: R.items.length,
		camera: rootCamera,
		readout: presented.readout,
		valueText: presented.valueText,
		audit: auditResult,
		warnings,
	};
}
