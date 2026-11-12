const assert = require("node:assert/strict");
const test = require("node:test");
const { accessibleName, renderComponent } = require("../../../scripts/lib/render-component.js");

const entry = "app/sandbox/agent-selector-canvas/recommendation-previews.tsx";
const names = ["MarginNotePreview", "EvidenceLedgerPreview", "ScopeMapPreview", "WorkPlanPreview"];
const mocks = {
	"@/components/utils/theme-wrapper": "export const useTheme = () => ({ theme: 'light', actualTheme: 'light', setTheme: () => {} });",
};

for (const exportName of names) {
	test(`${exportName}: original Claude description plus titled recommendation, outside qualification and safe selection`, async () => {
		const view = await renderComponent({ entry, exportName, mocks });
		try {
			const card = view.getByRole("heading", { name: "Claude", exact: true }).closest("article");
			assert.equal(card?.getAttribute("aria-label"), "Claude agent");
			assert.equal(card.dataset.agentId, "claude");
			assert.equal(card.textContent.includes("Anthropic"), true);
			assert.equal(card.querySelector("img")?.getAttribute("src"), "/illustration/agent-lanyard/claude.svg");
			assert.equal(card.querySelectorAll("button, a, input").length, 0);
			const originalDescription = "Collaborate on code with an AI that gives smart suggestions and reviews.";
			const description = view.getByText(originalDescription);
			assert.equal(description.closest("article") === card, true);
			const qualification = view.getByText("Claude’s identity is real. The work item and the strengths listed for Claude are illustrative. No user data, measured performance or real ranking is represented.");
			assert.equal(qualification.closest("article") === null, true);
			assert.equal(qualification.closest("[data-recommendation-concept]") !== null, true);
			assert.equal(card.querySelector("[data-sample-qualification]") === null, true);
			const section = card.querySelector("[data-recommendation-rationale]");
			assert.equal(card.querySelectorAll("[data-recommendation-rationale]").length, 1);
			const title = view.getByRole("heading", { name: "Why recommended", exact: true });
			assert.equal(section?.firstElementChild === title, true);
			assert.equal(section.childElementCount, 2);
			assert.equal(section.querySelectorAll("p").length, 1);
			const paragraph = title.nextElementSibling;
			assert.equal(paragraph?.tagName, "P");
			assert.equal(paragraph.childElementCount, 0, "the recommendation paragraph stays plain text");
			const footer = paragraph.closest("[data-slot=agent-lanyard-appstack]");
			assert.equal(footer?.childElementCount, 1);
			assert.equal(footer?.firstElementChild === section, true, "the footer contains only the title and recommendation paragraph");
			assert.equal(description.nextElementSibling === footer, true, "the original description precedes the additional recommendation section");
			const rationale = paragraph.textContent;
			assert.equal(rationale.includes("Claude"), true, "the explanation itself names the agent, independently of its identity heading");
			assert.equal(rationale.toLowerCase().includes("illustrative"), false);
			assert.equal(rationale.toLowerCase().includes("sample"), false);
			for (const scope of ["keyboard", "focus", "escape"]) {
				assert.equal(card.textContent.toLowerCase().includes(scope), true);
			}
			assert.equal(view.getByRole("heading", { name: "Add keyboard navigation to the agent picker" }).textContent, "Add keyboard navigation to the agent picker");
			const rows = [...view.container.querySelectorAll("button[data-agent-id]")];
			assert.equal(accessibleName(rows[0]), "Claude (Recommended)");
			assert.equal(rows[0].disabled, false);
			await view.click(rows[0]);
			assert.equal(view.getByRole("status").textContent, "Selected Claude · Local preview only");
			assert.equal(view.container.querySelector("[data-preview-selection]")?.textContent, "Selected Claude · Local preview only");
			await view.fill(view.getByRole("textbox", { name: "Search agents" }), "Outline");
			assert.equal(view.queryByRole("button", { name: "Claude (Recommended)" }), null);
			await view.click(view.getByRole("button", { name: "Outline" }));
			assert.equal(view.getByRole("status").textContent, "Selected Outline · Local preview only");
			assert.equal(view.container.querySelector("[data-preview-selection]")?.textContent, "Selected Outline · Local preview only");
			assert.equal(paragraph.textContent, rationale, "local selection leaves the held-open recommendation unchanged");
			assert.equal(description.textContent, originalDescription);
		} finally {
			await view.unmount();
		}
	});
}

test("recommendation concepts keep selection and search independent", async () => {
	const view = await renderComponent({
		source: 'import { MarginNotePreview, EvidenceLedgerPreview } from "@/app/sandbox/agent-selector-canvas/recommendation-previews"; export default function Pair() { return <><MarginNotePreview /><EvidenceLedgerPreview /></>; }',
		mocks,
	});
	try {
		await view.click(view.getAllByRole("button", { name: "Claude (Recommended)" })[0]);
		assert.deepEqual(view.getAllByRole("status").map((element) => element.textContent), ["Selected Claude · Local preview only", ""]);
		await view.fill(view.getAllByRole("textbox", { name: "Search agents" })[0], "Outline");
		assert.equal(view.getAllByRole("button", { name: "Claude (Recommended)" }).length, 1);
	} finally {
		await view.unmount();
	}
});

