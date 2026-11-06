import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

const session = `eu26-slides-bottom-test-${process.pid}`;
const run = (...args) => execFileSync('agent-browser', ['--session', session, ...args], { encoding: 'utf8', timeout: 30000 });
const probe = source => JSON.parse(run('eval', '-b', Buffer.from(`(async () => {
	const story=window.__vpkStory,explorer=window.__eu26Explorer,ui=window.__eu26Timeline;
	const root=document.querySelector('[data-vpk-story]'),dock=document.querySelector('#eu26-explorer-controls');
	const carousel=dock.querySelector('.eu26-slide-carousel'),slides=[...carousel.querySelectorAll('[data-eu26-slide-index]')];
	const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
	const settle=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
	const rect=el=>el.getBoundingClientRect().toJSON();
	const active=()=>Number(root.querySelector('[data-story-step][aria-current="step"]').dataset.storyIndex);
	const current=()=>slides.findIndex(slide=>slide.getAttribute('aria-current')==='step');
	${source}
})()`).toString('base64')));

test('Slides navigates with a left-to-right thumbnail carousel at the bottom', { timeout: 90000 }, async t => {
	run('set','viewport','1440','1000');
	run('set','media','light');
	run('open',new URL('../eu26-animation-explained.html',import.meta.url).href);
	run('wait','--fn','Boolean(window.__vpkStory && window.__eu26Timeline)');
	try {
		await t.test('twelve thumbnails replace the tick ruler, centred under the figure page', () => {
			const result=probe(`
				explorer.pause();root.querySelector('button[data-story-mode="slides"]').click();await settle();await wait(120);
				const boxes=slides.map(rect),stage=rect(document.querySelector('[data-story-stage]')),card=rect(document.querySelector('.story-figure'));
				return {state:ui.getState(),count:slides.length,carouselShown:getComputedStyle(carousel).display==='flex',
					rulerShown:getComputedStyle(dock.querySelector('.eu26-dock-bar')).display!=='none',
					position:getComputedStyle(dock).position,dock:rect(dock),stage,card,width:innerWidth,height:innerHeight,
					order:boxes.every((box,index)=>!index||box.left>boxes[index-1].right-1),sameRow:boxes.every(box=>Math.abs(box.top-boxes[0].top)<1),
					images:slides.every(slide=>slide.querySelector('.eu26-state-thumb svg')),labels:slides.map(slide=>slide.getAttribute('aria-label')),
					current:current(),scroll:document.documentElement.scrollHeight-innerHeight};
			`);
			assert.equal(result.state.orientation,'horizontal');assert.equal(result.state.navigation,'pages');
			assert.equal(result.count,12);assert.equal(result.carouselShown,true);assert.equal(result.rulerShown,false,'the tick ruler and Frames button hide in Slides');
			assert.equal(result.order,true,'thumbnails run left to right');assert.equal(result.sameRow,true,'thumbnails share one row');
			assert.equal(result.images,true,'every thumbnail shows its chapter drawing');
			assert.equal(result.labels[0],'1. The keynote board');assert.equal(result.current,0);
			assert.equal(result.position,'fixed');assert.ok(result.height-result.dock.bottom>=15 && result.height-result.dock.bottom<=25);
			assert.ok(Math.abs((result.dock.left+result.dock.right)/2-(result.stage.left+result.stage.right)/2)<1.5,'the carousel centres under the figure page');
			assert.ok(result.dock.top>=result.card.bottom+8,'the figure card ends above the carousel');
			assert.equal(result.scroll,0,'Slides fits one viewport');
		});
		await t.test('clicking a thumbnail and the arrow keys synchronize the slide, text and model', () => {
			const clicked=probe(`slides[9].click();await settle();await wait(60);return {index:explorer.getState().selectedIndex,time:explorer.getState().time,text:active(),current:current()};`);
			assert.deepEqual(clicked,{index:9,time:22,text:9,current:9});
			run('focus','.eu26-slide-carousel [data-eu26-slide-index="9"]');
			run('press','ArrowRight');
			assert.deepEqual(probe(`await settle();return {index:explorer.getState().selectedIndex,time:explorer.getState().time,text:active(),current:current(),focused:document.activeElement===slides[10]};`),{index:10,time:25,text:10,current:10,focused:true});
			run('press','ArrowLeft');
			assert.equal(probe(`await settle();return explorer.getState().selectedIndex;`),9);
			const page=probe(`document.activeElement.blur();document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));await settle();return explorer.getState().selectedIndex;`);
			assert.equal(page,10,'the right arrow steps the deck from the page too');
			const back=probe(`document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));await settle();const s=rect(slides[9]),c=rect(carousel);return {index:explorer.getState().selectedIndex,visible:s.left>=c.left-1&&s.right<=c.right+1};`);
			assert.deepEqual(back,{index:9,visible:true},'the left arrow steps back and the current thumbnail stays in view');
		});
		await t.test('hovering a thumbnail previews its matching text and restores the selected slide on leave', () => {
			// Thumbnails scrolled out of the strip cannot be hovered, so preview the visible neighbour of the selected slide.
			const target=probe(`const r=rect(slides[7]),c=rect(carousel);if(r.left<c.left||r.right>c.right)throw new Error('slide 7 is outside the visible strip');return {x:(r.left+r.right)/2,y:(r.top+r.bottom)/2};`);
			run('mouse','move',String(Math.round(target.x)),String(Math.round(target.y)));
			run('mouse','move',String(Math.round(target.x)+2),String(Math.round(target.y)+1));
			run('wait','--fn','window.__eu26Explorer.getState().previewIndex===7');
			assert.deepEqual(probe(`return {preview:explorer.getState().previewIndex,text:active(),selected:explorer.getState().selectedIndex,current:current()};`),{preview:7,text:7,selected:9,current:9});
			run('mouse','move','8','40');
			run('wait','--fn','window.__eu26Explorer.getState().previewIndex===null');
			assert.deepEqual(probe(`return {text:active(),selected:explorer.getState().selectedIndex,time:explorer.getState().time};`),{text:9,selected:9,time:22});
		});
		await t.test('switching through Video and Page retains the selected frame and restores the carousel', () => {
			const result=probe(`
				const held=explorer.getState().time,states=[];
				for(const mode of ['video','slides','story','slides']) {
					story.setMode(mode);await settle();
					states.push({mode,orientation:ui.getState().orientation,kind:ui.getState().navigation,time:explorer.getState().time,variant:explorer.getState().variant,
						carousel:getComputedStyle(carousel).display==='flex',current:current(),inVideo:Boolean(dock.closest('[data-story-video]'))});
				}
				return {held,states,heroes:root.querySelectorAll('[data-vpk-figure="eu26-hero"]').length};
			`);
			assert.equal(result.heroes,1);
			for(const state of result.states) {assert.equal(state.time,result.held);assert.equal(state.variant,'paper');}
			assert.equal(result.states[0].inVideo,true);assert.equal(result.states[0].kind,'time');assert.equal(result.states[0].carousel,false);
			assert.equal(result.states[2].orientation,'vertical');assert.equal(result.states[2].carousel,false);
			for(const state of [result.states[1],result.states[3]]) {assert.equal(state.orientation,'horizontal');assert.equal(state.carousel,true);assert.equal(state.current,9);assert.equal(state.inVideo,false);}
		});
		for(const width of [390,320]) {
			run('set','viewport',String(width),'844');
			await t.test(`${width}px keeps the carousel within the viewport and clear of the text`, () => {
				const result=probe(`
					await settle();await wait(120);const bar=rect(dock),first=rect(slides[0]);
					window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'});await settle();
					const steps=[...root.querySelectorAll('[data-story-step]:not([hidden])')],last=steps.length?rect(steps.at(-1)):null;
					return {bar,first,last,width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth,scrollsInside:carousel.scrollWidth>carousel.clientWidth};
				`);
				assert.equal(result.overflow,false);assert.ok(result.bar.left>=0 && result.bar.right<=result.width);
				assert.ok(result.bar.bottom<=result.height-12 && result.first.height>=44,'thumbnails are at least 44px tall targets');
				assert.equal(result.scrollsInside,true,'extra thumbnails scroll sideways inside the carousel');
				assert.ok(!result.last || result.last.bottom<=result.bar.top+1,'the end of the slide text clears the carousel');
			});
		}
	} finally { run('close'); }
});
