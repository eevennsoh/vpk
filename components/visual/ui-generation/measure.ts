/**
 * Reads the element the build is drawn from: its outline radius, every box,
 * text line and small inline icon, and which boxes are key elements.
 */

export const SKIP_ATTRIBUTE = "data-ui-generation-skip";

export type PartName = "button" | "input" | "image" | "frame" | "text" | "svg";

export interface TextLine {
	readonly x: number;
	readonly x2: number;
	readonly y: number;
	readonly h: number;
}

export interface IconPath {
	readonly tag: string;
	readonly attrs: Readonly<Record<string, string>>;
	readonly matrix: readonly [number, number, number, number, number, number];
}

interface PartBase {
	readonly x: number;
	readonly y: number;
	readonly w: number;
	readonly h: number;
	readonly name: PartName;
	key: boolean;
}

export interface BoxPart extends PartBase {
	readonly kind: "box";
	readonly r: number;
	readonly interactive: boolean;
}

export interface TextPart extends PartBase {
	readonly kind: "text";
	readonly lines: readonly TextLine[];
}

export interface IconPart extends PartBase {
	readonly kind: "icon";
	readonly paths: readonly IconPath[];
}

export type Part = BoxPart | TextPart | IconPart;

export interface Measured {
	readonly w: number;
	readonly h: number;
	readonly r: number;
	readonly parts: Part[];
}

export interface MeasureOptions {
	readonly maxParts: number;
	readonly keys: number;
}

const GEOMETRY_ATTRS = ["d", "cx", "cy", "r", "rx", "ry", "x", "y", "width", "height", "x1", "y1", "x2", "y2", "points"];
const BOXY_TAGS = /^(IMG|CANVAS|VIDEO|INPUT|BUTTON|TEXTAREA|SELECT)$/u;
const INTERACTIVE_TAGS = /^(BUTTON|INPUT|A|SELECT|TEXTAREA)$/u;
const INTERACTIVE_ROLES = /button|tab|switch|checkbox|slider|radio/u;
const MAX_ICON = 120;

function colorAlpha(color: string): number {
	const match = color.match(/rgba?\(([^)]+)\)/u);
	if (!match) return color && color !== "transparent" ? 1 : 0;
	const channels = match[1].split(/[ ,/]+/u).filter(Boolean);
	return channels.length > 3 ? Number(channels[3]) : 1;
}

function partName(el: Element): PartName {
	if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") return "input";
	if (el.tagName === "BUTTON" || el.getAttribute("role") === "button") return "button";
	if (/^(IMG|CANVAS|VIDEO)$/u.test(el.tagName)) return "image";
	return "frame";
}

const area = (part: Part) => part.w * part.h;
const sameBox = (a: Part, b: Part) =>
	Math.abs(a.x - b.x) < 1.5 && Math.abs(a.y - b.y) < 1.5 && Math.abs(a.w - b.w) < 1.5 && Math.abs(a.h - b.h) < 1.5;

