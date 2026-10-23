// vpk-lab runtime · film: the captured-film player (references/lab-kit.md, Film player). One api per [data-vpk-film]:
// play/pause/step/rate controls, a scrub, cue ticks, chapter buttons, a beat panel that names the current cue, the
// film/clock readout, cue-sheet seeking, keyboard keys on the root, a runtime poster and deferred runtime thumbnails.
// Film data is the <script type="application/json" data-vpk-film-data> island (C4). Per-frame writes are Text.data,
// the scrub value property and the Gantt head attributes; everything the runtime creates carries data-vpk-generated.
import { clamp, clockAt, cueAt, filmFromClock, fixed } from "./core.mjs";
import { labMake, labSetText } from "./frame.mjs";
import { makeLoop, reducedMotion } from "./loop-adapter.mjs";

export const FILM_DEFAULT_FPS = 30;
/** Latest start of the runtime thumbnails after init, so a print soon after opening finds them drawn. */
export const FILM_THUMBS_IDLE_MS = 1000;
const FILM_SKIP_KEYS = "input, select, textarea";
/** Keys the film handles even on its scrub: the range input has no native use for them (arrows, Home/End stay native). */
const FILM_SCRUB_KEYS = /^([ k,.]|[1-9])$/;

/** Film data from the island, else the defaults (one real segment over the whole film, no chapters). */
export function readFilmData(root, duration = 0) {
	const island = root.querySelector("script[type='application/json'][data-vpk-film-data]");
	let data = null;
	try { data = island ? JSON.parse(island.textContent) : null; } catch { data = null; }
	const fps = Number(data?.fps) > 0 ? Number(data.fps) : FILM_DEFAULT_FPS;
	const length = Number(data?.duration) > 0 ? Number(data.duration) : duration;
	const segments = Array.isArray(data?.segments) && data.segments.length ? data.segments : [{ id: "film", label: "film", kind: "real", film: [0, length], clock: { kind: "real" } }];
	return { version: 1, ...data, fps, duration: length, segments, chapters: Array.isArray(data?.chapters) ? data.chapters : [] };
}

/** True when the event's composed path crosses the WS1 review UI host, whose events the kit must never handle (K26). An
 * attribute scan, not closest(): the host keeps its UI in an open shadow root, which closest() cannot climb out of. */
export function fromReviewUi(event) {
	return (event.composedPath?.() ?? []).some(node => node?.nodeType === 1 && node.hasAttribute("data-vpk-review-ui"));
}

/** Where a seek to film time `target` lands: 1 ms past it, clamped to the last frame. The cue thumbnails probe the same
 * time, so each previews the exact frame its click shows (a cut cue included). */
export const filmSeekTime = (target, length, fps) => clamp(Number(target) + 1e-3, 0, Math.max(0, length - 1 / fps));

/** Film time of a cue button: data-film, else data-clock + data-t through the film data; null when neither. */
export function cueButtonFilm(button, data) {
	const film = button.getAttribute("data-film");
	if (film != null && film !== "" && Number.isFinite(Number(film))) return Number(film);
	const clock = button.getAttribute("data-clock");
	const t = Number(button.getAttribute("data-t"));
	if (clock && Number.isFinite(t)) {
		try { return filmFromClock(data, clock, t); } catch { return null; }
	}
	return null;
}

function filmClockText(reading) {
	return reading.kind === "real" ? `${reading.label} ${fixed(reading.value)} s` : `${reading.label} t ${fixed(reading.value)} s`;
}

/**
 * Runtime thumbnails: one detached video visits each cue (seek, seeked, draw), then is released. Deferred: the job
 * starts at the first idle moment after init (≤ FILM_THUMBS_IDLE_MS), sooner when the cue list comes within 200 px of
 * the viewport, and at once through start() (vpkLab.ready read, beforeprint, print media). The idle start is what a
 * reader's own print needs: Cmd+P snapshots the page synchronously after beforeprint, before any seek can finish.
 * Canvases still waiting carry .is-pending (print hides them). Returns { promise, start }; start() returns promise.
 */
