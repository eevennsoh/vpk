const MOMENT_SECONDS = 2.2;
const ITEM_START_SECONDS = 0.52;
const ITEM_STAGGER_SECONDS = 0.035;
const ITEM_FADE_SECONDS = 0.48;
const ITEMS_VISIBLE_SECONDS = ITEM_START_SECONDS + 3 * ITEM_STAGGER_SECONDS + ITEM_FADE_SECONDS;
const HOVER_SECONDS = 0.25;
const POSTER_SECONDS = ITEMS_VISIBLE_SECONDS + 4 * HOVER_SECONDS;
const out = (value) => 1 - (1 - Math.max(0, Math.min(1, value))) ** 3;
// Document-based URLs also work in the offline export.
const asset = (name) => new URL(`/1p/finale-pieces/assets/answer-sources/${name}`, document.baseURI).href;
const stylesheet = new URL("/1p/finale-pieces/answer-sources.css", document.baseURI).href;

class AnswerSources extends HTMLElement {
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
		if (!document.querySelector("link[data-answer-sources-style]")) {
			const link = document.createElement("link");
			link.rel = "stylesheet";
			link.href = stylesheet;
			link.dataset.answerSourcesStyle = "";
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
		this.setAttribute("aria-label", "An answer’s sources: Teamwork Graph, Q3 launch plan, LAUNCH-214: Ship the pricing page, #launch-team, Go/no-go notes, Sept 23.");
		this.#stage = document.createElement("div");
		this.#stage.className = "answer-sources-stage";
		this.#stage.setAttribute("aria-hidden", "true");
		const sources = [
			["confluence", "Q3 launch plan", "Page · Product Strategy · 2 days ago"],
			["jira", "LAUNCH-214: Ship the pricing page", "Work item · In Progress"],
			["slack", "#launch-team", "Channel · 14 new messages"],
			["confluence", "Go/no-go notes, Sept 23", "Page · Alex Rivera · 4 days ago"],
		];
		const icon = (app) => `<span class="answer-sources-icon ${app}"><img src="${asset(`${app}.svg`)}" alt=""></span>`;
		this.#stage.innerHTML = `
			<div class="answer-sources-graphic">
				<div class="answer-sources-trigger"><span class="answer-sources-stack">${["confluence", "jira", "slack"].map(icon).join("")}</span>Sources</div>
				<div class="answer-sources-menu">
					<div class="answer-sources-header"><span class="answer-sources-heading"><svg width="16" height="16" viewBox="0 0 16 16"><path fill="currentColor" d="M5.5 12.25a1.75 1.75 0 1 0-3.5 0 1.75 1.75 0 0 0 3.5 0m8.5 0a1.75 1.75 0 1 0-3.5 0 1.75 1.75 0 0 0 3.5 0m0-8.5a1.75 1.75 0 1 0-3.5 0 1.75 1.75 0 0 0 3.5 0m-7 8.5a3.25 3.25 0 1 1-6.5 0 3.25 3.25 0 0 1 6.5 0m-1.5-8.5a1.75 1.75 0 1 0-3.5 0 1.75 1.75 0 0 0 3.5 0m1.5 0c0 .61-.169 1.18-.46 1.668l4.04 4.042a3.25 3.25 0 1 1-1.074 1.047L5.492 6.492A3.25 3.25 0 1 1 7 3.75m8.5 0a3.25 3.25 0 1 1-6.5 0 3.25 3.25 0 0 1 6.5 0"/></svg>Teamwork Graph</span><span class="answer-sources-close">×</span></div>
					<div class="answer-sources-body"><div class="answer-sources-count">Sources (4)</div><div class="answer-sources-list">
						${sources.map(([app, title, meta]) => `<div class="answer-sources-item">${icon(app)}<span class="answer-sources-text"><span class="answer-sources-title">${title}</span><span class="answer-sources-meta">${meta}</span></span></div>`).join("")}
					</div></div>
				</div>
			</div>`;
		this.#menu = this.#stage.querySelector(".answer-sources-menu");
		this.#items = [...this.#stage.querySelectorAll(".answer-sources-item")];
		this.replaceChildren(this.#stage);
	}

	#numberAttribute(name, fallback) {
		const value = this.getAttribute(name);
		return value !== null && Number.isFinite(Number(value)) ? Number(value) : fallback;
	}

	#paint() {
		const settings = this.#styles?.sourcesPopover ?? {};
		const scale = Math.max(0.01, this.#numberAttribute("scale", 1));
		this.style.width = `${604 * scale}px`;
		this.style.height = `${478 * scale}px`;
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
			item.classList.toggle("is-hovered", pose < POSTER_SECONDS && index === Math.floor((pose - ITEMS_VISIBLE_SECONDS) / HOVER_SECONDS));
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

if (!customElements.get("answer-sources")) customElements.define("answer-sources", AnswerSources);
