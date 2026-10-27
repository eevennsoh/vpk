// hairline/runtime/paint — paints the iso kit's tone map and cast shadows onto a mounted hairline figure (illustrations.md § 4),
// with the figure's code untouched. runtime/iso.mjs remembers each closed path poly() writes, with the tagged points it came
// from; a MutationObserver on the host sees every `d` the figure sets (or every path it adds) and, for a filled one, looks its
// closed subpaths up and asks runtime/faces.mjs for their faces:
//   one flat face          the path itself takes data-hl-tone (t | l | r), so its own fill and stroke carry it;
//   no solid               a closed outline whose points make no solid (a tube or blob drawn in screen space, the dish's
//                          bowl) takes data-hl-tone="c", the kit's tube body: tone 1, and the full accent when active;
//   anything else          a g[data-hl-faces] right after the path: the near and far side bands, then an edge path that
//                          redraws the path's outline, the visible cap's outline and the corner lines over them.
// Every filled path with world points also casts a flat shadow: the hull of its points pushed along SHADOW's light onto the
// figure's ground (the lowest point it has drawn), one path in g[data-hl-shadows], the svg's first child, so every shadow is
// painted before every part, and rewritten whenever the path's `d` changes, so shadows follow moving parts. CSS (hairline/
// inline.mjs) paints the tones, the accent faces on an active (.hi) part, and the shadow fill; nothing here sets a colour.
import { hull } from "../vendor/packages/hairline/src/core/iso.ts";
import { facesOf, shadowPoints } from "./faces.mjs";

const NS = "http://www.w3.org/2000/svg";
const known = new Map();
let sweep = 0;

/** Remembers the points a closed path string was written from (runtime/iso.mjs poly()), until the observers have read them:
 *  they run as microtasks after the frame that wrote the path, and the sweep is a task after that. */
export function remember(d, pts) {
	if (pts.length < 3 || !pts[0]?.w) return;
	known.set(d, pts);
	if (!sweep && typeof setTimeout === "function") sweep = setTimeout(() => { known.clear(); sweep = 0; });
}

/** The points remembered for a path string, if not yet swept. */
export const recalled = d => known.get(d);

const r2 = n => Math.round(n * 100) / 100;
const polyD = pts => (pts.length > 2 ? `M${pts.map(p => `${r2(p[0])} ${r2(p[1])}`).join("L")}Z` : "");
const lineD = ([a, b]) => `M${r2(a[0])} ${r2(a[1])}L${r2(b[0])} ${r2(b[1])}`;

const isOurs = node => node.nodeType === 1 && (node.hasAttribute("data-hl-faces") || node.hasAttribute("data-hl-shadows") || node.hasAttribute("data-hl-shadow"));
const filled = el => el.localName === "path" && !el.classList.contains("nf") && !el.closest(".ghost, [data-hl-faces], [data-hl-shadows], defs, mask");

function make(tag, attrs, parent) {
	const el = document.createElementNS(NS, tag);
	for (const key in attrs) el.setAttribute(key, attrs[key]);
	if (parent) parent.appendChild(el);
	return el;
}

