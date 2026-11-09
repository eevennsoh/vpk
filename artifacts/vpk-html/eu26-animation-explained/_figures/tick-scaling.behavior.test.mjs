import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

const session = `eu26-tick-scaling-${process.pid}`;
const run = (...args) => execFileSync('agent-browser', ['--session', session, ...args], { encoding: 'utf8', timeout: 30000 });
const evaluate = source => JSON.parse(run('eval', '-b', Buffer.from(source).toString('base64')));
const scenario = source => evaluate(`(async()=>{
	const story=window.__vpkStory,explorer=window.__eu26Explorer;
	const dock=document.querySelector('#eu26-explorer-controls'),input=dock.querySelector('input[type="range"]');
	const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
	const rect=element=>element.getBoundingClientRect().toJSON();
	${source}
})()`);

test('Page, X Threads and Video scale neighboring ticks from their default lengths', { timeout: 60000 }, async t => {
	run('set', 'viewport', '1440', '1000');
	run('set', 'media', 'light');
	run('open', new URL('../eu26-animation-explained.html', import.meta.url).href);
	run('wait', '--fn', 'Boolean(window.__eu26Timeline && window.__eu26Explorer)');
	try {
		for (const mode of ['story', 'twitter', 'video']) { // Slides navigates with thumbnails, not ticks (slides-timeline.behavior.test.mjs)
			await t.test(`${mode} grows the selected tick and neighbors from their default lengths`, () => {
				run('mouse', 'move', '8', '40');
				const before = scenario(`
					story.setMode('${mode}');explorer.pause();explorer.clearPreview();explorer.seek(13);
					if('${mode}'==='video')input.scrollIntoView({block:'center',behavior:'instant'});
					await wait(800);
					const nodes=[...dock.querySelectorAll('.eu26-timeline-tick')],index=window.__eu26Timeline.getState().activeTick;
					window.__tickScaleProbe={nodes,index,neighbor:index+1,horizontal:input.getAttribute('aria-orientation')==='horizontal'};
					const tick=nodes[index],box=rect(tick),horizontal=window.__tickScaleProbe.horizontal;
					return {box,neighbor:rect(nodes[index+1]),far:rect(nodes[0]),input:rect(input),horizontal,
						base:parseFloat(getComputedStyle(tick)[horizontal?'height':'width']),neighborBase:parseFloat(getComputedStyle(nodes[index+1])[horizontal?'height':'width']),
						bottoms:nodes.map(node=>rect(node).bottom),x:(box.left+box.right)/2,y:(box.top+box.bottom)/2};
				`);
				const axis = before.horizontal ? 'height' : 'width';
				assert.ok(Math.abs(before.box[axis] - before.base) < .05, 'selected tick starts at the normal size');
				run('mouse', 'move', String(Math.round(before.x)), String(Math.round(before.y)));
				const after = scenario(`await wait(260);const p=window.__tickScaleProbe;return {box:rect(p.nodes[p.index]),neighbor:rect(p.nodes[p.neighbor]),far:rect(p.nodes[0]),input:rect(input),bottoms:p.nodes.map(node=>rect(node).bottom)};`);
				assert.ok(after.box[axis] > before.base + 4, 'hover grows the selected tick');
				assert.ok(after.neighbor[axis] > before.neighborBase + .5, 'a neighboring tick also grows');
				assert.ok(Math.abs(after.far[axis] - before.far[axis]) < .2, 'distant ticks retain their normal length');
				assert.deepEqual(after.input, before.input, 'decorative growth never moves the native hit target');
				if (!before.horizontal) {
					assert.ok(Math.abs(after.box.right - before.box.right) < .1, 'vertical ticks keep their right anchor');
				}
				run('mouse', 'move', '8', '40');
				const restored = scenario(`await wait(800);const p=window.__tickScaleProbe;return rect(p.nodes[p.index]);`);
				assert.ok(Math.abs(restored[axis] - before.base) < .05, 'leaving returns to the normal size');
			});
		}

		await t.test('reduced motion retains default lengths in every tick view', () => {
			run('set', 'media', 'light', 'reduced-motion');
			for (const mode of ['story', 'twitter', 'video']) { // Slides navigates with thumbnails, not ticks (slides-timeline.behavior.test.mjs)
				run('mouse', 'move', '8', '40');
				const target = scenario(`story.setMode('${mode}');explorer.clearPreview();explorer.seek(13);if('${mode}'==='video')input.scrollIntoView({block:'center',behavior:'instant'});await wait(80);const tick=dock.querySelector('.eu26-timeline-playhead'),r=rect(tick);return {x:(r.left+r.right)/2,y:(r.top+r.bottom)/2};`);
				run('mouse', 'move', String(Math.round(target.x)), String(Math.round(target.y)));
				assert.equal(scenario(`await wait(100);const horizontal=input.getAttribute('aria-orientation')==='horizontal';return [...dock.querySelectorAll('.eu26-timeline-tick')].every(tick=>Math.abs(rect(tick)[horizontal?'height':'width']-parseFloat(getComputedStyle(tick)[horizontal?'height':'width']))<.05);`), true);
			}
		});
	} finally {
		run('close');
	}
});
