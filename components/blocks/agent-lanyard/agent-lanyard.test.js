const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { buildSync } = require("esbuild");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { parseHTML } = require("linkedom");
const { loadCjsModuleFromText } = require("../../../scripts/lib/esbuild-cjs-loader.js");
const { renderComponent } = require("../../../scripts/lib/render-component.js");

const entry = path.join(__dirname, "index.ts");
const { outputFiles } = buildSync({
	stdin: {
		contents: `export * from ${JSON.stringify(entry)}; export { ThemeWrapper } from "@/components/utils/theme-wrapper";`,
		resolveDir: process.cwd(), loader: "ts",
	},
	bundle: true, platform: "node", format: "cjs",
	external: ["react", "react-dom", "react-dom/*", "next/*", "motion/*"],
	loader: { ".css": "empty" }, jsx: "automatic", write: false,
});
const {
	AgentLanyard, AGENT_LANYARD_AGENTS, AGENT_LANYARD_TEMPLATES, ThemeWrapper,
	AgentLanyardFirstParty, AGENT_LANYARD_CUSTOM_AGENTS, AGENT_LANYARD_FIRST_PARTY_AGENTS,
	AGENT_LANYARD_COLLECTIONS, createCustomFirstPartyAgent,
} = loadCjsModuleFromText(outputFiles[0].text, entry);

test("custom 1P agents retain author identity and the exact five Figma collection colors", () => {
	assert.deepEqual(Object.values(AGENT_LANYARD_COLLECTIONS).map((collection) => collection.color), ["#1868DB", "#94C748", "#C97CF4", "#FFC716", "#FB9700"]);
	for (const collection of Object.keys(AGENT_LANYARD_COLLECTIONS)) {
		const sources = [{ id: "jira", label: "Jira", provider: "jira" }];
		const agent = createCustomFirstPartyAgent({ id: "mine", name: "My agent", description: "My own description", publisher: "My team", collection, sources });
		assert.equal(agent.name, "My agent");
		assert.equal(agent.publisher, "My team");
		assert.equal(agent.description, "My own description");
		assert.equal(agent.sources, sources);
		assert.equal(agent.verified, false);
		assert.equal(agent.accentColor, AGENT_LANYARD_COLLECTIONS[collection].color);
	}
});

test("1P variants retain a static grid by default and the shared card and app stack", () => {
	for (const agent of [...AGENT_LANYARD_CUSTOM_AGENTS, ...AGENT_LANYARD_FIRST_PARTY_AGENTS]) {
		const html = renderToStaticMarkup(React.createElement(ThemeWrapper, null, React.createElement(AgentLanyardFirstParty, { agent })));
		const card = parseHTML(html).document;
		assert.equal(card.querySelector("h3").textContent, agent.name);
		assert.equal(card.querySelector("article").getAttribute("aria-label"), `${agent.name} agent`);
		const badgeImages = card.querySelectorAll('[data-slot="agent-lanyard-avatar"] img');
		assert.equal(badgeImages.length, 1);
		assert.equal(badgeImages[0].getAttribute("src"), agent.badge.glyphSrc);
		assert.equal(card.querySelector('[data-slot="agent-lanyard-avatar"] > span').style.backgroundColor, agent.accentColor);
		assert.ok(card.querySelector('[data-slot="agent-lanyard-grid"]'));
		assert.equal(card.querySelector('[data-slot="agent-lanyard-grid"]').getAttribute("data-animated"), "false");
		assert.equal(card.querySelectorAll("button").length, 0);
		assert.ok(card.querySelector('[data-slot="agent-lanyard-appstack"]'));
		for (const source of agent.sources) assert.ok(card.querySelector(`[aria-label="${source.label}"]`));
	}
});

test("1P grid animation settings never hide the backdrop or change the footer", () => {
	const agent = AGENT_LANYARD_CUSTOM_AGENTS[0];
	for (const animateGrid of [true, false]) {
		const html = renderToStaticMarkup(React.createElement(ThemeWrapper, null, React.createElement(AgentLanyardFirstParty, { agent, animateGrid })));
		const card = parseHTML(html).document;
		assert.ok(card.querySelector('[data-slot="agent-lanyard-grid"]'));
		assert.ok(card.querySelector('[data-slot="agent-lanyard-appstack"]'));
		assert.equal(card.querySelectorAll("button").length, 0);
	}
});

