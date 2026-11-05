import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const session = `eu26-story-layout-test-${process.pid}`;
const artifact = fileURLToPath(new URL('../eu26-animation-explained.html', import.meta.url));
const run = (...args) => execFileSync('agent-browser', ['--session', session, ...args], { encoding: 'utf8', timeout: 45000 });
const evaluate = source => JSON.parse(run('eval', '-b', Buffer.from(source).toString('base64')));
const scenario = source => evaluate(`(async () => {
	const story = window.__vpkStory, explorer = window.__eu26Explorer;
	const root = document.querySelector('main[data-vpk-story]');
	const stage = document.querySelector('[data-story-stage]');
	const hero = document.querySelector('[data-vpk-figure="eu26-hero"]');
	const steps = [...document.querySelectorAll('article[data-story-step]')];
	const modes = [...document.querySelectorAll('.story-bar button[data-story-mode]')];
	const controls = document.querySelector('#eu26-explorer-controls');
	const timeline = document.querySelector('#eu26-explorer-timeline');
	const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
	const settle = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
	const until = async (condition, message) => {
		const deadline = performance.now() + 3000;
		while (performance.now() < deadline) {
			if (condition()) return;
			await wait(16);
		}
		throw new Error(message + ': ' + JSON.stringify({ story: story.getState(), explorer: explorer.getState() }));
	};
	const active = () => steps.filter(step => step.getAttribute('aria-current') && step.getAttribute('aria-current') !== 'false').map(step => Number(step.dataset.storyIndex));
	const scrollStep = async (index, fraction = 0) => {
		const heading = steps[index].querySelector('h2').getBoundingClientRect();
		const next = steps[index + 1]?.querySelector('h2').getBoundingClientRect();
		const between = next ? (next.top - heading.top) * fraction : 0;
		window.scrollTo({ top: scrollY + heading.top + between - story.getState().readingLine, behavior: 'instant' });
		story.follow();
		await settle();
	};
	${source}
})()`);