/** Paints one host's svg from now on. Returns the disconnect. */
export function paintHost(host) {
	const state = new Map(); // path → { faces: g | null, shadow: path | null, world: [] | null }
	let ground = Infinity, shadows = null;

	const shadowLayer = svg => {
		if (!shadows || shadows.ownerSVGElement !== svg) shadows = make("g", { "data-hl-shadows": "", "aria-hidden": "true" });
		if (svg.firstChild !== shadows) svg.insertBefore(shadows, svg.firstChild);
		return shadows;
	};

	function cast(el, s) {
		const svg = el.ownerSVGElement;
		if (!s.world || !svg || el.closest('[visibility="hidden"]') || !el.getAttribute("d")) {
			s.shadow?.setAttribute("d", "");
			return;
		}
		if (!s.shadow) s.shadow = make("path", { "data-hl-shadow": "" }, shadowLayer(svg));
		else shadowLayer(svg);
		s.shadow.setAttribute("d", polyD(hull(s.world.flatMap(w => shadowPoints(w.pts, w.P, w.P.view, ground)))));
	}

	function paint(el) {
		let s = state.get(el);
		if (!s) state.set(el, (s = { faces: null, shadow: null, world: null }));
		const d = el.getAttribute("d") ?? "";
		const found = (d.match(/M[^M]*Z/g) ?? []).map(sub => known.get(sub)).filter(Boolean);
		const each = found.map(pts => ({ pts, P: pts[0].p, f: facesOf(pts, pts.src ?? null, pts[0].p, pts[0].p.view) })).filter(x => x.f && x.P);
		s.world = each.length ? each.map(x => ({ pts: x.f.world, P: x.P })) : null;
		for (const x of each) for (const [, , z] of x.f.world) if (z < ground) ground = z;
		const tones = new Set(each.map(x => x.f.tone));
		if (each.length && tones.size === 1 && !tones.has(undefined)) {
			el.setAttribute("data-hl-tone", each[0].f.tone);
			s.faces?.setAttribute("hidden", "");
			return s;
		}
		el.removeAttribute("data-hl-tone");
		const sides = { l: [], r: [] }, edges = [];
		for (const { f, pts } of each) {
			if (f.tone) {
				if (f.tone !== "t") sides[f.tone].push(polyD(pts));
				continue;
			}
			for (const k of ["l", "r"]) for (const p of f[k] ?? []) sides[k].push(polyD(p));
			if (f.cap) edges.push(polyD(f.cap));
			for (const line of f.lines ?? []) edges.push(lineD(line));
		}
		if (!sides.l.length && !sides.r.length) {
			// a closed outline with no solid behind it (a tube or blob drawn in screen space, a curved hull): the kit's tube body
			if (!each.some(x => x.f.tone || x.f.cap) && /Z/i.test(d)) el.setAttribute("data-hl-tone", "c");
			s.faces?.setAttribute("hidden", "");
			return s;
		}
		if (!s.faces) {
			s.faces = make("g", { "data-hl-faces": "" });
			make("path", { "data-hl-side": "l" }, s.faces);
			make("path", { "data-hl-side": "r" }, s.faces);
			make("path", { "data-hl-edge": "", class: `nf ${[...el.classList].filter(c => c === "sil" || c === "lo").join(" ")}`.trim() }, s.faces);
		}
		s.faces.removeAttribute("hidden");
		if (el.nextSibling !== s.faces) el.after(s.faces);
		const [l, r, edge] = s.faces.children;
		l.setAttribute("d", sides.l.join(""));
		r.setAttribute("d", sides.r.join(""));
		edge.setAttribute("d", (el.classList.contains("fo") ? "" : d) + edges.join(""));
		return s;
	}

	const visit = (node, out) => {
		if (node.nodeType !== 1 || isOurs(node)) return;
		if (filled(node)) out.add(node);
		for (const child of node.children) visit(child, out);
	};

	const observer = new MutationObserver(records => {
		const dirty = new Set();
		let hidden = false;
		for (const rec of records) {
			if (rec.type === "childList") {
				for (const node of rec.addedNodes) visit(node, dirty);
				for (const node of rec.removedNodes) {
					if (node.nodeType !== 1 || isOurs(node)) continue;
					for (const [el, s] of state) if (!el.isConnected) { s.shadow?.remove(); s.faces?.remove(); state.delete(el); }
				}
			} else if (rec.attributeName === "visibility") hidden = true;
			else if (!isOurs(rec.target) && filled(rec.target)) dirty.add(rec.target);
		}
		const lowBefore = ground;
		const painted = [...dirty].map(el => [el, paint(el)]);
		// a part moved by the figure keeps its bands right after it
		for (const [el, s] of state) if (s.faces && !s.faces.hasAttribute("hidden") && el.nextSibling !== s.faces && el.isConnected) el.after(s.faces);
		if (ground < lowBefore || hidden) for (const [el, s] of state) cast(el, s);
		else for (const [el, s] of painted) cast(el, s);
		observer.takeRecords();
	});
	observer.observe(host, { subtree: true, childList: true, attributes: true, attributeFilter: ["d", "visibility"] });
	return () => observer.disconnect();
}
