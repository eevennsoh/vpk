import assert from "node:assert/strict";
import test from "node:test";

import { mulberry32, samplePointCloud } from "./point-cloud-sampling.ts";

const SIZE = 8;
const FACET_COUNT = 4;

/** Four horizontal bands, one per facet, covering the whole mask. */
function bandedMask(): Uint8Array {
	const mask = new Uint8Array(SIZE * SIZE);
	for (let row = 0; row < SIZE; row++) {
		const facet = Math.floor(row / (SIZE / FACET_COUNT));
		for (let column = 0; column < SIZE; column++) {
			mask[row * SIZE + column] = facet + 1;
		}
	}
	return mask;
}

/** A single lit cell, so most candidates are rejected. */
function sparseMask(): Uint8Array {
	const mask = new Uint8Array(SIZE * SIZE);
	mask[0] = 2;
	return mask;
}

function sample(count: number, mask: Uint8Array, seed = 1234) {
	return samplePointCloud({ count, mask, size: SIZE, facetCount: FACET_COUNT, seed });
}

test("seeded sampling is deterministic across runs", () => {
	const first = sample(256, bandedMask());
	const second = sample(256, bandedMask());

	assert.deepEqual(Array.from(first.positions), Array.from(second.positions));
	assert.deepEqual(first.buckets, second.buckets);
});

test("a different seed produces a different cloud", () => {
	const first = sample(256, bandedMask(), 1);
	const second = sample(256, bandedMask(), 2);

	assert.notDeepEqual(Array.from(first.positions), Array.from(second.positions));
});

test("buckets are contiguous, ordered, and cover every particle exactly once", () => {
	const cloud = sample(512, bandedMask());

	assert.equal(cloud.count, 512);
	assert.equal(cloud.positions.length, 1024);
	assert.ok(cloud.buckets.length > 1, "banded mask should produce more than one facet run");

	let cursor = 0;
	for (const bucket of cloud.buckets) {
		// Contiguity is the perf contract the draw loop depends on: one colour
		// assignment per run instead of one per particle.
		assert.equal(bucket.start, cursor, "bucket runs must be back to back");
		assert.ok(bucket.end > bucket.start, "bucket runs must be non-empty");
		cursor = bucket.end;
	}
	assert.equal(cursor, cloud.count, "buckets must cover the whole cloud");

	const facets = cloud.buckets.map((bucket: { facet: number }) => bucket.facet);
	assert.deepEqual(facets, [...facets].sort((a, b) => a - b));
});

test("positions stay inside the normalised -0.5..0.5 range", () => {
	const cloud = sample(512, bandedMask());

	for (const value of cloud.positions) {
		assert.ok(value >= -0.5 && value < 0.5, `expected ${value} within -0.5..0.5`);
	}
});

test("a sparse mask still yields a full-length cloud", () => {
	// The draw loop pairs particle i with sample i, so a short cloud would
	// silently drop flow-field particles.
	const cloud = sample(64, sparseMask());

	assert.equal(cloud.count, 64);
	assert.equal(cloud.positions.length, 128);
	assert.deepEqual(
		cloud.buckets.map((bucket: { facet: number }) => bucket.facet),
		[1],
	);
});

test("an empty mask degrades to a full-length cloud at the origin", () => {
	const cloud = sample(16, new Uint8Array(SIZE * SIZE));

	assert.equal(cloud.count, 16);
	assert.ok(Array.from(cloud.positions).every((value) => value === 0));
});

test("a zero count yields an empty cloud rather than throwing", () => {
	const cloud = sample(0, bandedMask());

	assert.equal(cloud.count, 0);
	assert.equal(cloud.positions.length, 0);
	assert.deepEqual(cloud.buckets, []);
});

test("mulberry32 is reproducible and stays in the unit interval", () => {
	const first = mulberry32(42);
	const second = mulberry32(42);

	for (let index = 0; index < 64; index++) {
		const value = first();
		assert.equal(value, second());
		assert.ok(value >= 0 && value < 1, `expected ${value} within 0..1`);
	}
});
