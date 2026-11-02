// Figma 415:6732. The original filled SVGs are revealed through stroked masks.
export const MOMENT_SECONDS = 3.2;
const clamp = (value) => Math.max(0, Math.min(1, value));
const out = (value) => 1 - (1 - clamp(value)) ** 3;
const asset = (name) => new URL(`/1p/finale-pieces/assets/atlassian-connect/${name}.svg`, document.baseURI).href;
const stylesheet = new URL("/1p/finale-pieces/atlassian-connect.css", document.baseURI).href;
const image = (name, width, height, position = "") => `<img src="${asset(name)}" width="${width}" height="${height}" alt="" draggable="false" style="${position}">`;
let sequence = 0;

const LOGOS = [
	{ name: "Microsoft Teams", className: "teams", art: `<span class="connect-tile">${image("ebaa4", 29.1819, 30.8031, "left:11.945px;top:10.236px")}</span>` },
	{ name: "Figma", className: "figma", art: `<span class="connect-tile"><span class="connect-glyph">
		${image("69449", 10.4937, 10.2377, "left:13.512px;top:29.486px")}
		${image("5e5a4", 10.4937, 10.2431, "left:13.502px;top:19.243px")}
		${image("9ca2f", 10.4937, 10.2431, "left:13.5px;top:9px")}
		${image("23bea", 10.4937, 10.2377, "left:24.048px;top:9px")}
		${image("1fa01", 10.5487, 10.2377, "left:24.048px;top:19.243px")}
	</span></span>` },
	{ name: "Slack", className: "slack", art: `<span class="connect-tile"><span class="connect-glyph">
		${image("dd1b2", 14.1801, 14.1882, "left:9.024px;top:24.816px")}
		${image("f18fd", 14.2038, 14.2119, "left:9px;top:9px")}
		${image("b8413", 14.1801, 14.2119, "left:24.802px;top:9px")}
		${image("e4320", 14.2038, 14.1882, "left:24.802px;top:24.816px")}
	</span></span>` },
	{ name: "OpenAI", className: "agent", art: image("5ce81", 64.7926, 69.1855, "left:-4.396px;top:-6.591px") },
	{ name: "Claude", className: "agent", art: image("95d70", 64.7926, 69.1855, "left:-4.396px;top:-6.591px") },
];
const ROUTES = [
	{ file: "84039", height: 47.5, path: "M.75 .75V.961113C.75 10.0186 8.092 17.3611 17.15 17.3611H61.35C70.4075 17.3611 77.75 24.7036 77.75 33.7611V46.75L72.977 41.977L77.75 46.75L82.523 41.977" },
	{ file: "3f619", height: 46.75, path: "M82.523 46.75V33.7611C82.523 24.7036 75.1805 17.3611 66.123 17.3611H21.923C12.8655 17.3611 5.52297 10.0186 5.52297 .961113V.75L.75 5.523L5.52297 .75L10.296 5.523" },
];

export function connectFrame(seconds) {
	const letters = Math.floor(clamp((seconds - 1.05) / 0.58) * 10);
	return {
		window: out(seconds / 0.22),
		logos: LOGOS.map((_, index) => ({ opacity: out((seconds - 0.08 - index * 0.055) / 0.18), y: 7 * (1 - out((seconds - 0.08 - index * 0.055) / 0.4)) })),
		lines: [out((seconds - 0.48) / 0.64), out((seconds - 1.72) / 0.64)],
		text: "@Atlassian".slice(0, letters),
		caret: seconds < 0.85 ? 0 : seconds < 2.5 ? (Math.floor((seconds - 0.85) / 0.32) % 2 === 0 ? 1 : 0) : 1,
	};
}

export function connectTime(seconds, { play = "once", length = MOMENT_SECONDS, rest = 1.5 } = {}) {
	const time = Math.max(0, seconds);
	return Math.min(play === "loop" ? time % (length + rest) : time, length);
}

class AtlassianConnect extends HTMLElement {
	static observedAttributes = ["time", "paused", "scale", "appearance", "surface", "play", "rest", "length"];
	#styles;
	#stage;
	#logos = [];
	#lines = [];
	#text;
	#caret;
	#window;
	#frame = 0;
	#elapsed = 0;
	#lastTick = null;
	#visible = true;
	#observer;
	#motion = matchMedia("(prefers-reduced-motion: reduce)");
	#refresh = () => this.redraw();

