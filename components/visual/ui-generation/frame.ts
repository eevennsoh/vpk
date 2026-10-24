import { OVERLAY_CLASS, MARGIN, pointAt, type Overlay, type Stroke } from "./overlay.ts";
import {
	PHASES,
	activePartIndex,
	clamp01,
	drawEase,
	fmt,
	lerp,
	revealEase,
	smooth,
	win,
} from "./timeline.ts";

/** How fast the dots flow along a drawn line, in px per ms. */
const FLOW = 0.016;
/** Keeps the element's own shadow inside the reveal clip. */
const SHADOW_PAD = 80;

/** The content's own inline styles, restored once the build is over. */
export interface ContentStyle {
	readonly opacity: string;
	readonly clipPath: string;
	readonly filter: string;
}

function setAttr(el: Element, name: string, value: string | number) {
	const next = String(value);
	if (el.getAttribute(name) !== next) el.setAttribute(name, next);
}

function drawStroke(s: Stroke, q: number, t: number) {
	const on = q > 0;
	s.el.style.opacity = on ? "1" : "0";
	const gap = s.gap / s.k;
	if (on) {
		// Lines are drawn as round dots that keep flowing along the line.
		const count = Math.floor((s.length * Math.min(1, q)) / gap) + 1;
		if (count !== s.dashCount) {
			s.dashCount = count;
			s.el.style.strokeDasharray = `${`0 ${fmt(gap)} `.repeat(count - 1)}0 ${fmt(s.length + 10)}`;
		}
		s.el.style.strokeDashoffset = fmt(-((t * FLOW) / s.k) % gap);
	}
	if (s.head) {
		s.live = q > 0 && q < 1;
		setAttr(s.head, "opacity", s.live ? 1 : 0);
		if (s.live) {
			s.point = pointAt(s, Math.floor((s.length * q) / gap) * gap);
			setAttr(s.head, "cx", fmt(s.point.x));
			setAttr(s.head, "cy", fmt(s.point.y));
		}
	}
	if (s.caps) {
		setAttr(s.caps[0], "opacity", on ? 1 : 0);
		setAttr(s.caps[1], "opacity", q >= 1 ? 1 : 0);
	}
}

function scaleAt(x: number, y: number, scale: number) {
	return `translate(${fmt(x)} ${fmt(y)}) scale(${fmt(scale)})`;
}

/**
 * The real UI: wiped in behind the scan line, fading and sharpening. Returns the scan line's y.
 *
 * Clip-path, blur and stroke-dash changes repaint every frame, unlike transform/opacity-only
 * motion. That is the effect itself, so it is a deliberate exception, kept bounded: one element
 * here, a capped dot field (`MAX_DOTS`) and at most `maxParts` traced parts, with no geometry reads.
 */
function drawReveal(G: Overlay, content: HTMLElement, p: number, t: number, rest: ContentStyle) {
	const { w, h } = G;
	const sq = revealEase(win(PHASES.reveal, p));
	const y = sq * (h + 6) - 3;
	const fq = revealEase(win([PHASES.reveal[0], PHASES.reveal[1] + 0.03], p));
	const style = content.style;
	style.opacity = p < PHASES.reveal[0] ? "0" : fmt(fq);
	// Past the bottom edge as the scan finishes, so the shadow below comes in with it.
	const yc = y + smooth(0.6, 1, sq) * SHADOW_PAD;
	style.clipPath =
		p >= PHASES.reveal[1] ? rest.clipPath : `inset(-${SHADOW_PAD}px -${SHADOW_PAD}px ${fmt(h - yc - 1)}px -${SHADOW_PAD}px)`;
	style.filter = fq > 0 && fq < 0.99 ? `blur(${fmt(3 * (1 - fq))}px)` : rest.filter;

	setAttr(G.clipRect, "y", fmt(p < PHASES.reveal[0] ? -999 : y));
	setAttr(G.clipRect, "height", fmt(h + 999));
	setAttr(G.wire, "opacity", fmt(1 - 0.6 * fq));
	const scanOn = p >= PHASES.reveal[0] && p < PHASES.reveal[1];
	setAttr(G.scan, "opacity", fmt(scanOn ? smooth(0, 0.12, sq) * (1 - smooth(0.85, 1, sq)) : 0));
	setAttr(G.scan, "transform", `translate(0 ${fmt(y)})`);
	G.scanLine.style.strokeDashoffset = fmt(-(t * FLOW * 2) % 5);
	return { y, width: w };
}

interface Reticle {
	readonly x: number;
	readonly y: number;
	readonly w: number;
	readonly h: number;
}