function filmThumbs(api, cues, { env, tokens }) {
	const doc = env.document;
	const jobs = cues.map(cue => ({ cue, canvas: cue.el.querySelector("canvas.vpk-cue-thumb") }))
		.filter(job => job.canvas && !job.canvas.parentElement?.querySelector("img.vpk-cue-thumb"));
	const src = api.video.currentSrc || api.video.getAttribute("src");
	const done = Promise.resolve();
	if (!jobs.length) return { promise: done, start: () => done };
	const blank = canvas => {
		const ctx = canvas.getContext?.("2d");
		if (!ctx) return;
		ctx.fillStyle = tokens().sunken ?? "transparent";
		ctx.fillRect(0, 0, canvas.width, canvas.height);
	};
	if (!src) {
		jobs.forEach(job => blank(job.canvas));
		return { promise: done, start: () => done };
	}
	const once = (target, name, ms) => new Promise(resolve => {
		const timer = env.setTimeout(() => resolve(false), ms);
		target.addEventListener(name, () => { env.clearTimeout(timer); resolve(true); }, { once: true });
	});
	const run = async () => {
		const probe = doc.createElement("video");
		probe.muted = true;
		probe.preload = "auto";
		probe.playsInline = true;
		probe.src = src;
		const loaded = await once(probe, "loadeddata", 3000);
		for (const job of jobs) {
			try {
				if (!loaded || job.cue.film == null) throw new Error("not loaded");
				probe.currentTime = filmSeekTime(job.cue.film, probe.duration || api.duration, api.fps);
				if (!(await once(probe, "seeked", 2000))) throw new Error("seek timeout");
				const ctx = job.canvas.getContext("2d");
				const { width, height } = job.canvas;
				const scale = Math.max(width / (probe.videoWidth || width), height / (probe.videoHeight || height));
				const w = (probe.videoWidth || width) * scale;
				const h = (probe.videoHeight || height) * scale;
				ctx.drawImage(probe, (width - w) / 2, (height - h) / 2, w, h);
			} catch {
				blank(job.canvas);
			}
			job.canvas.classList.remove("is-pending");
		}
		probe.removeAttribute("src");
		probe.load?.();
	};
	jobs.forEach(job => job.canvas.classList.add("is-pending"));
	let io = null;
	let settle;
	const promise = new Promise(resolve => { settle = resolve; });
	const start = () => {
		if (settle) {
			io?.disconnect();
			run().then(settle, settle);
			settle = null;
		}
		return promise;
	};
	env.addEventListener?.("beforeprint", start, { once: true });
	env.matchMedia?.("print").addEventListener?.("change", event => { if (event.matches) start(); });
	if (typeof env.IntersectionObserver !== "function") return { promise: start(), start };
	if (typeof env.requestIdleCallback === "function") env.requestIdleCallback(() => start(), { timeout: FILM_THUMBS_IDLE_MS });
	else env.setTimeout?.(() => start(), FILM_THUMBS_IDLE_MS);
	io = new env.IntersectionObserver(entries => {
		if (entries.some(entry => entry.isIntersecting || entry.intersectionRatio > 0)) start();
	}, { rootMargin: "200px 0px" });
	io.observe(cues[0].el.closest("[data-vpk-cues]") ?? cues[0].el);
	return { promise, start };
}

/**
 * Wire one [data-vpk-film] root. `cueButtons`: the cue buttons that target this film. `tokens()` returns the current
 * kit tokens. Returns the FilmApi: { root, id, video, data, fps, cues, thumbs, drawThumbs() (starts them now, returns
 * thumbs), get time, get duration, get playing, seek(film, { scroll }), play(), pause(), toggle(), step(frames),
 * chapter(n), onTime(fn) → unsubscribe, render() }.
 */
