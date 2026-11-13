const assert = require("node:assert/strict");
const test = require("node:test");
const React = require("react");
const { renderComponent } = require("../../scripts/lib/render-component.js");

const STORAGE_KEY = "vpk:studio:session-agents:v1";
const DEBOUNCE_MS = 900;
const CSS_MODULE = "export default new Proxy({}, { get: (_, key) => String(key) });";

// A persisted draft agent, in the shape `writeSessionAgentRecords` stores.
const PERSISTED_RESULT = { action: "create", agentId: "persisted-agent", name: "Persisted Agent", summary: "Already saved" };
const PERSISTED_RECORD = {
	draftResult: PERSISTED_RESULT,
	lastTouchedAt: 1,
	profileId: "persisted-agent",
	publishReadyResult: PERSISTED_RESULT,
	publishStatus: "testing",
	publishedResult: null,
	resultKey: "persisted-agent::1",
	sourceResult: PERSISTED_RESULT,
};

// The seeding child registers and publishes an agent in its mount effect, as the Studio
// shell's RFP demo seed does; with `late` it waits for a click, after the provider rehydrated.
const PROBE = `import { useEffect, useRef } from "react";
	import { RovoChatProvider, useRovoChat } from "@/app/contexts/context-rovo-chat";
	function Seeder({ late }) {
		const chat = useRovoChat();
		const seeded = useRef(false);
		const seed = () => {
			if (seeded.current) return;
			seeded.current = true;
			const profile = chat.registerCreatedAgentFromResult({ action: "create", name: "Seeded Demo Agent", summary: "Seeded on mount" }, { preserveCurrentThread: true, select: false, sourceKey: "seed-demo" });
			if (profile) {
				chat.commitSessionAgentPublishReady(profile.id);
				chat.publishSessionAgent(profile.id);
			}
		};
		useEffect(() => {
			if (!late) seed();
		});
		return late ? <button type="button" onClick={seed}>Seed now</button> : null;
	}
	function Agents() {
		const chat = useRovoChat();
		return <p>{chat.sessionAgentEntries.map((entry) => entry.profile.name).sort().join(",")}|{chat.sessionAgentSaveStatus}</p>;
	}
	export default function Probe({ seeding = "mount" }) {
		return <RovoChatProvider>
			{seeding === "none" ? null : <Seeder late={seeding === "late"} />}
			<Agents />
		</RovoChatProvider>;
	}`;

async function advance(context, ms) {
	let elapsed = 0;
	do {
		const slice = Math.min(100, ms - elapsed);
		await React.act(async () => {
			context.mock.timers.tick(slice);
		});
		elapsed += slice;
	} while (elapsed < ms);
}

async function renderSeed(context, { persisted, seeding }) {
	window.localStorage.clear();
	if (persisted) {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify([PERSISTED_RECORD]));
	}
	context.mock.timers.enable({ apis: ["setTimeout", "Date"], now: Date.parse("2026-11-13T09:00:00.000Z") });
	const view = await renderComponent({
		mocks: {
			"@/components/projects/shared/components/chat-messages.module.css": CSS_MODULE,
			"@/components/projects/sidebar-chat/chat.module.css": CSS_MODULE,
		},
		props: { seeding },
		source: PROBE,
	});
	await advance(context, 0);
	return {
		read: () => view.container.querySelector("p").textContent,
		stored: () => JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]").map((record) => record.draftResult.name).sort().join(","),
		view,
	};
}

test("a mount-time seed survives the rehydrate of a persisted agent, in state and in storage", async (context) => {
	const probe = await renderSeed(context, { persisted: true, seeding: "mount" });
	assert.equal(probe.read().split("|")[0], "Persisted Agent,Seeded Demo Agent");
	await advance(context, DEBOUNCE_MS);
	assert.equal(probe.stored(), "Persisted Agent,Seeded Demo Agent");
	assert.equal(probe.read(), "Persisted Agent,Seeded Demo Agent|saved", "the seed's visible save lands as Saved");
});

test("a seed that arrives after the rehydrate keeps both agents too", async (context) => {
	const probe = await renderSeed(context, { persisted: true, seeding: "late" });
	assert.equal(probe.read(), "Persisted Agent|idle", "a rehydrate alone is silent");
	await probe.view.click(probe.view.getByRole("button", { name: "Seed now" }));
	await advance(context, DEBOUNCE_MS);
	assert.equal(probe.read(), "Persisted Agent,Seeded Demo Agent|saved");
	assert.equal(probe.stored(), "Persisted Agent,Seeded Demo Agent");
});

test("with empty storage the seed survives as before", async (context) => {
	const probe = await renderSeed(context, { persisted: false, seeding: "mount" });
	assert.equal(probe.read().split("|")[0], "Seeded Demo Agent");
	await advance(context, DEBOUNCE_MS);
	assert.equal(probe.stored(), "Seeded Demo Agent");
});

test("a rehydrate with no seeding child is silent and writes the persisted agent back unchanged", async (context) => {
	const probe = await renderSeed(context, { persisted: true, seeding: "none" });
	assert.equal(probe.read(), "Persisted Agent|idle");
	await advance(context, DEBOUNCE_MS);
	assert.equal(probe.read(), "Persisted Agent|idle");
	assert.equal(probe.stored(), "Persisted Agent");
});
