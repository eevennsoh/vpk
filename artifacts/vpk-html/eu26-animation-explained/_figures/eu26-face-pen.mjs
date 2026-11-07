// Face-detail pen: emits wireframe outlines in a surface's local plan units (0..w across, 0..d down the face).
// The live renderer maps the whole group onto the projected face with one matrix per frame, so nothing here
// carries a transform. Faces are containers only; motion data rides on data-anim attributes for the live renderer.
//
// Classes: dl hairline outline · df faint outline · dp pale panel (fill + hairline) · dw paper card (fill + hairline) ·
// ds sweep stroke (a ring's progress arc).

const n = value => Math.round(value * 100) / 100;
const more = extra => (extra ? ` ${extra}` : "");

export function pen(ox = 0, oy = 0, sx = 1, sy = sx, out = []) {
	const X = v => n(ox + v * sx), Y = v => n(oy + v * sy), W = v => n(v * sx), H = v => n(v * sy), F = v => n(v * Math.min(sx, sy));
	const p = {
		out,
		rect(x, y, w, h, r = 0, c = "dl", extra = "") {
			const rx = r ? ` rx="${F(Math.min(r, w / 2, h / 2))}"` : "";
			out.push(`<rect class="${c}" x="${X(x)}" y="${Y(y)}" width="${W(w)}" height="${H(h)}"${rx}${more(extra)}/>`);
			return p;
		},
		pill(x, y, w, h, c = "dl", extra = "") {
			return p.rect(x, y, w, h, h / 2, c, extra);
		},
		line(x1, y1, x2, y2, c = "dl") {
			out.push(`<path class="${c}" d="M${X(x1)} ${Y(y1)}L${X(x2)} ${Y(y2)}"/>`);
			return p;
		},
		poly(points, c = "dl", close = true, extra = "") {
			out.push(`<path class="${c}" d="M${points.map(([x, y]) => `${X(x)} ${Y(y)}`).join("L")}${close ? "Z" : ""}"${more(extra)}/>`);
			return p;
		},
		circle(cx, cy, r, c = "dl", extra = "") {
			if (Math.abs(sx - sy) < 1e-6) out.push(`<circle class="${c}" cx="${X(cx)}" cy="${Y(cy)}" r="${F(r)}"${more(extra)}/>`);
			else out.push(`<ellipse class="${c}" cx="${X(cx)}" cy="${Y(cy)}" rx="${W(r)}" ry="${H(r)}"${more(extra)}/>`);
			return p;
		},
		// An outlined ring: one path with both circles, so a donut reads as a single container.
		ring(cx, cy, r, inner, c = "dl") {
			const loop = radius => `M${X(cx - radius)} ${Y(cy)}A${W(radius)} ${H(radius)} 0 1 1 ${X(cx + radius)} ${Y(cy)}A${W(radius)} ${H(radius)} 0 1 1 ${X(cx - radius)} ${Y(cy)}Z`;
			out.push(`<path class="${c}" fill-rule="evenodd" d="${loop(r)}${loop(inner)}"/>`);
			return p;
		},
		// Outlined bars standing on a baseline: heights are fractions of h. Tagged so the live renderer can grow them.
		bars(x, y, w, h, heights, c = "dl", animate = false) {
			const step = w / heights.length, width = step * 0.62;
			heights.forEach((share, i) => p.rect(x + i * step + (step - width) / 2, y + h * (1 - share), width, h * share, Math.min(1.5, width / 4), c, animate ? `data-anim="bar" data-i="${i}"` : ""));
			return p;
		},
		// A group carrying motion data for the live renderer.
		open(extra) {
			out.push(`<g ${extra}>`);
			return p;
		},
		close() {
			out.push("</g>");
			return p;
		},
		// A point and a vertical length in the face's plan units, for motion parameters.
		at(x, y) {
			return [X(x), Y(y)];
		},
		height(h) {
			return H(h);
		},
		sub(x, y, s = 1, s2 = s) {
			return pen(ox + x * sx, oy + y * sy, sx * s, sy * s2, out);
		},
		markup() {
			return out.join("");
		},
	};
	return p;
}
