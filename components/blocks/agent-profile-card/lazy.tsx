"use client";

import dynamic from "next/dynamic";

// The agent profile card ends in a prompt composer, which brings the Tiptap runtime. Hover previews
// that may show it render this deferred copy and call preloadAgentProfileCard() when the surface that
// holds the preview mounts. Their popups are transparent until the card arrives, so a late load shows
// nothing rather than an empty frame.

const loadAgentProfileCard = () => import("./components/agent-profile-card");

export function preloadAgentProfileCard(): void {
	void loadAgentProfileCard();
}

export const LazyAgentProfileCard = dynamic(() => loadAgentProfileCard().then((module) => module.AgentProfileCard));
