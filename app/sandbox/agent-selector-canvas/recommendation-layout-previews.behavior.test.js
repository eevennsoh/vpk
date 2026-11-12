const assert = require("node:assert/strict");
const test = require("node:test");
const { accessibleName, renderComponent } = require("../../../scripts/lib/render-component.js");

const entry = "app/sandbox/agent-selector-canvas/recommendation-layout-previews.tsx";
const names = ["InsetDividerLayoutPreview", "InsetPanelLayoutPreview", "FullWidthFooterLayoutPreview", "PerforatedSeamLayoutPreview"];
const paragraph = "Claude can help add keyboard navigation, visible focus and Escape to close.";
const description = "Collaborate on code with an AI that gives smart suggestions and reviews.";
const mocks = {
	"@/components/utils/theme-wrapper": "export const ThemeSelector = () => null; export const useTheme = () => ({ theme: 'light', actualTheme: 'light', setTheme: () => {} });",
};

for (const exportName of names) {
	test(`${exportName}: original Claude description, identical titled paragraph and safe local picker`, async () => {
		const view = await renderComponent({ entry, exportName, mocks });
		try {
			const identity = view.getByRole("heading", { name: "Claude", exact: true }).closest("article");
			const card = identity.closest("[data-recommendation-lanyard]") ?? identity;
			assert.equal(identity?.dataset.agentId, "claude");
			assert.equal(card.querySelector("img")?.getAttribute("src"), "/illustration/agent-lanyard/claude.svg");
			assert.equal(card.querySelectorAll("button, a, input").length, 0);
			const originalDescription = view.getByText(description);
			const title = view.getByRole("heading", { name: "Why recommended", exact: true });
			const explanation = title.parentElement;
			assert.equal(explanation.childElementCount, 2);
			assert.equal(title.nextElementSibling?.tagName, "P");
			assert.equal(title.nextElementSibling?.textContent, paragraph);
			assert.equal(title.nextElementSibling?.childElementCount, 0);
			assert.equal(explanation.querySelectorAll("ul, ol, table").length, 0);
			assert.equal(card.contains(title), true);
			assert.equal(Boolean(originalDescription.compareDocumentPosition(title) & 4), true);
			const qualification = view.getByText("Claude’s identity is real. The work item and the strengths listed for Claude are illustrative. No user data, measured performance or real ranking is represented.");
			assert.equal(qualification.closest("article") === null, true);
			assert.equal(qualification.closest("[data-recommendation-layout-preview]") !== null, true);

			const firstRow = view.container.querySelector("button[data-agent-id]");
			assert.equal(accessibleName(firstRow), "Claude (Recommended)");
			await view.click(firstRow);
			assert.equal(view.getByRole("status").textContent, "Selected Claude · Local preview only");
			assert.equal(view.container.querySelector("[data-preview-selection]")?.textContent, "Selected Claude · Local preview only");
			await view.fill(view.getByRole("textbox", { name: "Search agents" }), "Outline");
			await view.click(view.getByRole("button", { name: "Outline", exact: true }));
			assert.equal(view.getByRole("status").textContent, "Selected Outline · Local preview only");
			assert.equal(originalDescription.textContent, description);
			assert.equal(title.nextElementSibling?.textContent, paragraph);
		} finally {
			await view.unmount();
		}
	});
}

test("new layouts use equal content, unique landmarks and independent picker state", async () => {
	const view = await renderComponent({
		source: `import { ${names.join(", ")} } from "@/app/sandbox/agent-selector-canvas/recommendation-layout-previews"; export default function Comparison() { return <>${names.map((name) => `<${name} />`).join("")}</>; }`,
		mocks,
	});
	try {
		const labels = [...view.container.querySelectorAll("section")].map(accessibleName);
		assert.equal(labels.every(Boolean), true);
		assert.equal(new Set(labels).size, labels.length);
		assert.equal(view.getAllByRole("heading", { name: "Why recommended", exact: true }).length, names.length);
		assert.deepEqual([...view.container.querySelectorAll('[data-recommendation-layout] > p, [data-slot="agent-lanyard-recommendation"] > p')].map((element) => element.textContent), names.map(() => paragraph));
		assert.equal([...view.container.querySelectorAll("article p")].filter((element) => element.textContent === description).length, names.length);
		await view.click(view.getAllByRole("button", { name: "Claude (Recommended)" })[0]);
		assert.deepEqual(view.getAllByRole("status").map((element) => element.textContent), names.map((_, index) => index === 0 ? "Selected Claude · Local preview only" : ""));
		await view.fill(view.getAllByRole("textbox", { name: "Search agents" })[0], "Outline");
		assert.equal(view.getAllByRole("button", { name: "Claude (Recommended)" }).length, names.length - 1);
	} finally {
		await view.unmount();
	}
});

