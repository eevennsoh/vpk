// Behavioral contract for the source ghost, rendered for real in happy-dom.
// Both drag transports keep the source card itself out of `inert` while its
// child UI is blocked: native DnD aborts on an inert source, and the pointer
// transport clears `draggable` during pickup, so the ghost cannot find the
// source by `draggable="true"` alone.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const HARNESS = `
	import { BoardIssueSourceGhost } from "@/components/blocks/jira-kanban/experimental/components/board-issue-source-ghost";

	export default function Harness({ dragging }) {
		return (
			<BoardIssueSourceGhost dragging={dragging} selectionBackdrop="single">
				<article draggable>
					<button type="button">Open PAY-105</button>
					<div data-chin="">Cursor: Working</div>
				</article>
			</BoardIssueSourceGhost>
		);
	}
`;

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));

async function pickUp(transport) {
	const view = await renderComponent({ source: HARNESS, props: { dragging: false } });
	const source = view.container.querySelector("article");
	// The pointer transport sets `source.draggable = false` (reflected as draggable="false")
	// before dispatching its synthetic dragstart.
	if (transport === "pointer") source.setAttribute("draggable", "false");
	await view.rerender({ dragging: true });
	// The ghost waits a frame so Chromium can capture a native drag first.
	await nextFrame();
	await nextFrame();
	const blocked = [...source.children].map((node) => Boolean(node.inert));
	return { blocked, source, view };
}

for (const transport of ["native", "pointer"]) {
	test(`${transport} pickup blocks the source's child UI without making the source inert`, async () => {
		const { blocked, source, view } = await pickUp(transport);
		assert.equal(Boolean(source.inert), false, "an inert source would abort a native drag");
		assert.deepEqual(blocked, [true, true], "every child control is blocked while the card is ghosted");
		assert.equal(view.container.querySelector("[data-issue-source-ghost-content]").getAttribute("aria-hidden"), "true");

		await view.rerender({ dragging: false });
		assert.equal(Boolean(source.inert), false);
		assert.deepEqual([...source.children].map((node) => Boolean(node.inert)), [false, false], "dropping or cancelling restores the child UI");
		assert.equal(view.container.querySelector("[data-issue-source-ghost-content]").hasAttribute("aria-hidden"), false);
	});
}