export function film(root, { env = globalThis, cueButtons = [], tokens = () => ({}) } = {}) {
	const doc = env.document;
	const pick = name => root.querySelector(`[data-vpk-${name}]`);
	const video = pick("film-video");
	if (!video) throw new Error(`vpk-lab: film "${root.id}" has no [data-vpk-film-video]`);
	const scrub = pick("film-scrub");
	const playButton = pick("film-play");
	const bigPlay = pick("film-bigplay");
	/** Hide the big play; if it had focus, hand focus to the bar's Play button (else the film) so keys keep working. */
	const hideBigPlay = () => {
		if (!bigPlay || bigPlay.hidden) return;
		if (doc.activeElement === bigPlay) (playButton && !playButton.disabled ? playButton : root).focus?.({ preventScroll: true });
		bigPlay.hidden = true;
	};
	const empty = pick("film-empty");
	const timeEl = pick("film-time");
	const beat = { act: pick("beat-act"), clock: pick("beat-clock"), title: pick("beat-title"), body: pick("beat-body"), nums: pick("beat-nums") };
	const data = readFilmData(root);
	const fps = data.fps;
	const listeners = new Set();
	// The poster frame is film `posterAt`, so until the first play the readout, scrub, beat panel and Gantt head report
	// that time (J5: a poster of film 3.30 s must not sit beside "film 0.00 s"). Play starts at 0 and any seek clears it.
	const posterAt = () => {
		const time = Number(data.posterTime ?? video.getAttribute("data-poster-time"));
		return Number.isFinite(time) && time > 0 ? time : 0;
	};
	let posterPending = Boolean(video.getAttribute("poster")) && posterAt() > 0;
	const current = () => (posterPending ? posterAt() : video.currentTime || 0);
	let rvfc = 0;
	let lastCue;
	const duration = () => (Number.isFinite(video.duration) && video.duration > 0 ? video.duration : data.duration || 0);
	const hasSource = () => Boolean(video.currentSrc || video.getAttribute("src") || video.querySelector("source[src]"));
	const cues = cueButtons.map(el => ({ el, id: el.getAttribute("data-vpk-cue"), act: el.getAttribute("data-act") ?? "", film: cueButtonFilm(el, data) }))
		.filter(cue => cue.film != null);
	const playLabel = playButton?.textContent.trim() || "Play";
	const pauseLabel = playButton?.getAttribute("data-pause-label") ?? "Pause";

	// Readout nodes: film <b>t</b> s, then " · <label> t <b>v</b> s" when the film has a non-real clock.
	const timeNodes = {};
	if (timeEl) {
		timeEl.textContent = "";
		timeNodes.film = labMake(doc, "b", { className: "vpk-num", text: "0.00" });
		timeEl.append(doc.createTextNode("film "), timeNodes.film, doc.createTextNode(" s"));
		if (data.segments.some(segment => (segment.clock?.kind ?? "real") !== "real")) {
			timeNodes.clock = labMake(doc, "span", { text: "" });
			timeEl.append(timeNodes.clock);
		}
	}
	for (const cue of cues) {
		const slot = cue.el.querySelector(".vpk-cue-t");
		if (slot && !slot.textContent.trim()) {
			const reading = clockAt(data, cue.film);
			const clock = reading.kind === "real" ? "" : ` · ${filmClockText(reading)}`;
			slot.append(labMake(doc, "span", { text: `${cue.act ? `${cue.act} · ` : ""}film ${fixed(cue.film)} s${clock}` }));
		}
	}

	const cueText = (cue, selector) => cue?.el.querySelector(selector)?.textContent.trim() ?? "";
	function render() {
		const ft = current();
		if (scrub && doc.activeElement !== scrub) {
			const value = fixed(ft, 3);
			if (scrub.value !== value) scrub.value = value;
		}
		const reading = clockAt(data, ft);
		if (timeNodes.film) labSetText(timeNodes.film, fixed(ft));
		if (timeNodes.clock) labSetText(timeNodes.clock, reading.kind === "real" ? "" : ` · ${reading.label} t ${fixed(reading.value)} s`);
		labSetText(beat.clock, reading.kind === "real" ? `${fixed(ft, 1)} s` : `${fixed(reading.value)} s`);
		const cue = cueAt(cues, ft);
		if (cue !== lastCue) {
			lastCue = cue;
			labSetText(beat.act, cue?.act ?? "");
			labSetText(beat.title, cueText(cue, ".vpk-cue-name"));
			labSetText(beat.body, cueText(cue, ".vpk-cue-body"));
			labSetText(beat.nums, cueText(cue, ".vpk-cue-nums"));
			for (const item of cues) if (item.el.classList.contains("is-current") !== (item === cue)) item.el.classList.toggle("is-current", item === cue);
		}
		for (const fn of [...listeners]) fn(ft, api);
	}
	const fallback = makeLoop(root, () => {
		render();
		return !video.paused;
	}, { loop: env.vpkFrameLoop ?? null });
	function follow() {
		if (typeof video.requestVideoFrameCallback === "function") {
			if (rvfc) return;
			const frame = () => {
				rvfc = 0;
				render();
				if (!video.paused && !video.ended) rvfc = video.requestVideoFrameCallback(frame);
			};
			rvfc = video.requestVideoFrameCallback(frame);
		} else fallback.start();
	}
	const beatRoot = pick("beat");
	function setPlaying() {
		const playing = !video.paused && !video.ended;
		const live = playing ? "off" : "polite";
		if (beatRoot && beatRoot.getAttribute("aria-live") !== live) beatRoot.setAttribute("aria-live", live);
		if (playButton) {
			labSetText(playButton, playing ? pauseLabel : playLabel);
			playButton.setAttribute("aria-label", playing ? pauseLabel : playLabel);
		}
		if (playing) {
			hideBigPlay();
			follow();
		}
	}
	function seek(target, { scroll = false } = {}) {
		if (!hasSource()) return;
		posterPending = false;
		video.currentTime = filmSeekTime(target, duration(), fps);
		hideBigPlay();
		render();
		if (scroll) {
			root.scrollIntoView?.({ behavior: reducedMotion(env) ? "auto" : "smooth", block: "center" });
			root.focus?.({ preventScroll: true });
		}
	}
	function play() {
		if (!hasSource()) return;
		if (posterPending) {
			posterPending = false;
			if ((video.currentTime || 0) !== 0) video.currentTime = 0;
		}
		if (video.ended) video.currentTime = 0;
		const result = video.play?.();
		result?.catch?.(() => {});
	}
	const pause = () => video.pause?.();
	const toggle = () => (video.paused || video.ended ? play() : pause());
	const step = frames => {
		pause();
		seek(Math.floor(current() * fps + 1e-6) / fps + frames / fps);
	};
	const chapter = index => {
		const item = data.chapters[index];
		if (item) seek(item.film);
	};

	const api = {
		root, id: root.id || null, video, data, fps, cues, thumbs: Promise.resolve(), drawThumbs: () => api.thumbs,
		get time() { return current(); },
		get duration() { return duration(); },
		get playing() { return !video.paused && !video.ended; },
		get hasSource() { return hasSource(); },
		seek, play, pause, toggle, step, chapter, render,
		onTime(fn) {
			listeners.add(fn);
			return () => listeners.delete(fn);
		},
	};

	const buildTicks = () => {
		const ticks = pick("film-ticks");
		const length = duration();
		if (!ticks || !(length > 0)) return;
		ticks.querySelectorAll("[data-vpk-generated]").forEach(node => node.remove());
		for (const cue of cues) {
			const major = data.chapters.some(item => Math.abs(item.film - cue.film) < 0.02);
			const tick = labMake(doc, "span", { className: major ? "vpk-film-tick is-major" : "vpk-film-tick" });
			tick.style.left = `${clamp(cue.film / length) * 100}%`;
			ticks.append(tick);
		}
	};
	// The authored scrub says max="1", and a range input clamps its value to its max, so the max must be the film length
	// before the first render() writes the poster time into it (J5): at init from the film data (the video's metadata
	// may not have loaded), and again, with a render, when the metadata arrives.
	const setDuration = () => {
		if (scrub && duration() > 0) {
			scrub.max = fixed(duration(), 3);
			scrub.step = String(Math.round((1 / fps) * 1e4) / 1e4);
		}
		buildTicks();
	};
	const chapterBox = pick("film-chapters");
	data.chapters.forEach((item, index) => {
		const button = labMake(doc, "button", { className: "vpk-btn vpk-btn-sm", text: item.label, attrs: { type: "button" } });
		if (index < 9) button.setAttribute("aria-keyshortcuts", String(index + 1));
		button.addEventListener("click", () => seek(item.film));
		chapterBox?.append(button);
	});
	const showEmpty = () => {
		if (empty) empty.hidden = false;
		hideBigPlay();
	};
	if (empty) empty.hidden = hasSource();
	if (!hasSource()) showEmpty();
	video.addEventListener("loadedmetadata", () => {
		setDuration();
		render();
	});
	video.addEventListener("loadeddata", () => {
		if (posterAt() > 0 && !video.getAttribute("poster") && (video.currentTime || 0) === 0 && video.paused) {
			video.currentTime = posterAt();
			posterPending = true;
			render();
		}
	});
	video.addEventListener("play", setPlaying);
	video.addEventListener("pause", () => { setPlaying(); render(); });
	video.addEventListener("ended", () => { setPlaying(); render(); });
	video.addEventListener("seeked", render);
	video.addEventListener("timeupdate", () => { if (video.paused) render(); });
	video.addEventListener("error", showEmpty);
	video.addEventListener("click", toggle);
	playButton?.addEventListener("click", toggle);
	bigPlay?.addEventListener("click", () => { hideBigPlay(); play(); });
	scrub?.addEventListener("input", () => seek(Number(scrub.value) - 1e-3));
	for (const button of root.querySelectorAll("[data-vpk-film-step]")) button.addEventListener("click", () => step(Number(button.getAttribute("data-vpk-film-step")) || 1));
	const rates = [...root.querySelectorAll("[data-vpk-film-rate] [data-rate]")];
	for (const button of rates) {
		button.addEventListener("click", () => {
			video.playbackRate = Number(button.getAttribute("data-rate")) || 1;
			rates.forEach(other => other.setAttribute("aria-pressed", String(other === button)));
		});
	}
	for (const cue of cues) cue.el.addEventListener("click", () => seek(cue.film, { scroll: true }));
	root.addEventListener("keydown", event => {
		if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || fromReviewUi(event)) return;
		const field = event.target?.closest?.(FILM_SKIP_KEYS);
		if (field && !(field === scrub && FILM_SCRUB_KEYS.test(event.key))) return;
		const key = event.key;
		const nudge = Number(root.getAttribute("data-nudge")) || 0.5;
		const now = current();
		let action = null;
		if (key === " " || key === "k") {
			if (key === " " && event.target?.closest?.("button")) return;
			action = toggle;
		} else if (key === "ArrowLeft") action = () => seek(now - nudge);
		else if (key === "ArrowRight") action = () => seek(now + nudge);
		else if (key === ",") action = () => step(-1);
		else if (key === ".") action = () => step(1);
		else if (key === "Home") action = () => seek(0);
		else if (key === "End") action = () => seek(duration());
		else if (/^[1-9]$/.test(key) && data.chapters[Number(key) - 1]) action = () => chapter(Number(key) - 1);
		if (!action) return;
		event.preventDefault();
		action();
	});
	setDuration();
	setPlaying();
	render();
	const thumbJob = filmThumbs(api, cues, { env, tokens });
	api.thumbs = thumbJob.promise;
	api.drawThumbs = thumbJob.start;
	return api;
}