/** A targeting reticle that jumps from part to part, with its name and size. */
function drawReticle(G: Overlay, p: number): { box: Reticle | null; opacity: number } {
	const at = activePartIndex(G.parts, p);
	if (at < 0 || p >= PHASES.reveal[0] + 0.06) {
		setAttr(G.reticle, "opacity", 0);
		setAttr(G.tag, "opacity", 0);
		return { box: null, opacity: 0 };
	}
	const part = G.parts[at];
	const from = at ? G.parts[at - 1].b : { x: 0, y: 0, w: G.w, h: G.h };
	const q = drawEase((p - part.t0) / 0.05);
	const P = 5;
	const box = {
		x: lerp(from.x, part.b.x, q) - P,
		y: lerp(from.y, part.b.y, q) - P,
		w: lerp(from.w, part.b.w, q) + 2 * P,
		h: lerp(from.h, part.b.h, q) + 2 * P,
	};
	const opacity = smooth(PHASES.parts[0], PHASES.parts[0] + 0.04, p) * (1 - smooth(PHASES.reveal[0], PHASES.reveal[0] + 0.06, p));
	const l = Math.min(7, box.w / 3, box.h / 3);
	const { x: X, y: Y, w: W, h: H } = box;
	setAttr(
		G.reticle,
		"d",
		`M${fmt(X)} ${fmt(Y + l)}V${fmt(Y)}H${fmt(X + l)}M${fmt(X + W - l)} ${fmt(Y)}H${fmt(X + W)}V${fmt(Y + l)}M${fmt(X + W)} ${fmt(Y + H - l)}V${fmt(Y + H)}H${fmt(X + W - l)}M${fmt(X + l)} ${fmt(Y + H)}H${fmt(X)}V${fmt(Y + H - l)}`,
	);
	setAttr(G.tag, "x", fmt(X));
	setAttr(G.tag, "y", fmt(Y - 4));
	G.tag.textContent = `${part.name} ${Math.round(part.b.w)}×${Math.round(part.b.h)}`;
	setAttr(G.reticle, "opacity", fmt(opacity));
	setAttr(G.tag, "opacity", fmt(opacity));
	return { box, opacity };
}

/** The dot field: ripples out from the centre, matrix rain down its columns, lit by the probe and reticle. */
function drawDots(G: Overlay, p: number, t: number, scanY: number, reticle: { box: Reticle | null; opacity: number }) {
	const clean = 1 - smooth(PHASES.clean[0], PHASES.clean[1], p);
	const R = drawEase(win(PHASES.dots, p)) * (G.maxD + 60);
	const rainOn = smooth(0.04, 0.2, p) * (1 - smooth(0.62, 0.86, p));
	const pw = win(PHASES.probe, p);
	const probeX = lerp(-MARGIN, G.w + MARGIN, drawEase(pw));
	const probeOpacity = pw > 0 && pw < 1 ? smooth(0, 0.1, pw) * (1 - smooth(0.85, 1, pw)) : 0;
	setAttr(G.probe, "transform", `translate(${fmt(probeX)} 0)`);
	setAttr(G.probe, "opacity", fmt(probeOpacity * 0.8));

	const rb = reticle.box;
	for (const d of G.dots) {
		const lag = R - d.d;
		const env = clamp01(lag / 50);
		const front = p < PHASES.dots[1] + 0.05 ? Math.exp(-(((lag - 6) / 14) ** 2)) : 0;
		const headY = ((t * d.speed + d.phase) % (G.span + d.trail)) - MARGIN;
		const back = headY - d.y;
		const rain = back >= 0 && back < d.trail ? (1 - back / d.trail) ** 1.6 * rainOn * env * d.edge : 0;
		let near = 0;
		if (rb) {
			const outside = Math.max(rb.x - d.x, d.x - rb.x - rb.w, rb.y - d.y, d.y - rb.y - rb.h, 0);
			const within = d.x > rb.x && d.x < rb.x + rb.w && d.y > rb.y && d.y < rb.y + rb.h;
			near = Math.max(0, 1 - outside / 16) * (within ? 1 : 0.6);
		}
		const probe = probeOpacity > 0 ? Math.exp(-(((d.x - probeX) / 9) ** 2)) * probeOpacity * env : 0;
		const lit = Math.max(front, rain, near * reticle.opacity * 0.8, probe);
		// Gone where the real UI is already in.
		const under = d.inside && p >= PHASES.reveal[0] && d.y < scanY ? 0 : 1;
		const opacity = fmt(Math.max(env * 0.5 * d.edge, lit * d.edge) * clean * under);
		const radius = fmt(1.05 + lit * 0.85);
		const isLit = lit > 0.35;
		if (opacity !== d.lastOpacity) {
			d.lastOpacity = opacity;
			d.el.setAttribute("opacity", opacity);
		}
		if (radius !== d.lastRadius) {
			d.lastRadius = radius;
			d.el.setAttribute("r", radius);
		}
		if (isLit !== d.lastLit) {
			d.lastLit = isLit;
			d.el.setAttribute("class", isLit ? OVERLAY_CLASS.dotLit : OVERLAY_CLASS.dot);
		}
	}
}

