import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

const session = `eu26-continuous-${process.pid}`;
const run = (...args) => execFileSync('agent-browser', ['--session',session,...args], { encoding:'utf8',timeout:30000 });
const evaluate = source => JSON.parse(run('eval','-b',Buffer.from(source).toString('base64')));
const scenario = source => evaluate(`(async()=>{
	const explorer=window.__eu26Explorer,story=window.__vpkStory,dock=document.querySelector('#eu26-explorer-controls');
	const input=dock.querySelector('input[type="range"]'),hero=document.querySelector('[data-vpk-figure="eu26-hero"]');
	const states=JSON.parse(document.querySelector('[data-eu26-explorer-model]').textContent).states;
	const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
	const stateAt=time=>Math.max(0,states.findLastIndex(state=>state.time<=time+.00001));
	const pageTime=position=>{const index=Math.floor(position),next=Math.min(index+1,states.length-1);return states[index].time+(states[next].time-states[index].time)*(position-index);};
	const expectedScroll=time=>{const steps=[...document.querySelectorAll('[data-story-step]')];return scrollY+steps[stateAt(time)].querySelector('h2').getBoundingClientRect().top-story.getState().readingLine;};
	const geometry=()=>{let hash=2166136261;for(const path of hero.querySelectorAll('path,polygon'))for(const c of path.getAttribute('d')||path.getAttribute('points')||'')hash=Math.imul(hash^c.charCodeAt(0),16777619);return hash;};
	${source}
})()`);

