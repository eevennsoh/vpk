export const INTRO_SECONDS = 1.3;
export const HEX_FADE_SECONDS = 0.16;
export const HEX_STAGGER_SECONDS = 0.12;
export const HEX_SPACING = 47.7;
export const HEX_COUNT = 7;
export const MOMENT_SECONDS = 12;

/** Figma 355:14476, in its original 236 × 145 coordinate space. */
export const ROWS = [
	{ name: "top", color: "blue", start: 0.2, anchor: 0, target: 174.6, speed: 10, lineY: 21.5, dotY: 18, hexY: 0, hexX: [-20.7, 27, 74.7, 122.4] },
	{ name: "middle", color: "saffron", start: 0.38, anchor: 284.4, target: 38.7, speed: -8, lineY: 71.9, dotY: 67.95, hexY: 49.95, hexX: [50.4, 98.1, 145.8, 193.5] },
	{ name: "bottom", color: "purple", start: 0.56, anchor: -7.2, target: 174.3, speed: 9, lineY: 122.3, dotY: 118.1, hexY: 100.1, hexX: [-21, 26.7, 74.4, 122.1] },
];
const clamp = (value) => Math.max(0, Math.min(1, value));
const out = (value) => 1 - (1 - clamp(value)) ** 3;

/** Integrate a smooth velocity ramp; every part of a row uses this one distance. */
function rowOffset(row, elapsed) {
	if (elapsed <= 0) return 0;
	if (elapsed >= INTRO_SECONDS) return row.speed * (elapsed - INTRO_SECONDS / 2);
	const t = elapsed / INTRO_SECONDS;
	return row.speed * INTRO_SECONDS * (t ** 3 - t ** 4 / 2);
}

// Extra cells enter from behind the original four. Recycling happens fully outside
// the clip, so the row stays populated after its leading dot has left the card.
const cells = ROWS.map((row) => Array.from({ length: HEX_COUNT }, (_, i) => {
	const index = row.speed > 0 ? i - 3 : i;
	return { x: row.hexX[0] + index * HEX_SPACING, order: Math.max(0, row.speed > 0 ? index : 3 - index) };
}));

/** One deterministic clock for playback, backwards seeking and film exports. */
export function proliferationFrame(seconds, poster = false) {
	const time = Math.max(0, seconds);
	return ROWS.map((row, index) => {
		const elapsed = time - row.start;
		const offset = poster ? 0 : rowOffset(row, elapsed);
		const leadingHexagon = row.speed > 0 ? row.hexX.at(-1) : row.hexX[0];
		const repeatWidth = HEX_COUNT * HEX_SPACING;
		return {
			offset,
			dot: row.target + offset,
			// Extend the trailing edge while the dotted texture travels with the row.
			left: row.speed > 0 ? row.anchor - offset : row.target,
			width: Math.abs(row.target - row.anchor) + Math.abs(offset),
			opacity: poster ? 1 : out(elapsed / 0.36),
			hexagons: cells[index].map((cell) => {
				const cycle = Math.floor((cell.x + offset + HEX_SPACING) / repeatWidth);
				const x = cell.x - cycle * repeatWidth;
				const behindDot = (x - leadingHexagon) * Math.sign(row.speed) < 0.001;
				return { x, opacity: behindDot ? (poster ? 1 : out((elapsed - cell.order * HEX_STAGGER_SECONDS) / HEX_FADE_SECONDS)) : 0 };
			}),
		};
	});
}

/** Continuous by default; explicit once/loop modes retain the kit's controls. */
export function proliferationTime(seconds, { play = "live", length = MOMENT_SECONDS, rest = 1.5 } = {}) {
	const time = Math.max(0, seconds);
	if (play === "live") return time;
	return Math.min(play === "loop" ? time % (length + rest) : time, length);
}

// Document-based URLs also resolve in namespaced and offline blob-module exports.
const asset = (name) => new URL(`/1p/finale-pieces/assets/agent-proliferation/${name}`, document.baseURI).href;
const stylesheet = new URL("/1p/finale-pieces/agent-proliferation.css", document.baseURI).href;

