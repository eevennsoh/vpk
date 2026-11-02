import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

const session=`eu26-video-playhead-${process.pid}`;
const run=(...args)=>execFileSync('agent-browser',['--session',session,...args],{encoding:'utf8',timeout:30000});
const evaluate=source=>JSON.parse(run('eval','-b',Buffer.from(source).toString('base64')));
const scenario=source=>evaluate(`(async()=>{
	const story=window.__vpkStory,explorer=window.__eu26Explorer,dock=document.querySelector('#eu26-explorer-controls');
	const ruler=dock.querySelector('.eu26-timeline-ruler'),input=dock.querySelector('input[type="range"]'),head=dock.querySelector('.eu26-video-playhead');
	const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
	const until=async condition=>{for(let i=0;i<180;i++){if(condition())return;await wait(16);}throw new Error('Playback did not reach expected state');};
	const sample=()=>{const r=ruler.getBoundingClientRect(),h=head.getBoundingClientRect(),s=explorer.getState();return {left:r.left,right:r.right,width:r.width,headLeft:h.left,headRight:h.right,x:(h.left+h.right)/2,time:s.time,seconds:Number(head.dataset.playbackSeconds),playing:s.playing};};
	${source}
})()`);
const aligned=(s,seconds)=>{
	const fraction=Math.max(0,Math.min(1,seconds/20));
	assert.ok(Math.abs(s.x-(s.left+1+fraction*(s.width-2)))<.1,'playhead follows exact video time');
	assert.ok(s.headLeft>=s.left-.02&&s.headRight<=s.right+.02,'playhead stays inside the video track');
	assert.ok(Math.abs(s.seconds-fraction*20)<.00001);
};

test('Video playhead uses playback time independently of ruler ticks and magnetic previews',{timeout:60000},async t=>{
	run('set','viewport','1440','1000');run('set','media','light');run('open',new URL('../eu26-animation-explained.html',import.meta.url).href);
	run('wait','--fn','Boolean(window.__eu26Explorer && window.__vpkStory)');
	try{
		await t.test('one separate playhead is visible only in Video',()=>{
			const result=scenario(`const hidden=[];for(const mode of ['story','slides','twitter']){story.setMode(mode);hidden.push(head.getBoundingClientRect().width===0);}story.setMode('video');explorer.pause();explorer.seek(0);input.scrollIntoView({block:'center',behavior:'instant'});await wait(120);return {hidden,visible:head.getBoundingClientRect().width===2,separate:head.parentElement===ruler&&!dock.querySelector('.eu26-timeline-ticks').contains(head),count:dock.querySelectorAll('.eu26-video-playhead').length};`);
			assert.deepEqual(result.hidden,[true,true,true]);assert.equal(result.visible,true);assert.equal(result.separate,true);assert.equal(result.count,1);
		});

		await t.test('fractional times move between ticks and both endpoints are bounded',()=>{
			const result=scenario(`const frames=[];for(const seconds of [0,1.234,4.123,9.876,19.99,20,30]){explorer.seek(seconds*1.7);const s=sample(),ticks=[...dock.querySelectorAll('.eu26-timeline-tick')].map(tick=>{const r=tick.getBoundingClientRect();return(r.left+r.right)/2;});frames.push({requestedSeconds:seconds,...s,distance:Math.min(...ticks.map(x=>Math.abs(x-s.x)))});}return frames;`);
			for(const s of result)aligned(s,s.requestedSeconds);
			assert.ok(result.some(s=>s.distance>2),'the playhead is not snapped to the nearest ruler tick');
		});

		await t.test('hover previews change the illustration without moving the paused playhead',()=>{
			run('mouse','move','8','40');
			const before=scenario(`explorer.seek(5.678*1.7);const r=input.getBoundingClientRect();return {...sample(),xTarget:r.left+r.width*.8,yTarget:(r.top+r.bottom)/2};`);
			run('mouse','move',String(Math.round(before.xTarget)),String(Math.round(before.yTarget)));
			const after=scenario(`await wait(240);return {...sample(),render:explorer.getState().renderTime,elapsed:dock.querySelector('.eu26-video-elapsed').textContent};`);
			aligned(after,5.678);assert.equal(after.time,before.time);assert.ok(Math.abs(after.render-after.time)>1);assert.ok(Math.abs(after.x-before.x)<.05);assert.equal(after.elapsed,'0:05 / 0:20');
			run('mouse','move','8','40');
		});

		await t.test('play, pause and scrubbing share the existing video clock',()=>{
			const result=scenario(`explorer.clearPreview();explorer.seek(.5*1.7);const start=sample();explorer.play();await until(()=>explorer.getState().time>1.2);explorer.pause();const paused=sample();await wait(120);const held=sample();input.value='7.123';input.dispatchEvent(new Event('input',{bubbles:true}));return {start,paused,held,scrub:sample(),input:Number(input.value)};`);
			assert.ok(result.paused.x>result.start.x);assert.equal(result.paused.time,result.held.time);assert.equal(result.paused.x,result.held.x);aligned(result.scrub,result.input);
		});

		await t.test('resizing rebuilds ticks while preserving the playhead time',()=>{
			scenario(`explorer.seek(12.345*1.7);return null;`);
			run('set','viewport','390','844');
			const s=scenario(`input.scrollIntoView({block:'center',behavior:'instant'});await wait(140);return sample();`);
			aligned(s,12.345);
		});
	}finally{run('close');}
});