/** Guides, the size label, the outline, its corner handles and the dots landing on it. */
function drawConstruction(G: Overlay, p: number, t: number, durationMs: number) {
	const guideOpacity = 0.5 * (1 - smooth(0.66, 0.92, p));
	G.guides.forEach((g, i) => {
		const q = drawEase((p - PHASES.guides[0] - i * 0.03) / (PHASES.guides[1] - PHASES.guides[0] - 0.09));
		drawStroke(g, q, t);
		g.el.style.opacity = q > 0 ? fmt(guideOpacity) : "0";
	});
	const oq = drawEase(win(PHASES.outline, p));
	G.dim.textContent = `${Math.round(G.w * oq)} × ${Math.round(G.h * oq)}   t+${((Math.min(p, 1) * durationMs) / 1000).toFixed(2)}s`;
	setAttr(G.dim, "opacity", fmt(p > PHASES.outline[0] ? (1 - smooth(0.66, 0.9, p)) * 0.9 : 0));
	for (const s of G.outline) drawStroke(s, oq, t);
	for (const hd of G.handles) setAttr(hd.el, "transform", scaleAt(hd.x, hd.y, drawEase((p - hd.at) / 0.1) * (1 - smooth(0.82, 0.96, p))));
	for (const f of G.flyers) {
		const k = clamp01((p - f.start) / (f.arrive - f.start));
		const on = p >= f.start && p < f.arrive + 0.01;
		setAttr(f.el, "opacity", on ? fmt(smooth(0, 0.25, k)) : 0);
		if (on) {
			const e = drawEase(k);
			setAttr(f.el, "cx", fmt(lerp(f.x0, f.x1, e)));
			setAttr(f.el, "cy", fmt(lerp(f.y0, f.y1, e)));
		}
	}
}

/** Every part traced in order, icons stroke by stroke; key elements get guides, handles and a size label. */
function drawParts(G: Overlay, p: number, t: number) {
	for (const part of G.parts) {
		const q = clamp01((p - part.t0) / (part.t1 - part.t0));
		for (const s of part.strokes) drawStroke(s, drawEase(q * part.count - s.idx * 0.75), t);
	}
	const keysOut = 1 - smooth(PHASES.reveal[0] - 0.02, PHASES.reveal[0] + 0.1, p);
	for (const K of G.keys) {
		const t0 = K.part.t0 - 0.03;
		const hq = drawEase((p - K.part.t0 - 0.04) / 0.08);
		const sizeQ = drawEase((p - K.part.t0) / (K.part.t1 - K.part.t0));
		K.guides.forEach((g, i) => {
			const q = drawEase((p - t0 - i * 0.012) / 0.1);
			drawStroke(g, q, t);
			g.el.style.opacity = q > 0 ? fmt(0.5 * keysOut) : "0";
		});
		for (const hd of K.handles) setAttr(hd.el, "transform", scaleAt(hd.x, hd.y, hq * keysOut));
		setAttr(K.dim, "opacity", fmt(p > t0 ? 0.9 * keysOut : 0));
		K.dim.textContent = `${Math.round(K.part.b.w * sizeQ)} × ${Math.round(K.part.b.h * sizeQ)}`;
	}
}

/** A coordinate readout riding the dot head of the line being drawn. */
function drawReadout(G: Overlay) {
	let current: Stroke | null = null;
	for (const s of G.outline) if (s.live && !s.local) current = s;
	for (const part of G.parts) for (const s of part.strokes) if (s.live && !s.local) current = s;
	setAttr(G.readout, "opacity", current?.point ? 1 : 0);
	if (current?.point) {
		const { x, y } = current.point;
		setAttr(G.readout, "x", fmt(x + 6));
		setAttr(G.readout, "y", fmt(y - 5));
		G.readout.textContent = `${String(Math.round(x)).padStart(3, "0")}·${String(Math.round(y)).padStart(3, "0")}`;
	}
}

/** One frame of the build. `p` is progress (0 → END), `t` ms since the build started. */
export function drawFrame(G: Overlay, content: HTMLElement, p: number, t: number, durationMs: number, rest: ContentStyle) {
	const { y } = drawReveal(G, content, p, t, rest);
	const reticle = drawReticle(G, p);
	drawDots(G, p, t, y, reticle);
	drawConstruction(G, p, t, durationMs);
	drawParts(G, p, t);
	drawReadout(G);
}
