const assert = require("node:assert/strict");
const test = require("node:test");
const { issueRemovalSpacing, issueSelectionBackdrop } = require("./issue-selection-backdrop.ts");
const { resolveJiraIssueSelectionBackdrop } = require("../../../jira-issue/selection-backdrop.ts");
const { DECK_LAYERS, DECK_VISIBLE_MAX } = require("../../../agent-session/session-drag-deck.ts");
const { createIssueCohortDeckLayers, createIssueCohortGatherKeyframes, ISSUE_COHORT_DECK_LAYERS, ISSUE_COHORT_GATHER_TIMING } = require("./issue-cohort-gather.ts");

const cards = ["A", "B", "C", "D"].map((code) => ({ code }));
const modes = (selected) => cards.map((_, index) => issueSelectionBackdrop(cards, new Set(selected), index));

test("only adjacent selected issues share a backdrop", () => {
	assert.deepEqual(modes(["A", "B", "C"]), ["start", "middle", "end", "rest"]);
	assert.deepEqual(modes(["A", "C"]), ["single", "rest", "single", "rest"]);
	assert.equal(issueSelectionBackdrop([{ code: "D" }], new Set(["A", "D"]), 0), "single");
});

test("adjacent removals subtract their shared gap once and an empty column has no trailing seam", () => {
	const selected = new Set(["A", "B"]), removing = new Set(["A", "B"]);
	assert.deepEqual(issueRemovalSpacing(cards, selected, removing, 0), { gaps: 2, fusedGaps: 1 });
	assert.deepEqual(issueRemovalSpacing(cards, selected, removing, 1), { gaps: 0, fusedGaps: 0 });
	assert.equal(issueRemovalSpacing(cards, selected, removing, 2), undefined);
	assert.deepEqual(issueRemovalSpacing([{ code: "A" }], selected, new Set(["A"]), 0), { gaps: 0, fusedGaps: 0 });
});

test("removal spacing exactly matches surviving geometry for every selection and removal subset", () => {
	const spacing = (items, selected, gap) => Math.max(0, items.length - 1) * gap
		- items.slice(1).filter((card, index) => selected.has(items[index].code) && selected.has(card.code)).length * 4;
	for (const gap of [4, 8]) {
		for (let selectionMask = 0; selectionMask < 16; selectionMask++) {
			const selected = new Set(cards.filter((_, index) => selectionMask & (1 << index)).map(card => card.code));
			for (let removalMask = 1; removalMask < 16; removalMask++) {
				const removing = new Set(cards.filter((_, index) => removalMask & (1 << index)).map(card => card.code));
				const remaining = cards.filter(card => !removing.has(card.code));
				const collapsed = cards.reduce((total, _, index) => {
					const seam = issueRemovalSpacing(cards, selected, removing, index);
					return total + (seam ? seam.gaps * gap - seam.fusedGaps * 4 : 0);
				}, 0);
				assert.equal(collapsed, spacing(cards, selected, gap) - spacing(remaining, selected, gap));
			}
		}
	}
});

test("resting selection does not activate an agent well; selected issues do", () => {
	assert.equal(resolveJiraIssueSelectionBackdrop().active, false);
	const resting = resolveJiraIssueSelectionBackdrop("rest");
	assert.equal(resting.active, false);
	assert.equal(resting.selected, false);
	assert.equal(resting.top, 0);
	assert.equal(resolveJiraIssueSelectionBackdrop("single").selected, true);
});

test("joined wells meet without overlap and expose their adjoining edges", () => {
	const start = resolveJiraIssueSelectionBackdrop("start");
	const middle = resolveJiraIssueSelectionBackdrop("middle");
	const end = resolveJiraIssueSelectionBackdrop("end");
	assert.equal(start.top, 0);
	assert.equal(start.joinsBefore, false);
	assert.equal(start.joinsAfter, true);
	assert.equal(start.style.borderBottomLeftRadius, 0);
	assert.equal(middle.top, 0);
	assert.equal(middle.joinsBefore, true);
	assert.equal(middle.joinsAfter, true);
	assert.equal(middle.style.borderTopLeftRadius, 0);
	assert.equal(middle.style.borderBottomLeftRadius, 0);
	assert.equal(end.top, 0);
	assert.equal(end.joinsBefore, true);
	assert.equal(end.joinsAfter, false);
	assert.equal(end.style.borderBottomLeftRadius, "10px");
	assert.equal("height" in middle.style, false);
	assert.equal("margin" in middle.style, false);
});