export function measure(el: HTMLElement, options: MeasureOptions): Measured {
	const R = el.getBoundingClientRect();
	const totalArea = R.width * R.height;
	const parts: Part[] = [];
	const rel = (r: DOMRect) => ({ x: r.left - R.left, y: r.top - R.top, w: r.width, h: r.height });

	// The element itself is hidden while it builds, so the walk stops at it.
	const hidden = (node: Element) => {
		for (let x: Element | null = node; x && x !== el; x = x.parentElement) {
			const cs = getComputedStyle(x);
			if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) < 0.05) return true;
		}
		return false;
	};

	// The outline's radius: the element's own, or that of a child that fills it.
	let radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;

	const readIcon = (svgEl: SVGSVGElement, r: DOMRect) => {
		const paths: IconPath[] = [];
		for (const shape of svgEl.querySelectorAll<SVGGraphicsElement>("path, circle, ellipse, rect, line, polyline, polygon")) {
			if (shape.closest("defs, clipPath, mask, symbol") || hidden(shape)) continue;
			const m = shape.getScreenCTM();
			if (!m) continue;
			const attrs: Record<string, string> = {};
			for (const name of GEOMETRY_ATTRS) {
				const value = shape.getAttribute(name);
				if (value !== null) attrs[name] = value;
			}
			paths.push({ tag: shape.tagName.toLowerCase(), attrs, matrix: [m.a, m.b, m.c, m.d, m.e - R.left, m.f - R.top] });
		}
		if (paths.length) parts.push({ kind: "icon", ...rel(r), paths, name: "svg", key: false });
	};

	const readText = (node: Element) => {
		for (const child of node.childNodes) {
			if (child.nodeType !== Node.TEXT_NODE || !child.nodeValue?.trim()) continue;
			const range = document.createRange();
			range.selectNodeContents(child);
			const lines: { x: number; x2: number; y: number; h: number }[] = [];
			for (const q of range.getClientRects()) {
				const last = lines.at(-1);
				const y = q.top - R.top;
				if (last && Math.abs(last.y - y) < 2) last.x2 = Math.max(last.x2, q.right - R.left);
				else lines.push({ x: q.left - R.left, x2: q.right - R.left, y, h: q.height });
			}
			if (!lines.length) continue;
			parts.push({
				kind: "text",
				lines,
				x: Math.min(...lines.map((l) => l.x)),
				y: lines[0].y,
				w: Math.max(...lines.map((l) => l.x2 - l.x)),
				h: lines.reduce((sum, l) => sum + l.h, 0),
				name: "text",
				key: false,
			});
		}
	};

	const walk = (node: Element) => {
		for (const child of node.children) {
			if (child.matches(`script, style, template, [${SKIP_ATTRIBUTE}]`) || hidden(child)) continue;
			const r = child.getBoundingClientRect();
			const cs = getComputedStyle(child);
			if (!r.width || !r.height) {
				walk(child);
				continue;
			}
			if (Math.abs(r.width - R.width) < 2 && Math.abs(r.height - R.height) < 2) {
				radius = Math.max(radius, parseFloat(cs.borderTopLeftRadius) || 0);
			}
			if (child instanceof SVGSVGElement) {
				if (r.width <= MAX_ICON && r.height <= MAX_ICON) readIcon(child, r);
				continue;
			}
			const isBackground = r.width * r.height > totalArea * 0.6;
			const boxy =
				!isBackground &&
				!/blur/u.test(cs.filter) &&
				(colorAlpha(cs.backgroundColor) > 0.02 ||
					parseFloat(cs.borderTopWidth) > 0 ||
					BOXY_TAGS.test(child.tagName) ||
					cs.backgroundImage !== "none");
			if (boxy) {
				parts.push({
					kind: "box",
					...rel(r),
					r: Math.min(parseFloat(cs.borderTopLeftRadius) || 0, r.width / 2, r.height / 2),
					interactive: INTERACTIVE_TAGS.test(child.tagName) || INTERACTIVE_ROLES.test(child.getAttribute("role") ?? ""),
					name: partName(child),
					key: false,
				});
			}
			readText(child);
			walk(child);
		}
	};
	walk(el);

	// The same box twice (a button and the span that fills it) is drawn once.
	for (let i = parts.length - 1; i > 0; i--) {
		const part = parts[i];
		if (part.kind === "box" && parts.some((q, j) => j < i && q.kind === "box" && sameBox(q, part))) parts.splice(i, 1);
	}
	// Too many parts: keep the largest, in document order.
	if (parts.length > options.maxParts) {
		const keep = new Set([...parts].sort((a, b) => area(b) - area(a)).slice(0, options.maxParts));
		for (let i = parts.length - 1; i >= 0; i--) if (!keep.has(parts[i])) parts.splice(i, 1);
	}
	// Key elements: interactive boxes first, then the largest boxes.
	const boxes = parts.filter((p): p is BoxPart => p.kind === "box");
	[...boxes.filter((b) => b.interactive), ...boxes.filter((b) => !b.interactive).sort((a, b) => area(b) - area(a))]
		.slice(0, options.keys)
		.forEach((box) => {
			box.key = true;
		});

	return { w: R.width, h: R.height, r: Math.min(radius, R.width / 2, R.height / 2), parts };
}
