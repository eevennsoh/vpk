// Assertions compare strings and booleans, never elements (scripts/lib/render-component.js).
const assert = require("node:assert/strict");
const test = require("node:test");
const React = require("react");
const { renderComponent } = require("../../../../scripts/lib/render-component.js");

// The thread API is replaced so the hook loads three threads and deletes succeed.
const API_MOCK = `
	export const deletedThreadIds = [];
	export async function listRovoAppThreads() {
		return [{ id: "a", title: "A" }, { id: "b", title: "B" }, { id: "c", title: "C" }];
	}
	export async function deleteRovoAppThread(threadId) {
		deletedThreadIds.push(threadId);
	}
`;

const PROBE = `import { useRovoAppThreadListCore } from "@/components/projects/rovo-core/hooks/use-rovo-app-thread-list";
	import { deletedThreadIds } from "@/components/projects/rovo-core/lib/api";
	export default function Probe({ dedupeRefreshResults }) {
		const { deleteThread, threads, threadsLoaded } = useRovoAppThreadListCore({ dedupeRefreshResults });
		return <div>
			<p data-probe="loaded">{threadsLoaded ? "yes" : "no"}</p>
			<p data-probe="threads">{threads.map((thread) => thread.id).join(",")}</p>
			<p data-probe="deleted">{deletedThreadIds.join(",")}</p>
			<button type="button" onClick={() => { void deleteThread("a"); void deleteThread("b"); }}>delete a and b</button>
		</div>;
	}`;

const settle = () => React.act(() => new Promise((resolve) => setTimeout(resolve, 20)));
const read = (name) => document.querySelector(`[data-probe="${name}"]`).textContent;

for (const dedupeRefreshResults of [false, true]) {
	test(`back-to-back deletes both stick (dedupe ${dedupeRefreshResults ? "on" : "off"})`, async () => {
		const view = await renderComponent({
			mocks: { "@/components/projects/rovo-core/lib/api": API_MOCK },
			props: { dedupeRefreshResults },
			source: PROBE,
		});
		await settle();
		assert.equal(read("loaded"), "yes");
		assert.equal(read("threads"), "a,b,c");

		// Two deletes in one handler: the second must filter the first's optimistic result,
		// not the list captured by the render, or "a" comes back.
		await view.click(view.getByRole("button", { name: "delete a and b" }));
		await settle();
		assert.equal(read("threads"), "c");
		assert.equal(read("deleted"), "a,b");
	});
}
