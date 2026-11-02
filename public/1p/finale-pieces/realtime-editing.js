/** Deliberately uneven beats, kept deterministic for Studio scrubbing and film exports. */
export const EDITS = [
	{ row: 0, name: "Planner", tone: "blue", icon: "planner.svg", before: "Discuss next steps", after: "Review 2026 roadmap", select: 0.6, words: [0, 0.26, 0.49], step: 0.09, replace: 1.64, duration: 0.34 },
	{ row: 2, name: "ChatGPT", tone: "gray", icon: "chatgpt.svg", before: "Recruiting ideas", after: "Hiring plan", select: 1.95, words: [0, 0.29], step: 0.1, replace: 3.12, duration: 0.44 },
	{ row: 4, name: "Liam", tone: "lime", before: "Team responsibilities", after: "Org & team structure", select: 1.14, words: [0, 0.34], step: 0.11, replace: 2.26, duration: 0.27 },
];
export const MOMENT_SECONDS = 4.4;
export const POSTER_SECONDS = 4;
const SELECTION_INSET = 3.845;
const clamp = (value) => Math.max(0, Math.min(1, value));
const out = (value) => 1 - (1 - clamp(value)) ** 3;

/** Selection advances in quick whole-word steps; replacement is a phrase, never typing. */
export function editingFrame(seconds) {
	const time = Math.max(0, seconds);
	return EDITS.map((edit) => {
		const replacement = out((time - edit.replace) / edit.duration);
		const light = clamp((time - edit.replace - 0.04) / 0.78);
		return {
			selection: edit.words.map((offset) => out((time - edit.select - offset) / edit.step)),
			presence: out((time - edit.select + 0.12) / 0.16),
			replacement,
			before: 1 - out((time - edit.replace) / 0.11),
			after: replacement,
			light: light > 0 && light < 1 ? Math.sin(Math.PI * light) * 0.8 : 0,
			lightPosition: (1 - light) * 100,
		};
	});
}

/** Keep the finished edit fully visible through the rest, then reset directly for replay. */
export function editingTime(seconds, { play = "once", length = MOMENT_SECONDS, rest = 1.5 } = {}) {
	const time = Math.max(0, seconds);
	if (play === "live") return time;
	if (play === "once") return Math.min(time, length);
	return Math.min(time % (length + rest), length);
}

// Document-based paths also work when the offline export imports this as a blob module.
const asset = (name) => new URL(`/1p/finale-pieces/assets/realtime-editing/${name}`, document.baseURI).href;
const stylesheet = new URL("/1p/finale-pieces/realtime-editing.css", document.baseURI).href;
const ROWS = [EDITS[0].after, "2026 budget approval", EDITS[1].after, "OKRs / goals", EDITS[2].after];

