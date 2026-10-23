// vpk-lab runtime · widgets: the case-study controls around the labs (references/lab-kit.md, Widgets) and the
// narrowed lightbox fallback for documents whose enhancer predates [data-vpkh-no-lightbox] (integration K5). Every
// widget re-derives its state from the authored markup on init, so a serialised copy re-initialises cleanly.
import { labSetText } from "./frame.mjs";

const WIDGET_VISUALS = "img, svg, video, canvas";

/** Legacy enhancers (no data-vpkh-no-lightbox in their text) open a lightbox on visual clicks inside kit roots. Stop
 * only those clicks, bubbling, on each root; text, buttons and controls still propagate. → true when attached. */
export function legacyLightboxFallback(roots, env = globalThis) {
	const enhancer = env.document.querySelector("script[data-vpkh-enhance]");
	if (!enhancer || enhancer.textContent.includes("data-vpkh-no-lightbox")) return false;
	for (const root of roots) {
		root.addEventListener("click", event => {
			const visual = event.target?.closest?.(WIDGET_VISUALS);
			if (visual && root.contains(visual)) event.stopPropagation();
		});
	}
	return true;
}

/** [data-vpk-filters="<scope>"] buttons [data-vpk-filter="all|<kind>"] hide [data-vpk-filter-scope="<scope>"] items
 * whose data-kind differs (class vpk-is-filtered) and every [data-vpk-filter-group] left empty. */
export function wireFilters(group, env = globalThis) {
	const doc = env.document;
	const scope = group.getAttribute("data-vpk-filters");
	const buttons = [...group.querySelectorAll("[data-vpk-filter]")];
	const scopes = [...doc.querySelectorAll("[data-vpk-filter-scope]")].filter(node => node.getAttribute("data-vpk-filter-scope") === scope);
	const apply = kind => {
		buttons.forEach(button => button.setAttribute("aria-pressed", String(button.getAttribute("data-vpk-filter") === kind)));
		for (const box of scopes) {
			for (const item of box.querySelectorAll("[data-kind]")) {
				const hide = kind !== "all" && item.getAttribute("data-kind") !== kind;
				if (item.classList.contains("vpk-is-filtered") !== hide) item.classList.toggle("vpk-is-filtered", hide);
			}
			for (const holder of box.querySelectorAll("[data-vpk-filter-group]")) {
				const items = [...holder.querySelectorAll("[data-kind]")];
				const hide = items.length > 0 && items.every(item => item.classList.contains("vpk-is-filtered"));
				if (holder.classList.contains("vpk-is-filtered") !== hide) holder.classList.toggle("vpk-is-filtered", hide);
			}
		}
	};
	for (const button of buttons) button.addEventListener("click", () => apply(button.getAttribute("data-vpk-filter")));
	apply("all");
	return { scope, apply };
}

/** button[data-vpk-flip]: aria-pressed toggles, and aria-hidden swaps between [data-face="front"] and "back". */
export function wireFlip(button) {
	const set = flipped => {
		button.setAttribute("aria-pressed", String(flipped));
		button.querySelector("[data-face='front']")?.setAttribute("aria-hidden", String(flipped));
		button.querySelector("[data-face='back']")?.setAttribute("aria-hidden", String(!flipped));
	};
	button.addEventListener("click", () => set(button.getAttribute("aria-pressed") !== "true"));
	set(false);
	return { set };
}

/** [data-vpk-select="<name>"] buttons with data-index: single-select aria-pressed, .is-selected on the matching
 * [data-vpk-select-target="<name>"] [data-index], and the button's .vpk-select-title/.vpk-select-body text copied
 * into [data-vpk-select-detail="<name>"] (a data-vpk-review-ignore mirror). */
export function wireSelect(name, env = globalThis) {
	const doc = env.document;
	const named = selector => [...doc.querySelectorAll(selector)].filter(node => node.getAttribute(selector.slice(1, selector.indexOf("]"))) === name);
	const buttons = named("[data-vpk-select]");
	const targets = named("[data-vpk-select-target]");
	const details = named("[data-vpk-select-detail]");
	const choose = index => {
		const chosen = buttons.find(button => button.getAttribute("data-index") === String(index)) ?? buttons[0];
		if (!chosen) return;
		for (const button of buttons) button.setAttribute("aria-pressed", String(button === chosen));
		for (const target of targets) {
			for (const item of target.querySelectorAll("[data-index]")) {
				const on = item.getAttribute("data-index") === chosen.getAttribute("data-index");
				if (item.classList.contains("is-selected") !== on) item.classList.toggle("is-selected", on);
			}
		}
		for (const detail of details) {
			for (const part of ["title", "body"]) labSetText(detail.querySelector(`.vpk-select-${part}`), chosen.querySelector(`.vpk-select-${part}`)?.textContent.trim() ?? "");
		}
	};
	for (const button of buttons) button.addEventListener("click", () => choose(button.getAttribute("data-index")));
	const authored = buttons.find(button => button.getAttribute("aria-pressed") === "true") ?? buttons[0];
	if (authored) choose(authored.getAttribute("data-index"));
	return { name, choose };
}
