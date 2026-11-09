import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { data, model } from './eu26-hero.hero.mjs';

const session = `eu26-refinement-test-${process.pid}`;
const artifact = fileURLToPath(new URL('../eu26-animation-explained.html', import.meta.url));
const run = (...args) => execFileSync('agent-browser', ['--session', session, ...args], { encoding: 'utf8', timeout: 45000 });
const evaluate = source => JSON.parse(run('eval', '-b', Buffer.from(source).toString('base64')));
const scenario = source => evaluate(`(async () => {
	const explorer = window.__eu26Explorer;
	const hero = document.querySelector('[data-vpk-figure="eu26-hero"]');
	const svg = hero.querySelector('svg');
	const timeline = document.querySelector('#eu26-explorer-timeline');
	const playbackRate = explorer.getState().playbackRate;
	const durationSeconds = explorer.getState().durationSeconds;
	const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
	const until = async (condition, message) => {
		const deadline = performance.now() + 3000;
		while (performance.now() < deadline) {
			if (condition()) return;
			await wait(16);
		}
		throw new Error(message + ': ' + JSON.stringify(explorer.getState()));
	};
	const draw = time => hero.dispatchEvent(new CustomEvent('eu26:seek', { detail: { time } }));
	const piece = name => hero.querySelector('[data-eu26-piece="' + name + '"]');
	const visible = element => element && getComputedStyle(element).display !== 'none' && Number(getComputedStyle(element).opacity) > .5;
	const bounds = element => {
		const box = element.getBBox();
		return { x: box.x, y: box.y, w: box.width, h: box.height };
	};
	if (window.__eu26Timeline && !window.__eu26Timeline.getState().expanded) { window.__eu26Timeline.setExpanded(true); await wait(220); }
	window.__vpkStory?.suspendFollowing();
	explorer.pause();
	explorer.clearPreview();
	${source}
})()`);

