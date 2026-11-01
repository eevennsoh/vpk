const MOMENT_SECONDS = 1.6;
const LABEL = "Search all your code, fast";
const CHARACTER_STAGGER_SECONDS = 0.012;
const TEXT_START_SECONDS = 0.36;
const TEXT_ENTER_SECONDS = 0.44;
const POSTER_SECONDS = TEXT_START_SECONDS + (LABEL.length - 1) * CHARACTER_STAGGER_SECONDS + TEXT_ENTER_SECONDS;
const out = (value) => 1 - (1 - Math.max(0, Math.min(1, value))) ** 3;
// Document-based URLs also work in the offline export.
const asset = (name) => new URL(`/1p/finale-pieces/assets/code-search/${name}`, document.baseURI).href;
const stylesheet = new URL("/1p/finale-pieces/code-search-greeting.css", document.baseURI).href;

class CodeSearchGreeting extends HTMLElement {
	static observedAttributes = ["time", "paused", "scale", "appearance", "surface", "play", "rest", "length"];
	#styles;
	#stage;
	#icon;
	#characters;
	#frame = 0;
	#elapsed = 0;
	#lastTick = null;
	#visible = true;
	#observer;
	#motion = matchMedia("(prefers-reduced-motion: reduce)");
	#refresh = () => this.redraw();

	connectedCallback() {
		if (!document.querySelector("link[data-code-search-greeting-style]")) {
			const link = document.createElement("link");
			link.rel = "stylesheet";
			link.href = stylesheet;
			link.dataset.codeSearchGreetingStyle = "";
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
		this.setAttribute("aria-label", LABEL);
		this.#stage = document.createElement("div");
		this.#stage.className = "code-search-stage";
		this.#stage.setAttribute("aria-hidden", "true");
		this.#stage.innerHTML = `
			<div class="code-search-icon">
				<img class="code-search-magnifier" src="${asset("magnifier.svg")}" alt="">
				<img class="code-search-right" src="${asset("bracket-right.svg")}" alt="">
				<img class="code-search-left" src="${asset("bracket-left.svg")}" alt="">
			</div>
			<p class="code-search-label">${[...LABEL].map((character) => `<span class="code-search-character">${character}</span>`).join("")}</p>`;
		this.#icon = this.#stage.querySelector(".code-search-icon");
		this.#characters = [...this.#stage.querySelectorAll(".code-search-character")];
		this.replaceChildren(this.#stage);
	}

	#numberAttribute(name, fallback) {
		const value = this.getAttribute(name);
		return value !== null && Number.isFinite(Number(value)) ? Number(value) : fallback;
	}

	#paint() {
		const settings = this.#styles?.codeSearchGreeting ?? {};
		const scale = Math.max(0.01, this.#numberAttribute("scale", 1));
		this.style.width = `${627 * scale}px`;
		this.style.height = `${146 * scale}px`;
		this.#stage.style.transform = `scale(${scale})`;
		const surface = this.getAttribute("surface");
		this.#stage.classList.toggle("no-surface", surface === "off" || (surface !== "on" && settings.surface === false));
		const time = Math.max(0, this.#numberAttribute("time", this.#elapsed));
		const play = this.getAttribute("play") ?? settings.play ?? "once";
		const length = Math.max(0.1, this.#numberAttribute("length", settings.length ?? MOMENT_SECONDS));
		const rest = Math.max(0, this.#numberAttribute("rest", settings.rest ?? 1.5));
		const elapsed = Math.min(play === "loop" ? time % (length + rest) : time, length);
		const pose = this.#motion.matches ? POSTER_SECONDS : elapsed * MOMENT_SECONDS / length;
		// Closely overlapping character entrances use Agent activity's cubic-out ease.
		const icon = out((pose - 0.12) / 0.4);
		this.#icon.style.opacity = String(icon);
		this.#icon.style.transform = `scale(${0.88 + 0.12 * icon})`;
		this.#characters.forEach((character, index) => {
			const progress = out((pose - TEXT_START_SECONDS - index * CHARACTER_STAGGER_SECONDS) / TEXT_ENTER_SECONDS);
			character.style.opacity = String(progress);
			character.style.transform = `translateX(${-8 * (1 - progress)}px)`;
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

if (!customElements.get("code-search-greeting")) customElements.define("code-search-greeting", CodeSearchGreeting);
