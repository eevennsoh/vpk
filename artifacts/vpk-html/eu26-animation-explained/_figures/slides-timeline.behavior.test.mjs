import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

const session = `eu26-slides-bottom-test-${process.pid}`;
const run = (...args) => execFileSync('agent-browser', ['--session', session, ...args], { encoding: 'utf8', timeout: 30000 });
const probe = source => JSON.parse(run('eval', '-b', Buffer.from(`(async () => {
	const story=window.__vpkStory,explorer=window.__eu26Explorer,ui=window.__eu26Timeline;
	const root=document.querySelector('[data-vpk-story]'),dock=document.querySelector('#eu26-explorer-controls'),input=dock.querySelector('input');
	const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
	const settle=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
	const rect=el=>el.getBoundingClientRect().toJSON();
	const active=()=>Number(root.querySelector('[data-story-step][aria-current="step"]').dataset.storyIndex);
	${source}
})()`).toString('base64')));

test('Slides uses the chapter timeline horizontally at the bottom', { timeout: 90000 }, async t => {
	run('set','viewport','1440','1000');
	run('set','media','light');
	run('open',new URL('../eu26-animation-explained.html',import.meta.url).href);
	run('wait','--fn','Boolean(window.__vpkStory && window.__eu26Timeline)');
	try {
		await t.test('the bottom rail has twelve equal slide ticks and chapter-only labels', () => {
			const result=probe(`
				explorer.pause();root.querySelector('button[data-story-mode="slides"]').click();await settle();
				const ticks=[...dock.querySelectorAll('.eu26-timeline-tick')],centers=ticks.map(tick=>{const r=rect(tick);return(r.left+r.right)/2;});
				return {state:ui.getState(),count:ticks.length,range:[input.min,input.max,input.step,input.getAttribute('aria-orientation')],
					position:getComputedStyle(dock).position,dock:rect(dock),width:innerWidth,height:innerHeight,
					gaps:centers.slice(1).map((center,index)=>center-centers[index]),timers:dock.querySelectorAll('output,.eu26-timeline-timestamp').length};
			`);
			assert.equal(result.state.orientation,'horizontal');assert.equal(result.state.navigation,'pages');
			assert.equal(result.count,12);assert.deepEqual(result.range,['0','11','any','horizontal']);assert.equal(result.timers,0);
			assert.equal(result.position,'fixed');assert.ok(result.height-result.dock.bottom>=15 && result.height-result.dock.bottom<=25);
			assert.ok(Math.abs((result.dock.left+result.dock.right)/2-result.width/2)<1);
			assert.ok(Math.max(...result.gaps)-Math.min(...result.gaps)<.02);
		});
		await t.test('native slide scrubbing and arrow keys synchronize the visible text and model', () => {
			const result=probe(`input.value='9';input.dispatchEvent(new Event('input',{bubbles:true}));await settle();input.focus({preventScroll:true});return {index:explorer.getState().selectedIndex,time:explorer.getState().time,text:active(),tick:ui.getState().activeTick};`);
			assert.deepEqual(result,{index:9,time:22,text:9,tick:9});
			run('press','ArrowRight');
			assert.deepEqual(probe(`await settle();return {index:explorer.getState().selectedIndex,time:explorer.getState().time,text:active(),focused:document.activeElement===input};`),{index:10,time:25,text:10,focused:true});
			run('press','ArrowLeft');
			assert.equal(probe(`await settle();return explorer.getState().selectedIndex;`),9);
		});
		await t.test('hovering a slide previews its matching text and restores the selected slide on leave', () => {
			const target=probe(`input.blur();const r=rect(dock.querySelector('[data-timeline-tick="3"]'));return {x:(r.left+r.right)/2,y:(r.top+r.bottom)/2};`);
			run('mouse','move',String(Math.round(target.x)),String(Math.round(target.y)));
			run('wait','--fn','window.__eu26Explorer.getState().previewIndex===3');
			assert.deepEqual(probe(`return {preview:explorer.getState().previewIndex,text:active(),tick:ui.getState().activeTick,selected:explorer.getState().selectedIndex};`),{preview:3,text:3,tick:3,selected:9});
			run('mouse','move','8','40');
			run('wait','--fn','window.__eu26Explorer.getState().previewIndex===null');
			assert.deepEqual(probe(`return {text:active(),selected:explorer.getState().selectedIndex,time:explorer.getState().time};`),{text:9,selected:9,time:22});
		});
		await t.test('switching through Video and Page retains the selected frame and restores the Slides rail', () => {
			const result=probe(`
				explorer.setVariant('outline');const held=explorer.getState().time,states=[];
				for(const mode of ['video','slides','story','slides']) {
					story.setMode(mode);await settle();
					states.push({mode,orientation:ui.getState().orientation,kind:ui.getState().navigation,time:explorer.getState().time,variant:explorer.getState().variant,
						count:dock.querySelectorAll('.eu26-timeline-tick').length,inVideo:Boolean(dock.closest('[data-story-video]'))});
				}
				return {held,states,heroes:root.querySelectorAll('[data-vpk-figure="eu26-hero"]').length};
			`);
			assert.equal(result.heroes,1);
			for(const state of result.states) {assert.equal(state.time,result.held);assert.equal(state.variant,'outline');}
			assert.equal(result.states[0].inVideo,true);assert.equal(result.states[0].kind,'time');
			assert.equal(result.states[2].orientation,'vertical');
			for(const state of [result.states[1],result.states[3]]) {assert.equal(state.orientation,'horizontal');assert.equal(state.count,12);assert.equal(state.inVideo,false);}
		});
		for(const width of [390,320]) {
			run('set','viewport',String(width),'844');
			await t.test(`${width}px keeps the rail and Frames gallery within the viewport`, () => {
				const result=probe(`
					await settle();const bar=rect(dock),range=rect(input);
					dock.querySelector('[data-eu26-action="frames"]').click();await wait(200);
					const tray=rect(dock.querySelector('.eu26-dock-tray'));ui.dismiss();
					return {bar,range,tray,width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth};
				`);
				assert.equal(result.overflow,false);assert.ok(result.bar.left>=0 && result.bar.right<=result.width);
				assert.ok(result.bar.bottom<=result.height-12 && result.range.height>=44);
				assert.ok(result.tray.left>=0 && result.tray.right<=result.width && result.tray.top>=0 && result.tray.bottom<=result.bar.top);
			});
		}
	} finally { run('close'); }
});