function renderCard(agent, capabilities = {}) {
	const html = renderToStaticMarkup(React.createElement(AgentLanyard, { agent, ...capabilities }));
	return parseHTML(html).document;
}

// Brand logos load their module on first render (C-8g), so the card is rendered and given the
// renders that module needs; static markup would stop at the logo's placeholder box.
test("brand-backed lanyards render through the shared agent visual", async () => {
	const agent = { id: "figma", name: "Figma", publisher: "Figma", description: "Design agent", brandName: "figma", action: "chat" };
	const view = await renderComponent({ entry: "components/blocks/agent-lanyard/index.ts", exportName: "AgentLanyard", props: { agent } });
	try {
		for (let attempt = 0; attempt < 5; attempt += 1) await view.rerender({ agent });
		const card = view.container;
		assert.equal(card.querySelector("h3").textContent, "Figma");
		assert.ok(card.querySelector('[data-slot="avatar"][data-shape="hexagon"] svg'));
		assert.equal(card.querySelectorAll("img").length, 0);
	} finally {
		await view.unmount();
	}
});

test("the lanyard cutout paints its recessed shadow separately from the rim and fill", () => {
	const card = renderCard(AGENT_LANYARD_AGENTS[0]);
	const cutout = card.querySelector('[data-slot="agent-lanyard-cutout"]');
	const shadow = cutout.querySelector('[data-slot="agent-lanyard-cutout-shadow"]');
	assert.ok(shadow, "The shadow needs a full-rim layer instead of being inset inside the border");
	assert.equal(cutout.children.length, 2, "White fill and recessed shading have separate paint layers");
	assert.equal(cutout.style.boxShadow, "");
	assert.equal(shadow.style.boxShadow.match(/inset/gu).length, 3, "Fractional rim and both recess shadows are painted together");
	assert.equal(cutout.parentElement.getAttribute("aria-hidden"), "true");
});

test("template variant retains its artwork, copy, and app sources without agent controls", () => {
	for (const template of AGENT_LANYARD_TEMPLATES) {
		const html = renderToStaticMarkup(React.createElement(ThemeWrapper, null, React.createElement(AgentLanyard, { variant: "template", template })));
		const card = parseHTML(html).document;
		assert.equal(card.querySelector("h3").textContent, template.name);
		assert.ok(card.querySelector("article").textContent.includes("Template"));
		assert.ok(card.querySelector("article").textContent.includes(template.description));
		assert.equal(card.querySelector("article").getAttribute("aria-label"), `${template.name} template`);
		assert.equal(card.querySelector("article").getAttribute("data-grid-animation"), "false");
		assert.equal(card.querySelector('[data-slot="agent-lanyard-grid"]'), null);
		assert.equal(card.querySelectorAll("button").length, 0);
		assert.equal(card.querySelector('[aria-label="Verified by your org"]'), null);
		const images = card.querySelectorAll('[data-slot="agent-lanyard-template-avatar"] img');
		assert.equal(images.length, 2);
		assert.equal(images[1].getAttribute("src"), template.iconSrc);
		assert.equal(card.querySelector('[data-slot="agent-lanyard-appstack"]').getAttribute("aria-label"), `Connected apps: ${template.sources.map((source) => source.label).join(", ")}`);
		for (const source of template.sources) {
			assert.ok(card.querySelector(`[aria-label="${source.label}"]`), `${source.label} app icon`);
		}
	}
});

test("reference templates show their matching monochrome artwork", () => {
	const expectedIcons = {
		"Decision Director": "decision.svg",
		"Weekly summary": "weekly-summary.svg",
		"Pipeline planner": "pipeline-planner.svg",
		"Script writer": "script-writer.svg",
	};
	for (const template of AGENT_LANYARD_TEMPLATES) {
		const html = renderToStaticMarkup(React.createElement(ThemeWrapper, null, React.createElement(AgentLanyard, { variant: "template", template })));
		const card = parseHTML(html).document;
		const images = card.querySelectorAll('[data-slot="agent-lanyard-template-avatar"] img');
		assert.equal(images[1].getAttribute("src"), `/illustration/agent-lanyard-template/${expectedIcons[template.name]}`);
	}
});

