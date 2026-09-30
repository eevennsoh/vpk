import assert from "node:assert/strict";
import test from "node:test";

import { createTeamworkGraph, relaxTeamworkGraph } from "./teamwork-graph.ts";

const OPTIONS = { nodeCount: 96, communityCount: 4, seed: 0x70b17 };

function build(overrides = {}) {
	return createTeamworkGraph({ ...OPTIONS, ...overrides });
}

test("every edge references a node that exists", () => {
	// Regression: the internal PRNG mixed with `^`, which yields a *signed*
	// 32-bit int, so it returned negatives and produced negative node indices
	// that crashed generation on `communityEdges[community[b]].push(...)`.
	const graph = build();

	assert.ok(graph.edgeCount > 0, "expected the generator to produce edges");
	for (let index = 0; index < graph.edgeCount; index++) {
		for (const node of [graph.edges[index * 2], graph.edges[index * 2 + 1]]) {
			assert.ok(
				Number.isInteger(node) && node >= 0 && node < graph.nodeCount,
				`edge ${index} references out-of-range node ${node}`,
			);
		}
	}
});

test("generation is deterministic for a seed and varies across seeds", () => {
	assert.deepEqual(Array.from(build().edges), Array.from(build().edges));
	assert.notDeepEqual(Array.from(build().edges), Array.from(build({ seed: 99 }).edges));
});

test("communities are balanced and every one can route particles", () => {
	const graph = build();

	assert.equal(graph.communityNodes.length, OPTIONS.communityCount);
	assert.equal(graph.communityEdges.length, OPTIONS.communityCount);

	const sizes = graph.communityNodes.map((nodes: Int32Array) => nodes.length);
	assert.equal(
		sizes.reduce((total: number, size: number) => total + size, 0),
		graph.nodeCount,
	);
	assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1, `communities uneven: ${sizes}`);

	for (const edgeList of graph.communityEdges) {
		assert.ok(edgeList.length > 0, "every community needs links for its particles to ride");
	}
});

test("no community fragments, because each is seeded with a ring", () => {
	const graph = build();
	const degree = new Int32Array(graph.nodeCount);
	for (let index = 0; index < graph.edgeCount; index++) {
		degree[graph.edges[index * 2]]++;
		degree[graph.edges[index * 2 + 1]]++;
	}
	for (let node = 0; node < graph.nodeCount; node++) {
		assert.ok(degree[node] >= 2, `node ${node} has degree ${degree[node]}`);
	}
});

test("links are born after both of their endpoints", () => {
	const graph = build();
	for (let index = 0; index < graph.edgeCount; index++) {
		const a = graph.nodeBirth[graph.edges[index * 2]];
		const b = graph.nodeBirth[graph.edges[index * 2 + 1]];
		assert.ok(
			graph.edgeBirth[index] >= Math.max(a, b) - 1e-6,
			`edge ${index} appears before its endpoints`,
		);
		assert.ok(graph.edgeBirth[index] <= 1, "births must land inside the cycle");
	}
});

test("relaxation keeps every node finite and inside the framing radius", () => {
	const graph = build();
	for (let step = 0; step < 200; step++) {
		relaxTeamworkGraph(graph, { repulsion: 1.1 / graph.nodeCount, linkDistance: 0.42 });
	}

	for (let node = 0; node < graph.nodeCount; node++) {
		const x = graph.positions[node * 3];
		const y = graph.positions[node * 3 + 1];
		const z = graph.positions[node * 3 + 2];
		assert.ok(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z), `node ${node} is NaN`);
		assert.ok(Math.hypot(x, y, z) <= 1.25 + 1e-3, `node ${node} escaped the radius`);
	}
});

test("the layout relaxes onto a spherical shell, not a filled ball", () => {
	// Spun, a filled ball reads as a formless cloud; a shell reads as a globe.
	const graph = build();
	for (let step = 0; step < 400; step++) {
		relaxTeamworkGraph(graph, { repulsion: 1.1 / graph.nodeCount, linkDistance: 0.42 });
	}

	const radii: number[] = [];
	for (let node = 0; node < graph.nodeCount; node++) {
		radii.push(
			Math.hypot(
				graph.positions[node * 3],
				graph.positions[node * 3 + 1],
				graph.positions[node * 3 + 2],
			),
		);
	}

	const mean = radii.reduce((total, value) => total + value, 0) / radii.length;
	const spread = Math.sqrt(
		radii.reduce((total, value) => total + (value - mean) ** 2, 0) / radii.length,
	);

	assert.ok(mean > 0.7, `nodes should sit out on the shell, mean radius ${mean.toFixed(3)}`);
	assert.ok(spread < mean * 0.35, `the shell should be thin, spread ${spread.toFixed(3)}`);
	assert.ok(Math.min(...radii) > 0.35, "no node should be stranded at the centre");
});

test("communities relax into separated clusters, not one ball", () => {
	// Without the anchor cohesion the four facets collapse into a single mesh
	// and the morph stops reading as "the mark unfolding into its communities".
	const graph = build();
	for (let step = 0; step < 300; step++) {
		relaxTeamworkGraph(graph, { repulsion: 1.1 / graph.nodeCount, linkDistance: 0.42 });
	}

	const centroids = graph.communityNodes.map((nodes: Int32Array) => {
		let x = 0;
		let y = 0;
		let z = 0;
		for (const node of nodes) {
			x += graph.positions[node * 3];
			y += graph.positions[node * 3 + 1];
			z += graph.positions[node * 3 + 2];
		}
		return [x / nodes.length, y / nodes.length, z / nodes.length];
	});

	let spread = 0;
	for (const nodes of graph.communityNodes) {
		for (const node of nodes) {
			const centroid = centroids[graph.community[node]];
			spread += Math.hypot(
				graph.positions[node * 3] - centroid[0],
				graph.positions[node * 3 + 1] - centroid[1],
				graph.positions[node * 3 + 2] - centroid[2],
			);
		}
	}
	spread /= graph.nodeCount;

	let separation = Infinity;
	for (let a = 0; a < centroids.length; a++) {
		for (let b = a + 1; b < centroids.length; b++) {
			separation = Math.min(
				separation,
				Math.hypot(
					centroids[a][0] - centroids[b][0],
					centroids[a][1] - centroids[b][1],
					centroids[a][2] - centroids[b][2],
				),
			);
		}
	}

	assert.ok(
		separation > spread,
		`clusters should be further apart (${separation.toFixed(3)}) than they are wide (${spread.toFixed(3)})`,
	);
});

test("coincident nodes are pushed apart rather than dividing by zero", () => {
	const graph = build({ nodeCount: 8 });
	graph.positions.fill(0);
	graph.velocities.fill(0);

	relaxTeamworkGraph(graph, { repulsion: 0.1, linkDistance: 0.4 });

	for (let index = 0; index < graph.positions.length; index++) {
		assert.ok(Number.isFinite(graph.positions[index]), "a coincident stack produced NaN");
	}
});

test("a degenerate node count still yields a usable graph", () => {
	const graph = build({ nodeCount: 1 });
	assert.ok(graph.nodeCount >= OPTIONS.communityCount);
	assert.equal(graph.positions.length, graph.nodeCount * 3);
});