class AgentProliferation extends HTMLElement {
	static observedAttributes = ["time", "paused", "scale", "appearance", "surface", "play", "rest", "length"];
	#styles;
	#stage;
	#rows = [];
	#frame = 0;
	#elapsed = 0;
	#lastTick = null;
	#visible = true;
	#observer;
	#motion = matchMedia("(prefers-reduced-motion: reduce)");
	#refresh = () => this.redraw();

	connectedCallback() {
		if (!document.querySelector("link[data-agent-proliferation-style]")) {
			const link = document.createElement("link");
			link.rel = "stylesheet";
			link.href = stylesheet;
			link.dataset.agentProliferationStyle = "";
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
		this.setAttribute("aria-label", "Agent proliferation. Three dotted lines grow horizontally, carrying staggered rows of hexagons. Blue and purple dots travel right; the saffron dot travels left.");
		this.#stage = document.createElement("div");
		this.#stage.className = "proliferation-stage";
		this.#stage.setAttribute("aria-hidden", "true");
		this.#rows = ROWS.map((row, index) => {
			const group = document.createElement("div");
			group.className = "proliferation-row";
			const line = document.createElement("div");
			line.className = "proliferation-line";
			line.style.top = `${row.lineY}px`;
			line.style.backgroundImage = `url("${asset(`line-${row.name}.svg`)}")`;
			line.style.backgroundPosition = row.speed > 0 ? "right top" : "left top";
			const hexagons = cells[index].map(() => {
				const hexagon = document.createElement("img");
				hexagon.className = "proliferation-hexagon";
				hexagon.src = asset("hexagon.svg");
				hexagon.alt = "";
				hexagon.style.top = `${row.hexY - 0.225}px`;
				return hexagon;
			});
			const dot = document.createElement("img");
			dot.className = "proliferation-dot";
			dot.src = asset(`dot-${row.color}.svg`);
			dot.alt = "";
			dot.style.left = `${row.target - 4.5}px`;
			dot.style.top = `${row.dotY}px`;
			group.append(line, dot, ...hexagons);
			this.#stage.append(group);
			return { group, line, hexagons, dot };
		});
		this.replaceChildren(this.#stage);
	}

	#number(name, fallback) {
		const value = this.getAttribute(name);
		return value !== null && Number.isFinite(Number(value)) ? Number(value) : fallback;
	}

	#paint() {
		const settings = this.#styles?.agentProliferation ?? {};
		const scale = Math.max(0.01, this.#number("scale", 1));
		this.style.width = `${236 * scale}px`;
		this.style.height = `${145 * scale}px`;
		this.#stage.style.transform = `scale(${scale})`;
		const surface = this.getAttribute("surface");
		this.#stage.classList.toggle("no-surface", surface === "off" || (surface !== "on" && settings.surface === false));
		const time = this.#number("time", this.#elapsed);
		const play = this.getAttribute("play") ?? settings.play ?? "live";
		const length = Math.max(0.1, this.#number("length", settings.length ?? MOMENT_SECONDS));
		const sample = proliferationTime(time, { play, length, rest: Math.max(0, this.#number("rest", settings.rest ?? 1.5)) });
		proliferationFrame(sample, this.#motion.matches).forEach((pose, index) => {
			const row = this.#rows[index];
			row.group.style.transform = `translateX(${pose.offset}px)`;
			row.line.style.left = `${pose.left}px`;
			row.line.style.width = `${pose.width}px`;
			row.line.style.opacity = String(pose.opacity);
			row.dot.style.opacity = String(pose.opacity);
			row.hexagons.forEach((hexagon, i) => {
				hexagon.style.opacity = String(pose.hexagons[i].opacity);
				// The original SVG includes 0.225 px of stroke beyond its vector bounds.
				hexagon.style.left = `${pose.hexagons[i].x - 0.225}px`;
			});
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

if (!customElements.get("agent-proliferation")) customElements.define("agent-proliferation", AgentProliferation);
