import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { data } from './eu26-hero.hero.mjs';

const session = process.env.EU26_TIMELINE_SESSION || `eu26-vertical-timeline-test-${process.pid}`;
const artifact = fileURLToPath(new URL('../eu26-animation-explained.html', import.meta.url));
const run = (...args) => execFileSync('agent-browser', ['--session', session, ...args], { encoding: 'utf8', timeout: 45000 });
const evaluate = (source, execute = run) => JSON.parse(execute('eval', '-b', Buffer.from(source).toString('base64')));
const choice = index => `#eu26-explorer-controls [data-eu26-state-index="${index}"]`;
const scenario = (source, execute = run) => evaluate(`(async () => {
	const ui = window.__eu26Timeline, explorer = window.__eu26Explorer, story = window.__vpkStory;
	const dock = document.querySelector('#eu26-explorer-controls');
	const tray = dock.querySelector('.eu26-dock-tray'), list = dock.querySelector('.eu26-dock-filmstrip');
	const cards = [...list.querySelectorAll('[data-eu26-state-index]')];
	const slider = document.querySelector('#eu26-explorer-timeline');
	const frames = dock.querySelector('[data-eu26-action="frames"]');
	const context = dock.querySelector('.eu26-chapter-context');
	const chapterNames = ${JSON.stringify(data.states.map(state => state.title))};
	const hero = document.querySelector('[data-vpk-figure="eu26-hero"]');
	const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
	const rect = element => { const r = element.getBoundingClientRect(); return { left:r.left, top:r.top, right:r.right, bottom:r.bottom, width:r.width, height:r.height }; };
	const middleTick = () => [...dock.querySelectorAll('.eu26-timeline-tick')].reduce((closest,tick) => Math.abs(Number(tick.parentElement.dataset.timelinePosition)-.5)<Math.abs(Number(closest.parentElement.dataset.timelinePosition)-.5)?tick:closest);
	const until = async (condition, message) => {
		const deadline = performance.now() + 3000;
		while (performance.now() < deadline) { if (condition()) return; await wait(16); }
		throw new Error(message + ': ' + JSON.stringify({ ui:ui.getState(), explorer:explorer.getState() }));
	};
	const show = async index => {
		if (!ui.getState().expanded) { ui.setExpanded(true); await wait(220); }
		const item = rect(cards[index]), viewport = rect(list);
		list.scrollTop += item.top - viewport.top - (list.clientHeight - item.height) / 2;
		await wait(60);
	};
	const stackFailures = () => {
		const failures = [];
		for (const [index, card] of cards.entries()) {
			const box=rect(card), image=rect(card.querySelector('.eu26-state-thumb')), caption=rect(card.querySelector('.eu26-state-text'));
			const gap=Number.parseFloat(getComputedStyle(card).rowGap)||0;
			if(box.height+1<image.height+caption.height+gap) failures.push('card '+index+' does not contain its preview and caption');
			if(index && rect(cards[index-1]).bottom>box.top+1) failures.push('cards '+(index-1)+' and '+index+' overlap');
		}
		return failures;
	};
	const timeMarkup = () => dock.querySelectorAll('output,.eu26-timeline-tick-label,.eu26-timeline-callout,.eu26-dock-clock-current,.eu26-dock-clock-total,.eu26-explorer-time,.eu26-state-number').length;
	${source}
})()`, execute);

test('continuous scrubbing preserves every in-between frame with twelve Page and Slides ticks', { timeout:60000 }, () => {
	const command = (...args) => execFileSync('agent-browser', ['--session', `${session}-continuous`, ...args], { encoding:'utf8', timeout:45000 });
	const probe = source => scenario(source, command);
	command('set','viewport','1440','900'); command('set','media','light'); command('open',`file://${artifact}`);
	command('wait','--fn','Boolean(window.__eu26Timeline && window.__eu26Explorer && window.__vpkStory)');
	try {
		for (const mode of ['story','slides']) {
			const samples = probe(`
				story.setMode('${mode}'); explorer.pause(); ui.dismiss();
				const states=JSON.parse(document.querySelector('[data-eu26-explorer-model]').textContent).states;
				const samples=[];
				for(let index=0;index<states.length-1;index++) for(const fraction of [.125,.5,.875]) {
					const value=index+fraction, expected=states[index].time+(states[index+1].time-states[index].time)*fraction;
					slider.value=String(value);slider.dispatchEvent(new Event('input',{bubbles:true}));
					const state=explorer.getState(),text=document.querySelector('[data-story-step][aria-current="step"]');
					samples.push({value:Number(slider.value),expectedValue:value,expected,time:state.time,render:state.renderTime,hero:Number(hero.dataset.heroTime),text:Number(text.dataset.storyIndex),index});
				}
				return {count:dock.querySelectorAll('.eu26-timeline-tick').length,samples};
			`);
			assert.equal(samples.count,12,`${mode} retains only its chapter marks`);
			for (const sample of samples.samples) {
				assert.ok(Math.abs(sample.value-sample.expectedValue)<1e-9,`${mode} keeps fractional scrub position ${sample.expectedValue}`);
				assert.ok(Math.abs(sample.time-sample.expected)<1e-9,`${mode} interpolates authored time at ${sample.expectedValue}`);
				assert.equal(sample.render,sample.time);
				assert.ok(Math.abs(sample.hero-sample.time)<.001);
				assert.equal(sample.text,sample.index,'the active text follows the animation segment');
			}
			const geometry = probe(`
				const poses=[];
				for(const position of [7.125,7.25,7.5,7.25]) {
					slider.value=String(position);slider.dispatchEvent(new Event('input',{bubbles:true}));
					poses.push(hero.querySelector('svg').innerHTML);
				}
				return {moving:poses[0]!==poses[1]&&poses[1]!==poses[2],reversible:poses[1]===poses[3]};
			`);
			assert.deepEqual(geometry,{moving:true,reversible:true},`${mode} renders distinct, reversible intermediate illustrations`);
			const bounds=probe(`await wait(80);return rect(slider);`), horizontal=mode==='slides';
			const pointer=fraction=>[String(Math.round(bounds.left+bounds.width*(horizontal?fraction:.5))),String(Math.round(bounds.top+bounds.height*(horizontal?.5:fraction)))];
			command('mouse','move',...pointer(.325));command('mouse','down');
			const drag=[];
			try {
				for(const fraction of [.325,.3375,.35,.3625,.35]) {
					command('mouse','move',...pointer(fraction));
					drag.push(probe(`await wait(40);const state=explorer.getState();return {value:Number(slider.value),time:state.time,render:state.renderTime,text:story.getState().displayIndex,index:state.selectedIndex};`));
				}
			} finally { command('mouse','up'); }
			assert.ok(drag.filter(sample=>Math.abs(sample.value-Math.round(sample.value))>1e-6).length>=3,`${mode} pointer dragging retains fractional frames`);
			assert.ok(drag[0].time<drag[1].time&&drag[1].time<drag[2].time&&drag[2].time<drag[3].time&&drag[4].time<drag[3].time,`${mode} advances and reverses between adjacent tick positions`);
			assert.ok(drag.every(sample=>sample.render===sample.time&&sample.text===sample.index),`${mode} pointer scrubbing keeps rendering and text synchronized`);
		}
	} finally { command('close'); }
});