test("the four recommendation concepts and their picker sections have unique landmark names", async () => {
	const view = await renderComponent({
		source: `import { ${names.join(", ")} } from "@/app/sandbox/agent-selector-canvas/recommendation-previews"; export default function Comparison() { return <>${names.map((name) => `<${name} />`).join("")}</>; }`,
		mocks,
	});
	try {
		const labels = [...view.container.querySelectorAll("section")].map(accessibleName);
		assert.equal(labels.every(Boolean), true);
		assert.equal(new Set(labels).size, labels.length);
		for (const name of ["Margin note", "Evidence ledger", "Scope map", "Work plan"]) {
			assert.equal(labels.includes(`Recommendation lanyard · ${name}`), true);
			assert.equal(labels.includes(`Other sample agents · ${name}`), true);
		}
	} finally {
		await view.unmount();
	}
});

test("all four entries compare different short paragraphs about the same Claude fit", async () => {
	const view = await renderComponent({
		source: `import { ${names.join(", ")} } from "@/app/sandbox/agent-selector-canvas/recommendation-previews"; export default function Comparison() { return <>${names.map((name) => `<${name} />`).join("")}</>; }`,
		mocks,
	});
	try {
		const paragraphs = [...view.container.querySelectorAll("[data-recommendation-rationale] > p")];
		assert.equal(paragraphs.length, names.length);
		assert.equal(new Set(paragraphs.map((paragraph) => paragraph.textContent)).size, names.length);
		for (const paragraph of paragraphs) {
			assert.equal(paragraph.tagName, "P");
			assert.equal(paragraph.childElementCount, 0);
			for (const evidence of ["claude", "keyboard", "focus", "escape"]) {
				assert.equal(paragraph.textContent.toLowerCase().includes(evidence), true);
			}
		}
	} finally {
		await view.unmount();
	}
});

test("the existing canvas retains saved positions and renders all four additions after remount", async () => {
	const registry = await renderComponent({
		source: 'import { previews } from "@/app/sandbox/agent-selector-canvas/previews"; export default function Registry() { return <ul>{previews.map((preview) => <li key={preview.id}>{preview.id}</li>)}</ul>; }',
		mocks,
	});
	let registryIds;
	try {
		registryIds = registry.getAllByRole("listitem").map((item) => item.textContent).sort();
	} finally {
		await registry.unmount();
	}
	const key = "vpk:agent-selector-canvas:v1";
	const previous = localStorage.getItem(key);
	localStorage.setItem(key, JSON.stringify({
		version: 1,
		viewport: { x: 31, y: 72, zoom: 0.75 },
		positions: { "project-butter": { x: 97, y: 123 }, "teammate-sessions-activity": { x: 3010, y: 770 } },
	}));
	try {
		for (let mount = 0; mount < 2; mount += 1) {
			const view = await renderComponent({
				entry: "app/sandbox/agent-selector-canvas/workspace.tsx",
				mocks: { ...mocks, "@/components/utils/theme-wrapper": "export const ThemeSelector = () => null; export const useTheme = () => ({ theme: 'light', actualTheme: 'light', setTheme: () => {} });" },
			});
			try {
				const nodes = [...view.container.querySelectorAll(".react-flow__node")];
				assert.deepEqual(nodes.map((node) => node.dataset.id).sort(), registryIds);
				assert.equal(nodes.find((node) => node.dataset.id === "project-butter")?.style.transform, "translate(97px,123px)");
				assert.equal(nodes.find((node) => node.dataset.id === "teammate-sessions-activity")?.style.transform, "translate(3010px,770px)");
				for (const name of ["Margin note", "Evidence ledger", "Scope map", "Work plan"]) {
					assert.equal(view.getByRole("button", { name: `Recommendation lanyard · ${name}`, exact: true }).textContent, `Recommendation lanyard · ${name}`);
				}
				if (mount === 0) {
					await view.press(view.getByRole("button", { name: "Move Recommendation lanyard · Margin note", exact: true }), "ArrowRight");
					await new Promise((resolve) => requestAnimationFrame(resolve));
					assert.deepEqual(JSON.parse(localStorage.getItem(key)).positions["recommendation-margin-note"], { x: 10, y: 1400 });
				} else {
					assert.equal(nodes.find((node) => node.dataset.id === "recommendation-margin-note")?.style.transform, "translate(10px,1400px)");
				}
			} finally {
				await view.unmount();
			}
		}
	} finally {
		if (previous === null) localStorage.removeItem(key);
		else localStorage.setItem(key, previous);
	}
});
