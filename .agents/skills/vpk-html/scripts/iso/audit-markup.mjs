// iso/audit-markup — the tolerant tokenizer behind the static audit, and the element accessors both audit modules share
// (audit.mjs, manual-audit.mjs). Split out of audit.mjs (ws3-owned) so every iso module stays under the 500-line rule.

import { parsePolyPath } from "./core.mjs";

const TOKEN = /<!--[\s\S]*?-->|<(\/?)([A-Za-z][\w:.-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;
const ATTR = /([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+)))?/g;

export function parseAttrs(raw) {
	const attrs = new Map();
	for (const m of raw.matchAll(ATTR)) attrs.set(m[1], m[2] ?? m[3] ?? m[4] ?? "");
	return attrs;
}

// Tolerant tokenizer for kit SVG (and hand edits of it): elements in document order with parents.
export function parseMarkup(source) {
	const root = { name: "#root", attrs: new Map(), children: [], parent: null, text: "" };
	const all = [];
	let node = root;
	let last = 0;
	for (const m of source.matchAll(TOKEN)) {
		node.text += source.slice(last, m.index);
		last = m.index + m[0].length;
		if (m[0].startsWith("<!--")) continue;
		const [, close, name, raw, self] = m;
		if (close) {
			let open = node;
			while (open && open.name !== name) open = open.parent;
			if (open?.parent) node = open.parent;
			continue;
		}
		const el = { name, attrs: parseAttrs(raw), children: [], parent: node, index: all.length, text: "" };
		node.children.push(el);
		all.push(el);
		if (!self) node = el;
	}
	return { root, all };
}

export const attr = (el, name) => el.attrs.get(name);
export const has = (el, name) => el.attrs.has(name);
export const ancestor = (el, test) => {
	for (let n = el.parent; n; n = n.parent) if (test(n)) return n;
	return null;
};
export const partOf = el => ancestor(el, n => has(n, "data-vpk-iso-part"));
export const unitName = part => attr(part, "data-vpk-iso-of") || attr(part, "data-vpk-iso-part");
export const norm = value => String(value).trim().replace(/\s+/g, " ");
export const pointsOf = el => parsePolyPath(attr(el, "d")) ?? [];
