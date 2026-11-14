// List as a consumer renders it: a labelled section with its heading, one <col> per declared
// column, and edge cells that round exactly the outer corners of the card from their row position.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const PROBE = `
import { List } from "@/components/ui-custom/list";

export default function Probe({ rows = 3 }) {
	return (
		<List.Root aria-labelledby="agents-heading" className="host-root">
			<List.Heading id="agents-heading">Agents</List.Heading>
			<List.Table columns={[{}, { className: "w-[92px]" }, { className: "w-[72px]" }]}>
				{Array.from({ length: rows }, (_, index) => (
					<List.Row key={index}>
						<List.Cell data-cell={"r" + index + "-lead"} edge="leading">Agent {index}</List.Cell>
						<List.Cell data-cell={"r" + index + "-mid"}>V1</List.Cell>
						<List.Cell className="host-cell" data-cell={"r" + index + "-trail"} edge="trailing">Edit</List.Cell>
					</List.Row>
				))}
			</List.Table>
		</List.Root>
	);
}
`;

const CORNERS = ["rounded-tl-xl", "rounded-tr-xl", "rounded-bl-xl", "rounded-br-xl"];

function cornersOf(view, cell) {
	const classes = view.container.querySelector(`[data-cell="${cell}"]`).className.split(/\s+/u);
	return CORNERS.filter((corner) => classes.includes(corner)).join(" ");
}

test("List renders a section labelled by its h2 heading", async () => {
	const view = await renderComponent({ source: PROBE });
	const section = view.container.querySelector("[data-slot=list]");
	assert.equal(section.tagName, "SECTION");
	assert.equal(section.getAttribute("aria-labelledby"), "agents-heading");
	assert.equal(section.className.split(/\s+/u).includes("host-root"), true);
	const heading = view.getByRole("heading", { name: "Agents" });
	assert.equal(heading.tagName, "H2");
	assert.equal(heading.id, "agents-heading");
	await view.unmount();
});

test("List.Table renders one col per declared column, carrying its width class", async () => {
	const view = await renderComponent({ source: PROBE });
	const cols = [...view.container.querySelectorAll("colgroup > col")].map((col) => col.className);
	assert.deepEqual(cols, ["", "w-[92px]", "w-[72px]"]);
	assert.equal(view.container.querySelectorAll("tbody > tr").length, 3);
	await view.unmount();
});

test("edge cells round only the card's outer corners, from their row position", async () => {
	const view = await renderComponent({ source: PROBE });
	assert.equal(cornersOf(view, "r0-lead"), "rounded-tl-xl");
	assert.equal(cornersOf(view, "r0-trail"), "rounded-tr-xl");
	assert.equal(cornersOf(view, "r2-lead"), "rounded-bl-xl");
	assert.equal(cornersOf(view, "r2-trail"), "rounded-br-xl");
	for (const cell of ["r0-mid", "r1-lead", "r1-mid", "r1-trail", "r2-mid"]) {
		assert.equal(cornersOf(view, cell), "", `${cell} has no rounded corner`);
	}
	await view.unmount();
});

test("a single-row list rounds both corners on each edge", async () => {
	const view = await renderComponent({ props: { rows: 1 }, source: PROBE });
	assert.equal(cornersOf(view, "r0-lead"), "rounded-tl-xl rounded-bl-xl");
	assert.equal(cornersOf(view, "r0-trail"), "rounded-tr-xl rounded-br-xl");
	assert.equal(cornersOf(view, "r0-mid"), "");
	await view.unmount();
});

test("edge cells keep the card gutter and the host's own classes", async () => {
	const view = await renderComponent({ source: PROBE });
	const classesOf = (cell) => view.container.querySelector(`[data-cell="${cell}"]`).className.split(/\s+/u);
	assert.equal(classesOf("r1-lead").includes("pl-4"), true);
	assert.equal(classesOf("r1-trail").includes("pr-3"), true);
	assert.equal(classesOf("r1-trail").includes("host-cell"), true);
	assert.equal(classesOf("r1-mid").includes("pl-4") || classesOf("r1-mid").includes("pr-3"), false);
	await view.unmount();
});

test("the row highlight is painted per cell from the row's hover group", async () => {
	const view = await renderComponent({ source: PROBE });
	const row = view.container.querySelector("tbody > tr");
	assert.equal(row.className.split(/\s+/u).includes("group/row"), true);
	for (const cell of row.querySelectorAll("td")) {
		assert.equal(cell.className.split(/\s+/u).includes("group-hover/row:bg-bg-neutral-subtle-hovered"), true);
	}
	await view.unmount();
});
