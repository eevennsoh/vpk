const asset = (name) => new URL(`/1p/finale-pieces/assets/activity-timeline/${name}.png`, document.baseURI).href;
const DURATION = 6.8;
const EASE = "cubic-bezier(.22,.8,.24,1)";
const STOPS = [[0, 76], [.55, 76], [1.3, 132], [1.85, 132], [2.65, 32], [3.2, 32], [4.1, 158], [4.75, 158], [5.65, 76], [6.8, 76]];
const DATES = ["Oct 4 · 9:12 AM", "Oct 3 · 2:24 PM", "Oct 5 · 8:47 AM", "Oct 2 · 4:08 PM"];
const PREVIEW_AVATARS = ["preview-avatars", "session-cursor", "activity-roshini", "session-claude"];
const cursorAgent = `<img class="cursor-agent" src="${asset("cursor-agent")}" alt="">`;

const session = (agent, person, pr, finished) => `
	<div class="session">
		<div><div class="session-title">${agent} with ${person}</div>
			<div class="metadata"><span class="session-avatars"><img class="session-avatar" src="${asset(`session-${agent.toLowerCase()}`)}" alt="">${agent === "Cursor" ? cursorAgent : ""}</span><span>${agent} ·</span><span class="pr-icon metadata-icon"><img src="${asset("pull-request")}" alt=""></span><span>PR #${pr} ·</span><img class="cloud metadata-icon" src="${asset("cloud")}" alt=""><span>2m</span></div>
		</div>
		<div class="status">${finished ? 'Finished <span class="success">✓</span>' : 'Needs input <span class="status-dot"></span>'}</div>
	</div>`;

const row = (avatar, text, time) => `<li class="row"><span class="avatar ${avatar === "roshini" ? "human" : ""}"><img src="${asset(`activity-${avatar}`)}" alt=""></span><span class="row-content"><span>${text}</span><span class="timestamp">${time}</span></span></li>`;

const markup = `
	<link rel="stylesheet" href="${new URL("/1p/finale-pieces/activity-timeline.css", document.baseURI).href}">
	<article class="card" aria-label="Agent sessions and activity timeline">
		<h2 class="heading">Agent sessions</h2>
		<div class="sessions">${session("Cursor", "David Hsieh", "4683", false)}${session("Claude", "Dev Rana", "4613", true)}</div>
		<section class="activity">
			<div class="toolbar"><h2 class="heading">Activity</h2>
				<div class="track" aria-hidden="true"><div class="rail"></div><div class="origin"></div>
					<div class="scrubber"><div class="disc"></div><div class="preview"><span class="preview-avatars">${PREVIEW_AVATARS.map((name) => `<span><img class="preview-avatar" src="${asset(name)}" alt="">${name === "session-cursor" ? cursorAgent : ""}</span>`).join("")}</span><span class="preview-date">${DATES.map((date) => `<span>${date}</span>`).join("")}</span></div>
						<img class="pointer" src="${new URL("/1p/finale-pieces/assets/activity-timeline/pointer.svg", document.baseURI).href}" alt="">
					</div>
				</div>
				<div class="filters" aria-hidden="true"><span class="all">All</span>${["comment", "history", "decision", "app"].map((name) => `<img class="filter-icon" src="${asset(`filter-${name}`)}" alt="">`).join("")}</div>
			</div>
			<ul class="rows">${row("cursor", "Cursor with David Hsieh updated 2 fields", "23 min ago")}${row("roshini", "Roshini Malik updated 4 fields", "1 day ago")}${row("claude", "Claude with Dev Rana added 4 subitems", "2 days ago")}</ul>
		</section>
	</article>`;