async function connectTouch() {
	const socket = new WebSocket(run('get', 'cdp-url').trim());
	await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once:true }); socket.addEventListener('error', reject, { once:true }); });
	let id = 0;
	const pending = new Map();
	socket.addEventListener('message', event => {
		const message = JSON.parse(String(event.data));
		if (!pending.has(message.id)) return;
		const { resolve, reject } = pending.get(message.id); pending.delete(message.id);
		if (message.error) reject(new Error(message.error.message)); else resolve(message.result);
	});
	const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
		const request = ++id; pending.set(request, { resolve, reject });
		socket.send(JSON.stringify({ id:request, method, params, ...(sessionId ? { sessionId } : {}) }));
	});
	const { targetInfos } = await send('Target.getTargets');
	const target = targetInfos.find(target => target.type === 'page' && target.url === `file://${artifact}`);
	assert.ok(target, 'the touch driver attaches to this test session');
	const { sessionId } = await send('Target.attachToTarget', { targetId:target.targetId, flatten:true });
	await send('Emulation.setTouchEmulationEnabled', { enabled:true, maxTouchPoints:1 }, sessionId);
	return {
		async point(type, x, y) {
			await send('Input.dispatchTouchEvent', { type, touchPoints:type === 'touchEnd' ? [] : [{ x, y, id:1 }] }, sessionId);
		},
		async close() { await send('Emulation.setTouchEmulationEnabled', { enabled:false }, sessionId); await send('Target.detachFromTarget', { sessionId }); socket.close(); },
	};
}

