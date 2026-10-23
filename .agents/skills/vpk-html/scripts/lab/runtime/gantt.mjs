// vpk-lab runtime · Gantt: keeps a build-time Gantt (lab/gantt.mjs) in step with its film and makes it an APG
// slider. The head line follows the film's clock segment (opacity 1 inside it, 0.25 outside); a click seeks the film
// to that clock time, snapping to a cue or a [data-vpk-gantt-mark] within SNAP_PX CSS px (a pixel is ~0.09 s, so a raw
// click on a scene's start would name the scene before it); arrows, PageUp/PageDown and Home/End move by 0.1 s / 1 s
// / to the ends and call preventDefault, so the document nav never moves on them; Space and k play or pause the film
// (and never scroll the page). A seek keeps its own clock time (`held`), because the film lands 1 ms past it and
// re-reading the film would add 1 ms per key press. ARIA values update at most 4 times a second while the film plays.
import { clamp, clockAt, filmFromClock, fixed, ganttT, ganttX } from "./core.mjs";
import { fromReviewUi } from "./film.mjs";

const GANTT_KEYS = Object.freeze({ ArrowLeft: -0.1, ArrowDown: -0.1, ArrowRight: 0.1, ArrowUp: 0.1, PageDown: -1, PageUp: 1 });
const SNAP_PX = 6;

/** Mapping attributes plus the SVG viewBox width: { clock, t0, t1, x0, x1, width }. */
export function ganttMapping(element) {
	const number = name => Number(element.getAttribute(name));
	const svg = element.querySelector("svg");
	const box = String(svg?.getAttribute("viewBox") ?? "").trim().split(/[\s,]+/).map(Number);
	const width = svg?.viewBox?.baseVal?.width || box[2] || 1000;
	return { clock: element.getAttribute("data-clock") ?? "clock", t0: number("data-t0"), t1: number("data-t1"), x0: number("data-x0"), x1: number("data-x1"), width };
}

/** Wire one [data-vpk-gantt] to a FilmApi. Returns { element, update(ft), get t, destroy() }. */
export function wireGantt(element, filmApi, { env = globalThis } = {}) {
	const map = ganttMapping(element);
	const svg = element.querySelector("svg");
	const head = element.querySelector("[data-vpk-gantt-head]");
	let current = map.t0;
	let lastAria = -Infinity;
	let held = null; // { film, t }: where the last seek asked to land; current keeps t while the film stays near that film time
	const filmAtClock = t => {
		try { return filmFromClock(filmApi.data, map.clock, t); } catch { return t; }
	};
	function update(ft) {
		const reading = clockAt(filmApi.data, ft);
		const segment = filmApi.data.segments.find(item => item.id === map.clock);
		const inside = reading.segment?.id === map.clock;
		if (held && (filmApi.playing || Math.abs(ft - held.film) > 1.5 / (filmApi.fps || 30))) held = null;
		current = held ? held.t : inside ? clamp(reading.value, map.t0, map.t1) : segment && ft < segment.film[0] ? map.t0 : segment ? map.t1 : clamp(ft, map.t0, map.t1);
		paint(inside);
	}
	/** Seek to clock time t (film time `film`) and keep t as the logical clock: the film lands 1 ms past it. */
	function seekTo(t, film, options) {
		held = { film, t };
		current = t;
		filmApi.seek(film, options);
	}
	/** Click targets as { x, t, film }: marks first, then cues, so a cue wins a tie at the same x. */
	function snapTargets() {
		const targets = [];
		for (const mark of element.querySelectorAll("[data-vpk-gantt-mark]")) {
			const t = Number(mark.getAttribute("data-vpk-gantt-mark"));
			if (Number.isFinite(t)) targets.push({ x: ganttX(t, map), t, film: filmAtClock(t) });
		}
		for (const cue of filmApi.cues ?? []) {
			const reading = clockAt(filmApi.data, cue.film);
			if (reading.segment?.id === map.clock) targets.push({ x: ganttX(reading.value, map), t: reading.value, film: cue.film });
		}
		return targets;
	}
	function paint(inside) {
		if (head) {
			const x = String(ganttX(current, map));
			if (head.getAttribute("x1") !== x) {
				head.setAttribute("x1", x);
				head.setAttribute("x2", x);
			}
			const opacity = inside ? "1" : "0.25";
			if (head.getAttribute("opacity") !== opacity) head.setAttribute("opacity", opacity);
		}
		const now = env.performance?.now?.() ?? Date.now();
		if (!filmApi.playing || now - lastAria >= 250) {
			lastAria = now;
			const value = fixed(current);
			if (element.getAttribute("aria-valuenow") !== value) {
				element.setAttribute("aria-valuenow", value);
				element.setAttribute("aria-valuetext", `${value} s`);
			}
		}
	}
	const onClick = event => {
		if (fromReviewUi(event)) return;
		const rect = (svg ?? element).getBoundingClientRect();
		if (!(rect.width > 0)) return;
		const x = ((event.clientX - rect.left) / rect.width) * map.width;
		let target = { t: ganttT(x, map) };
		target.film = filmAtClock(target.t);
		let nearest = (SNAP_PX * map.width) / rect.width;
		for (const candidate of snapTargets()) {
			if (Math.abs(candidate.x - x) <= nearest) {
				nearest = Math.abs(candidate.x - x);
				target = candidate;
			}
		}
		seekTo(target.t, target.film, { scroll: true });
	};
	const onKey = event => {
		if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || fromReviewUi(event)) return;
		if (event.key === " " || event.key === "k") {
			event.preventDefault();
			filmApi.toggle();
			return;
		}
		let next = null;
		if (event.key in GANTT_KEYS) next = current + GANTT_KEYS[event.key];
		else if (event.key === "Home") next = map.t0;
		else if (event.key === "End") next = map.t1;
		if (next === null) return;
		event.preventDefault();
		filmApi.pause();
		const t = clamp(next, map.t0, map.t1);
		seekTo(t, filmAtClock(t));
		if (filmApi.hasSource) update(filmApi.time);
		else paint(true);
	};
	element.addEventListener("click", onClick);
	element.addEventListener("keydown", onKey);
	const unsubscribe = filmApi.onTime(update);
	update(filmApi.time);
	return {
		element, update,
		get t() { return current; },
		destroy() {
			unsubscribe();
			element.removeEventListener("click", onClick);
			element.removeEventListener("keydown", onKey);
		},
	};
}