class RealtimeEditing extends HTMLElement {
	static observedAttributes = ["time", "paused", "scale", "appearance", "surface", "play", "rest", "length"];
	#styles;
	#stage;
	#edits = [];
	#frame = 0;
	#elapsed = 0;
	#lastTick = null;
	#visible = true;
	#observer;
	#motion = matchMedia("(prefers-reduced-motion: reduce)");
	#refresh = () => this.redraw();
	#measure = () => {
		if (!this.isConnected) return;
		for (const edit of this.#edits) {
			// offset metrics stay in design pixels even inside a scaled wall or preview.
			edit.ends = edit.words.map((word) => word.offsetLeft + word.offsetWidth + SELECTION_INSET * 2);
			edit.width = edit.after.offsetWidth + SELECTION_INSET * 2;
		}
		this.redraw();
	};

	connectedCallback() {
		let link = document.querySelector("link[data-realtime-editing-style]");
		if (!link) {
			link = document.createElement("link");
			link.rel = "stylesheet";
			link.href = stylesheet;
			link.dataset.realtimeEditingStyle = "";
			document.head.append(link);
		}
		link.addEventListener("load", this.#measure, { once: true });
		if (!this.#stage) this.#build();
		this.#motion.addEventListener("change", this.#refresh);
		document.addEventListener("visibilitychange", this.#refresh);
		document.fonts?.addEventListener("loadingdone", this.#measure);
		document.fonts?.ready.then(this.#measure);
		this.#observer = new IntersectionObserver(([entry]) => {
			this.#visible = entry.isIntersecting;
			if (this.#visible) this.#measure();
			else this.redraw();
		});
		this.#observer.observe(this);
		this.#measure();
	}

	disconnectedCallback() {
		cancelAnimationFrame(this.#frame);
		this.#lastTick = null;
		this.#observer?.disconnect();
		this.#motion.removeEventListener("change", this.#refresh);
		document.removeEventListener("visibilitychange", this.#refresh);
		document.fonts?.removeEventListener("loadingdone", this.#measure);
		document.querySelector("link[data-realtime-editing-style]")?.removeEventListener("load", this.#measure);
	}

	attributeChangedCallback() { this.redraw(); }
	get pieceStyles() { return this.#styles; }
	set pieceStyles(value) { this.#styles = value; this.redraw(); }

	#build() {
		this.setAttribute("role", "img");
		this.setAttribute("aria-label", `Real-time editing. ${EDITS.map(({ name, before, after }) => `${name} replaces ${before} with ${after}`).join(". ")}.`);
		this.#stage = document.createElement("div");
		this.#stage.className = "editing-stage";
		this.#stage.setAttribute("aria-hidden", "true");
		this.#stage.innerHTML = '<p class="editing-title">Real-time editing</p>';
		const layer = document.createElement("ul");
		layer.className = "editing-layer";
		ROWS.forEach((text, index) => {
			const row = document.createElement("li");
			row.className = "editing-row";
			const edit = EDITS.find((edit) => edit.row === index);
			if (!edit) row.textContent = text;
			else {
				row.classList.add(`editing-${edit.tone}`);
				row.innerHTML = `<span class="editing-selection"></span><span class="editing-before"></span><span class="editing-after">${edit.after}</span><span class="editing-light">${edit.after}</span><span class="editing-cursor"><span class="editing-badge">${edit.icon ? `<img src="${asset(edit.icon)}" alt="">` : ""}<span>${edit.name}</span></span></span>`;
				const before = row.querySelector(".editing-before");
				const words = edit.before.split(" ").map((word, i, all) => {
					const span = document.createElement("span");
					span.className = "editing-word";
					span.textContent = word + (i < all.length - 1 ? " " : "");
					before.append(span);
					return span;
				});
				this.#edits.push({ before, words, after: row.querySelector(".editing-after"), selection: row.querySelector(".editing-selection"), cursor: row.querySelector(".editing-cursor"), light: row.querySelector(".editing-light"), ends: [], width: 0 });
			}
			layer.append(row);
		});
		this.#stage.append(layer);
		this.replaceChildren(this.#stage);
	}

	#number(name, fallback) {
		const value = this.getAttribute(name);
		return value !== null && Number.isFinite(Number(value)) ? Number(value) : fallback;
	}

	#paint() {
		const settings = this.#styles?.realtimeEditing ?? {};
		const scale = Math.max(0.01, this.#number("scale", 1));
		this.style.width = `${604 * scale}px`;
		this.style.height = `${472 * scale}px`;
		this.#stage.style.transform = `scale(${scale})`;
		const surface = this.getAttribute("surface");
		this.#stage.classList.toggle("no-surface", surface === "off" || (surface !== "on" && settings.surface === false));
		const time = this.#motion.matches ? POSTER_SECONDS : this.#number("time", this.#elapsed);
		const play = this.#motion.matches ? "once" : this.getAttribute("play") ?? settings.play ?? "once";
		const length = this.#motion.matches ? MOMENT_SECONDS : Math.max(0.1, this.#number("length", settings.length ?? MOMENT_SECONDS));
		const sampleTime = editingTime(time, { play, length, rest: Math.max(0, this.#number("rest", settings.rest ?? 1.5)) });
		const poses = editingFrame(sampleTime);
		this.#edits.forEach((edit, i) => {
			const pose = poses[i];
			const selectedWidth = pose.selection.reduce((width, progress, j) => width + (edit.ends[j] - (edit.ends[j - 1] ?? 0)) * progress, 0);
			const width = selectedWidth + (edit.width - selectedWidth) * pose.replacement;
			edit.selection.style.width = `${width}px`;
			edit.selection.style.opacity = String(pose.presence);
			edit.cursor.style.opacity = String(pose.presence);
			edit.cursor.style.transform = `translateX(${width - SELECTION_INSET}px)`;
			edit.before.style.opacity = String(pose.before);
			edit.after.style.opacity = String(pose.after);
			edit.light.style.opacity = String(pose.light);
			edit.light.style.backgroundPosition = `${pose.lightPosition}% 0`;
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

if (!customElements.get("realtime-editing")) customElements.define("realtime-editing", RealtimeEditing);
