const assert = require("node:assert/strict");
const test = require("node:test");
const React = require("react");
const { renderComponent } = require("../../../../scripts/lib/render-component.js");

const AGENT = {
	description: "Drafts RFP responses.",
	id: "rfp-writer",
	name: "RFP Writer",
	sources: [
		{ id: "confluence", label: "Confluence", provider: "confluence" },
		{ id: "jira", label: "Jira", provider: "jira" },
	],
};
const STEP_MS = 1_400;
const STEP_COUNT = 6;

// The hook probe prints the step states, which the tracker only shows through styling.
const HOOK_PROBE = `import { useTemplateBuildFlow } from "@/components/blocks/agent-browser/components/template-build-flow";
	export default function HookProbe({ agent, onBuildAgent, onCancel }) {
		const flow = useTemplateBuildFlow({ agent, onBuildAgent, onCancel });
		return <div>
			<p>{flow.phase}:{flow.buildSteps.map((step) => step.state).join(",")}:{flow.builtProfileId ?? "none"}</p>
			<button type="button" onClick={() => flow.toggleApp("jira")}>Toggle Jira</button>
			<button type="button" onClick={() => flow.startBuild(true)}>Connect and build</button>
			<button type="button" onClick={() => flow.startBuild(false)}>Build without apps</button>
			<button type="button" onClick={flow.cancel}>Cancel flow</button>
		</div>;
	}`;

const timersEnabled = new WeakSet();

const FLOW_PROBE = `import { ThemeWrapper } from "@/components/utils/theme-wrapper";
	import { TemplateBuildFlow } from "@/components/blocks/agent-browser/components/template-build-flow";
	export default function FlowProbe(props) {
		return <ThemeWrapper><TemplateBuildFlow {...props} /></ThemeWrapper>;
	}`;

async function advance(context, ms) {
	let elapsed = 0;
	do {
		const slice = Math.min(100, ms - elapsed);
		await React.act(async () => {
			context.mock.timers.tick(slice);
		});
		elapsed += slice;
	} while (elapsed < ms);
}

async function renderHook(context, props = {}) {
	if (!timersEnabled.has(context)) {
		timersEnabled.add(context);
		context.mock.timers.enable({ apis: ["setTimeout"] });
	}
	const calls = { builds: [], cancels: 0 };
	const view = await renderComponent({
		props: {
			agent: AGENT,
			onBuildAgent: (agent, options) => {
				calls.builds.push({ agentId: agent.id, options });
				return { profileId: `profile-${calls.builds.length}` };
			},
			onCancel: () => calls.cancels++,
			...props,
		},
		source: HOOK_PROBE,
	});
	return { calls, read: () => view.container.querySelector("p").textContent, view };
}

test("template build steps advance every 1.4 s and land on built with the returned profile", async (context) => {
	const { calls, read, view } = await renderHook(context);
	assert.equal(read(), "connect:todo,todo,todo,todo,todo,todo:none");
	await view.click(view.getByRole("button", { name: "Toggle Jira" }));
	await view.click(view.getByRole("button", { name: "Connect and build" }));
	assert.equal(read(), "building:current,todo,todo,todo,todo,todo:none");
	await advance(context, STEP_MS - 100);
	assert.equal(read(), "building:current,todo,todo,todo,todo,todo:none");
	await advance(context, 100);
	assert.equal(read(), "building:done,current,todo,todo,todo,todo:none");
	await advance(context, STEP_MS * (STEP_COUNT - 2));
	assert.equal(read(), "building:done,done,done,done,done,current:none");
	assert.deepEqual(calls.builds, [], "the build runs only after the last step's hold");
	await advance(context, STEP_MS);
	assert.equal(read(), "built:done,done,done,done,done,done:profile-1");
	assert.deepEqual(calls.builds, [{ agentId: "rfp-writer", options: { appIds: ["jira"], connectApps: true } }]);
	await advance(context, 60_000);
	assert.equal(calls.builds.length, 1, "a built flow schedules nothing more");
});

test("template build without apps, or with none selected, sends no app ids", async (context) => {
	const { calls, view } = await renderHook(context);
	await view.click(view.getByRole("button", { name: "Toggle Jira" }));
	await view.click(view.getByRole("button", { name: "Build without apps" }));
	await advance(context, STEP_MS * STEP_COUNT);
	await view.click(view.getByRole("button", { name: "Toggle Jira" }));
	await view.click(view.getByRole("button", { name: "Connect and build" }));
	await advance(context, STEP_MS * STEP_COUNT);
	assert.deepEqual(calls.builds.map((build) => build.options), [
		{ appIds: [], connectApps: false },
		{ appIds: [], connectApps: false },
	]);
});

test("template build without a host finishes on a demo profile", async (context) => {
	const demo = await renderHook(context, { onBuildAgent: undefined });
	await demo.view.click(demo.view.getByRole("button", { name: "Connect and build" }));
	await advance(context, STEP_MS * STEP_COUNT);
	assert.equal(demo.read(), "built:done,done,done,done,done,done:demo-template-rfp-writer");
});

test("template build that the host fails (null) ends in error, not ready", async (context) => {
	const failing = await renderHook(context, { onBuildAgent: () => null });
	await failing.view.click(failing.view.getByRole("button", { name: "Connect and build" }));
	await advance(context, STEP_MS * STEP_COUNT);
	assert.equal(failing.read(), "error:done,done,done,done,done,todo:none");
});