test('pointer scrubbing renders intermediate poses and tick spacing matches across orientations', { timeout:90000 }, async t => {
	run('set','viewport','1440','1000');run('set','media','light');run('open',new URL('../eu26-animation-explained.html',import.meta.url).href);
	run('wait','--fn','Boolean(window.__eu26Timeline && window.__eu26Explorer)');
	try {
		for(const mode of ['story','twitter','video']) await t.test(`${mode} hover and drag move continuously inside a single chapter`,()=>{
			run('mouse','move','8','40');
			const setup=scenario(`story.setMode('${mode}');explorer.pause();explorer.clearPreview();explorer.seek(6.5);if('${mode}'==='video')input.scrollIntoView({block:'center',behavior:'instant'});await wait(120);const r=input.getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height,scroll:scrollY,horizontal:input.getAttribute('aria-orientation')==='horizontal',pages:window.__eu26Timeline.getState().navigation==='pages'};`);
			const point=position=>{
				const fraction=setup.pages?position/11:(8+(position-4)*2)/34;
				return {x:Math.round(setup.horizontal?setup.left+setup.width*fraction:setup.left+setup.width-10),y:Math.round(setup.horizontal?setup.top+setup.height/2:setup.top+setup.height*fraction)};
			};
			const hover=[];
			for(const position of [4.15,4.3,4.45,4.3]) {
				const p=point(position);run('mouse','move',String(p.x),String(p.y));
				hover.push(scenario(`await wait(65);const s=explorer.getState();return {time:s.time,render:s.renderTime,index:s.previewIndex,text:story.getState().displayIndex,geometry:geometry(),scroll:scrollY,expectedScroll:expectedScroll(s.renderTime)};`));
			}
			assert.equal(new Set(hover.map(frame=>frame.geometry)).size,3,'visible SVG geometry changes between chapter ticks');
			for(const frame of hover){assert.equal(frame.time,6.5,'hover preserves committed progress');assert.ok(frame.render>8&&frame.render<10,'hover renders an in-between pose');assert.equal(frame.index,4);assert.equal(frame.text,4);}
			assert.ok(hover[0].render<hover[1].render&&hover[1].render<hover[2].render);
			assert.ok(Math.abs(hover[3].render-hover[1].render)<.00001,'reverse hover restores the same intermediate frame');
			assert.equal(hover[3].geometry,hover[1].geometry);
			if(['story','twitter'].includes(mode)){assert.ok(hover.every(frame=>frame.scroll===hover[0].scroll),'text stays still while the illustration interpolates within a chapter');for(const frame of hover)assert.ok(Math.abs(frame.scroll-frame.expectedScroll)<1,'chapter text occupies its stable reading position');}
			run('mouse','move','8','40');
			const restored=scenario(`await wait(80);return {time:explorer.getState().renderTime,scroll:scrollY};`);
			assert.equal(restored.time,6.5,'leaving restores the exact fractional pose');
			if(['story','twitter'].includes(mode))assert.equal(restored.scroll,setup.scroll,'temporary hover restores the reading position');
			const start=point(4.15);run('mouse','move',String(start.x),String(start.y));run('mouse','down');
			try {
				const drag=[];
				for(const position of [4.15,4.3,4.45,4.3]) {
					const p=point(position);run('mouse','move',String(p.x),String(p.y));
					drag.push(scenario(`await wait(45);const s=explorer.getState(),value=Number(input.value),expected=window.__eu26Timeline.getState().navigation==='pages'?pageTime(value):value*1.7;return {time:s.time,render:s.renderTime,expected,preview:s.previewIndex,geometry:geometry(),scroll:scrollY,expectedScroll:expectedScroll(s.renderTime)};`));
				}
				assert.ok(new Set(drag.map(frame=>frame.geometry)).size>=2,'dragging renders distinct intermediate geometry within the chapter');
				for(const frame of drag){assert.ok(Math.abs(frame.time-frame.expected)<.00001);assert.ok(Math.abs(frame.render-frame.time)<.00001);assert.equal(frame.preview,null);}
				assert.ok(drag[0].time<drag[1].time&&drag[1].time<drag[2].time,JSON.stringify(drag.map(frame=>({time:frame.time,render:frame.render,expected:frame.expected}))));
				assert.ok(Math.abs(drag[3].time-drag[1].time)<.00001);
				assert.equal(drag[3].geometry,drag[1].geometry);
				if(['story','twitter'].includes(mode)){assert.ok(drag.every(frame=>frame.scroll===drag[0].scroll),'dragging never scrolls text within a chapter');for(const frame of drag)assert.ok(Math.abs(frame.scroll-frame.expectedScroll)<1,'dragging preserves the fixed text position');}
			} finally {run('mouse','up');run('mouse','move','8','40');}
		});

		for(const mode of ['story','twitter'])await t.test(`${mode} swaps text immediately at a chapter boundary without animating it`,()=>{
			run('mouse','move','8','40');
			const result=scenario(`story.setMode('${mode}');explorer.clearPreview();const select=position=>{input.value=String('${mode}'==='story'?position:pageTime(position)/1.7);input.dispatchEvent(new Event('input',{bubbles:true}));const article=document.querySelector('[data-story-step][aria-current="step"]');return {index:Number(article.dataset.storyIndex),title:article.querySelector('h2').textContent,top:article.querySelector('h2').getBoundingClientRect().top,scroll:scrollY,animations:article.getAnimations({subtree:true}).length};};return [select(4.2),select(4.6),select(5.1),select(4.2)];`);
			assert.equal(result[0].index,4);assert.equal(result[1].index,4);assert.equal(result[2].index,5);assert.equal(result[3].index,4);
			assert.equal(result[0].scroll,result[1].scroll);
			assert.equal(result[0].title,result[1].title);assert.notEqual(result[1].title,result[2].title);
			for(const frame of result){assert.ok(Math.abs(frame.top-result[0].top)<1,'new chapter text appears in the same screen position');assert.equal(frame.animations,0,'text has no slide or fade transition');}
		});

		for(const width of [1440,390,320])await t.test(`${width}px uses the same gap in every tick view`,()=>{
			run('set','viewport',String(width),'1000');run('mouse','move','8','40');
			const result=scenario(`const values=[];for(const mode of ['story','twitter','video']){story.setMode(mode);explorer.clearPreview();await wait(850);const horizontal=input.getAttribute('aria-orientation')==='horizontal',rows=[...dock.querySelectorAll('.eu26-timeline-mark')].map(row=>{const r=row.getBoundingClientRect();return horizontal?r.left:r.top;}),gaps=rows.slice(1).map((value,index)=>value-rows[index]);values.push({mode,count:rows.length,min:Math.min(...gaps),max:Math.max(...gaps)});}return values;`);
			for(const value of result){assert.ok(Math.abs(value.max-value.min)<.02,`${value.mode} gaps are uniform`);assert.ok(Math.abs(value.min-result[0].min)<.02,`${value.mode} uses the shared spacing`);if(value.mode==='story')assert.equal(value.count,12);}
			assert.ok(result[0].min>=12&&result[0].min<=20);
		});
	} finally {run('close');}
});
