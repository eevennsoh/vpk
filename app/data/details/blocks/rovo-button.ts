import type { ComponentDetail } from "@/app/data/component-detail-types";

export const ROVO_BUTTON_DETAIL: ComponentDetail = {
	apiName: "FloatingRovoButton",
	description: "A draggable floating launcher for Rovo chat. It can also show a persistent action toolbar, a proactive suggestion, daily insights, or an agent onboarding panel.",
	demoLayout: { previewHeight: "fixed", examplesContentWidth: "full" },
	importStatement: `import FloatingRovoButton from "@/components/blocks/rovo-button";`,
	usage: `import { RovoChatProvider, useRovoChatControls } from "@/app/contexts";
import FloatingRovoButton from "@/components/blocks/rovo-button";
import RovoFloatingChat from "@/components/projects/rovo-floating-chat/components/rovo-floating-chat";

function Launcher() {
	const { chatSurface } = useRovoChatControls();
	return (
		<>
			<FloatingRovoButton product="jira" />
			{chatSurface === "floating" ? <RovoFloatingChat /> : null}
		</>
	);
}

<RovoChatProvider>
	<Launcher />
</RovoChatProvider>`,
	examples: [
		{ title: "Chat launcher", description: "The default button opens floating Rovo chat. Drag it to snap to a new position.", demoSlug: "rovo-button-demo-chat" },
		{ title: "Persistent toolbar", description: "Pass persistentBar to attach quick actions to the launcher. This example opens live chat from the voice action.", demoSlug: "rovo-button-demo-toolbar" },
		{ title: "Proactive suggestion", description: "Pass suggestion to show an actionable nudge. Select the launcher to replay the example.", demoSlug: "rovo-button-demo-proactive" },
		{ title: "Daily insights", description: "Pass insights to show an unread count and open the digest card. Dismissing it does not mark insights as read.", demoSlug: "rovo-button-demo-insights" },
		{ title: "Agent onboarding", description: "Pass onboarding to open an agent creation panel from the launcher.", demoSlug: "rovo-button-demo-onboarding" },
	],
	props: [
		{ name: "product", type: '"admin" | "agents" | "home" | "jira" | "confluence" | "rovo" | "search" | "studio"', required: true, description: "The host product. The launcher is hidden by default on Rovo and Studio surfaces." },
		{ name: "embedded", type: "boolean", default: "false", description: "Suppresses the launcher in an embedded product surface unless forceVisible is set." },
		{ name: "forceVisible", type: "boolean", default: "false", description: "Shows the launcher even when chat is open or the product normally suppresses it." },
		{ name: "ariaLabel", type: "string", description: "Accessible label for the launcher; defaults to the component's chat label." },
		{ name: "positioning", type: '"viewport" | "container"', default: '"viewport"', description: "Anchors the launcher to the window or its positioned container." },
		{ name: "placement", type: "FloatingRovoButtonPlacement", description: "Initial right and bottom offsets as CSS lengths. Dragging snaps the launcher to a 4 by 4 grid." },
		{ name: "onButtonClick", type: "() => void", description: "Overrides the default action of opening floating chat." },
		{ name: "persistentBar", type: "FloatingRovoButtonPersistentBar | null", description: "Adds a toolbar of actions attached to the launcher." },
		{ name: "suggestion", type: "FloatingRovoButtonSuggestion | null", description: "Shows an actionable nudge with selection and optional dismissal callbacks." },
		{ name: "insights", type: "FloatingRovoButtonInsightsConfig | null", description: "Shows an unread insights pill and digest. Onboarding takes precedence if both are supplied." },
		{ name: "onboarding", type: "FloatingRovoButtonOnboardingConfig | null", description: "Configures an agent onboarding panel. It shares the morphing surface with insights." },
	],
	subComponents: [
		{ name: "FloatingRovoButtonPersistentBar", description: "A toolbar configured with items, an optional ariaLabel, and side (auto, top, or bottom). Each item supplies an id, icon, ariaLabel, and optional tooltipLabel, onClick, and indicator." },
		{ name: "FloatingRovoButtonSuggestion", description: "An id, label, and onSelect callback, with optional icon, ariaLabel, and onDismiss callback." },
		{ name: "FloatingRovoButtonInsightsConfig", description: "An id, unread count, and rows, with optional overflow count, labels, callbacks, and controlled stage or defaultStage (hidden, pill, or card)." },
		{ name: "FloatingRovoButtonOnboardingConfig", description: "Panel content, action labels, optional artwork and status, callbacks, and controlled open or defaultOpen state." },
	],
};
