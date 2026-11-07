import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const session = `eu26-explorer-test-${process.pid}`;
const run = (...args) => execFileSync('agent-browser', ['--session', session, ...args], { encoding: 'utf8', timeout: 45000 });
const evaluate = expression => {
	try {
		return JSON.parse(run('eval', '-b', Buffer.from(expression).toString('base64')));
	} catch (error) {
		throw new Error(String(error.stderr || error.message).trim());
	}
};
const artifact = fileURLToPath(new URL('../eu26-animation-explained.html', import.meta.url));
const duration = 34;
const playbackRate = 1.7;
const durationSeconds = 20;
const stateTimes = [0, 2, 4, 6, 8, 10, 13, 16, 19, 22, 25, duration];
const thumb = index => `#eu26-explorer-controls [data-eu26-state-index="${index}"]`;
const action = name => `#eu26-explorer-controls [data-eu26-action="${name}"]`;

const scenario = body => evaluate(`(async () => {
	const explorer = window.__eu26Explorer;
	const hero = document.querySelector('[data-vpk-figure="eu26-hero"]');
	const controls = document.querySelector('#eu26-explorer-controls');
	const timeline = document.querySelector('#eu26-explorer-timeline');
	const thumbs = [...controls.querySelectorAll('[data-eu26-state-index]')];
	const stateTimes = ${JSON.stringify(stateTimes)};
	const duration = explorer.getState().duration;
	const playbackRate = explorer.getState().playbackRate;
	const durationSeconds = explorer.getState().durationSeconds;
	const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
	const near = (actual, expected) => Math.abs(actual - expected) < .00001;
	const until = async (condition, message, timeout = 2500) => {
		const deadline = performance.now() + timeout;
		while (performance.now() < deadline) {
			if (condition()) return;
			await wait(16);
		}
		throw new Error(message + ': ' + JSON.stringify({ state: explorer.getState(), focusedIndex: document.activeElement?.dataset?.eu26StateIndex, hovered: thumbs.filter(button => button.matches(':hover')).map(button => Number(button.dataset.eu26StateIndex)) }));
	};
	const settled = async index => until(() => {
		const state = explorer.getState();
		return state.selectedIndex === index && !state.transitioning && near(state.renderTime, stateTimes[index]);
	}, 'state ' + index + ' did not settle');
	const visual = root => {
		const svg = root.matches('svg') ? root : root.querySelector('svg');
		const frame = svg.getBoundingClientRect();
		const round = value => Math.round(value * 10000) / 10000;
		return JSON.stringify({
			viewBox: svg.getAttribute('viewBox'),
			parts: [...svg.querySelectorAll('path, polygon, rect, circle, ellipse, line, polyline')].flatMap(part => {
				if (part.closest('defs')) return [];
				let opacity = 1;
				for (let element = part; element && element !== svg.parentElement; element = element.parentElement) {
					const paint = getComputedStyle(element);
					if (paint.display === 'none' || paint.visibility === 'hidden') return [];
					opacity *= Number(paint.opacity);
				}
				if (opacity < .002) return [];
				const rect = part.getBoundingClientRect();
				const style = getComputedStyle(part);
				const owner = part.closest('[data-part], [data-eu26-cursor], [data-eu26-done-lighting]') || svg;
				const localIndex = [...owner.querySelectorAll('path, polygon, rect, circle, ellipse, line, polyline')].indexOf(part);
				const key = (owner.dataset.eu26CopyKey || owner.getAttribute('data-part') || owner.getAttribute('data-eu26-cursor') || (owner.hasAttribute('data-eu26-done-lighting') ? 'done-lighting' : 'scene')) + ':' + localIndex;
				const bounds = rect.width || rect.height ? [round((rect.x - frame.x) / frame.width), round((rect.y - frame.y) / frame.height), round(rect.width / frame.width), round(rect.height / frame.height)] : [0, 0, 0, 0];
				return [[key, part.tagName, style.fill, style.stroke, opacity, style.display, ...bounds]];
			}).sort((left, right) => left[0].localeCompare(right[0]))
		});
	};
	const cursorDrawings = root => {
		const svg = root.matches('svg') ? root : root.querySelector('svg');
		return [...svg.querySelectorAll('[data-eu26-cursor]')].flatMap(cursor => {
			let opacity = 1;
			for (let element = cursor; element && element !== svg.parentElement; element = element.parentElement) {
				const style = getComputedStyle(element);
				if (style.display === 'none' || style.visibility === 'hidden') return [];
				opacity *= Number(style.opacity);
			}
			if (opacity <= .15) return [];
			const tip = cursor.querySelector('[data-eu26-cursor-tip]');
			const nose = tip.getPointAtLength(0);
			const point = new DOMPoint(nose.x, nose.y).matrixTransform(tip.getScreenCTM());
			const local = point.matrixTransform(svg.getScreenCTM().inverse());
			const rect = cursor.getBoundingClientRect();
			return [{ id: cursor.dataset.eu26Cursor, point: { x: point.x, y: point.y }, local: { x: local.x, y: local.y }, rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height } }];
		});
	};
	const selected = () => thumbs.filter(button => button.getAttribute('aria-pressed') === 'true').map(button => Number(button.dataset.eu26StateIndex));
	const showFrame = index => {
		const list = controls.querySelector('.eu26-dock-filmstrip');
		const frame = thumbs[index].getBoundingClientRect(), viewport = list.getBoundingClientRect();
		list.scrollTop += frame.top - viewport.top - (list.clientHeight - frame.height) / 2;
	};
	window.__vpkStory?.setMode('twitter');
	if (window.__eu26Timeline && !window.__eu26Timeline.getState().expanded) { window.__eu26Timeline.setExpanded(true); await wait(220); }
	window.__vpkStory?.suspendFollowing();
	${body}
})()`);

