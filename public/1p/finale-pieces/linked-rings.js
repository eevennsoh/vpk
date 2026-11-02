/**
 * TWG microsite LoadingSpinner motion, sampled on the finale's film clock.
 * Source: atlassian-frontend-monorepo, LoadingSpinner/utils.ts at
 * ff3e9dd1de931a2c19555813e90686fd1294005e.
 * Keep this module self-contained so offline exports can load it from a blob.
 */
export const BURST_SECONDS = 0.4;
export const ROTATE_SECONDS = 0.4;
export const DRAW_SECONDS = 0.8;
export const TAIL_DELAY = 0.35;
export const SNAKE_SECONDS = DRAW_SECONDS / (1 - TAIL_DELAY);
export const CYCLE_SECONDS = SNAKE_SECONDS + ROTATE_SECONDS;
export const MOMENT_SECONDS = BURST_SECONDS + 4 * CYCLE_SECONDS;
export const DRAW_PATTERNS = [
	[[3, 0], [0, 2], [2, 1]],
	[[0, 2], [2, 3], [3, 1]],
	[[3, 1], [1, 0], [0, 2]],
	[[0, 1], [1, 3], [3, 2]],
];
const DOT_ANGLES = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
const DOT_ORDER = [0, 1, 3, 2];
const DOT_COLORS = ["#FCA700", "#6A9A23", "#1868DB", "#AF59E0"];
const RADIUS = 2.5;
const SPREAD = 8;
const HIDDEN_DASH = "0 9999";
const clamp = (value) => Math.max(0, Math.min(1, value));
const back = (value, overshoot) => { const t = clamp(value) - 1; return 1 + (overshoot + 1) * t ** 3 + overshoot * t ** 2; };
const quad = (value) => { const t = clamp(value); return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2; };
let instance = 0;

/** The same burst, snake patterns, tail delay and 45° turns as the reference. */
export function linkedRingsFrame(seconds, reducedMotion = false) {
	const time = Math.max(0, seconds);
	let spread = SPREAD, rotation = 0, drawFrac = -1, retractFrac = 0, patternIndex = 0;
	if (!reducedMotion && time < BURST_SECONDS) {
		spread *= back(time / BURST_SECONDS, 0.8);
	} else if (!reducedMotion) {
		const elapsed = time - BURST_SECONDS;
		const cycle = Math.floor(elapsed / CYCLE_SECONDS);
		const phase = elapsed % CYCLE_SECONDS;
		patternIndex = cycle % DRAW_PATTERNS.length;
		rotation = cycle * Math.PI / 4;
		if (phase < SNAKE_SECONDS) {
			const progress = phase / SNAKE_SECONDS;
			drawFrac = quad(progress / (1 - TAIL_DELAY));
			retractFrac = quad((progress - TAIL_DELAY) / (1 - TAIL_DELAY));
		} else {
			rotation += back((phase - SNAKE_SECONDS) / ROTATE_SECONDS, 0.6) * Math.PI / 4;
		}
	}
	const positions = DOT_ANGLES.map((angle) => ({ x: 12 + Math.cos(angle + rotation) * spread, y: 12 + Math.sin(angle + rotation) * spread }));
	const segments = DRAW_PATTERNS[patternIndex].map(([from, to]) => {
		const start = positions[from], end = positions[to];
		return { start, end, length: Math.hypot(end.x - start.x, end.y - start.y) };
	});
	const totalLength = segments.reduce((sum, segment) => sum + segment.length, 0);
	let offset = 0;
	const lines = segments.map(({ start, end, length }) => {
		const head = Math.min(length, Math.max(0, drawFrac * totalLength - offset));
		const tail = Math.min(length, Math.max(0, retractFrac * totalLength - offset));
		offset += length;
		const visible = head - tail;
		return {
			d: `M${start.x},${start.y} L${end.x},${end.y}`,
			dash: drawFrac < 0 || visible <= 0.001 || length < 0.001 ? HIDDEN_DASH : `${visible.toFixed(4)} ${(length - visible).toFixed(4)}`,
			offset: drawFrac < 0 || visible <= 0.001 || length < 0.001 ? "0" : (-tail).toFixed(4),
		};
	});
	return { positions, lines };
}

/** Default live playback keeps tracing; explicit once/loop controls still work. */
export function linkedRingsTime(seconds, { play = "live", length = MOMENT_SECONDS, rest = 1.5 } = {}) {
	const time = Math.max(0, seconds);
	return play === "live" ? time : Math.min(play === "loop" ? time % (length + rest) : time, length);
}

