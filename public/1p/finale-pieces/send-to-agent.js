const MOMENT_SECONDS = 2.2;
const ITEM_START_SECONDS = 0.52;
const ITEM_STAGGER_SECONDS = 0.035;
const ITEM_FADE_SECONDS = 0.48;
const POSTER_SECONDS = ITEM_START_SECONDS + 11 * ITEM_STAGGER_SECONDS + ITEM_FADE_SECONDS;
const out = (value) => 1 - (1 - Math.max(0, Math.min(1, value))) ** 3;
// Document-based URLs also work in the offline export.
const asset = (name) => new URL(`/1p/finale-pieces/assets/send-to-agent/${name}`, document.baseURI).href;
const stylesheet = new URL("/1p/finale-pieces/send-to-agent.css", document.baseURI).href;

class SendToAgent extends HTMLElement {
	static observedAttributes = ["time", "paused", "scale", "appearance", "surface", "play", "rest", "length"];
	#styles;
	#stage;
	#menu;
	#items;
	#frame = 0;
	#elapsed = 0;
	#lastTick = null;
	#visible = true;
	#observer;
	#motion = matchMedia("(prefers-reduced-motion: reduce)");
	#refresh = () => this.redraw();

	connectedCallback() {
		if (!document.querySelector("link[data-send-to-agent-style]")) {
			const link = document.createElement("link");
			link.rel = "stylesheet";
			link.href = stylesheet;
			link.dataset.sendToAgentStyle = "";
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
		this.setAttribute("aria-label", "Send to agent: Claude Code, Codex, Cursor, Figma Make, Github Copilot, Lovable, Replit, Rovo CLI, VS Code. Open in Jira. Copy as prompt.");
		this.#stage = document.createElement("div");
		this.#stage.className = "send-agent-stage";
		this.#stage.setAttribute("aria-hidden", "true");
		const agents = [
			["Claude Code", "claude"], ["Codex", "openai"], ["Cursor", "cursor"],
			["Figma Make", "figma"], ["Github Copilot", "copilot"], ["Lovable", "lovable"],
			["Replit", "replit"], ["Rovo CLI", "rovo"], ["VS Code", "vscode"],
		];
		const row = (name, icon) => `<div class="send-agent-item send-agent-row"><span class="send-agent-icon"><img src="${asset(`${icon}.png`)}" alt=""></span><span>${name}</span></div>`;
		this.#stage.innerHTML = `
			<div class="send-agent-graphic">
				<div class="send-agent-trigger"><img src="${asset("add-agent.png")}" alt=""><span>Send to agent</span></div>
				<div class="send-agent-menu">
					<div class="send-agent-section">${agents.map(([name, icon]) => row(name, icon)).join("")}</div>
					<div class="send-agent-section"><p class="send-agent-item send-agent-heading">Open in...</p>${row("Jira", "jira")}</div>
					<div class="send-agent-section">${row("Copy as prompt", "clipboard")}</div>
				</div>
			</div>`;
		this.#menu = this.#stage.querySelector(".send-agent-menu");
		this.#items = [...this.#stage.querySelectorAll(".send-agent-item")];
		this.replaceChildren(this.#stage);
	}

	#numberAttribute(name, fallback) {
		const value = this.getAttribute(name);
		return value !== null && Number.isFinite(Number(value)) ? Number(value) : fallback;
	}

	#paint() {
		const settings = this.#styles?.sendToAgent ?? {};
		const scale = Math.max(0.01, this.#numberAttribute("scale", 1));
		this.style.width = `${604 * scale}px`;
		this.style.height = `${765 * scale}px`;
		this.#stage.style.transform = `scale(${scale})`;
		const surface = this.getAttribute("surface");
		this.#stage.classList.toggle("no-surface", surface === "off" || (surface !== "on" && settings.surface === false));
		const time = Math.max(0, this.#numberAttribute("time", this.#elapsed));
		const play = this.getAttribute("play") ?? settings.play ?? "once";
		const length = Math.max(0.1, this.#numberAttribute("length", settings.length ?? MOMENT_SECONDS));
		const rest = Math.max(0, this.#numberAttribute("rest", settings.rest ?? 1.5));
		const elapsed = Math.min(play === "loop" ? time % (length + rest) : time, length);
		const pose = this.#motion.matches ? POSTER_SECONDS : elapsed * MOMENT_SECONDS / length;
		// Smoothstep eases into and out of the slide without overshoot.
		const progress = Math.max(0, Math.min(1, (pose - 0.12) / 0.36));
		const menu = progress * progress * (3 - 2 * progress);
		this.#menu.style.opacity = String(menu);
		this.#menu.style.transform = `translateY(${-10 * (1 - menu)}px)`;
		this.#items.forEach((item, index) => {
			item.style.opacity = String(out((pose - ITEM_START_SECONDS - index * ITEM_STAGGER_SECONDS) / ITEM_FADE_SECONDS));
		});
		return play === "loop" || pose < POSTER_SECONDS;
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

if (!customElements.get("send-to-agent")) customElements.define("send-to-agent", SendToAgent);
