/**
 * Pulse outcome highlighting — issue keys become lozenges, type names become
 * inline code, and every story uses the same walk.
 *
 * Executed against the fixture rather than grepped: the first two insights both
 * have to render a `<code>` node and a lozenge, and a member-scoped summary
 * has to pick up the same treatment so filtering a face does not drop it.
 */

const { test } = require("node:test");

const {
	assert,
	loadProseHarness,
	SOURCES,
} = require("./pulse-test-harness");

function tokensOfType(tokens, type) {
	return tokens.filter((token) => token.type === type).map((token) => token.value);
}

test("Pulse tokenizes issue keys and type names without lighting up ordinary words", async () => {
	const { tokenizePulseProse } = await loadProseHarness();
	const tokens = tokenizePulseProse(
		"Keeping LegacyGatewayAdapter as a shim. Removal won on PAY-102. Monday, v1, v2, and LaunchDarkly stay prose. `payments_sdk_v2_rollout` is opted in.",
	);

	assert.deepEqual(tokensOfType(tokens, "code"), ["LegacyGatewayAdapter", "payments_sdk_v2_rollout"]);
	assert.deepEqual(tokensOfType(tokens, "issue-key"), ["PAY-102"]);
	assert.equal(tokens.some((token) => token.value === "Monday" && token.type !== "text"), false);
	assert.equal(tokens.some((token) => token.value === "LaunchDarkly" && token.type !== "text"), false);
	assert.match(tokens.map((token) => token.value).join(""), /v1, v2/);
});

test("Pulse first two insights both render inline code and an issue-key lozenge", async () => {
	const { renderPulseProse, snapshotParagraph, tokenizePulseProse } = await loadProseHarness();

	const kickoff = snapshotParagraph("s1-kickoff");
	const spike = snapshotParagraph("s2-spike");
	const kickoffTokens = tokenizePulseProse(kickoff);
	const spikeTokens = tokenizePulseProse(spike);

	assert.deepEqual(tokensOfType(kickoffTokens, "code"), ["LegacyGatewayAdapter"]);
	// The kickoff paragraph cites PAY-102 for the proof-of-possibility and then
	// PAY-101 as the work item the reasoning is stranded on, so both render as
	// lozenges in document order.
	assert.deepEqual(tokensOfType(kickoffTokens, "issue-key"), ["PAY-102", "PAY-101"]);
	assert.ok(tokensOfType(spikeTokens, "code").includes("LegacyGatewayAdapter"));
	assert.ok(tokensOfType(spikeTokens, "issue-key").includes("PAY-102"));
	assert.ok(tokensOfType(spikeTokens, "issue-key").includes("PAY-107"));

	const kickoffMarkup = renderPulseProse(kickoff);
	const spikeMarkup = renderPulseProse(spike);

	assert.match(kickoffMarkup, /data-pulse-prose="code"[^>]*>LegacyGatewayAdapter<\/code>/u);
	assert.match(kickoffMarkup, /data-pulse-prose="issue-key"[\s\S]*PAY-102/u);
	assert.match(kickoffMarkup, /data-slot="lozenge"/u);
	assert.match(kickoffMarkup, /data-slot="lozenge-leading-icon"[\s\S]*aria-label="Task"/u);
	assert.match(spikeMarkup, /data-pulse-prose="code"[^>]*>LegacyGatewayAdapter<\/code>/u);
	assert.match(spikeMarkup, /data-pulse-prose="issue-key"[\s\S]*PAY-102/u);
	assert.match(spikeMarkup, /data-pulse-prose="issue-key"[\s\S]*PAY-107/u);
	assert.match(spikeMarkup, /data-slot="lozenge-leading-icon"[\s\S]*aria-label="Task"/u);
});

test("Pulse member summaries and later insights reuse the same highlighter", async () => {
	const { contributionSummary, renderPulseProse, snapshotParagraph, tokenizePulseProse } =
		await loadProseHarness();

	const ship = snapshotParagraph("s7-ship-readiness");
	const vennKickoff = contributionSummary("s1-kickoff", "venn");

	assert.ok(tokensOfType(tokenizePulseProse(ship), "code").includes("LegacyGatewayAdapter"));
	assert.ok(tokensOfType(tokenizePulseProse(ship), "issue-key").includes("PAY-112"));
	assert.ok(tokensOfType(tokenizePulseProse(vennKickoff), "issue-key").includes("PAY-121"));

	const shipMarkup = renderPulseProse(ship);
	const summaryMarkup = renderPulseProse(vennKickoff);

	assert.match(shipMarkup, /data-pulse-prose="code"[^>]*>LegacyGatewayAdapter<\/code>/u);
	assert.match(shipMarkup, /data-pulse-prose="issue-key"[\s\S]*PAY-112/u);
	assert.match(summaryMarkup, /data-pulse-prose="issue-key"[\s\S]*PAY-121/u);
});

test("Pulse story renders through PulseProseText", () => {
	assert.match(SOURCES.story, /<PulseProseText text=\{paragraph\} \/>/u);
	assert.match(SOURCES.story, /<PulseProseText text=\{contribution\.summary\} \/>/u);
	assert.doesNotMatch(SOURCES.signals, /PulseProseText/u);
	assert.match(SOURCES.proseText, /data-pulse-prose="code"/u);
	assert.match(SOURCES.proseText, /data-pulse-prose="issue-key"/u);
	assert.match(SOURCES.proseText, /<Lozenge[\s\S]*elemBefore=\{<TaskIcon color="var\(--ds-icon-brand\)" label="Task" \/>\}[\s\S]*variant="neutral"/u);
});
