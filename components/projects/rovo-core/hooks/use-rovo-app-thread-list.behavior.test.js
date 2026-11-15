// Assertions compare strings and booleans, never elements (scripts/lib/render-component.js).
const assert = require("node:assert/strict");
const test = require("node:test");
const React = require("react");
const { renderComponent } = require("../../../../scripts/lib/render-component.js");

// The thread API is replaced so the hook loads three threads and deletes succeed; once
// threads are deleted, later list calls return what the server now holds.
const API_MOCK = `
	export const deletedThreadIds = [];
	const allThreads = [{ id: "a", title: "A" }, { id: "b", title: "B" }, { id: "c", title: "C" }];
	export async function listRovoAppThreads() {
		return allThreads.filter((thread) => !deletedThreadIds.includes(thread.id));
	}
	export async function deleteRovoAppThread(threadId) {
		deletedThreadIds.push(threadId);
	}
`;

const PROBE = `import { useRovoAppThreadListCore } from "@/components/projects/rovo-core/hooks/use-rovo-app-thread-list";
	import { deletedThreadIds } from "@/components/projects/rovo-core/lib/api";
	let renders = 0;
	export default function Probe({ dedupeRefreshResults }) {
		const { deleteThread, threads, threadsLoaded } = useRovoAppThreadListCore({ dedupeRefreshResults });
		renders += 1;
		return <div>
			<p data-probe="renders">{String(renders)}</p>
			<p data-probe="loaded">{threadsLoaded ? "yes" : "no"}</p>
			<p data-probe="threads">{threads.map((thread) => thread.id).join(",")}</p>
			<p data-probe="deleted">{deletedThreadIds.join(",")}</p>
			<button type="button" onClick={() => { void deleteThread("a"); void deleteThread("b"); }}>delete a and b</button>
		</div>;
	}`;

const read = (name) => document.querySelector(`[data-probe="${name}"]`).textContent;
const tick = () => React.act(() => new Promise((resolve) => setTimeout(resolve, 5)));

// Poll rather than sleep a fixed time, so a loaded CI shard does not flake.
async function waitFor(predicate, description, timeoutMs = 2000) {
	const deadline = Date.now() + timeoutMs;
	while (!predicate()) {
		if (Date.now() > deadline) assert.fail(`timed out waiting for ${description}`);
		await tick();
	}
}

async function refreshOnFocus() {
	await React.act(() => {
		window.dispatchEvent(new window.Event("focus"));
	});
	// Let the mocked list call resolve and any resulting update commit.
	for (let index = 0; index < 4; index += 1) await tick();
}

for (const dedupeRefreshResults of [false, true]) {
	test(`back-to-back deletes both stick, through a later refresh (dedupe ${dedupeRefreshResults ? "on" : "off"})`, async () => {
		const view = await renderComponent({
			mocks: { "@/components/projects/rovo-core/lib/api": API_MOCK },
			props: { dedupeRefreshResults },
			source: PROBE,
		});
		await waitFor(() => read("loaded") === "yes", "the initial thread list");
		assert.equal(read("threads"), "a,b,c");

		// Two deletes in one handler: the second must filter the first's optimistic result,
		// not the list captured by the render, or "a" comes back.
		await view.click(view.getByRole("button", { name: "delete a and b" }));
		await waitFor(() => read("deleted") === "a,b", "both deletes to reach the API");
		assert.equal(read("threads"), "c");

		await refreshOnFocus();
		assert.equal(read("threads"), "c", "a refresh returning the post-delete list keeps it");
	});
}

test("with dedupe on, a refresh matching the optimistic delete does not re-render", async () => {
	const view = await renderComponent({
		mocks: { "@/components/projects/rovo-core/lib/api": API_MOCK },
		props: { dedupeRefreshResults: true },
		source: PROBE,
	});
	await waitFor(() => read("loaded") === "yes", "the initial thread list");
	await view.click(view.getByRole("button", { name: "delete a and b" }));
	await waitFor(() => read("deleted") === "a,b", "both deletes to reach the API");
	const rendersAfterDelete = read("renders");

	await refreshOnFocus();
	assert.equal(read("threads"), "c");
	assert.equal(read("renders"), rendersAfterDelete, "the delete already recorded this list as seen");
});
