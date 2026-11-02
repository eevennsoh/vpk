export const LINE_START_SECONDS = 0.12;
export const LINE_DRAW_SECONDS = 0.9;
export const BOX_START_SECONDS = 1.08;
export const BOX_STAGGER_SECONDS = 0.18;
export const BOX_DRAW_SECONDS = 0.44;
export const BOX_FILL_SECONDS = 0.2;
export const HEX_FADE_SECONDS = 0.12;
export const MOMENT_SECONDS = 2.6;
const clamp = (value) => Math.max(0, Math.min(1, value));
const out = (value) => 1 - (1 - clamp(value)) ** 3;
const smooth = (value) => { const t = clamp(value); return t * t * (3 - 2 * t); };

// The smoothed Figma curve, shared with curve.svg. This path reveals the dots;
// every box stays at its final position throughout the intro.
const CURVES = [
	[3.296818, 5.164781, 61.885061, 9.760197, 76.016602, 24.599976],
	[87.731098, 36.901575, 56.237091, 58.820398, 51.75, 70.650002],
	[40.729894, 99.703009, 202.1166, 67.299976, 180.516602, 91.599976],
	[168.99042, 104.56693, 129.520651, 125.437341, 140.399994, 137.699997],
	[149.90848, 148.417489, 240.016602, 136.099976, 240.016602, 136.099976],
];
export const CURVE_PATH = `M 0 0 ${CURVES.map((curve) => `C ${curve.join(" ")}`).join(" ")}`;
const STOPS = [
	{ x: -7.400391, y: -1.799988 },
	{ x: 39.666504, y: 29.099976, color: "lime", hexX: 22, hexY: 5 },
	{ x: 86.666504, y: 59.099976, color: "black", hexX: 23, hexY: 6 },
	{ x: 133.666504, y: 89.099976, color: "saffron", hexX: 23, hexY: 6 },
	{ x: 181, y: 118.400024 },
];
const BOX_PERIMETER = 2 * (58.5 + 26.1 - 4 * 4.95) + 2 * Math.PI * 4.95;
// Measure without a DOM dependency so seeking and offline rendering agree.
const CURVE_LENGTH = (() => {
	let start = [0, 0], previous = start, length = 0;
	for (const curve of CURVES) {
		for (let i = 1; i <= 96; i++) {
			const t = i / 96, s = 1 - t;
			const point = [0, 1].map((axis) => s ** 3 * start[axis] + 3 * s * s * t * curve[axis]
				+ 3 * s * t * t * curve[axis + 2] + t ** 3 * curve[axis + 4]);
			length += Math.hypot(point[0] - previous[0], point[1] - previous[1]);
			previous = point;
		}
		start = curve.slice(4);
	}
	return Math.ceil(length) + 2;
})();

/** Line first, then staggered outline → white fill → quick hexagon fade. */
export function flowFrame(seconds) {
	const time = Math.max(0, seconds);
	return {
		line: smooth((time - LINE_START_SECONDS) / LINE_DRAW_SECONDS),
		boxes: STOPS.map((stop, index) => {
			const elapsed = time - BOX_START_SECONDS - index * BOX_STAGGER_SECONDS;
			return {
				...stop,
				outline: smooth(elapsed / BOX_DRAW_SECONDS),
				fill: out((elapsed - BOX_DRAW_SECONDS) / BOX_FILL_SECONDS),
				hex: stop.color ? out((elapsed - BOX_DRAW_SECONDS - BOX_FILL_SECONDS) / HEX_FADE_SECONDS) : 0,
			};
		}),
	};
}

/** Once by default; explicit loop mode may replay after a rest. */
export function flowTime(seconds, { play = "once", length = MOMENT_SECONDS, rest = 1.5 } = {}) {
	const time = Math.max(0, seconds);
	if (play === "live") return time;
	return Math.min(play === "loop" ? time % (length + rest) : time, length);
}

// Document-based URLs also work in namespaced and offline blob-module exports.
const asset = (name) => new URL(`/1p/finale-pieces/assets/principle-flow/${name}`, document.baseURI).href;
const stylesheet = new URL("/1p/finale-pieces/principle-flow.css", document.baseURI).href;
let instance = 0;

class PrincipleFlow extends HTMLElement {
	static observedAttributes = ["time", "paused", "scale", "appearance", "surface", "play", "rest", "length"];
	#styles;
	#stage;
	#curve;
	#reveal;
	#detail;
	#boxes = [];
	#frame = 0;
	#elapsed = 0;
	#lastTick = null;
	#visible = true;
	#observer;
	#motion = matchMedia("(prefers-reduced-motion: reduce)");
	#refresh = () => this.redraw();

	connectedCallback() {
		if (!document.querySelector("link[data-principle-flow-style]")) {
			const link = document.createElement("link");
			link.rel = "stylesheet";
			link.href = stylesheet;
			link.dataset.principleFlowStyle = "";
			document.head.append(link);
		}
		if (!this.#stage) this.#build();
		this.#motion.addEventListener("change", this.#refresh);
		document.addEventListener("visibilitychange", this.#refresh);
		this.#observer = new IntersectionObserver(([entry]) => {
			this.#visible = entry.isIntersecting;
			this.redraw();
		});
		this.#observer.observe(this);
		this.redraw();
	}