test('the offline EU26 explorer renders and controls one detailed animation', { timeout: 180000 }, async t => {
	run('set', 'viewport', '1440', '900');
	run('set', 'media', 'light');
	run('open', `file://${artifact}`);
	run('wait', '--fn', 'Boolean(window.__eu26Explorer)');
	try {
		await t.test('one detailed hero and twelve actual visual thumbnails', () => {
			const result = scenario(`
				const thumbnailSvgs = thumbs.map(button => button.querySelector('.eu26-state-thumb > svg'));
				return {
					heroes: document.querySelectorAll('[data-vpk-figure="eu26-hero"]').length,
					solids: hero.querySelectorAll('.iso-solid').length,
					artworkAndLabels: hero.querySelectorAll('svg text, svg image, svg foreignObject').length,
					faceDetails: hero.querySelectorAll('[data-part] > [data-eu26-detail]').length,
					visibleWithoutDetail: [...hero.querySelectorAll('[data-eu26-piece][data-part]')].filter(part => part.style.display !== 'none' && !part.querySelector(':scope > [data-eu26-detail]')).length,
					hiddenWithDetail: [...hero.querySelectorAll('[data-eu26-piece][data-part]')].filter(part => part.style.display === 'none' && part.querySelector(':scope > [data-eu26-detail]')).length,
					buttons: thumbs.length,
					uniquePartNames: new Set([...hero.querySelectorAll('[data-part]')].map(part => part.dataset.part)).size === hero.querySelectorAll('[data-part]').length,
					nativeButtons: thumbs.every(button => button.tagName === 'BUTTON' && button.type === 'button'),
					labels: thumbs.every(button => (button.getAttribute('aria-label') || button.textContent).trim().length > 0),
					thumbnails: thumbnailSvgs.filter(Boolean).length,
					renderedThumbnails: thumbnailSvgs.every(svg => svg && svg.querySelector('.iso-solid') && [...svg.querySelectorAll('path, polygon, rect')].some(part => {
						const rect = part.getBoundingClientRect();
						return rect.width > 0 && rect.height > 0 && getComputedStyle(part).opacity !== '0';
					})),
					distinctVisuals: new Set(thumbnailSvgs.map(svg => visual(svg))).size,
					range: timeline.type === 'range' && Number(timeline.min) === 0 && Number(timeline.max) === durationSeconds,
					duration: explorer.getState().duration, playbackRate, durationSeconds
				};
			`);
			assert.equal(result.heroes, 1);
			assert.ok(result.solids > 80, `expected detailed anatomy, found ${result.solids} solid parts`);
			assert.equal(result.artworkAndLabels, 0, 'faces are container outlines: no text, labels or artwork');
			assert.ok(result.faceDetails >= 15, `the board's chrome and cards carry face detail inside their own groups, found ${result.faceDetails}`);
			assert.equal(result.visibleWithoutDetail, 0, 'every visible surface shows its face detail');
			assert.equal(result.hiddenWithDetail, 0, 'hidden surfaces release their detail from the live DOM');
			assert.equal(result.buttons, 12);
			assert.equal(result.thumbnails, 12);
			assert.equal(result.distinctVisuals, 12, 'thumbnail graphics show twelve different poses');
			for (const key of ['nativeButtons', 'labels', 'renderedThumbnails', 'range', 'uniquePartNames']) assert.equal(result[key], true, key);
			assert.equal(result.duration, duration);
			assert.equal(result.playbackRate, playbackRate);
			assert.equal(result.durationSeconds, durationSeconds);
		});

		await t.test('the completed Done list uses readable rows within its visible window', async () => {
			const { data, model } = await import('./eu26-hero.hero.mjs');
			const { viewport, gap, cards } = data.doneList;
			const overlaps = (left, right) => Math.min(left.x + left.w, right.x + right.w) - Math.max(left.x, right.x) > .00001 && Math.min(left.y + left.d, right.y + right.d) - Math.max(left.y, right.y) > .00001;
			const rows = [...cards].sort((left, right) => left.rank - right.rank);
			assert.ok(rows.length > 3, 'the Done window contains a longer logical list');
			assert.ok(gap >= 12, 'Done cards retain a visible gap');
			for (let index = 1; index < rows.length; index++) {
				assert.ok(rows[index].y - rows[index - 1].y >= rows[index - 1].d + gap - .00001, 'logical Done rows do not compress or overlap');
			}
			for (const time of [6, 8, 10, 13]) {
				const state = model(time, data);
				const visible = state.cards.flatMap((pose, index) => {
					if (pose.alpha <= .001 || !pose.clip) return [];
					const card = data.cards[index];
					const rectangle = { x: pose.at[0] - card.w * pose.scale / 2, y: pose.at[1] - card.d * pose.scale / 2, w: card.w * pose.scale, d: card.d * pose.scale };
					return overlaps(rectangle, viewport) ? [rectangle] : [];
				});
				assert.equal(visible.length, 4, `Done is full at ${time} seconds: three readable rows and a fourth clipped by the column`);
					assert.ok(Math.max(...visible.map(card => card.y + card.d)) > viewport.y + viewport.d, 'the lowest visible Done card runs past the window edge');
				for (let left = 0; left < visible.length; left++) {
					for (let right = left + 1; right < visible.length; right++) assert.equal(overlaps(visible[left], visible[right]), false, `visible Done cards do not overlap at ${time} seconds`);
				}
			}
		});

		await t.test('the final wall preserves mixed source proportions without overlapping cards', async () => {
			const { data, model } = await import('./eu26-hero.hero.mjs');
			const state = model(data.duration, data);
			const cards = data.wall.flatMap((card, index) => card.reserved ? [] : [{ ...card, pose: state.wall[index] }]);
			assert.ok(cards.length > 0);
			assert.ok(new Set(cards.map(card => `${card.w}:${card.d}`)).size >= 4, 'the wall contains at least four actual card shapes');
			assert.ok(cards.some(card => card.w / card.d > 1.5), 'the wall includes wide cards');
			assert.ok(cards.some(card => card.d / card.w > 1.5), 'the wall includes tall cards');
			assert.ok(cards.some(card => Math.abs(card.w / card.d - 1) < .08), 'the wall includes square cards');
			for (const card of cards) {
				assert.ok(card.source && card.source.width > 0 && card.source.height > 0, 'every rendered wall card records its source dimensions');
				assert.ok(Math.abs(card.w / card.d - card.source.width / card.source.height) < .00001, 'rendered wall cards preserve their source aspect ratios');
			}
			const rectangles = cards.map(card => ({ key: card.key, x: card.pose.at[0] - card.w * card.pose.scale / 2, y: card.pose.at[1] - card.d * card.pose.scale / 2, w: card.w * card.pose.scale, d: card.d * card.pose.scale }));
			for (let left = 0; left < rectangles.length; left++) {
				for (let right = left + 1; right < rectangles.length; right++) {
					const a = rectangles[left], b = rectangles[right];
					const overlap = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > .00001 && Math.min(a.y + a.d, b.y + b.d) - Math.max(a.y, b.y) > .00001;
					assert.equal(overlap, false, `wall cards ${a.key} and ${b.key} do not overlap`);
				}
			}
		});

		await t.test('the single paper style ships without a style picker and keeps the orange focal', () => {
			const result = scenario(`
				const picker = document.querySelectorAll('#eu26-variant-controls button').length;
				explorer.seek(19);
				const state = explorer.getState();
				const probe = document.createElement('span');
				probe.style.color = 'var(--ill-accent)';
				hero.append(probe);
				const orange = getComputedStyle(probe).color;
				probe.remove();
				const focal = hero.querySelector('[data-focal="hero-card"]');
				const rect = focal.getBoundingClientRect();
				const orangeFocal = rect.width > 0 && rect.height > 0 && [...focal.querySelectorAll('.iso-top, .iso-edge')].some(part => { const style = getComputedStyle(part); return style.fill === orange || style.stroke === orange; });
				const noArtworkOrLabels = hero.querySelectorAll('svg text, svg image, svg foreignObject').length === 0;
				return { picker, variant: state.variant, orangeFocal, noArtworkOrLabels };
			`);
			assert.equal(result.picker, 0, 'no style picker with one paper style');
			assert.equal(result.variant, 'paper');
			assert.equal(result.orangeFocal, true);
			assert.equal(result.noArtworkOrLabels, true);
		});

		await t.test('manual playback suspends work offscreen and resumes on re-entry', () => {
			run('reload');
			run('wait', '--fn', 'Boolean(window.__eu26Explorer)');
			const result = scenario(`
				hero.scrollIntoView({ block: 'center', behavior: 'instant' });
				await until(() => explorer.getState().visible, 'hero did not enter the viewport');
				const manualOnly = !explorer.getState().playing;
				explorer.play();
				await until(() => explorer.getState().playing, 'manual playback did not start');
				const entered = explorer.getState().time;
				await until(() => explorer.getState().time > entered + .04, 'visible playback did not advance');
				// Temporary scroll room below the story, so the pinned figure can leave the viewport.
				const spacer = document.body.appendChild(Object.assign(document.createElement('div'), { style: 'block-size: 300vh' }));
				window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
				await until(() => !explorer.getState().visible && !explorer.getState().playing, 'offscreen playback did not suspend');
				const offscreen = explorer.getState().time;
				await wait(160);
				const suspended = near(explorer.getState().time, offscreen);
				spacer.remove();
				hero.scrollIntoView({ block: 'center', behavior: 'instant' });
				await until(() => explorer.getState().playing && explorer.getState().time > offscreen + .04, 'playback did not resume on re-entry');
				explorer.pause();
				return { entered, manualOnly, suspended, resumed: explorer.getState().time > offscreen };
			`);
			assert.ok(result.entered >= 0);
			assert.equal(result.manualOnly, true, 'story reading starts with a still model');
			assert.equal(result.suspended, true);
			assert.equal(result.resumed, true);
		});

		await t.test('previous and next jump to adjacent states and reframe the camera', () => {
			scenario('explorer.seek(8); return null;');
			run('click', action('next'));
			const next = scenario(`
				await settled(5);
				const next = { state: explorer.getState(), selected: selected(), visual: visual(hero), viewBox: hero.querySelector('svg').getAttribute('viewBox') };
				explorer.seek(0);
				const firstCamera = hero.querySelector('svg').getAttribute('viewBox');
				explorer.seek(duration);
				const lastCamera = hero.querySelector('svg').getAttribute('viewBox');
				explorer.seek(10);
				return { ...next, cameraChanged: firstCamera !== lastCamera };
			`);
			assert.equal(next.state.time, 10);
			assert.deepEqual(next.selected, [5]);
			assert.equal(next.cameraChanged, true, 'the camera frames the opening and final board differently');
			run('click', action('previous'));
			const previous = scenario(`await settled(4); return { state: explorer.getState(), selected: selected(), visual: visual(hero) };`);
			assert.equal(previous.state.time, 8);
			assert.deepEqual(previous.selected, [4]);
			assert.notEqual(previous.visual, next.visual, 'adjacent navigation changes rendered anatomy');
		});

		await t.test('each thumbnail commits its state and settles on its exact rendered pose', () => {
			const result = scenario(`
				hero.scrollIntoView({ block: 'center', behavior: 'instant' });
				await until(() => explorer.getState().visible, 'hero did not enter the viewport');
				const poses = [];
				let consistent = true;
				let selectedOnlyOne = true;
				for (let index = 0; index < thumbs.length; index++) {
					thumbs[index].click();
					await settled(index);
					const state = explorer.getState();
					const pose = visual(hero);
					poses.push(pose);
					selectedOnlyOne = selectedOnlyOne && selected().length === 1 && selected()[0] === index;
					const sliderMatches = Math.abs(Number(timeline.value) - stateTimes[index] / playbackRate) <= Number(timeline.step) / 2 + .00001;
					consistent = consistent && near(state.time, stateTimes[index]) && sliderMatches && !state.playing;
					explorer.seek(stateTimes[index]);
					consistent = consistent && visual(hero) === pose;
				}
				return { consistent, selectedOnlyOne, distinctPoses: new Set(poses).size };
			`);
			assert.equal(result.consistent, true, 'thumbnail settles match exact seek poses and timeline values');
			assert.equal(result.selectedOnlyOne, true);
			assert.equal(result.distinctPoses, 12, 'each committed state changes the rendered anatomy');
		});

		await t.test('projected paper ordering stays acyclic between keyframes', () => {
			const result = scenario(`
				const variants = ['paper'];
				const samples = [...new Set([...stateTimes, ...Array.from({ length: 36 }, (_, index) => duration * (index + 1) / 37), 2.33, 6.22, 14, 14.055, 14.1, 14.145, 14.15, 14.255, 14.28, 14.31, 20.4, 23.625])];
				const failures = [];
				for (const variant of variants) {
					explorer.setVariant(variant);
					for (const time of samples) {
						explorer.seek(time);
						if (Number(hero.dataset.heroDepthCycles) !== 0) failures.push({ variant, time, cycles: hero.dataset.heroDepthCycles });
					}
				}
				explorer.setVariant(variants[0]);
				return { samples: samples.length * variants.length, failures };
			`);
			assert.equal(result.samples, 60);
			assert.deepEqual(result.failures, [], 'the renderer can order visible paper planes at every sampled pose');
		});

		await t.test('visible cursor arrows contact carried cards and fit the camera', async () => {
			const { data, model } = await import('./eu26-hero.hero.mjs');
			const cursorTimes = [1.2, 1.6, 4.8, 5.4, 23, 24, 25, 26.2, 27.5, 29, 31, 33.5, 34];
			const samples = data.variants.flatMap(({ id: variant }) => cursorTimes.map(time => ({ variant, time, cursors: model({ time, variant }, data).cursors.filter(cursor => cursor.alpha > .15) })));
			for (const [width, height] of [[1440, 900], [390, 844]]) {
				run('set', 'viewport', String(width), String(height));
				const result = scenario(`
					hero.scrollIntoView({ block: 'center', behavior: 'instant' });
					const failures = [];
					let contacts = 0;
					let transparentHits = 0;
					const visibleActors = new Set();
					for (const sample of ${JSON.stringify(samples)}) {
						explorer.setVariant(sample.variant);
						explorer.seek(sample.time);
						const svg = hero.querySelector('svg');
						const frame = svg.getBoundingClientRect();
						const layer = svg.querySelector('[data-eu26-cursor-layer]');
						if (svg.lastElementChild !== layer || layer.getAttribute('aria-hidden') !== 'true') failures.push({ time: sample.time, issue: 'cursor layer must be decorative and topmost' });
						if (layer.querySelector('a, button, input, [tabindex="0"]') || [...layer.querySelectorAll('*')].some(element => getComputedStyle(element).pointerEvents !== 'none')) failures.push({ time: sample.time, issue: 'cursor drawing captures user input' });
						if ([...layer.querySelectorAll('[data-eu26-cursor-tip],[data-eu26-cursor-ring]')].some(element => Number.parseFloat(getComputedStyle(element).strokeWidth) > 2)) failures.push({ time: sample.time, issue: 'cursor outline becomes too thick at this viewport' });
						const arrows = cursorDrawings(hero);
						if (arrows.some(arrow => !sample.cursors.some(cursor => cursor.id === arrow.id)) || sample.cursors.some(cursor => cursor.heldTarget && !arrows.some(arrow => arrow.id === cursor.id))) failures.push({ time: sample.time, variant: sample.variant, issue: 'a held actor is missing or an unmodeled arrow is visible' });
						for (const arrow of arrows) {
							visibleActors.add(arrow.id);
							const rect = arrow.rect;
							if (rect.width <= 0 || rect.height <= 0 || rect.left < frame.left - 1 || rect.top < frame.top - 1 || rect.right > frame.right + 1 || rect.bottom > frame.bottom + 1) failures.push({ time: sample.time, variant: sample.variant, id: arrow.id, issue: 'cursor is clipped by the camera' });
							if (arrow.point.x >= 0 && arrow.point.x < innerWidth && arrow.point.y >= 0 && arrow.point.y < innerHeight) {
								const hit = document.elementFromPoint(arrow.point.x, arrow.point.y);
								if (hit?.closest('[data-eu26-cursor-layer]')) failures.push({ time: sample.time, id: arrow.id, issue: 'cursor intercepts the actual pointer' });
								transparentHits += 1;
							}
							const cursor = sample.cursors.find(cursor => cursor.id === arrow.id);
							if (!cursor.heldTarget) continue;
							const target = cursor.heldTarget;
							const key = target.kind === 'title' ? 'title' : target.kind + '.' + target.index;
							const face = hero.querySelector('[data-eu26-piece="' + key + '"] .iso-top');
							const card = face.getBoundingClientRect();
							if (card.width <= 0 || card.height <= 0 || arrow.point.x < card.left - 2 || arrow.point.x > card.right + 2 || arrow.point.y < card.top - 2 || arrow.point.y > card.bottom + 2) failures.push({ time: sample.time, variant: sample.variant, id: arrow.id, issue: 'arrow tip does not contact its actual carried face' });
							if (card.left < frame.left - 2 || card.top < frame.top - 2 || card.right > frame.right + 2 || card.bottom > frame.bottom + 2) failures.push({ time: sample.time, variant: sample.variant, id: arrow.id, issue: 'carried object is clipped by the camera' });
							contacts += 1;
						}
						for (let left = 0; left < arrows.length; left++) for (let right = left + 1; right < arrows.length; right++) if (Math.hypot(arrows[left].point.x - arrows[right].point.x, arrows[left].point.y - arrows[right].point.y) < 4) failures.push({ time: sample.time, issue: 'visible human cursors coincide' });
					}
					explorer.setVariant('paper');
					return { failures, contacts, transparentHits, actors: [...visibleActors].sort() };
				`);
				assert.deepEqual(result.failures, [], `cursor geometry and input transparency at ${width}px`);
				assert.ok(result.contacts > 0);
				assert.ok(result.transparentHits > 0);
				assert.deepEqual(result.actors, ['main', 'teammate-1', 'teammate-2', 'teammate-3']);
			}
			run('set', 'viewport', '1440', '900');
		});

		await t.test('paused cursor arrows retain a readable size after resizing', () => {
			const before = scenario(`
				explorer.setVariant('paper');
				explorer.seek(1.2);
				hero.scrollIntoView({ block: 'center', behavior: 'instant' });
				return { state: explorer.getState(), cursor: cursorDrawings(hero).find(cursor => cursor.id === 'main') };
			`);
			run('set', 'viewport', '1440', '700');
			const shorter = scenario(`await wait(120); return { state: explorer.getState(), cursor: cursorDrawings(hero).find(cursor => cursor.id === 'main') };`);
			assert.ok(shorter.cursor, 'the pointer stays visible after a height-only resize');
			assert.equal(shorter.state.time, before.state.time);
			assert.equal(shorter.state.renderTime, before.state.renderTime);
			assert.ok(shorter.cursor.rect.width >= before.cursor.rect.width * .9 && shorter.cursor.rect.width <= before.cursor.rect.width * 1.1, 'pointer width stays stable when only viewport height changes');
			run('set', 'viewport', '390', '844');
			const after = scenario(`
				await wait(120);
				return { state: explorer.getState(), cursor: cursorDrawings(hero).find(cursor => cursor.id === 'main') };
			`);
			assert.ok(before.cursor && after.cursor, 'the pointer stays visible');
			assert.equal(after.state.time, before.state.time, 'resize does not advance paused playback');
			assert.equal(after.state.renderTime, before.state.renderTime);
			assert.ok(after.cursor.rect.width >= before.cursor.rect.width * .9 && after.cursor.rect.width <= before.cursor.rect.width * 1.1, 'pointer width remains stable in CSS pixels');
			run('set', 'viewport', '1440', '900');
		});

		await t.test('thumbnail cursor arrows match their actual timeline state and variant', () => {
			const result = scenario(`
				const failures = [];
				let arrowsCompared = 0;
				for (const variant of ['paper', 'outline', 'sculpted']) {
					explorer.setVariant(variant);
					for (let index = 0; index < stateTimes.length; index++) {
						explorer.seek(stateTimes[index]);
						const expected = cursorDrawings(hero);
						const thumbnail = controls.querySelector('[data-eu26-state-index="' + index + '"] .eu26-state-thumb > svg');
						const actual = cursorDrawings(thumbnail);
						if (JSON.stringify(expected.map(cursor => cursor.id).sort()) !== JSON.stringify(actual.map(cursor => cursor.id).sort())) failures.push({ variant, index, issue: 'thumbnail actor set differs' });
						for (const cursor of expected) {
							const thumb = actual.find(arrow => arrow.id === cursor.id);
							if (!thumb || Math.hypot(thumb.local.x - cursor.local.x, thumb.local.y - cursor.local.y) > .05) failures.push({ variant, index, id: cursor.id, issue: 'thumbnail arrow points somewhere different' });
							arrowsCompared += 1;
						}
					}
				}
				explorer.setVariant('paper');
				return { failures, arrowsCompared };
			`);
			assert.deepEqual(result.failures, []);
			assert.ok(result.arrowsCompared > 0);
		});

		await t.test('hover and keyboard focus preview without changing committed progress', () => {
			const baseline = scenario(`explorer.seek(10); return { visual: visual(hero), time: explorer.getState().time, selected: selected(), progress: timeline.value };`);
			scenario(`showFrame(8); await wait(40); return null;`);
			run('hover', thumb(8));
			const hover = scenario(`
				await until(() => explorer.getState().previewIndex === 8 && near(explorer.getState().renderTime, 19), 'hover preview did not appear');
				await wait(120);
				return { state: explorer.getState(), selected: selected(), progress: timeline.value, visual: visual(hero) };
			`);
			assert.equal(hover.state.time, baseline.time);
			assert.deepEqual(hover.selected, baseline.selected);
			assert.equal(hover.progress, baseline.progress);
			assert.notEqual(hover.visual, baseline.visual);
			run('mouse', 'move', '8', '40');
			const restored = scenario(`await until(() => explorer.getState().previewIndex === null, 'hover preview did not clear'); return { time: explorer.getState().time, visual: visual(hero) };`);
			assert.equal(restored.time, baseline.time);
			assert.equal(restored.visual === baseline.visual, true, 'leaving a hover preview restores the committed pose');
			run('focus', thumb(9));
			const focus = scenario(`await until(() => explorer.getState().previewIndex === 9 && near(explorer.getState().renderTime, 22), 'focus preview did not appear'); return { state: explorer.getState(), selected: selected(), progress: timeline.value };`);
			assert.equal(focus.state.time, baseline.time);
			assert.deepEqual(focus.selected, baseline.selected);
			assert.equal(focus.progress, baseline.progress);
			run('focus', '#eu26-explorer-timeline');
			assert.equal(scenario(`await until(() => explorer.getState().previewIndex === null, 'focus preview did not clear'); return visual(hero);`) === baseline.visual, true, 'blurring a focus preview restores the committed pose');
		});

		await t.test('previews freeze playing progress and resume after leaving', () => {
			const result = scenario(`
				explorer.seek(6);
				hero.scrollIntoView({ block: 'center', behavior: 'instant' });
				await until(() => explorer.getState().visible, 'hero did not enter the viewport');
				explorer.play();
				thumbs[7].focus({ preventScroll: true });
				await until(() => explorer.getState().previewIndex === 7, 'playing preview did not appear');
				const held = explorer.getState();
				await wait(150);
				const frozen = near(explorer.getState().time, held.time) && !explorer.getState().playing;
				timeline.focus({ preventScroll: true });
				await until(() => explorer.getState().previewIndex === null && explorer.getState().playing && explorer.getState().time > held.time, 'playback did not resume after preview');
				explorer.pause();
				return { frozen, intendedToPlay: held.wantsPlay };
			`);
			assert.deepEqual(result, { frozen: true, intendedToPlay: true });
		});

		await t.test('manual scrubbing uses the exact selected time', () => {
			const result = scenario(`
				timeline.value = '12.34';
				timeline.dispatchEvent(new Event('input', { bubbles: true }));
				const scrub = explorer.getState();
				const pose = visual(hero);
				await wait(120);
				const stayed = near(explorer.getState().time, 12.34 * playbackRate) && visual(hero) === pose;
				explorer.seek(7.1234);
				const precise = explorer.getState();
				return { scrub, stayed, precise, changed: visual(hero) !== pose };
			`);
			assert.ok(Math.abs(result.scrub.time - 12.34 * playbackRate) < .00001);
			assert.ok(Math.abs(result.scrub.renderTime - 12.34 * playbackRate) < .00001);
			assert.ok(Math.abs(result.scrub.elapsedSeconds - 12.34) < .00001, 'the slider uses real playback seconds');
			assert.equal(result.scrub.playing, false);
			assert.equal(result.stayed, true);
			assert.equal(result.precise.time, 7.1234);
			assert.equal(result.precise.renderTime, 7.1234);
			assert.equal(result.changed, true);
		});

		await t.test('play, pause, the infinite wall and replay share the timeline', () => {
			const result = scenario(`
				const play = controls.querySelector('[data-eu26-action="play"]');
				explorer.seek(0);
				hero.scrollIntoView({ block: 'center', behavior: 'instant' });
				await until(() => explorer.getState().visible, 'hero did not enter the viewport');
				play.click();
				await until(() => explorer.getState().playing && explorer.getState().time > .04, 'play did not start');
				play.click();
				const paused = explorer.getState();
				await wait(120);
				const pauseHeld = !explorer.getState().playing && near(explorer.getState().time, paused.time);
				explorer.seek(duration - .05);
				play.click();
				await until(() => explorer.getState().time > duration + .08 && explorer.getState().playing, 'the wall did not continue beyond the guide');
				const wallContinued = near(Number(timeline.value), durationSeconds) && explorer.getState().looping;
				play.click();
				const wallPause = explorer.getState().time;
				await wait(100);
				const wallPauseHeld = !explorer.getState().playing && near(explorer.getState().time, wallPause);
				play.click();
				await until(() => explorer.getState().time > wallPause + .03, 'the wall did not resume');
				controls.querySelector('[data-eu26-action="replay"]').click();
				await until(() => explorer.getState().playing && explorer.getState().time > 0 && explorer.getState().time < .5, 'replay did not restart');
				explorer.pause();
				return { pauseHeld, wallContinued, wallPauseHeld, replayed: explorer.getState().time < .5 };
			`);
			assert.deepEqual(result, { pauseHeld: true, wallContinued: true, wallPauseHeld: true, replayed: true });
		});

		await t.test('camera framing stays continuous across effect boundaries and holds through the burst', () => {
			const result = scenario(`
				explorer.pause();
				const frame = time => { explorer.seek(time); const box = hero.querySelector('svg').viewBox.baseVal; return ['x', 'y', 'width', 'height'].map(key => box[key]); };
				const jumps = [.3, 1.6, 13, 17, 19.1].map(time => {
					const before = frame(time - .001), after = frame(time + .001);
					return Math.max(...before.map((value, index) => Math.abs(value - after[index]))) / before[2];
				});
				const held = frame(6.2);
				const holds = [6.5, 7, 8, 9, 10.3].every(time => JSON.stringify(frame(time)) === JSON.stringify(held));
				return { jumps, holds };
			`);
			assert.ok(result.jumps.every(jump => jump < .003), JSON.stringify(result.jumps));
			assert.equal(result.holds, true, 'moving confetti cannot steer the camera');
		});

		await t.test('a distant state selection uses a direct camera move', () => {
			const result = scenario(`
				hero.scrollIntoView({ block: 'center', behavior: 'instant' });
				await until(() => explorer.getState().visible, 'hero did not enter the viewport');
				explorer.seek(0);
				const samples = [];
				const started = performance.now();
				const record = () => samples.push({ azimuth: Number(hero.dataset.heroAzimuth), elevation: Number(hero.dataset.heroElevation), phase: hero.dataset.heroPhase });
				hero.addEventListener('eu26:seek', record);
				thumbs[11].click();
				await settled(11);
				hero.removeEventListener('eu26:seek', record);
				return { samples, elapsed: performance.now() - started };
			`);
			assert.ok(result.samples.length > 3);
			assert.ok(result.elapsed >= 220 && result.elapsed <= 480, `state navigation finishes within its 240–420ms duration plus one frame (${result.elapsed.toFixed(0)}ms)`);
			// The jump blends straight from the board camera (45°, 30°) to the frontal wall (90°, 90°): one direction only, never
			// detouring through another shot's angles.
			assert.ok(result.samples.every(sample => sample.azimuth >= 45 - .001 && sample.azimuth <= 90 + .001 && sample.elevation >= 30 - .001 && sample.elevation <= 90 + .001), 'the jump stays between its endpoint cameras');
			assert.ok(result.samples.every((sample, index) => index === 0 || (sample.azimuth >= result.samples[index - 1].azimuth - .001 && sample.elevation >= result.samples[index - 1].elevation - .001)), 'the jump does not fast-forward through unrelated orbits');
			assert.ok(result.samples.every(sample => ['board', 'wallGlide'].includes(sample.phase)), 'unrelated chapters do not flash past');
		});

		await t.test('an interrupted selection converges on the newest target', () => {
			const result = scenario(`
				explorer.seek(0);
				thumbs[11].click();
				await until(() => explorer.getState().transitioning && explorer.getState().renderTime > 0 && explorer.getState().renderTime < duration, 'selection did not animate');
				const moving = visual(hero);
				thumbs[8].click();
				await wait(40);
				thumbs[3].click();
				await settled(3);
				const final = explorer.getState();
				const pose = visual(hero);
				explorer.seek(6);
				return { final, selected: selected(), matched: visual(hero) === pose, moved: moving !== pose };
			`);
			assert.equal(result.final.time, 6);
			assert.equal(result.final.renderTime, 6);
			assert.deepEqual(result.selected, [3]);
			assert.equal(result.matched, true);
			assert.equal(result.moved, true);
		});

		await t.test('pause and temporary previews preserve a partially completed direct move', () => {
			const result = scenario(`
				explorer.seek(0);
				thumbs[11].click();
				await until(() => explorer.getState().transitioning && explorer.getState().renderTime > 1, 'selection did not start');
				explorer.pause();
				const before = visual(hero), time = explorer.getState().renderTime;
				await wait(120);
				const held = before === visual(hero) && explorer.getState().renderTime === time;
				explorer.preview(6);
				explorer.clearPreview();
				const restored = visual(hero) === before;
				explorer.play();
				await until(() => !explorer.getState().transitioning, 'paused move did not resume');
				explorer.pause();
				return { held, restored, arrived: explorer.getState().selectedIndex === 11 };
			`);
			assert.deepEqual(result, { held: true, restored: true, arrived: true });
		});

		await t.test('native buttons and range support keyboard navigation', () => {
			run('mouse', 'move', '8', '40');
			scenario('explorer.seek(6); return null;');
			run('focus', action('next'));
			run('press', 'Enter');
			assert.equal(scenario('await settled(4); return explorer.getState().time;'), 8);
			run('focus', thumb(6));
			run('press', 'Space');
			assert.equal(scenario('await settled(6); return explorer.getState().time;'), 13);
			run('focus', '#eu26-explorer-timeline');
			run('press', 'End');
			assert.equal(scenario('return explorer.getState().time;'), duration);
			run('press', 'Home');
			assert.equal(scenario('return explorer.getState().time;'), 0);
			run('press', 'ArrowDown');
			const keyboard = scenario(`return { time: explorer.getState().time, value: Number(timeline.value), labeled: Boolean(timeline.labels.length || timeline.getAttribute('aria-label')), focused: document.activeElement === timeline };`);
			assert.ok(keyboard.time > 0 && keyboard.time < 1);
			assert.ok(Math.abs(keyboard.value * playbackRate - keyboard.time) < .00001);
			assert.equal(keyboard.labeled, true);
			assert.equal(keyboard.focused, true);
		});

		await t.test('enabling reduced motion during playback pauses until the user plays again', () => {
			scenario(`
				explorer.seek(6);
				hero.scrollIntoView({ block: 'center', behavior: 'instant' });
				await until(() => explorer.getState().visible, 'hero did not enter the viewport');
				explorer.play();
				await until(() => explorer.getState().playing && explorer.getState().time > 6, 'manual playback did not start');
				return null;
			`);
			run('set', 'media', 'light', 'reduced-motion');
			const reduced = scenario(`
				await until(() => explorer.getState().reducedMotion && !explorer.getState().playing && !explorer.getState().wantsPlay, 'live reduced motion did not pause playback');
				const held = explorer.getState();
				await wait(150);
				return { state: held, held: near(explorer.getState().time, held.time) };
			`);
			assert.equal(reduced.held, true);
			run('set', 'media', 'light');
			const resumed = scenario(`
				await until(() => !explorer.getState().reducedMotion, 'motion preference did not clear');
				const before = explorer.getState();
				await wait(120);
				const stayedPaused = !explorer.getState().playing && !explorer.getState().wantsPlay && near(explorer.getState().time, before.time);
				explorer.play();
				await until(() => explorer.getState().playing && explorer.getState().time > before.time, 'manual playback did not remain available');
				explorer.pause();
				return { before, stayedPaused };
			`);
			assert.equal(resumed.before.time, reduced.state.time);
			assert.equal(resumed.stayedPaused, true);
		});

		run('set', 'viewport', '390', '844');
		run('reload');
		run('wait', '--fn', 'Boolean(window.__eu26Explorer)');
		await t.test('mobile keeps the page within the viewport and every vertical preview reachable', () => {
			const result = scenario(`
				explorer.pause();
				const noOverflow = document.documentElement.scrollWidth <= innerWidth + 1;
				const list = controls.querySelector('.eu26-dock-filmstrip');
				const reachable = thumbs.every((button, index) => {
					showFrame(index);
					const rect = button.getBoundingClientRect(), frame = list.getBoundingClientRect();
					return rect.width >= 120 && rect.height >= 44 && rect.left >= 0 && rect.right <= innerWidth + 1 && rect.top >= frame.top - 1 && rect.bottom <= frame.bottom + 1;
				});
				const vertical = getComputedStyle(list).flexDirection === 'column' && list.scrollHeight > list.clientHeight;
				showFrame(7);
				await wait(80);
				thumbs[7].click();
				await settled(7);
				return { noOverflow, reachable, vertical, selected: selected(), time: explorer.getState().time };
			`);
			assert.equal(result.noOverflow, true);
			assert.equal(result.reachable, true);
			assert.equal(result.vertical, true);
			assert.deepEqual(result.selected, [7]);
			assert.equal(result.time, 16);
		});
		run('set', 'viewport', '320', '844');
		await t.test('narrow mobile keeps transport and state controls within the viewport', () => {
			const result = scenario(`
				const buttons = [...controls.querySelectorAll('[data-eu26-action]')].filter(button => getComputedStyle(button).display !== 'none');
				return {
					noOverflow: document.documentElement.scrollWidth <= innerWidth + 1,
					allControlsVisible: buttons.every(button => {
						const rect = button.getBoundingClientRect();
						return rect.width > 0 && rect.left >= 0 && rect.right <= innerWidth + 1;
					}),
					usablePreviews: thumbs.every(button => {
						const rect = button.getBoundingClientRect();
						return rect.width >= 44 && rect.height >= 44;
					})
				};
			`);
			assert.deepEqual(result, { noOverflow: true, allControlsVisible: true, usablePreviews: true });
		});
		run('set', 'viewport', '390', '844');

		run('set', 'media', 'dark', 'reduced-motion');
		run('reload');
		run('wait', '--fn', 'Boolean(window.__eu26Explorer)');
		await t.test('reduced motion stays still while manual navigation remains available', () => {
			const result = scenario(`
				hero.scrollIntoView({ block: 'center', behavior: 'instant' });
				await until(() => explorer.getState().visible, 'hero did not enter the viewport');
				const initial = explorer.getState();
				await wait(180);
				const noAutoplay = !explorer.getState().playing && near(explorer.getState().time, initial.time);
				thumbs[8].click();
				const chosen = explorer.getState();
				explorer.preview(2);
				const preview = explorer.getState();
				explorer.clearPreview();
				const restored = explorer.getState();
				timeline.value = '7.5';
				timeline.dispatchEvent(new Event('input', { bubbles: true }));
				return { reduced: initial.reducedMotion, noAutoplay, selected: chosen, preview, restored, scrub: explorer.getState() };
			`);
			assert.equal(result.reduced, true);
			assert.equal(result.noAutoplay, true);
			assert.equal(result.selected.selectedIndex, 8);
			assert.equal(result.selected.time, 19);
			assert.equal(result.selected.renderTime, 19);
			assert.equal(result.selected.transitioning, false);
			assert.equal(result.preview.time, 19);
			assert.equal(result.preview.renderTime, 4);
			assert.equal(result.restored.time, 19);
			assert.equal(result.restored.renderTime, 19);
			assert.equal(result.scrub.time, 7.5 * playbackRate);
			assert.equal(result.scrub.renderTime, 7.5 * playbackRate);
		});

		await t.test('reduced motion and pause leave no independent cursor animation', () => {
			const result = scenario(`
				explorer.seek(29);
				const layer = hero.querySelector('[data-eu26-cursor-layer]');
				const before = cursorDrawings(hero);
				let changes = 0;
				const observer = new MutationObserver(records => { changes += records.length; });
				observer.observe(layer, { attributes: true, childList: true, subtree: true });
				await wait(180);
				observer.disconnect();
				return { reduced: explorer.getState().reducedMotion, time: explorer.getState().time, arrows: before.length, same: JSON.stringify(before) === JSON.stringify(cursorDrawings(hero)), changes, runningAnimations: layer.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length };
			`);
			assert.equal(result.reduced, true);
			assert.equal(result.time, 29);
			assert.ok(result.arrows >= 2);
			assert.equal(result.same, true);
			assert.equal(result.changes, 0);
			assert.equal(result.runningAnimations, 0);
		});

		await t.test('printing uses a completed rest pose then restores the selected time', () => {
			const result = scenario(`
				explorer.seek(13.25);
				const before = explorer.getState();
				const original = visual(hero);
				window.dispatchEvent(new Event('beforeprint'));
				const printPose = visual(hero);
				const during = explorer.getState();
				window.dispatchEvent(new Event('afterprint'));
				const restored = explorer.getState();
				const restoredPose = visual(hero);
				explorer.seek(duration);
				const originalParts = JSON.parse(original).parts, restoredParts = JSON.parse(restoredPose).parts;
				const restoredDifferences = originalParts.flatMap((part, index) => JSON.stringify(part) === JSON.stringify(restoredParts[index]) ? [] : [{ before: part, after: restoredParts[index] }]).slice(0, 6);
				return { before, during, restored, printMatched: printPose === visual(hero), restoredPose: restoredPose === original, restoredDifferences };
			`);
			assert.equal(result.during.time, result.before.time);
			assert.equal(result.printMatched, true);
			assert.equal(result.restored.time, result.before.time);
			assert.equal(result.restored.selectedIndex, result.before.selectedIndex);
			assert.equal(result.restoredPose, true, JSON.stringify(result.restoredDifferences));
		});
	} finally {
		run('close');
	}
});
