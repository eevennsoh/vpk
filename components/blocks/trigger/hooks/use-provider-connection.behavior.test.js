const assert = require("node:assert/strict");
const test = require("node:test");
const React = require("react");
const { renderComponent } = require("../../../../scripts/lib/render-component.js");

const PROBE = `import { useProviderConnection } from "@/components/blocks/trigger/hooks/use-provider-connection";
	export default function ConnectionProbe({ onConnected, label = "first" }) {
		const connection = useProviderConnection();
		const connect = (providerId) => connection.connect({ providerId }, () => onConnected(providerId + "@" + label));
		return <div>
			<p>{connection.pending ? "Authorizing " + connection.pending.providerId : "idle"}</p>
			<button type="button" onClick={() => connect("slack")}>Connect Slack</button>
			<button type="button" onClick={() => connect("jira")}>Connect Jira</button>
			<button type="button" onClick={connection.dismiss}>Dismiss</button>
		</div>;
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

async function renderConnection(context) {
	context.mock.timers.enable({ apis: ["setTimeout"] });
	const connected = [];
	const view = await renderComponent({ props: { onConnected: (id) => connected.push(id) }, source: PROBE });
	return {
		connected,
		press: (name) => view.click(view.getByRole("button", { name })),
		read: () => view.container.querySelector("p").textContent,
		view,
	};
}

test("useProviderConnection authorizes for 1.2 s, then connects once", async (context) => {
	const connection = await renderConnection(context);
	await connection.press("Connect Slack");
	assert.equal(connection.read(), "Authorizing slack");
	await advance(context, 1_100);
	assert.deepEqual(connection.connected, []);
	await advance(context, 100);
	assert.deepEqual(connection.connected, ["slack@first"]);
	assert.equal(connection.read(), "idle");
	await advance(context, 10_000);
	assert.deepEqual(connection.connected, ["slack@first"]);
});

test("useProviderConnection lets a second provider take over the timer, as before", async (context) => {
	const connection = await renderConnection(context);
	await connection.press("Connect Slack");
	await advance(context, 600);
	await connection.press("Connect Jira");
	await advance(context, 1_100);
	assert.deepEqual(connection.connected, [], "the new connect restarts the 1.2 s wait");
	await advance(context, 100);
	assert.deepEqual(connection.connected, ["jira@first"], "the replaced Slack connect never completes");
});

test("useProviderConnection keeps connecting after the progress is dismissed", async (context) => {
	const connection = await renderConnection(context);
	await connection.press("Connect Slack");
	await connection.press("Dismiss");
	assert.equal(connection.read(), "idle");
	await advance(context, 1_200);
	assert.deepEqual(connection.connected, ["slack@first"]);
});

test("useProviderConnection completes with the callback bound at connect time", async (context) => {
	const connection = await renderConnection(context);
	await connection.press("Connect Slack");
	await connection.view.rerender({ label: "second", onConnected: (id) => connection.connected.push(id) });
	await advance(context, 1_200);
	assert.deepEqual(connection.connected, ["slack@first"], "switching what the host shows must not redirect the completion");
});

test("useProviderConnection cancels on unmount", async (context) => {
	const connection = await renderConnection(context);
	await connection.press("Connect Slack");
	await connection.view.unmount();
	await advance(context, 10_000);
	assert.deepEqual(connection.connected, []);
});