test("issue travellers retain the shared deck limit without changing Agent Session poses", () => {
	assert.equal(DECK_VISIBLE_MAX, 3);
	assert.deepEqual(DECK_LAYERS, [{ rotateDeg: 2.4, xPx: 4, yPx: 3 }, { rotateDeg: -3.2, xPx: -3, yPx: 6 }]);
});

test("Jira rear sheets peek above and below the front at opposite corners", () => {
	assert.ok(ISSUE_COHORT_DECK_LAYERS[0].rotateDeg * ISSUE_COHORT_DECK_LAYERS[1].rotateDeg < 0);
	const width = 266;
	const height = 124;
	for (const layer of ISSUE_COHORT_DECK_LAYERS) {
		const angle = layer.rotateDeg * Math.PI / 180;
		const halfHeight = (width * Math.abs(Math.sin(angle)) + height * Math.abs(Math.cos(angle))) / 2;
		assert.ok(height / 2 + layer.yPx - halfHeight < -8);
		assert.ok(height / 2 + layer.yPx + halfHeight > height + 8);
	}
});

test("rear sheets gather straight upward while retaining their deck rotations", () => {
	for (const layer of ISSUE_COHORT_DECK_LAYERS) {
		const frames = createIssueCohortGatherKeyframes(layer);
		assert.equal(frames.length, 2);
		assert.equal(frames[0].transform, `translate(${layer.xPx}px, ${layer.yPx + 24}px) rotate(${layer.rotateDeg}deg)`);
		assert.equal(frames.at(-1).transform, `translate(${layer.xPx}px, ${layer.yPx}px) rotate(${layer.rotateDeg}deg)`);
	}
	assert.equal(ISSUE_COHORT_GATHER_TIMING.duration + ISSUE_COHORT_GATHER_TIMING.stagger, 285);
});

const tiltFamily = (layers) => layers.every((layer) => layer.rotateDeg > 0) ? 1 : layers.every((layer) => layer.rotateDeg < 0) ? -1 : 0;

test("rear cards independently mix clockwise and counterclockwise within compact bounds", () => {
	const poses = [0, 0.25, 0.5, 0.75, 1].map((value) => createIssueCohortDeckLayers(() => value));
	assert.equal(new Set(poses.map((layers) => JSON.stringify(layers))).size, poses.length);
	assert.deepEqual(poses.slice(0, 4).map((layers) => layers.map((layer) => Math.sign(layer.rotateDeg))), [[1, 1], [-1, -1], [1, -1], [-1, 1]]);
	for (const layers of poses) {
		assert.equal(layers.length, 2);
		assert.ok(layers[0].xPx * layers[1].xPx < 0);
		layers.forEach((layer, index) => {
			assert.ok(Math.abs(layer.rotateDeg) >= 3.5 && Math.abs(layer.rotateDeg) <= 7.5);
			assert.ok(Math.abs(layer.xPx) <= 7.5);
			assert.ok(Math.abs(layer.yPx - ISSUE_COHORT_DECK_LAYERS[index].yPx) <= 1.5);
			const frames = createIssueCohortGatherKeyframes(layer);
			assert.equal(frames.at(-1).transform, `translate(${layer.xPx}px, ${layer.yPx}px) rotate(${layer.rotateDeg}deg)`);
		});
	}
	assert.deepEqual(ISSUE_COHORT_DECK_LAYERS, [{ rotateDeg: -5, xPx: -6, yPx: -2 }, { rotateDeg: 6, xPx: 6, yPx: 4 }]);
});

test("every retry visibly changes the previous stack even when random repeats", () => {
	let previous = createIssueCohortDeckLayers(() => 0.5);
	for (let pickup = 0; pickup < 8; pickup++) {
		const snapshot = structuredClone(previous);
		const next = createIssueCohortDeckLayers(() => 0.5, previous);
		assert.notEqual(tiltFamily(next), tiltFamily(previous), "swapping two opposing sheets is the same silhouette");
		assert.deepEqual(previous, snapshot, "a fresh pickup must not mutate the released stack");
		previous = next;
	}
});

test("a single backing sheet changes direction on every retry", () => {
	let previous = createIssueCohortDeckLayers(() => 0.5, [], 1);
	for (let pickup = 0; pickup < 4; pickup++) {
		const next = createIssueCohortDeckLayers(() => 0.5, previous, 1);
		assert.equal(next.length, 1);
		assert.notEqual(tiltFamily(next), tiltFamily(previous));
		previous = next;
	}
});
