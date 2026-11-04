import assert from "node:assert/strict";
import test from "node:test";

import { PROJECT_BUTTER_ATTACHMENTS } from "./attachment-data.ts";
import { attachmentComposerChoices, attachmentFallbackChoice, attachmentFromChoice } from "./attachment-catalog.ts";
import { attachmentDisplayName, attachmentFromFile, attachmentShortDate, attachmentType, deriveDisplayName, effectiveAttachmentFilter, filterAttachments, groupProjectButterAttachments, mergeAttachments, sortAttachments, visibleAttachmentFilters } from "./attachment-model.ts";

const stamp = { id: "new", now: "2026-11-03T10:00:00.000Z" };

test("deriveDisplayName reads the slug, skips routing words, and falls back to the host", () => {
	assert.equal(deriveDisplayName(new URL("https://acme.com/wiki/spaces/X/pages/123/Launch-plan")), "Launch plan");
	assert.equal(deriveDisplayName(new URL("https://docs.google.com/document/d/1wbrX9k2f/edit")), "Work item proposal");
	assert.equal(deriveDisplayName(new URL("https://github.com/acme/repo/pull/42")), "Repo");
	assert.equal(deriveDisplayName(new URL("https://www.example.com/a3f91c/1234")), "example.com");
	assert.equal(deriveDisplayName(new URL("https://files.acme.com/share/Q3_budget%20review.xlsx")), "Q3 budget review");
	assert.equal(deriveDisplayName(new URL(`https://acme.com/${"very-long-title-".repeat(5)}`)), "acme.com");
});

test("type, display name and short date follow the reference rules", () => {
	const [strategy, draft, drive, loom, hero, , link] = PROJECT_BUTTER_ATTACHMENTS;
	assert.deepEqual([strategy, draft, drive, loom, hero, link].map((item) => item && attachmentType(item)), ["document", "document", "document", "video", "image", "link"]);
	assert.equal(draft && attachmentDisplayName(draft), "Social Media Campaign Draft.pdf");
	assert.equal(attachmentDisplayName({ kind: "google-drive", name: "Brand Asset Guidelines 2026", extension: "gdoc" }), "Brand Asset Guidelines 2026", "provider content hides its extension");
	assert.equal(attachmentShortDate("2026-03-01T09:00:00Z"), "Mar 1");
});

test("reference data sorts by updatedAt and piles into Documents 4, Videos 2 plus two singles", () => {
	const sorted = sortAttachments([...PROJECT_BUTTER_ATTACHMENTS].reverse());
	assert.deepEqual(sorted.map((item) => item.id).slice(0, 2), ["marketing-strategy", "campaign-draft"]);
	assert.equal(sorted.at(-1)?.name, "Team Offsite Recap");
	const { piles, singles } = groupProjectButterAttachments(sorted);
	assert.deepEqual(piles.map((pile) => `${pile.label} ${pile.items.length}`), ["Documents 4", "Videos 2"]);
	assert.deepEqual(singles.map((item) => item.id), ["hero-image", "analysis-link"]);
	assert.equal(filterAttachments(sorted, "Documents").length, 4);
});

test("filter tabs: all five when filled, present types only in the Empty preset", () => {
	assert.deepEqual(visibleAttachmentFilters(PROJECT_BUTTER_ATTACHMENTS, false), ["All", "Documents", "Images", "Videos", "Links"]);
	const doc = attachmentFromFile({ name: "Plan.pdf", type: "application/pdf" }, stamp);
	assert.deepEqual(visibleAttachmentFilters([doc], true), [], "one type bucket shows no tabs");
	const image = attachmentFromFile({ name: "Shot.png", type: "image/png" }, { ...stamp, id: "image" });
	assert.deepEqual(visibleAttachmentFilters([doc, image], true), ["All", "Documents", "Images"]);
	assert.equal(effectiveAttachmentFilter("Videos", ["All", "Documents", "Images"]), "All");
});

test("files split their extension and duplicates are dropped by id or name and type", () => {
	const file = attachmentFromFile({ name: "Report.final.pdf", type: "application/pdf" }, stamp);
	assert.deepEqual([file.name, file.extension, file.kind, file.addedBy, file.updatedAt], ["Report.final", "pdf", "file", "Annie Cook", stamp.now]);
	const again = attachmentFromFile({ name: "Report.final.pdf", type: "application/pdf" }, { ...stamp, id: "other" });
	const merged = mergeAttachments([file], [again, { ...file }]);
	assert.equal(merged.items.length, 1);
	assert.equal(merged.added.length, 0);
	const fresh = mergeAttachments([file], [attachmentFromFile({ name: "Other.pdf", type: "application/pdf" }, { ...stamp, id: "x" })]);
	assert.deepEqual(fresh.items.map((item) => item.id), ["x", "new"], "new items are prepended");
});

test("composer choices: catalog matches, Create, links, and taken names", () => {
	const names = PROJECT_BUTTER_ATTACHMENTS.map(attachmentDisplayName);
	assert.deepEqual(attachmentComposerChoices("Brand", names).map((choice) => choice.kind === "create" ? `Create "${choice.label}"` : choice.label), ["Brand Campaign Brief 2026", 'Create "Brand"']);
	assert.deepEqual(attachmentComposerChoices("", names), []);
	assert.equal(attachmentComposerChoices("Q1 Marketing", names).some((choice) => choice.label === "Q1 Marketing Strategy & Goals"), false, "attached names never match");
	assert.deepEqual(attachmentComposerChoices("q1 marketing strategy & goals", names), [], "an attached name suppresses Create");
	assert.deepEqual(attachmentComposerChoices("Competitor Analysis", names).map((choice) => choice.kind), ["existing"], "an exact match suppresses Create");
	const [link] = attachmentComposerChoices("https://acme.com/wiki/spaces/X/pages/1/Launch-plan", names);
	assert.equal(link?.kind === "link" && link.label, "Launch plan");
	assert.deepEqual(attachmentComposerChoices("https://acme.com/wiki/spaces/X/pages/1/Launch-plan", [...names, "Launch plan"]), [], "an attached link offers nothing");
	assert.equal(attachmentFallbackChoice("Launch plan", ["launch plan"]), undefined);
});

test("committed choices map onto attachments: Loom to Videos, Create to a Confluence page", () => {
	const [loom] = attachmentComposerChoices("Feature Walk", []);
	assert.ok(loom);
	const video = attachmentFromChoice(loom, stamp);
	assert.deepEqual([video.kind, attachmentType(video), video.url], ["loom", "video", "https://www.loom.com/"]);
	const [create] = attachmentComposerChoices("Kickoff notes", []);
	assert.ok(create);
	const page = attachmentFromChoice(create, stamp);
	assert.deepEqual([page.kind, page.objectType, page.name, page.url], ["confluence", "page", "Kickoff notes", "https://atlassian.net/wiki/search?text=Kickoff%20notes"]);
	const [whiteboard] = attachmentComposerChoices("Design System", []);
	assert.ok(whiteboard);
	assert.equal(attachmentType(attachmentFromChoice(whiteboard, stamp)), "document");
});