class ActivityTimelinePiece extends HTMLElement {
	static observedAttributes = ["time", "paused", "scale", "appearance", "surface", "play", "rest", "length"];
	#animations = [];
	#styles = {};
	#visible = false;
	#reduced = matchMedia("(prefers-reduced-motion: reduce)");
	#observer = new IntersectionObserver(([entry]) => {
		this.#visible = entry.isIntersecting;
		this.#syncPlayback();
	});
	#onVisibility = () => this.#syncPlayback();
	#onMotion = () => this.#configure();

	constructor() {
		super();
		this.attachShadow({ mode: "open" }).innerHTML = markup;
	}

	connectedCallback() {
		this.#observer.observe(this);
		document.addEventListener("visibilitychange", this.#onVisibility);
		this.#reduced.addEventListener("change", this.#onMotion);
		this.#configure();
	}

	disconnectedCallback() {
		this.#observer.disconnect();
		document.removeEventListener("visibilitychange", this.#onVisibility);
		this.#reduced.removeEventListener("change", this.#onMotion);
		this.#animations.forEach((animation) => animation.cancel());
		this.#animations = [];
	}

	attributeChangedCallback(name, previous, next) {
		if (previous === next || !this.isConnected) return;
		if (name === "time" || name === "paused") this.#syncPlayback();
		else this.#configure();
	}

	get pieceStyles() { return this.#styles; }
	set pieceStyles(value) {
		this.#styles = value ?? {};
		if (this.isConnected) this.#configure();
	}
	get currentTime() { return Number(this.#animations[0]?.currentTime ?? 0) / 1000; }
	play() { this.removeAttribute("time"); this.removeAttribute("paused"); this.#syncPlayback(); }
	pause() { this.setAttribute("paused", ""); }
	seek(time) {
		if (this.hasAttribute("time")) this.setAttribute("time", String(time));
		else this.#animations.forEach((animation) => { animation.currentTime = Math.max(0, time) * 1000; });
	}
	redraw() { this.#syncPlayback(); }

	#number(name, fallback, min = 0) {
		const value = Number(this.getAttribute(name) ?? this.#styles.activityTimeline?.[name] ?? fallback);
		return Number.isFinite(value) ? Math.max(min, value) : fallback;
	}

	#configure() {
		const time = this.currentTime;
		this.#animations.forEach((animation) => animation.cancel());
		this.#animations = [];
		const scale = this.#number("scale", 1, .01);
		this.style.width = `${480 * scale}px`;
		this.style.height = `${426 * scale}px`;
		const card = this.shadowRoot.querySelector(".card");
		card.style.transform = `scale(${scale})`;
		card.classList.toggle("no-surface", this.#styles.activityTimeline?.surface === false);
		if (this.#reduced.matches) return;

		const length = this.#number("length", DURATION, .1);
		const play = this.getAttribute("play") ?? this.#styles.activityTimeline?.play ?? "once";
		const looping = play === "loop" || play === "live";
		const duration = length + (looping ? this.#number("rest", 1.5) : 0);
		const offset = (seconds) => seconds / DURATION * length / duration;
		const animate = (selector, frames) => {
			const animation = this.shadowRoot.querySelector(selector).animate(frames, { duration: duration * 1000, iterations: looping ? Infinity : 1, fill: "both" });
			animation.pause();
			animation.currentTime = time * 1000;
			this.#animations.push(animation);
		};
		animate(".scrubber", STOPS.map(([seconds, x]) => ({ offset: offset(seconds), transform: `translateX(${x}px)`, easing: EASE })));
		animate(".pointer", [
			{ offset: 0, opacity: 0, transform: "translate(10px,8px)" },
			{ offset: offset(.25), opacity: 0, transform: "translate(10px,8px)", easing: EASE },
			{ offset: offset(.55), opacity: 1, transform: "translate(0,0)" },
			{ offset: offset(5.75), opacity: 1, transform: "translate(0,0)", easing: EASE },
			{ offset: offset(6.2), opacity: 0, transform: "translate(8px,10px)" },
			{ offset: 1, opacity: 0, transform: "translate(8px,10px)" },
		]);
		const events = [[0, 0], [.95, 1], [2.3, 2], [3.7, 3], [5.2, 0], [6.8, 0]];
		DATES.forEach((_, index) => {
			const frames = events.map(([seconds, event]) => ({ offset: offset(seconds), opacity: event === index ? 1 : 0, easing: "steps(1, end)" }));
			animate(`.preview-date span:nth-child(${index + 1})`, frames);
			animate(`.preview-avatars > span:nth-child(${index + 1})`, frames);
		});
		this.#syncPlayback();
	}

	#syncPlayback() {
		const held = this.hasAttribute("time");
		const playing = !held && !this.hasAttribute("paused") && this.#visible && !document.hidden;
		const time = held ? this.#number("time", 0) : this.currentTime;
		for (const animation of this.#animations) {
			if (playing) {
				if (animation.playState === "paused") animation.play();
			} else {
				animation.pause();
				animation.currentTime = time * 1000;
			}
		}
	}
}

if (!customElements.get("activity-timeline-piece")) customElements.define("activity-timeline-piece", ActivityTimelinePiece);