test("perforated seam uses one continuous surface with smaller transparent notches and a single dashed rule", async () => {
	const view = await renderComponent({ entry, exportName: "PerforatedSeamLayoutPreview", mocks });
	try {
		const top = view.container.querySelector('[data-slot="agent-lanyard-recommended-identity"]');
		const bottom = view.container.querySelector('[data-slot="agent-lanyard-recommendation-section"]');
		const surface = view.container.querySelector('[data-slot="agent-lanyard-surface"]');
		assert.equal(top.nextElementSibling === bottom, true);
		assert.equal(top.parentElement === surface && bottom.parentElement === surface, true);
		assert.equal(surface.style.getPropertyValue("--recommendation-notch-radius"), "5px");
		assert.equal(surface.style.maskComposite, "intersect");
		assert.equal(surface.style.maskImage.includes("transparent"), true);
		for (const half of [top, bottom]) {
			assert.equal(half.style.maskImage, "", "no separate rasterized edge at the join");
		}
		assert.equal(surface.querySelectorAll('[data-slot="agent-lanyard-tear-line"]').length, 1);
		const line = view.container.querySelector('[data-slot="agent-lanyard-tear-line"]');
		assert.equal(line.style.maskImage.startsWith("repeating-linear-gradient("), true);
		assert.equal(line.style.insetInline, "calc(var(--recommendation-notch-radius) - 2px)");
		assert.equal(line.getAttribute("aria-hidden"), "true");
	} finally {
		await view.unmount();
	}
});

test("notches track the description height in unscaled CSS pixels and stop observing on unmount", async () => {
	const previousObserver = globalThis.ResizeObserver;
	let notify;
	let observed;
	let disconnected = false;
	globalThis.ResizeObserver = class {
		constructor(callback) { notify = callback; }
		observe(target) { observed = target; }
		disconnect() { disconnected = true; }
	};
	let view;
	try {
		view = await renderComponent({ source: 'import { AgentLanyard } from "@/components/blocks/agent-lanyard"; import { recommendationSample, recommendationParagraphs } from "@/app/sandbox/agent-selector-canvas/recommendation-data"; export default function Fixture() { return <AgentLanyard variant="recommended" agent={recommendationSample.agent} recommendationReason={recommendationParagraphs["margin-note"]} perspectiveTilt={false} animateGrid={false} />; }', mocks });
		const surface = view.container.querySelector('[data-slot="agent-lanyard-surface"]');
		const top = view.container.querySelector('[data-slot="agent-lanyard-recommended-identity"]');
		assert.equal(observed === top, true);
		for (const height of [248, 264.375, 280.5]) {
			notify([{ target: top, borderBoxSize: [{ blockSize: height, inlineSize: 252 }] }]);
			assert.equal(surface.style.getPropertyValue("--recommendation-seam-y"), `calc(${height}px + 0.5px)`);
		}
		assert.equal(view.getByText(description).textContent, description);
		assert.equal(view.getByText(paragraph).textContent, paragraph);
	} finally {
		try { await view?.unmount(); }
		finally { globalThis.ResizeObserver = previousObserver; }
	}
	assert.equal(disconnected, true);
});