test("chat and connect affordances require their own capabilities", () => {
	for (const agent of AGENT_LANYARD_AGENTS) {
		const displayOnly = renderCard(agent);
		assert.equal(displayOnly.querySelectorAll("button[disabled]").length, 2);
		const actionOnly = renderCard(agent, { onAction: () => {} });
		const buttons = actionOnly.querySelectorAll("button");
		assert.equal(buttons[0].hasAttribute("disabled"), false);
		assert.equal(buttons[1].hasAttribute("disabled"), true);
		const fullyInteractive = renderCard(agent, { onAction: () => {}, onMoreActions: () => {} });
		assert.equal(fullyInteractive.querySelectorAll("button[disabled]").length, 0);
		assert.equal(fullyInteractive.querySelectorAll("button button").length, 0);
	}
});

test("every agent retains its visible identity, description, and accessible actions", () => {
	for (const agent of AGENT_LANYARD_AGENTS) {
		const card = renderCard(agent);
		assert.equal(card.querySelector("h3").textContent, agent.name);
		assert.ok(card.querySelector("article").textContent.includes(agent.publisher));
		assert.ok(card.querySelector("article").textContent.includes(agent.description));
		assert.equal(card.querySelector("article").getAttribute("aria-label"), `${agent.name} agent`);
		assert.equal(card.querySelector("img").getAttribute("src"), agent.avatarSrc);
		assert.ok(card.querySelector('[aria-label="Verified by your org"]'));
		assert.equal(card.querySelectorAll("button[aria-label]").length, 2);
	}
});

test("unverified agents omit verification and the server starts with a static grid", () => {
	const card = renderCard({ ...AGENT_LANYARD_AGENTS[0], verified: false });
	assert.equal(card.querySelector('[aria-label="Verified by your org"]'), null);
	assert.equal(card.querySelector('[data-slot="agent-lanyard-grid"]').getAttribute("data-animated"), "false");
	assert.equal(card.querySelector("article").getAttribute("data-perspective-tilt"), "false");
});

test("built-in menu requires at least one action and retains a single accessible trigger", () => {
	const agent = AGENT_LANYARD_AGENTS[0];
	const withoutActions = renderCard(agent, { menuActions: {} });
	const disabledTrigger = withoutActions.querySelector('[aria-label="More actions for Claude"]');
	assert.equal(disabledTrigger.hasAttribute("disabled"), true);
	for (const action of ["onViewProfile", "onToggleStar", "onCopyLink", "onDuplicate"]) {
		const card = renderCard(agent, { menuActions: { [action]: () => {} } });
		const triggers = card.querySelectorAll('[aria-label="More actions for Claude"]');
		assert.equal(triggers.length, 1);
		assert.equal(triggers[0].hasAttribute("disabled"), false);
		assert.equal(triggers[0].getAttribute("aria-haspopup"), "menu");
		assert.equal(card.querySelectorAll("button button").length, 0);
	}
});

test("recommended variant requires a non-empty caller reason", () => {
	for (const recommendationReason of [undefined, "", "   "]) {
		assert.throws(() => renderCard(AGENT_LANYARD_AGENTS[0], { variant: "recommended", recommendationReason }), /non-empty recommendationReason/u);
	}
});

test("ordinary footer null hides actions while other falsy values retain the default actions", () => {
	const agent = AGENT_LANYARD_AGENTS[0];
	for (const footer of [undefined, false, "", 0, NaN]) {
		const card = renderCard(agent, { footer });
		assert.equal(card.querySelector('[aria-label="Chat with Claude"]') !== null, true);
		assert.equal(card.querySelector('[data-slot="agent-lanyard-appstack"]') === null, true);
	}
	const hidden = renderCard(agent, { footer: null });
	assert.equal(hidden.querySelectorAll("button").length, 0);
	assert.equal(hidden.querySelector('[data-slot="agent-lanyard-appstack"]') === null, true);
	const custom = renderCard(agent, { footer: "Connected apps" });
	assert.equal(custom.querySelector('[data-slot="agent-lanyard-appstack"]').textContent, "Connected apps");
	assert.equal(custom.querySelectorAll("button").length, 0);
});

test("recommended notches start outside the surface before layout measurement", () => {
	const card = renderCard(AGENT_LANYARD_AGENTS[0], { variant: "recommended", recommendationReason: "Caller-owned reason." });
	const surface = card.querySelector('[data-slot="agent-lanyard-surface"]');
	assert.equal(surface.style.maskImage.includes("var(--recommendation-seam-y, -20px)"), true);
	assert.equal(surface.style.getPropertyValue("--recommendation-seam-y"), "");
	assert.equal(surface.querySelectorAll('[data-slot="agent-lanyard-tear-line"]').length, 1);
});

