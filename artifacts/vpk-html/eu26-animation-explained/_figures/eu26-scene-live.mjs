export function live(ctx) {
	const { data, kit } = ctx;
	const P = { ...ctx.P, origin: [...ctx.P.origin] };
	let variant = "paper", currentTime = 0, currentTransition = null, currentState = null;
	let displayWidth = ctx.svg.clientWidth || ctx.stage?.clientWidth || 1200;
	let displayHeight = ctx.svg.clientHeight || ctx.stage?.clientHeight || 760, sizeChanged = false;
	// Face details ship in one hidden layer; each surface adopts its own while it is on screen and lets it go when hidden,
	// so the live DOM holds only the detail that paints (hidden subtrees still cost style and layout walks every frame).
	const detailOf = new Map([...ctx.svg.querySelectorAll("[data-eu26-details] > [data-eu26-detail]")].map(detail => [detail.dataset.eu26Detail, detail]));
	ctx.svg.querySelector("[data-eu26-details]")?.remove();
	const shapeRefs = el => ({ fill: el.querySelector(".iso-fill"), top: el.querySelector(".iso-top"), edge: el.querySelector(".iso-edge"), sides: [...el.querySelectorAll(".iso-shade")], detail: detailOf.get(el.dataset.part) || null });
	const surfaces = [...ctx.svg.querySelectorAll("[data-eu26-plan]")].map(el => ({ el, ...JSON.parse(el.dataset.eu26Plan), ...shapeRefs(el) }));
	const surfaceOf = new Map(surfaces.map(surface => [surface.el, surface]));
	// Wall-tile motion: each tagged inner outline is a pure function of time (and, for lanyards, of when the tile entered
	// the frame), so scrubbing and the endless loop stay deterministic. Reduced motion holds every settled state.
	const reducedMotion = ctx.svg.ownerDocument.defaultView.matchMedia?.("(prefers-reduced-motion: reduce)");
	surfaces.forEach((surface, index) => {
		surface.seed = (index * 0.6180339) % 1;
		surface.anims = surface.detail ? [...surface.detail.querySelectorAll("[data-anim]")].map(el => ({ el, kind: el.dataset.anim, i: Number(el.dataset.i || 0), x: Number(el.getAttribute("x")), y: Number(el.getAttribute("y")), w: Number(el.getAttribute("width")), h: Number(el.getAttribute("height")), rows: Number(el.dataset.rows || 0), step: Number(el.dataset.step || 0), reach: Number(el.dataset.reach || 0), px: Number(el.dataset.px || 0), py: Number(el.dataset.py || 0), drop: Number(el.dataset.drop || 0) })) : [];
		// Lettering keeps its proportions while its plate changes shape (the title morphs from the bento's wide box to
		// its squarer wall gap): the lines are counter-scaled together about the lockup's centre, so they stay centred
		// and evenly spaced, as the source sizes its ink.
		surface.letters = surface.detail ? [...surface.detail.querySelectorAll("text")].map(el => ({ el, x: Number(el.dataset.cx ?? el.getAttribute("x")), y: Number(el.dataset.cy ?? el.getAttribute("y")), last: "" })) : [];
	});
	const unit = u => Math.max(0, Math.min(1, u));
	const smooth = u => { const v = unit(u); return v * v * (3 - 2 * v); };
	const overshoot = u => { const v = unit(u) - 1; return 1 + 2.4 * v * v * v + 1.4 * v * v; };
	// A landing card is a blank sheet until its hand-over: its face fades up, and a pale ring swells off its edge and fades.
	const landTile = (surface, posed) => {
		const face = surface.detail?.firstElementChild;
		if (!face) return;
		const shown = posed.face ?? 1;
		if (shown >= 0.999) face.style.removeProperty("opacity");
		else face.style.opacity = shown.toFixed(3);
		let ring = surface.ring;
		if (posed.ring === null || posed.ring === undefined) {
			if (ring) ring.style.display = "none";
			return;
		}
		if (!ring) ring = surface.ring = element("rect", { class: "dring" }, surface.detail);
		if (ring.parentNode !== surface.detail) surface.detail.appendChild(ring);
		const age = posed.ring, grow = smooth((age + 0.1) / 1.1) * 16, plan = surface.drawPlan;
		ring.setAttribute("x", (-grow).toFixed(3));
		ring.setAttribute("y", (-grow).toFixed(3));
		ring.setAttribute("width", (plan.w + grow * 2).toFixed(3));
		ring.setAttribute("height", (plan.d + grow * 2).toFixed(3));
		ring.setAttribute("rx", ((plan.r ?? 6) + grow).toFixed(3));
		ring.style.display = "";
		ring.style.opacity = (0.9 * smooth((age + 0.1) / 0.15) * (1 - smooth(age / 1))).toFixed(3);
	};
	// Tile micro-interactions (stageshow references/bento.md rule 11 and motion.md): each tile does one small thing once, when
	// its face is up (a carried card) or as it enters the frame (a card already in place), staggered about 0.1 s across its
	// parts, and then holds the result. Nothing rewinds in view and no tile loops, so the eye goes where cards are arriving.
	// `story` is seconds since the tile's story began; `entered` is seconds since the tile came into the frame (the lanyard).
	const animateTile = (surface, time, entered, story) => {
		const settled = reducedMotion?.matches;
		const at = settled ? 99 : story;
		const travel = t => smooth(Math.max(0, Math.min(1, t)));
		for (const anim of surface.anims) {
			const { el, kind, i } = anim;
			if (kind === "bar") {
				// Bars grow from a stub to their value, a light overshoot, in reading order.
				const t = (at - i * 0.09) / 0.9, share = t <= 0 ? 0.15 : t >= 1 ? 1 : 0.15 + 0.85 * overshoot(t);
				el.setAttribute("height", (anim.h * share).toFixed(3));
				el.setAttribute("y", (anim.y + anim.h * (1 - share)).toFixed(3));
			} else if (kind === "type") {
				// The input fills in typing steps, then holds what was typed.
				const typed = Math.round(travel((at - 0.2) / 1.6) * 18) / 18;
				el.setAttribute("width", Math.max(0.01, anim.w * typed).toFixed(3));
			} else if (kind === "row") {
				// The highlight steps down to its row and stays; each step decelerates like a selection that follows.
				const target = Math.min(2, anim.rows - 1), step = Math.max(0, at - 0.3) / 0.45, row = Math.min(target, Math.floor(step));
				const slide = row < target ? travel((step - row - 0.35) / 0.65) : 0;
				el.setAttribute("y", (anim.y + anim.step * (row + slide)).toFixed(3));
			} else if (kind === "sweep") {
				// The ring sweeps once to its value and holds it.
				el.setAttribute("stroke-dasharray", `${(0.72 * travel((at - 0.2) / 1.4)).toFixed(4)} 1`);
			} else if (kind === "bubble") {
				// Messages arrive whole from just above, one after another, and stay.
				const shown = travel((at - 0.3 - i * 0.6) / 0.35);
				el.style.opacity = shown.toFixed(3);
				el.setAttribute("transform", `translate(0 ${(-4 * (1 - shown)).toFixed(3)})`);
			} else if (kind === "drift") {
				// Named cursors travel once to the thing they work on and rest there; every move goes somewhere.
				const go = travel((at - 0.4 - i * 0.35) / 1.1);
				el.setAttribute("transform", `translate(${(anim.reach * 1.4 * (1 - go)).toFixed(3)} ${(anim.reach * (1 - go)).toFixed(3)})`);
			} else if (kind === "lanyard") {
				// Dropped from above the frame as the tile slides in, then a damped swing about the strap's top.
				const since = settled ? 99 : entered;
				const fall = 1 - smooth(since / 0.85), swing = since > 0.55 ? 8 * Math.exp(-1.5 * (since - 0.55)) * Math.sin(5.4 * (since - 0.55)) : 0;
				el.setAttribute("transform", `translate(0 ${(-anim.drop * fall).toFixed(3)}) rotate(${swing.toFixed(3)} ${anim.px} ${anim.py})`);
			}
		}
	};
	// The list windows a card can be clipped by (pose.clip): Done and the three story columns, re-projected every frame.
	const listWindows = [...data.columnViewports.map((viewport, i) => ({ key: `column${i}`, viewport, el: ctx.svg.querySelector(`[data-eu26-column-window="${i}"]`) })), { key: "done", viewport: data.doneList.viewport, el: ctx.svg.querySelector("[data-eu26-done-window]") }];
	const cursorLayer = ctx.svg.querySelector("[data-eu26-cursor-layer]");
	const cursorParts = new Map([...ctx.svg.querySelectorAll("[data-eu26-cursor]")].map(el => [el.dataset.eu26Cursor, el]));
	const poses = new Map();
	let lastOrder = "";
	const pieces = new Map([...ctx.svg.querySelectorAll("[data-eu26-piece]")].map(el => [el.dataset.eu26Piece, el]));
	const chrome = [...ctx.svg.querySelectorAll('[data-eu26-piece="chrome"]')];
	// The camera is parallel at rest. During a camera move the model raises `persp`, and points toward the viewer spread
	// away from the frame centre (and far points draw in), so the scene briefly bends into perspective and settles flat.
	let lens = null;
	const project = point => {
		const flat = kit.iso(point, P);
		if (!lens) return flat;
		const depth = (point[0] - lens.at[0]) * view[0] + (point[1] - lens.at[1]) * view[1] + (point[2] - lens.at[2]) * view[2];
		const spread = 1 / Math.max(0.35, 1 - depth * lens.k);
		return [lens.centre[0] + (flat[0] - lens.centre[0]) * spread, lens.centre[1] + (flat[1] - lens.centre[1]) * spread];
	};
	let view = [Math.sqrt(0.375), Math.sqrt(0.375), 0.5], clipWindows = {};
	const doc = ctx.svg.ownerDocument, namespace = "http://www.w3.org/2000/svg";
	const element = (tag, attrs, parent) => {
		const el = doc.createElementNS(namespace, tag);
		for (const [key, value] of Object.entries(attrs || {})) el.setAttribute(key, String(value));
		parent?.appendChild(el);
		return el;
	};
	const defs = ctx.svg.querySelector("defs") || element("defs", {}, ctx.svg);
	const facesId = `${ctx.id}-done-light-faces`, gradientId = `${ctx.id}-done-light-sweep`;
	const faceClip = element("clipPath", { id: facesId, clipPathUnits: "userSpaceOnUse", "data-eu26-done-faces": "" }, defs);
	const lighting = element("g", { "data-eu26-done-lighting": "", "aria-hidden": "true", "pointer-events": "none" }, ctx.svg);
	const tracePaths = [], traceCores = [], clipFaces = [];
	for (let i = 0; i < 3; i += 1) {
		clipFaces.push(element("path", { "data-eu26-done-face": i }, faceClip));
		tracePaths.push(element("path", { "data-eu26-border-trace": i, fill: "none", stroke: "var(--ill-accent)", "stroke-width": "2.75", "stroke-linecap": "round", "stroke-linejoin": "round", "vector-effect": "non-scaling-stroke", pathLength: "1" }, lighting));
		traceCores.push(element("path", { "data-eu26-border-core": i, fill: "none", stroke: "var(--eu26-light-core)", "stroke-width": "1.2", "stroke-linecap": "round", "stroke-linejoin": "round", "vector-effect": "non-scaling-stroke", pathLength: "1" }, lighting));
	}
	const gradient = element("linearGradient", { id: gradientId, gradientUnits: "userSpaceOnUse", "color-interpolation": "sRGB" }, defs);
	for (const [offset, color, opacity] of [[0, "var(--eu26-light-core)", 0], [0.24, "var(--ill-accent)", 0.12], [0.49, "var(--eu26-light-core)", 0.78], [0.67, "var(--ill-accent)", 0.32], [1, "var(--eu26-light-core)", 0]]) element("stop", { offset, "stop-color": color, "stop-opacity": opacity }, gradient);
	const sweep = element("path", { "data-eu26-gradient-sweep": "", fill: `url(#${gradientId})`, "clip-path": `url(#${facesId})` }, lighting);

	// Paper plate (atlasclass): a faint ground grid the board rests on, projected through the live camera and faded out
	// radially, so every shot reads as an object on a surface rather than floating in white. It sits behind every piece.
	const fadeId = `${ctx.id}-ground-fade`, fadeMaskId = `${ctx.id}-ground-mask`;
	const fade = element("radialGradient", { id: fadeId, cx: "0.5", cy: "0.5", r: "0.5" }, defs);
	for (const [offset, opacity] of [[0, 1], [0.32, 0.8], [0.78, 0]]) element("stop", { offset, "stop-color": "white", "stop-opacity": opacity }, fade);
	const fadeMask = element("mask", { id: fadeMaskId, maskContentUnits: "objectBoundingBox" }, defs);
	element("rect", { width: "1", height: "1", fill: `url(#${fadeId})` }, fadeMask);
	const ground = doc.createElementNS(namespace, "g");
	for (const [key, value] of Object.entries({ "data-eu26-ground": "", "aria-hidden": "true", "pointer-events": "none", mask: `url(#${fadeMaskId})` })) ground.setAttribute(key, value);
	ctx.svg.insertBefore(ground, defs.nextSibling);
	const groundMinor = element("path", { "data-eu26-ground-minor": "", fill: "none", stroke: "var(--eu26-ground)", "stroke-width": "0.6", "vector-effect": "non-scaling-stroke" }, ground);
	const groundMajor = element("path", { "data-eu26-ground-major": "", fill: "none", stroke: "var(--eu26-ground-major)", "stroke-width": "0.6", "vector-effect": "non-scaling-stroke" }, ground);
	// Soft cast shadows: each visible face is dropped onto the ground plane, offset by its height, as its own translucent
	// path under everything, so where two shadows overlap they compound and read darker, as real shadows do.
	const shadows = element("g", { "data-eu26-shadows": "", "aria-hidden": "true", "pointer-events": "none" });
	ctx.svg.insertBefore(shadows, ground.nextSibling);
	const shadowPaths = [];
	const drawShadows = list => {
		while (shadowPaths.length < list.length) shadowPaths.push(element("path", {}, shadows));
		shadowPaths.forEach((path, i) => {
			const d = list[i] || "";
			if (path.getAttribute("d") !== d) path.setAttribute("d", d);
			path.style.display = d ? "" : "none";
		});
	};
	const GROUND = { z: -12, step: 100, major: 4 };
	const drawGround = (at, width, height) => {
		const reach = Math.max(width, height) / Math.max(0.01, P.scale ?? 1) * 0.95;
		const first = value => Math.floor((value - reach) / GROUND.step), last = value => Math.ceil((value + reach) / GROUND.step);
		const minor = [], major = [];
		const line = (a, b, index) => (index % GROUND.major === 0 ? major : minor).push(`M${a.map(v => v.toFixed(1)).join(" ")}L${b.map(v => v.toFixed(1)).join(" ")}`);
		const [x0, x1, y0, y1] = [first(at[0]), last(at[0]), first(at[1]), last(at[1])];
		for (let i = x0; i <= x1; i += 1) line(project([i * GROUND.step, y0 * GROUND.step, GROUND.z]), project([i * GROUND.step, y1 * GROUND.step, GROUND.z]), i);
		for (let j = y0; j <= y1; j += 1) line(project([x0 * GROUND.step, j * GROUND.step, GROUND.z]), project([x1 * GROUND.step, j * GROUND.step, GROUND.z]), j);
		groundMinor.setAttribute("d", minor.join(""));
		groundMajor.setAttribute("d", major.join(""));
	};


	const turn = (vector, angles) => {
		let [x, y, z] = vector;
		const [rx, ry, rz] = angles;
		[y, z] = [y * Math.cos(rx) - z * Math.sin(rx), y * Math.sin(rx) + z * Math.cos(rx)];
		[x, z] = [x * Math.cos(ry) + z * Math.sin(ry), -x * Math.sin(ry) + z * Math.cos(ry)];
		[x, y] = [x * Math.cos(rz) - y * Math.sin(rz), x * Math.sin(rz) + y * Math.cos(rz)];
		return [x, y, z];
	};
	const paint = (el, home, pose) => {
		const surface = surfaceOf.get(el), plan = surface.drawPlan, z = surface.drawZ, height = surface.drawHeight;
		const ring = kit.roundedPlan(pose.radius ? { ...plan, r: pose.radius } : plan, 4);
		const world = point => {
			const delta = turn(point.map((value, i) => (value - home[i]) * (i === 1 ? pose.scaleY ?? pose.scale : pose.scale)), pose.rot);
			return pose.at.map((value, i) => value + delta[i]);
		};
		const topWorld = ring.map(([x, y]) => world([x, y, z + height])), bottomWorld = ring.map(([x, y]) => world([x, y, z]));
		const top = topWorld.map(project), bottom = bottomWorld.map(project);
		const points = [...top, ...bottom].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
		const lower = [], upper = [];
		for (const point of points) { while (lower.length > 1 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) lower.pop(); lower.push(point); }
		for (const point of [...points].reverse()) { while (upper.length > 1 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) upper.pop(); upper.push(point); }
		const outline = kit.pathOf([...lower.slice(0, -1), ...upper.slice(0, -1)], true);
		const normal = turn([0, 0, 1], pose.rot), front = normal.reduce((sum, value, axis) => sum + value * view[axis], 0) >= 0;
		surface.fill.setAttribute("d", outline);
		surface.edge.setAttribute("d", outline);
		surface.top.setAttribute("d", kit.pathOf(front ? top : bottom, true));
		const buckets = [[], [], [], []];
		const orientation = Math.sign(ring.reduce((sum, point, i) => sum + point[0] * ring[(i + 1) % ring.length][1] - point[1] * ring[(i + 1) % ring.length][0], 0));
		for (let i = 0; i < ring.length; i += 1) {
			const next = (i + 1) % ring.length, dx = ring[next][0] - ring[i][0], dy = ring[next][1] - ring[i][1], length = Math.hypot(dx, dy);
			if (!length) continue;
			const n = turn([dy / length * orientation, -dx / length * orientation, 0], pose.rot);
			if (n.reduce((sum, value, axis) => sum + value * view[axis], 0) <= 0.000001) continue;
			const shade = Math.min(3, Math.max(0, Math.floor((n[1] - n[0] + Math.SQRT2) / Math.SQRT2 * 2)));
			buckets[shade].push(kit.pathOf([top[i], top[next], bottom[next], bottom[i]], true));
		}
		for (const side of surface.sides) side.setAttribute("d", buckets[Number(side.dataset.shade)].join(""));
		el.removeAttribute("transform");
		// Face detail is drawn in the plan's local units; the face is planar, so one affine matrix from three projected
		// corners places all of it. It belongs to the top face only, so the back of a turning card shows bare paper.
		if (surface.detail) {
			if (front) {
				const faceZ = z + height, origin = project(world([plan.x, plan.y, faceZ]));
				const across = project(world([plan.x + plan.w, plan.y, faceZ])), down = project(world([plan.x, plan.y + plan.d, faceZ]));
				const matrix = [(across[0] - origin[0]) / plan.w, (across[1] - origin[1]) / plan.w, (down[0] - origin[0]) / plan.d, (down[1] - origin[1]) / plan.d, origin[0], origin[1]];
				surface.detail.setAttribute("transform", `matrix(${matrix.map(value => value.toFixed(5)).join(" ")})`);
				if (surface.letters.length) {
					const sx = pose.scale ?? 1, sy = pose.scaleY ?? sx, even = Math.min(sx, sy);
					const counter = Math.abs(sx - sy) < 1e-4 ? "" : `translate(X Y) scale(${(even / sx).toFixed(5)} ${(even / sy).toFixed(5)}) translate(-X -Y)`;
					for (const letter of surface.letters) {
						const value = counter.replace("X Y", `${letter.x} ${letter.y}`).replace("-X -Y", `${-letter.x} ${-letter.y}`);
						if (value !== letter.last) { letter.last = value; value ? letter.el.setAttribute("transform", value) : letter.el.removeAttribute("transform"); }
					}
				}
				if (surface.detail.style.display) surface.detail.style.display = "";
			} else if (surface.detail.style.display !== "none") surface.detail.style.display = "none";
		}
		// A card high above the ground casts a small, far shadow that grows and closes in as it comes down.
		const topZ = Math.max(...topWorld.map(point => point[2])), lift = Math.min(140, Math.max(10, (topZ - GROUND.z) * 0.5));
		const reach = Math.max(0.35, Math.min(1, 1 - Math.max(0, topZ - 40) / 700));
		const mid = topWorld.reduce((sum, point) => [sum[0] + point[0] / topWorld.length, sum[1] + point[1] / topWorld.length], [0, 0]);
		surface.shadow = kit.pathOf(topWorld.map(([x, y]) => project([mid[0] + (x - mid[0]) * reach + lift * 0.7, mid[1] + (y - mid[1]) * reach + lift * 0.45, GROUND.z])), true);
		// Footprint and lowest point in world space, so arrange() can tell what rests on the board.
		const xs = topWorld.map(point => point[0]), ys = topWorld.map(point => point[1]);
		surface.rest = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), mid, low: Math.min(...bottomWorld.map(point => point[2])), top: topZ };
		const face = front ? top : bottom;
		const cut = pose.clip ? clipWindows[pose.clip] : null;
		const clipped = cut?.length ? intersection(face, cut) : face;
		surface.frame = { bounds: pose.clip ? clipped : [...top, ...bottom], polygon: clipped, face, center: world([plan.x + plan.w / 2, plan.y + plan.d / 2, front ? z + height : z]) };
	};
	const set = (el, home, pose) => {
		if (!el) return;
		poses.set(el, pose);
		if (pose.clip) el.setAttribute("clip-path", `url(#eu26-${pose.clip}-window)`);
		else el.removeAttribute("clip-path");
		el.style.display = pose.alpha < 0.002 ? "none" : "";
		const detail = surfaceOf.get(el).detail;
		if (pose.alpha < 0.002) {
			detail?.remove();
			return;
		}
		if (detail && detail.parentNode !== el) el.appendChild(detail);
		if (pose.alpha > 0.998) el.style.removeProperty("opacity");
		else el.style.opacity = pose.alpha.toFixed(4);
		paint(el, home, pose);
	};
	const skinSurface = surface => {
		const { el, plan, z, h } = surface;
		const kind = el.dataset.eu26Kind;
		const paper = ["story", "tile", "wall", "title"].includes(kind);
		const height = paper ? data.materialDepths[kind] : h;
		surface.drawPlan = plan;
		surface.drawZ = z;
		surface.drawHeight = height;
		const shape = kit.slabOf(plan, z, height, P, 4, 0);
		surface.fill.setAttribute("d", shape.fill);
		surface.top.setAttribute("d", shape.top);
		for (const shade of surface.sides) shade.setAttribute("d", shape.shades[Number(shade.dataset.shade)] || "");
		surface.edge.setAttribute("d", shape.outline);
		surface.edge.style.strokeWidth = "0.55px";
	};
	const skin = () => {
		for (const surface of surfaces) skinSurface(surface);
		ctx.root.dataset.heroVariant = variant;
	};
	const accent = (el, value) => {
		if (!el) return;
		const amount = Math.max(0, Math.min(1, Number(value) || 0));
		const highlight = amount.toFixed(5), surface = surfaceOf.get(el);
		if (el.dataset.eu26Highlight === highlight) return;
		const color = (neutral, active) => amount < 0.0001 ? neutral : amount > 0.9999 ? active : `color-mix(in oklab, ${active} ${(amount * 100).toFixed(3)}%, ${neutral})`;
		surface.top.style.fill = color("var(--anatomy-top)", "var(--ill-accent)");
		surface.fill.style.fill = color("var(--anatomy-paper)", "var(--ill-accent)");
		for (const side of surface.sides) side.style.fill = color(`var(--anatomy-shade-${side.dataset.shade})`, "color-mix(in oklab, var(--ill-accent) 86%, var(--ill-accent-ink))");
		surface.edge.style.stroke = color("var(--anatomy-mid)", "color-mix(in oklab, var(--ill-accent) 55%, var(--ill-accent-ink))");
		surface.detail?.firstElementChild?.style.setProperty("--eu26-hl", `${(amount * 100).toFixed(2)}%`);
		el.dataset.eu26Active = amount > 0.5 ? "true" : "false";
		el.dataset.eu26Highlight = highlight;
	};
	const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
	const intersection = (polygon, clip) => {
		let out = polygon;
		const orientation = Math.sign(clip.reduce((sum, point, i) => sum + point[0] * clip[(i + 1) % clip.length][1] - point[1] * clip[(i + 1) % clip.length][0], 0)) || 1;
		for (let i = 0; i < clip.length && out.length; i += 1) {
			const a = clip[i], b = clip[(i + 1) % clip.length], input = out;
			out = [];
			for (let j = 0; j < input.length; j += 1) {
				const from = input[j], to = input[(j + 1) % input.length];
				const f = cross(a, b, from) * orientation, t = cross(a, b, to) * orientation;
				if (f >= -0.001) out.push(from);
				if ((f >= 0) !== (t >= 0)) {
					const ratio = f / (f - t);
					out.push([from[0] + (to[0] - from[0]) * ratio, from[1] + (to[1] - from[1]) * ratio]);
				}
			}
		}
		return out;
	};
	const geometry = el => {
		const surface = surfaceOf.get(el), pose = poses.get(el);
		const plan = surface.drawPlan, z = surface.drawZ, height = surface.drawHeight;
		const apply = project;
		const corners = [[plan.x, plan.y], [plan.x + plan.w, plan.y], [plan.x + plan.w, plan.y + plan.d], [plan.x, plan.y + plan.d]];
		const polygon = surface.frame?.polygon || corners.map(([x, y]) => apply([x, y, z + height]));
		const bounds = surface.frame?.bounds || [...polygon, ...corners.map(([x, y]) => apply([x, y, z]))];
		const world = pose ? pose.at : [plan.x + plan.w / 2, plan.y + plan.d / 2, z];
		const rot = pose?.rot || [0, 0, 0], scale = pose?.scale || 1;
		const top = turn([0, 0, height], rot), center = surface.frame?.center || world.map((n, i) => n + top[i]);
		const ex = turn([scale, 0, 0], rot), ey = turn([0, pose?.scaleY ?? scale, 0], rot);
		const px = kit.axisVector(P, ex), py = kit.axisVector(P, ey), origin = kit.iso(center, P);
		const det = px[0] * py[1] - py[0] * px[1];
		const depth = kit.depthOf(center, P);
		const xs = polygon.map(point => point[0]), ys = polygon.map(point => point[1]);
		// Depth of this plane under a parallel screen point (the inverse of the parallel projection).
		const flatDepth = screen => {
			if (Math.abs(det) < 0.00001) return depth;
			const x = screen[0] - origin[0], y = screen[1] - origin[1];
			const lx = (x * py[1] - y * py[0]) / det, ly = (y * px[0] - x * px[1]) / det;
			return depth + lx * kit.depthOf(ex, P) + ly * kit.depthOf(ey, P);
		};
		const lensNow = lens, lensDepth = lensNow ? kit.depthOf(lensNow.at, P) : 0;
		return { el, polygon, bounds, depth, box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], at(screen) {
			if (!lensNow) return flatDepth(screen);
			// Under the lens, undo the spread first; the spread depends on the depth being solved, so iterate to a fixed point.
			let d = depth;
			for (let i = 0; i < 4; i += 1) {
				const spread = 1 / Math.max(0.35, 1 - (d - lensDepth) * lensNow.k);
				d = flatDepth([lensNow.centre[0] + (screen[0] - lensNow.centre[0]) / spread, lensNow.centre[1] + (screen[1] - lensNow.centre[1]) / spread]);
			}
			return d;
		} };
	};
	const lightDone = state => {
		const effect = state.doneEffect || { trace: 0, sweep: 0, alpha: 0 };
		const faces = [];
		for (let i = 0; i < 3; i += 1) {
			const el = pieces.get(`story.${data.doneList.order[i]}`), surface = surfaceOf.get(el);
			const face = el.style.display === "none" ? [] : surface.frame?.face || [];
			const path = kit.pathOf(face, true);
			clipFaces[i].setAttribute("d", path);
			tracePaths[i].setAttribute("d", path);
			tracePaths[i].setAttribute("stroke-dasharray", `${Math.max(0, Math.min(1, effect.trace)).toFixed(5)} 1`);
			tracePaths[i].style.opacity = String(effect.trace > 0 && effect.sweep < 1 ? 1 - effect.sweep * 0.8 : 0);
			traceCores[i].setAttribute("d", path);
			traceCores[i].setAttribute("stroke-dasharray", tracePaths[i].getAttribute("stroke-dasharray"));
			traceCores[i].style.opacity = tracePaths[i].style.opacity;
			faces.push(...face);
		}
		lighting.style.display = effect.alpha > 0.002 && faces.length ? "" : "none";
		lighting.style.opacity = String(effect.alpha);
		if (faces.length) {
			const viewport = data.doneList.viewport, z = 4 + data.materialDepths.story;
			const from = project([viewport.x + viewport.w / 2, viewport.y, z]);
			const to = project([viewport.x + viewport.w / 2, viewport.y + viewport.d, z]);
			const along = effect.sweep * 1.8 - 0.4, direction = to.map((value, axis) => value - from[axis]);
			const start = from.map((value, axis) => value + direction[axis] * (along - 0.35));
			const end = from.map((value, axis) => value + direction[axis] * (along + 0.35));
			gradient.setAttribute("x1", String(start[0])); gradient.setAttribute("y1", String(start[1]));
			gradient.setAttribute("x2", String(end[0])); gradient.setAttribute("y2", String(end[1]));
			const xs = faces.map(point => point[0]), ys = faces.map(point => point[1]);
			const x = Math.min(...xs), y = Math.min(...ys), right = Math.max(...xs), bottom = Math.max(...ys);
			sweep.setAttribute("d", kit.pathOf([[x, y], [right, y], [right, bottom], [x, bottom]], true));
		}
		sweep.style.display = effect.sweep > 0 && effect.sweep < 1 ? "" : "none";
		ctx.root.dataset.heroDoneTrace = Number(effect.trace).toFixed(5);
		ctx.root.dataset.heroDoneSweep = Number(effect.sweep).toFixed(5);
		ctx.root.dataset.heroDoneAlpha = Number(effect.alpha).toFixed(5);
	};
	const arrange = () => {
		const visible = surfaces.map(surface => surface.el).filter(el => el.style.display !== "none").map(geometry).filter(item => item.polygon.length > 2);
		// Only things standing on the ground cast onto it: a card or chrome piece resting on the visible board (its middle
		// over the board, its underside at or just above the board's top) casts nothing, or its offset shadow would poke
		// out past the board's front edge.
		const chassis = visible.find(item => item.el.dataset.part === "board.chassis");
		const board = chassis && surfaceOf.get(chassis.el).rest;
		const restsOnBoard = item => {
			if (!board || item === chassis) return false;
			const rest = surfaceOf.get(item.el).rest;
			return !!rest && rest.low <= board.top + 12 && rest.mid[0] >= board.x0 && rest.mid[0] <= board.x1 && rest.mid[1] >= board.y0 && rest.mid[1] <= board.y1;
		};
		drawShadows(visible.filter(item => item.el.dataset.eu26Kind !== "confetti" && !item.el.getAttribute("clip-path") && !restsOnBoard(item)).map(item => surfaceOf.get(item.el).shadow || "").filter(Boolean));
		const edges = visible.map(() => new Set()), incoming = visible.map(() => 0);
		// A held card and the cards it leads share a stack: higher ranks paint first, the held card (rank 0) last.
		const stacks = visible.map(item => poses.get(item.el)?.stack ?? null);
		const stacked = (a, b) => stacks[a] && stacks[b] && stacks[a].id === stacks[b].id;
		for (let a = 0; a < visible.length; a += 1) for (let b = a + 1; b < visible.length; b += 1) {
			if (stacked(a, b)) {
				const back = stacks[a].rank > stacks[b].rank ? a : b, front = back === a ? b : a;
				edges[back].add(front);
				incoming[front] += 1;
				continue;
			}
			if (visible[a].el.dataset.eu26Kind === "confetti" || visible[b].el.dataset.eu26Kind === "confetti") continue;
			const ab = visible[a].box, bb = visible[b].box;
			if (ab[2] <= bb[0] || bb[2] <= ab[0] || ab[3] <= bb[1] || bb[3] <= ab[1]) continue;
			const overlap = intersection(visible[a].polygon, visible[b].polygon);
			if (overlap.length < 3) continue;
			const at = overlap.reduce((sum, point) => [sum[0] + point[0] / overlap.length, sum[1] + point[1] / overlap.length], [0, 0]);
			const da = visible[a].at(at), db = visible[b].at(at);
			const back = da <= db ? a : b, front = da <= db ? b : a;
			edges[back].add(front);
			incoming[front] += 1;
		}
		const remaining = new Set(visible.map((_, i) => i)), order = [];
		const ready = [], compare = (a, b) => visible[a].depth - visible[b].depth || a - b;
		const push = index => {
			let at = ready.length;
			ready.push(index);
			while (at > 0) {
				const parent = (at - 1) >> 1;
				if (compare(ready[parent], index) <= 0) break;
				ready[at] = ready[parent]; at = parent;
			}
			ready[at] = index;
		};
		const pop = () => {
			const first = ready[0], last = ready.pop();
			if (ready.length) {
				let at = 0;
				while (at * 2 + 1 < ready.length) {
					let child = at * 2 + 1;
					if (child + 1 < ready.length && compare(ready[child + 1], ready[child]) < 0) child += 1;
					if (compare(last, ready[child]) <= 0) break;
					ready[at] = ready[child]; at = child;
				}
				ready[at] = last;
			}
			return first;
		};
		for (const index of remaining) if (incoming[index] === 0) push(index);
		let cycles = 0;
		while (remaining.size) {
			let chosen;
			if (ready.length) chosen = pop();
			else {
				for (const index of remaining) if (chosen === undefined || compare(index, chosen) < 0) chosen = index;
				cycles += 1;
			}
			remaining.delete(chosen);
			order.push(visible[chosen]);
			for (const next of edges[chosen]) if (--incoming[next] === 0 && remaining.has(next)) push(next);
		}
		// A depth cycle broken through a stack could still reorder it, so each stack's members are dealt back into the slots
		// they took, in rank order.
		for (const id of new Set(stacks.filter(Boolean).map(stack => stack.id))) {
			const slots = order.flatMap((item, slot) => poses.get(item.el)?.stack?.id === id ? [slot] : []);
			const members = slots.map(slot => order[slot]).sort((a, b) => poses.get(b.el).stack.rank - poses.get(a.el).stack.rank);
			slots.forEach((slot, n) => { order[slot] = members[n]; });
		}
		const signature = order.map(item => item.el.dataset.eu26Piece).join("|");
		if (signature !== lastOrder) {
			// The visible surfaces form one contiguous run in depth order just before the lighting layer, as a full
			// re-append would leave them, but only out-of-place surfaces move: re-inserting a node restyles and re-lays-out
			// its whole subtree, face detail included. Hidden surfaces carry no detail, so they are the cheap ones to move.
			const visibleSet = new Set(order.map(item => item.el));
			let first = null;
			for (const child of ctx.svg.children) if (visibleSet.has(child)) { first = child; break; }
			for (let node = first; node && node !== lighting;) {
				const next = node.nextElementSibling;
				if (surfaceOf.has(node) && !visibleSet.has(node)) ctx.svg.insertBefore(node, first);
				node = next;
			}
			let ref = lighting.parentNode === ctx.svg ? lighting : null;
			for (let i = order.length - 1; i >= 0; i -= 1) {
				const el = order[i].el;
				if (el.nextElementSibling !== ref) ctx.svg.insertBefore(el, ref);
				ref = el;
			}
			lastOrder = signature;
		}
		ctx.root.dataset.heroDepthCycles = String(cycles);
		return visible;
	};
	const render = (time, transition = null) => {
		const state = ctx.model({ time, variant, transition, projectionScale: P.scale, reduced: Boolean(reducedMotion?.matches), aspect: displayWidth / Math.max(1, displayHeight), displayHeight });
		currentState = state;
		currentTime = time;
		currentTransition = transition;
		P.azimuth = state.camera.azimuth ?? 45;
		P.elevation = state.camera.elevation ?? 30;
		const azimuth = P.azimuth * Math.PI / 180, elevation = P.elevation * Math.PI / 180;
		view = [Math.cos(azimuth) * Math.cos(elevation), Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation)];
		const persp = state.camera.persp ?? 0;
		lens = persp > 0.001 ? { at: state.camera.at, centre: kit.iso(state.camera.at, P), k: persp * P.scale * Math.sqrt(1.6) / state.camera.height } : null;
		const paperDepth = data.materialDepths.story;
		clipWindows = {};
		for (const { key, viewport, el } of listWindows) {
			const windowRing = kit.roundedPlan(viewport, 4);
			const windowPoints = [4, 4 + paperDepth].flatMap(z => windowRing.map(([x, y]) => project([x, y, z])));
			const sorted = windowPoints.sort((a, b) => a[0] - b[0] || a[1] - b[1]), lower = [], upper = [];
			for (const point of sorted) { while (lower.length > 1 && cross(lower.at(-2), lower.at(-1), point) <= 0) lower.pop(); lower.push(point); }
			for (const point of [...sorted].reverse()) { while (upper.length > 1 && cross(upper.at(-2), upper.at(-1), point) <= 0) upper.pop(); upper.push(point); }
			clipWindows[key] = [...lower.slice(0, -1), ...upper.slice(0, -1)];
			if (el) el.setAttribute("d", kit.pathOf(clipWindows[key], true));
		}
		for (const el of chrome) {
			const surface = surfaceOf.get(el);
			const home = [surface.plan.x + surface.plan.w / 2, surface.plan.y + surface.plan.d / 2, surface.z];
			const alpha = el.dataset.eu26Suppressed === "true" ? 0 : state.chrome;
			set(el, home, { at: home, rot: [0, 0, 0], scale: 1, alpha });
		}
		data.cards.forEach((card, i) => {
			const el = pieces.get(`story.${i}`);
			set(el, [card.home[0] + card.w / 2, card.home[1] + card.d / 2, card.home[2]], state.cards[i]);
			accent(el, state.cards[i].highlight ?? (i === 15 ? 1 : 0));
		});
		data.features.forEach((tile, i) => {
			const el = pieces.get(`tile.${i}`);
			set(el, [-700 + i * 260 + tile.w / 2, 1600 + tile.d / 2, 4], state.tiles[i]);
			accent(el, state.tiles[i].highlight ?? (i === 0 ? 1 : 0));
		});
		data.wall.forEach((card, i) => {
			const el = pieces.get(`wall.${i}`);
			set(el, [card.home[0] + card.w / 2, card.home[1] + card.d / 2, 0], state.wall[i]);
			accent(el, state.wall[i].highlight ?? (card.reserved === 0 ? 1 : 0));
			if (el.style.display !== "none") landTile(surfaceOf.get(el), state.wall[i]);
		});
		(data.wallCards ?? []).forEach((child, j) => {
			const el = pieces.get(`wallcard.${j}`);
			set(el, [child.home[0] + child.w / 2, child.home[1] + child.d / 2, 0], state.wallCards[j]);
			accent(el, 0);
			if (el.style.display !== "none") landTile(surfaceOf.get(el), state.wallCards[j]);
		});

		state.confetti.forEach((pose, i) => {
			const el = pieces.get(`confetti.${i}`);
			set(el, [-700 + i * 24 + (4 + i % 3) / 2, 4000 + (9 + i % 4) / 2, 0], pose);
			accent(el, pose.highlight ?? 1);
		});
		set(pieces.get("title"), data.title.home, state.titlePose);
		accent(pieces.get("title"), state.titlePose.highlight ?? 0);
		lightDone(state);
		const center = project(state.camera.at);
		arrange();
		const { height } = state.camera, [cx, cy] = center;
		// Shots are framed at 1.58:1 and lean on scene beyond the frame's sides. A narrower display (the two-column figure
		// page) widens the frame up to 1.3x so the board is not cropped.
		const contain = state.camera.width * Math.min(1.3, Math.max(1, (state.camera.width / height) / Math.max(0.1, displayWidth / displayHeight)));
		// Cover shots (the frontal wall) fill the frame's height and crop the sides instead of letterboxing.
		const width = contain + ((state.camera.cover ?? 0) * (height * displayWidth / Math.max(1, displayHeight) - contain));
		ctx.svg.setAttribute("viewBox", `${(cx - width / 2).toFixed(3)} ${(cy - height / 2).toFixed(3)} ${width.toFixed(3)} ${height.toFixed(3)}`);
		drawGround(state.camera.at, width, height);
		const origin = project([0, 0, 0]), across = project([1, 0, 0]), speed = Math.abs(data.motion?.wall?.velocity?.[0] ?? 32) * Math.hypot(across[0] - origin[0], across[1] - origin[1]);
		data.wall.forEach((card, i) => {
			const el = pieces.get(`wall.${i}`), surface = surfaceOf.get(el);
			if (!surface.anims.length || el.style.display === "none") return;
			const xs = (surface.frame?.face || [[cx, cy]]).map(point => point[0]), left = (Math.min(...xs) + Math.max(...xs)) / 2;
			// A carried card's story starts once its face is up (touchdown plus the hand-over); a card already in place starts as
			// it comes into the frame.
			const entered = (cx + width / 2 - left) / Math.max(1e-6, speed), carried = state.wall[i].arrival;
			const story = carried ? state.time - (carried.touchdown + 0.72) : entered - 0.3;
			animateTile(surface, state.time, entered, story);
		});
		const unit = Math.max(width / displayWidth, height / displayHeight);
		let clippedCursors = 0;
		for (const cursor of state.cursors) {
			const el = cursorParts.get(cursor.id), tip = project(cursor.at);
			// Cursors follow stageshow (kit/cursor.tsx, examples/presence): one solid rounded arrowhead for every cursor, tip at the
			// hotspot, a paper halo instead of a drop shadow so it reads on grey tiles. A teammate is one tone everywhere, arrow and
			// name flag alike, and the flag rides below and right of the tip. A press dips the arrow to 0.9 about its tip and sends
			// one accent ripple out; there is no ring held under a grip. It grows with the card it holds (perspective).
			const fit = cursor.role === "teammate" ? Math.max(0.55, Math.min(1, displayHeight / 640)) : 1;
			// Arrow and flag scale apart (motionConfig.cursor, matched to teu26.mp4); the press dips only the arrow.
			const CURSOR = { arrow: 2.3, flag: 1.8, ...(data.motion?.cursor ?? {}) };
			const base = unit * (cursor.scale ?? 1) * fit, size = base * CURSOR.arrow * (1 - cursor.pressed * 0.1), flag = base * CURSOR.flag, rest = base * CURSOR.arrow;
			const pill = el.querySelector("[data-eu26-cursor-pill]"), label = el.querySelector("[data-eu26-cursor-name]");
			// The flag hugs its name: the text is measured once per name at 11 units (then scaled with the flag) and padded 7 units
			// each side, so the gaps left and right of the name are equal for every roster name.
			const nameWidth = name => {
				if (label.__eu26Width?.name === name) return label.__eu26Width.width;
				label.setAttribute("font-size", "11");
				label.textContent = name;
				let width = 0;
				try { width = label.getComputedTextLength(); } catch { width = 0; }
				if (!(width > 0)) width = name.length * 6.3;
				else if (doc.fonts?.status !== "loading") label.__eu26Width = { name, width };
				return width;
			};
			const pillW = cursor.name && label ? nameWidth(cursor.name) + 14 : 0, pillH = cursor.name ? 19 : 0;
			const reachRight = Math.max(18 * rest, cursor.name ? 11 * rest + pillW * flag : 0), reachDown = Math.max(18 * rest, cursor.name ? 15 * rest + pillH * flag : 0), reachUp = 4 * rest;
			const reachLeft = 4 * unit;
			const margin = Math.min(tip[0] - reachLeft - (cx - width / 2), cx + width / 2 - tip[0] - reachRight, tip[1] - reachUp - (cy - height / 2), cy + height / 2 - tip[1] - reachDown);
			const attached = cursor.heldTarget || cursor.phase === "release";
			const inside = margin >= 0, alpha = cursor.alpha * (attached ? 1 : Math.max(0, Math.min(1, margin / (18 * unit))));
			// A hand carrying its card in from off the frame crosses the edge with it; it counts as clipped only once it is over the slot.
			if (attached && !cursor.entering && cursor.alpha > 0.002 && !inside) clippedCursors += 1;
			el.style.display = alpha > 0.002 && (inside || attached) ? "" : "none";
			if (alpha < 0.002 || alpha > 0.998) el.style.removeProperty("opacity");
			else el.style.opacity = alpha.toFixed(4);
			el.dataset.cursorPhase = cursor.phase;
			el.dataset.cursorRole = cursor.role;
			el.dataset.heldTarget = cursor.heldTarget?.key || "";
			el.dataset.tipX = tip[0].toFixed(5);
			el.dataset.tipY = tip[1].toFixed(5);
			const pressed = cursor.pressed;
			// stageshow's SolidArrow (M4 3 18.5 9.6 11.8 11.8 9.6 18.5Z), relative to its hotspot at 4,3.
			const points = [[0, 0], [14.5, 6.6], [7.8, 8.8], [5.6, 15.5]].map(([x, y]) => [tip[0] + x * size, tip[1] + y * size]);
			if (pill && label) {
				const shown = Boolean(cursor.name);
				pill.style.display = label.style.display = shown ? "" : "none";
				if (shown) {
					const top = tip[1] + 15 * rest, leftEdge = tip[0] + 11 * rest;
					pill.setAttribute("x", leftEdge.toFixed(3));
					pill.setAttribute("y", top.toFixed(3));
					pill.setAttribute("width", (pillW * flag).toFixed(3));
					pill.setAttribute("height", (pillH * flag).toFixed(3));
					pill.setAttribute("rx", (6 * flag).toFixed(3));
					label.setAttribute("text-anchor", "middle");
					label.setAttribute("x", (leftEdge + pillW * flag / 2).toFixed(3));
					label.setAttribute("y", (top + 13.4 * flag).toFixed(3));
					label.setAttribute("font-size", (11 * flag).toFixed(3));
					if (label.textContent !== cursor.name) label.textContent = cursor.name;
				}
			}
			const arrow = el.querySelector("[data-eu26-cursor-tip]"), halo = el.querySelector("[data-eu26-cursor-halo]"), ring = el.querySelector("[data-eu26-cursor-ring]");
			const d = kit.pathOf(points, true);
			arrow.setAttribute("d", d);
			halo.setAttribute("d", d);
			// One ripple per press change: a ring spreads from the tip and fades while the press goes in or lets go.
			const ripple = 4 * pressed * (1 - pressed);
			ring.setAttribute("cx", tip[0].toFixed(3));
			ring.setAttribute("cy", tip[1].toFixed(3));
			ring.setAttribute("r", ((4 + 14 * (1 - Math.abs(1 - 2 * pressed))) * rest).toFixed(3));
			ring.style.opacity = ripple.toFixed(3);
			ring.style.display = ripple > 0.02 ? "" : "none";
		}
		ctx.svg.appendChild(lighting);
		if (ctx.svg.lastElementChild !== cursorLayer) ctx.svg.appendChild(cursorLayer);
		ctx.root.dataset.heroAzimuth = P.azimuth.toFixed(5);
		ctx.root.dataset.heroElevation = P.elevation.toFixed(5);
		ctx.root.dataset.heroProjectionCoherent = "true";
		ctx.root.dataset.heroWallCopyPool = "0";
		ctx.root.dataset.heroWallCopyVisible = "0";
		ctx.root.dataset.heroCursorClips = String(clippedCursors);
		ctx.root.dataset.heroTime = state.time.toFixed(3);
		ctx.root.dataset.heroPhase = state.phase;
		ctx.show(state);
	};
	ctx.root.addEventListener("eu26:seek", event => render(event.detail?.time ?? 0, event.detail?.transition ?? null));
	ctx.root.addEventListener("eu26:capture", event => { event.detail.state = currentState; });
	ctx.root.addEventListener("eu26:variant", event => {
		if (!data.variants.some(each => each.id === event.detail?.variant)) return;
		variant = event.detail.variant;
		skin();
		render(currentTime, currentTransition);
	});
	const resize = new ResizeObserver(entries => {
		const { width, height } = entries[0]?.contentRect || {};
		if (!(width > 0 && height > 0) || (Math.abs(width - displayWidth) < 0.5 && Math.abs(height - displayHeight) < 0.5)) return;
		displayWidth = width;
		displayHeight = height;
		sizeChanged = true;
		ctx.wake();
	});
	resize.observe(ctx.svg);
	ctx.svg.ownerDocument.defaultView.addEventListener("pagehide", () => resize.disconnect(), { once: true });
	skin();
	render(0);
	return { tick() { if (sizeChanged) { sizeChanged = false; render(currentTime, currentTransition); ctx.root.dispatchEvent(new CustomEvent("eu26:resized")); } return false; }, rest() { render(0); } };
}
