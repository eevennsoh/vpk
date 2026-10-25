// hairline/runtime/marks — mounts a Marks figure (a hairline-create page's `hairline({ … })` spec) the way
// the package's mount.ts mounts its own: the stylesheet, the host attributes, the svg and the read-out. The
// figure's own number is the middle of its `range`, as the bench's slider at 0.5 gives it.
import { inject, mk } from "./kernel.mjs";

export function markFigure(spec) {
	return (el, options = {}) => {
		const root = el.getRootNode();
		inject(root.nodeType === 9 || "host" in root ? root : el.ownerDocument);
		el.setAttribute("data-hairline", spec.name);
		el.setAttribute("role", "img");
		if (!el.hasAttribute("aria-label")) el.setAttribute("aria-label", spec.means);
		const svg = mk("svg", { viewBox: "0 0 400 320", "aria-hidden": "true" }, el);
		let text = null;
		const read = {
			get textContent() {
				return text;
			},
			set textContent(value) {
				const next = value == null ? "" : String(value);
				if (next === text) return;
				text = next;
				if (typeof options.onRead === "function") options.onRead(next);
			},
		};
		const handle = spec.mount({ stage: el, svg, read }, spec.range[1]);
		if (text === null) read.textContent = "rest";
		return { update() {}, destroy: () => { handle.destroy(); svg.remove(); } };
	};
}
