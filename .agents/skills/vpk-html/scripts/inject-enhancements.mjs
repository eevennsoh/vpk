#!/usr/bin/env node
/*
 * inject-enhancements — the shared artifact enhancement block (`vpkh-enhance`).
 *
 * The block (<style data-vpkh-enhance> + <script data-vpkh-enhance>) carries:
 *   - the artifact control-chrome palette shared by the pager, theme toggle, and lightbox;
 *   - theme-toggle overrides, including the CSS that hides .vpk-theme-toggle__label/__state
 *     so older pages show the icon-only 34px toggle;
 *   - scroll fades scoped to the active page container;
 *   - the figure lightbox with zoom and pan;
 *   - design-token overrides read from localStorage["vpkh-token-overrides"], written by the
 *     design pages' token editor.
 *
 * Markers: <!-- vpkh-enhance:begin --> … <!-- vpkh-enhance:end -->. The block is stripped and
 * re-appended before the last </body>, so runtime/pipeline.mjs applies it LAST, after every
 * other runtime step (a second move-to-end step would never reach a fixed point).
 *
 * Kinds that receive it: template, demo, index, and user artifacts. Diagram and illustration
 * primitives do not: they are copy sources whose <svg> blocks are pasted into documents that
 * already carry this chrome. Landing pages keep the shells landing.mjs emits.
 *
 * CLI (alias): `node .agents/skills/vpk-html/scripts/inject-enhancements.mjs [--check]` runs the
 * full library refresh, `build.mjs --refresh-library` (unsandboxed: it writes under .agents/skills/).
 */

import fs from "node:fs";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { inlineIcon } from "./icons.mjs";
import { moveMarkedBlockToBodyEnd } from "./runtime/blocks.mjs";

export const START = "<!-- vpkh-enhance:begin -->";
export const END = "<!-- vpkh-enhance:end -->";

// Inline @atlaskit glyphs baked in at build time (pure HTML — no React import).
const ICON_ZOOM_IN = inlineIcon("zoom-in");
const ICON_ZOOM_OUT = inlineIcon("zoom-out");

