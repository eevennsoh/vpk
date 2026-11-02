import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const session=process.env.EU26_VIDEO_SESSION||`eu26-coded-video-test-${process.pid}`;
const artifact=fileURLToPath(new URL('../eu26-animation-explained.html',import.meta.url));
const run=(...args)=>execFileSync('agent-browser',['--session',session,...args],{encoding:'utf8',timeout:45000});
const evaluate=source=>JSON.parse(run('eval','-b',Buffer.from(source).toString('base64')));
const scenario=source=>evaluate(`(async()=>{
	const story=window.__vpkStory,explorer=window.__eu26Explorer,preview=window.__vpkVideoPreview;
	const root=document.querySelector('[data-vpk-story]'),stage=root.querySelector('[data-story-stage]'),reading=root.querySelector('[data-story-steps]');
	const panel=root.querySelector('[data-story-video]'),hero=root.querySelector('[data-vpk-figure="eu26-hero"]'),svg=hero.querySelector('svg');
	const control=action=>panel.querySelector('[data-video-action="'+action+'"]');
	const progress=document.querySelector('#eu26-explorer-timeline');
	const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
	const until=async(condition,message)=>{const deadline=performance.now()+3500;while(performance.now()<deadline){if(condition())return;await wait(16);}throw new Error(message+': '+JSON.stringify(preview.getState()));};
	${source}
})()`);

