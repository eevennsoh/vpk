/*! review/layout-audit: the layout-issues audit (ws1 M2, 4.18). Detectors adapted from lavish-axi
 * src/artifact-sdk.js and src/layout-warnings.js (MIT, (c) 2026 Kun Chen, see SKILL/LICENSE). */

/*
 * measureLayout is ONE self-contained function: every detector is nested inside it, so
 * gates.mjs can serialize it with toString() and run it in the page (the gates contract), and the
 * review runtime serializes it too. It returns string[] ("rule . target . 12px at 1280"), or the
 * finding objects when asObjects is true; layoutFindings(thresholds) is that runtime wrapper.
 *
 * Detectors (a trimmed port; the lavish viewport-unreachable-* rules and the sibling-chain
 * occlusion walk are dropped to keep the runtime inside its byte budget, P3 decision 21):
 *   page-horizontal-overflow  the page scrolls sideways because text or a control escapes the viewport
 *   clipped-text              text cut off by its own or an ancestor's clipping box
 *   clipped-control           a button, link or field cut off by a clipping ancestor
 *   overlapping-text          text almost wholly covered by an opaque surface drawn over it
 * Truncation that is intended (text-overflow: ellipsis, line clamp), scrollers, masked or clip-pathed
 * boxes, hidden and 1px (screen-reader-only) elements, svg, and the review UI are skipped. Passive
 * and read-only: it reads geometry only and never writes to the page.
 *
 * Thresholds (references/checks-thresholds.json "layout"): minOutsidePx, minOutsideRatio,
 * minOcclusionRatio, minOcclusionSamples, maxFindings.
 * Serialized module (ws1 4.6): export function declarations only, plain ASCII, no tags, no
 * colour literals.
 */