test('the vertical timeline reveals a reachable preview stack without taking over the page', { timeout:120000 }, async t => {
	run('set','viewport','1440','900'); run('set','media','light'); run('open',`file://${artifact}`);
	run('wait','--fn','Boolean(window.__eu26Timeline && window.__eu26Explorer && window.__vpkStory)');
	try {
		await t.test('the narrow fixed rail reserves reading space and starts with inert previews', () => {
			const result = scenario(`
				explorer.pause(); story.suspendFollowing();
				const contextClosed=!ui.getState().contextVisible && context.inert && context.tabIndex===-1;
				const before = rect(dock); window.scrollBy(0,600); await wait(80); const after = rect(dock);
				const closed = !ui.getState().expanded && tray.inert && tray.getAttribute('aria-hidden') === 'true' && cards.every(card=>card.tabIndex===-1);
				const secondary=[...dock.querySelectorAll('[data-eu26-action]')].filter(button=>['previous','next','replay'].includes(button.dataset.eu26Action));
				return { before,after,closed,contextClosed,secondary:secondary.length,position:getComputedStyle(dock).position,hero:rect(hero),viewport:innerWidth,orientation:slider.getAttribute('aria-orientation'),count:cards.length,hidden:getComputedStyle(tray).visibility };
			`);
			assert.equal(result.position,'fixed'); assert.ok(Math.abs(result.before.width-64)<1);
			assert.deepEqual(result.after,result.before); assert.equal(result.closed,true); assert.equal(result.hidden,'hidden');
			assert.equal(result.count,12); assert.equal(result.orientation,'vertical');
			assert.equal(result.contextClosed,true);
			assert.equal(result.secondary,0,'chapter transport is absent from the closed gallery');
			assert.ok(result.viewport-result.before.right>=8 && result.viewport-result.before.right<=24,'the rail stays at the right viewport edge');
			assert.ok(result.hero.right <= result.before.left-8,'the right rail does not cover the hero');
		});

		await t.test('the compact rail stays vertically centered through resizing and all four modes', () => {
			run('mouse','move','8','40');
			const failures=[];
			for(const [width,height] of [[1440,1000],[1440,1500],[1440,700],[390,844],[390,1200],[320,500]]) {
				run('set','viewport',String(width),String(height));
				failures.push(...scenario(`
					const failures=[];
					for(const mode of ['story','slides','twitter','video']) {
						story.setMode(mode);await wait(60);
						if(mode==='slides') {
							if(slider.getAttribute('aria-orientation')!=='horizontal'||dock.querySelectorAll('.eu26-timeline-tick').length!==chapterNames.length)failures.push('Slides does not keep one horizontal tick per slide');
							continue;
						}
						if(mode==='video') {
							const r=rect(dock);
							if(getComputedStyle(dock).position!=='relative'||!document.querySelector('[data-video-timeline]').contains(dock)||slider.getAttribute('aria-orientation')!=='horizontal'||r.width<innerWidth*.6)failures.push('Video does not use its inline horizontal ruler');
							continue;
						}
						const r=rect(dock),style=getComputedStyle(dock),top=parseFloat(style.top),bottom=parseFloat(style.bottom);
						const expected=(top+innerHeight-bottom)/2,center=(r.top+r.bottom)/2;
						const rows=[...dock.querySelectorAll('.eu26-timeline-mark')].map(row=>rect(row).top),gaps=rows.slice(1).map((row,index)=>row-rows[index]);
						if(Math.abs(center-expected)>1)failures.push(mode+' is not centered at '+innerWidth+'x'+innerHeight);
						if(r.top<top-1 || r.bottom>innerHeight-bottom+1)failures.push(mode+' exceeds its available height');
						if(Math.max(...gaps)>20.1 || Math.max(...gaps)-Math.min(...gaps)>.02)failures.push(mode+' tick gaps are not compact and equal at '+innerWidth+'x'+innerHeight+': '+gaps.join(','));
					}
					return failures;
				`));
			}
			run('set','viewport','1440','900');
			scenario(`story.setMode('story');await wait(80);return null;`);
			assert.deepEqual(failures,[]);
		});

		await t.test('Page has exactly one evenly spaced tick per page and each tick selects its matching content', () => {
			const result=scenario(`
				story.setMode('story');slider.focus({preventScroll:true});
				const config={count:dock.querySelectorAll('.eu26-timeline-tick').length,max:Number(slider.max),step:slider.step,navigation:ui.getState().navigation};
				const pages=[];
				for(let index=0;index<chapterNames.length;index++) {
					slider.value=String(index);slider.dispatchEvent(new Event('input',{bubbles:true}));await wait(40);
					const state=explorer.getState(),article=document.querySelector('[data-story-step][aria-current="step"]');
					pages.push({index:state.selectedIndex,time:state.time,tick:ui.getState().activeTick,text:Number(article.dataset.storyIndex),focused:document.activeElement===slider});
				}
				explorer.seek(12.345);const modes=[];
				for(const mode of ['slides','video','story','twitter','story']) {story.setMode(mode);await wait(40);modes.push({mode,count:dock.querySelectorAll('.eu26-timeline-tick').length,time:explorer.getState().time,step:slider.step});}
				document.querySelector('[data-vpk-story]').focus({preventScroll:true});
				return {config,pages,modes};
			`);
			assert.deepEqual(result.config,{count:data.states.length,max:data.states.length-1,step:'any',navigation:'pages'});
			for(const [index,page]of result.pages.entries())assert.deepEqual(page,{index,time:data.states[index].time,tick:index,text:index,focused:true});
			for(const mode of result.modes){const pages=['story','slides'].includes(mode.mode);assert.equal(mode.time,12.345);if(mode.mode==='video')assert.ok(mode.count>12);else assert.equal(mode.count,pages?12:21);assert.equal(mode.step,pages?'any':'0.01');}
		});

		await t.test('ordinary hover and focus reveal one context, while Frames explicitly opens the gallery', () => {
			scenario(`explorer.seek(17.1234); return null;`);
			run('hover','#eu26-explorer-controls .eu26-dock-bar');
			assert.equal(scenario(`await until(()=>ui.getState().contextVisible,'hover context');return !ui.getState().expanded && context.querySelectorAll('svg').length===1;`),true);
			run('click','#eu26-explorer-controls [data-eu26-action="frames"]');
			assert.equal(scenario(`await until(()=>ui.getState().expanded,'explicit gallery');return !ui.getState().contextVisible && !tray.inert;`),true);
			scenario(`await show(8); return null;`); run('hover',choice(8));
			const preview = scenario(`await until(()=>explorer.getState().previewIndex===8,'card hover'); return {time:explorer.getState().time,render:explorer.getState().renderTime,thumb:rect(cards[8].querySelector('.eu26-state-thumb'))};`);
			assert.equal(preview.time,17.1234); assert.equal(preview.render,19); assert.ok(preview.thumb.width>=180 && preview.thumb.height>=100);
			run('mouse','move','8','40');
			assert.equal(scenario(`await until(()=>explorer.getState().previewIndex===null,'hover restore'); return explorer.getState().renderTime;`),17.1234);
			scenario(`ui.setExpanded(true); ui.setExpanded(false); return null;`); run('focus','#eu26-explorer-timeline');
			assert.equal(scenario(`await until(()=>ui.getState().contextVisible,'focus context');return !ui.getState().expanded;`),true);
		});

		await t.test('hovering the grid immediately reveals the gallery and allows browsing', () => {
			scenario(`ui.dismiss(); return null;`);
			run('mouse','move','8','40');
			run('hover','#eu26-explorer-controls [data-eu26-action="frames"]');
			const result = scenario(`return {expanded:ui.getState().expanded,inert:tray.inert,hidden:tray.getAttribute('aria-hidden'),visibility:getComputedStyle(tray).visibility,opacity:getComputedStyle(tray).opacity};`);
			assert.deepEqual(result,{expanded:true,inert:false,hidden:'false',visibility:'visible',opacity:'1'});
			run('hover',choice(8));
			assert.equal(scenario(`return ui.getState().expanded;`),true,'the gallery stays open while browsing');
			run('mouse','move','8','40');
			assert.equal(scenario(`return ui.getState().expanded;`),false,'an unpinned gallery closes on leaving');
			run('click','#eu26-explorer-controls [data-eu26-action="frames"]');
			run('mouse','move','8','40');
			assert.equal(scenario(`return ui.getState().expanded;`),true,'click pins the gallery open');
		});

		await t.test('every preview button contains its image and caption without overlapping the next card', () => {
			assert.deepEqual(scenario(`ui.setExpanded(true);await wait(220);return stackFailures();`),[]);
		});

		await t.test('keyboard focus centers cards with matching chapter text and native activation commits', () => {
			scenario(`ui.setExpanded(true); explorer.seek(10); slider.focus({preventScroll:true}); return null;`);
			run('focus',choice(6));
			scenario(`await wait(80); return null;`);
			run('press','ArrowDown');
			const focus = scenario(`await wait(100); const a=rect(cards[7]),b=rect(list); const article=document.querySelector('[data-story-step][aria-current="step"]'),heading=rect(article.querySelector('h2')),stage=rect(document.querySelector('[data-story-stage]')); return {index:document.activeElement.dataset.eu26StateIndex,textIndex:Number(article.dataset.storyIndex),clearance:heading.top-stage.bottom,center:Math.abs((a.top+a.bottom-b.top-b.bottom)/2),tabstops:cards.filter(card=>card.tabIndex===0).length,preview:explorer.getState().previewIndex};`);
			assert.equal(focus.index,'7'); assert.equal(focus.textIndex,7); assert.ok(focus.clearance>=20 && focus.clearance<90); assert.ok(focus.center<=12,`focused card center differs by ${focus.center}px`); assert.equal(focus.tabstops,1); assert.equal(focus.preview,7);
			run('press','Enter');
			assert.equal(scenario(`await until(()=>!explorer.getState().transitioning && explorer.getState().time===16,'native commit'); return explorer.getState().selectedIndex;`),7);
			run('press','End');
			const end = scenario(`return {index:document.activeElement.dataset.eu26StateIndex,textIndex:Number(document.querySelector('[data-story-step][aria-current="step"]').dataset.storyIndex),committed:explorer.getState().selectedIndex,top:list.scrollTop};`);
			assert.equal(end.index,'11'); assert.equal(end.textIndex,11); assert.equal(end.committed,7); assert.ok(end.top>0);
		});

		await t.test('Escape moves focus before making the stack inert and latches it closed', () => {
			scenario(`window.__timelineFocusOrder=[]; frames.addEventListener('focus',()=>window.__timelineFocusOrder.push(tray.inert),{once:true}); return null;`);
			run('press','Escape');
			const result = scenario(`await wait(220); frames.focus({preventScroll:true}); return {state:ui.getState(),focus:document.activeElement===frames,inert:tray.inert,tabstops:cards.filter(card=>card.tabIndex===0).length,order:window.__timelineFocusOrder};`);
			assert.equal(result.state.expanded,false); assert.equal(result.state.dismissed,true); assert.equal(result.focus,true); assert.equal(result.inert,true); assert.equal(result.tabstops,0); assert.deepEqual(result.order,[false]);
			run('hover','#eu26-explorer-controls .eu26-dock-bar');
			assert.equal(scenario(`return ui.getState().expanded;`),false,'the dismissal stays latched while the pointer is inside');
			run('mouse','move','8','40'); run('hover','#eu26-explorer-controls .eu26-dock-bar');
			assert.equal(scenario(`await until(()=>ui.getState().contextVisible,'pointer re-entry context');return !ui.getState().expanded;`),true);
		});

		await t.test('Page range keys and direct selection navigate one page at a time', () => {
			scenario(`explorer.seek(17); slider.focus({preventScroll:true}); return null;`); run('press','ArrowUp');
			let state = scenario(`return {value:Number(slider.value),time:explorer.getState().time};`);
			assert.equal(state.value,6); assert.equal(state.time,13);
			run('press','ArrowDown'); assert.equal(scenario(`return explorer.getState().time;`),16);
			state = scenario(`slider.value='8'; slider.dispatchEvent(new Event('input',{bubbles:true})); return {value:Number(slider.value),time:explorer.getState().time,playing:explorer.getState().playing};`);
			assert.equal(state.value,8); assert.equal(state.time,19); assert.equal(state.playing,false);
			run('press','Home'); assert.equal(scenario(`return explorer.getState().time;`),0);
			run('press','End'); assert.equal(scenario(`return explorer.getState().time;`),34);
		});

		await t.test('seeking from the first frame to the end brings the final preview and caption into view', () => {
			scenario(`explorer.seek(0);ui.setExpanded(true);slider.focus({preventScroll:true});await wait(220);list.scrollTop=0;return null;`);
			run('press','End');
			const result = scenario(`
				await until(()=>explorer.getState().time===34 && explorer.getState().selectedIndex===11,'end seek');await wait(80);
				const caption=rect(cards[11].querySelector('.eu26-state-text')),viewport=rect(list);
				return {time:explorer.getState().time,render:explorer.getState().renderTime,hero:Number(hero.dataset.heroTime),value:Number(slider.value),index:ui.getState().selectedIndex,scroll:list.scrollTop,caption,viewport};
			`);
			assert.equal(result.time,34); assert.equal(result.render,34); assert.equal(result.hero,34); assert.equal(result.value,11); assert.equal(result.index,11); assert.ok(result.scroll>0);
			assert.ok(result.caption.top>=result.viewport.top && result.caption.bottom<=result.viewport.bottom,'the final selected caption is visible after a range seek');
		});

		await t.test('chapter navigation contains names without time counters and uses the accent scrollbar', () => {
			const result=scenario(`
				const names=cards.map(card=>({label:card.getAttribute('aria-label'),text:card.querySelector('.eu26-state-text').textContent.trim()}));
				const probe=document.createElement('span');probe.style.color='var(--ill-accent)';document.body.append(probe);const accent=getComputedStyle(probe).color;probe.remove();
				return {timeMarkup:timeMarkup(),names,valueText:slider.getAttribute('aria-valuetext'),selected:ui.getState().selectedIndex,scrollbar:getComputedStyle(document.documentElement).scrollbarColor,accent};
			`);
			assert.equal(result.timeMarkup,0,'clock and timestamp nodes are removed from navigation');
			for(const [index,name]of result.names.entries())assert.deepEqual(name,{label:data.states[index].title,text:data.states[index].title});
			assert.equal(result.valueText,data.states[result.selected].title);
			assert.ok(result.scrollbar.startsWith(result.accent),`root scrollbar is ${result.scrollbar}`);
		});

		await t.test('one-pixel ticks share a magnetic right anchor and the orange indicator occupies a real tick', () => {
			scenario(`ui.dismiss();explorer.seek(0);return null;`);run('mouse','move','8','40');
			const before=scenario(`await wait(700);const tick=middleTick(),all=[...dock.querySelectorAll('.eu26-timeline-tick')],centers=all.map(tick=>{const r=rect(tick);return (r.top+r.bottom)/2;});return {tick:rect(tick),marker:rect(dock.querySelector('.eu26-timeline-playhead')),input:rect(slider),normal:all.filter(tick=>!tick.classList.contains('eu26-timeline-playhead')).every(tick=>Math.abs(rect(tick).width-14)<.1),count:all.length,gaps:centers.slice(1).map((center,index)=>center-centers[index])};`);
			assert.equal(before.normal,true,'every resting tick has the normal full length');assert.equal(before.count,12,'Page renders one normal tick per page');
			assert.ok(Math.max(...before.gaps)-Math.min(...before.gaps)<.01,'all rendered ticks have exactly equal spacing');
			run('mouse','move',String(Math.round((before.tick.left+before.tick.right)/2)),String(Math.round((before.tick.top+before.tick.bottom)/2)));
			const after=scenario(`await wait(180);const head=dock.querySelector('.eu26-timeline-playhead'),all=[...dock.querySelectorAll('.eu26-timeline-tick')],centers=all.map(tick=>{const r=rect(tick);return (r.top+r.bottom)/2;});return {tick:rect(middleTick()),marker:rect(head),neighborGrowth:all.filter(tick=>tick!==head).some(tick=>rect(tick).width>14.5),integrated:head.matches('.eu26-timeline-tick')&&head.parentElement.matches('.eu26-timeline-mark'),heads:dock.querySelectorAll('.eu26-timeline-playhead').length,input:rect(slider),state:ui.getState(),gaps:centers.slice(1).map((center,index)=>center-centers[index])};`);
			assert.ok(Math.abs(before.tick.height-1)<.1 && Math.abs(after.tick.height-1)<.1 && Math.abs(after.marker.height-1)<.1);
			assert.equal(after.neighborGrowth,true,'neighboring ticks scale with pointer proximity');assert.ok(after.marker.width>before.marker.width+4,'the selected tick grows from its default size');
			assert.ok(Math.abs(after.tick.right-before.tick.right)<.1,'the common right edge stays fixed');
			assert.ok(Math.max(...after.gaps)-Math.min(...after.gaps)<.02 && after.gaps[0]>before.gaps[0],'hover expansion keeps every tick gap equal');
			assert.ok(Math.abs(after.marker.right-after.tick.right)<.1,'playhead and tick share the same right anchor');
			assert.equal(after.integrated,true);assert.equal(after.heads,1);assert.deepEqual(after.input,before.input,'the native hit target stays stationary');
			assert.equal(after.state.expanded,false);assert.equal(after.state.contextVisible,true);
		});

		await t.test('the wave engages before the input and settles completely after leaving', () => {
			const geometry=scenario(`ui.dismiss();const r=rect(slider);return {x:r.right-8,y:(r.top+r.bottom)/2,input:r};`);
			run('mouse','move',String(Math.round(geometry.x-40)),String(Math.round(geometry.y)));
			const near=scenario(`await wait(220);const all=[...dock.querySelectorAll('.eu26-timeline-tick')];return {state:ui.getState(),span:rect(all.at(-1)).top-rect(all[0]).top};`);
			run('mouse','move',String(Math.round(geometry.x-10)),String(Math.round(geometry.y)));
			const close=scenario(`await wait(220);const all=[...dock.querySelectorAll('.eu26-timeline-tick')];return {state:ui.getState(),span:rect(all.at(-1)).top-rect(all[0]).top,input:rect(slider)};`);
			assert.ok(near.state.magnet.amount>0 && near.state.magnet.amount<close.state.magnet.amount,'approaching the visual baseline progressively engages the wave');
			assert.ok(close.span>near.span);assert.deepEqual(close.input,geometry.input);
			run('mouse','move','8','40');
			const settled=scenario(`await wait(750);const before=window.vpkFrameLoop.stats().frames;await wait(120);return {state:ui.getState(),frames:window.vpkFrameLoop.stats().frames-before};`);
			assert.deepEqual(settled.state.magnet,{x:0,y:0,amount:0});assert.equal(settled.frames,0,'settled proximity motion schedules no idle frames');
		});

		await t.test('page scrolling keeps thumbnails hidden until the reader interacts with the rail', () => {
			run('mouse','move','8','40');
			scenario(`ui.hideContext();explorer.pause();story.setMode('story');document.querySelector('main[data-vpk-story]').focus({preventScroll:true});story.select(3);await until(()=>!explorer.getState().transitioning,'scroll chapter');dock.dispatchEvent(new PointerEvent('pointerleave',{pointerType:'mouse'}));await wait(1100);return null;`);
			assert.equal(scenario(`return ui.getState().contextVisible;`),false);
			run('press','PageDown');
			const scrolled=scenario(`await until(()=>ui.getState().selectedIndex>3,'scroll chapter advances');return {visible:ui.getState().contextVisible,inert:context.inert,gallery:ui.getState().expanded};`);
			assert.deepEqual(scrolled,{visible:false,inert:true,gallery:false},'reading scroll advances the chapter without revealing a thumbnail');
			run('hover','#eu26-explorer-controls .eu26-timeline-ruler');
			const after=scenario(`
				await until(()=>ui.getState().contextVisible,'rail hover context');
				return {state:ui.getState(),box:rect(context),title:context.querySelector('.eu26-context-title').textContent,images:context.querySelectorAll('svg').length};
			`);
			assert.equal(after.state.expanded,false);assert.equal(after.images,1);assert.equal(after.title,data.states[after.state.contextIndex].title);
			run('mouse','move','8','40');
			assert.equal(scenario(`await until(()=>!ui.getState().contextVisible,'rail leave hides context');return context.inert;`),true);
			const result=scenario(`
				const failures=[];
				for(const time of [0,34]){
					explorer.seek(time);ui.showContext();await wait(100);const r=rect(context),svg=context.querySelector('svg');
					if(r.top<11 || r.bottom>innerHeight-11 || r.left<0 || r.right>innerWidth)failures.push('context is not viewport-clamped');
					if(context.querySelectorAll('svg').length!==1)failures.push('more than one context image');
					const ids=[...document.querySelectorAll('[id]')].map(element=>element.id);
					if(new Set(ids).size!==ids.length)failures.push('context duplicates an existing SVG id');
					const own=new Set([...svg.querySelectorAll('[id]')].map(element=>element.id));if(svg.id)own.add(svg.id);
					for(const element of [svg,...svg.querySelectorAll('*')])for(const attr of element.attributes)for(const reference of attr.value.split('url(#').slice(1))if(!own.has(reference.split(')')[0]))failures.push('context references another SVG');
				}
				ui.hideContext();await wait(220);context.focus({preventScroll:true});
				return {failures,closed:context.inert && context.tabIndex===-1 && document.activeElement!==context};
			`);
			assert.deepEqual(result.failures,[]);assert.equal(result.closed,true);
		});

		await t.test('Escape restores range focus before the single context becomes inert', () => {
			scenario(`ui.showContext();await wait(100);context.focus({preventScroll:true});window.__contextFocusOrder=[];slider.addEventListener('focus',()=>window.__contextFocusOrder.push(context.inert),{once:true});return null;`);
			run('press','Escape');
			const result=scenario(`return {focused:document.activeElement===slider,inert:context.inert,hidden:!ui.getState().contextVisible,gallery:ui.getState().expanded,order:window.__contextFocusOrder};`);
			assert.deepEqual(result,{focused:true,inert:true,hidden:true,gallery:false,order:[false]});
		});

		for (const theme of ['light','dark']) for (const width of [390,320]) {
			run('set','viewport',String(width),'844'); run('set','media',theme); run('reload');
			run('wait','--fn','Boolean(window.__eu26Timeline && window.__vpkStory)');
			await t.test(`${theme} ${width}px keeps the rail clear of content and every preview reachable`, () => {
				const result = scenario(`
					explorer.pause(); story.suspendFollowing(); const failures=[]; const rail=rect(dock);
					const closed=!ui.getState().expanded && tray.inert;
					for(const action of ['previous','next','replay'])if(dock.querySelector('[data-eu26-action="'+action+'"]'))failures.push('unexpected '+action+' button');
					if(document.documentElement.scrollWidth>innerWidth+1)failures.push('page overflow');
					if(Math.abs(rail.width-48)>1 || rail.left<0 || rail.right>innerWidth || rail.bottom>innerHeight)failures.push('rail bounds');
					if(rect(hero).right>rail.left-8)failures.push('hero under right rail');
					ui.setExpanded(true); await wait(220);
					failures.push(...stackFailures());
					for(let index=0;index<cards.length;index++){
						await show(index); const card=rect(cards[index]),view=rect(list);
						if(card.left<0 || card.right>innerWidth || card.top<view.top-1 || card.bottom>view.bottom+1 || card.width<140)failures.push('unreachable preview '+index);
					}
					explorer.seek(34);await wait(80);if(timeMarkup())failures.push('navigation time counters');
					ui.dismiss(); await wait(220);
					for(const mode of ['story','twitter']){story.setMode(mode); for(const index of [7,9]){
						story.select(index); await until(()=>!explorer.getState().transitioning,'heading alignment'); await wait(40);
						const heading=document.querySelector('article[data-story-index="'+index+'"] h2'),stage=document.querySelector('[data-story-stage]');
						if(rect(heading).top<rect(stage).bottom+20 || rect(heading).right>rail.left-8)failures.push(mode+' heading '+index);
					}}
					return {failures,closed,theme:document.documentElement.dataset.theme||'light'};
				`);
				assert.equal(result.closed,true); assert.equal(result.theme,theme); assert.deepEqual(result.failures,[]);
			});
		}

		run('set','media','dark','reduced-motion'); run('reload'); run('wait','--fn','Boolean(window.__eu26Timeline)');
		await t.test('a paused reduced-motion timeline holds still without idle frame scheduling', () => {
			const result = scenario(`
				explorer.pause(); story.suspendFollowing(); ui.dismiss(); await wait(220);
				const before=explorer.getState().time, original=window.requestAnimationFrame; let calls=0;
				window.requestAnimationFrame=function(...args){calls++;return original.apply(this,args);};
				try{await wait(200);}finally{window.requestAnimationFrame=original;}
				return {reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,calls,same:explorer.getState().time===before,closed:!ui.getState().expanded};
			`);
			assert.deepEqual(result,{reduced:true,calls:0,same:true,closed:true});
		});

		run('set','media','light'); run('reload'); run('wait','--fn','Boolean(window.__eu26Timeline)');
		await t.test('native touch reveals the stack and swipes it without hovering or selecting a card', async () => {
			const touch = await connectTouch();
			try {
				const target = scenario(`explorer.pause();story.suspendFollowing();explorer.seek(10);ui.dismiss();const r=rect(frames);return {x:(r.left+r.right)/2,y:(r.top+r.bottom)/2};`);
				await touch.point('touchStart',target.x,target.y); await touch.point('touchEnd');
				const start = scenario(`await until(()=>ui.getState().expanded,'touch reveal');await wait(220);const c=rect(cards[explorer.getState().selectedIndex]);return {x:(c.left+c.right)/2,y:c.bottom-12,scroll:list.scrollTop,time:explorer.getState().time,index:explorer.getState().selectedIndex,preview:explorer.getState().previewIndex};`);
				assert.equal(start.preview,null);
				await touch.point('touchStart',start.x,start.y);
				for (const offset of [24,48,72,96,120]) { await touch.point('touchMove',start.x,start.y-offset); await new Promise(resolve=>setTimeout(resolve,20)); }
				await touch.point('touchEnd');
				const after = scenario(`await wait(120);return {scroll:list.scrollTop,time:explorer.getState().time,index:explorer.getState().selectedIndex,preview:explorer.getState().previewIndex};`);
				assert.ok(Math.abs(after.scroll-start.scroll)>30,'the native gesture scrolls the vertical stack');
				assert.equal(after.time,start.time); assert.equal(after.index,start.index); assert.equal(after.preview,null);
			} finally { await touch.close(); }
		});
	} finally { run('close'); }
});

