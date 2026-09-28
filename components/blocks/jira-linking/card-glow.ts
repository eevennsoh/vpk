import {
	JIRA_LINKING_GLOW_FADE_DURATION_MS,
	JIRA_LINKING_GLOW_PULSE_DURATION_MS,
	resolveJiraLinkingGlowPulseColor,
	resolveJiraLinkingGlowShadow,
} from "./glow-motion";

export interface JiraCardGlowEffect {
	animation: Animation;
	restore: () => void;
}

/** Shared linking acknowledgement, attached to the real card so it follows layout. */
export function createJiraLinkingCardGlow({
	haloRoot,
	backdropRoot,
	color,
	fallbackStyle,
}: Readonly<{
	haloRoot: Element;
	backdropRoot: Element | null;
	color: string;
	fallbackStyle?: Partial<CSSStyleDeclaration>;
}>): JiraCardGlowEffect[] {
	const doc = haloRoot.ownerDocument;
	const halo = doc.createElement("div");
	halo.setAttribute("aria-hidden", "true");
	halo.setAttribute("data-jira-linking-glow-halo", "");
	halo.className = "pointer-events-none absolute -inset-px rounded-[inherit]";
	Object.assign(halo.style, fallbackStyle, { opacity: "0", boxShadow: resolveJiraLinkingGlowShadow(color) });
	haloRoot.append(halo);
	const effects = [{
		animation: halo.animate([{ opacity: 1 }, { opacity: 0 }], { duration: JIRA_LINKING_GLOW_FADE_DURATION_MS, easing: "ease-out", fill: "forwards" }),
		restore: () => halo.remove(),
	}];
	if (backdropRoot) {
		const backdrop = doc.createElement("div");
		backdrop.setAttribute("aria-hidden", "true");
		backdrop.setAttribute("data-jira-linking-glow-backdrop", "");
		backdrop.setAttribute("data-jira-linking-glow-direction", "bottom-to-top");
		backdrop.className = "pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]";
		const pulse = doc.createElement("div");
		pulse.className = "absolute inset-x-0 h-full";
		Object.assign(pulse.style, {
			top: "100%",
			transform: "translateY(0)",
			willChange: "transform",
			background: `linear-gradient(0deg, transparent 0%, ${resolveJiraLinkingGlowPulseColor(color)} 50%, transparent 100%)`,
		});
		backdrop.append(pulse);
		backdropRoot.append(backdrop);
		effects.push({
			animation: pulse.animate([{ transform: "translateY(0)" }, { transform: "translateY(-200%)" }], {
				duration: JIRA_LINKING_GLOW_PULSE_DURATION_MS, easing: "cubic-bezier(0.4, 0, 0.2, 1)", fill: "forwards",
			}),
			restore: () => backdrop.remove(),
		});
	}
	return effects;
}
