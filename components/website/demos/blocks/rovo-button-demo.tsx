"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { RovoChatProvider } from "@/app/contexts";
import { JiraFloatingSuggestions } from "@/components/blocks/jira-suggestion";
import { SUGGESTION_WORK_ITEM, WORK_ITEM_SUGGESTIONS } from "@/components/blocks/jira-suggestion/data/suggestions";
import { useSuggestionReview } from "@/components/blocks/jira-suggestion/hooks/use-suggestion-review";
import type { RovoButtonDemoVariantId } from "./rovo-button/demo-types";
import RovoButtonPage from "./rovo-button/page";
import { useProjectDemoEmbedded } from "../projects/use-project-demo-embedded";

export default function RovoButtonDemo() {
	const embedded = useProjectDemoEmbedded();
	const pathname = usePathname();
	const embeddedHeight = pathname.startsWith("/components/") ? "parent" : "viewport";

	return <RovoButtonPage embedded={embedded} embeddedHeight={embeddedHeight} />;
}

function RovoButtonExample({ variant }: Readonly<{ variant: RovoButtonDemoVariantId }>) {
	return (
		<RovoChatProvider>
			<div className={variant === "onboarding" ? "relative h-[560px] w-full" : "relative h-[400px] w-full"}>
				<RovoButtonPage embedded embeddedHeight="parent" variant={variant} />
			</div>
		</RovoChatProvider>
	);
}

export function RovoButtonDemoChat() { return <RovoButtonExample variant="chat" />; }
export function RovoButtonDemoToolbar() { return <RovoButtonExample variant="toolbar" />; }
const demoSuggestions = WORK_ITEM_SUGGESTIONS.filter((suggestion) => suggestion.id !== "acceptanceCriteria");
const DEMO_RUN_AT = Date.now();

function RovoButtonPanelExample({ variant }: Readonly<{ variant: "button" | "dot" }>) {
	const [container, setContainer] = useState<HTMLDivElement | null>(null);
	const review = useSuggestionReview(demoSuggestions);
	return (
		<RovoChatProvider>
			<div className="relative h-[600px] w-full" ref={setContainer}>
				{container ? <JiraFloatingSuggestions
					feed={{ review, status: "idle", runs: [{ number: 1, at: DEMO_RUN_AT, ids: [] }], newIds: new Set(), acknowledgeNew: () => {}, rerun: () => {}, cancelRerun: () => {}, hasMore: false }}
					panelTransition={variant}
					portalContainer={container}
					workItemKey={SUGGESTION_WORK_ITEM.key}
				/> : null}
			</div>
		</RovoChatProvider>
	);
}
export function RovoButtonDemoDot() { return <RovoButtonPanelExample variant="dot" />; }
export function RovoButtonDemoButtonTransition() { return <RovoButtonPanelExample variant="button" />; }
export function RovoButtonDemoProactive() { return <RovoButtonExample variant="proactive" />; }
export function RovoButtonDemoInsights() { return <RovoButtonExample variant="insights" />; }
export function RovoButtonDemoOnboarding() { return <RovoButtonExample variant="onboarding" />; }