test('Frames galleries follow their view orientation and keep horizontal navigation in sync', { timeout:90000 }, async t => {
	const command = (...args) => execFileSync('agent-browser', ['--session', `${session}-frames`, ...args], { encoding: 'utf8', timeout: 45000 });
	const probe = source => scenario(source, command);
	command('set','viewport','1440','900');command('set','media','light');command('open',`file://${artifact}`);
	command('wait','--fn','Boolean(window.__eu26Timeline && window.__eu26Explorer && window.__vpkStory)');
	try {
		await t.test('every gallery omits chapter transport while Video keeps its replay button', () => {
			const result = probe(`
				const samples=[];
				for(const mode of ['story','slides','twitter','video','story','video']) {
					story.setMode(mode);explorer.pause();explorer.seek(16);ui.setExpanded(true);await wait(80);
					const replay=dock.querySelector('[data-video-action="replay"]');
					samples.push({mode,transport:tray.querySelectorAll('[data-eu26-action="previous"],[data-eu26-action="replay"],[data-eu26-action="next"]').length,
						chapterButtons:dock.querySelectorAll('[data-eu26-action="previous"],[data-eu26-action="next"]').length,
						replay:!!replay&&dock.querySelector('.eu26-dock-transport').contains(replay)&&rect(replay).width>0&&!replay.closest('[inert]'),
						caption:!!tray.querySelector('.eu26-preview-caption'),label:cards[7].querySelector('.eu26-state-title').textContent});
					ui.dismiss();
				}
				return samples;
			`);
			for(const sample of result) assert.deepEqual(sample,{mode:sample.mode,transport:0,chapterButtons:0,replay:sample.mode==='video',caption:false,label:data.states[7].title});
		});
		for(const mode of ['slides','video']) {
			await t.test(`${mode} lays frames left to right and centers keyboard previews`,()=>{
				const layout=probe(`
					story.setMode('${mode}');explorer.pause();explorer.seek(16);ui.setExpanded(true);await wait(220);
					const bounds=rect(tray),strip=rect(list),first=rect(cards[0]),second=rect(cards[1]);
					return {direction:getComputedStyle(list).flexDirection,overflow:list.scrollWidth>list.clientWidth,vertical:list.scrollHeight>list.clientHeight+1,
						ordered:second.left>first.right&&Math.abs(first.top-second.top)<1,visible:bounds.left>=8&&bounds.right<=innerWidth-8,
						width:bounds.width,thumb:rect(cards[7].querySelector('.eu26-state-thumb')).width,selected:rect(cards[7]),strip};
				`);
				assert.equal(layout.direction,'row');assert.equal(layout.overflow,true);assert.equal(layout.vertical,false);
				assert.equal(layout.ordered,true);assert.equal(layout.visible,true);assert.ok(layout.width>=700);assert.ok(layout.thumb>=180);
				assert.ok(Math.abs((layout.selected.left+layout.selected.right-layout.strip.left-layout.strip.right)/2)<2,'opening centers the selected frame');
				command('focus',choice(7));command('press','ArrowRight');
				const focused=probe(`await wait(80);const item=rect(cards[8]),viewport=rect(list);return {index:document.activeElement.dataset.eu26StateIndex,
					preview:explorer.getState().previewIndex,center:Math.abs((item.left+item.right-viewport.left-viewport.right)/2),scroll:list.scrollLeft,top:list.scrollTop};`);
				assert.equal(focused.index,'8');assert.equal(focused.preview,8);assert.ok(focused.center<2);assert.ok(focused.scroll>0);assert.equal(focused.top,0);
				command('press','Enter');
				assert.equal(probe(`await until(()=>!explorer.getState().transitioning&&explorer.getState().selectedIndex===8,'horizontal frame selection');return Number(hero.dataset.heroTime);`),19);
				command('press','Home');assert.equal(probe('return document.activeElement.dataset.eu26StateIndex;'),'0');
				command('press','End');assert.equal(probe('return document.activeElement.dataset.eu26StateIndex;'),'11');
				command('press','Escape');assert.equal(probe('return tray.inert&&document.activeElement===frames;'),true);
			});
		}
		await t.test('horizontal galleries stay inside narrow and short viewports in both themes',()=>{
			for(const [width,height] of [[390,844],[320,500]]) {
				command('set','viewport',String(width),String(height));
				for(const theme of ['light','dark']) {
					command('set','media',theme);
					const failures=probe(`
						const failures=[];
						for(const mode of ['slides','video']) {
							story.setMode(mode);explorer.pause();ui.setExpanded(true);await wait(220);
							const r=rect(tray),header=rect(document.querySelector('.story-bar'));
							if(r.left<8||r.right>innerWidth-8||r.top<header.bottom+8||r.bottom>innerHeight-8)failures.push(mode+' gallery escapes viewport');
							if(getComputedStyle(list).flexDirection!=='row'||list.scrollHeight>list.clientHeight+1)failures.push(mode+' gallery is not a single horizontal row');
							if(document.documentElement.scrollWidth>innerWidth+1)failures.push(mode+' page overflows: '+JSON.stringify({width:document.documentElement.scrollWidth,bad:[...document.querySelectorAll('body *')].filter(e=>rect(e).right>innerWidth+1&&!e.closest('svg')&&!e.closest('.eu26-dock-filmstrip')).slice(0,6).map(e=>({name:e.className,rect:rect(e)}))}));
							if(tray.querySelector('[data-eu26-action]'))failures.push(mode+' gallery contains transport controls');
							ui.dismiss();
						}
						return failures;
					`);
					assert.deepEqual(failures,[],`${width}x${height} ${theme}`);
				}
			}
		});
		await t.test('Page and X Threads retain vertical frame galleries after switching back',()=>{
			command('set','viewport','1440','900');
			assert.deepEqual(probe(`
				const failures=[];
				for(const mode of ['story','twitter']) {story.setMode(mode);ui.setExpanded(true);await wait(220);const a=rect(cards[0]),b=rect(cards[1]);
					if(getComputedStyle(list).flexDirection!=='column'||b.top<=a.bottom||Math.abs(a.left-b.left)>1||list.scrollLeft!==0)failures.push(mode);ui.dismiss();}
				return failures;
			`),[]);
		});
	} finally {command('close');}
});

