// Assertions compare strings and booleans, never elements (scripts/lib/render-component.js).
const assert = require("node:assert/strict");
const test = require("node:test");
const { renderComponent } = require("../../../../scripts/lib/render-component.js");

// The hook with a small stand-in for the shell's chat state: panel state, messages and a thread id.
// Buttons stand in for the pane's controls and for a new browser state or thread arriving.
const PROBE = `import { useRef, useState } from "react";
	import { useRovoAppShellArtifactWorkspace } from "@/components/projects/rovo-core/hooks/use-rovo-app-shell-artifact-workspace";
	const browserMessage = (url) => ({ id: "m-" + url, role: "assistant", parts: [{ type: "data-browser-state", data: { url, title: url, status: "ready" } }] });
	export default function Probe() {
		const [panelState, setPanelState] = useState("closed");
		const [messages, setMessages] = useState([]);
		const [runtimeThreadId, setRuntimeThreadId] = useState("thread-1");
		const [cursorMode, setCursorMode] = useState(false);
		const [dismissedBrowserArtifactKey, setDismissedBrowserArtifactKey] = useState(null);
		const artifactContentRef = useRef(null);
		const chat = {
			activeThreadId: runtimeThreadId, artifactMode: "preview", documents: [], messages, panelState, runtimeThreadId,
			selectedVersionId: null, streamingArtifact: null, visibleArtifactDocumentId: null,
			hideArtifactPane: () => setPanelState("closed"), setActiveDocumentId: () => {}, setPanelState, submitPrompt: async () => {},
		};
		const workspace = useRovoAppShellArtifactWorkspace({
			artifactContentRef, buildPromptOptions: () => ({}), chat, cursorMode, dismissedBrowserArtifactKey,
			isArtifactOpen: panelState !== "closed", setCursorMode, setDismissedBrowserArtifactKey,
		});
		return <div>
			<p data-probe="panel">{panelState}</p>
			<p data-probe="browser">{workspace.browserState ? workspace.browserState.url : "none"}</p>
			<p data-probe="reopen">{workspace.shouldShowReopenBrowserPreviewControl ? "shown" : "hidden"}</p>
			<p data-probe="cursor">{cursorMode ? "on" : "off"}</p>
			<button type="button" onClick={() => setMessages((current) => [...current, browserMessage("https://a.test")])}>browser A</button>
			<button type="button" onClick={() => setMessages((current) => [...current, browserMessage("https://b.test")])}>browser B</button>
			<button type="button" onClick={workspace.handleCloseBrowserPreview}>close preview</button>
			<button type="button" onClick={workspace.handleOpenBrowserPreview}>reopen preview</button>
			<button type="button" onClick={() => setCursorMode(true)}>cursor on</button>
			<button type="button" onClick={() => setRuntimeThreadId("thread-2")}>switch thread</button>
		</div>;
	}`;

const read = (name) => document.querySelector(`[data-probe="${name}"]`).textContent;

async function renderProbe() {
	const view = await renderComponent({ source: PROBE });
	return { press: (name) => view.click(view.getByRole("button", { name })) };
}

test("a browser state opens the preview; closing dismisses that state until a new one arrives", async () => {
	const probe = await renderProbe();
	assert.deepEqual([read("panel"), read("browser")], ["closed", "none"]);

	await probe.press("browser A");
	assert.deepEqual([read("panel"), read("browser")], ["preview", "https://a.test"], "auto-opens on a browser state");

	await probe.press("close preview");
	assert.deepEqual([read("panel"), read("reopen")], ["closed", "shown"], "closing dismisses it and offers a reopen control");

	await probe.press("browser B");
	assert.equal(read("panel"), "preview", "a new browser state opens it again");
});

test("the reopen control brings a dismissed preview back, and a thread change clears the dismissal", async () => {
	const probe = await renderProbe();
	await probe.press("browser A");
	await probe.press("close preview");
	await probe.press("reopen preview");
	assert.deepEqual([read("panel"), read("reopen")], ["preview", "hidden"]);

	await probe.press("close preview");
	assert.equal(read("panel"), "closed");
	await probe.press("switch thread");
	assert.equal(read("panel"), "preview", "the same browser state auto-opens again in the new thread");
});

test("the annotation cursor turns off when the pane closes", async () => {
	const probe = await renderProbe();
	await probe.press("browser A");
	await probe.press("cursor on");
	assert.equal(read("cursor"), "on");
	await probe.press("close preview");
	assert.equal(read("cursor"), "off");
});
