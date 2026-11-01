// Figma 415:8005, in its original 587 × 445 coordinate space.
const BARS = [
	{ height: 81.283, segments: [["other", 25], ["review", 20], ["architecture", 36.283]] },
	{ height: 71.813, segments: [["other", 21], ["refactor", 40], ["feature", 10.813]] },
	{ height: 67.078, segments: [["other", 45.078], ["review", 22]] },
	{ height: 93.91, segments: [["other", 29], ["feature", 29], ["architecture", 35.91]] },
	{ height: 108.904, segments: [["other", 36], ["review", 34.911], ["refactor", 21], ["docs", 16.993]] },
];
const TOTALS = [
	{ category: "bug", label: "Bug fixes", value: 40.3 },
	{ category: "refactor", label: "Refactors and rewrites", value: 40 },
	{ category: "docs", label: "Documentation", value: 37.5 },
	{ category: "review", label: "Code reviews", value: 28.5 },
	{ category: "architecture", label: "Architecture design &amp; planning", value: 27.1 },
];
export const MOMENT_SECONDS = 2.4;
export const POSTER_SECONDS = 1.8;
const clamp = (value) => Math.max(0, Math.min(1, value));
const out = (value) => 1 - (1 - clamp(value)) ** 3;
const stylesheet = new URL("/1p/finale-pieces/agent-work-chart.css", document.baseURI).href;
const gridAsset = new URL("/1p/finale-pieces/assets/agent-work-chart/grid.svg", document.baseURI).href;

export function chartFrame(seconds) {
	return {
		axis: out(seconds / 0.18),
		bars: BARS.map((_, index) => {
			const elapsed = seconds - 0.16 - index * 0.07;
			return { scale: 0.08 + 0.92 * out(elapsed / 0.72), opacity: out(elapsed / 0.18) };
		}),
		rows: TOTALS.map((total, index) => {
			const elapsed = seconds - 0.48 - index * 0.07;
			return {
				opacity: out(elapsed / 0.18),
				y: 6 * (1 - out(elapsed / 0.3)),
				value: `${(total.value * out(elapsed / 0.8)).toFixed(1)}K`,
			};
		}),
	};
}

export function chartTime(seconds, { play = "once", length = MOMENT_SECONDS, rest = 1.5 } = {}) {
	const time = Math.max(0, seconds);
	return Math.min(play === "loop" ? time % (length + rest) : time, length);
}

class AgentWorkChart extends HTMLElement {
	static observedAttributes = ["time", "paused", "scale", "appearance", "surface", "play", "rest", "length"];
	#styles;
	#stage;
	#axes = [];
	#bars = [];
	#rows = [];
	#frame = 0;
	#elapsed = 0;
	#lastTick = null;
	#visible = true;
	#observer;
	#motion = matchMedia("(prefers-reduced-motion: reduce)");
	#refresh = () => this.redraw();

	connectedCallback() {
		if (!document.querySelector("link[data-agent-work-chart-style]")) {
			const link = document.createElement("link");
			link.rel = "stylesheet";
			link.href = stylesheet;
			link.dataset.agentWorkChartStyle = "";
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
		this.setAttribute("aria-label", "Agent work by session, July to October 2026. Bug fixes: 40.3K sessions. Refactors and rewrites: 40.0K. Documentation: 37.5K. Code reviews: 28.5K. Architecture design and planning: 27.1K.");
		this.#stage = document.createElement("div");
		this.#stage.className = "work-chart-stage";
		this.#stage.setAttribute("aria-hidden", "true");
		this.#stage.innerHTML = `
			<div class="work-chart-panel">
				<h3 class="work-chart-heading">Agent work by session</h3>
				<div class="work-chart-content">
					<div class="work-chart-y work-chart-axis">${["16K", "12K", "8K", "4K", "0"].map((label) => `<span>${label}</span>`).join("")}</div>
					<div class="work-chart-plot">
						<div class="work-chart-axis"><img class="work-chart-grid" src="${gridAsset}" width="413" height="111.395" alt=""></div>
						<div class="work-chart-bars">${BARS.map((bar) => `
							<div class="work-chart-bar-slot"><div class="work-chart-bar" style="height:${bar.height}px">
								${bar.segments.map(([category, height]) => `<span class="work-chart-segment ${category}" style="height:${height}px"></span>`).join("")}
							</div></div>`).join("")}</div>
						<div class="work-chart-x work-chart-axis"><span>Jul 2026</span><span>Oct 2026</span></div>
					</div>
				</div>
				<div class="work-chart-legend">${TOTALS.map((total) => `
					<div class="work-chart-row"><div class="work-chart-row-content">
						<span class="work-chart-key ${total.category}"></span><span class="work-chart-label">${total.label}</span>
						<span class="work-chart-value">${total.value.toFixed(1)}K</span><span>sessions</span>
					</div></div>`).join("")}</div>
			</div>`;
		this.#axes = [...this.#stage.querySelectorAll(".work-chart-axis")];
		this.#bars = [...this.#stage.querySelectorAll(".work-chart-bar")];
		this.#rows = [...this.#stage.querySelectorAll(".work-chart-row-content")].map((row) => ({ row, value: row.querySelector(".work-chart-value") }));
		this.replaceChildren(this.#stage);
	}

	#number(name, fallback) {
		const value = this.getAttribute(name);
		return value !== null && Number.isFinite(Number(value)) ? Number(value) : fallback;
	}

	#paint() {
		const settings = this.#styles?.agentWorkChart ?? {};
		const scale = Math.max(0.01, this.#number("scale", 1));
		this.style.width = `${587 * scale}px`;
		this.style.height = `${445 * scale}px`;
		this.#stage.style.transform = `scale(${scale})`;
		const surface = this.getAttribute("surface");
		this.#stage.classList.toggle("no-surface", surface === "off" || (surface !== "on" && settings.surface === false));
		const time = this.#number("time", this.#elapsed);
		const play = this.getAttribute("play") ?? settings.play ?? "once";
		const length = Math.max(0.1, this.#number("length", settings.length ?? MOMENT_SECONDS));
		const rest = Math.max(0, this.#number("rest", settings.rest ?? 1.5));
		const pose = chartFrame(this.#motion.matches ? POSTER_SECONDS : chartTime(time, { play, length, rest }));
		this.#axes.forEach((axis) => { axis.style.opacity = String(pose.axis); });
		this.#bars.forEach((bar, index) => {
			bar.style.transform = `scaleY(${pose.bars[index].scale})`;
			bar.style.opacity = String(pose.bars[index].opacity);
		});
		this.#rows.forEach(({ row, value }, index) => {
			row.style.opacity = String(pose.rows[index].opacity);
			row.style.transform = `translateY(${pose.rows[index].y}px)`;
			if (value.textContent !== pose.rows[index].value) value.textContent = pose.rows[index].value;
		});
		return play === "loop" || time < Math.min(length, POSTER_SECONDS);
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

if (!customElements.get("agent-work-chart")) customElements.define("agent-work-chart", AgentWorkChart);
