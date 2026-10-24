// iso/manual-runtime — the select blink (P5; illustrations.md § Style, rule 11). A select
// figure blinks a part once as it becomes active; the 2px ink outline is the .is-active CSS. The blink is the lift tween's
// progress (p.lv), so it needs no clock of its own and needs no `reduced` argument: reduced motion lands p.lv on 0 or 1.
// iso/inline.mjs inlines this file into the kit scope and runtime.mjs calls it as core.blink. Import-free, like runtime.mjs.

// The part's opacity in steps of 0.05, written only when it changes; at 1 the attribute is removed, so the rest art
// carries none (audit A11).
export function blink(p) {
	const o = Math.round((p.tw.to === 1 && p.lv < 1 ? 1 - 0.55 * Math.sin(Math.PI * p.lv) : 1) * 20) / 20;
	if (o === (p.op ?? 1)) return;
	p.op = o;
	if (o < 1) p.el.setAttribute("opacity", o);
	else p.el.removeAttribute("opacity");
}

// The narrow-stage tags' leaders (r1.7/r1.8): each g[data-vpk-iso-tag-for] holds one leader whose last point follows its target
// part, like a label's leader. runtime.mjs adds the returned lines to its list.
export function tagLines(parse, svg, parts, line) {
	const out = [];
	for (const g of svg.querySelectorAll("[data-vpk-iso-tag-for]")) {
		const el = g.querySelector("[data-vpk-iso-role=\"leader\"]");
		const name = g.getAttribute("data-vpk-iso-tag-for");
		const target = parts.find(p => p.id === name || p.name === name);
		const pts = el && parse(el.getAttribute("d"));
		if (pts && target) out.push(line(el, pts, false, pts.map((_, k) => (k === pts.length - 1 ? target : null))));
	}
	return out;
}