test("public recommended variant retains identity and description, updates caller copy and omits all actions", async () => {
	const agent = AGENT_LANYARD_AGENTS[0];
	const props = { agent, variant: "recommended", recommendationReason: "Illustrative reason supplied by the caller.", onSelect: () => {}, onAction: () => {}, menuActions: { onViewProfile: () => {} }, footer: "Unwanted footer" };
	const view = await renderComponent({ entry: "components/blocks/agent-lanyard/index.ts", exportName: "AgentLanyard", props });
	try {
		const card = view.container.querySelector('article[data-variant="recommended"]');
		assert.equal(card.getAttribute("aria-label"), "Claude recommended");
		assert.equal(view.getByText(agent.description).textContent, agent.description);
		const title = view.getByRole("heading", { name: "Why recommended", level: 4 });
		assert.equal(title.nextElementSibling.textContent, props.recommendationReason);
		assert.equal(title.parentElement.childElementCount, 2);
		assert.equal(card.querySelectorAll("button, a, input, [tabindex]").length, 0);
		assert.equal(card.textContent.includes("Unwanted footer"), false);
		assert.equal(card.querySelector('[data-slot="agent-lanyard-appstack"]') === null, true);
		assert.equal(card.querySelectorAll('[data-slot="agent-lanyard-surface"]').length, 1);
		await view.rerender({ ...props, headingLevel: 2, recommendationReason: "Another caller-owned reason." });
		assert.equal(view.getByRole("heading", { name: "Claude" }).tagName, "H2");
		assert.equal(view.getByRole("heading", { name: "Why recommended" }).tagName, "H3");
		assert.equal(view.getByText("Another caller-owned reason.").textContent, "Another caller-owned reason.");
	} finally { await view.unmount(); }
});

test("recommended variant preserves the static grid and respects reduced motion and animation opt-outs", async () => {
	for (const reducedMotion of [false, true]) {
		const props = { variant: "recommended", agent: AGENT_LANYARD_AGENTS[0], recommendationReason: "Illustrative demo reason.", perspectiveTilt: true, animateGrid: true, gridAnimationTrigger: "reveal" };
		const view = await renderComponent({
			entry: "components/blocks/agent-lanyard/index.ts", exportName: "AgentLanyard", props,
			mocks: { "@/hooks/use-media-query": `export const useMediaQuery = () => ${reducedMotion};` },
		});
		try {
			const card = view.container.querySelector('article[data-variant="recommended"]');
			assert.equal(card.dataset.perspectiveTilt, String(!reducedMotion));
			assert.equal(card.querySelector('[data-slot="agent-lanyard-grid"]').dataset.animated, String(!reducedMotion));
			await view.rerender({ ...props, perspectiveTilt: false, animateGrid: false });
			assert.equal(card.dataset.perspectiveTilt, "false");
			assert.equal(card.querySelector('[data-slot="agent-lanyard-grid"]').dataset.animated, "false");
			await view.rerender({ ...props, showGrid: false });
			assert.equal(card.querySelector('[data-slot="agent-lanyard-grid"]') === null, true);
		} finally { await view.unmount(); }
	}
});

test("catalog pairs the illustrative recommended card with the existing actionable examples", async () => {
	const view = await renderComponent({ entry: "components/blocks/agent-lanyard/page.tsx" });
	try {
		assert.equal(view.container.querySelector('article[data-variant="recommended"]').querySelectorAll("button").length, 0);
		assert.equal(view.container.querySelector('article[data-agent-id="claude"][data-variant="agent"]').querySelectorAll("button").length > 0, true);
		assert.equal(view.getByText(/Illustrative demo reason based on the catalog description/u).textContent.includes("No personalized evidence"), true);
	} finally { await view.unmount(); }
});

test("recommended hover content preserves the shaped card shadow while ordinary popups use overlay elevation", async () => {
	const view = await renderComponent({
		entry: "components/blocks/agent-lanyard/index.ts", exportName: "AgentLanyardHoverContent", props: { variant: "recommended" },
		mocks: { "@/components/ui/hover-card": 'export function HoverCardContent({style}) { return <div data-popup style={style} />; }' },
	});
	try {
		assert.equal(view.container.querySelector("[data-popup]").style.boxShadow, "none");
		await view.rerender({});
		assert.equal(view.container.querySelector("[data-popup]").style.boxShadow.includes("--ds-shadow-overlay"), true);
	} finally { await view.unmount(); }
});
