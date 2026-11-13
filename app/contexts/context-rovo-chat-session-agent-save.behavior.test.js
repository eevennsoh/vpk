const assert = require("node:assert/strict");
const test = require("node:test");
const React = require("react");
const { renderComponent } = require("../../scripts/lib/render-component.js");

const STORAGE_KEY = "vpk:studio:session-agents:v1";
const DEBOUNCE_MS = 900;
const CSS_MODULE = "export default new Proxy({}, { get: (_, key) => String(key) });";

// A consumer of the real provider: it shows the save indicator's inputs and drives the
// session-agent mutations the Studio surfaces use.
const PROBE = `import { useState } from "react";
	import { RovoChatProvider, useRovoChat } from "@/app/contexts/context-rovo-chat";
	function SaveProbe() {
		const chat = useRovoChat();
		const [profileId, setProfileId] = useState(null);
		const create = (name, silentSave) => {
			const profile = chat.registerCreatedAgentFromResult({ action: "create", name, summary: name + " summary" }, { silentSave });
			setProfileId(profile ? profile.id : null);
		};
		return <div>
			<p>{chat.sessionAgentSaveStatus}|{chat.sessionAgentSaveStatus === "saved" ? (chat.sessionAgentSavedAt === null ? "no time" : "at " + chat.sessionAgentSavedAt) : "-"}|{chat.sessionAgentEntries.length}</p>
			<button type="button" onClick={() => create("Release Agent", false)}>Create agent</button>
			<button type="button" onClick={() => create("Blank Agent", true)}>Create blank agent</button>
			<button type="button" onClick={() => chat.updateSessionAgentDraft(profileId, { summary: "Edited " + Date.now() })}>Edit draft</button>
			<button type="button" onClick={() => chat.removeSessionAgent(profileId)}>Remove agent</button>
		</div>;
	}
	export default function Probe() {
		return <RovoChatProvider><SaveProbe /></RovoChatProvider>;
	}`;

const START = Date.parse("2026-11-13T09:00:00.000Z");

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

async function renderSaveProbe(context) {
	window.localStorage.clear();
	context.mock.timers.enable({ apis: ["setTimeout", "Date"], now: START });
	const view = await renderComponent({
		mocks: {
			"@/components/projects/shared/components/chat-messages.module.css": CSS_MODULE,
			"@/components/projects/sidebar-chat/chat.module.css": CSS_MODULE,
		},
		source: PROBE,
	});
	await advance(context, 0);
	return {
		press: (name) => view.click(view.getByRole("button", { name })),
		read: () => view.container.querySelector("p").textContent,
		stored: () => JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]").length,
		view,
	};
}

test("a session-agent change shows Saving, writes after the debounce, then Saved with its time", async (context) => {
	const probe = await renderSaveProbe(context);
	assert.equal(probe.read(), "idle|-|0");
	await probe.press("Create agent");
	assert.equal(probe.read(), "saving|-|1");
	await advance(context, DEBOUNCE_MS - 100);
	assert.equal(probe.stored(), 0, "nothing is written before the debounce");
	await advance(context, 100);
	assert.equal(probe.stored(), 1);
	assert.equal(probe.read(), `saved|at ${START + DEBOUNCE_MS}|1`);
});

test("edits inside the debounce coalesce into one write", async (context) => {
	const probe = await renderSaveProbe(context);
	await probe.press("Create agent");
	await advance(context, 500);
	await probe.press("Edit draft");
	await advance(context, 500);
	assert.equal(probe.read().startsWith("saving|"), true, "the second edit restarts the debounce");
	await advance(context, 400);
	assert.equal(probe.read(), `saved|at ${START + 1_400}|1`);
});

test("a blank agent is written silently: no Saving and no Saved", async (context) => {
	const probe = await renderSaveProbe(context);
	await probe.press("Create blank agent");
	assert.equal(probe.read(), "idle|-|1");
	await advance(context, DEBOUNCE_MS);
	assert.equal(probe.stored(), 1);
	assert.equal(probe.read(), "idle|-|1");
	await probe.press("Edit draft");
	assert.equal(probe.read(), "saving|-|1", "the next real edit shows progress again");
	await advance(context, DEBOUNCE_MS);
	assert.equal(probe.read(), `saved|at ${START + 2 * DEBOUNCE_MS}|1`);
});

test("a silent write after a saved one keeps showing Saved", async (context) => {
	const probe = await renderSaveProbe(context);
	await probe.press("Create agent");
	await advance(context, DEBOUNCE_MS);
	assert.equal(probe.read(), `saved|at ${START + DEBOUNCE_MS}|1`);
	await probe.press("Create blank agent");
	await advance(context, DEBOUNCE_MS);
	assert.equal(probe.read(), `saved|at ${START + DEBOUNCE_MS}|2`);
	assert.equal(probe.stored(), 2);
});

test("removing an agent saves like an edit", async (context) => {
	const probe = await renderSaveProbe(context);
	await probe.press("Create agent");
	await advance(context, DEBOUNCE_MS);
	await probe.press("Remove agent");
	assert.equal(probe.read(), "saving|-|0");
	await advance(context, DEBOUNCE_MS);
	assert.equal(probe.read(), `saved|at ${START + 2 * DEBOUNCE_MS}|0`);
	assert.equal(probe.stored(), 0);
});

test("a write the browser refuses shows Unable to save", async (context) => {
	const probe = await renderSaveProbe(context);
	const setItem = context.mock.method(window.localStorage, "setItem", () => {
		throw new Error("QuotaExceededError");
	});
	await probe.press("Create agent");
	await advance(context, DEBOUNCE_MS);
	assert.equal(setItem.mock.callCount() > 0, true);
	assert.equal(probe.read(), "error|-|1");
});

test("a blank agent created while an edit is saving still ends on Saved", async (context) => {
	const probe = await renderSaveProbe(context);
	await probe.press("Create agent");
	await advance(context, 300);
	await probe.press("Create blank agent");
	await advance(context, DEBOUNCE_MS);
	assert.equal(probe.read(), `saved|at ${START + 300 + DEBOUNCE_MS}|2`);
	assert.equal(probe.stored(), 2);
});

test("unmounting with a pending write stores it at once and leaves no timer", async (context) => {
	const probe = await renderSaveProbe(context);
	await probe.press("Create agent");
	const setItem = context.mock.method(window.localStorage, "setItem");
	await probe.view.unmount();
	assert.equal(probe.stored(), 1, "the edit lands before the provider goes away");
	await advance(context, 10_000);
	assert.equal(setItem.mock.callCount(), 1, "the flushed write is not repeated by a leftover timer");
});

test("leaving the page with a pending write stores it at once", async (context) => {
	const probe = await renderSaveProbe(context);
	await probe.press("Create agent");
	await React.act(async () => {
		window.dispatchEvent(new Event("pagehide"));
	});
	assert.equal(probe.stored(), 1);
	assert.equal(probe.read(), `saved|at ${START}|1`, "the flush reports its result like a debounced write");
	const setItem = context.mock.method(window.localStorage, "setItem");
	await advance(context, 10_000);
	assert.equal(setItem.mock.callCount(), 0, "nothing is left to write after the flush");
});

test("leaving the page with nothing pending writes nothing", async (context) => {
	const probe = await renderSaveProbe(context);
	const setItem = context.mock.method(window.localStorage, "setItem");
	await React.act(async () => {
		window.dispatchEvent(new Event("pagehide"));
	});
	await probe.view.unmount();
	assert.equal(setItem.mock.callCount(), 0);
});