test("cancel from a failed build tells only the host", async (context) => {
	let cancels = 0;
	const failing = await renderHook(context, { onBuildAgent: () => null, onCancel: () => cancels++ });
	await failing.view.click(failing.view.getByRole("button", { name: "Connect and build" }));
	await advance(context, STEP_MS * STEP_COUNT);
	await failing.view.click(failing.view.getByRole("button", { name: "Cancel flow" }));
	assert.equal(cancels, 1);
});

test("cancel runs the built agent's own cancel before the host's, and only once built", async (context) => {
	const order = [];
	const { read, view } = await renderHook(context, {
		onBuildAgent: () => ({ onCancel: () => order.push("built"), profileId: "p" }),
		onCancel: () => order.push("host"),
	});
	await view.click(view.getByRole("button", { name: "Connect and build" }));
	await view.click(view.getByRole("button", { name: "Cancel flow" }));
	assert.deepEqual(order, ["host"], "cancelling mid-build only tells the host");
	assert.equal(read().startsWith("building:"), true, "the host owns unmounting the flow");
	await advance(context, STEP_MS * STEP_COUNT);
	await view.click(view.getByRole("button", { name: "Cancel flow" }));
	assert.deepEqual(order, ["host", "built", "host"]);
});

test("restarting a build resets the steps and the previous profile", async (context) => {
	const { read, view } = await renderHook(context);
	await view.click(view.getByRole("button", { name: "Connect and build" }));
	await advance(context, STEP_MS * STEP_COUNT);
	assert.equal(read(), "built:done,done,done,done,done,done:profile-1");
	await view.click(view.getByRole("button", { name: "Connect and build" }));
	assert.equal(read(), "building:current,todo,todo,todo,todo,todo:none");
	await advance(context, STEP_MS * STEP_COUNT);
	assert.equal(read(), "built:done,done,done,done,done,done:profile-2");
});

test("unmounting mid-build never calls the builder", async (context) => {
	const { calls, view } = await renderHook(context);
	await view.click(view.getByRole("button", { name: "Connect and build" }));
	await advance(context, STEP_MS * 3);
	await view.unmount();
	await advance(context, 60_000);
	assert.deepEqual(calls.builds, []);
});

test("TemplateBuildFlow walks connect → building → ready and opens the built agent", async (context) => {
	context.mock.timers.enable({ apis: ["setTimeout"] });
	const opened = [];
	const view = await renderComponent({
		source: FLOW_PROBE,
		props: {
			agent: AGENT,
			onBuildAgent: () => ({ profileId: "profile-rfp" }),
			onCancel: () => {},
			onOpenBuiltAgent: (agent, profileId) => opened.push(`${agent.id}:${profileId}`),
		},
	});
	assert.equal(view.getByText("Connect your apps") !== null, true);
	await view.click(view.getByRole("button", { name: /^Confluence/u }));
	assert.equal(view.getByRole("button", { name: /^Continue\s*1$/u }) !== null, true, "the selected count shows on Continue");
	await view.click(view.getByRole("button", { name: /^Continue\s*1$/u }));
	assert.equal(view.getByText("Build your agent") !== null, true);
	assert.equal(view.getByRole("button", { name: "Building..." }).disabled, true);
	await advance(context, STEP_MS * STEP_COUNT);
	assert.equal(view.getByText("RFP Writer is ready") !== null, true);
	await view.click(view.getByRole("button", { name: "See agent" }));
	assert.deepEqual(opened, ["rfp-writer:profile-rfp"]);
});

test("TemplateBuildFlow shows the error and retries after a failed build", async (context) => {
	context.mock.timers.enable({ apis: ["setTimeout"] });
	let attempts = 0;
	const view = await renderComponent({
		props: {
			agent: AGENT,
			onBuildAgent: () => (++attempts === 1 ? null : { profileId: "second" }),
			onCancel: () => {},
			onOpenBuiltAgent: () => {},
		},
		source: FLOW_PROBE,
	});
	await view.click(view.getByRole("button", { name: "Continue" }));
	await advance(context, STEP_MS * STEP_COUNT);
	assert.equal(view.queryByText("We couldn't create this draft. Try again or start from another template.") !== null, true);
	assert.equal(view.queryByText("RFP Writer is ready"), null);
	assert.equal(view.queryByRole("button", { name: "Cancel" }) !== null, true, "a failed build can be left as well as retried");
	await view.click(view.getByRole("button", { name: "Try again" }));
	assert.equal(view.queryByText("Build your agent") !== null, true);
	await advance(context, STEP_MS * STEP_COUNT);
	assert.equal(view.queryByText("RFP Writer is ready") !== null, true);
	assert.equal(attempts, 2);
});

test("TemplateBuildFlow cancels from connect and from building", async (context) => {
	context.mock.timers.enable({ apis: ["setTimeout"] });
	let cancels = 0;
	const view = await renderComponent({
		props: { agent: AGENT, onCancel: () => cancels++, onOpenBuiltAgent: () => {} },
		source: FLOW_PROBE,
	});
	await view.click(view.getByRole("button", { name: "Cancel" }));
	await view.click(view.getByRole("button", { name: "Continue" }));
	await advance(context, STEP_MS);
	await view.click(view.getByRole("button", { name: "Cancel" }));
	assert.equal(cancels, 2);
});
