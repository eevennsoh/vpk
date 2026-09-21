const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(path.join(process.cwd(), "scripts/lib/esbuild-cjs-loader.js"));

/**
 * The module imports the flyout mapper through the `@/` alias, which Node's
 * strip-types loader cannot resolve, so the suite bundles it once.
 */
let modulePromise;

function loadWorkItemModule() {
	modulePromise ??= (async () => {
		const result = await esbuild.build({
			stdin: {
				contents: `
					export {
						bindAgentSessionFlyoutActions,
						resolveAgentSessionWorkItemKey,
						suggestedAgentSessionWorkItemKey,
						toAgentSessionUntrackedWorkFlyoutItem,
						toJiraIssueAgentActivityFromSession,
					} from "./components/blocks/agent-session/agent-session-work-item.ts";
				`,
				loader: "ts",
				resolveDir: process.cwd(),
				sourcefile: "agent-session-work-item-harness.ts",
			},
			bundle: true,
			format: "cjs",
			loader: {
				".css": "empty",
			},
			platform: "node",
			tsconfig: path.join(process.cwd(), "tsconfig.json"),
			write: false,
		});

		return loadCjsModuleFromText(result.outputFiles[0].text);
	})();

	return modulePromise;
}

const ANNIE = { avatarSrc: "/3p/annie.png", name: "Annie Chen" };

function session(overrides = {}) {
	return {
		agent: { brandName: "claude", id: "claude", kind: "agent", name: "Claude" },
		host: "local",
		id: "lw-a",
		sessionDetails: { host: "local", issueKey: "PAY-101", issueSummary: "Webhook gap" },
		state: "complete",
		title: "Investigate webhook retries",
		...overrides,
	};
}

test("the chin-row activity carries the human who invoked the session", async () => {
	const { toJiraIssueAgentActivityFromSession } = await loadWorkItemModule();

	// The travelling drag chip reads `invokedBy` to draw "Claude with Annie
	// Chen". Dropping it here loses the human the moment a detached session is
	// mapped back onto a work item.
	assert.deepEqual(toJiraIssueAgentActivityFromSession(session({ invokedBy: ANNIE })), {
		agentBrandName: "claude",
		avatarSrc: undefined,
		host: "local",
		id: "lw-a",
		invokedBy: ANNIE,
		label: "Investigate webhook retries",
		name: "Claude",
		state: "completed",
	});
});

test("the invoker passes through by reference, not by reconstruction", async () => {
	const { toJiraIssueAgentActivityFromSession } = await loadWorkItemModule();
	const invoker = { avatarSrc: "/3p/annie.png", name: "Annie Chen" };

	assert.equal(toJiraIssueAgentActivityFromSession(session({ invokedBy: invoker })).invokedBy, invoker);
});

test("the Rovo product mark survives conversion to an attached activity", async () => {
	const { toJiraIssueAgentActivityFromSession } = await loadWorkItemModule();
	const activity = toJiraIssueAgentActivityFromSession(session({
		agent: { id: "rovo-dev", kind: "agent", name: "Rovo", vpkLogo: "rovo" },
		state: "running",
	}));

	assert.equal(activity.agentVpkLogo, "rovo");
	assert.equal(activity.avatarSrc, undefined);
	assert.equal(activity.agentBrandName, undefined);
});

test("a session with no invoker degrades to an agent-only activity", async () => {
	const { toJiraIssueAgentActivityFromSession } = await loadWorkItemModule();
	const activity = toJiraIssueAgentActivityFromSession(session());

	assert.equal(activity.invokedBy, undefined);
	assert.equal(activity.name, "Claude");
	assert.equal(activity.host, "local");
	assert.ok(!("invokedBy" in activity));
});

test("session states collapse onto the three chin-row states", async () => {
	const { toJiraIssueAgentActivityFromSession } = await loadWorkItemModule();
	const stateFor = (state) =>
		toJiraIssueAgentActivityFromSession(session({ invokedBy: ANNIE, state })).state;

	assert.equal(stateFor("needs-input"), "awaiting-input");
	assert.equal(stateFor("attention"), "awaiting-input");
	assert.equal(stateFor("complete"), "completed");
	assert.equal(stateFor("running"), "working");
});

test("every mapped state keeps the invoker", async () => {
	const { toJiraIssueAgentActivityFromSession } = await loadWorkItemModule();

	for (const state of ["needs-input", "attention", "complete", "running"]) {
		assert.deepEqual(
			toJiraIssueAgentActivityFromSession(session({ invokedBy: ANNIE, state })).invokedBy,
			ANNIE,
			`state ${state} dropped the invoker`,
		);
	}
});

test("the suggested work-item key is the one the session already names", async () => {
	const { resolveAgentSessionWorkItemKey, suggestedAgentSessionWorkItemKey } =
		await loadWorkItemModule();

	assert.equal(suggestedAgentSessionWorkItemKey(session()), "PAY-101");
	assert.equal(suggestedAgentSessionWorkItemKey(session({ sessionDetails: undefined })), undefined);
	assert.equal(resolveAgentSessionWorkItemKey(session()), "PAY-101");
	// Several candidate keys collapse to the first: one suggestion, one chin row.
	assert.equal(
		resolveAgentSessionWorkItemKey(session(), undefined, () => ["PAY-202", "PAY-303"]),
		"PAY-202",
	);
	assert.equal(
		resolveAgentSessionWorkItemKey(session(), () => "PAY-404", () => []),
		"PAY-404",
	);
});

test("the flyout payload only overrides the key when it differs", async () => {
	const { toAgentSessionUntrackedWorkFlyoutItem } = await loadWorkItemModule();
	const item = session();
	const base = toAgentSessionUntrackedWorkFlyoutItem(item);

	assert.equal(base.issueKey, "PAY-101");
	assert.deepEqual(toAgentSessionUntrackedWorkFlyoutItem(item, "  "), base);
	assert.deepEqual(toAgentSessionUntrackedWorkFlyoutItem(item, "PAY-101"), base);
	assert.equal(toAgentSessionUntrackedWorkFlyoutItem(item, "PAY-999").issueKey, "PAY-999");
});
