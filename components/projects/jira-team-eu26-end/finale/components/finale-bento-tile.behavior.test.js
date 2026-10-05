// The bento's six tiles, rendered for real: each lands as its face's print
// and hands over to its DOM tile, so the tile must be its whole face from
// the first frame. No piece of it may wait hidden to build in afterwards, or
// the slide shows the card, then an empty tile, then the face again.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

/** The tiles' mono labels, in landing order: Rovo Work Mode over the title, Agent Effectiveness bottom right. */
const LABELS = ["Agent sessions", "Artifacts", "Rovo work mode", "AI Capital management", "Agent effectiveness", "Record for agent"];

const labelsOf = (container) => [...container.querySelectorAll("p.font-mono")].map((label) => label.textContent);

/** Every element the tile hides inline, the way a piece waiting to deal or build in is hidden. */
function hiddenPieces(container) {
	return [...container.querySelectorAll("*")]
		.filter((element) => element.style.opacity === "0" || element.style.visibility === "hidden")
		.map((element) => element.tagName.toLowerCase());
}

async function renderBento(revealStart) {
	return renderComponent({
		source: `
import { FinaleBentoTile } from "@/components/projects/jira-team-eu26-end/finale/components/finale-bento-tile";
import { FinaleTileFace } from "@/components/projects/jira-team-eu26-end/finale/components/finale-tile-face";
import { FINALE_FEATURES, finaleBentoLayout } from "@/components/projects/jira-team-eu26-end/finale/data/finale-stories";
import { ThemeWrapper } from "@/components/utils/theme-wrapper";

const bento = finaleBentoLayout({ width: 1920, height: 1080 }, 1);

export default function Bento({ revealStart }) {
	return (
		<ThemeWrapper>
			{FINALE_FEATURES.map((story, order) => revealStart === undefined
				? <FinaleBentoTile key={story.code} story={story} slot={bento.slots[order]} scale={1} />
				: <FinaleTileFace key={story.code} story={story} slot={bento.slots[order]} scale={1} revealStart={revealStart} />)}
		</ThemeWrapper>
	);
}
`,
		props: { revealStart },
	});
}

test("the bento's six tiles are their whole faces from the start", async () => {
	const view = await renderBento(undefined);
	assert.deepEqual(labelsOf(view.container), LABELS);
	assert.deepEqual(hiddenPieces(view.container), [], "nothing waits to build in");
});

/**
 * Colour utilities that resolve through the product theme: VPK maps even
 * `white` and `black` to ADS text tokens, so in dark mode they turn a white
 * panel near-black. The slide is a fixed brand surface, so its faces must
 * use literal values (`bg-[#FFFFFF]`).
 */
const THEMED_COLOUR = /^(?:[\w-]+:)*(?:bg|text|border|from|via|to|fill|stroke|ring|outline|decoration)-(?:white|black|surface\b|bg-|text\b|icon\b|border-|link\b|primary\b|foreground\b|background\b|muted\b|(?:neutral|gray|blue|purple|green|lime|red|orange|yellow|teal|magenta|sky|amber)-\d)/;

const themedColours = (container) => [...new Set([...container.querySelectorAll("*")].flatMap((element) => [...element.classList].filter((name) => THEMED_COLOUR.test(name))))];

test("the bento's faces are drawn in literal light-mode colours, so dark mode leaves the slide as it is", async () => {
	const view = await renderBento(undefined);
	assert.deepEqual(themedColours(view.container), []);
});

test("a featured story's face never builds, even where a reveal time is given", async () => {
	const view = await renderBento(5);
	assert.deepEqual(labelsOf(view.container), LABELS);
	assert.deepEqual(hiddenPieces(view.container), []);
});
