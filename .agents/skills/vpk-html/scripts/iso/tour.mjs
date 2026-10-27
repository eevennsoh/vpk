// iso/tour — the camera tour (illustrations.md § Camera tour): a brief's ordered `tour.steps`, each framing a few parts. Build
// side only: validation (schema.mjs runs validateTour on the expanded brief) and the stage's tour model (emit.mjs writes it as
// data-vpk-iso-tour). The browser half is tour-runtime.mjs (import-free, inlined); it eases the SVG viewBox over
// ENTRY.STEP_CAMERA_MS to frame a step, accents its parts and fades its title in over ENTRY.TITLE_FADE_MS.
//
//   "tour": { "overview"?: "text shown at step 0", "steps": [{ "title": "Balance", "text": "…", "parts": ["balance", …], "pad"?: 24 }] }
//
// Step 0 is the implicit Overview: the whole figure, the static art. Steps are 1-based in the counter ("2 / 5").

// The default room (viewBox units) around a step's parts when the camera frames them.
export const TOUR_PAD = 24;

const isNum = value => typeof value === "number" && Number.isFinite(value);
const text = value => typeof value === "string" && value.trim().length > 0;

// Errors go to push; `known` is the set of (expanded) part ids.
export function validateTour(tour, known, push) {
	if (tour === undefined || tour === null) return;
	if (typeof tour !== "object" || Array.isArray(tour)) return push("tour must be an object { overview?, steps }");
	if (tour.overview !== undefined && !text(tour.overview)) push("tour.overview must be a non-empty string");
	for (const key of Object.keys(tour)) if (!["overview", "steps"].includes(key)) push(`tour.${key} is not a tour field (overview, steps)`);
	if (!Array.isArray(tour.steps) || !tour.steps.length) return push("tour.steps must be a non-empty list of { title, text, parts, pad? }");
	tour.steps.forEach((step, index) => {
		const at = `tour.steps[${index}]`;
		if (!step || typeof step !== "object" || Array.isArray(step)) return push(`${at} must be an object`);
		if (!text(step.title)) push(`${at}.title must be a non-empty string`);
		if (!text(step.text)) push(`${at}.text must be a non-empty string`);
		if (!Array.isArray(step.parts) || !step.parts.length) push(`${at}.parts must be a non-empty list of part ids`);
		else {
			for (const id of step.parts) if (!known.has(id)) push(`${at}.parts names unknown part ${JSON.stringify(id)}`);
			for (const id of new Set(step.parts.filter((id, k) => step.parts.indexOf(id) !== k))) push(`${at}.parts lists "${id}" more than once`);
		}
		if (step.pad !== undefined && !(isNum(step.pad) && step.pad >= 0)) push(`${at}.pad must be a number ≥ 0 (viewBox units)`);
		for (const key of Object.keys(step)) if (!["title", "text", "parts", "pad"].includes(key)) push(`${at}.${key} is not a step field (title, text, parts, pad)`);
	});
}

// The Overview's text when the brief gives none.
export const overviewText = tour => tour.overview ?? `${tour.steps.length} steps. Press Next step to begin.`;

// The stage's tour model (compact keys, one JSON attribute like data-vpk-iso-states): o the overview text, s the steps, each
// t title, x text, p part ids (expanded: a repeat's base id names every instance), d the frame pad.
export function tourConfig(tour) {
	if (!tour) return null;
	return { o: overviewText(tour), s: tour.steps.map(step => ({ t: step.title, x: step.text, p: step.parts, d: step.pad ?? TOUR_PAD })) };
}
