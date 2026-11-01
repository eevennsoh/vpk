/** The kit's reasoning shimmer and the shared app stack's 180 ms cadence, in film seconds. */
export const SHIMMER_SECONDS = 2.4;
export const ICON_STAGGER_SECONDS = 0.18;
export const POSTER_SECONDS = 1.8;
export const MOMENT_SECONDS = 4;
const CROSSFADE_SECONDS = 0.5;
const ROTATIONS = [-6, 0, 8, 0];
const RING_CENTRES = [[9.75, 9.75], [35.25, 9.75], [9.75, 35.25], [35.25, 35.25]];
const RING_RADIUS = 7.5;
const LINK_INSET = RING_RADIUS / Math.SQRT2;
const LINK_LENGTH = Math.hypot(25.5, 25.5) - 2 * RING_RADIUS;
const clamp = (n) => Math.max(0, Math.min(1, n));
const out = (n) => 1 - (1 - clamp(n)) ** 3;

/** The shared app stack's spring: stiffness 260, damping 28, mass .85. */
function settle(seconds) {
	if (seconds <= 0) return 0;
	if (seconds >= 1) return 1;
	const omega = Math.sqrt(260 / 0.85);
	const decay = 28 / (2 * 0.85);
	const damped = Math.sqrt(omega * omega - decay * decay);
	return 1 - Math.exp(-decay * seconds) * (Math.cos(damped * seconds) + decay / damped * Math.sin(damped * seconds));
}

/** Linked rings' 2.6 Hz, .5 damping pop, followed by its small connection pulse. */
function ringPop(seconds) {
	if (seconds <= 0) return 0;
	const omega = 2 * Math.PI * 2.6;
	const damped = omega * Math.sqrt(1 - 0.5 ** 2);
	return 1 - Math.exp(-0.5 * omega * seconds) * (Math.cos(damped * seconds) + 0.5 * omega / damped * Math.sin(damped * seconds));
}

function graphMark() {
	// The Figma glyph's four 19.5 pt rings and 4.5 pt diagonal, independently animatable.
	return `<svg viewBox="0 0 45 45" fill="none" stroke="currentColor" stroke-width="4.5" aria-hidden="true"><line class="twg-strip-link" x1="${9.75 + LINK_INSET}" y1="${9.75 + LINK_INSET}" x2="${35.25 - LINK_INSET}" y2="${35.25 - LINK_INSET}" stroke-dasharray="${LINK_LENGTH}" stroke-dashoffset="${LINK_LENGTH}"/>${RING_CENTRES.map(([x, y]) => `<circle class="twg-strip-ring" cx="${x}" cy="${y}" r="${RING_RADIUS}" opacity="0"/>`).join("")}</svg>`;
}

/** A pure sample: seeking or exporting the same second always draws the same frame. */
export function stripFrame(seconds) {
	const time = Math.max(0, seconds);
	const link = clamp((time - 0.78) / 0.5);
	const connected = 0.07 * Math.sin(Math.PI * clamp((time - 1.2) / 0.32));
	return {
		shimmer: (time % SHIMMER_SECONDS) / SHIMMER_SECONDS,
		link: link * link * (3 - 2 * link),
		rings: RING_CENTRES.map((_, index) => {
			const elapsed = time - 0.22 - 0.11 * index;
			return {
				opacity: out(elapsed / 0.12),
				scale: time >= POSTER_SECONDS ? 1 : ringPop(elapsed) + (index === 3 ? connected : 0),
			};
		}),
		icons: ROTATIONS.map((rotation, index) => {
			const elapsed = time - 0.24 - index * ICON_STAGGER_SECONDS;
			const spring = settle(elapsed);
			return {
				opacity: out(elapsed / 0.32),
				x: -16 * (1 - spring),
				y: 0,
				scale: 1,
				rotation,
			};
		}),
	};
}

/** Same play modes as the kit: live, hold the last frame, or rest and crossfade into a replay. */
export function stripLayers(seconds, { play = "live", length = MOMENT_SECONDS, rest = 1.5 } = {}) {
	const time = Math.max(0, seconds);
	if (play === "live") return [{ time, opacity: 1 }];
	if (play === "once") return [{ time: Math.min(time, length), opacity: 1 }];
	const period = length + rest;
	if (time < period) return [{ time: Math.min(time, length), opacity: 1 }];
	const phase = (time - period) % (period + CROSSFADE_SECONDS);
	if (phase < CROSSFADE_SECONDS) {
		const blend = phase / CROSSFADE_SECONDS;
		return [{ time: length, opacity: 1 - blend }, { time: phase, opacity: blend }];
	}
	return [{ time: Math.min(phase, length), opacity: 1 }];
}

// Self-contained so the offline export can load this module from a blob URL.
// These document-based paths also follow the export's public-path rewrites.
const asset = (name) => new URL(`/1p/finale-pieces/assets/${name}`, document.baseURI).href;
const stylesheet = new URL("/1p/finale-pieces/twg-search-strip.css", document.baseURI).href;