const stylesheet = new URL("/1p/finale-pieces/linked-rings.css", document.baseURI).href;

class LinkedRings extends HTMLElement {
	static observedAttributes = ["time", "paused", "scale", "appearance", "surface", "play", "rest", "length"];
	#styles;
	#stage;
	#tile;
	#dots;
	#lines;
	#frame = 0;
	#elapsed = 0;
	#lastTick = null;
	#visible = true;
	#observer;
	#motion = matchMedia("(prefers-reduced-motion: reduce)");
	#refresh = () => this.redraw();

	connectedCallback() {
		if (!document.querySelector("link[data-linked-rings-style]")) {
			const link = document.createElement("link");
			link.rel = "stylesheet";
			link.href = stylesheet;
			link.dataset.linkedRingsStyle = "";
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
		this.setAttribute("aria-label", "Linked rings tracing Teamwork Graph connections");
		const maskId = `linked-rings-holes-${++instance}`;
		this.#stage = document.createElement("div");
		this.#stage.className = "linked-rings-stage";
		this.#stage.innerHTML = `<svg class="linked-rings-tile" width="120" height="120" viewBox="0 0 120 120" fill="none" aria-hidden="true"><g class="linked-rings-surface"><rect width="120" height="120" rx="22" fill="#000000"/><rect class="linked-rings-rim" x="0.5" y="0.5" width="119" height="119" rx="21.5" stroke="#ffffff29"/></g><svg x="24" y="24" width="72" height="72" viewBox="0 0 24 24"><defs><mask id="${maskId}" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24"><rect width="24" height="24" fill="white"/>${DOT_ORDER.map((i) => `<circle data-dot="${i}" cx="12" cy="12" r="${RADIUS}" fill="black"/>`).join("")}</mask></defs><g mask="url(#${maskId})">${DRAW_PATTERNS[0].map(() => `<path class="linked-rings-line" stroke="#6C6F77" stroke-width="1.5" stroke-linecap="butt" stroke-dasharray="${HIDDEN_DASH}"/>`).join("")}</g>${DOT_ORDER.map((i) => `<circle data-dot="${i}" cx="12" cy="12" r="${RADIUS}" stroke="${DOT_COLORS[i]}" stroke-width="1.5"/>`).join("")}</svg></svg>`;
		this.#tile = this.#stage.firstElementChild;
		this.#dots = [...this.#stage.querySelectorAll("[data-dot]")];
		this.#lines = [...this.#stage.querySelectorAll(".linked-rings-line")];
		this.replaceChildren(this.#stage);
	}

	#number(name, fallback) {
		const value = this.getAttribute(name);
		return value !== null && Number.isFinite(Number(value)) ? Number(value) : fallback;
	}

	#paint() {
		const settings = this.#styles?.ringsTile ?? {};
		const scale = Math.max(0.01, this.#number("scale", 1));
		this.style.width = `${120 * scale}px`;
		this.style.height = `${120 * scale}px`;
		this.#stage.style.transform = `scale(${scale})`;
		const surface = this.getAttribute("surface");
		this.#stage.classList.toggle("no-surface", surface === "off" || (surface !== "on" && settings.surface === false));
		const reduced = this.#motion.matches;
		const time = this.#number("time", this.#elapsed);
		const play = this.getAttribute("play") ?? settings.play ?? "live";
		const length = Math.max(0.1, this.#number("length", settings.length ?? MOMENT_SECONDS));
		const shown = linkedRingsTime(time, { play, length, rest: Math.max(0, this.#number("rest", settings.rest ?? 1.5)) });
		this.#tile.style.opacity = String(reduced ? 1 : clamp(shown / 0.22));
		this.#tile.style.transform = `scale(${reduced ? 1 : 0.84 + 0.16 * back(shown / BURST_SECONDS, 0.8)})`;
		const pose = linkedRingsFrame(shown, reduced);
		for (const dot of this.#dots) {
			const position = pose.positions[Number(dot.getAttribute("data-dot"))];
			dot.setAttribute("cx", String(position.x));
			dot.setAttribute("cy", String(position.y));
		}
		this.#lines.forEach((line, index) => {
			line.setAttribute("d", pose.lines[index].d);
			line.setAttribute("stroke-dasharray", pose.lines[index].dash);
			line.setAttribute("stroke-dashoffset", pose.lines[index].offset);
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

if (!customElements.get("linked-rings")) customElements.define("linked-rings", LinkedRings);