export const ENHANCEMENT_BLOCK = `${START}
<style data-vpkh-enhance>
/*
 * Artifact control chrome palette. Shared by the pager, theme toggle, and lightbox controls,
 * and mirrored by the host React toolbar. The aliases point to the artifact tokens so the
 * control layer follows light/dark theme changes without its own raw palette.
 */
:root {
	--vpk-control-surface: color-mix(in srgb, var(--surface-raised) 92%, transparent);
	--vpk-control-surface-hover: var(--accent-soft);
	--vpk-control-border: var(--rule);
	--vpk-control-text: var(--ink);
	--vpk-control-text-strong: var(--ink);
	--vpk-control-focus: var(--focus-ring);
}

/*
 * Theme toggle — icon-only circular control on the shared palette. Overrides the base rule from
 * shared.mjs (this block cascades later, so it wins) to avoid a full artifact rebuild.
 */
.vpk-theme-toggle {
	position: fixed;
	bottom: 18px;
	left: 18px;
	z-index: 60;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 0;
	width: 34px;
	height: 34px;
	padding: 0;
	border: 1px solid var(--vpk-control-border);
	border-radius: 999px;
	background: var(--vpk-control-surface);
	color: var(--vpk-control-text);
	box-shadow: none;
	cursor: pointer;
	-webkit-backdrop-filter: blur(10px);
	backdrop-filter: blur(10px);
}

.vpk-theme-toggle:hover,
.vpk-theme-toggle:focus-visible {
	background: var(--vpk-control-surface-hover);
	color: var(--vpk-control-text-strong);
	border-color: var(--vpk-control-border);
	outline: none;
}

.vpk-theme-toggle:focus-visible {
	outline: 2px solid var(--vpk-control-focus);
	outline-offset: 2px;
}

.vpk-theme-toggle svg {
	display: block;
}

.vpk-theme-toggle__label,
.vpk-theme-toggle__state {
	display: none;
}

.vpkh-scroll-fade {
	position: fixed;
	left: var(--vpkh-scroll-fade-left, 0);
	width: var(--vpkh-scroll-fade-width, 100vw);
	z-index: 2147483000;
	height: 72px;
	pointer-events: none;
	opacity: 0;
	transition: opacity var(--vpk-dur-fast, 140ms) var(--ease-out, ease);
}

.vpkh-scroll-fade[data-edge="top"] {
	top: 0;
}

.vpkh-scroll-fade[data-edge="bottom"] {
	bottom: 0;
}

/* Gentle paper wash on top of the blur so receding content stays legible under floating chrome. */
.vpkh-scroll-fade::after {
	content: "";
	position: absolute;
	inset: 0;
	pointer-events: none;
}

.vpkh-scroll-fade[data-edge="top"]::after {
	background: linear-gradient(to bottom, color-mix(in srgb, var(--paper-background, var(--paper)) 46%, transparent) 0%, transparent 72%);
}

.vpkh-scroll-fade[data-edge="bottom"]::after {
	background: linear-gradient(to top, color-mix(in srgb, var(--paper-background, var(--paper)) 46%, transparent) 0%, transparent 72%);
}

/*
 * Progressive (variable) blur: stacked backdrop-filter layers, each masked with a feathered
 * linear-gradient so the blur ramps up toward the edge instead of ending in a hard cutoff.
 * Layers compound where they overlap (strongest at the edge, zero at the inner boundary).
 */
.vpkh-scroll-fade__layer {
	position: absolute;
	inset: 0;
	pointer-events: none;
}

.vpkh-scroll-fade[data-edge="top"] .vpkh-scroll-fade__layer:nth-child(1) {
	-webkit-backdrop-filter: blur(0.5px);
	backdrop-filter: blur(0.5px);
	-webkit-mask-image: linear-gradient(to bottom, black 0%, black 68%, transparent 100%);
	mask-image: linear-gradient(to bottom, black 0%, black 68%, transparent 100%);
}

.vpkh-scroll-fade[data-edge="top"] .vpkh-scroll-fade__layer:nth-child(2) {
	-webkit-backdrop-filter: blur(1px);
	backdrop-filter: blur(1px);
	-webkit-mask-image: linear-gradient(to bottom, black 0%, black 52%, transparent 82%);
	mask-image: linear-gradient(to bottom, black 0%, black 52%, transparent 82%);
}

.vpkh-scroll-fade[data-edge="top"] .vpkh-scroll-fade__layer:nth-child(3) {
	-webkit-backdrop-filter: blur(2px);
	backdrop-filter: blur(2px);
	-webkit-mask-image: linear-gradient(to bottom, black 0%, black 38%, transparent 62%);
	mask-image: linear-gradient(to bottom, black 0%, black 38%, transparent 62%);
}

.vpkh-scroll-fade[data-edge="top"] .vpkh-scroll-fade__layer:nth-child(4) {
	-webkit-backdrop-filter: blur(3.5px);
	backdrop-filter: blur(3.5px);
	-webkit-mask-image: linear-gradient(to bottom, black 0%, black 24%, transparent 44%);
	mask-image: linear-gradient(to bottom, black 0%, black 24%, transparent 44%);
}

.vpkh-scroll-fade[data-edge="top"] .vpkh-scroll-fade__layer:nth-child(5) {
	-webkit-backdrop-filter: blur(6px);
	backdrop-filter: blur(6px);
	-webkit-mask-image: linear-gradient(to bottom, black 0%, black 10%, transparent 26%);
	mask-image: linear-gradient(to bottom, black 0%, black 10%, transparent 26%);
}

.vpkh-scroll-fade[data-edge="bottom"] .vpkh-scroll-fade__layer:nth-child(1) {
	-webkit-backdrop-filter: blur(0.5px);
	backdrop-filter: blur(0.5px);
	-webkit-mask-image: linear-gradient(to top, black 0%, black 68%, transparent 100%);
	mask-image: linear-gradient(to top, black 0%, black 68%, transparent 100%);
}

.vpkh-scroll-fade[data-edge="bottom"] .vpkh-scroll-fade__layer:nth-child(2) {
	-webkit-backdrop-filter: blur(1px);
	backdrop-filter: blur(1px);
	-webkit-mask-image: linear-gradient(to top, black 0%, black 52%, transparent 82%);
	mask-image: linear-gradient(to top, black 0%, black 52%, transparent 82%);
}

.vpkh-scroll-fade[data-edge="bottom"] .vpkh-scroll-fade__layer:nth-child(3) {
	-webkit-backdrop-filter: blur(2px);
	backdrop-filter: blur(2px);
	-webkit-mask-image: linear-gradient(to top, black 0%, black 38%, transparent 62%);
	mask-image: linear-gradient(to top, black 0%, black 38%, transparent 62%);
}

.vpkh-scroll-fade[data-edge="bottom"] .vpkh-scroll-fade__layer:nth-child(4) {
	-webkit-backdrop-filter: blur(3.5px);
	backdrop-filter: blur(3.5px);
	-webkit-mask-image: linear-gradient(to top, black 0%, black 24%, transparent 44%);
	mask-image: linear-gradient(to top, black 0%, black 24%, transparent 44%);
}

.vpkh-scroll-fade[data-edge="bottom"] .vpkh-scroll-fade__layer:nth-child(5) {
	-webkit-backdrop-filter: blur(6px);
	backdrop-filter: blur(6px);
	-webkit-mask-image: linear-gradient(to top, black 0%, black 10%, transparent 26%);
	mask-image: linear-gradient(to top, black 0%, black 10%, transparent 26%);
}

.vpkh-scroll-fade[data-visible="true"] {
	opacity: 1;
}

.vpkh-zoomable {
	cursor: zoom-in;
}

body.vpkh-lightbox-open {
	overflow: hidden;
}

.vpkh-lightbox {
	position: fixed;
	inset: 0;
	z-index: 2147483100;
	background: color-mix(in srgb, var(--ink) 72%, transparent);
	-webkit-backdrop-filter: blur(12px);
	backdrop-filter: blur(12px);
}

.vpkh-lightbox__stage {
	position: absolute;
	inset: 0;
	overflow: hidden;
	cursor: zoom-out;
	touch-action: none;
}

.vpkh-lightbox__stage.is-pannable {
	cursor: grab;
}

.vpkh-lightbox__stage.is-dragging {
	cursor: grabbing;
}

.vpkh-lightbox__visual {
	position: absolute;
	top: 50%;
	left: 50%;
	display: block;
	max-width: calc(100vw - 48px);
	max-height: calc(100vh - 112px);
	width: auto;
	height: auto;
	background: var(--paper);
	border: 1px solid var(--rule-strong);
	border-radius: 6px;
	box-shadow: var(--shadow);
	object-fit: contain;
	transform-origin: center center;
	user-select: none;
}

.vpkh-lightbox__visual:is(svg) {
	width: auto;
	height: auto;
}

.vpkh-lightbox__visual:is(video) {
	width: min(1120px, calc(100vw - 48px));
	height: auto;
}

.vpkh-lightbox__controls {
	position: absolute;
	right: 20px;
	bottom: 20px;
	display: flex;
	gap: 8px;
	z-index: 1;
}

.vpkh-lightbox__control {
	display: inline-grid;
	width: 42px;
	height: 42px;
	place-items: center;
	border: 1px solid var(--vpk-control-border);
	border-radius: 999px;
	background: var(--vpk-control-surface);
	color: var(--vpk-control-text);
	font: 600 12px/1 var(--font-mono, ui-monospace, monospace);
	box-shadow: none;
	cursor: pointer;
}

.vpkh-lightbox__control:hover {
	background: var(--vpk-control-surface-hover);
	color: var(--vpk-control-text-strong);
}

.vpkh-lightbox__control svg {
	display: block;
}

.vpkh-lightbox__control:focus-visible {
	outline: 2px solid var(--vpk-control-focus);
	outline-offset: 2px;
}

.vpkh-lightbox__status {
	position: absolute;
	left: 20px;
	bottom: 28px;
	color: var(--inverse-text, var(--paper));
	font: 600 12px/1 var(--font-mono, ui-monospace, monospace);
	letter-spacing: 0;
	pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
	.vpkh-scroll-fade,
	.vpkh-lightbox__control {
		transition: none !important;
	}
}

/*
 * Print: the fixed edge fades are screen chrome. In print they repeat on every page and clip real
 * content (an eyebrow, a one-pager's foot), so they never print. Amended at B2, decision 13.
 */
@media print {
	.vpkh-scroll-fade {
		display: none !important;
	}
}
</style>
<script data-vpkh-enhance>
(() => {
	const TOKEN_KEY = "vpkh-token-overrides";
	const root = document.documentElement;
	const appliedTokens = new Set();
	const visualSelector = "img, svg, video, canvas";
	const containerSelector = "figure, .chart-figure, .figure-frame, .frame, .diagram, .illustration, .visual, .media, .svg-frame";
	const optOutSelector = "[data-vpkh-no-lightbox]";
	const skipSelector = "a, button, input, select, textarea, summary, label, [role='button'], [contenteditable='true'], .vpkh-lightbox, " + optOutSelector;
	const scrollFades = new Map();
	let lightbox = null;
	let activeTrigger = null;

	function readTokenOverrides() {
		try {
			const parsed = JSON.parse(localStorage.getItem(TOKEN_KEY) || "{}");
			if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
			const clean = {};
			for (const [name, value] of Object.entries(parsed)) {
				if (/^--[\\w-]+$/.test(name) && typeof value === "string") clean[name] = value;
			}
			return clean;
		} catch {
			return {};
		}
	}

	function applyTokenOverrides(next) {
		for (const name of [...appliedTokens]) {
			if (Object.prototype.hasOwnProperty.call(next, name)) continue;
			root.style.removeProperty(name);
			appliedTokens.delete(name);
		}
		for (const [name, value] of Object.entries(next)) {
			root.style.setProperty(name, value);
			appliedTokens.add(name);
		}
	}

	applyTokenOverrides(readTokenOverrides());
	window.addEventListener("storage", event => {
		if (event.key === TOKEN_KEY) applyTokenOverrides(readTokenOverrides());
	});

	function createScrollFade(edge) {
		const node = document.createElement("div");
		node.className = "vpkh-scroll-fade";
		node.dataset.edge = edge;
		node.dataset.visible = "false";
		node.setAttribute("aria-hidden", "true");
		for (let i = 0; i < 5; i += 1) {
			const layer = document.createElement("div");
			layer.className = "vpkh-scroll-fade__layer";
			node.appendChild(layer);
		}
		document.body.appendChild(node);
		scrollFades.set(edge, node);
		return node;
	}

	function readScrollRegionCandidate(selector) {
		const candidate = document.querySelector(selector);
		if (!candidate) return null;
		const rect = candidate.getBoundingClientRect();
		const left = clamp(rect.left || 0, 0, window.innerWidth);
		const right = clamp(rect.right || window.innerWidth, left, window.innerWidth);
		const width = Math.max(0, right - left);
		if (width < 80) return null;
		return { left, width };
	}

	function documentScrollRegion() {
		const selectors = [".site-container", ".page", ".sheet", ".doc-page", ".document-page", ".post-content", ".site-column-main", "main", "body"];
		for (const selector of selectors) {
			const region = readScrollRegionCandidate(selector);
			if (region) return region;
		}
		return { left: 0, width: window.innerWidth };
	}

	function setStyleProperty(node, name, value) {
		if (node.style.getPropertyValue(name) !== value) node.style.setProperty(name, value);
	}

	function positionScrollFade(node, region) {
		setStyleProperty(node, "--vpkh-scroll-fade-left", Math.round(region.left) + "px");
		setStyleProperty(node, "--vpkh-scroll-fade-width", Math.round(region.width) + "px");
	}

	function setScrollFade(edge, visible, region) {
		const node = scrollFades.get(edge);
		if (!node) return;
		positionScrollFade(node, region);
		const next = visible ? "true" : "false";
		if (node.dataset.visible !== next) node.dataset.visible = next;
	}

	function updateScrollFades() {
		const doc = document.documentElement;
		const maxScroll = Math.max(0, doc.scrollHeight - window.innerHeight);
		const current = window.scrollY || doc.scrollTop || 0;
		const hasOverflow = maxScroll > 2;
		const region = documentScrollRegion();
		doc.classList.toggle("vpkh-has-scroll", hasOverflow);
		doc.classList.toggle("vpkh-show-top", hasOverflow && current > 2);
		doc.classList.toggle("vpkh-show-bottom", hasOverflow && current < maxScroll - 2);
		setScrollFade("top", hasOverflow && current > 2, region);
		setScrollFade("bottom", hasOverflow && current < maxScroll - 2, region);
	}

	let lastScrollFadeSignature = "";
	function pollScrollFades() {
		const doc = document.documentElement;
		const current = window.scrollY || doc.scrollTop || 0;
		const signature = [current, doc.scrollHeight, window.innerHeight, window.innerWidth].join(":");
		if (signature === lastScrollFadeSignature) return;
		lastScrollFadeSignature = signature;
		updateScrollFades();
	}

	let scrollFrame = 0;
	function scheduleScrollUpdate() {
		if (scrollFrame) return;
		scrollFrame = requestAnimationFrame(() => {
			scrollFrame = 0;
			updateScrollFades();
			refreshZoomables();
		});
	}

	function isSubstantial(node) {
		if (!node || node.closest(".vpkh-lightbox")) return false;
		const rect = node.getBoundingClientRect();
		if (!rect || rect.width < 160 || rect.height < 100) return false;
		return rect.width * rect.height >= 28000;
	}

	function findVisualFromContainer(node) {
		const visual = node.matches(visualSelector) ? node : node.querySelector(visualSelector);
		return visual && isSubstantial(visual) ? visual : null;
	}

	function refreshZoomables() {
		for (const node of document.querySelectorAll(".vpkh-zoomable")) {
			if (node.closest(optOutSelector) || !isSubstantial(findVisualFromContainer(node) || node)) node.classList.remove("vpkh-zoomable");
		}
		for (const node of document.querySelectorAll(visualSelector + ", " + containerSelector)) {
			if (node.classList.contains("vpkh-zoomable") || node.closest(".vpkh-lightbox, " + optOutSelector)) continue;
			if (findVisualFromContainer(node)) node.classList.add("vpkh-zoomable");
		}
	}

	function findTrigger(target) {
		if (!target || target.closest(skipSelector)) return null;
		const visual = target.closest(visualSelector);
		if (visual && isSubstantial(visual)) return visual;
		const container = target.closest(containerSelector);
		if (!container || container.closest(skipSelector)) return null;
		return findVisualFromContainer(container);
	}

	function cloneVisual(source) {
		const tag = source.tagName.toLowerCase();
		if (tag === "canvas") {
			const image = document.createElement("img");
			image.alt = source.getAttribute("aria-label") || "Canvas preview";
			try {
				image.src = source.toDataURL("image/png");
			} catch {
				image.alt = "Canvas preview unavailable";
			}
			return image;
		}
		const clone = source.cloneNode(true);
		if (tag === "video") {
			clone.controls = true;
			clone.autoplay = false;
			try { clone.currentTime = source.currentTime || 0; } catch { /* noop */ }
		}
		if (tag === "img" && !clone.alt) clone.alt = "Expanded visual";
		clone.removeAttribute("id");
		return clone;
	}

	function clamp(value, min, max) {
		return Math.min(max, Math.max(min, value));
	}

	function openLightbox(source) {
		if (lightbox) closeLightbox();
		activeTrigger = source;
		let scale = 1;
		let panX = 0;
		let panY = 0;
		let drag = null;
		let dragged = false;

		lightbox = document.createElement("div");
		lightbox.className = "vpkh-lightbox";
		lightbox.setAttribute("role", "dialog");
		lightbox.setAttribute("aria-modal", "true");
		lightbox.setAttribute("aria-label", "Expanded visual viewer");
		lightbox.tabIndex = -1;

		const stage = document.createElement("div");
		stage.className = "vpkh-lightbox__stage";

		const visual = cloneVisual(source);
		visual.classList.add("vpkh-lightbox__visual");
		visual.draggable = false;

		const controls = document.createElement("div");
		controls.className = "vpkh-lightbox__controls";

		const status = document.createElement("div");
		status.className = "vpkh-lightbox__status";

		function makeButton(label, html, action) {
			const button = document.createElement("button");
			button.type = "button";
			button.className = "vpkh-lightbox__control";
			button.setAttribute("aria-label", label);
			button.innerHTML = html;
			button.addEventListener("click", action);
			controls.appendChild(button);
			return button;
		}

		function render() {
			stage.classList.toggle("is-pannable", scale > 1);
			visual.style.transform = "translate(-50%, -50%) translate(" + panX + "px, " + panY + "px) scale(" + scale + ")";
			status.textContent = Math.round(scale * 100) + "%";
		}

		function setScale(next) {
			scale = clamp(next, 0.5, 6);
			if (scale <= 1) {
				panX = 0;
				panY = 0;
			}
			render();
		}

		makeButton("Reset zoom", "1:1", () => {
			scale = 1;
			panX = 0;
			panY = 0;
			render();
		});
		makeButton("Zoom in", ${JSON.stringify(ICON_ZOOM_IN)}, () => setScale(scale * 1.25));
		makeButton("Zoom out", ${JSON.stringify(ICON_ZOOM_OUT)}, () => setScale(scale / 1.25));

		stage.appendChild(visual);
		lightbox.appendChild(stage);
		lightbox.appendChild(controls);
		lightbox.appendChild(status);
		document.body.appendChild(lightbox);
		document.body.classList.add("vpkh-lightbox-open");
		render();
		lightbox.focus({ preventScroll: true });

		stage.addEventListener("wheel", event => {
			event.preventDefault();
			setScale(scale * (event.deltaY < 0 ? 1.25 : 0.8));
		}, { passive: false });

		stage.addEventListener("pointerdown", event => {
			if (event.button !== 0 || event.target.closest(".vpkh-lightbox__controls")) return;
			dragged = false;
			drag = {
				id: event.pointerId,
				x: event.clientX,
				y: event.clientY,
				panX,
				panY,
			};
			stage.classList.add("is-dragging");
			stage.setPointerCapture(event.pointerId);
		});

		stage.addEventListener("pointermove", event => {
			if (!drag || event.pointerId !== drag.id) return;
			const dx = event.clientX - drag.x;
			const dy = event.clientY - drag.y;
			if (Math.abs(dx) + Math.abs(dy) > 3) dragged = true;
			if (scale > 1) {
				panX = drag.panX + dx;
				panY = drag.panY + dy;
				render();
			}
		});

		stage.addEventListener("pointerup", event => {
			if (drag && event.pointerId === drag.id) {
				try { stage.releasePointerCapture(event.pointerId); } catch { /* noop */ }
				drag = null;
				stage.classList.remove("is-dragging");
			}
		});

		stage.addEventListener("click", event => {
			if (event.target === stage && !dragged) closeLightbox();
		});

		document.addEventListener("keydown", onLightboxKeydown, true);
	}

	function closeLightbox() {
		if (!lightbox) return;
		document.removeEventListener("keydown", onLightboxKeydown, true);
		lightbox.remove();
		lightbox = null;
		document.body.classList.remove("vpkh-lightbox-open");
		if (activeTrigger && typeof activeTrigger.focus === "function") {
			try { activeTrigger.focus({ preventScroll: true }); } catch { /* noop */ }
		}
		activeTrigger = null;
	}

	function focusableNodes() {
		if (!lightbox) return [];
		return [...lightbox.querySelectorAll("button, video, [href], [tabindex]:not([tabindex='-1'])")]
			.filter(node => !node.disabled && node.offsetParent !== null);
	}

	function onLightboxKeydown(event) {
		if (!lightbox) return;
		if (event.key === "Escape") {
			event.preventDefault();
			closeLightbox();
			return;
		}
		if (event.key !== "Tab") return;
		const nodes = focusableNodes();
		if (nodes.length === 0) {
			event.preventDefault();
			lightbox.focus({ preventScroll: true });
			return;
		}
		const first = nodes[0];
		const last = nodes[nodes.length - 1];
		if (event.shiftKey && document.activeElement === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault();
			first.focus();
		}
	}

	document.addEventListener("click", event => {
		const trigger = findTrigger(event.target);
		if (!trigger) return;
		event.preventDefault();
		openLightbox(trigger);
	});

	function init() {
		createScrollFade("top");
		createScrollFade("bottom");
		updateScrollFades();
		refreshZoomables();
		window.addEventListener("scroll", scheduleScrollUpdate, { passive: true, capture: true });
		document.addEventListener("scroll", scheduleScrollUpdate, { passive: true, capture: true });
		document.documentElement.addEventListener("scroll", scheduleScrollUpdate, { passive: true });
		window.addEventListener("resize", scheduleScrollUpdate, { passive: true });
		window.setInterval(pollScrollFades, 250);
		if ("ResizeObserver" in window) new ResizeObserver(scheduleScrollUpdate).observe(document.body);
		new MutationObserver(records => {
			if (records.some(record => !(record.target.nodeType === 1 ? record.target : record.target.parentElement)?.closest(optOutSelector))) scheduleScrollUpdate();
		}).observe(document.body, { childList: true, subtree: true, attributes: true });
	}

	if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
	else init();
})();
</script>
${END}`;

// Pure: strip any existing block and re-append the current one before the last </body>.
export function injectEnhancements(html, filePath) {
	return moveMarkedBlockToBodyEnd(html, { start: START, end: END, block: ENHANCEMENT_BLOCK, label: filePath });
}

// Alias CLI: refreshing the enhancement block is part of the full library refresh.
async function main() {
	const { runLibraryRefreshCli } = await import("./runtime/pipeline.mjs");
	process.exitCode = await runLibraryRefreshCli({ script: "inject-enhancements.mjs", argv: process.argv.slice(2) });
}

function isMainModule() {
	try {
		return Boolean(process.argv[1]) && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
	} catch {
		return false;
	}
}

// Not awaited: pipeline.mjs imports this module, so its evaluation must finish first.
if (isMainModule()) {
	main().catch(error => { console.error(error); process.exitCode = 1; });
}