test('refined offline EU26 motion renders its geometry and keeps the final wall alive', { timeout: 180000 }, async t => {
	run('set', 'viewport', '1440', '900');
	run('set', 'media', 'light');
	run('open', `file://${artifact}`);
	run('wait', '--fn', 'Boolean(window.__eu26Explorer)');
	try {
		await t.test('the intro keeps previous cards and the complete landing face', () => {
			const retained = data.cards.flatMap((card, index) => card.row < 3 && index !== 15 ? [index] : []);
			const result = scenario(`
				hero.scrollIntoView({ block: 'center', behavior: 'instant' });
				explorer.setVariant('paper');
				const retained = ${JSON.stringify(retained)};
				const failures = [];
				for (const time of [0, .4, 1, 1.9, 2]) {
					explorer.seek(time);
					for (const index of retained) if (!visible(piece('story.' + index))) failures.push('previous card ' + index + ' hidden at ' + time);
					const active = piece('story.15');
					if (time < 2 && active.hasAttribute('clip-path')) failures.push('drag was clipped before landing');
					if (Number(hero.dataset.heroCursorClips)) failures.push('cursor clipped at ' + time);
				}
				explorer.seek(2);
				const face = piece('story.15').querySelector('.iso-top');
				const clip = hero.querySelector('[data-eu26-done-window]');
				const frame = bounds(face);
				let inside = 0;
				for (let sample = 0; sample < 48; sample++) {
					const edge = face.getPointAtLength(face.getTotalLength() * sample / 48);
					const point = new DOMPoint(edge.x * .98 + (frame.x + frame.w / 2) * .02, edge.y * .98 + (frame.y + frame.h / 2) * .02);
					if (clip.isPointInFill(point)) inside++;
				}
				return { failures, inside, faceArea: frame.w * frame.h };
			`);
			assert.deepEqual(result.failures, []);
			assert.equal(result.inside, 48, 'the whole landed card face fits inside the Done clip');
			assert.ok(result.faceArea > 1000);
		});

		await t.test('each story column renders a fourth card clipped at its bottom edge on the board', () => {
			const rowThree = [0, 1, 2].map(column => data.cards.findIndex(card => card.column === column && card.row === 3));
			const scrolled = data.cards.findIndex(card => card.column === 2 && card.row === 4);
			const result = scenario(`
				hero.scrollIntoView({ block: 'center', behavior: 'instant' });
				explorer.setVariant('paper');
				const sampleFace = (name, clip) => {
					const face = piece(name).querySelector('.iso-top');
					let inside = 0;
					for (let sample = 0; sample < 64; sample++) {
						const edge = face.getPointAtLength(face.getTotalLength() * sample / 64);
						if (clip.isPointInFill(new DOMPoint(edge.x, edge.y))) inside++;
					}
					return inside;
				};
				const columns = ${JSON.stringify(rowThree)}.map((index, column) => {
					explorer.seek(0);
					const clip = hero.querySelector('[data-eu26-column-window="' + column + '"]');
					const el = piece('story.' + index);
					return { visible: visible(el), clipPath: el.getAttribute('clip-path'), clipId: clip?.parentElement.id, inside: clip ? sampleFace('story.' + index, clip) : -1 };
				});
				explorer.seek(2);
				const scrolledIn = { visible: visible(piece('story.${scrolled}')), clipPath: piece('story.${scrolled}').getAttribute('clip-path') };
				const lifted = [6, 16].map(time => {
					explorer.seek(time);
					return [...${JSON.stringify(rowThree.slice(0, 2))}, ${scrolled}].map(index => piece('story.' + index).getAttribute('clip-path') || '').filter(value => value.includes('column'));
				});
				return { columns, scrolledIn, lifted };
			`);
			result.columns.forEach((column, index) => {
				assert.equal(column.visible, true, `column ${index} shows its row-3 card`);
				assert.equal(column.clipPath, `url(#${column.clipId})`, `column ${index} clips its row-3 card by its own window`);
				assert.equal(column.clipId, `eu26-column${index}-window`);
				assert.ok(column.inside > 16 && column.inside < 60, `column ${index}'s row-3 card is partly inside and partly cut by the column bottom (${column.inside}/64 edge samples inside)`);
			});
			assert.deepEqual(result.scrolledIn, { visible: true, clipPath: 'url(#eu26-column2-window)' }, 'column 2 scrolls its next card into the clipped slot');
			assert.deepEqual(result.lifted, [[], []], 'no card keeps a column clip once lifted out of its column');
		});

		await t.test('camera angle changes repaint board geometry and leave the bento front-facing', () => {
			const result = scenario(`
				const placement = [3, 4.3, 5.8, 7].map(time => {
					explorer.seek(time);
					return { azimuth: hero.dataset.heroAzimuth, elevation: hero.dataset.heroElevation,
						board: hero.querySelector('[data-part="board.chassis"] .iso-top').getAttribute('d'),
						clip: hero.querySelector('[data-eu26-done-window]').getAttribute('d') };
				});
				explorer.seek(22);
				const faces = [...hero.querySelectorAll('[data-eu26-kind="tile"]')].map(tile => ({ name: tile.dataset.eu26Piece, visible: visible(tile), box: bounds(tile.querySelector('.iso-top')) }));
				return { placement, faces, titleCardVisible: visible(piece('title')), elevation: Number(hero.dataset.heroElevation) };
			`);
			for (const field of ['azimuth', 'elevation', 'board', 'clip']) assert.ok(new Set(result.placement.map(frame => frame[field])).size >= 3, `${field} responds to placement camera motion`);
			assert.ok(Math.abs(result.elevation - 90) < .01);
			assert.equal(result.faces.length, 6);
			assert.equal(result.titleCardVisible, false, 'the title becomes a card at the wall handoff, leaving exactly six visible bento panels');
			for (const face of result.faces) {
				const index = Number(face.name.split('.')[1]), expected = data.features[index];
				assert.equal(face.visible, true);
				assert.ok(Math.abs(face.box.w / face.box.h - expected.w / expected.d) < .015, 'front-facing face retains its real width-to-height ratio');
			}
		});

		await t.test('three border traces finish before a gradient sweeps the three matching face clips', () => {
			const result = scenario(`
				if (piece('flash')) throw new Error('the replaced flash mesh is still present');
				const frames = [11.2, 11.7, 12.1, 12.6].map(time => {
					explorer.seek(time);
					const traces = [...hero.querySelectorAll('[data-eu26-border-trace]')];
					const cores = [...hero.querySelectorAll('[data-eu26-border-core]')];
					const faces = [...hero.querySelectorAll('[data-eu26-done-face]')];
					const gradient = hero.querySelector('linearGradient[id$="-done-light-sweep"]');
					const sweep = hero.querySelector('[data-eu26-gradient-sweep]');
					return { time, trace: Number(hero.dataset.heroDoneTrace), progress: Number(hero.dataset.heroDoneSweep),
						traces: traces.map(trace => ({ d: trace.getAttribute('d'), dash: trace.getAttribute('stroke-dasharray') })),
						cores: cores.map(core => ({ d: core.getAttribute('d'), dash: core.getAttribute('stroke-dasharray'), stroke: getComputedStyle(core).stroke })), traceStroke: getComputedStyle(traces[0]).stroke,
						faces: faces.map(face => face.getAttribute('d')),
						storyFaces: ${JSON.stringify(data.doneList.cards.slice(0, 3).map(row => row.card))}.map(index => piece('story.' + index).querySelector('.iso-top').getAttribute('d')),
						gradient: ['x1', 'y1', 'x2', 'y2'].map(name => Number(gradient.getAttribute(name))),
						sweepVisible: getComputedStyle(sweep).display !== 'none',
						clip: sweep.getAttribute('clip-path'), faceClip: faces[0].parentElement.id,
						filter: getComputedStyle(hero.querySelector('[data-eu26-done-lighting]')).filter };
				});
				return frames;
			`);
			for (const frame of result) {
				assert.equal(frame.traces.length, 3);
				assert.equal(frame.faces.length, 3);
				assert.equal(frame.cores.length, 3, 'each light trace has a visibly contrasting core');
				assert.deepEqual(frame.cores.map(core => core.d), frame.faces);
				assert.ok(frame.cores.every(core => core.stroke !== frame.traceStroke));
				assert.deepEqual(frame.faces, frame.storyFaces, 'light is clipped to actual posed card faces');
				assert.deepEqual(frame.traces.map(trace => trace.d), frame.faces, 'each trace follows one card perimeter');
				assert.equal(frame.clip, `url(#${frame.faceClip})`);
				assert.equal(frame.filter, 'none', 'Done lighting leaves geometry undistorted');
				if (frame.trace < 1) assert.equal(frame.sweepVisible, false);
				if (frame.progress > 0) assert.equal(frame.trace, 1);
			}
			assert.notDeepEqual(result[0].traces.map(trace => trace.dash), result[1].traces.map(trace => trace.dash), 'beam progresses along the perimeter');
			assert.notDeepEqual(result[2].gradient, result[3].gradient, 'directional gradient moves across the Done faces');
		});

		await t.test('the paper style paints intermediate orange-to-white card colors', () => {
			const results = scenario(`
				return ['paper'].map(variant => {
					explorer.setVariant(variant);
					const samples = [13.2, 14.4, 15.8].map(time => {
						explorer.seek(time);
						const card = piece('story.0'), surface = card.querySelector(variant === 'outline' ? '.iso-edge' : '.iso-top');
						return { amount: Number(card.dataset.eu26Highlight), color: getComputedStyle(surface)[variant === 'outline' ? 'stroke' : 'fill'], hero: Number(piece('story.15').dataset.eu26Highlight) };
					});
					return { variant, samples };
				});
			`);
			for (const { variant, samples } of results) {
				assert.equal(samples[0].amount, 1, variant);
				assert.ok(samples[1].amount > .1 && samples[1].amount < .9, 'an intermediate blend is painted');
				assert.equal(samples[2].amount, 0, variant);
				assert.equal(new Set(samples.map(sample => sample.color)).size, 3, 'actual SVG colors change through the blend');
				assert.ok(samples.every(sample => sample.hero === 1));
			}
		});

		await t.test('teammate cursors grip the centre of the arriving card they ride down, early and late in the loop', () => {
			const result = scenario(`
				hero.scrollIntoView({ block: 'center', behavior: 'instant' });
				const failures = [];
				let contacts = 0;
				for (const variant of ['paper']) {
					explorer.setVariant(variant);
					// The page's own model (its frame aspect) decides when teammates ride cards: find every ride, then check the
					// drawn contact on four early and four late ones.
					const capture = () => { const event = new CustomEvent('eu26:capture', { detail: {} }); hero.dispatchEvent(event); return event.detail.state; };
					const samples = [], seen = new Set();
					for (let time = 34; time < 200; time += 0.25) {
						explorer.seek(time);
						for (const cursor of capture().cursors) {
							if (cursor.phase !== 'carry' || cursor.entering || cursor.heldTarget?.kind !== 'wall' || cursor.alpha < .5) continue;
							const key = cursor.id + ':' + cursor.heldTarget.key + ':' + Math.floor(time / 20);
							if (seen.has(key)) continue;
							seen.add(key);
							samples.push({ time, id: cursor.id, key: cursor.heldTarget.key, sourceIndex: cursor.heldTarget.sourceIndex, index: cursor.heldTarget.index, grip: cursor.grip });
						}
					}
					if (samples.length < 6) failures.push({ issue: 'too few teammate rides', samples: samples.length });
					if (new Set(samples.map(sample => sample.id)).size < 3) failures.push({ issue: 'not all three teammates ride cards' });
					if (!samples.some(sample => sample.time > 100)) failures.push({ issue: 'no ride late in the loop' });
					const checked = [...samples.filter(sample => sample.time < 100).slice(0, 4), ...samples.filter(sample => sample.time >= 100).slice(0, 4)];
					for (const sample of checked) {
						if (sample.grip.u !== .5 || sample.grip.v !== .5) failures.push({ ...sample, issue: 'grip is not the card centre' });
						explorer.seek(sample.time);
						const cursor = hero.querySelector('[data-eu26-cursor="' + sample.id + '"]');
						const matches = [...hero.querySelectorAll('[data-eu26-piece="wall.' + sample.index + '"]')];
						if (matches.length !== 1) { failures.push({ variant, ...sample, issue: 'pooled target is missing or duplicated' }); continue; }
						const card = matches[0], face = card.querySelector('.iso-top'), tip = cursor.querySelector('[data-eu26-cursor-tip]');
						if (!visible(card) || !visible(cursor) || cursor.dataset.heldTarget !== sample.key || cursor.dataset.cursorPhase !== 'carry') failures.push({ variant, ...sample, issue: 'visible cursor lost its current pooled target' });
						const nose = tip.getPointAtLength(0), screen = new DOMPoint(nose.x, nose.y).matrixTransform(tip.getScreenCTM());
						const contact = screen.matrixTransform(face.getScreenCTM().inverse()), box = bounds(face);
						if (!face.isPointInFill(contact) || Math.hypot(contact.x - box.x - box.w / 2, contact.y - box.y - box.h / 2) > .08) failures.push({ variant, ...sample, issue: 'drawn cursor tip detached from the actual paper grip' });
						const layer = hero.querySelector('[data-eu26-cursor-layer]');
						if (svg.lastElementChild !== layer || getComputedStyle(tip).pointerEvents !== 'none' || document.elementsFromPoint(screen.x, screen.y).some(element => element.closest('[data-eu26-cursor-layer]'))) failures.push({ variant, ...sample, issue: 'cursor overlay is not the transparent top layer' });
						contacts++;
					}
				}
				return { failures, contacts };
			`);
			assert.deepEqual(result.failures, []);
			assert.ok(result.contacts >= 6, 'teammates keep contact at early and distant wall times');
		});

		await t.test('one wall reuses its original DOM cards through complete cycles', () => {
			const period = model(40, data).wallLoop.period;
			const result = scenario(`
				explorer.setVariant('paper');
				const times = [40, 100, 500, 1000, ${30 + period}, ${30 + period * 3}];
				const failures = [];
				const cardCounts = [];
				const snapshot = () => new Map([...hero.querySelectorAll('[data-eu26-piece^="wall"]')].filter(visible).map(element => [element.dataset.eu26CopyKey || element.dataset.eu26Piece, bounds(element.querySelector('.iso-top'))]));
				for (const time of times) {
					draw(time - .001);
					const before = snapshot();
					draw(time + .001);
					const after = snapshot();
					// A card a teammate is carrying in moves fast by design; only resting cards can show a recycle jump.
					const captured = new CustomEvent('eu26:capture', { detail: {} }); hero.dispatchEvent(captured);
					const carried = new Set((captured.detail.state?.wall ?? []).map((pose, index) => pose?.arrival && (captured.detail.state.time ?? time) < pose.arrival.touchdown ? 'wall.' + index : null).filter(Boolean));
					let moving = 0;
					for (const [key, previous] of before) {
						const next = after.get(key);
						if (!next || carried.has(key)) continue;
						const delta = Math.hypot(previous.x - next.x, previous.y - next.y);
						// A recycle jump would move a card hundreds of pixels; carried cards legitimately move a pixel or so per 2 ms.
						if (delta > 2) failures.push('visible recycle jump: ' + key + ' at ' + time);
						if (delta > .0001) moving++;
					}
					if (moving < 10) failures.push('wall stopped at ' + time);
					cardCounts.push(hero.querySelectorAll('[data-eu26-piece^="wall."]').length);
					if (hero.querySelector('[data-eu26-copy-key], [data-eu26-piece^="wallCopy."]')) failures.push('a duplicate wall layout was created');
					if (Number(hero.dataset.heroTime) <= 34) failures.push('time capped at guided duration');
				}
				for (const time of times) draw(time);
				const warmed = svg.querySelectorAll('*').length;
				for (const time of times) draw(time);
				return { failures, cardCounts, warmed, repeated: svg.querySelectorAll('*').length, visible: snapshot().size };
			`);
			assert.deepEqual(result.failures, []);
			assert.ok(result.cardCounts.every(count => count === data.wall.length), 'each source item keeps one original DOM card');
			assert.equal(result.repeated, result.warmed, 'replaying long times creates no extra DOM nodes');
			assert.ok(result.visible > 10);
		});

		await t.test('the complete authored sequence reaches its wall in about 20 real seconds', () => {
			const result = scenario(`
				hero.scrollIntoView({ block: 'center', behavior: 'instant' });
				await until(() => explorer.getState().visible, 'hero did not become visible');
				explorer.seek(0);
				const started = performance.now();
				explorer.play();
				while (explorer.getState().time < 34 && performance.now() - started < 23000) await wait(16);
				const elapsed = (performance.now() - started) / 1000;
				const state = explorer.getState();
				explorer.pause();
				return { elapsed, authored: state.time, rate: state.playbackRate, duration: state.durationSeconds,
					elapsedSeconds: state.elapsedSeconds, slider: Number(timeline.value), wall: hero.dataset.heroPhase };
			`);
			assert.equal(result.rate, 1.7);
			assert.equal(result.duration, 20);
			assert.ok(result.elapsed >= 19.5 && result.elapsed <= 21.5, `full playback took ${result.elapsed.toFixed(2)} real seconds`);
			assert.ok(result.authored >= 34);
			assert.ok(Math.abs(result.elapsedSeconds - result.authored / 1.7) < .00001);
			assert.equal(result.slider, 11);
			assert.equal(result.wall, 'wallGlide');
		});

		await t.test('the wall runs beyond 34 while timeline, pause, offscreen suspension and replay remain usable', () => {
			const result = scenario(`
				hero.scrollIntoView({ block: 'center', behavior: 'instant' });
				await until(() => explorer.getState().visible, 'hero did not become visible');
				explorer.seek(33.95);
				explorer.play();
				await until(() => explorer.getState().time > 34.1, 'wall did not continue past the guided timeline');
				const continued = explorer.getState().playing && Number(timeline.value) === Number(timeline.max);
				explorer.pause();
				const paused = explorer.getState().time;
				await wait(120);
				const held = explorer.getState().time === paused;
				explorer.play();
				// Temporary scroll room below the story, so the pinned figure can leave the viewport.
				const spacer = document.body.appendChild(Object.assign(document.createElement('div'), { style: 'block-size: 300vh' }));
				window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
				await until(() => !explorer.getState().visible, 'offscreen wall did not suspend');
				const offscreen = explorer.getState().time;
				await wait(120);
				const suspended = explorer.getState().time === offscreen;
				spacer.remove();
				hero.scrollIntoView({ block: 'center', behavior: 'instant' });
				await until(() => explorer.getState().playing && explorer.getState().time > offscreen, 'wall did not resume');
				explorer.pause();
				timeline.value = 8;
				timeline.dispatchEvent(new Event('input', { bubbles: true }));
				const scrubbed = explorer.getState().time === 19 && Number(hero.dataset.heroTime) === 19;
				const replay = document.querySelector('[data-eu26-action="replay"]');
				if (replay) replay.click();
				else { explorer.seek(0); explorer.play(); }
				await until(() => explorer.getState().playing && explorer.getState().time > 0 && explorer.getState().time < .5, 'replay did not restart');
				explorer.pause();
				return { continued, held, suspended, scrubbed, replayed: explorer.getState().time < .5 };
			`);
			assert.deepEqual(result, { continued: true, held: true, suspended: true, scrubbed: true, replayed: true });
		});

		run('set', 'viewport', '320', '844');
		await t.test('repeating helper cursors fit a steady camera on narrow phones', () => {
			const result = scenario(`
				await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
				const failures = [];
				for (const variant of ['paper']) {
					explorer.setVariant(variant);
					for (const time of [35.8, 36.5, 39.8, 43.8, 99.8, 107.8, 500, 1000]) {
						explorer.seek(time);
						if (+hero.dataset.heroCursorClips) failures.push({variant,time});
					}
				}
				return failures;
			`);
			assert.deepEqual(result, [], 'helper placements leave cursor clearance without steering the camera');
		});

		run('set', 'media', 'dark', 'reduced-motion');
		run('reload');
		run('wait', '--fn', 'Boolean(window.__eu26Explorer)');
		await t.test('reduced motion holds the looping wall still and preserves manual scrubbing', () => {
			const result = scenario(`
				hero.scrollIntoView({ block: 'center', behavior: 'instant' });
				await wait(100);
				const before = explorer.getState().time;
				await wait(150);
				const still = !explorer.getState().playing && explorer.getState().time === before;
				timeline.value = 9;
				timeline.dispatchEvent(new Event('input', { bubbles: true }));
				const exact = explorer.getState().time === 22 && Number(hero.dataset.heroTime) === 22;
				const geometry = piece('tile.0').querySelector('.iso-top').getAttribute('d');
				await wait(120);
				return { reduced: explorer.getState().reducedMotion, still, exact, unchanged: geometry === piece('tile.0').querySelector('.iso-top').getAttribute('d') };
			`);
			assert.deepEqual(result, { reduced: true, still: true, exact: true, unchanged: true });
		});
	} finally {
		run('close');
	}
});