	disconnectedCallback() {
		cancelAnimationFrame(this.#frame);
		this.#lastTick = null;
		this.#observer?.disconnect();
		this.#motion.removeEventListener("change", this.#refresh);
		document.removeEventListener("visibilitychange", this.#refresh);
	}

	attributeChangedCallback() { this.redraw(); }
	get pieceStyles() { return this.#styles; }
	set pieceStyles(value) { this.#styles = value; this.redraw(); }

	#build() {
		this.setAttribute("role", "img");
		this.setAttribute("aria-label", "Principle flow. A curved line draws, followed by five staggered box outlines, white fills and three coloured hexagons. The finished diagram stays still.");
		this.#stage = document.createElement("div");
		this.#stage.className = "flow-stage";
		this.#stage.setAttribute("aria-hidden", "true");
		const maskId = `principle-flow-reveal-${++instance}`;
		this.#stage.innerHTML = `<img class="flow-detail" src="${asset("detail.svg")}" alt=""><svg class="flow-curve" xmlns="http://www.w3.org/2000/svg" width="241.017" height="143.081" viewBox="0 0 241.017 143.081"><defs><mask id="${maskId}" maskUnits="userSpaceOnUse" x="-1" y="-1" width="243.017" height="145.081"><path class="flow-reveal" d="${CURVE_PATH}" transform="translate(.5 .5)" fill="none" stroke="white" stroke-width="3" stroke-dasharray="${CURVE_LENGTH}"/></mask></defs><image href="${asset("curve.svg")}" width="241.017" height="143.081" mask="url(#${maskId})"/></svg>`;
		this.#curve = this.#stage.querySelector(".flow-curve image");
		this.#reveal = this.#stage.querySelector(".flow-reveal");
		this.#detail = this.#stage.querySelector(".flow-detail");
		this.#boxes = STOPS.map(({ x, y, color, hexX, hexY }) => {
			const box = document.createElement("div");
			box.className = `flow-box${color ? "" : " flow-box-edge"}`;
			box.style.left = `${x}px`;
			box.style.top = `${y}px`;
			box.innerHTML = `<svg width="59.4" height="27" viewBox="0 0 59.4 27"><rect class="flow-outline" x=".45" y=".45" width="58.5" height="26.1" rx="4.95" stroke-width=".9" stroke-dasharray="${BOX_PERIMETER}"/></svg>${color ? `<img class="flow-hex" src="${asset(`hex-${color}.svg`)}" alt="" style="left:${hexX}px;top:${hexY}px">` : ""}`;
			this.#stage.append(box);
			return { outline: box.querySelector(".flow-outline"), hex: box.querySelector(".flow-hex") };
		});
		this.replaceChildren(this.#stage);
	}

	#number(name, fallback) {
		const value = this.getAttribute(name);
		return value !== null && Number.isFinite(Number(value)) ? Number(value) : fallback;
	}

	#paint() {
		const settings = this.#styles?.principleFlow ?? {};
		const scale = Math.max(0.01, this.#number("scale", 1));
		this.style.width = `${236 * scale}px`;
		this.style.height = `${145 * scale}px`;
		this.#stage.style.transform = `scale(${scale})`;
		const surface = this.getAttribute("surface");
		this.#stage.classList.toggle("no-surface", surface === "off" || (surface !== "on" && settings.surface === false));
		const time = this.#motion.matches ? MOMENT_SECONDS : this.#number("time", this.#elapsed);
		const play = this.#motion.matches ? "once" : this.getAttribute("play") ?? settings.play ?? "once";
		const length = this.#motion.matches ? MOMENT_SECONDS : Math.max(0.1, this.#number("length", settings.length ?? MOMENT_SECONDS));
		const pose = flowFrame(flowTime(time, { play, length, rest: Math.max(0, this.#number("rest", settings.rest ?? 1.5)) }));
		this.#curve.setAttribute("opacity", pose.line > 0 ? "1" : "0");
		this.#reveal.setAttribute("stroke-dashoffset", String((1 - pose.line) * CURVE_LENGTH));
		this.#detail.style.opacity = String(pose.line);
		pose.boxes.forEach((box, index) => {
			const { outline, hex } = this.#boxes[index];
			outline.setAttribute("stroke-dashoffset", String((1 - box.outline) * BOX_PERIMETER));
			outline.setAttribute("stroke-opacity", box.outline > 0 ? "1" : "0");
			outline.setAttribute("fill-opacity", String(box.fill));
			if (hex) hex.style.opacity = String(box.hex);
		});
		return play !== "once" || time < length;
	}

	redraw() {
		cancelAnimationFrame(this.#frame);
		this.#lastTick = null;
		if (!this.isConnected || !this.#stage) return;
		const moving = this.#paint();
		if (!moving || this.hasAttribute("time") || this.hasAttribute("paused") || this.#motion.matches || !this.#visible || document.hidden) return;
		const tick = (now) => {
			if (this.#lastTick !== null) this.#elapsed += (now - this.#lastTick) / 1000;
			this.#lastTick = now;
			if (this.#paint()) this.#frame = requestAnimationFrame(tick);
		};
		this.#frame = requestAnimationFrame(tick);
	}
}

if (!customElements.get("principle-flow")) customElements.define("principle-flow", PrincipleFlow);
