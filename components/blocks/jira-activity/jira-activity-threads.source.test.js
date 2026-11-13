const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const React = require("react");
const { renderComponent } = require("../../../scripts/lib/render-component.js");

// Thread replies, reactions, and composer contracts split from jira-activity.source.test.js
// so the parent file stays inside the default file-size budget.

const {
	JIRA_ACTIVITY_ENTRIES,
	JIRA_ACTIVITY_CURRENT_USER,
} = require("./data.ts");

const INDEX_SOURCE = fs.readFileSync(path.join(__dirname, "index.tsx"), "utf8");
const COMPOSER_SOURCE = fs.readFileSync(
	path.join(__dirname, "jira-activity-composer.tsx"),
	"utf8",
);
const COMPOSER_DICTATION_SOURCE = fs.readFileSync(
	path.join(__dirname, "use-jira-activity-composer-dictation.ts"),
	"utf8",
);
const COMMENT_SOURCE = fs.readFileSync(
	path.join(__dirname, "jira-activity-comment.tsx"),
	"utf8",
);
const COMMENT_ACTIONS_SOURCE = fs.readFileSync(
	path.join(__dirname, "jira-activity-comment-actions.tsx"),
	"utf8",
);
const CARD_SOURCE = fs.readFileSync(
	path.join(__dirname, "jira-activity-card.tsx"),
	"utf8",
);
const PROMPT_INPUT_SOURCE = fs.readFileSync(
	path.join(__dirname, "..", "..", "ui-custom", "prompt-input.tsx"),
	"utf8",
);

const THREAD_ACTOR = { id: "parent-author", kind: "person", name: "Parent author" };
const THREAD_ENTRY = {
	id: "discussion",
	kind: "comment",
	actor: THREAD_ACTOR,
	timestamp: "1 hour ago",
	body: [{ type: "text", text: "Parent discussion body" }],
	replies: [{
		id: "nested-reply",
		actor: { id: "reply-author", kind: "person", name: "Reply author" },
		timestamp: "30 minutes ago",
		body: "Nested reply body",
	}],
};

function threadProps(overrides = {}) {
	return { composer: null, currentUser: THREAD_ACTOR, entries: [THREAD_ENTRY], hideHeader: true, ...overrides };
}

function renderDefaultThread(overrides) {
	return renderComponent({
		entry: "components/blocks/jira-activity/index.tsx",
		exportName: "JiraActivity",
		props: threadProps(overrides),
	});
}

test("controlled timelines route an inline reply and its agent mentions to the owning thread", async () => {
	const submitted = [];
	const view = await renderDefaultThread({
		onSubmitReply: (entry, body, mentions) => submitted.push({ id: entry.id, body, mentions }),
		renderReplyComposer: (composer) => React.createElement("button", { onClick: () => composer.onSubmit("Hello", ["subagent:claude"]) }, "Send reply"),
	});
	await view.click(view.getAllByRole("button", { name: "Reply" })[0]);
	await view.click(view.getByRole("button", { name: "Send reply" }));
	assert.deepEqual(submitted, [{ id: "discussion", body: "Hello", mentions: ["subagent:claude"] }]);
});

test("new reply reactions preserve the viewer's existing reaction", async () => {
	const entry = { ...THREAD_ENTRY, replies: [{ ...THREAD_ENTRY.replies[0], reactions: [{ emoji: "👍", actorIds: ["reply-author"] }] }] };
	const view = await renderDefaultThread({ entries: [entry] });
	await view.click(view.getByRole("button", { name: /1 reacted with thumbs up/u }));
	await view.rerender(threadProps({ entries: [{ ...entry, replies: [{ ...entry.replies[0], reactions: [...entry.replies[0].reactions, { emoji: "👀", actorIds: ["agent"] }] }] }] }));
	assert.equal(view.getByRole("button", { name: /2 reacted with thumbs up/u }).getAttribute("aria-pressed"), "true");
	assert.equal(view.getByRole("button", { name: /1 reacted with eyes/u }).getAttribute("aria-pressed"), "false");
});

test("inline review comments keep one reply level and continue the parent timeline spine", async () => {
	const view = await renderDefaultThread({
		entries: [
			{ ...THREAD_ENTRY, replies: [] },
			{ ...THREAD_ENTRY, id: "review", parentId: THREAD_ENTRY.id, actor: { ...THREAD_ACTOR, id: "reviewer", name: "Review author" } },
		],
	});
	const parent = document.querySelector('[data-jira-activity-entry-id="discussion"]');
	const review = document.querySelector('[data-jira-activity-entry-id="review"]');
	assert.equal(review.getAttribute("data-jira-activity-parent-id"), "discussion");
	assert.equal(parent.querySelector("[data-jira-activity-timeline-stem]") !== null, true);
	assert.equal(review.querySelector("[data-jira-activity-spine-continuation]") !== null, true);
	assert.equal(view.queryByRole("group", { name: "Replies" }), null, "parentId threads start collapsed");
	await view.click(view.getByRole("button", { name: "Show all replies" }));
	assert.equal(view.queryByText("Nested reply body") !== null, true);
	assert.equal(view.getByRole("group", { name: "Replies" }).firstElementChild.classList.contains("pl-6"), false);
});

