const assert = require("node:assert/strict");
const test = require("node:test");

async function loadFace() {
	return import("./pulse-work-item-face.ts");
}

const jordan = {
	avatarSrc: "/avatar-user/issac-varghese/color/asow-dev-lime.png",
	id: "jordan",
	kind: "human",
	name: "Jordan Okafor",
	role: "Senior engineer",
};
const venn = {
	avatarSrc: "/avatar-user/venn/venn.png",
	id: "venn",
	kind: "human",
	name: "Venn",
	role: "Software engineer",
};
const releaseAgent = {
	avatarSrc: "/avatar-agent-new/orange/research-scout.svg",
	id: "release-agent",
	kind: "agent",
	name: "Release Captain Agent",
	role: "Owns the flag and the rollout",
};

const pay101 = {
	assigneeAvatarSrc: jordan.avatarSrc,
	assigneeId: "jordan",
	assigneeName: jordan.name,
	key: "PAY-101",
	memberIds: ["jordan", "venn"],
	priority: "medium",
	status: "Done",
	summary: "Inventory every v1 call site across services and name an owner for each",
	tags: [],
};

const pay121 = {
	assigneeAvatarSrc: releaseAgent.avatarSrc,
	assigneeId: "release-agent",
	assigneeName: releaseAgent.name,
	key: "PAY-121",
	memberIds: ["release-agent", "venn"],
	priority: "major",
	status: "In review",
	summary: "payments_sdk_v2_rollout: targeting rules plus a per-account kill switch",
	tags: [],
};

const memberLookup = new Map([jordan, venn, releaseAgent].map((member) => [member.id, member]));

test("a member filter puts that person on every work-item card, including PAY-101", async () => {
	const { resolvePulseWorkItemFace } = await loadFace();
	const face = resolvePulseWorkItemFace(pay101, memberLookup, venn);

	assert.equal(face.name, "Venn");
	assert.equal(face.avatarSrc, venn.avatarSrc);
	assert.equal(face.kind, "human");
	assert.equal(
		resolvePulseWorkItemFace(pay121, memberLookup, venn).avatarSrc,
		venn.avatarSrc,
		"PAY-121 also wears Venn while the filter is on",
	);
});

test("clearing the filter restores the Jira assignee", async () => {
	const { resolvePulseWorkItemFace } = await loadFace();

	assert.deepEqual(resolvePulseWorkItemFace(pay101, memberLookup, null), {
		avatarSrc: jordan.avatarSrc,
		kind: "human",
		name: jordan.name,
	});
	assert.deepEqual(resolvePulseWorkItemFace(pay121, memberLookup), {
		avatarSrc: releaseAgent.avatarSrc,
		kind: "agent",
		name: releaseAgent.name,
	});
});