	connectedCallback() {
		if (!document.querySelector("link[data-atlassian-connect-style]")) {
			const link = document.createElement("link");
			link.rel = "stylesheet";
			link.href = stylesheet;
			link.dataset.atlassianConnectStyle = "";
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
		this.setAttribute("role", "group");
		this.setAttribute("aria-label", "Apps and agents connected through Atlassian");
		this.#stage = document.createElement("div");
		this.#stage.className = "connect-stage";
		const instance = ++sequence;
		this.#stage.innerHTML = `
			<div class="connect-window" aria-hidden="true">
				<div class="connect-dots">${[0, 1, 2].map(() => image("8b39c", 20, 20)).join("")}</div>
			</div>
			<div class="connect-mention" aria-hidden="true"><span class="connect-text"></span><span class="connect-caret"></span></div>
			<span class="connect-sr">@Atlassian</span>
			<div class="connect-stack">${LOGOS.map((logo) => `
				<button type="button" class="connect-logo ${logo.className}" aria-label="Replay ${logo.name} connection" title="Replay ${logo.name} connection">
					<span class="connect-logo-enter"><span class="connect-logo-art">${logo.art}</span></span>
				</button>`).join("")}</div>
			${ROUTES.map((route, index) => `
				<svg class="connect-line line-${index}" width="83.273" height="${route.height}" viewBox="0 0 83.273 ${route.height}" aria-hidden="true">
					<defs><mask id="connect-${instance}-${index}" maskUnits="userSpaceOnUse" x="-2" y="-2" width="88" height="52">
						<path class="connect-line-mask" d="${route.path}" pathLength="100" fill="none" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="100 110" />
					</mask></defs>
					<image href="${asset(route.file)}" width="83.273" height="${route.height}" mask="url(#connect-${instance}-${index})" />
				</svg>`).join("")}`;
		this.#logos = [...this.#stage.querySelectorAll(".connect-logo")];
		this.#lines = [...this.#stage.querySelectorAll(".connect-line-mask")];
		this.#text = this.#stage.querySelector(".connect-text");
		this.#caret = this.#stage.querySelector(".connect-caret");
		this.#window = this.#stage.querySelector(".connect-window");
		for (const button of this.#logos) button.addEventListener("click", () => {
			if (button.disabled) return;
			this.#elapsed = 0;
			this.redraw();
		});
		this.replaceChildren(this.#stage);
	}

	#number(name, fallback) {
		const value = this.getAttribute(name);
		return value !== null && Number.isFinite(Number(value)) ? Number(value) : fallback;
	}

	#paint() {
		const settings = this.#styles?.atlassianConnect ?? {};
		const scale = Math.max(0.01, this.#number("scale", 1));
		this.style.width = `${604 * scale}px`;
		this.style.height = `${442 * scale}px`;
		this.#stage.style.transform = `scale(${scale})`;
		const surface = this.getAttribute("surface");
		this.#stage.classList.toggle("no-surface", surface === "off" || (surface !== "on" && settings.surface === false));
		const time = this.#number("time", this.#elapsed);
		const play = this.getAttribute("play") ?? settings.play ?? "once";
		const length = Math.max(0.1, this.#number("length", settings.length ?? MOMENT_SECONDS));
		const rest = Math.max(0, this.#number("rest", settings.rest ?? 1.5));
		const pose = connectFrame(this.#motion.matches ? MOMENT_SECONDS : connectTime(time, { play, length, rest }) * MOMENT_SECONDS / length);
		this.#window.style.opacity = String(pose.window);
		this.#logos.forEach((button, index) => {
			const enter = button.firstElementChild;
			enter.style.opacity = String(pose.logos[index].opacity);
			enter.style.transform = `translateY(${pose.logos[index].y}px)`;
			button.disabled = this.#motion.matches || this.hasAttribute("time") || this.hasAttribute("paused");
		});
		this.#lines.forEach((line, index) => {
			line.setAttribute("stroke-dashoffset", String(100 * (1 - pose.lines[index])));
			line.closest("svg").style.opacity = pose.lines[index] === 0 ? "0" : "1";
		});
		if (this.#text.textContent !== pose.text) this.#text.textContent = pose.text;
		this.#caret.style.opacity = String(pose.caret);
		return play === "loop" || time < length;
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

if (!customElements.get("atlassian-connect")) customElements.define("atlassian-connect", AtlassianConnect);