test("plain comments share the stacked identity header and the flush composer geometry", async () => {
	assert.match(COMMENT_SOURCE, /import \{ Avatar, AvatarFallback, AvatarGroup, AvatarImage \}/u);
	assert.doesNotMatch(COMMENT_SOURCE, /entry\.actor\.kind === "person" \? "stacked" : "inline"/u);
	assert.doesNotMatch(COMMENT_SOURCE, /const headerTag = resolved/u);
	assert.match(COMMENT_SOURCE, /tag=\{entry\.tag\}/u);
	assert.match(
		COMMENT_SOURCE,
		/import \{ Lozenge \} from "@\/components\/ui\/lozenge";[\s\S]*showResolvedStatus \? <Lozenge variant="success">Resolved<\/Lozenge>/u,
	);
	assert.match(
		COMMENT_SOURCE,
		/function ReopenThreadAction[\s\S]*aria-label="Reopen"[\s\S]*className="h-auto px-0 text-xs text-text-subtle"[\s\S]*variant="link"[\s\S]*>\s*Reopen\s*<\/Button>/u,
	);
	assert.doesNotMatch(
		COMMENT_SOURCE,
		/aria-label="Reopen"[\s\S]*className="[^"]*(?:px-[1-9]|font-normal)/u,
	);
	assert.doesNotMatch(COMMENT_SOURCE, />\s*Resolved\s*<\/p>/u);
	assert.match(
		COMMENT_SOURCE,
		/<Avatar aria-hidden size=\{sizePx === 16 \? "xs" : "default"\}>/u,
	);
	assert.match(COMMENT_SOURCE, /function ActivityActorAvatar/u);
	assert.match(COMMENT_SOURCE, /<AvatarImage alt="" src=\{actor\.avatarSrc\}/u);
	// Reply is a disclosure the comment owns via `commentActions`, not a callback
	// the consuming surface has to wire up.
	assert.doesNotMatch(COMMENT_SOURCE, /onReplyRequest/u);
	// Flush composer chrome stays on the composer's `flush` surface; the
	// callsite only mounts the composer (no local chrome classNames).
	assert.doesNotMatch(COMMENT_SOURCE, /border-0 rounded-none bg-transparent|FLUSH_COMPOSER_CLASSNAME/u);
	const view = await renderDefaultThread();
	await view.click(view.getAllByRole("button", { name: "Reply" })[0]);
	const editor = view.getByRole("textbox", { name: "Leave a reply..." });
	const shell = editor.closest("[data-prompt-input-root]");
	assert.equal(shell.classList.contains("shadow-none"), true);
	assert.equal(shell.classList.contains("p-2"), true);
	assert.equal(view.getByRole("button", { name: "Add" }).classList.contains("size-6"), true);
	assert.doesNotMatch(COMMENT_SOURCE, /overflow-visible px-1\.5 pt-1 pb-3/u);
});