const oldEntries = [
	["project-butter", "Agent selector · Project butter", 0, 0, 320],
	["project-butter-existing-session", "Agent selector · Project butter · Existing session", 680, 0, 320],
	["project-butter-favorites", "Agent selector · Project butter · Favorites", 1360, 0, 320],
	["destination-remember", "Run destination · Remember per agent", 2040, 0, 320],
	["destination-global", "Run destination · Picker default", 2480, 0, 320],
	["destination-row-actions", "Run destination · Row actions", 2920, 0, 320],
	["destination-inline", "Run destination · Inline expansion", 3360, 0, 320],
	["destination-after-select", "Run destination · After selection", 3800, 0, 320],
	["teammate-sessions-quiet", "Teammate sessions · Quiet disclosure", 2040, 680, 280],
	["teammate-sessions-people", "Teammate sessions · People fold", 2480, 680, 280],
	["teammate-sessions-activity", "Teammate sessions · Activity digest", 2920, 680, 280],
	["recommendation-margin-note", "Recommendation lanyard · Margin note", 0, 1400, 588],
	["recommendation-evidence-ledger", "Recommendation lanyard · Evidence ledger", 680, 1400, 588],
	["recommendation-scope-map", "Recommendation lanyard · Scope map", 1360, 1400, 588],
	["recommendation-work-plan", "Recommendation lanyard · Work plan", 2040, 1400, 588],
	["recommendation-layout-stack", "Recommendation layout · Inset divider", 0, 2100, 588],
	["recommendation-layout-inset", "Recommendation layout · Inset panel", 680, 2100, 588],
	["recommendation-layout-footer", "Recommendation layout · Full-width footer", 1360, 2100, 588],
];

test("all old registry entries stay intact and the new row joins a saved layout without losing positions", async () => {
	const registry = await renderComponent({
		source: 'import { previews } from "@/app/sandbox/agent-selector-canvas/previews"; export default function Registry() { return <ul>{previews.map((item) => <li key={item.id} data-preview-id={item.id} data-x={item.position.x} data-y={item.position.y} data-width={item.width}>{item.name}</li>)}</ul>; }',
		mocks,
	});
	try {
		for (const [id, name, x, y, width] of oldEntries) {
			const item = registry.container.querySelector(`[data-preview-id="${id}"]`);
			assert.deepEqual([item?.textContent, item?.dataset.x, item?.dataset.y, item?.dataset.width], [name, String(x), String(y), String(width)]);
		}
		const perforated = registry.container.querySelector('[data-preview-id="recommendation-layout-perforated"]');
		assert.deepEqual([perforated?.textContent, perforated?.dataset.x, perforated?.dataset.y, perforated?.dataset.width], ["Recommendation layout · Perforated seam", "2040", "2100", "588"]);
	} finally {
		await registry.unmount();
	}

	const key = "vpk:agent-selector-canvas:v1";
	const previous = localStorage.getItem(key);
	const positions = Object.fromEntries(oldEntries.map(([id, , x, y]) => [id, { x, y }]));
	positions["project-butter"] = { x: 97, y: 123 };
	localStorage.setItem(key, JSON.stringify({ version: 1, viewport: { x: 31, y: 72, zoom: 0.75 }, positions }));
	try {
		for (let mount = 0; mount < 2; mount += 1) {
			const view = await renderComponent({ entry: "app/sandbox/agent-selector-canvas/workspace.tsx", mocks });
			try {
				assert.equal(view.container.querySelector('[data-id="project-butter"]')?.style.transform, "translate(97px,123px)");
				for (const name of ["Inset divider", "Inset panel", "Full-width footer", "Perforated seam"]) {
					assert.equal(view.getByRole("button", { name: `Recommendation layout · ${name}`, exact: true }).textContent, `Recommendation layout · ${name}`);
				}
				assert.equal(view.container.querySelector('[data-id="recommendation-layout-perforated"]')?.style.transform, "translate(2040px,2100px)");
				if (mount === 0) {
					await view.press(view.getByRole("button", { name: "Move Recommendation layout · Inset panel", exact: true }), "ArrowRight");
					await new Promise((resolve) => requestAnimationFrame(resolve));
					assert.deepEqual(JSON.parse(localStorage.getItem(key)).positions["recommendation-layout-inset"], { x: 690, y: 2100 });
				} else {
					assert.equal(view.container.querySelector('[data-id="recommendation-layout-inset"]')?.style.transform, "translate(690px,2100px)");
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
