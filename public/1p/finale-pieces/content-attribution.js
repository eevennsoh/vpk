const MOMENT_SECONDS = 2.6;
const POSTER_SECONDS = 1.94;
const out = (value) => 1 - (1 - Math.max(0, Math.min(1, value))) ** 3;
// Document-based URLs also work in the offline export.
const asset = (name) => new URL(`/1p/finale-pieces/assets/content-attribution/${name}`, document.baseURI).href;
const stylesheet = new URL("/1p/finale-pieces/content-attribution.css", document.baseURI).href;

class ContentAttribution extends HTMLElement {
	static observedAttributes = ["time", "paused", "scale", "appearance", "surface", "play", "rest", "length"];
	#styles;
	#stage;
	#highlight;
	#bar;
	#icons;
	#label;
	#frame = 0;
	#elapsed = 0;
	#lastTick = null;
	#visible = true;
	#observer;
	#motion = matchMedia("(prefers-reduced-motion: reduce)");
	#refresh = () => this.redraw();

	connectedCallback() {
		if (!document.querySelector("link[data-content-attribution-style]")) {
			const link = document.createElement("link");
			link.rel = "stylesheet";
			link.href = stylesheet;
			link.dataset.contentAttributionStyle = "";
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
		this.setAttribute("aria-label", "Content Summarizer with Aoife Bourke. Agree on the MVP feature set for the next release. Resolve feedback on empty states.");
		this.#stage = document.createElement("div");
		this.#stage.className = "attribution-stage";
		this.#stage.setAttribute("aria-hidden", "true");
		this.#stage.innerHTML = `
			<div class="attribution-graphic">
			<div class="attribution-bar-window"><div class="attribution-bar">
				<div class="attribution-icons">
					<img class="attribution-agent" src="${asset("agent.svg")}" alt="">
					<img class="attribution-arrow" src="${asset("arrow.svg")}" alt="">
					<img class="attribution-connector" src="${asset("connector.svg")}" alt="">
					<img class="attribution-avatar" src="${new URL("/avatar-human/aoife-burke.png", document.baseURI).href}" alt="">
				</div>
				<p class="attribution-label">Content Summarizer with Aoife Bourke</p>
			</div></div>
			<div class="attribution-highlight"></div>
			<ul class="attribution-list">
				<li>Agree on the MVP feature set for the next release.</li>
				<li>Resolve feedback on empty states.</li>
			</ul></div>`;
		this.#highlight = this.#stage.querySelector(".attribution-highlight");
		this.#bar = this.#stage.querySelector(".attribution-bar");
		this.#icons = this.#stage.querySelector(".attribution-icons");
		this.#label = this.#stage.querySelector(".attribution-label");
		this.replaceChildren(this.#stage);
	}

	#numberAttribute(name, fallback) {
		const value = this.getAttribute(name);
		return value !== null && Number.isFinite(Number(value)) ? Number(value) : fallback;
	}

	#paint() {
		const settings = this.#styles?.contentAttribution ?? {};
		const scale = Math.max(0.01, this.#numberAttribute("scale", 1));
		this.style.width = `${811 * scale}px`;
		this.style.height = `${293 * scale}px`;
		this.#stage.style.transform = `scale(${scale})`;
		const surface = this.getAttribute("surface");
		this.#stage.classList.toggle("no-surface", surface === "off" || (surface !== "on" && settings.surface === false));
		const time = Math.max(0, this.#numberAttribute("time", this.#elapsed));
		const play = this.getAttribute("play") ?? settings.play ?? "once";
		const length = Math.max(0.1, this.#numberAttribute("length", settings.length ?? MOMENT_SECONDS));
		const rest = Math.max(0, this.#numberAttribute("rest", settings.rest ?? 1.5));
		const elapsed = Math.min(play === "loop" ? time % (length + rest) : time, length);
		const pose = this.#motion.matches ? POSTER_SECONDS : elapsed * MOMENT_SECONDS / length;
		const highlight = out((pose - 0.16) / 0.65);
		const bar = out((pose - 0.84) / 0.44);
		const icons = out((pose - 1.3) / 0.24);
		const label = out((pose - 1.5) / 0.44);
		this.#highlight.style.clipPath = `inset(0 ${(1 - highlight) * 100}% 0 0)`;
		this.#bar.style.transform = `translateY(${42.606 * (1 - bar)}px)`;
		this.#icons.style.opacity = String(icons);
		this.#icons.style.transform = `scale(${0.9 + 0.1 * icons})`;
		this.#label.style.opacity = String(label);
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

if (!customElements.get("content-attribution")) customElements.define("content-attribution", ContentAttribution);
