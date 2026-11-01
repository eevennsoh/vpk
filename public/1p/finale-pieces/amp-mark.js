const MOMENT_SECONDS = 2.6;
const POSTER_SECONDS = 2.12;
const out = (value) => 1 - (1 - Math.max(0, Math.min(1, value))) ** 3;
const smooth = (value) => {
	const t = Math.max(0, Math.min(1, value));
	return t * t * (3 - 2 * t);
};
// Document-based URLs also work in the offline export.
const stylesheet = new URL("/1p/finale-pieces/amp-mark.css", document.baseURI).href;

let instance = 0;
function markSvg(id) {
 return `<svg class="amp-art" width="302" height="102.9037" viewBox="0 0 302 102.9037" fill="none" xmlns="http://www.w3.org/2000/svg">
 <g transform="translate(20.8568 5.5557)"><svg preserveAspectRatio="none" overflow="visible" style="display: block;" width="86.2203" height="91.5956" viewBox="0 0 86.2203 91.5956" fill="none" xmlns="http://www.w3.org/2000/svg">
<mask id="amp-hex-${id}" maskUnits="userSpaceOnUse" x="-0.60757" y="-0.60757" width="87" height="93" fill="black">
<rect fill="white" x="-0.60757" y="-0.60757" width="87" height="93"/>
<path d="M38.0388 4.69339C41.1769 2.95878 45.0433 2.95877 48.1815 4.69339L77.7565 21.0408C80.8946 22.7754 82.8278 25.9811 82.8278 29.4504V62.1452C82.8278 65.6145 80.8946 68.8202 77.7565 70.5548L48.1815 86.9022C45.0433 88.6368 41.1769 88.6368 38.0388 86.9022L8.4638 70.5548C5.32563 68.8202 3.39243 65.6145 3.39243 62.1452V29.4504C3.39243 25.9811 5.32563 22.7754 8.4638 21.0408L38.0388 4.69339Z"/>
</mask>
<path class="amp-line" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" d="M38.0388 4.69339C41.1769 2.95878 45.0433 2.95877 48.1815 4.69339L77.7565 21.0408C80.8946 22.7754 82.8278 25.9811 82.8278 29.4504V62.1452C82.8278 65.6145 80.8946 68.8202 77.7565 70.5548L48.1815 86.9022C45.0433 88.6368 41.1769 88.6368 38.0388 86.9022L8.4638 70.5548C5.32563 68.8202 3.39243 65.6145 3.39243 62.1452V29.4504C3.39243 25.9811 5.32563 22.7754 8.4638 21.0408L38.0388 4.69339Z" stroke-width="6.78486" stroke="currentColor" mask="url(#amp-hex-${id})"/>
</svg>
</g>
 ${[0, -120, 120].map((rotation, pair) => `<g transform="rotate(${rotation} 63.828 52.486)"><svg x="46.706" y="18.841" width="34.158" height="67.145" viewBox="0 0 120.817 237.543" overflow="visible">
 <defs>${[0,1].map((i)=>`<mask id="amp-loop-${id}-${pair}-${i}" maskUnits="userSpaceOnUse" x="-5" y="-5" width="132" height="250"><circle class="amp-line" cx="${i ? 60.8223 : 60.065}" cy="${i ? 177.095 : 60.5176}" r="57" fill="none" stroke="white" stroke-width="14" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" transform="rotate(${i ? -90 : 90} ${i ? 60.8223 : 60.065} ${i ? 177.095 : 60.5176})"/></mask>`).join("")}</defs>
 <path d="M60.065 119.144C60.065 118.394 60.065 117.644 60.065 116.894C54.1497 116.771 48.2919 115.731 42.7472 113.81C20.3312 106.323 4.49992 83.7071 5.09456 60.5176C4.73488 31.2445 31.0676 5.32377 60.065 6.0159C60.065 6.0159 60.065 6.0159 60.065 6.0159C89.0624 5.32377 115.395 31.2445 115.035 60.5176C115.63 83.7071 99.7988 106.323 77.3827 113.81C71.8381 115.731 65.9802 116.771 60.065 116.894C60.065 117.644 60.065 118.394 60.065 119.144C66.2108 119.272 72.3859 118.432 78.2977 116.628C102.187 109.678 120.221 85.8887 120.098 60.5176C121.228 28.5328 92.3254 -0.781446 60.065 0.0158996C60.065 0.0158996 60.065 0.0158996 60.065 0.0158996C27.8046 -0.781453 -1.09775 28.5328 0.0320572 60.5176C-0.0908382 85.8887 17.9426 109.678 41.8323 116.628C47.7441 118.432 53.9191 119.272 60.065 119.144ZM60.065 116.894L60.065 119.144L60.065 116.894Z" fill="currentColor" mask="url(#amp-loop-${id}-${pair}-0)"/><path d="M60.8223 118.538C60.8223 119.288 60.8223 120.038 60.8223 120.788C54.9143 120.911 49.0637 121.95 43.5261 123.869C21.1381 131.347 5.32741 153.935 5.9216 177.095C5.56283 206.331 31.862 232.218 60.8223 231.527C60.8223 231.527 60.8223 231.527 60.8223 231.527C89.7825 232.218 116.082 206.331 115.723 177.095C116.317 153.935 100.506 131.347 78.1184 123.869C72.5808 121.95 66.7302 120.911 60.8223 120.788C60.8223 120.038 60.8223 119.288 60.8223 118.538C66.9608 118.411 73.1285 119.25 79.0334 121.051C102.895 127.993 120.908 151.754 120.785 177.095C121.914 209.043 93.0455 238.324 60.8223 237.527C60.8223 237.527 60.8223 237.527 60.8223 237.527C28.599 238.324 -0.269798 209.043 0.859099 177.095C0.736646 151.754 18.7495 127.993 42.6111 121.051C48.516 119.25 54.6837 118.411 60.8223 118.538ZM60.8223 120.788L60.8223 118.538L60.8223 120.788Z" fill="currentColor" mask="url(#amp-loop-${id}-${pair}-1)"/>
 </svg></g>`).join("")}
 </svg>`;
}

