const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");
const { renderComponent } = require("../../../scripts/lib/render-component.js");

const INDEX_SOURCE = readFileSync(join(__dirname, "index.tsx"), "utf8");
const EVENT_SOURCE = readFileSync(join(__dirname, "jira-activity-event.tsx"), "utf8");
const NODE_SOURCE = readFileSync(join(__dirname, "jira-activity-node.tsx"), "utf8");
const COMMENT_SOURCE = readFileSync(join(__dirname, "jira-activity-comment.tsx"), "utf8");

test("one-line activity events use 12px type without shrinking expanded agent cards", async () => {
	await renderComponent({
		entry: "components/blocks/jira-activity/jira-activity-event.tsx",
		exportName: "JiraActivityEvent",
		props: {
			className: "custom-event-class",
			entry: { id: "event", kind: "event", actor: { id: "author", kind: "person", name: "Author" }, timestamp: "1h", segments: [{ type: "text", text: "updated the status" }] },
		},
	});
	const event = document.querySelector("p");
	assert.ok(event);
	for (const className of ["flex", "min-h-6", "min-w-0", "items-center", "py-0.5", "text-xs", "leading-5", "text-text-subtlest", "custom-event-class"]) {
		assert.equal(event.classList.contains(className), true, className);
	}
	assert.equal(event.classList.contains("h-6"), false);
	assert.equal(event.firstElementChild?.classList.contains("min-w-0"), true);
	assert.match(EVENT_SOURCE, /className="group\/activity-timestamp flex min-h-6 min-w-0 items-center gap-2 py-0\.5 text-xs leading-5"/u);
	assert.doesNotMatch(EVENT_SOURCE, /className="flex h-6 /u);
	assert.match(COMMENT_SOURCE, /className="text-sm leading-5 text-text"/u);
});

test("event timestamps retain the full relative label for assistive technology", async () => {
	await renderComponent({
		entry: "components/blocks/jira-activity/jira-activity-event.tsx",
		exportName: "JiraActivityEvent",
		props: {
			entry: { id: "event", kind: "event", actor: { id: "author", kind: "person", name: "Author" }, timestamp: "19 days ago", segments: [{ type: "text", text: "updated the status" }, { type: "tag", text: "Automation" }] },
		},
	});
	const timestamp = document.querySelector('[data-slot="jira-activity-timestamp"]');
	assert.equal(timestamp?.firstElementChild?.textContent, "·");
	assert.equal(timestamp?.firstElementChild?.getAttribute("aria-hidden"), "true");
	assert.equal(timestamp?.querySelector(".sr-only")?.textContent, "19 days ago");
	assert.equal(timestamp?.lastElementChild?.lastElementChild?.textContent, "19d");
	assert.equal(timestamp?.lastElementChild?.lastElementChild?.getAttribute("aria-hidden"), "true");
	assert.equal(document.querySelector("p > span > .sr-only")?.textContent, "Automation");
});

test("event labels share the timeline node's 24px vertical alignment track", () => {
	assert.match(NODE_SOURCE, /isCard \? "h-8" : "h-6"/u);
	assert.doesNotMatch(EVENT_SOURCE, /className="flex h-6 /u);
	assert.match(INDEX_SOURCE, /hideHeader \? "pt-1" : null/u);
	assert.doesNotMatch(INDEX_SOURCE, /entry\.kind === "event" && "pt-0\.5"/u);
});
