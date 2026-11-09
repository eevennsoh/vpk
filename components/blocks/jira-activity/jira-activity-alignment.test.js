const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");
const { renderComponent } = require("../../../scripts/lib/render-component.js");

const INDEX_SOURCE = readFileSync(join(__dirname, "index.tsx"), "utf8");
const NODE_SOURCE = readFileSync(join(__dirname, "jira-activity-node.tsx"), "utf8");
const CARD_SOURCE = readFileSync(join(__dirname, "jira-activity-card.tsx"), "utf8");
const COMMENT_SOURCE = readFileSync(join(__dirname, "jira-activity-comment.tsx"), "utf8");
const CHANGED_FILES_SOURCE = readFileSync(join(__dirname, "jira-activity-changed-files.tsx"), "utf8");
const AGENT_LIST_CARD_SOURCE = readFileSync(
	join(__dirname, "../agent-list/agent-list-card.tsx"),
	"utf8",
);

function renderNestedComments() {
	const actor = { id: "author", kind: "person", name: "Parent author" };
	const reply = { id: "reply", actor: { ...actor, id: "responder", name: "Reply author" }, timestamp: "30m", body: "Reply body" };
	return renderComponent({
		entry: "components/blocks/jira-activity/index.tsx",
		exportName: "JiraActivity",
		props: {
			composer: null,
			currentUser: actor,
			hideHeader: true,
			entries: [
				{ id: "parent", kind: "comment", actor, timestamp: "1h", body: [{ type: "text", text: "Parent body" }], replies: [reply] },
				{ id: "nested", parentId: "parent", kind: "comment", actor: { ...actor, id: "reviewer", name: "Review author" }, timestamp: "45m", body: [{ type: "text", text: "Review body" }], replies: [{ ...reply, id: "nested-reply" }] },
			],
		},
	});
}

test("compact activity labels share the timeline node's 24px alignment track", () => {
	// Card avatars use h-10 (4px clearance around size-8); event glyphs stay on
	// h-6. Event copy uses min-h-6 + leading-5 + py-0.5 so h-5 mention chips are not clipped.
	assert.match(NODE_SOURCE, /isCard \? "h-10" : "h-6"/u);
	assert.doesNotMatch(INDEX_SOURCE, /entry\.kind === "event" && "pt-0\.5"/u);
});

test("spine nodes and comment avatars share one vertical center axis via the node slot", async () => {
	// Shared w-8 column: event glyphs and size-8 card avatars both center at x=16.
	assert.match(NODE_SOURCE, /className="flex w-8 shrink-0 flex-col items-center"/u);
	assert.match(NODE_SOURCE, /size\?: "event" \| "card"/u);
	assert.match(NODE_SOURCE, /sizePx=\{32\}/u);
	assert.match(NODE_SOURCE, /sizePx=\{16\}/u);
	assert.match(NODE_SOURCE, /className=\{cn\("min-h-4 w-px flex-1", tone === "thread" \? "bg-bg-accent-gray-subtler" : "bg-border"\)\}/u);

	// Cards opt into the card-sized node; content is never pull-left offset.
	assert.match(INDEX_SOURCE, /size=\{isCardEntry \? "card" : "event"\}/u);
	assert.doesNotMatch(INDEX_SOURCE, /-ml-9|-ml-8/u);
	assert.doesNotMatch(INDEX_SOURCE, /entry\.kind === "event" \? "px-2"/u);

	// Top-level comments hide their in-card lead; nested replies keep theirs.
	assert.match(COMMENT_SOURCE, /hideLeadAvatar/u);
	await renderNestedComments();
	const parent = document.querySelector('[data-jira-activity-entry-id="parent"]');
	const nested = document.querySelector('[data-jira-activity-entry-id="nested"]');
	assert.equal(parent.firstElementChild.classList.contains("w-8"), true);
	assert.equal(nested.firstElementChild.hasAttribute("data-jira-activity-spine-continuation"), true);
	assert.equal(parent.children[1].classList.contains("pl-6"), false);
	assert.equal(nested.children[1].classList.contains("pl-6"), true);
	assert.equal(nested.children[1].classList.contains("pt-3"), true);
	const parentReply = parent.querySelector('[role="group"][aria-label="Replies"]').firstElementChild;
	const nestedReply = nested.querySelector('[role="group"][aria-label="Replies"]').firstElementChild;
	assert.equal(parentReply.classList.contains("pt-3"), true);
	assert.equal(parentReply.classList.contains("pl-6"), true);
	assert.equal(nestedReply.classList.contains("pl-6"), false, "a parentId comment must not indent its replies a second time");
	assert.equal(parentReply.querySelector('[data-slot="avatar"]') !== null, true);
	assert.equal(nestedReply.querySelector('[data-slot="avatar"]') !== null, true);
	assert.match(CARD_SOURCE, /hideLeadAvatar\?: boolean/u);
	assert.match(CARD_SOURCE, /hideAvatar=\{hideLeadAvatar\}/u);

	// Out-of-card avatar (h-10) and either name/timestamp layout share one first-row height.
	assert.match(
		CARD_SOURCE,
		/hideLeadAvatar \? "min-h-10" : null/u,
	);
	assert.match(AGENT_LIST_CARD_SOURCE, /hideAvatar \? "min-h-10" : null/u);
});

