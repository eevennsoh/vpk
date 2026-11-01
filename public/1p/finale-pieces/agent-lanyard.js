export const PULSE_SECONDS = 0.6;
export const DEFAULT_INTERVAL = 4;

/** Data and wave geometry come from VPK's shared agent-lanyard component. */
export function registerAgentLanyard({ agents, paths, times }) {
	if (customElements.get("agent-lanyard-sticker")) return;
	const byId = new Map(agents.map((agent) => [agent.id, agent]));
	const asset = (path) => new URL(path, document.baseURI).href;
	let instance = 0;

	class AgentLanyardSticker extends HTMLElement {
		static observedAttributes = ["time", "paused", "scale", "appearance", "surface", "play", "rest", "length"];
		#styles;
		#stage;
		#animations = [];
		#timing = "";
		#visible = false;
		#observer;
		#motion = matchMedia("(prefers-reduced-motion: reduce)");
		#refresh = () => this.redraw();

		connectedCallback() {
			if (!document.querySelector("link[data-agent-lanyard-style]")) {
				const link = document.createElement("link");
				link.rel = "stylesheet";
				link.href = asset("/1p/finale-pieces/agent-lanyard.css");
				link.dataset.agentLanyardStyle = "";
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
			this.#animations.forEach((animation) => animation.cancel());
			this.#animations = [];
			this.#timing = "";
			this.#visible = false;
			this.#observer?.disconnect();
			this.#motion.removeEventListener("change", this.#refresh);
			document.removeEventListener("visibilitychange", this.#refresh);
		}

		attributeChangedCallback(name) {
			if (name === "time" || name === "paused") this.#playback();
			else this.redraw();
		}
		get pieceStyles() { return this.#styles; }
		set pieceStyles(value) { this.#styles = value; this.redraw(); }

		#build() {
			const maskId = `sticker-lanyard-wave-${++instance}`;
			this.setAttribute("role", "img");
			this.#stage = document.createElement("div");
			this.#stage.className = "lanyard-stage";
			this.#stage.setAttribute("aria-hidden", "true");
			this.#stage.innerHTML = `<div class="lanyard-cover">
				<svg class="lanyard-grid" viewBox="0 0 252 108" fill="none">
					<defs><mask id="${maskId}"><circle class="lanyard-wave" cx="126" cy="54" r="0" stroke="white" stroke-width="42" opacity="0"/></mask></defs>
					<path class="lanyard-grid-base" d="${paths[0]}" stroke="currentColor" stroke-opacity=".6" stroke-dasharray=".01 3" stroke-linecap="round"/>
					<path class="lanyard-grid-accent" d="${paths[0]}" mask="url(#${maskId})" stroke-dasharray=".01 3" stroke-linecap="round"/>
				</svg>
				<span class="lanyard-cutout"></span><img class="lanyard-avatar" width="54" height="60" alt="">
			</div>
			<div class="lanyard-body">
				<div><div class="lanyard-title"><span class="lanyard-name"></span><img class="lanyard-verified" src="${asset("/1p/finale-pieces/assets/agent-lanyard/verified.svg")}" alt=""></div><p class="lanyard-publisher"></p></div>
				<p class="lanyard-description"></p>
				<div class="lanyard-actions"><span class="lanyard-chat"><img src="${asset("/1p/finale-pieces/assets/agent-lanyard/chat.svg")}" alt=""></span><span class="lanyard-connect">Connect</span><span class="lanyard-more">···</span></div>
			</div>`;
			this.replaceChildren(this.#stage);
		}

		#number(name, fallback) {
			const value = this.getAttribute(name);
			return value !== null && Number.isFinite(Number(value)) ? Number(value) : fallback;
		}

		redraw() {
			if (!this.isConnected || !this.#stage) return;
			const settings = this.#styles?.agentLanyard ?? {};
			const agent = byId.get(settings.agentId) ?? agents[0];
			const avatar = byId.get(settings.avatarId) ?? agent;
			const name = settings.agentName || agent.name;
			this.setAttribute("aria-label", `${name}. ${agent.publisher}. ${agent.description}`);
			this.#stage.querySelector(".lanyard-name").textContent = name;
			this.#stage.querySelector(".lanyard-publisher").textContent = agent.publisher;
			this.#stage.querySelector(".lanyard-description").textContent = agent.description;
			this.#stage.querySelector(".lanyard-avatar").src = asset(avatar.avatarSrc);
			this.#stage.querySelector(".lanyard-grid-accent").setAttribute("stroke", avatar.accentColor ?? "currentColor");
			this.#stage.querySelector(".lanyard-verified").hidden = !agent.verified;
			this.#stage.querySelector(".lanyard-chat").hidden = agent.action !== "chat";
			this.#stage.querySelector(".lanyard-connect").hidden = agent.action !== "connect";
			const scale = Math.max(0.01, this.#number("scale", 1));
			this.style.width = `${252 * scale}px`;
			this.style.height = `${280 * scale}px`;
			this.#stage.style.transform = `scale(${scale})`;
			const surface = this.getAttribute("surface");
			this.#stage.classList.toggle("no-surface", surface === "off" || (surface !== "on" && settings.surface === false));
			this.#playback();
		}

		#playback() {
			if (!this.isConnected || !this.#stage) return;
			const settings = this.#styles?.agentLanyard ?? {};
			const play = this.getAttribute("play") ?? settings.play ?? "live";
			const length = Math.max(PULSE_SECONDS, this.#number("length", settings.length ?? PULSE_SECONDS));
			const hasRest = this.hasAttribute("rest") || settings.rest !== undefined;
			const interval = play === "loop" && hasRest
				? length + Math.max(0, this.#number("rest", settings.rest ?? 1.5))
				: settings.pulseInterval ?? DEFAULT_INTERVAL;
			const duration = play === "once" ? length : Math.max(PULSE_SECONDS, interval);
			const timing = `${play}:${duration}`;
			if (timing !== this.#timing) {
				this.#animations.forEach((animation) => animation.cancel());
				const offsets = times.map((time) => time * PULSE_SECONDS / duration);
				const wave = paths.map((path, index) => ({ d: `path("${path}")`, offset: offsets[index] }));
				if (offsets.at(-1) < 1) wave.push({ d: `path("${paths[0]}")`, offset: 1 });
				const radii = [0, 18.48, 47.74, 81.62, 118.58, 154];
				const opacity = [0, 1, 1, 0.9, 0.45, 0];
				const ring = offsets.map((offset, index) => ({ r: `${radii[index]}px`, opacity: opacity[index], offset }));
				if (offsets.at(-1) < 1) ring.push({ r: "154px", opacity: 0, offset: 1 });
				const options = { duration: duration * 1000, iterations: play === "once" ? 1 : Infinity, fill: "both", easing: "linear" };
				this.#animations = [
					this.#stage.querySelector(".lanyard-grid-base").animate(wave, options),
					this.#stage.querySelector(".lanyard-grid-accent").animate(wave, options),
					this.#stage.querySelector(".lanyard-wave").animate(ring, options),
				];
				this.#timing = timing;
			}
			const disabled = this.#motion.matches || settings.animateGrid === false;
			const seek = this.hasAttribute("time");
			for (const animation of this.#animations) {
				if (disabled || seek || this.hasAttribute("paused") || !this.#visible || document.hidden) animation.pause();
				else if (animation.playState === "paused") animation.play();
				if (disabled || seek) animation.currentTime = disabled ? 0 : Math.max(0, this.#number("time", 0)) * 1000;
			}
		}
	}

	customElements.define("agent-lanyard-sticker", AgentLanyardSticker);
}
