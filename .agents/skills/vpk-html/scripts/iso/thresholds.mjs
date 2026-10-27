// iso/thresholds — the iso kit's numeric limits, read once from references/checks-thresholds.json → "iso" (illustrations.md
// § Rules). scene.mjs (part and label caps), manual-scene.mjs (marks), audit.mjs (A2, A17) and
// manual-audit.mjs (A19) import them from here, so the limits live in one file. Node only: the browser runtime never imports it.
// A key missing from the JSON falls back to the default below (no limit), so a trimmed thresholds file still loads; a key set
// to null switches that limit off. The JSON comes in
// through the module loader (an import attribute), never fs.readFileSync, so importing the iso runtime registry still reads
// no file at import time (R28; thresholds.test.mjs).

import CHECKS_THRESHOLDS from "../../references/checks-thresholds.json" with { type: "json" };

export const ISO_THRESHOLD_DEFAULTS = Object.freeze({
	// Parts after expansion: above partsWarn the build warns, above partsMax the brief fails validation.
	partsWarn: Infinity,
	partsMax: Infinity,
	// A17: one figure's SVG warns above svgWarnBytes and fails above svgFailBytes.
	svgWarnBytes: Infinity,
	svgFailBytes: Infinity,
	// A2: distinct face fills (top, light, dark, pale, accent, ink, recess, glow; patterns and gradients count once).
	fillsMax: Infinity,
	// R7/A7: leader labels on one figure.
	labelsMax: Infinity,
	// Numbered marks on one figure.
	marksMax: Infinity,
	// A19: drawn detail segments, per part (warn, fail) and per figure (fail).
	detailSegmentsWarn: Infinity,
	detailSegmentsFail: Infinity,
	detailSegmentsFigureFail: Infinity,
});

// `json` is the parsed checks-thresholds.json (or a test double); its "iso" block overrides the defaults key by key.
export function loadIsoThresholds(json = CHECKS_THRESHOLDS) {
	const iso = json && typeof json.iso === "object" && json.iso ? json.iso : {};
	const out = {};
	// null means no limit (Infinity), so a check reading the key never fires.
	for (const [key, fallback] of Object.entries(ISO_THRESHOLD_DEFAULTS)) out[key] = iso[key] === null ? Infinity : Number.isFinite(iso[key]) ? iso[key] : fallback;
	return Object.freeze(out);
}

export const ISO_THRESHOLDS = loadIsoThresholds();
