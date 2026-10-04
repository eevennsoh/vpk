const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { buildSync } = require("esbuild");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { parseHTML } = require("linkedom");
const { loadCjsModuleFromText } = require("../../../scripts/lib/esbuild-cjs-loader.js");

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
		const badgeImages = card.querySelectorAll('[data-slot="agent-lanyard-first-party-avatar"] img');
		assert.equal(badgeImages.length, 1, "The shared Avatar owns the hexagon, so only the logo glyph is an image");
		assert.equal(badgeImages[0].getAttribute("src"), agent.badge.glyphSrc);
		assert.ok(card.querySelector('[data-slot="agent-lanyard-first-party-avatar"] [data-slot="avatar"][data-shape="hexagon"]'));
		assert.equal(card.querySelector('[data-slot="agent-lanyard-first-party-avatar"] [data-slot="avatar-hexagon-artwork"] > span').style.backgroundColor, agent.accentColor);
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

test("brand-backed lanyards render through the shared agent visual", () => {
	const card = renderCard({ id: "figma", name: "Figma", publisher: "Figma", description: "Design agent", brandName: "figma", action: "chat" });
	assert.equal(card.querySelector("h3").textContent, "Figma");
	assert.ok(card.querySelector('[data-slot="avatar"][data-shape="hexagon"] svg'));
	assert.equal(card.querySelectorAll("img").length, 0);
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
