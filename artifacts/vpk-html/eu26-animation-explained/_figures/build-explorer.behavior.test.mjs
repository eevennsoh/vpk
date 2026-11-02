import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const file = fileURLToPath(new URL('../eu26-animation-explained.html', import.meta.url));
const builder = fileURLToPath(new URL('./build-explorer.mjs', import.meta.url));

test('rebuilding keeps the complete published hero available until the replacement is ready', { timeout: 120000 }, async () => {
	let reads = 0;
	const inspect = () => {
		const html = fs.readFileSync(file, 'utf8');
		const region = html.match(/<!-- vpk-anatomy-hero:start[^>]*-->([\s\S]*?)<!-- vpk-anatomy-hero:end[^>]*-->/)?.[1] || '';
		assert.ok(region.includes('data-vpk-anatomy-data'), 'the live document keeps its hero data');
		assert.ok(region.includes('class="iso-solid"'), 'the live document keeps its drawing');
		assert.ok(html.includes('data-eu26-explorer-runtime'), 'playback remains available');
		reads += 1;
	};
	inspect();
	const child = spawn(process.execPath, [builder], { stdio: ['ignore', 'pipe', 'pipe'] });
	let output = '', failure = null;
	child.stdout.on('data', chunk => { output += chunk; });
	child.stderr.on('data', chunk => { output += chunk; });
	const interval = setInterval(() => {
		try { inspect(); }
		catch (error) { failure = error; child.kill(); }
	}, 50);
	try {
		const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', resolve); });
		if (failure) throw failure;
		assert.equal(code, 0, output);
		inspect();
		assert.ok(reads > 2, 'the check spans the actual rebuild');
	} finally { clearInterval(interval); }
});

test('rebuilding is stable and leaves export credentials out of the HTML', { timeout: 120000 }, () => {
	const before = fs.readFileSync(file, 'utf8');
	execFileSync(process.execPath, [builder], { stdio: 'pipe', timeout: 120000 });
	const after = fs.readFileSync(file, 'utf8');
	assert.equal(after, before);
	const island = after.match(/<script type="application\/json" data-vpk-video-export>([\s\S]*?)<\/script>/);
	assert.deepEqual(JSON.parse(island[1]), {});
});