test("only the latest third-level reply owns Reopen", () => {
	assert.match(
		COMMENT_SOURCE,
		/onReopen=\{\s*resolved && index === replies\.length - 1 && allowResolve && onResolve[\s\S]*\? handleResolveToggle[\s\S]*: undefined\s*\}/u,
	);
	assert.match(
		COMMENT_SOURCE,
		/resolved \? \(\s*onReopen \? <ReopenThreadAction onReopen=\{onReopen\} \/> : undefined/u,
	);
	assert.doesNotMatch(COMMENT_SOURCE, /\bfollowsReplies\b/u);
	assert.doesNotMatch(COMMENT_SOURCE, /<ReopenThreadAction[^>]*indented=/u);
});

test("the activity card hosts the action row in the body grid, not the footer", async () => {
	const props = {
		agentName: "Card author",
		timestamp: "Today",
		children: React.createElement("p", null, "Card body"),
		details: { label: "More detail", children: React.createElement("p", null, "Expanded detail") },
		footerActions: React.createElement("button", null, "Card actions"),
		replies: React.createElement("p", null, "Thread reply"),
		replyComposer: React.createElement("textarea", { "aria-label": "Reply draft" }),
	};
	const view = await renderComponent({ entry: "components/blocks/jira-activity/jira-activity-card.tsx", exportName: "JiraActivityCard", props });
	for (const headerLayout of ["inline", "stacked"]) {
		await view.rerender({ ...props, headerLayout });
		if (view.queryByText("Expanded detail") === null) await view.click(view.getByRole("button", { name: "More detail" }));
		const bodyGrid = view.getByText("Card body").parentElement.parentElement;
		const actions = view.getByRole("button", { name: "Card actions" });
		const reply = view.getByText("Thread reply");
		assert.equal(actions.parentElement === bodyGrid, true);
		assert.equal(reply.parentElement === bodyGrid, false);
		assert.equal(Boolean(view.getByText("Expanded detail").compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING), true);
		assert.equal(Boolean(actions.compareDocumentPosition(reply) & Node.DOCUMENT_POSITION_FOLLOWING), true);
		assert.equal(Boolean(reply.compareDocumentPosition(view.getByRole("textbox", { name: "Reply draft" })) & Node.DOCUMENT_POSITION_FOLLOWING), true);
		assert.equal(bodyGrid.classList.contains(headerLayout === "stacked" ? "gap-3" : "gap-2"), true);
		assert.equal(reply.parentElement.classList.contains("gap-3"), true);
		assert.equal(reply.parentElement.classList.contains("overflow-visible"), false);
	}
	assert.doesNotMatch(CARD_SOURCE, /\bp-3\b/u);
});

test("parent comments keep Reply and reactions while resolved threads label the latest reply", () => {
	assert.match(
		COMMENT_ACTIONS_SOURCE,
		/import ReplyLeftIcon from "@atlaskit\/icon-lab\/core\/reply-left";/u,
	);
	assert.match(
		COMMENT_ACTIONS_SOURCE,
		/import \{ EmojiReactionBar \} from "@\/components\/blocks\/emoji-picker\/components\/emoji-reaction-bar";/u,
	);
	assert.match(COMMENT_ACTIONS_SOURCE, /<EmojiReactionBar/u);
	assert.match(COMMENT_ACTIONS_SOURCE, /aria-label="Comment actions"/u);
	// Reply is an icon button: label on the Button, empty label on the icon.
	assert.match(COMMENT_ACTIONS_SOURCE, /aria-label="Reply"/u);
	assert.match(COMMENT_ACTIONS_SOURCE, /aria-expanded=\{replyExpanded\}/u);
	assert.match(COMMENT_ACTIONS_SOURCE, /aria-controls=\{replyComposerId\}/u);
	assert.match(COMMENT_ACTIONS_SOURCE, /className="rounded-sm"/u);
	assert.doesNotMatch(COMMENT_ACTIONS_SOURCE, /shape="circle"/u);
	assert.match(COMMENT_ACTIONS_SOURCE, /<ReplyLeftIcon color="currentColor" label="" \/>/u);
	// Always visible — never a hover-reveal.
	assert.doesNotMatch(COMMENT_ACTIONS_SOURCE, /opacity-0|group-hover/u);
	// Omitting `onReply` is how `allowReply: false` drops the button.
	assert.match(COMMENT_ACTIONS_SOURCE, /onReply\?: \(\) => void;/u);
	assert.match(COMMENT_ACTIONS_SOURCE, /onReply \? \(/u);
	// Resolve is a subtle text control for active SCM review threads; resolved
	// state belongs beside the latest reply timestamp, with Reopen owned by that reply.
	assert.match(COMMENT_ACTIONS_SOURCE, /onResolve\?: \(\) => void;/u);
	assert.doesNotMatch(COMMENT_ACTIONS_SOURCE, /Reopen|Unresolve|aria-pressed/u);
	assert.match(COMMENT_ACTIONS_SOURCE, /aria-label="Resolve"/u);
	assert.match(
		COMMENT_ACTIONS_SOURCE,
		/<EmojiReactionBar[\s\S]*trailing=\{[\s\S]*aria-label="Resolve"[\s\S]*className="h-auto px-0 text-xs text-text-subtle"[\s\S]*variant="link"/u,
	);
	assert.doesNotMatch(
		COMMENT_ACTIONS_SOURCE,
		/aria-label="Resolve"[\s\S]*className="[^"]*(?:px-[1-9]|font-normal)/u,
	);
	assert.match(COMMENT_SOURCE, /<JiraActivityCommentActions/u);
	assert.match(COMMENT_SOURCE, /footerActions=\{/u);
	assert.match(COMMENT_SOURCE, /const commentActionControls = commentActions === "none" \? null/u);
	assert.match(COMMENT_SOURCE, /!resolved && allowResolve && onResolve \? handleResolveToggle/u);
	assert.match(
		COMMENT_SOURCE,
		/replies\.map\(\(reply, index\) => \([\s\S]*onReopen=\{[\s\S]*index === replies\.length - 1[\s\S]*showResolvedStatus=\{resolved && index === replies\.length - 1\}/u,
	);
	assert.match(COMMENT_SOURCE, /parentResolvedStatus = resolved && !hasReplies/u);
	assert.match(COMMENT_SOURCE, /className="text-sm leading-5 text-text"/u);
	assert.doesNotMatch(COMMENT_SOURCE, /resolved \? "text-text-subtlest" : "text-text"/u);
});

test("active thread replies have actions while only the latest resolved reply can reopen", () => {
	assert.match(COMMENT_SOURCE, /function ThreadReplyCard/u);
	assert.doesNotMatch(COMMENT_SOURCE, /className="rounded-none border-0"/u);
	assert.doesNotMatch(COMMENT_SOURCE, /<div className="pl-6">/u);
	assert.doesNotMatch(COMMENT_SOURCE, /<div className="pl-3">/u);
	assert.match(COMMENT_SOURCE, /activityGroup="activity-reply"/u);
	assert.match(COMMENT_SOURCE, /item=\{reply\.sessionItem\}/u);
	assert.match(COMMENT_SOURCE, /onView=\{onViewSession\}/u);
	assert.match(COMMENT_SOURCE, /<JiraActivityCommentActions[\s\S]*onToggleReaction=\{toggleReaction\}/u);
	assert.match(
		COMMENT_SOURCE,
		/resolved \? \(\s*onReopen \? <ReopenThreadAction onReopen=\{onReopen\} \/> : undefined\s*\) : commentActions === "none" \? undefined/u,
	);
	assert.match(COMMENT_SOURCE, /\? \(\) => onReply\(replyButtonRef\.current\)/u);
	assert.match(COMMENT_SOURCE, /<ThreadReplyCard[\s\S]*allowReply=\{allowReply\}/u);
	assert.match(COMMENT_SOURCE, /<ThreadReplyCard[\s\S]*resolved=\{resolved\}/u);
	assert.match(COMMENT_SOURCE, /<ThreadReplyCard[\s\S]*showResolvedStatus=\{resolved && index === replies\.length - 1\}/u);
	assert.doesNotMatch(COMMENT_SOURCE, /divide-y divide-border/u);
	assert.doesNotMatch(COMMENT_SOURCE, /before:-top-3|before:left-4|before:w-px|ml-8/u);
	assert.doesNotMatch(COMMENT_SOURCE, /import \{ Comment \} from "@\/components\/ui\/comment";/u);
});

test("a thread owns one bottom reply composer and targets the clicked author", async () => {
	const view = await renderDefaultThread();
	const [parentReply, nestedReply] = view.getAllByRole("button", { name: "Reply" });
	await view.click(nestedReply);
	assert.equal(view.getAllByRole("textbox").length, 1);
	let editor = view.getByRole("textbox", { name: "Leave a reply..." });
	assert.equal(editor.textContent.trim(), "Reply author");
	assert.equal(editor.querySelector('[data-mention-category="human"]') !== null, true);
	assert.equal(nestedReply.getAttribute("aria-expanded"), "true");
	assert.equal(parentReply.hasAttribute("aria-controls"), false);
	const composer = document.getElementById(nestedReply.getAttribute("aria-controls"));
	assert.equal(composer.contains(editor), true);
	assert.equal(Boolean(view.getByRole("group", { name: "Replies" }).compareDocumentPosition(composer) & Node.DOCUMENT_POSITION_FOLLOWING), true);
	await view.click(parentReply);
	assert.equal(view.getAllByRole("textbox").length, 1);
	editor = view.getByRole("textbox", { name: "Leave a reply..." });
	assert.equal(editor.textContent.trim(), "Parent author");
	assert.equal(parentReply.getAttribute("aria-expanded"), "true");
	assert.equal(nestedReply.getAttribute("aria-expanded"), "false");
	assert.equal(nestedReply.hasAttribute("aria-controls"), false);
	await view.click(parentReply);
	assert.equal(view.queryByRole("textbox"), null);
	assert.equal(view.isFocused(parentReply), true);
});

test("comments with nested replies expose one shared header control to collapse the thread", () => {
	assert.match(COMMENT_SOURCE, /import GrowVerticalIcon from "@atlaskit\/icon\/core\/grow-vertical"/u);
	assert.match(
		COMMENT_SOURCE,
		/const \[repliesExpanded, setRepliesExpanded\] = useState\(\s*entry\.defaultRepliesExpanded \?\? !nested,\s*\)/u,
	);
	assert.match(COMMENT_SOURCE, /const hasReplies = replies\.length > 0/u);
	assert.match(COMMENT_SOURCE, /repliesExpanded \? "Hide all replies" : "Show all replies"/u);
	assert.match(COMMENT_SOURCE, /aria-controls=\{repliesId\}[\s\S]*aria-expanded=\{repliesExpanded\}[\s\S]*size="icon-compact"[\s\S]*variant="outline"/u);
	assert.match(COMMENT_SOURCE, /className="aria-expanded:border-border aria-expanded:bg-bg-neutral-subtle/u);
	assert.doesNotMatch(COMMENT_SOURCE, /aria-expanded:border-transparent|aria-expanded:bg-transparent/u);
	assert.doesNotMatch(COMMENT_SOURCE, /opacity-0[\s\S]*group-hover\/activity-card:opacity-100/u);
	assert.match(
		COMMENT_SOURCE,
		/const headerAction = action \|\| repliesToggle \|\| addToChatAction(?: \|\| hoverActions)? \? \(\s*<div className="flex shrink-0 items-center gap-1">[\s\S]*\{action\}[\s\S]*\{addToChatAction\}[\s\S]*\{repliesToggle\}/u,
	);
	// The shared control rides the card's hover scope, but stays in the tab order:
	// a `display: none` wrapper could never satisfy its own focus-visible reveal.
	assert.match(
		CARD_SOURCE,
		/\{action \? \([\s\S]*"relative z-10 pointer-events-none flex shrink-0 items-center gap-1 opacity-0[\s\S]*actionVisibilityClass/u,
	);
	assert.doesNotMatch(CARD_SOURCE, /"hidden shrink-0 items-center gap-1/u);
	assert.match(COMMENT_SOURCE, /action=\{headerAction\}/u);
	assert.doesNotMatch(COMMENT_SOURCE, /repliesHidden=/u);
	assert.doesNotMatch(CARD_SOURCE, /repliesHidden/u);
});

test("agent session cards keep header actions and replies toggle on the shared hover group", () => {
	// Agent headers receive the same action cluster (Add to chat + expand) as
	// human cards; the card-level group keeps those controls clickable over the
	// full thread, including while the pointer is on nested replies.
	assert.match(COMMENT_SOURCE, /item=\{entry\.sessionItem\}/u);
	assert.match(COMMENT_SOURCE, /action=\{headerAction\}/u);
	assert.match(COMMENT_SOURCE, /onClick=\{\(\) => setRepliesExpanded\(\(expanded\) => !expanded\)\}/u);
	assert.match(
		CARD_SOURCE,
		/Hover\/focus group wraps the full card[\s\S]*activityGroupClass,[\s\S]*"w-full min-w-0 overflow-visible bg-transparent"/u,
	);
});

test("collapsed threads show a Slack-like participant, count, and timestamp summary", () => {
	assert.match(COMMENT_SOURCE, /function CollapsedThreadSummary/u);
	assert.match(
		COMMENT_SOURCE,
		/\{resolved \? <Lozenge variant="success">Resolved<\/Lozenge> : null\}\s*<span aria-hidden className="text-text-subtlest">·<\/span>/u,
	);
	assert.match(COMMENT_SOURCE, /new Map\(replies\.map\(\(reply\) => \[reply\.actor\.id, reply\.actor\]\)\)/u);
	assert.match(COMMENT_SOURCE, /<AvatarGroup[\s\S]*Reply participants:[\s\S]*actors\.slice\(0, 3\)\.map/u);
	assert.match(COMMENT_SOURCE, /sizePx=\{16\}/u);
	assert.match(COMMENT_SOURCE, /replyCountLabel[\s\S]*latestTimestamp/u);
	assert.match(COMMENT_SOURCE, /text-xs font-normal text-text hover:underline/u);
	assert.doesNotMatch(COMMENT_SOURCE, /font-medium text-link[\s\S]*replyCountLabel/u);
	assert.doesNotMatch(COMMENT_SOURCE, /hover:no-underline/u);
	assert.match(COMMENT_SOURCE, /group\/thread-summary h-auto min-w-0 gap-1\.5/u);
	assert.match(COMMENT_SOURCE, /shrink-0 text-text-subtle">\{replyCountLabel\}/u);
	assert.match(
		COMMENT_SOURCE,
		/shrink-0 text-text-subtle">\{replyCountLabel\}<\/span>\s*\{latestTimestamp \? \(\s*<>\s*<span aria-hidden className="shrink-0 text-text-subtlest">·<\/span>/u,
	);
	assert.match(COMMENT_SOURCE, /truncate text-text-subtlest group-hover\/thread-summary:hidden[\s\S]*latestTimestamp/u);
	assert.match(COMMENT_SOURCE, /group-hover\/thread-summary:hidden[\s\S]*latestTimestamp/u);
	assert.match(COMMENT_SOURCE, /group-hover\/thread-summary:inline[\s\S]*View all comments/u);
	assert.match(COMMENT_SOURCE, /collapsedThreadSummary = hasReplies && !repliesExpanded/u);
	assert.match(
		COMMENT_SOURCE,
		/<CollapsedThreadSummary[\s\S]*onExpand=\{\(\) => setRepliesExpanded\(true\)\}[\s\S]*replies=\{replies\}[\s\S]*resolved=\{resolved\}/u,
	);
});

test("Reply discloses the single thread composer, defaulting to reply-and-reactions", async () => {
	const view = await renderDefaultThread();
	const reply = view.getAllByRole("button", { name: "Reply" })[0];
	assert.equal(view.queryByRole("textbox"), null);
	assert.equal(reply.getAttribute("aria-expanded"), "false");
	assert.equal(reply.hasAttribute("aria-controls"), false);
	await view.click(reply);
	const composerId = reply.getAttribute("aria-controls");
	assert.equal(reply.getAttribute("aria-expanded"), "true");
	assert.equal(document.getElementById(composerId).contains(view.getByRole("textbox")), true);
	await view.click(reply);
	assert.equal(view.queryByRole("textbox"), null);
	assert.equal(document.getElementById(composerId) === null, true);
	assert.equal(reply.hasAttribute("aria-controls"), false);
	assert.equal(view.isFocused(reply), true);
	for (const commentActions of ["reply-and-reactions", "reactions", "none"]) {
		await view.rerender(threadProps({ commentActions, entries: [{ ...THREAD_ENTRY, allowReply: false }] }));
		assert.equal(view.queryByRole("button", { name: "Reply" }), null);
		assert.equal(view.queryByRole("textbox"), null);
		assert.equal(view.container.querySelectorAll('[role="group"][aria-label="Comment actions"]').length, commentActions === "none" ? 0 : 2);
	}
	for (const commentActions of ["reactions", "none"]) {
		await view.rerender(threadProps({ commentActions }));
		assert.equal(view.queryByRole("button", { name: "Reply" }), null);
		assert.equal(view.getAllByRole("textbox").length, 1, "non-disclosure modes retain the always-visible reply composer");
		assert.equal(view.container.querySelectorAll('[role="group"][aria-label="Comment actions"]').length, commentActions === "none" ? 0 : 2);
	}
	await view.unmount();
	const standalone = await renderComponent({
		entry: "components/blocks/jira-activity/jira-activity-comment.tsx",
		exportName: "JiraActivityComment",
		props: { entry: THREAD_ENTRY, currentUser: THREAD_ACTOR, actorsById: new Map(), onSubmitReply() {}, onToggleReaction() {} },
	});
	assert.equal(standalone.queryByRole("textbox"), null, "standalone comments share the disclosure default");
	await standalone.click(standalone.getAllByRole("button", { name: "Reply" })[0]);
	assert.equal(standalone.getAllByRole("textbox").length, 1);
});

test("resolving a thread closes its composer and removes the disclosure relationship", async () => {
	const view = await renderDefaultThread({ entries: undefined, defaultEntries: [{ ...THREAD_ENTRY, allowResolve: true }] });
	const reply = view.getAllByRole("button", { name: "Reply" })[0];
	await view.click(reply);
	const composerId = reply.getAttribute("aria-controls");
	assert.equal(document.getElementById(composerId).contains(view.getByRole("textbox")), true);
	await view.click(view.getByRole("button", { name: "Resolve" }));
	assert.equal(view.queryByRole("textbox"), null);
	assert.equal(document.getElementById(composerId) === null, true);
	assert.equal(reply.hasAttribute("aria-controls"), false);
	assert.equal(reply.getAttribute("aria-expanded"), "false");
	assert.equal(view.isFocused(reply), true);
	assert.equal(view.queryByRole("button", { name: "Reopen" }) !== null, true);
});

test("toggling a reaction routes through the reducer with the current user's id", () => {
	assert.match(
		INDEX_SOURCE,
		/onToggleReaction\?: \(entry: JiraActivityCommentEntry, emoji: string\) => void/u,
	);
	assert.match(
		INDEX_SOURCE,
		/function handleToggleReaction\([\s\S]*if \(onToggleReaction\) \{[\s\S]*onToggleReaction\(entry, emoji\);[\s\S]*return;[\s\S]*applyAction\(\{[\s\S]*type: "toggle-reaction",[\s\S]*entryId: entry\.id,[\s\S]*emoji,[\s\S]*actorId: currentUser\.id,/u,
	);
	assert.match(
		INDEX_SOURCE,
		/onToggleReaction=\{\(emoji\) => handleToggleReaction\(entry, emoji\)\}/u,
	);
	assert.match(INDEX_SOURCE, /\bJiraActivityReaction,/u);
	// Stored actor ids are normalized into the picker block's count view model.
	assert.match(
		COMMENT_SOURCE,
		/\(entry\.reactions \?\? \[\]\)\.map\(\(reaction\) => \(\{[\s\S]*emoji: reaction\.emoji,[\s\S]*count: reaction\.actorIds\.length,[\s\S]*reacted: reaction\.actorIds\.includes\(currentUser\.id\),/u,
	);
});

test("the sample feed seeds reactions on a human comment", () => {
	const seeded = JIRA_ACTIVITY_ENTRIES.filter(
		(entry) => entry.kind === "comment" && (entry.reactions?.length ?? 0) > 0,
	);
	assert.ok(seeded.length > 0, "expected at least one comment with seeded reactions");
	const [comment] = seeded;
	assert.equal(comment.actor.kind, "person");
	assert.ok(comment.reactions.length >= 2, "expected more than one reaction glyph");
	// One reaction the viewer has pressed (count > 1) and one they have not, so
	// the demo shows both pill states.
	const pressed = comment.reactions.filter((reaction) =>
		reaction.actorIds.includes(JIRA_ACTIVITY_CURRENT_USER.id),
	);
	const unpressed = comment.reactions.filter(
		(reaction) => !reaction.actorIds.includes(JIRA_ACTIVITY_CURRENT_USER.id),
	);
	assert.ok(pressed.length > 0, "expected a reaction the current user has pressed");
	assert.ok(unpressed.length > 0, "expected a reaction the current user has not pressed");
	assert.ok(pressed[0].actorIds.length > 1, "pressed reaction should aggregate actors");
	for (const reaction of comment.reactions) {
		assert.equal(new Set(reaction.actorIds).size, reaction.actorIds.length);
	}
});

test("the sample feed includes a human activity snapshot comment", () => {
	const humanComments = JIRA_ACTIVITY_ENTRIES.filter(
		(entry) => entry.kind === "comment" && entry.actor.kind === "person",
	);
	assert.ok(
		humanComments.length > 0,
		"expected at least one human-authored comment card",
	);
	const snapshot = humanComments[0];
	// A human snapshot is a plain comment (no agent session summary) so it renders
	// the stacked avatar/name/timestamp header rather than the agent-session card.
	assert.equal(snapshot.sessionItem, undefined);
	assert.ok(snapshot.actor.avatarSrc, "human snapshot should carry a photo avatar");
	assert.ok(snapshot.body.length > 0, "human snapshot should have a body");
	// The prompt composer is exposed for human comments (allowReply defaults to true).
	assert.notEqual(snapshot.allowReply, false);
});

test("the exported comment composer uses the shared floating Rovo prompt", () => {
	assert.match(INDEX_SOURCE, /export \{ JiraActivityComposer, type JiraActivityComposerProps \}/u);
	assert.match(COMPOSER_SOURCE, /value\?: string/u);
	assert.match(COMPOSER_SOURCE, /onValueChange\?: \(value: string\) => void/u);
	assert.match(COMPOSER_SOURCE, /textareaRef\?: Ref<HTMLTextAreaElement>/u);
	assert.match(COMPOSER_SOURCE, /inputContext\?: ReactNode/u);
	assert.match(COMPOSER_SOURCE, /inputContextSubmitText\?: string/u);
	assert.match(COMPOSER_SOURCE, /inputContext=\{expandedToolbar\}/u);
	assert.match(COMPOSER_SOURCE, /const canSubmit = trimmed\.length > 0 \|\| hasInputContext/u);
	assert.match(COMPOSER_SOURCE, /<FloatingComposer/u);
	assert.match(COMPOSER_SOURCE, /<PromptInputTextarea/u);
	assert.match(COMPOSER_SOURCE, /<RovoComposerActionButton/u);
	assert.match(COMPOSER_SOURCE, /showSubmitWhenEmpty/u);
	assert.match(COMPOSER_SOURCE, /onStartDictation=\{onStartDictation\}/u);
	assert.match(COMPOSER_SOURCE, /onStopDictation=\{onStopDictation\}/u);
	assert.match(COMPOSER_SOURCE, /dictationState=\{dictationState\}/u);
	// Plain reply row still owns a local Send control; floating surfaces use the
	// shared action button (mic + send) instead.
	assert.match(COMPOSER_SOURCE, /aria-label="Send"/u);
	assert.match(COMPOSER_SOURCE, /disabled=\{!canSubmit\}/u);
});

test("the floating activity composer reuses shared dictation via browser transcription", () => {
	assert.match(
		COMPOSER_SOURCE,
		/import \{ useJiraActivityComposerDictation \} from "\.\/use-jira-activity-composer-dictation"/u,
	);
	assert.match(
		COMPOSER_DICTATION_SOURCE,
		/realtime\.connect\(\{ transcriptionOnly: true \}\)/u,
	);
	assert.match(
		COMPOSER_DICTATION_SOURCE,
		/appendDictationTranscript\(/u,
	);
	assert.match(
		COMPOSER_DICTATION_SOURCE,
		/resolveComposerDictationState\(/u,
	);
});

test("the two floating surfaces are separated by variant, not by callsite classNames", () => {
	assert.match(COMPOSER_SOURCE, /variant\?: "reply" \| "comment" \| "flush"/u);
	assert.match(COMPOSER_SOURCE, /const surface = COMPOSER_SURFACES\[variant\];/u);
	// Both floating surfaces keep PromptInput's bordered chrome and the shared
	// compact `p-2` (space.100) inset. Flush drops the floating backdrop shadow;
	// comment keeps it. Control size also separates them.
	assert.match(
		COMPOSER_SOURCE,
		/comment: \{[\s\S]*?chrome: "p-2",[\s\S]*?controlClassName: "",/u,
	);
	assert.match(
		COMPOSER_SOURCE,
		/flush: \{[\s\S]*?chrome: "p-2 shadow-none",[\s\S]*?controlClassName: "size-6",/u,
	);
	assert.match(COMPOSER_SOURCE, /controlClassName: "size-6"/u);
	assert.doesNotMatch(COMPOSER_SOURCE, /border-0 rounded-none bg-transparent/u);
	// Only flush opts out of the floating backdrop; comment keeps PromptInput's shadow.
	assert.match(COMPOSER_SOURCE, /chrome: "p-2 shadow-none"/u);
	assert.equal((COMPOSER_SOURCE.match(/chrome: "p-2"/gu) ?? []).length, 1);
	// The floating comment bar keeps the default 16px ADS glyph; only the 24px
	// in-card controls step down to the purpose-drawn small one.
	assert.match(COMPOSER_SOURCE, /comment: \{[\s\S]*?iconSize: "medium",/u);
	assert.match(COMPOSER_SOURCE, /flush: \{[\s\S]*?iconSize: "small",/u);
	assert.match(COMPOSER_SOURCE, /<AddIcon label="" size=\{surface\.iconSize\} \/>/u);
	// Floating send/mic chrome comes from RovoComposerActionButton; flush can
	// still shrink the submit CTA via `submitButtonClassName`.
	assert.match(
		COMPOSER_SOURCE,
		/<RovoComposerActionButton[\s\S]*?submitButtonClassName=\{surface\.controlClassName\}/u,
	);
	assert.match(
		COMPOSER_SOURCE,
		/aria-label="Add"\s*className=\{surface\.controlClassName\}\s*size="icon"/u,
	);
	assert.doesNotMatch(COMPOSER_SOURCE, /icon-xs|icon-sm/u);
	assert.match(
		COMPOSER_SOURCE,
		/className=\{cn\([\s\S]*"w-full",[\s\S]*surface\.chrome,[\s\S]*className,[\s\S]*\)\}/u,
	);
	// The editor gutter is the floating shell's job, not this composer's.
	assert.doesNotMatch(COMPOSER_SOURCE, /input-group-control-container|prompt-input-placeholder/u);
});

test("the comment composer expands into the shared rich editor toolbar", () => {
	assert.match(
		COMPOSER_SOURCE,
		/import \{ EditorToolbar \} from "@\/components\/blocks\/editor-toolbar";/u,
	);
	assert.match(COMPOSER_SOURCE, /expandOnFocus\?: boolean;/u);
	assert.match(COMPOSER_SOURCE, /const isExpandableComment = variant === "comment" && expandOnFocus;/u);
	assert.match(
		COMPOSER_SOURCE,
		/<EditorToolbar[\s\S]*leadingSlot=\{<JiraCommentEditorToolbarLeading editor=\{editor\} \/>\}/u,
	);
	assert.match(COMPOSER_SOURCE, /showFormattingControls=\{false\}/u);
	assert.match(COMPOSER_SOURCE, /onFocusCapture=\{\(\) => \{[\s\S]*setIsExpanded\(true\)/u);
	assert.match(COMPOSER_SOURCE, /layout=\{isExpandableComment && isExpanded \? "stacked" : "auto"\}/u);
	assert.match(COMPOSER_SOURCE, /Type \/ai to ask Rovo or @ to mention someone…/u);
	assert.match(COMPOSER_SOURCE, /isExpandableComment && isExpanded && "min-h-36 py-3"/u);
	assert.match(COMPOSER_SOURCE, /insertEditorCommand\(editor, "\/Improve description "\)/u);
	assert.match(COMPOSER_SOURCE, /isExpandableComment && isExpanded \? null : \(/u);
});

test("disclosing Reply focuses the composer through the editor's own autofocus", () => {
	// The comment variant is a contentEditable tiptap editor that initialises
	// asynchronously (prompt-input.tsx maps `autoFocus` onto tiptap's
	// `autofocus: "end"`). Focusing a ref from a parent effect races that
	// initialisation and silently no-ops, so the disclosure must not try.
	assert.match(COMPOSER_SOURCE, /autoFocus\?: boolean;/u);
	assert.match(COMPOSER_SOURCE, /autoFocus = false,/u);
	assert.match(COMPOSER_SOURCE, /<PromptInputTextarea[\s\S]*autoFocus=\{autoFocus\}/u);
	// Only mounts on a Reply click in collapsible mode, so mounting is the moment
	// to take focus; in the always-mounted modes it must never steal focus.
	assert.match(COMMENT_SOURCE, /autoFocus=\{collapsible\}/u);
	assert.match(COMMENT_SOURCE, /key=\{replyTarget\?\.key \?\? "thread-reply"\}/u);
	assert.doesNotMatch(COMMENT_SOURCE, /textareaRef/u);
	// Collapsing still returns focus to the Reply button, which is a plain button.
	assert.match(
		COMMENT_SOURCE,
		/if \(!replyToggledRef\.current \|\| replyTarget !== null\) return;\s*activeReplyButtonRef\.current\?\.focus\(\);/u,
	);
});

test("disclosing Reply prefills a rich mention token for the target actor", () => {
	assert.match(COMPOSER_SOURCE, /prefillMentionRequest\?: \{ mention: RichTextMentionItem; requestKey: number; textAfter\?: string \}/u);
	assert.match(COMPOSER_SOURCE, /prefillMentionRequest=\{prefillMentionRequest\}/u);
	assert.match(COMMENT_SOURCE, /function getReplyMention\(actor: JiraActivityActor\): RichTextMentionItem/u);
	assert.match(COMMENT_SOURCE, /category === "human"|actor\.kind === "person"/u);
	assert.match(COMMENT_SOURCE, /prefillMentionRequest=\{replyMentionRequest\}/u);
	assert.doesNotMatch(COMMENT_SOURCE, /setReplyDraft\(`@\$\{actor\.name\} `\)/u);
	assert.match(COMMENT_SOURCE, /setReplyTarget\(\{ key, actor, initialDraft: "" \}\);\s*setReplyDraft\(""\);/u);
	assert.match(PROMPT_INPUT_SOURCE, /prefillValueSyncGuardKeyRef\.current = requestKey;/u);
	assert.match(PROMPT_INPUT_SOURCE, /editor\.createNodeViews\(\);/u);
	assert.match(
		PROMPT_INPUT_SOURCE,
		/if \(initial && !prefillMentionRequestRef\.current\) \{\s*setComposerPlainText\(activeEditor, initial\);/u,
	);
	assert.match(
		PROMPT_INPUT_SOURCE,
		/prefillMentionRequest\?\.requestKey === prefillValueSyncGuardKeyRef\.current[\s\S]*currentText !== resolvedValue[\s\S]*return;/u,
	);
});

function renderReplyPreview(replyPreviewCount) {
	const actor = { id: "viewer", kind: "person", name: "Annie Cook" };
	return renderComponent({
		entry: "components/blocks/jira-activity/index.tsx",
		exportName: "JiraActivity",
		props: {
			composer: null,
			currentUser: actor,
			hideHeader: true,
			entries: [{
				id: "discussion",
				kind: "comment",
				actor,
				timestamp: "1 hour ago",
				body: [{ type: "text", text: "A thread with three replies" }],
				defaultRepliesExpanded: false,
				replyPreviewCount,
				replies: [
					{ id: "earliest", actor, timestamp: "30 minutes ago", body: "Earliest reply" },
					{ id: "middle", actor, timestamp: "20 minutes ago", body: "Middle reply" },
					{ id: "latest", actor, timestamp: "10 minutes ago", body: "Latest reply" },
				],
			}],
			renderReplyBody(reply) {
				return React.createElement("a", { href: `#${reply.id}` }, reply.body);
			},
		},
	});
}

test("reply previews keep the latest replies reachable and toggle earlier replies before the group", async () => {
	const view = await renderReplyPreview(1);
	const replies = view.getByRole("group", { name: "Replies" });
	const toggle = view.getByRole("button", { name: "Show more replies" });
	assert.equal(toggle.getAttribute("aria-controls"), replies.id);
	assert.equal(toggle.getAttribute("aria-expanded"), "false");
	assert.equal(Boolean(toggle.compareDocumentPosition(replies) & Node.DOCUMENT_POSITION_FOLLOWING), true);
	assert.equal(replies.hidden, false);
	assert.equal(view.queryByRole("button", { name: "Show all replies" }), null);
	assert.equal(view.queryByRole("link", { name: "Earliest reply" }), null);
	assert.equal(view.queryByRole("link", { name: "Middle reply" }), null);
	assert.equal(view.queryByRole("link", { name: "Latest reply" }) !== null, true);
	assert.equal(view.tabOrder().includes("Earliest reply"), false);
	assert.equal(view.tabOrder().includes("Latest reply"), true);
	await view.click(toggle);
	assert.equal(view.getByRole("button", { name: "Hide earlier replies" }).getAttribute("aria-expanded"), "true");
	assert.equal(view.queryByRole("link", { name: "Earliest reply" }) !== null, true);
	assert.equal(view.queryByRole("link", { name: "Middle reply" }) !== null, true);
	await view.click(view.getByRole("button", { name: "Hide earlier replies" }));
	assert.equal(view.queryByRole("link", { name: "Earliest reply" }), null);
	assert.equal(view.tabOrder().includes("Middle reply"), false);
	assert.equal(view.queryByRole("link", { name: "Latest reply" }) !== null, true);
	assert.equal(view.isFocused(view.getByRole("button", { name: "Show more replies" })), true);
});

test("reply preview counts choose the last N replies and collapse-all stays the default", async () => {
	const preview = await renderReplyPreview(2);
	assert.equal(preview.queryByRole("link", { name: "Earliest reply" }), null);
	assert.equal(preview.queryByRole("link", { name: "Middle reply" }) !== null, true);
	assert.equal(preview.queryByRole("link", { name: "Latest reply" }) !== null, true);
	await preview.unmount();
	const view = await renderReplyPreview(undefined);
	assert.equal(view.queryByRole("button", { name: "Show more replies" }), null);
	assert.equal(view.queryByRole("group", { name: "Replies" }), null);
	assert.equal(view.tabOrder().includes("Latest reply"), false);
	await view.click(view.getByRole("button", { name: "Show all replies" }));
	assert.equal(view.queryByRole("link", { name: "Earliest reply" }) !== null, true);
	assert.equal(view.queryByRole("link", { name: "Latest reply" }) !== null, true);
	await view.click(view.getByRole("button", { name: "Hide all replies" }));
	assert.equal(view.queryByRole("group", { name: "Replies" }), null);
	assert.equal(view.tabOrder().includes("Earliest reply"), false);
});

function renderControlledReplyDraft(initialDraft) {
	return renderComponent({
		source: `import React, { useState } from "react";
			import { JiraActivity } from "@/components/blocks/jira-activity";
			const actor = { id: "annie", kind: "person", name: "Annie Cook" };
			const entries = [{ id: "discussion", kind: "comment", actor, timestamp: "1 hour ago", body: [{ type: "text", text: "Discuss onboarding recovery" }] }];
			export default function ControlledReplyDraft({ initialDraft }) {
				const [drafts, setDrafts] = useState({ discussion: initialDraft });
				return <JiraActivity composer={null} currentUser={actor} entries={entries} hideHeader replyDrafts={drafts} onReplyDraftChange={(entryId, value) => setDrafts((current) => ({ ...current, [entryId]: value }))} />;
			}`,
		props: { initialDraft },
	});
}

test("opening a controlled reply preserves a saved draft and prefills a mention only when empty", async () => {
	const saved = await renderControlledReplyDraft("Keep the recovery copy and the existing links");
	await saved.click(saved.getByRole("button", { name: "Reply" }));
	const savedEditor = saved.getByRole("textbox", { name: "Leave a reply..." });
	assert.equal(savedEditor.textContent, "Keep the recovery copy and the existing links");
	assert.equal(savedEditor.querySelector("[data-mention-category]") !== null, false);
	await saved.click(saved.getByRole("button", { name: "Reply" }));
	await saved.click(saved.getByRole("button", { name: "Reply" }));
	assert.equal(saved.getByRole("textbox", { name: "Leave a reply..." }).textContent, "Keep the recovery copy and the existing links");
	await saved.unmount();
	const empty = await renderControlledReplyDraft("");
	await empty.click(empty.getByRole("button", { name: "Reply" }));
	const emptyEditor = empty.getByRole("textbox", { name: "Leave a reply..." });
	assert.equal(emptyEditor.textContent.trim(), "Annie Cook");
	assert.equal(emptyEditor.querySelector('[data-mention-category="human"]') !== null, true);
});

function renderThreadConnectors(connectorStyle, fadeAfterLast = false) {
	const actor = { id: "thread-author", name: "Annie Cook", kind: "person" };
	return renderComponent({
		entry: "components/blocks/jira-activity/index.tsx",
		exportName: "JiraActivity",
		props: {
			connectorStyle,
			fadeAfterLast,
			composer: null,
			hideHeader: true,
			currentUser: actor,
			entries: [
				{ id: "thread", kind: "comment", actor, timestamp: "1h", body: [{ type: "text", text: "Threaded discussion" }], defaultRepliesExpanded: false, replyPreviewCount: 1, replies: [
					{ id: "first", actor, timestamp: "30m", body: "Earlier reply" },
					{ id: "last", actor, timestamp: "20m", body: "Latest reply" },
				] },
				{ id: "standalone", kind: "comment", actor, timestamp: "10m", body: [{ type: "text", text: "Unrelated standalone comment" }] },
			],
		},
	});
}

test("thread connectors branch only inside discussions while the spine continues to the next row", async () => {
	const view = await renderThreadConnectors("thread");
	const thread = document.querySelector('[data-jira-activity-entry-id="thread"]');
	const standalone = document.querySelector('[data-jira-activity-entry-id="standalone"]');
	const visibleBranches = () => [...thread.querySelectorAll("[data-jira-activity-thread-branch]")].filter((node) => !node.closest("[hidden]"));
	assert.equal(thread.querySelector("[data-jira-activity-thread-stem]") !== null, true);
	assert.equal(standalone.querySelector("[data-jira-activity-thread-stem]") === null, true);
	// One continuous spine: every row but the last runs a thread-toned stem on to the next row, past its reply branches.
	const stems = [...document.querySelectorAll("[data-jira-activity-timeline-stem]")];
	assert.equal(stems.length, 1);
	assert.equal(thread.contains(stems[0]), true);
	assert.equal(stems[0].classList.contains("bg-bg-accent-gray-subtler"), true);
	assert.equal(visibleBranches().length, 1, "only the latest reply branches from the timeline");
	assert.equal(visibleBranches().at(-1).parentElement.querySelector("[data-jira-activity-thread-continuation]") === null, true);
	assert.equal(visibleBranches().every((branch) => branch.getAttribute("aria-hidden") === "true"), true);
	const replyToggleIcon = thread.querySelector("[data-jira-activity-reply-toggle-icon]");
	assert.equal(replyToggleIcon.getAttribute("aria-hidden"), "true");
	assert.equal(replyToggleIcon.classList.contains("bg-surface"), true);
	assert.equal(replyToggleIcon.closest("button") === view.getByRole("button", { name: "Show more replies" }), true);
	await view.click(replyToggleIcon);
	assert.equal(visibleBranches().length, 2);
	await view.click(view.getByRole("button", { name: "Hide earlier replies" }));
	assert.equal(visibleBranches().length, 1);
	assert.equal(view.isFocused(view.getByRole("button", { name: "Show more replies" })), true);
	await view.click(view.getAllByRole("button", { name: "Reply" }).at(-1));
	assert.equal(standalone.querySelector("[data-jira-activity-thread-stem]") !== null, true);
	assert.equal(standalone.querySelectorAll("[data-jira-activity-thread-branch]").length, 1, "reply composer joins its parent thread");
});

test("the default activity connector remains a continuous timeline", async () => {
	await renderThreadConnectors(undefined);
	assert.equal(document.querySelectorAll("[data-jira-activity-timeline-stem]").length, 1);
	assert.equal(document.querySelector("[data-jira-activity-thread-branch]") === null, true);
	assert.equal(document.querySelector("[data-jira-activity-thread-stem]") === null, true);
});

test("the final timeline entry continues into a decorative fade when requested", async () => {
	await renderThreadConnectors("thread", true);
	const lastEntry = document.querySelector('[data-jira-activity-entry-id="standalone"]');
	const stem = lastEntry.querySelector("[data-jira-activity-timeline-stem]");
	const fade = document.querySelector("[data-jira-activity-end-fade]");
	assert.equal(stem !== null, true);
	assert.equal(fade.getAttribute("aria-hidden"), "true");
	assert.equal(lastEntry.contains(fade), true);
});


test("comment and reply headers share the selected inline layout while retaining stacked defaults", async () => {
	const view = await renderComponent({
		source: `import React from "react";
			import { JiraActivity } from "@/components/blocks/jira-activity";
			const actor = { id: "author", name: "Parent author", kind: "person" };
			const entries = [{ id: "thread", kind: "comment", actor, timestamp: "1h", body: [{ type: "text", text: "Discussion" }], replies: [{ id: "reply", actor: { ...actor, id: "reply-author", name: "Reply author" }, timestamp: "30m", body: "Reply body" }] }];
			export default function HeaderTest(props) { return <JiraActivity entries={entries} composer={null} hideHeader {...props} />; }`,
	});
	const sameLineOwner = (author, timestamp) => view.getByText(author).parentElement === view.getByText(timestamp).parentElement;
	assert.equal(sameLineOwner("Parent author", "1h"), false);
	assert.equal(sameLineOwner("Reply author", "30m"), false);
	await view.rerender({ commentHeaderLayout: "inline" });
	assert.equal(sameLineOwner("Parent author", "1h"), true);
	assert.equal(sameLineOwner("Reply author", "30m"), true);
});
