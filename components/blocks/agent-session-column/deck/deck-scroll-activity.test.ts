import assert from "node:assert/strict";
import test from "node:test";

import { AGENT_SESSION_DECK_SCROLLING_ATTRIBUTE, AGENT_SESSION_DECK_SCROLL_IDLE_FALLBACK_MS, subscribeToAgentSessionDeckScrollActivity } from "./deck-scroll-activity.ts";

class FakeScrollPort extends EventTarget {
	readonly attributes = new Set<string>();

	hasAttribute(name: string): boolean {
		return this.attributes.has(name);
	}

	toggleAttribute(name: string, force?: boolean): boolean {
		const next = force ?? !this.attributes.has(name);
		if (next) {
			this.attributes.add(name);
		} else {
			this.attributes.delete(name);
		}
		return next;
	}
}

class FakeNativeScrollPort extends FakeScrollPort {
	onscrollend: ((event: Event) => void) | null = null;
}

test("native scrollend support never falls back mid-gesture", async () => {
	const port = new FakeNativeScrollPort();
	const unsubscribe = subscribeToAgentSessionDeckScrollActivity(port);

	port.dispatchEvent(new Event("scroll"));
	assert.equal(port.hasAttribute(AGENT_SESSION_DECK_SCROLLING_ATTRIBUTE), true);
	await new Promise((resolve) => {
		setTimeout(resolve, AGENT_SESSION_DECK_SCROLL_IDLE_FALLBACK_MS + 20);
	});
	assert.equal(port.hasAttribute(AGENT_SESSION_DECK_SCROLLING_ATTRIBUTE), true);

	port.dispatchEvent(new Event("scrollend"));
	assert.equal(port.hasAttribute(AGENT_SESSION_DECK_SCROLLING_ATTRIBUTE), false);
	unsubscribe();
});

test("scroll activity resumes after a quiet-period fallback", async () => {
	const port = new FakeScrollPort();
	const unsubscribe = subscribeToAgentSessionDeckScrollActivity(port);

	port.dispatchEvent(new Event("scroll"));
	await new Promise((resolve) => {
		setTimeout(resolve, AGENT_SESSION_DECK_SCROLL_IDLE_FALLBACK_MS + 20);
	});

	assert.equal(port.hasAttribute(AGENT_SESSION_DECK_SCROLLING_ATTRIBUTE), false);
	unsubscribe();
});

test("cleanup restores row hit-testing and removes the listeners", () => {
	const port = new FakeScrollPort();
	const unsubscribe = subscribeToAgentSessionDeckScrollActivity(port);

	port.dispatchEvent(new Event("scroll"));
	unsubscribe();
	assert.equal(port.hasAttribute(AGENT_SESSION_DECK_SCROLLING_ATTRIBUTE), false);

	port.dispatchEvent(new Event("scroll"));
	assert.equal(port.hasAttribute(AGENT_SESSION_DECK_SCROLLING_ATTRIBUTE), false);
});