export function measureLayout(thresholds, asObjects) {
	const t = Object.assign({ minOutsidePx: 4, minOutsideRatio: 0.2, minOcclusionRatio: 0.9, minOcclusionSamples: 5, maxFindings: 20 }, thresholds || {});
	const win = window;
	const doc = document;
	const root = doc.documentElement;
	const vw = win.innerWidth || root.clientWidth || 0;
	const vh = win.innerHeight || 0;
	const material = Math.max(24, vw * 0.05);
	const ui = "[data-vpk-review-ui],[data-vpkh-no-layout],svg";
	const findings = [];
	const seen = new Set();
	const moving = new Set();
	try {
		for (const animation of doc.getAnimations ? doc.getAnimations() : []) if (animation.effect && animation.effect.target) moving.add(animation.effect.target);
	} catch {
		// No animation API: nothing is suppressed.
	}
	const cs = (node) => win.getComputedStyle(node);
	const num = (value) => Number.parseFloat(value) || 0;
	const clips = (value) => value === "hidden" || value === "clip";
	const control = (el) => el.matches("button,input:not([type=hidden]),select,textarea,a[href],summary,[role=button],[role=link]") && !el.matches("[disabled],[aria-disabled=true]");
	const masked = (s) => (s.maskImage || s.webkitMaskImage || "none") !== "none" || (s.clipPath || "none") !== "none";
	const cssPath = (el) => {
		const parts = [];
		for (let node = el; node && node.nodeType === 1 && parts.length < 4; node = node.parentElement) {
			if (node.id) {
				parts.unshift(node.tagName.toLowerCase() + "#" + node.id);
				break;
			}
			const same = node.parentElement ? [...node.parentElement.children].filter((x) => x.tagName === node.tagName) : [];
			parts.unshift(node.tagName.toLowerCase() + (same.length > 1 ? ":nth-of-type(" + (same.indexOf(node) + 1) + ")" : ""));
		}
		return parts.join(" > ");
	};
	// `node` is the offending box; `from` (default node) is where the nearest stamped block is looked up.
	const push = (rule, node, axis, overflowPx, from) => {
		const key = rule + cssPath(node) + axis;
		if (seen.has(key)) return;
		seen.add(key);
		const block = (from || node).closest("[data-vpk-id]");
		const id = block ? block.getAttribute("data-vpk-id") : null;
		findings.push({ rule, blockId: id, selector: id ? "[data-vpk-id=\"" + id + "\"]" : cssPath(node), axis, overflowPx: Math.round(overflowPx * 10) / 10, viewportWidth: Math.round(vw), viewportClass: vw <= 640 ? "mobile" : vw <= 1024 ? "compact" : "desktop" });
	};
	// How far rect r escapes box b on one axis (0 when it does not materially).
	const spill = (r, b, horizontal) => {
		const start = horizontal ? r.left : r.top;
		const end = horizontal ? r.right : r.bottom;
		const lo = horizontal ? b.left : b.top;
		const hi = horizontal ? b.right : b.bottom;
		const size = end - start;
		const out = Math.max(lo - start, end - hi, 0);
		const mid = start + size / 2;
		return size > 0 && out >= t.minOutsidePx && (mid < lo || mid > hi || out / size >= t.minOutsideRatio) ? out : 0;
	};
	// Rects of the element's own text nodes.
	const fragments = (el) => {
		const out = [];
		for (const node of el.childNodes) {
			if (node.nodeType !== 3 || !String(node.textContent).trim()) continue;
			const range = doc.createRange();
			range.selectNodeContents(node);
			out.push(...[...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0));
		}
		return out;
	};
	const elements = [...doc.body.querySelectorAll("*")].filter((el) => !el.closest(ui)).slice(0, 800);
	const pageOverflow = root.scrollWidth - vw;
	const failed = new Set();
	const targets = [];
	let sideways = false;
	for (const el of elements) {
		const rect = el.getBoundingClientRect();
		const style = cs(el);
		if (rect.width <= 2 || rect.height <= 2 || style.visibility === "hidden" || num(style.opacity) <= 0.01 || moving.has(el) || el.closest("details:not([open]) > :not(summary)")) continue;
		const isControl = control(el);
		const rects = isControl ? [rect] : fragments(el);
		if (!rects.length) continue;
		let scrolls = false;
		let best = null;
		let truncated = false;
		for (let node = el; node && node !== doc.body && node !== root; node = node.parentElement) {
			const s = cs(node);
			if (s.overflowX === "auto" || s.overflowX === "scroll") scrolls = true;
			if (s.textOverflow === "ellipsis" || num(s.webkitLineClamp) > 0) truncated = true;
			const ax = [clips(s.overflowX), clips(s.overflowY)];
			if (!(ax[0] || ax[1]) || masked(s)) continue;
			const box = node.getBoundingClientRect();
			const edge = { left: box.left + num(s.borderLeftWidth), right: box.right - num(s.borderRightWidth), top: box.top + num(s.borderTopWidth), bottom: box.bottom - num(s.borderBottomWidth) };
			for (const r of rects) {
				for (let i = 0; i < 2; i++) {
					const out = ax[i] ? spill(r, edge, i === 0) : 0;
					if (out && (!best || out > best.px)) best = { node, px: out, axis: i ? "vertical" : "horizontal" };
				}
			}
		}
		if (pageOverflow >= material && !sideways && !scrolls && (isControl || !["absolute", "fixed", "sticky"].includes(style.position)) && rects.some((r) => r.right - vw >= material)) sideways = true;
		if (best && !(truncated && !isControl) && ![...failed].some((node) => node.contains(best.node))) {
			failed.add(best.node);
			push(isControl ? "clipped-control" : "clipped-text", best.node, best.axis, best.px, el);
		}
		if (!isControl && style.position === "static" && rects.length && String(el.textContent).trim().length >= 8) targets.push([el, rects]);
	}
	if (sideways) push("page-horizontal-overflow", root, "horizontal", pageOverflow);
	// Text almost wholly covered by an opaque surface that is not part of it.
	const opaque = (node) => {
		const s = cs(node);
		const parts = String(s.backgroundColor || "").match(/[\d.]+/g) || [];
		const alpha = parts.length === 0 ? 0 : parts.length > 3 ? Number(parts[3]) : 1;
		return alpha >= 0.95 && num(s.opacity) >= 0.95;
	};
	for (const [el, rects] of targets.slice(0, 200)) {
		let total = 0;
		let hidden = 0;
		for (const r of rects) {
			if (r.width * r.height < 16) continue;
			for (const fx of [0.2, 0.5, 0.8]) {
				for (const fy of [0.2, 0.5, 0.8]) {
					const x = r.left + r.width * fx;
					const y = r.top + r.height * fy;
					if (x < 0 || y < 0 || x > vw || y > vh) continue;
					total += 1;
					const top = doc.elementFromPoint(x, y);
					if (!top || el.contains(top) || top.contains(el) || top.closest(ui)) continue;
					for (let node = top; node && !node.contains(el); node = node.parentElement) {
						if (moving.has(node)) break;
						if (opaque(node)) {
							hidden += 1;
							break;
						}
					}
				}
			}
		}
		if (total >= t.minOcclusionSamples && hidden / total >= t.minOcclusionRatio) push("overlapping-text", el, "horizontal", 0);
	}
	const limited = findings.slice(0, Math.max(1, t.maxFindings));
	if (asObjects === true) return limited;
	const dot = " " + String.fromCharCode(183) + " ";
	return limited.map((item) => item.rule + dot + item.selector + dot + (item.overflowPx ? item.overflowPx + "px " : "") + "at " + item.viewportWidth);
}

// The runtime wrapper: the same audit, as finding objects (the Layout tab; ws1 4.18).
export function layoutFindings(thresholds) {
	return measureLayout(thresholds, true);
}
