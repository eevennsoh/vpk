// Assertions compare strings and booleans, never elements (scripts/lib/render-component.js).
const assert = require("node:assert/strict");
const test = require("node:test");
const { renderComponent } = require("../../../../scripts/lib/render-component.js");

// The hook with the core's artifact state held locally. "associate" puts every piece of
// pending-association bookkeeping into a set state, so a reset can be checked field by field.
const PROBE = `import { useState } from "react";
	import { useRovoAppArtifactResetActions } from "@/components/projects/rovo-core/hooks/use-rovo-app-artifact-reset-actions";
	export default function Probe() {
		const [pendingArtifactResult, setPendingArtifactResult] = useState(null);
		const [streamingArtifact, setStreamingArtifact] = useState(null);
		const [queuedDeltaClears, setQueuedDeltaClears] = useState(0);
		const [, rerender] = useState(0);
		const actions = useRovoAppArtifactResetActions({
			clearQueuedStreamingArtifactDelta: () => setQueuedDeltaClears((count) => count + 1),
			setPendingArtifactResult,
			setStreamingArtifact,
		});
		const refs = [
			actions.streamingArtifactMessageIdRef.current,
			actions.pendingArtifactAssociationRef.current ? "pending" : null,
			actions.lastCompletedArtifactDocumentIdRef.current,
			actions.suppressedStreamingAutoOpenDocumentIdRef.current,
		];
		return <div>
			<p data-probe="pending-result">{pendingArtifactResult ?? "none"}</p>
			<p data-probe="streaming-artifact">{streamingArtifact ?? "none"}</p>
			<p data-probe="message-id">{actions.streamingArtifactMessageId ?? "none"}</p>
			<p data-probe="refs">{refs.map((value) => value ?? "-").join(",")}</p>
			<p data-probe="delta-clears">{String(queuedDeltaClears)}</p>
			<button type="button" onClick={() => {
				setPendingArtifactResult("result");
				setStreamingArtifact("artifact");
				actions.setStreamingArtifactMessageId("message-1");
				actions.streamingArtifactMessageIdRef.current = "message-1";
				actions.pendingArtifactAssociationRef.current = true;
				actions.lastCompletedArtifactDocumentIdRef.current = "doc-1";
				actions.suppressedStreamingAutoOpenDocumentIdRef.current = "doc-2";
				rerender((count) => count + 1);
			}}>associate</button>
			<button type="button" onClick={actions.resetPendingArtifactAssociation}>reset association</button>
			<button type="button" onClick={actions.clearStreamingArtifactState}>clear streaming</button>
		</div>;
	}`;

const read = (name) => document.querySelector(`[data-probe="${name}"]`).textContent;

test("resetting the pending association clears the result, message id and every association ref", async () => {
	const view = await renderComponent({ source: PROBE });
	await view.click(view.getByRole("button", { name: "associate" }));
	assert.deepEqual(
		[read("pending-result"), read("message-id"), read("refs")],
		["result", "message-1", "message-1,pending,doc-1,doc-2"],
	);

	await view.click(view.getByRole("button", { name: "reset association" }));
	assert.deepEqual([read("pending-result"), read("message-id"), read("refs")], ["none", "none", "-,-,-,-"]);
	assert.equal(read("streaming-artifact"), "artifact", "the streaming artifact is left for clearStreamingArtifactState");
});

test("clearing streaming state drops the queued delta and the streaming artifact only", async () => {
	const view = await renderComponent({ source: PROBE });
	await view.click(view.getByRole("button", { name: "associate" }));
	await view.click(view.getByRole("button", { name: "clear streaming" }));
	assert.deepEqual(
		[read("streaming-artifact"), read("delta-clears"), read("pending-result"), read("refs")],
		["none", "1", "result", "message-1,pending,doc-1,doc-2"],
	);
});
