export const MOMENT_SECONDS = 9.6;

export function sessionTime(seconds, { play = "live", length = MOMENT_SECONDS, rest = 1.5 } = {}) {
	const time = Math.max(0, seconds);
	if (play === "once") return Math.min(time, length);
	if (play === "loop") return Math.min(time % (length + rest), length);
	return time;
}

const asset = (path) => new URL(path, document.baseURI).href;
const stylesheet = asset("/1p/finale-pieces/agent-session-stack.css");
const ROWS = [
	{ name: "Mike", agent: "claude", person: "mike", state: "working" },
	{ name: "Sherif", agent: "cursor", person: "sherif", state: "unread" },
	{ name: "Tamar", agent: "rovo-dev", person: "tamar", state: "finished" },
];

class AgentSessionStack extends HTMLElement {
	static observedAttributes = ["time", "paused", "scale", "appearance", "surface", "play", "rest", "length"];
	#styles;
	#stage;
	#working;
	#frame = 0;
	#elapsed = 0;
	#lastTick = null;
	#visible = true;
	#observer;
	#motion = matchMedia("(prefers-reduced-motion: reduce)");
	#refresh = () => this.redraw();

	connectedCallback() {
		if (!document.querySelector("link[data-session-stack-style]")) {
			const link = document.createElement("link");
			link.rel = "stylesheet";
			link.href = stylesheet;
			link.dataset.sessionStackStyle = "";
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
		this.setAttribute("aria-label", "Mike’s Claude session is working. Sherif’s session is unread. Tamar’s session is finished.");
		this.#stage = document.createElement("div");
		this.#stage.className = "session-stack-stage";
		this.#stage.setAttribute("aria-hidden", "true");
		for (const [index, row] of ROWS.entries()) {
			const element = document.createElement("div");
			element.className = `session-stack-row ${row.state}`;
			element.style.top = `${92 + index * 200}px`;
			element.innerHTML = `<div class="session-stack-identity"><img class="session-stack-agent" src="${asset(`/illustration/jira-team-eu26-end/bento/artifacts-agent-${row.agent}.svg`)}" alt=""><img class="session-stack-person" src="${asset(`/avatar-user/${row.person}.png`)}" alt=""></div>
				<div class="session-stack-label"><p class="session-stack-name">${row.name}’s session</p>${row.state === "working" ? '<p class="session-stack-meta">Claude · <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="15" rx="1.5"/><path d="M12 18v4m-5 0h10"/></svg> 2m</p>' : ""}</div>
				${row.state === "working" ? `<div class="session-stack-working"><span class="session-stack-shimmer">Working</span><svg class="session-stack-orb" viewBox="0 0 20 20"><g>${Array.from({ length: 6 }, (_, i) => `<circle class="session-stack-dot dot-${i}" cx="10" cy="10" r="1.2" fill="currentColor"/>`).join("")}</g></svg></div>` : `<div class="session-stack-status">${row.state === "unread" ? '<span class="session-stack-unread"></span>' : '<svg width="58" height="58" viewBox="0 0 58 58"><circle cx="29" cy="29" r="29" fill="#82A94C"/><path d="m16 29 9 9 18-20" fill="none" stroke="white" stroke-width="6"/></svg>'}</div>`}`;
			this.#stage.append(element);
		}
		const fade = document.createElement("div");
		fade.className = "session-stack-fade";
		this.#stage.append(fade);
		this.#working = this.#stage.querySelector(".session-stack-working");
		this.replaceChildren(this.#stage);
	}

	#number(name, fallback) {
		const value = this.getAttribute(name);
		return value !== null && Number.isFinite(Number(value)) ? Number(value) : fallback;
	}

	#paint() {
		const settings = this.#styles?.agentSessionStack ?? {};
		const time = this.#motion.matches ? 0 : this.#number("time", this.#elapsed);
		const play = this.getAttribute("play") ?? settings.play ?? "live";
		const length = Math.max(0.1, this.#number("length", settings.length ?? MOMENT_SECONDS));
		const sample = sessionTime(time, { play, length, rest: Math.max(0, this.#number("rest", settings.rest ?? 1.5)) });
		// Paused CSS keyframes retain VPK's easing and bloom delay while following the film clock.
		this.#working.style.setProperty("--session-stack-time", `${-sample}s`);
		return play !== "once" || time < length;
	}

	redraw() {
		cancelAnimationFrame(this.#frame);
		this.#lastTick = null;
		if (!this.isConnected || !this.#stage) return;
		const scale = Math.max(0.01, this.#number("scale", 1));
		this.style.width = `${1174 * scale}px`;
		this.style.height = `${674 * scale}px`;
		this.#stage.style.transform = `scale(${scale})`;
		const surface = this.getAttribute("surface");
		this.#stage.classList.toggle("no-surface", surface === "off" || (surface !== "on" && this.#styles?.agentSessionStack?.surface === false));
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

if (!customElements.get("agent-session-stack")) customElements.define("agent-session-stack", AgentSessionStack);
