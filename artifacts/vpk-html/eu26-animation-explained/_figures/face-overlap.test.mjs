import assert from 'node:assert/strict';
import test from 'node:test';
import { coincidentEdges, containmentIssues, rectsOf } from './face-overlap.mjs';
import { data, surfaceDetails } from './eu26-hero.hero.mjs';
import { COVERS, LAYERED, TILES } from './eu26-face-detail.mjs';
import { pen } from './eu26-face-pen.mjs';

test('no two different outlines on any paper face share an edge line', () => {
	const hits = surfaceDetails().flatMap(coincidentEdges);
	assert.deepEqual(hits.map(hit => `${hit.face} ${hit.axis}=${hit.at}: ${hit.a} | ${hit.b}`), []);
});

test('the check catches a nested outline that runs along its parent edge', () => {
	const face = { name: 'probe', w: 100, d: 60, r: 8, markup: '<rect class="dw" x="10" y="10" width="80" height="40" rx="8"/><rect class="dw" x="10" y="10" width="80" height="12" rx="4"/>' };
	assert.equal(coincidentEdges(face).length > 0, true);
});

test('stack rows sit inside their slot card, clear of its edges', () => {
	const stacks = surfaceDetails().filter(face => /searchDrop|agentSessionStack|riskStack/.test(face.name));
	assert.equal(stacks.length, 3);
	for (const face of stacks) {
		const [, card, ...rest] = rectsOf(face.markup);
		const rows = rest.filter(rect => /class="dw"/.test(rect.tag) && rect.r === 8);
		assert.equal(rows.length, 3, face.name);
		for (const row of rows) {
			assert.ok(row.x - card.x >= 4 && row.y - card.y >= 4, `${face.name} row clears the card's top-left`);
			assert.ok(card.x + card.w - (row.x + row.w) >= 4 && card.y + card.h - (row.y + row.h) >= 4, `${face.name} row clears the card's bottom-right`);
		}
	}
	assert.equal(data.wallCards.length, 9);
});

test('every cover and bento tile keeps its containers inside their parents, with even margins', () => {
	const covers = Object.entries(COVERS).map(([code, draw]) => {
		const p = pen();
		draw(p);
		return { name: code, w: 170, d: 74, layered: LAYERED.has(code), markup: p.markup() };
	});
	const tiles = data.features.map(feature => {
		const p = pen();
		TILES[feature.kind](p);
		return { name: feature.kind, w: feature.w, d: feature.d, layered: LAYERED.has(feature.kind), markup: p.markup() };
	});
	assert.equal(covers.length, 23);
	assert.deepEqual(tiles.map(tile => tile.name).sort(), Object.keys(TILES).sort());
	// The cover panel and footer dot on every card face (the cover itself is checked in its own box above).
	const cards = surfaceDetails().filter(face => face.name.startsWith('story.')).map(face => ({ ...face, layered: true }));
	assert.deepEqual([...covers, ...tiles, ...cards].flatMap(containmentIssues), []);
});

test('the containment check catches a tab poking out of its panel and a nearly centred window', () => {
	const tab = { name: 'probe', w: 220, d: 180, markup: '<rect class="dp" x="14" y="26" width="192" height="148" rx="6"/><rect class="dw" x="22" y="44" width="160" height="56" rx="6"/><rect class="dw" x="10" y="32" width="80" height="22" rx="5"/>' };
	const issues = containmentIssues(tab);
	assert.ok(issues.some(issue => /crosses or crowds/.test(issue)), 'tab past the panel edge');
	assert.ok(issues.some(issue => /straddles/.test(issue)), 'tab over the window edge');
	const offCentre = { name: 'probe', w: 170, d: 74, markup: '<rect class="dw" x="50" y="8" width="76" height="60" rx="5"/>' };
	assert.deepEqual(containmentIssues(offCentre).map(issue => issue.match(/nearly centred \w+/)?.[0]), ['nearly centred across', 'nearly centred down'], 'a window at 50 / 44 across and 8 / 6 down');
});
