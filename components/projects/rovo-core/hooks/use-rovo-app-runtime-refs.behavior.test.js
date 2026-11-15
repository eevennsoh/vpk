// Assertions compare strings, booleans and numbers, never elements (scripts/lib/render-component.js).
const assert = require("node:assert/strict");
const test = require("node:test");
const { renderComponent } = require("../../../../scripts/lib/render-component.js");

// The parent owns the refs (as the Rovo app core does) and can unmount the hook's host.
// The refs are published on globalThis so the test can read them after commit-time effects.
const PROBE = `import { useRef, useState } from "react";
	import { useRovoAppRuntimeRefs } from "@/components/projects/rovo-core/hooks/use-rovo-app-runtime-refs";
	function Host({ refs, useChatStatus }) {
		useRovoAppRuntimeRefs({
			...refs,
			activeThreadId: null,
			attachedRunStatus: null,
			realtimeMessages: [],
			status: "ready",
			streamingArtifactMessageId: null,
			useChatStatus,
		});
		return null;
	}
	export default function Probe() {
		const refs = {
			activeThreadIdRef: useRef(null),
			attachedRunStatusRef: useRef(null),
			lastUseChatBusyAtRef: useRef(0),
			realtimeMessagesRef: useRef([]),
			runSubscriptionAbortControllerRef: useRef(null),
			statusRef: useRef("ready"),
			streamingArtifactMessageIdRef: useRef(null),
			useChatStatusRef: useRef("ready"),
		};
		if (refs.runSubscriptionAbortControllerRef.current === null) {
			refs.runSubscriptionAbortControllerRef.current = new AbortController();
		}
		globalThis.__runtimeRefsProbe = refs;
		const [mounted, setMounted] = useState(true);
		const [useChatStatus, setUseChatStatus] = useState("ready");
		return <div>
			{mounted ? <Host refs={refs} useChatStatus={useChatStatus} /> : null}
			<button type="button" onClick={() => setMounted(false)}>unmount</button>
			<button type="button" onClick={() => setUseChatStatus("streaming")}>stream</button>
		</div>;
	}`;

const refs = () => globalThis.__runtimeRefsProbe;

test("unmounting the hook aborts the open run subscription", async () => {
	const view = await renderComponent({ source: PROBE });
	const controller = refs().runSubscriptionAbortControllerRef.current;
	assert.equal(controller.signal.aborted, false, "the subscription stays open while mounted");
	await view.click(view.getByRole("button", { name: "unmount" }));
	assert.equal(controller.signal.aborted, true);
});

test("a busy useChat status mirrors into its ref and stamps the busy-at time", async () => {
	const view = await renderComponent({ source: PROBE });
	assert.equal(refs().lastUseChatBusyAtRef.current, 0, "a ready status does not stamp");
	const before = Date.now();
	await view.click(view.getByRole("button", { name: "stream" }));
	assert.equal(refs().useChatStatusRef.current, "streaming");
	assert.ok(refs().lastUseChatBusyAtRef.current >= before);
});