test("snapshot events and comment copy share the content column left edge", async () => {
	// Content starts after w-8 + gap-2 (x=40). No event padding and no card
	// offset, so event copy shares that edge with names. The in-thread reply
	// composer deliberately pulls back across the node+gap to the avatar edge.
	assert.match(
		INDEX_SOURCE,
		/className=\{cn\([\s\S]*?"min-w-0 flex-1"[\s\S]*?spacingClassName[\s\S]*?isNestedComment \? "pt-3 pl-6" : null/u,
	);
	assert.match(NODE_SOURCE, /className="flex w-8 shrink-0 flex-col items-center"/u);
	assert.doesNotMatch(INDEX_SOURCE, /entry\.kind === "event" \? "px-/u);
	assert.match(INDEX_SOURCE, /hideLeadAvatar/u);
	assert.match(CHANGED_FILES_SOURCE, /hideLeadAvatar\?: boolean/u);
	assert.match(CHANGED_FILES_SOURCE, /hideAvatar=\{hideLeadAvatar\}/u);
	const view = await renderNestedComments();
	const reply = view.getAllByRole("button", { name: "Reply" })[0];
	await view.click(reply);
	const composer = document.getElementById(reply.getAttribute("aria-controls"));
	assert.equal(composer.classList.contains("-ml-10"), true);
	assert.equal(composer.classList.contains("w-[calc(100%+2.5rem)]"), true);
	assert.equal(composer.contains(view.getByRole("textbox", { name: "Leave a reply..." })), true);
});

test("rich activity cards leave a 4px gap in the connector above and below", () => {
	// Structural interruption only: card avatars sit in h-10 (32px → 4px above/below);
	// the spine is a sibling that starts after the track. No opaque spine covers —
	// those stacked with the track clearance and left an 8px orphan gap above icons.
	assert.match(INDEX_SOURCE, /li[\s\S]*className="group\/activity-event flex min-w-0 gap-2"/u);
	assert.match(NODE_SOURCE, /isCard \? "h-10" : "h-6"/u);
	assert.match(NODE_SOURCE, /className=\{cn\("min-h-4 w-px flex-1", tone === "thread" \? "bg-bg-accent-gray-subtler" : "bg-border"\)\}/u);
	assert.doesNotMatch(INDEX_SOURCE, /absolute -top-1 left-3\.5 h-1 w-1/u);
	assert.doesNotMatch(INDEX_SOURCE, /h-1 w-1 bg-surface/u);
	assert.doesNotMatch(INDEX_SOURCE, /bottom-5|bottom-4/u);
});

test("card boundaries keep richer spacing between independent entry types", () => {
	// Padding separates card/event clusters; spine breaks stay on the node track.
	// Parent→nested comment and adjacent nested siblings stay flush; independent
	// event→event is pb-2 (8px), card↔event pb-5, and card→card pb-6.
	assert.match(INDEX_SOURCE, /const isCardEntry = entry\.kind !== "event"/u);
	assert.match(
		INDEX_SOURCE,
		/const nextEntry = orderedEntries\[index \+ 1\]/u,
	);
	assert.match(
		INDEX_SOURCE,
		/const isNextEntryThreadContinuation = nextEntry\?\.kind === "comment"[\s\S]*?nextEntry\.parentId === entry\.id[\s\S]*?entry\.parentId != null[\s\S]*?nextEntry\.parentId === entry\.parentId/u,
	);
	assert.match(
		INDEX_SOURCE,
		/const spacingClassName = isNextEntryThreadContinuation[\s\S]*?\? null[\s\S]*?: isLast/u,
	);
	assert.match(
		INDEX_SOURCE,
		/isCardEntry && isNextEntryCard[\s\S]*\? "pb-6"[\s\S]*isCardEntry \|\| isNextEntryCard[\s\S]*\? "pb-5"[\s\S]*: "pb-2"/u,
	);
	assert.match(INDEX_SOURCE, /entry\.kind === "comment" \? "pb-4" : "pb-3"/u);
	assert.match(INDEX_SOURCE, /hideHeader \? "pt-1" : null/u);
	assert.match(INDEX_SOURCE, /"min-w-0 flex-1"/u);
	assert.doesNotMatch(INDEX_SOURCE, /overflow-visible/u);
});
