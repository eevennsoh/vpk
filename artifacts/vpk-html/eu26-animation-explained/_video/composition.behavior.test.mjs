import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

const session = `eu26-hyperframes-composition-test-${process.pid}`;
const run = (...args) => execFileSync('agent-browser', ['--session', session, ...args], { encoding: 'utf8', timeout: 30000 });

test('the coded export fills its frame and seeks deterministically without rendering an MP4', { timeout: 45000 }, () => {
	try {
		run('set', 'viewport', '1200', '760');
		run('open', new URL('project/index.html', import.meta.url).href);
		run('wait', '--fn', 'Boolean(window.__eu26Export && window.__timelines?.["eu26-animation"])');
		const script = `(() => {
			const frame = document.getElementById('eu26-scene');
			const scene = frame.contentDocument;
			const svg = scene.querySelector('[data-vpk-figure="eu26-hero"] .iso-svg');
			return {
				media: scene.querySelectorAll('video').length,
				frames: [0, 4, 9, 15, 20, 4].map(time => {
					window.__timelines['eu26-animation'].seek(time, false);
					const state = window.__eu26Export.getState();
					const box = svg.getBoundingClientRect();
					return { time, authored: state.time, playing: state.playing, box: { x: box.x, y: box.y, width: box.width, height: box.height } };
				}),
			};
		})()`;
		const result = JSON.parse(run('eval', '-b', Buffer.from(script).toString('base64')));
		assert.equal(result.media, 0);
		for (const frame of result.frames) {
			assert.ok(Math.abs(frame.authored - frame.time * 1.7) < 0.00001);
			assert.equal(frame.playing, false);
			assert.deepEqual(frame.box, { x: 0, y: 0, width: 1200, height: 760 });
		}
	} finally {
		run('close');
	}
});
