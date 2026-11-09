import assert from 'node:assert/strict';
import test from 'node:test';
import { coincidentEdges, rectsOf } from './face-overlap.mjs';
import { data, surfaceDetails } from './eu26-hero.hero.mjs';

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