class AmpMark extends HTMLElement {
	static observedAttributes = ["time", "paused", "scale", "appearance", "surface", "play", "rest", "length"];
	#styles;
	#stage;
	#lines;
	#label;
	#frame = 0;
	#elapsed = 0;
	#lastTick = null;
	#visible = true;
	#observer;
	#motion = matchMedia("(prefers-reduced-motion: reduce)");
	#refresh = () => this.redraw();

	connectedCallback() {
		if (!document.querySelector("link[data-amp-mark-style]")) {
			const link = document.createElement("link");
			link.rel = "stylesheet";
			link.href = stylesheet;
			link.dataset.ampMarkStyle = "";
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
		this.setAttribute("aria-label", "AMP");
		this.#stage = document.createElement("div");
		this.#stage.className = "amp-stage";
		this.#stage.setAttribute("aria-hidden", "true");
		this.#stage.innerHTML = `${markSvg(++instance)}<span class="amp-label">AMP</span>`;
		this.#label = this.#stage.querySelector(".amp-label");
		const lines = [...this.#stage.querySelectorAll(".amp-line")];
		// Hexagon, then top, upper-right, lower-right, bottom, lower-left, upper-left.
		this.#lines = [0, 1, 4, 5, 2, 3, 6].map((index) => lines[index]);
		this.replaceChildren(this.#stage);
	}

	#numberAttribute(name, fallback) {
		const value = this.getAttribute(name);
		return value !== null && Number.isFinite(Number(value)) ? Number(value) : fallback;
	}

	#paint() {
		const settings = this.#styles?.ampMark ?? {};
		const scale = Math.max(0.01, this.#numberAttribute("scale", 1));
		this.style.width = `${302 * scale}px`;
		this.style.height = `${102.9037 * scale}px`;
		this.#stage.style.transform = `scale(${scale})`;
		const surface = this.getAttribute("surface");
		this.#stage.classList.toggle("no-surface", surface === "off" || (surface !== "on" && settings.surface === false));
		const time = Math.max(0, this.#numberAttribute("time", this.#elapsed));
		const play = this.getAttribute("play") ?? settings.play ?? "once";
		const length = Math.max(0.1, this.#numberAttribute("length", settings.length ?? MOMENT_SECONDS));
		const rest = Math.max(0, this.#numberAttribute("rest", settings.rest ?? 1.5));
		const elapsed = Math.min(play === "loop" ? time % (length + rest) : time, length);
		const pose = this.#motion.matches ? POSTER_SECONDS : elapsed * MOMENT_SECONDS / length;
		this.#label.style.opacity = String(out((pose - 0.84) / 0.44));
		this.#lines.forEach((line, index) => {
			const start = index === 0 ? 0.12 : 0.8 + (index - 1) * 0.12;
			const progress = index === 0 ? out((pose - start) / 0.72) : smooth((pose - start) / 0.6);
			line.setAttribute("stroke-dashoffset", index === 0 ? String(1 - progress) : "0");
			line.setAttribute("stroke-dasharray", index === 0 && progress < 1 ? "1" : "none");
			line.style.opacity = index === 0 ? (progress === 0 ? "0" : "1") : String(progress);
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

if (!customElements.get("amp-mark")) customElements.define("amp-mark", AmpMark);
