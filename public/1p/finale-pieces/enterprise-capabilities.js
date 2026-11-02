const MOMENT_SECONDS = 2.2;
const POSTER_SECONDS = 1.6;
const out = (value) => 1 - (1 - Math.max(0, Math.min(1, value))) ** 3;
const stylesheet = new URL("/1p/finale-pieces/enterprise-capabilities.css", document.baseURI).href;

class EnterpriseCapabilities extends HTMLElement {
	static observedAttributes = ["time", "paused", "scale", "appearance", "surface", "play", "rest", "length"];
	#styles;
	#stage;
	#number;
	#reels;
	#plus;
	#label;
	#frame = 0;
	#elapsed = 0;
	#lastTick = null;
	#visible = true;
	#observer;
	#motion = matchMedia("(prefers-reduced-motion: reduce)");
	#refresh = () => this.redraw();

	connectedCallback() {
		if (!document.querySelector("link[data-enterprise-capabilities-style]")) {
			const link = document.createElement("link");
			link.rel = "stylesheet";
			link.href = stylesheet;
			link.dataset.enterpriseCapabilitiesStyle = "";
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
		this.setAttribute("aria-label", "50+ new enterprise capabilities");
		this.#stage = document.createElement("div");
		this.#stage.className = "enterprise-stage";
		this.#stage.setAttribute("aria-hidden", "true");
		this.#stage.innerHTML = `
			<div class="enterprise-number">
				${["012345", "01234567890"].map((digits) => `
					<span class="enterprise-digit"><span class="enterprise-final">${digits.at(-1)}</span>
						<span class="enterprise-reel">${[...digits].map((digit) => `<span>${digit}</span>`).join("")}</span>
					</span>`).join("")}
				<span class="enterprise-plus">+</span>
			</div>
			<div class="enterprise-label"><span>New enterprise<br>capabilities</span></div>`;
		this.#number = this.#stage.querySelector(".enterprise-number");
		this.#reels = [...this.#stage.querySelectorAll(".enterprise-reel")];
		this.#plus = this.#stage.querySelector(".enterprise-plus");
		this.#label = this.#stage.querySelector(".enterprise-label > span");
		this.replaceChildren(this.#stage);
	}

	#numberAttribute(name, fallback) {
		const value = this.getAttribute(name);
		return value !== null && Number.isFinite(Number(value)) ? Number(value) : fallback;
	}

	#paint() {
		const settings = this.#styles?.enterpriseCapabilities ?? {};
		const scale = Math.max(0.01, this.#numberAttribute("scale", 1));
		this.style.width = `${583 * scale}px`;
		this.style.height = `${230 * scale}px`;
		this.#stage.style.transform = `scale(${scale})`;
		const surface = this.getAttribute("surface");
		this.#stage.classList.toggle("no-surface", surface === "off" || (surface !== "on" && settings.surface === false));
		const time = Math.max(0, this.#numberAttribute("time", this.#elapsed));
		const play = this.getAttribute("play") ?? settings.play ?? "once";
		const length = Math.max(0.1, this.#numberAttribute("length", settings.length ?? MOMENT_SECONDS));
		const rest = Math.max(0, this.#numberAttribute("rest", settings.rest ?? 1.5));
		const elapsed = Math.min(play === "loop" ? time % (length + rest) : time, length);
		const pose = this.#motion.matches ? POSTER_SECONDS : elapsed * MOMENT_SECONDS / length;
		this.#number.style.opacity = String(out(pose / 0.18));
		this.#reels[0].style.transform = `translateY(${-500 * out((pose - 0.1) / 1.15)}px)`;
		this.#reels[1].style.transform = `translateY(${-1000 * out((pose - 0.16) / 1.3)}px)`;
		const label = out((pose - 0.2) / 0.5);
		this.#label.style.opacity = String(label);
		this.#label.style.transform = `translateY(${8 * (1 - label)}px)`;
		const plus = out((pose - 1.1) / 0.36);
		this.#plus.style.opacity = String(plus);
		this.#plus.style.transform = `translateY(${6 * (1 - plus)}px) scale(${0.96 + 0.04 * plus})`;
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

if (!customElements.get("enterprise-capabilities")) customElements.define("enterprise-capabilities", EnterpriseCapabilities);
