// Assertions compare strings and booleans, never elements (scripts/lib/render-component.js).
const assert = require("node:assert/strict");
const test = require("node:test");
const { renderComponent } = require("../../../../scripts/lib/render-component.js");

// The hook with real refs and state; buttons drive the mutations the Rovo app core makes.
const PROBE = `import { useRef, useState } from "react";
	import { useRovoAppRealtimeStateActions } from "@/components/projects/rovo-core/hooks/use-rovo-app-realtime-state-actions";
	const message = (id) => ({ id, role: "assistant", parts: [] });
	export default function Probe() {
		const [realtimeMessages, setRealtimeMessages] = useState([]);
		const realtimeMessagesRef = useRef([]);
		const realtimeMessagesVersionRef = useRef(0);
		const [returned, setReturned] = useState("");
		const [version, setVersion] = useState(0);
		const { mutateRealtimeMessagesState, replaceRealtimeMessagesState } = useRovoAppRealtimeStateActions({
			realtimeMessagesRef,
			realtimeMessagesVersionRef,
			setRealtimeMessages,
		});
		const sync = (result) => {
			setReturned(result.map((entry) => entry.id).join(","));
			setVersion(realtimeMessagesVersionRef.current);
		};
		return <div>
			<p data-probe="state">{realtimeMessages.map((entry) => entry.id).join(",")}</p>
			<p data-probe="ref">{realtimeMessagesRef.current.map((entry) => entry.id).join(",")}</p>
			<p data-probe="returned">{returned}</p>
			<p data-probe="version">{String(version)}</p>
			<button type="button" onClick={() => sync(replaceRealtimeMessagesState([message("a")]))}>replace</button>
			<button type="button" onClick={() => {
				mutateRealtimeMessagesState((current) => [...current, message("b")]);
				sync(mutateRealtimeMessagesState((current) => [...current, message("c")]));
			}}>append twice</button>
			<button type="button" onClick={() => sync(mutateRealtimeMessagesState((current) => current.slice(1), { incrementVersion: false }))}>drop first quietly</button>
		</div>;
	}`;

const read = (name) => document.querySelector(`[data-probe="${name}"]`).textContent;

test("replace writes the ref and state together and bumps the version", async () => {
	const view = await renderComponent({ source: PROBE });
	await view.click(view.getByRole("button", { name: "replace" }));
	assert.deepEqual([read("state"), read("ref"), read("returned"), read("version")], ["a", "a", "a", "1"]);
});

test("mutations in one handler build on each other through the ref, not the rendered state", async () => {
	const view = await renderComponent({ source: PROBE });
	await view.click(view.getByRole("button", { name: "replace" }));
	await view.click(view.getByRole("button", { name: "append twice" }));
	assert.equal(read("state"), "a,b,c", "the second append sees the first before any re-render");
	assert.equal(read("returned"), "a,b,c", "a mutation returns the messages it stored");
	assert.equal(read("version"), "3", "each mutation bumps the version by default");
});

test("incrementVersion: false updates messages without bumping the version", async () => {
	const view = await renderComponent({ source: PROBE });
	await view.click(view.getByRole("button", { name: "replace" }));
	await view.click(view.getByRole("button", { name: "append twice" }));
	await view.click(view.getByRole("button", { name: "drop first quietly" }));
	assert.deepEqual([read("state"), read("version")], ["b,c", "3"]);
});