test('the yellow scrubhead follows the visible frame during preview, scrubbing and page scrolling', { timeout:60000 }, async t => {
	const command = (...args) => execFileSync('agent-browser', ['--session', `${session}-head`, ...args], { encoding: 'utf8', timeout: 45000 });
	const probe = source => scenario(source, command);
	command('set','viewport','1440','900'); command('set','media','light'); command('open',`file://${artifact}`);
	command('wait','--fn','Boolean(window.__eu26Timeline && window.__eu26Explorer && window.__vpkStory)');
	const position = () => probe(`
		await wait(40);
		const state=explorer.getState(),rail=rect(dock.querySelector('.eu26-timeline-ruler')),head=rect(dock.querySelector('.eu26-timeline-playhead'));
		const marker=dock.querySelector('.eu26-timeline-playhead');
		const marks=[...dock.querySelectorAll('.eu26-timeline-mark')].map(mark=>Number(mark.dataset.timelinePosition));
		const chapterTimes=${JSON.stringify(data.states.map(state => state.time))};
		const lower=Math.max(0,chapterTimes.findLastIndex(time=>time<=state.renderTime));
		const page=lower===chapterTimes.length-1?lower:lower+(state.renderTime-chapterTimes[lower])/(chapterTimes[lower+1]-chapterTimes[lower]);
		const visibleFraction=ui.getState().navigation==='pages'?page/(chapterNames.length-1):Math.min(1,state.renderTime/state.duration);
		const expected=marks.reduce((closest,mark)=>Math.abs(mark-visibleFraction)<Math.abs(closest-visibleFraction)?mark:closest);
		const offset=parseFloat(marker.parentElement.style.translate.split(' ')[1])||0;
		return {time:state.time,render:state.renderTime,preview:state.previewIndex,fraction:((head.top+head.bottom)/2-rail.top)/rail.height,mark:Number(marker.parentElement.dataset.timelinePosition),row:(parseFloat(marker.parentElement.style.top)+offset)/rail.height,rowOffset:Math.abs(offset/rail.height),expected,maxGap:Math.max(...marks.slice(1).map((mark,index)=>mark-marks[index])),edgeInset:Math.abs(parseFloat(dock.querySelector('.eu26-timeline-mark').style.top)/rail.height),magnetY:ui.getState().magnet.y,height:rail.height,duration:state.duration,value:Number(slider.value)};
	`);
	const aligned = sample => {
		assert.equal(sample.mark,sample.expected,'the highlighted normal tick is nearest to the visible frame');
		assert.ok(Math.abs(sample.fraction-sample.magnetY/sample.height-sample.row)<.001,'the highlight occupies its existing ruler row');
	};
	try {
		await t.test('hover previews move the head without committing and restore it on pointer leave', () => {
			const target=probe(`explorer.pause();story.suspendFollowing();explorer.seek(17);const rail=rect(dock.querySelector('.eu26-timeline-ruler'));return {x:rail.right-10,y:rail.top+rail.height*10/11};`);
			command('mouse','move',String(Math.round(target.x)),String(Math.round(target.y)));
			probe(`await until(()=>explorer.getState().previewIndex!==null,'rail preview');return null;`);
			const preview=position(); aligned(preview); assert.equal(preview.time,17); assert.ok(Math.abs(preview.render-25)<.2); assert.ok(Math.abs(preview.value-(7+1/3))<1e-12);
			command('mouse','move','8','40');
			probe(`await until(()=>explorer.getState().previewIndex===null,'preview restore');return null;`);
			const restored=position(); aligned(restored); assert.equal(restored.time,17); assert.equal(restored.render,17);
		});

		await t.test('a pointer drag updates the head at each position in both directions', () => {
			const rail=probe(`ui.dismiss();explorer.seek(0);return rect(dock.querySelector('.eu26-timeline-ruler'));`);
			const x=String(Math.round(rail.right-10));
			command('mouse','move',x,String(Math.round(rail.top+rail.height*.2))); command('mouse','down');
			try {
				for(const fraction of [.2,.8,.4]) {
					command('mouse','move',x,String(Math.round(rail.top+rail.height*fraction)));
					const sample=position(); aligned(sample);
					assert.ok(Math.abs(sample.fraction-fraction)<=sample.maxGap/2+sample.edgeInset+sample.rowOffset+Math.abs(sample.magnetY/sample.height)+.003,'the nearest normal tick tracks the pointer');
				}
			} finally { command('mouse','up'); }
		});

		await t.test('scrolling forward and backward updates the head with the page-driven frame', () => {
			command('mouse','move','8','40');
			probe(`slider.blur();story.setMode('story');story.select(2);await until(()=>!explorer.getState().transitioning,'chapter select');story.follow();return null;`);
			const before=position();
			command('press','PageDown');
			probe(`await until(()=>explorer.getState().time>4,'forward page scroll');await wait(150);return null;`);
			const forward=position(); aligned(forward); assert.ok(forward.fraction>before.fraction);
			command('press','PageUp');
			probe(`await until(()=>explorer.getState().time<${forward.time},'backward page scroll');await wait(150);return null;`);
			const backward=position(); aligned(backward); assert.ok(backward.fraction<forward.fraction);
		});

		await t.test('chapter jumps keep the head aligned through the animated transition', () => {
			probe(`story.setMode('twitter');explorer.seek(4);explorer.select(10);return null;`);
			const moving=position(); aligned(moving); assert.equal(moving.time,25); assert.ok(moving.render<25);
			probe(`await until(()=>!explorer.getState().transitioning,'chapter transition');return null;`);
			const settled=position(); aligned(settled); assert.equal(settled.render,25);
		});

		await t.test('keyboard scrubbing and reduced motion keep the head aligned', () => {
			command('set','media','light','reduced-motion'); command('reload'); command('wait','--fn','Boolean(window.__eu26Timeline && window.__eu26Explorer)');
			probe(`explorer.pause();story.suspendFollowing();explorer.seek(17);slider.focus({preventScroll:true});return null;`);
			for(const key of ['ArrowDown','End','Home']) { command('press',key); aligned(position()); }
		});
	} finally { command('close'); }
});
