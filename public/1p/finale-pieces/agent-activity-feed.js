/** Short, cubic-out entrances on the same seconds-based clock as the stage kit. */
export const ROW_STAGGER_SECONDS = 0.24;
export const ICON_LEAD_SECONDS = 0.12;
export const FIRST_ROW_SECONDS = 0.28;
export const POSTER_SECONDS = 2.4;
export const MOMENT_SECONDS = 3;
const CROSSFADE_SECONDS = 0.5;
const ICON_FADE_SECONDS = 0.12;
const clamp = (value) => Math.max(0, Math.min(1, value));
const out = (value) => 1 - (1 - clamp(value)) ** 3;

/** The kit's app-icon spring at half speed, so growth stays visible after the fade. */
function settle(seconds) {
	if (seconds <= 0) return 0;
	if (seconds >= 0.8) return 1;
	const time = seconds * 0.5;
	const omega = Math.sqrt(260 / 0.85);
	const decay = 28 / (2 * 0.85);
	const damped = Math.sqrt(omega * omega - decay * decay);
	return 1 - Math.exp(-decay * time) * (Math.cos(damped * time) + decay / damped * Math.sin(damped * time));
}

/** Pure samples keep scrubbing, pauses and frame exports deterministic. */
export function activityFrame(seconds) {
	const time = Math.max(0, seconds);
	return Array.from({ length: 5 }, (_, index) => {
		const elapsed = time - FIRST_ROW_SECONDS - index * ROW_STAGGER_SECONDS;
		const text = out((elapsed - ICON_LEAD_SECONDS) / 0.44);
		return {
			icon: { opacity: out(elapsed / ICON_FADE_SECONDS), scale: 0.76 + 0.24 * settle(elapsed) },
			text: { opacity: text, x: -16 * (1 - text) },
		};
	});
}

/** Replay the row sequence only after the list's half-second crossfade is complete. */
export function activityLayers(seconds, { play = "once", length = MOMENT_SECONDS, rest = 1.5 } = {}) {
	const time = Math.max(0, seconds);
	if (play === "live") return [{ time, opacity: 1 }];
	if (play === "once") return [{ time: Math.min(time, length), opacity: 1 }];
	const period = length + rest;
	if (time < period) return [{ time: Math.min(time, length), opacity: 1 }];
	const phase = (time - period) % (period + CROSSFADE_SECONDS);
	if (phase < CROSSFADE_SECONDS) {
		const blend = phase / CROSSFADE_SECONDS;
		return [{ time: length, opacity: 1 - blend }, { time: 0, opacity: blend }];
	}
	return [{ time: Math.min(phase - CROSSFADE_SECONDS, length), opacity: 1 }];
}

// Document-based paths survive both namespaced deployments and offline blob modules.
const asset = (name) => new URL(`/1p/finale-pieces/assets/agent-activity/${name}`, document.baseURI).href;
const stylesheet = new URL("/1p/finale-pieces/agent-activity-feed.css", document.baseURI).href;
const ROWS = [
	{ name: "Claude", action: "edited Confluence live doc", icon: "claude.svg", iconClass: "activity-agent" },
	{ name: "Incident triage", action: "created Jira work item", icon: "agent-blue.svg", symbol: "arrow-right.svg" },
	{ name: "Rovo", action: "sent release notes to Slack", icon: "agent-black.svg", symbol: "rovo.svg" },
	{ name: "ChatGPT", action: "created Jira work item", icon: "chatgpt.svg", iconClass: "activity-chatgpt" },
	{ name: "Release notifier", action: "sent release notes to Slack", icon: "agent-blue.svg", symbol: "automation.svg" },
];

/** A local library piece following the kit's attributes and deterministic film clock. */
class AgentActivityFeed extends HTMLElement {
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
		if (!document.querySelector("link[data-agent-activity-style]")) {
			const link = document.createElement("link");
			link.rel = "stylesheet";
			link.href = stylesheet;
			link.dataset.agentActivityStyle = "";
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
		this.setAttribute("aria-label", `Agent activity. ${ROWS.map(({ name, action }) => `${name} ${action}`).join(". ")}.`);
		this.#stage = document.createElement("div");
		this.#stage.className = "activity-stage";
		this.#stage.setAttribute("aria-hidden", "true");
		this.#stage.innerHTML = '<section class="activity-panel"><h2 class="activity-heading">Agent activity</h2><div class="activity-list"></div></section>';
		const list = this.#stage.querySelector(".activity-list");
		this.#layers = [0, 1].map(() => {
			const layer = document.createElement("div");
			layer.className = "activity-layer";
			const rows = ROWS.map(({ name, action, icon, symbol, iconClass }) => {
				const row = document.createElement("div");
				row.className = "activity-row";
				row.innerHTML = `<span class="activity-icon"><img class="${iconClass ?? "activity-hex"}" src="${asset(icon)}" alt="">${symbol ? `<img class="${name === "Rovo" ? "activity-rovo" : "activity-symbol"}" src="${asset(symbol)}" alt="">` : ""}</span><p class="activity-text"><strong${name === "Rovo" ? ' class="activity-rovo-name"' : ""}>${name}</strong> ${action}</p>`;
				layer.append(row);
				return { icon: row.querySelector(".activity-icon"), text: row.querySelector(".activity-text") };
			});
			list.append(layer);
			return { layer, rows };
		});
		this.replaceChildren(this.#stage);
	}

	#number(name, fallback) {
		const value = this.getAttribute(name);
		return value !== null && Number.isFinite(Number(value)) ? Number(value) : fallback;
	}

	#paint() {
		const settings = this.#styles?.agentActivityFeed ?? {};
		const scale = Math.max(0.01, this.#number("scale", 1));
		this.style.width = `${804 * scale}px`;
		this.style.height = `${469 * scale}px`;
		this.#stage.style.transform = `scale(${scale})`;
		const surface = this.getAttribute("surface");
		this.#stage.classList.toggle("no-surface", surface === "off" || (surface !== "on" && settings.surface === false));
		const time = this.#motion.matches ? POSTER_SECONDS : this.#number("time", this.#elapsed);
		const play = this.#motion.matches ? "once" : this.getAttribute("play") ?? settings.play ?? "once";
		const length = this.#motion.matches ? MOMENT_SECONDS : Math.max(0.1, this.#number("length", settings.length ?? MOMENT_SECONDS));
		const layers = activityLayers(time, {
			play,
			length,
			rest: Math.max(0, this.#number("rest", settings.rest ?? 1.5)),
		});
		this.#layers.forEach(({ layer, rows }, index) => {
			const sample = layers[index];
			layer.hidden = !sample;
			if (!sample) return;
			layer.style.opacity = String(sample.opacity);
			const poses = activityFrame(sample.time);
			rows.forEach(({ icon, text }, i) => {
				const pose = poses[i];
				icon.style.opacity = String(pose.icon.opacity);
				icon.style.transform = `scale(${pose.icon.scale})`;
				text.style.opacity = String(pose.text.opacity);
				text.style.transform = `translateX(${pose.text.x}px)`;
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

if (!customElements.get("agent-activity-feed")) customElements.define("agent-activity-feed", AgentActivityFeed);