/** Host-owned addition with the same attributes and film clock as <rovo-piece>. */
class TwgSearchStrip extends HTMLElement {
	static observedAttributes = ["time", "paused", "scale", "appearance", "surface", "play", "rest", "length"];
	#styles;
	#layers = [];
	#stage;
	#frame = 0;
	#elapsed = 0;
	#lastTick = null;
	#visible = true;
	#observer;
	#motion = matchMedia("(prefers-reduced-motion: reduce)");
	#refresh = () => this.redraw();

	connectedCallback() {
		if (!document.querySelector('link[data-twg-strip-style]')) {
			const link = document.createElement("link");
			link.rel = "stylesheet";
			link.href = stylesheet;
			link.dataset.twgStripStyle = "";
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
		this.setAttribute("aria-label", "Searching Teamwork Graph across Confluence, Google Drive, Jira and Microsoft Teams");
		this.#stage = document.createElement("div");
		this.#stage.className = "twg-strip-stage";
		this.#stage.setAttribute("aria-hidden", "true");
		this.#layers = [0, 1].map(() => {
			const layer = document.createElement("div");
			layer.className = "twg-strip-layer";
			layer.innerHTML = `<div class="twg-strip"><div class="twg-strip-grid"></div><div class="twg-strip-label"><span class="twg-strip-mark">${graphMark()}</span><p class="twg-strip-text">Searching Teamwork Graph</p></div><div class="twg-strip-apps"></div></div>`;
			const stack = layer.querySelector(".twg-strip-apps");
			const icons = ["appConfluence", "appDrive", "appJira", null].map((id) => {
				const icon = document.createElement("span");
				icon.className = "twg-strip-app";
				if (id) {
					// Reuse the kit's exact logo tiles at half their 96 pt size.
					const logo = document.createElement("rovo-piece");
					logo.setAttribute("piece", id);
					logo.setAttribute("scale", "0.5");
					logo.setAttribute("time", "0");
					icon.append(logo);
				} else {
					icon.innerHTML = `<span class="twg-strip-teams"><img src="${asset("microsoft-teams.svg")}" alt=""></span>`;
				}
				stack.append(icon);
				return icon;
			});
			this.#stage.append(layer);
			return { layer, text: layer.querySelector(".twg-strip-text"), rings: [...layer.querySelectorAll(".twg-strip-ring")], link: layer.querySelector(".twg-strip-link"), icons };
		});
		this.replaceChildren(this.#stage);
	}

	#number(name, fallback) {
		const value = this.getAttribute(name);
		return value !== null && Number.isFinite(Number(value)) ? Number(value) : fallback;
	}

	#paint() {
		const settings = this.#styles?.twgSearchStrip ?? {};
		const scale = Math.max(0.01, this.#number("scale", 1));
		this.style.width = `${1008 * scale}px`;
		this.style.height = `${156 * scale}px`;
		this.#stage.style.transform = `scale(${scale})`;
		const surface = this.hasAttribute("surface") ? this.getAttribute("surface") !== "off" : settings.surface !== false;
		const time = this.#motion.matches ? POSTER_SECONDS : this.#number("time", this.#elapsed);
		const play = this.getAttribute("play") ?? settings.play ?? "live";
		const length = Math.max(0.1, this.#number("length", settings.length ?? MOMENT_SECONDS));
		const rest = Math.max(0, this.#number("rest", settings.rest ?? 1.5));
		const layers = this.#motion.matches ? [{ time: POSTER_SECONDS, opacity: 1 }] : stripLayers(time, { play, length, rest });
		this.#layers.forEach(({ layer, text, rings, link, icons }, index) => {
			const sample = layers[index];
			layer.hidden = !sample;
			if (!sample) return;
			layer.style.opacity = String(sample.opacity);
			const card = layer.firstElementChild;
			card.style.background = surface ? "" : "transparent";
			card.style.borderColor = surface ? "" : "transparent";
			card.firstElementChild.style.visibility = surface ? "" : "hidden";
			const frame = stripFrame(sample.time);
			text.style.backgroundPosition = `${(1 - frame.shimmer) * 100}% 0`;
			link.setAttribute("stroke-dashoffset", String(LINK_LENGTH * (1 - frame.link)));
			rings.forEach((ring, i) => {
				const [x, y] = RING_CENTRES[i];
				ring.setAttribute("opacity", String(frame.rings[i].opacity));
				ring.setAttribute("transform", `translate(${x} ${y}) scale(${frame.rings[i].scale}) translate(${-x} ${-y})`);
			});
			icons.forEach((icon, i) => {
				const pose = frame.icons[i];
				icon.style.opacity = String(pose.opacity);
				icon.style.transform = `translate(${pose.x}px, ${pose.y}px) rotate(${pose.rotation}deg) scale(${pose.scale})`;
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

if (!customElements.get("twg-search-strip")) customElements.define("twg-search-strip", TwgSearchStrip);
