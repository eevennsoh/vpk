// Regression: a card print still capturing when the theme changed wrote its old-theme
// canvas into the new theme's cache, so the finale could show light prints in dark
// mode. A capture belongs to the theme it started in.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const HARNESS = `
import { useLayoutEffect } from "react";
import { useFinaleCardPrints } from "@/components/projects/jira-team-eu26-end/finale/hooks/use-finale-prints";

export default function Harness({ appearance, onPrints }) {
	globalThis.__finaleTestAppearance = appearance;
	const prints = useFinaleCardPrints();
	useLayoutEffect(() => onPrints(prints), [onPrints, prints]);
	return (
		<div data-jira-kanban-column="Done">
			<div data-issue-key="TEU-1"><div data-slot="jira-issue-card">Card</div></div>
		</div>
	);
}
`;

const MOCKS = {
	"html-to-image": `
		export const getFontEmbedCSS = async () => "";
		export const toCanvas = () => new Promise((resolve) => {
			globalThis.__finaleTestCaptures.push((label) => {
				const canvas = document.createElement("canvas");
				canvas.dataset.label = label;
				resolve(canvas);
			});
		});
	`,
	"@/components/projects/jira-team-eu26-end/finale/studio/use-finale-appearance": "export const useFinaleAppearance = () => globalThis.__finaleTestAppearance;",
	"@/components/projects/jira-team-eu26-end/finale/lib/finale-column-flash": "export const flashPrintRect = () => null;",
	"@/components/projects/jira-team-eu26-end/finale/lib/capture-done-column": "export const waitForFinaleColumnCapture = async () => ({});",
};

const settle = async () => {
	for (let turn = 0; turn < 20; turn += 1) await new Promise((resolve) => setTimeout(resolve, 0));
};

test("a print captured in the old theme never lands in the new theme's cache", async (t) => {
	globalThis.__finaleTestCaptures = [];
	t.after(() => { delete globalThis.__finaleTestCaptures; delete globalThis.__finaleTestAppearance; });
	const originalFonts = document.fonts;
	document.fonts = { ready: Promise.resolve() };
	t.after(() => { document.fonts = originalFonts; });

	let prints = null;
	const onPrints = (value) => { prints = value; };
	const view = await renderComponent({ source: HARNESS, mocks: MOCKS, props: { appearance: "light", onPrints } });

	// A light capture starts, then the theme turns dark before it finishes.
	const lightRun = prints.ensure(["TEU-1"]);
	await settle();
	assert.equal(globalThis.__finaleTestCaptures.length, 1, "the light capture is under way");
	await view.rerender({ appearance: "dark", onPrints });
	globalThis.__finaleTestCaptures[0]("light");
	await lightRun;
	await settle();
	assert.equal(prints.get("TEU-1")?.dataset.label ?? "none", "none", "the stale light print is discarded");

	// The dark run prints its own copy.
	const darkRun = prints.ensure(["TEU-1"]);
	await settle();
	assert.equal(globalThis.__finaleTestCaptures.length, 2, "the dark theme captures again");
	globalThis.__finaleTestCaptures[1]("dark");
	await darkRun;
	assert.equal(prints.get("TEU-1")?.dataset.label, "dark");
});