test('Video is a live HTML preview and rendering starts only from Generate', {timeout:90000},async t=>{
	run('set','viewport','1440','1000');run('set','media','light');run('open',`file://${artifact}`);
	run('wait','--fn','Boolean(window.__vpkVideoPreview && window.__eu26Explorer && window.__vpkStory)');
	try{
		await t.test('four mode labels are exact and no MP4 is loaded for the HTML preview',()=>{
			const result=scenario(`
				let config=document.querySelector('[data-vpk-video-export]');
				if(!config){config=document.createElement('script');config.type='application/json';config.setAttribute('data-vpk-video-export','');document.body.append(config);}
				config.textContent=JSON.stringify({endpoint:'https://qa-render.invalid/render',token:'qa-render-key'});
				window.__qaRenderCalls=[];
				window.fetch=async(input,init={})=>{
					const url=String(input),method=init.method||'GET';window.__qaRenderCalls.push({url,method,headers:Object.fromEntries(new Headers(init.headers).entries()),body:init.body||null});
					if(url==='https://qa-render.invalid/render'&&method==='POST')return new Response(JSON.stringify({id:'qa-guide',statusUrl:'/jobs/qa-guide'}),{status:202,headers:{'Content-Type':'application/json'}});
					if(url==='https://qa-render.invalid/jobs/qa-guide'&&method==='GET')return new Response(JSON.stringify({status:'complete',downloadUrl:'/downloads/qa-guide.mp4'}),{headers:{'Content-Type':'application/json'}});
					throw new Error('Unexpected QA export request');
				};
				window.__qaPreviewHero=hero;window.__qaPreviewSvg=svg;
				return {modes:[...root.querySelectorAll('button[data-story-mode]')].map(button=>[button.dataset.storyMode,button.textContent.trim()]),kind:preview.getState().kind,
					media:document.querySelectorAll('video[src],source[type^="video"],link[as="video"]').length,heroes:root.querySelectorAll('[data-vpk-figure="eu26-hero"]').length,calls:window.__qaRenderCalls.length};
			`);
			assert.deepEqual(result.modes,[['story','Page'],['slides','Slides'],['twitter','X Threads'],['video','Video']]);
			assert.equal(result.kind,'html');assert.equal(result.media,0);assert.equal(result.heroes,1);assert.equal(result.calls,0);
		});

		await t.test('paused Page and Video share the same diagram, fractional time and variant',()=>{
			const result=scenario(`
				explorer.pause();story.setMode('story');story.suspendFollowing();explorer.setVariant('outline');explorer.seek(12.345);
				story.setMode('video');await wait(80);
				const during={state:preview.getState(),sameHero:hero===window.__qaPreviewHero&&svg===window.__qaPreviewSvg,visible:!stage.hidden&&!stage.inert&&svg.getBoundingClientRect().height>0,copyHidden:reading.hidden&&reading.inert,panelVisible:!panel.hidden&&!panel.inert};
				story.setMode('story');await wait(80);
				return {during,after:explorer.getState(),restored:!stage.hidden&&!reading.hidden&&!reading.inert&&panel.hidden,calls:window.__qaRenderCalls.length};
			`);
			assert.equal(result.during.state.active,true);assert.equal(result.during.state.time,12.345);assert.equal(result.during.state.playing,false);assert.equal(result.during.state.variant,'outline');
			for(const key of ['sameHero','visible','copyHidden','panelVisible'])assert.equal(result.during[key],true,key);
			assert.equal(result.after.time,12.345);assert.equal(result.after.variant,'outline');assert.equal(result.after.playing,false);assert.equal(result.restored,true);assert.equal(result.calls,0);
		});

		await t.test('Video Play advances actual SVG geometry and Pause holds the same frame',()=>{
			const result=scenario(`
				story.setMode('video');explorer.seek(.5);const face=hero.querySelector('[data-eu26-piece="story.15"] .iso-top'),before=face.getAttribute('d');
				let mutations=0;const observer=new MutationObserver(records=>{mutations+=records.length;});observer.observe(svg,{subtree:true,attributes:true,childList:true});
				control('play').click();await until(()=>preview.getState().playing&&preview.getState().time>.6,'HTML preview did not play');await wait(180);
				const moved=face.getAttribute('d')!==before;control('play').click();const paused=preview.getState().time,pose=face.getAttribute('d');await wait(120);observer.disconnect();
				return {moved,mutations,paused:!preview.getState().playing,held:preview.getState().time===paused&&face.getAttribute('d')===pose,calls:window.__qaRenderCalls.length,media:document.querySelectorAll('video[src]').length};
			`);
			assert.equal(result.moved,true);assert.ok(result.mutations>0,'the coded SVG renders instead of playing an MP4');assert.equal(result.paused,true);assert.equal(result.held,true);assert.equal(result.calls,0);assert.equal(result.media,0);
		});

		await t.test('Video uses one horizontal ruler with intermediate marks and timestamps',()=>{
			const result=scenario(`
				story.setMode('video');explorer.seek(12.34);await wait(80);
				const dock=document.querySelector('#eu26-explorer-controls'),ruler=dock.querySelector('.eu26-timeline-ruler'),range=progress.getBoundingClientRect();
				const during={sameInput:panel.contains(progress),orientation:progress.getAttribute('aria-orientation'),position:getComputedStyle(dock).position,
					ranges:root.querySelectorAll('input[type="range"]').length,oldBar:root.querySelectorAll('.story-video-controls').length,horizontal:range.width>range.height*3,
					intermediate:dock.querySelectorAll('[data-intermediate="true"]').length,timestamps:[...dock.querySelectorAll('.eu26-timeline-timestamp')].map(label=>label.textContent),
					elapsed:dock.querySelector('.eu26-video-elapsed').textContent,controls:['play','replay','fullscreen'].every(action=>control(action)?.getBoundingClientRect().width>0)};
				story.setMode('story');await wait(80);
				return {during,restored:progress.getAttribute('aria-orientation')==='vertical'&&!panel.contains(progress)&&getComputedStyle(dock).position==='fixed',pageReplay:dock.querySelectorAll('[data-eu26-action="replay"]').length,pageTimes:dock.querySelectorAll('.eu26-timeline-timestamp,output').length,time:explorer.getState().time};
			`);
			assert.equal(result.during.sameInput,true);assert.equal(result.during.orientation,'horizontal');assert.equal(result.during.position,'relative');
			assert.equal(result.during.ranges,1);assert.equal(result.during.oldBar,0);assert.equal(result.during.horizontal,true);assert.ok(result.during.intermediate>5,'Video retains intermediate marks with responsive shared spacing');
			assert.deepEqual(result.during.timestamps,['0:00','0:05','0:10','0:15','0:20']);assert.equal(result.during.elapsed,'0:07 / 0:20');assert.equal(result.during.controls,true);
			assert.equal(result.restored,true);assert.equal(result.pageReplay,0);assert.equal(result.pageTimes,0);assert.equal(result.time,12.34);
		});

		await t.test('preview progress and chapter selection use the canonical authored clock',()=>{
			const result=scenario(`
				story.setMode('video');progress.value='12.34';progress.dispatchEvent(new Event('input',{bubbles:true}));
				const scrub={state:preview.getState(),pose:Number(hero.dataset.heroTime),value:Number(progress.value)};
				window.__eu26Timeline.setExpanded(true);await wait(220);root.querySelector('[data-eu26-state-index="8"]').click();
				await until(()=>!explorer.getState().transitioning&&explorer.getState().time===19,'chapter jump');
				window.__eu26Timeline.dismiss();
				return {scrub,jump:preview.getState(),calls:window.__qaRenderCalls.length};
			`);
			assert.ok(Math.abs(result.scrub.state.time-20.978)<.00001);assert.ok(Math.abs(result.scrub.pose-20.978)<.00001);assert.equal(result.scrub.value,12.34);assert.equal(result.scrub.state.playing,false);
			assert.equal(result.jump.time,19);assert.equal(result.jump.selectedIndex,8);assert.equal(result.calls,0);
		});

		await t.test('the horizontal ruler keeps native keyboard seeking and video time labels',()=>{
			scenario(`story.setMode('video');explorer.pause();progress.focus({preventScroll:true});return null;`);
			run('press','Home');assert.equal(scenario('return explorer.getState().time;'),0);
			run('press','ArrowRight');assert.ok(scenario('return explorer.getState().time;')>0);
			run('press','End');
			const result=scenario(`return {time:explorer.getState().time,value:Number(progress.value),focused:document.activeElement===progress,label:progress.getAttribute('aria-valuetext'),elapsed:document.querySelector('.eu26-video-elapsed').textContent};`);
			assert.equal(result.time,34);assert.equal(result.value,20);assert.equal(result.focused,true);assert.ok(result.label.startsWith('0:20 of 0:20.'));assert.equal(result.elapsed,'0:20 / 0:20');
			scenario(`root.focus({preventScroll:true});return null;`);
		});

		await t.test('playing intent survives Page and Video switches without resetting the clock',()=>{
			const result=scenario(`
				story.setMode('story');explorer.seek(6);explorer.play();await until(()=>explorer.getState().playing&&explorer.getState().time>6.05,'Page play');
				const before=explorer.getState().time;story.setMode('video');const entered=preview.getState();await wait(120);const advanced=preview.getState();
				const leaving=advanced.time;story.setMode('story');const returned=explorer.getState();await wait(120);const resumed=explorer.getState();explorer.pause();
				return {before,entered,advanced,leaving,returned,resumed,calls:window.__qaRenderCalls.length};
			`);
			assert.equal(result.entered.playing,true);assert.ok(result.entered.time>=result.before&&result.entered.time-result.before<.2);assert.ok(result.advanced.time>result.entered.time);
			assert.equal(result.returned.playing,true);assert.ok(result.returned.time>=result.leaving&&result.returned.time-result.leaving<.2);assert.ok(result.resumed.time>result.returned.time);assert.equal(result.calls,0);
		});

		await t.test('Video stops at twenty seconds while Page retains its infinite wall',()=>{
			const result=scenario(`
				story.setMode('video');explorer.seek(33.99);control('play').click();await until(()=>preview.getState().time===34&&!preview.getState().playing,'finite video endpoint');await wait(120);
				const ended={time:preview.getState().time,pose:Number(hero.dataset.heroTime),playing:preview.getState().playing,value:Number(progress.value)};
				control('replay').click();await until(()=>preview.getState().playing&&preview.getState().time>0&&preview.getState().time<1,'preview replay');explorer.pause();
				story.setMode('story');explorer.seek(33.99);explorer.play();await until(()=>explorer.getState().time>34.1&&explorer.getState().playing,'Page wall continuation');const page=explorer.getState();explorer.pause();
				return {ended,page,calls:window.__qaRenderCalls.length};
			`);
			assert.deepEqual(result.ended,{time:34,pose:34,playing:false,value:20});assert.ok(result.page.time>34.1);assert.equal(result.page.playing,true);assert.equal(result.calls,0);
		});

		for(const width of [390,320]){
			run('set','viewport',String(width),'844');
			await t.test(`${width}px Video keeps its live diagram and native preview controls within the page`,()=>{
				const result=scenario(`
					story.setMode('video');explorer.seek(8);await wait(80);
					const fit=element=>{const r=element.getBoundingClientRect();return r.width>0&&r.left>=-1&&r.right<=innerWidth+1;};
					window.__eu26Timeline.setExpanded(true);await wait(220);
					const tray=document.querySelector('.eu26-dock-tray').getBoundingClientRect(),header=root.querySelector('.story-bar').getBoundingClientRect();
					const gallery=tray.top>=header.bottom+8&&tray.bottom<=innerHeight-8;
					window.__eu26Timeline.dismiss();
					return {overflow:document.documentElement.scrollWidth>innerWidth+1,hero:fit(hero),controls:[...panel.querySelectorAll('button,input')].filter(element=>getComputedStyle(element).visibility!=='hidden'&&!element.closest('[inert]')).every(fit),same:svg===window.__qaPreviewSvg,copyHidden:reading.hidden&&reading.inert,gallery,calls:window.__qaRenderCalls.length};
				`);
				assert.deepEqual(result,{overflow:false,hero:true,controls:true,same:true,copyHidden:true,gallery:true,calls:0});
			});
		}

		await t.test('only Generate sends one authenticated render request and exposes the completed download',()=>{
			const result=scenario(`
				explorer.pause();explorer.setVariant('outline');const before=window.__qaRenderCalls.length;
				control('generate').click();await until(()=>preview.getState().exportStatus==='complete','mocked explicit generation');
				const download=panel.querySelector('[data-video-download]');return {before,calls:window.__qaRenderCalls,status:preview.getState().exportStatus,download:download.href,visible:!download.hidden,media:document.querySelectorAll('video[src]').length};
			`);
			assert.equal(result.before,0);assert.equal(result.status,'complete');assert.equal(result.visible,true);assert.equal(result.download,'https://qa-render.invalid/downloads/qa-guide.mp4');assert.equal(result.media,0);
			assert.equal(result.calls.length,2);assert.equal(result.calls[0].method,'POST');assert.equal(result.calls[0].url,'https://qa-render.invalid/render');assert.equal(result.calls[0].headers['x-vpk-render-key'],'qa-render-key');assert.deepEqual(JSON.parse(result.calls[0].body),{variant:'outline',theme:'light'});
			assert.equal(result.calls[1].method,'GET');assert.equal(result.calls[1].url,'https://qa-render.invalid/jobs/qa-guide');
		});
	}finally{run('close');}
});