test('one sticky hero follows a readable story with accessible alternative layouts', { timeout: 120000 }, async t => {
	run('set', 'viewport', '1440', '1000');
	run('set', 'media', 'light');
	run('open', `file://${artifact}`);
	run('wait', '--fn', 'Boolean(window.__vpkStory && window.__eu26Explorer)');
	try {
		await t.test('scrolling forward and backward keeps one hero sticky and updates the active chapter', () => {
			const result = scenario(`
				explorer.pause(); story.setMode('story');
				const frames = [];
				for (const index of [3, 6, 3]) {
					await scrollStep(index);
					const state = story.getState(), rect = stage.getBoundingClientRect();
					frames.push({ index: state.index, time: state.time, active: active(), top: rect.top,
						modelTime: explorer.getState().time, playing: explorer.getState().playing });
				}
				await scrollStep(3, .63);
				const between = story.getState().time;
				return { frames, heroes: document.querySelectorAll('[data-vpk-figure="eu26-hero"]').length,
					steps: steps.length, position: getComputedStyle(stage).position, heroInside: stage.contains(hero), mode: root.dataset.storyMode, between };
			`);
			assert.equal(result.heroes, 1);
			assert.equal(result.steps, 12);
			assert.equal(result.heroInside, true);
			assert.equal(result.position, 'sticky');
			assert.equal(result.mode, 'story');
			assert.ok([0, 2, 4, 6, 8, 10, 13, 16, 19, 22, 25, 34].every(time => Math.abs(time - result.between) > .001), 'Story mode interpolates between chapter frames');
			for (const frame of result.frames) {
				assert.deepEqual(frame.active, [frame.index]);
				assert.ok(Math.abs(frame.modelTime - frame.time) < .00001, 'the visible model follows the story frame');
				assert.equal(frame.playing, false, 'scroll reading does not start a second playback clock');
			}
			assert.ok(result.frames[1].time > result.frames[0].time, 'forward scrolling advances the story');
			assert.ok(Math.abs(result.frames[2].time - result.frames[0].time) < .001, 'backward scrolling restores the same frame');
			assert.ok(Math.abs(result.frames[0].top - result.frames[1].top) < 2, 'the hero stays in place while the text scrolls');
		});

		await t.test('timeline scrubbing reveals the matching text in both directions without moving focus', () => {
			const result = scenario(`
				const frames = [];
				const chapterTimes=JSON.parse(document.querySelector('[data-eu26-explorer-model]').textContent).states.map(state=>state.time);
				for (const mode of ['story', 'slides', 'twitter']) {
					story.setMode(mode); story.select(0); await settle();
					timeline.focus({ preventScroll: true });
					const pages=['story','slides'].includes(mode);
					for (const value of pages?[10.25,3.5,8.125,11,0]:[14.8,3.6,11.2,20,0]) {
						timeline.value = String(value);
						timeline.dispatchEvent(new Event('input', { bubbles: true }));
						await settle();
						const state = explorer.getState(), chapter = steps[state.selectedIndex];
						const heading = chapter.querySelector('h2').getBoundingClientRect();
						const lower=Math.floor(value),next=Math.min(chapterTimes.length-1,lower+1);
						frames.push({ mode, value, expectedTime:pages?chapterTimes[lower]+(chapterTimes[next]-chapterTimes[lower])*(value-lower):value*1.7, time: state.time, index: state.selectedIndex,
							storyIndex: story.getState().index, active: active(), headingTop: heading.top,
							headingBottom: heading.bottom, readingLine: story.getState().readingLine,
							viewport: innerHeight, focused: document.activeElement === timeline, playing: state.playing });
						const heldTime = state.time; await wait(40);
						if (explorer.getState().time !== heldTime || story.getState().following) throw new Error('programmatic chapter alignment fed back into the clock');
					}
				}
				story.setMode('story'); root.focus({ preventScroll: true });
				return frames;
			`);
			for (const frame of result) {
				assert.equal(frame.storyIndex, frame.index);
				assert.deepEqual(frame.active, [frame.index]);
				assert.ok(Math.abs(frame.time - frame.expectedTime) < .00001);
				// Slides shows one step with no scroll anchors, so it only has to be fully visible; scrolling modes land on the reading line.
				if (frame.mode === 'slides') assert.ok(frame.headingTop >= 0, `slides selection ${frame.value} keeps its heading in view`);
				else assert.ok(frame.headingTop >= frame.readingLine - 12 && frame.headingTop < frame.readingLine + 58,
					`${frame.mode} selection ${frame.value} brings its text to the reading line`);
				assert.ok(frame.headingBottom < frame.viewport - 8);
				assert.equal(frame.focused, true);
				assert.equal(frame.playing, false);
			}
		});

		await t.test('temporary previews show matching text and restore the committed chapter and reading position', () => {
			const result = scenario(`
				explorer.seek(6.12); await settle();
				const before = { y: scrollY, index: story.getState().index, active: active() };
				explorer.preview(10); await settle();
				const heading = steps[10].querySelector('h2').getBoundingClientRect();
				const during = { y: scrollY, index: story.getState().index, active: active(), preview: explorer.getState().previewIndex,
					headingTop: heading.top, readingLine: story.getState().readingLine };
				explorer.clearPreview(); await settle();
				return { before, during, after: { y: scrollY, index: story.getState().index, active: active() } };
			`);
			assert.equal(result.during.preview, 10);
			assert.equal(result.during.index, result.before.index);
			assert.deepEqual(result.during.active, [10]);
			assert.ok(result.during.headingTop >= result.during.readingLine - 12 && result.during.headingTop < result.during.readingLine + 58);
			assert.deepEqual(result.after, result.before);
		});

		await t.test('playback brings each newly reached chapter into the reading area', () => {
			const result = scenario(`
				story.select(0); explorer.seek(7.99); explorer.play();
				await until(() => explorer.getState().time > 8.1, 'playback chapter boundary');
				explorer.pause(); await settle();
				const state = explorer.getState(), heading = steps[state.selectedIndex].querySelector('h2').getBoundingClientRect();
				return { index: state.selectedIndex, active: active(), top: heading.top, line: story.getState().readingLine };
			`);
			assert.equal(result.index, 4);
			assert.deepEqual(result.active, [4]);
			assert.ok(result.top >= result.line - 12 && result.top < result.line + 58);
		});

		await t.test('all three modes preserve the chapter and Slides hides inactive content from focus', () => {
			const result = scenario(`
				story.select(5); await until(() => story.getState().index === 5, 'chapter selection');
				explorer.seek(12.345);
				const states = [], failures = [];
				let tallHeight = 0, compactHeight = 0;
				for (const mode of ['story', 'slides', 'twitter']) {
					const button = modes.find(button => button.dataset.storyMode === mode);
					if (!button || button.type !== 'button') throw new Error('missing native mode button ' + mode);
					button.click(); await settle();
					states.push({ mode: story.getState().mode, index: story.getState().index,
						pressed: modes.filter(button => button.getAttribute('aria-pressed') === 'true').map(button => button.dataset.storyMode),
						time: explorer.getState().time, playing: explorer.getState().playing });
					if (mode === 'story') tallHeight = steps.reduce((sum, step) => sum + step.getBoundingClientRect().height, 0);
					if (mode === 'twitter') {
						compactHeight = steps.reduce((sum, step) => sum + step.getBoundingClientRect().height, 0);
						if (steps.some(step => step.hidden || step.inert || !step.getClientRects().length)) failures.push('Twitter hides a chapter');
					}
					if (mode === 'slides') for (const [index, step] of steps.entries()) {
						if (index === story.getState().index) continue;
						const probe = document.createElement('button'); probe.textContent = 'focus probe'; step.append(probe);
						probe.focus();
						if (!(step.hidden || step.inert) || step.contains(document.activeElement)) failures.push('inactive slide ' + index + ' accepts focus');
						probe.remove();
					}
				}
				story.setMode('story');
				explorer.play(); await until(() => explorer.getState().playing, 'playback before mode changes');
				const continuing = [];
				for (const mode of ['slides', 'twitter', 'story']) {
					const before = explorer.getState().time;
					modes.find(button => button.dataset.storyMode === mode).click(); await wait(80);
					continuing.push(explorer.getState().wantsPlay && explorer.getState().time > before);
				}
				explorer.pause();
				return { states, failures, compact: compactHeight < tallHeight,
					heroes: document.querySelectorAll('[data-vpk-figure="eu26-hero"]').length, continuing };
			`);
			assert.deepEqual(result.failures, []);
			assert.equal(result.heroes, 1);
			assert.equal(result.compact, true);
			assert.ok(result.continuing.every(Boolean), 'mode changes preserve the active playback clock');
			for (const state of result.states) {
				assert.equal(state.index, 5, 'changing layout preserves the selected chapter');
				assert.deepEqual(state.pressed, [state.mode]);
				assert.equal(state.time, 12.345, 'changing layout preserves an exact fractional authored time');
				assert.equal(state.playing, false, 'mode changes preserve an explicit pause');
			}
		});

		await t.test('printing restores Twitter detail expansion and the exact paused frame', () => {
			const result = scenario(`
				explorer.pause(); story.setMode('twitter'); explorer.seek(12.345);
				const details = [...root.querySelectorAll('details.story-step-detail')];
				if (!details.length) throw new Error('missing story detail disclosures');
				details[3].open = true;
				await settle();
				const before = details.map(detail => detail.open), time = explorer.getState().time;
				window.dispatchEvent(new Event('beforeprint'));
				const expanded = details.every(detail => detail.open);
				window.dispatchEvent(new Event('afterprint'));
				await settle();
				return { expanded, restored: JSON.stringify(details.map(detail => detail.open)) === JSON.stringify(before),
					mode: story.getState().mode, time: explorer.getState().time, expected: time, playing: explorer.getState().playing };
			`);
			assert.equal(result.expanded, true);
			assert.equal(result.restored, true);
			assert.equal(result.mode, 'twitter');
			assert.equal(result.time, result.expected);
			assert.equal(result.playing, false);
		});

		await t.test('manual playback suspends story seeking until following is explicitly resumed', () => {
			const result = scenario(`
				story.setMode('story'); await scrollStep(3);
				controls.querySelector('[data-eu26-action="play"]').click();
				await until(() => explorer.getState().playing, 'manual playback');
				const before = explorer.getState().time, suspended = !story.getState().following;
				const target = steps[8].querySelector('h2').getBoundingClientRect();
				window.scrollTo({ top: scrollY + target.top - story.getState().readingLine, behavior: 'instant' });
				await wait(180);
				const after = explorer.getState().time;
				const noJump = after > before && after - before < 1.5 && !story.getState().following;
				explorer.pause(); story.follow(); await settle();
				return { suspended, noJump, following: story.getState().following,
					resynced: Math.abs(story.getState().time - explorer.getState().time) < .00001,
					active: active(), index: story.getState().index };
			`);
			assert.equal(result.suspended, true);
			assert.equal(result.noJump, true, 'programmatic scrolling cannot fight the playback clock');
			assert.equal(result.following, true);
			assert.equal(result.resynced, true);
			assert.deepEqual(result.active, [result.index]);
		});

		await t.test('a native reading scroll takes control back from manual playback', () => {
			scenario(`root.focus({ preventScroll: true });story.suspendFollowing(); explorer.play(); return null;`);
			run('press', 'PageDown');
			const result = scenario(`
				await until(() => story.getState().following && !explorer.getState().playing, 'reading did not take control');
				return { following: story.getState().following, playing: explorer.getState().playing,
					matched: Math.abs(story.getState().time - explorer.getState().time) < .00001 };
			`);
			assert.deepEqual(result, { following: true, playing: false, matched: true });
		});

		await t.test('native transport keyboard controls keep exact authored seek available', () => {
			scenario(`story.suspendFollowing(); explorer.pause(); timeline.focus({ preventScroll: true }); return null;`);
			run('press', 'End');
			assert.equal(scenario('return explorer.getState().time;'), 34);
			run('press', 'Home');
			assert.equal(scenario('return explorer.getState().time;'), 0);
			run('press', 'ArrowDown');
			const result = scenario(`return { value: Number(timeline.value), time: explorer.getState().time,
				focused: document.activeElement === timeline, labeled: Boolean(timeline.labels.length || timeline.getAttribute('aria-label')) };`);
			assert.equal(result.value,1);
			assert.equal(result.time,2);
			assert.equal(result.focused, true);
			assert.equal(result.labeled, true);
			scenario(`story.setMode('video'); return null;`);
			run('focus', '#eu26-explorer-controls [data-eu26-action="play"]');
			run('press', 'Enter');
			assert.equal(scenario(`await until(() => explorer.getState().playing, 'keyboard play'); return true;`), true);
			run('press', 'Space');
			assert.equal(scenario(`await until(() => !explorer.getState().playing, 'keyboard pause'); return true;`), true);
		});

		for (const width of [1440, 1100, 390, 320]) {
			run('set', 'viewport', String(width), width > 760 ? '1000' : '844');
			run('reload');
			run('wait', '--fn', 'Boolean(window.__vpkStory && window.__eu26Explorer)');
			run('mouse', 'move', '8', '40');
			await t.test(`${width}px places the diagram beside the text from 1024px and above it on narrow screens`, () => {
				const result = scenario(`
					await settle(); explorer.pause(); story.setMode('story'); story.suspendFollowing();
					window.scrollTo({top:0,behavior:'instant'});await settle();
					const box=element=>{const r=element.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
					const reading=root.querySelector('[data-story-steps]'),intro=root.querySelector('.story-intro');
					const initial={stage:box(stage),hero:box(hero),reading:box(reading),intro:box(intro),height:innerHeight};
					const beside=initial.stage.left>=initial.reading.right-1;
					const failures=[];
					for(const mode of ['story','slides','twitter']){
						story.setMode(mode);await settle();
						for(const index of [7,9]){
							story.select(index);await until(()=>story.getState().index===index&&!explorer.getState().transitioning,'chapter');await settle();
							const heading=box(steps[index].querySelector('h2')),article=box(steps[index]),column=box(reading),diagram=box(stage);
							if(heading.top<(beside?diagram.top:diagram.bottom+20) || heading.bottom>innerHeight-8)failures.push({mode,index,issue:'heading is outside the clear reading area',heading,diagram});
							if(article.left<column.left-1 || article.right>column.right+1 || article.width<column.width*.9)failures.push({mode,index,issue:'chapter is not in the reading column',article,column});
							if(beside ? diagram.left<column.right : Math.abs((diagram.left+diagram.right-column.left-column.right)/2)>2)failures.push({mode,index,issue:beside?'diagram overlaps the reading column':'stacked diagram and text use different columns',diagram,column});
							if(heading.left<column.left-1 || heading.right>column.right+1 || document.documentElement.scrollWidth>innerWidth+1)failures.push({mode,index,issue:'text overflows its column'});
							for(const code of steps[index].querySelectorAll('.vpk-code')){const c=box(code);if(c.left<column.left-1||c.right>column.right+1)failures.push({mode,index,issue:'code block overflows the reading column',c,column});}
							if(mode==='story' && index===7){
								const source=steps[4].querySelector('.vpk-code-head a'),heldTime=explorer.getState().time;
								if(!source)throw new Error('missing big-burst source link');
								source.blur();source.focus();await settle();
								const focused=box(source),sticky=box(stage);
								const covered=beside?(focused.right>sticky.left&&focused.left<sticky.right):focused.top<sticky.bottom+20;
								if(document.activeElement!==source || covered || focused.top<0 || focused.bottom>innerHeight-8)failures.push({mode,index,issue:'native source-link focus is covered by the diagram',focused,sticky});
								if(explorer.getState().time!==heldTime)failures.push({mode,index,issue:'source-link focus changes the paused animation time'});
							}
						}
					}
					return {initial,beside,failures};
				`);
				assert.deepEqual(result.failures, []);
				const { stage: diagram, hero: drawing, reading, intro, height } = result.initial;
				if (width >= 1024) {
					assert.equal(result.beside, true, 'wide screens place the figure beside the text');
					assert.ok(reading.width >= 380 && reading.width <= 560, `reading column width is ${reading.width}px`);
					assert.ok(diagram.width > reading.width, 'the figure page is wider than the reading page');
					assert.ok(diagram.height >= height * .8, `the figure page fills the viewport height (${diagram.height}px)`);
					assert.ok(drawing.height >= height * .45, `desktop drawing height is ${drawing.height}px`);
				} else {
					assert.equal(result.beside, false, 'narrow screens stack the figure above the text');
					assert.ok(intro.top >= diagram.bottom && intro.top - diagram.bottom <= 96, 'the compact introduction follows the diagram directly');
					assert.ok(intro.height < height * .65, 'the short introduction does not reserve an empty viewport');
					assert.ok(drawing.width >= reading.width - 1, 'the diagram gains the full reading-column width');
					assert.ok(reading.width >= width - 110);
					assert.ok(drawing.height <= height * .35, 'the mobile diagram leaves room for reading');
				}
			});
		}

		for (const width of [390, 320]) {
			run('set', 'viewport', String(width), '844');
			run('reload');
			run('wait', '--fn', 'Boolean(window.__vpkStory && window.__eu26Explorer)');
			await t.test(`${width}px keeps story controls and the single hero within the viewport`, () => {
				const result = scenario(`
					await settle();
					const failures = [];
					const collapsed = !window.__eu26Timeline.getState().expanded;
					for (const mode of ['story', 'slides', 'twitter']) {
						story.setMode(mode); await settle();
						if (document.documentElement.scrollWidth > innerWidth + 1) failures.push(mode + ' page overflows');
						for (const button of [...modes, ...controls.querySelectorAll('[data-eu26-action]')].filter(button => getComputedStyle(button).display !== 'none' && getComputedStyle(button).visibility !== 'hidden')) {
							const rect = button.getBoundingClientRect();
							if (rect.width <= 0 || rect.height < 32 || rect.left < -1 || rect.right > innerWidth + 1) failures.push(mode + ' clips ' + button.textContent.trim());
						}
						const rect = hero.getBoundingClientRect();
						if (rect.width <= 0 || rect.left < -1 || rect.right > innerWidth + 1) failures.push(mode + ' clips the hero');
					}
					for (const mode of ['story', 'twitter']) {
						story.setMode(mode); await settle();
						for (const index of [7, 9]) {
							story.select(index);
							await until(() => story.getState().index === index && !explorer.getState().transitioning, 'mobile chapter alignment');
							await settle();
							const heading = steps[index].querySelector('h2');
							if (!heading || heading.getBoundingClientRect().top - stage.getBoundingClientRect().bottom < 20) failures.push(mode + ' covers chapter ' + index + ' heading');
						}
					}
					return { failures, collapsed, heroes: document.querySelectorAll('[data-vpk-figure="eu26-hero"]').length };
				`);
				assert.deepEqual(result.failures, []);
				assert.equal(result.collapsed, true, 'mobile frame previews stay closed until requested');
				assert.equal(result.heroes, 1);
			});
		}

		run('set', 'media', 'dark', 'reduced-motion');
		run('reload');
		run('wait', '--fn', 'Boolean(window.__vpkStory && window.__eu26Explorer)');
		await t.test('reduced motion follows discrete chapters without an idle animation loop', () => {
			const result = scenario(`
				story.setMode('story'); explorer.pause();
				const authoredTimes = [0, 2, 4, 6, 8, 10, 13, 16, 19, 22, 25, 34];
				const samples = [];
				for (const [index, fraction] of [[2, .2], [4, .65], [6, .35], [4, .4]]) {
					await scrollStep(index, fraction);
					samples.push({ storyTime: story.getState().time, modelTime: explorer.getState().time, index: story.getState().index, active: active() });
				}
				await wait(180);
				const original = window.requestAnimationFrame;
				let frames = 0, mutations = 0;
				const observer = new MutationObserver(records => { mutations += records.length; });
				observer.observe(hero, { subtree: true, attributes: true, childList: true });
				window.requestAnimationFrame = function(...args) { frames++; return original.apply(this, args); };
				try { await wait(180); } finally { window.requestAnimationFrame = original; observer.disconnect(); }
				return { samples, frames, mutations, reduced: story.getState().reducedMotion,
					discrete: samples.every(sample => authoredTimes.includes(sample.storyTime) && sample.modelTime === sample.storyTime), playing: explorer.getState().playing };
			`);
			assert.equal(result.reduced, true);
			assert.equal(result.discrete, true);
			assert.equal(result.playing, false);
			assert.equal(result.frames, 0, 'settled reading schedules no animation frames');
			assert.equal(result.mutations, 0, 'the held model stays untouched');
			for (const sample of result.samples) assert.deepEqual(sample.active, [sample.index]);
		});
	} finally {
		run('close');
	}
});
