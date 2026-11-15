import assert from "node:assert/strict";
import { test } from "node:test";
import { exampleGroupId, toExampleRows } from "./example-groups";

const example = (demoSlug: string, group?: string) => ({ example: { title: demoSlug, demoSlug, group } });

test("toExampleRows inserts one heading per run of a group and none for ungrouped examples", () => {
	const rows = toExampleRows([example("a"), example("b", "Area"), example("c", "Area"), example("d", "Bar")]);
	assert.deepEqual(
		rows.map((row) => (row.kind === "group" ? `#${row.group}` : row.example.demoSlug)),
		["a", "#Area", "b", "c", "#Bar", "d"],
	);
});

test("toExampleRows keeps extra entry fields on example rows", () => {
	const [row] = toExampleRows([{ example: { title: "x", demoSlug: "x" }, Demo: "demo" }]);
	assert.equal(row.kind === "example" ? row.Demo : null, "demo");
});

test("exampleGroupId does not collide with a slugified example title", () => {
	assert.equal(exampleGroupId("Radar Chart"), "radar-chart-examples");
});
