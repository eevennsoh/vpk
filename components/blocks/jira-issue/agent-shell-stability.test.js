/**
 * Contract for the agent shell's tree shape.
 *
 * `JiraIssue` returns two structurally different trees, and which one it picks
 * turns on two switches that sit on the article's *first child*. A React
 * element-type change there tears down the whole card subtree, so a card that
 * never left the screen remounts: keyboard focus is lost, and every
 * mount-animated descendant replays its entrance — the assignee `Avatar`'s
 * `initial: { scale: 0.8, opacity: 0 }` most visibly, because a remount is
 * indistinguishable from a genuine arrival.
 *
 * A board filter flips both switches at once. `applyCardAgentSessionVisibility`
 * strips `agentActivities` / `agentActivityMode` off the cards it is not
 * focusing, and `agentSessionTransfer` needs a non-completed activity, so the
 * last unlinkable row takes the transfer host with it. Neither has anything to
 * do with the card itself, which is why the shape must not follow them.
 *
 * These assertions live in their own file because `jira-issue.test.js` is at
 * the 1000-line architecture budget.
 */

const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const SOURCE = readFileSync(join(__dirname, "index.tsx"), "utf8");
const AVATAR_SOURCE = readFileSync(join(__dirname, "../../ui/avatar.tsx"), "utf8");
const VISIBILITY_SOURCE = readFileSync(
	join(__dirname, "../jira-kanban/experimental/lib/board-agent-session-visibility.ts"),
	"utf8",
);

test("the assignee avatar animates on mount, so a card remount is a visible defect", () => {
	// The cost side of the contract. If this entrance ever goes away, the
	// remount is still wrong (focus loss), but the symptom this file guards
	// changes and the assertions below deserve a fresh look.
	assert.match(
		AVATAR_SOURCE,
		/initial: AVATAR_ENTER_FROM,\s*\n\s*animate: \{ scale: 1, opacity: 1, transition: AVATAR_ENTER_TRANSITION \},/u,
	);
});

test("a board filter really can strip a mounted card back to no agent presentation", () => {
	// The trigger side. `undefined` here is deliberate — the filter wants the
	// shell gone — so JiraIssue is the layer that has to absorb it.
	assert.match(
		VISIBILITY_SOURCE,
		/\/\/ `undefined`, not `"none"`: JiraIssue treats an explicit mode as a reason\s*\n\t\/\/ to keep the agent shell even when no rows remain\.\s*\n\treturn undefined;/u,
	);
});

test("the agent shell latches on so a filtered-away row cannot remount the card", () => {
	assert.match(
		SOURCE,
		/const \[agentActivityShellMounted, setAgentActivityShellMounted\] = useState\(\s*\n\t\thasAgentActivityPresentation,\s*\n\t\);/u,
	);
	// Set during render, not from an effect. The render that first sees agent
	// chrome already resolves the shell through the `hasAgentActivityPresentation`
	// term below, so there is no stale frame for an effect to adjust away — and
	// an effect here trips react-doctor/no-adjust-state-on-prop-change.
	assert.match(
		SOURCE,
		/if \(hasAgentActivityPresentation && !agentActivityShellMounted\) \{\s*\n\t\tsetAgentActivityShellMounted\(true\);\s*\n\t\}/u,
	);
	assert.doesNotMatch(SOURCE, /useEffect\([\s\S]{0,200}setAgentActivityShellMounted/u);
});

test("both tree-shape gates read the latch", () => {
	assert.match(
		SOURCE,
		/const usesAgentActivityShell = hasAgentActivityPresentation\s*\n\t\t\|\| agentActivityShellMounted/u,
	);
	// `hasInteractiveContent` picks the article vs. plain-card branch. Leaving
	// it on the raw flag would remount the card even with the shell latched.
	assert.match(
		SOURCE,
		/const hasInteractiveContent = [^;]*\|\| agentActivityShellMounted \|\|/u,
	);
});

test("the transfer host stays mounted when its capability drops", () => {
	assert.doesNotMatch(
		SOURCE,
		/const agentActivityShellWithTransfer = agentSessionTransfer \?/u,
	);
	assert.match(SOURCE, /const agentActivityShellWithTransfer = \(\s*\n\t\t<div/u);
	// Only the contents are gated, so the feature stays inert when unconfigured.
	assert.match(SOURCE, /\{agentSessionTransfer \? \(\s*\n\t\t\t\t<JiraIssueAgentSessionTransfer/u);
	assert.match(
		SOURCE,
		/\{agentSessionTransfer && agentSessionDragBinding && sessionTransferAfter/u,
	);
});
