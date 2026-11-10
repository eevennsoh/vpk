import {
	JIRA_LINKING_GLOW_FADE_DURATION_MS,
	JIRA_LINKING_GLOW_PULSE_DURATION_MS,
	resolveJiraLinkingGlowPulseColor,
	resolveJiraLinkingGlowShadow,
} from "./glow-motion";
import { AGENT_SESSION_GLOW_STYLE } from "../agent-session/agent-session-glow";
import { referenceEase } from "@/lib/motion";

const GLOW_SWEEP_EASING = `cubic-bezier(${referenceEase.agentInvocationHandoff.join(",")})`;

export interface JiraCardGlowEffect {
	animation: Animation;
	restore: () => void;
}

/** Shared linking acknowledgement, attached to the real card so it follows layout. */
export function createJiraLinkingCardGlow({
	haloRoot,
	backdropRoot,
	color,
	direction = "bottom-to-top",
	trace = false,
	contained = false,
	fallbackStyle,
}: Readonly<{
	haloRoot: Element;
	backdropRoot: Element | null;
	color: string;
	direction?: "bottom-to-top" | "left-to-right";
	trace?: boolean;
	contained?: boolean;
	fallbackStyle?: Partial<CSSStyleDeclaration>;
}>): JiraCardGlowEffect[] {
	const doc = haloRoot.ownerDocument;
	const effects: JiraCardGlowEffect[] = [];
	if (!contained) {
		const halo = doc.createElement("div");
		halo.setAttribute("aria-hidden", "true");
		halo.setAttribute("data-jira-linking-glow-halo", "");
		halo.className = "pointer-events-none absolute -inset-px rounded-[inherit]";
		Object.assign(halo.style, fallbackStyle, { opacity: "0", boxShadow: resolveJiraLinkingGlowShadow(color) });
		haloRoot.append(halo);
		effects.push({
			animation: halo.animate([{ opacity: 1 }, { opacity: 0 }], { duration: JIRA_LINKING_GLOW_FADE_DURATION_MS, easing: "ease-out", fill: "forwards" }),
			restore: () => halo.remove(),
		});
	}
	if (trace) {
		const ring = doc.createElement("div");
		ring.setAttribute("aria-hidden", "true");
		ring.setAttribute("data-jira-linking-glow-trace", "");
		ring.className = `pointer-events-none absolute ${contained ? "-inset-px" : "inset-0"} rounded-[inherit] border border-transparent`;
		Object.assign(ring.style, {
			mask: "linear-gradient(#fff 0 100%) border-box, linear-gradient(#fff 0 100%) padding-box",
			maskComposite: "exclude",
			WebkitMask: "linear-gradient(#fff 0 100%) border-box, linear-gradient(#fff 0 100%) padding-box",
			WebkitMaskComposite: "xor",
		});
		const arc = doc.createElement("div");
		const core = AGENT_SESSION_GLOW_STYLE["--card-glow-border-core"];
		const spread = AGENT_SESSION_GLOW_STYLE["--card-glow-border-spread"];
		arc.className = "absolute top-1/2";
		Object.assign(arc.style, {
			width: `${Number(spread) * 2}px`,
			height: `${Number(spread) * 2}px`,
			left: `${-Number(spread)}px`,
			marginTop: `${-Number(spread)}px`,
			background: `radial-gradient(circle, ${color} 0 ${core}px, transparent ${spread}px)`,
		});
		ring.append(arc);
		haloRoot.append(ring);
		effects.push({
			animation: arc.animate([
				{ transform: "translateX(0)", opacity: 0 },
				{ opacity: 1, offset: 0.15 },
				{ opacity: 1, offset: 0.85 },
				{ transform: `translateX(${haloRoot.getBoundingClientRect().width}px)`, opacity: 0 },
			], { duration: JIRA_LINKING_GLOW_PULSE_DURATION_MS, easing: GLOW_SWEEP_EASING, fill: "forwards" }),
			restore: () => ring.remove(),
		});
	}
	if (backdropRoot) {
		const backdrop = doc.createElement("div");
		backdrop.setAttribute("aria-hidden", "true");
		backdrop.setAttribute("data-jira-linking-glow-backdrop", "");
		backdrop.setAttribute("data-jira-linking-glow-direction", direction);
		backdrop.className = `pointer-events-none absolute ${contained ? "-inset-px" : "inset-0"} overflow-hidden rounded-[inherit]`;
		const pulse = doc.createElement("div");
		const horizontal = direction === "left-to-right";
		pulse.className = horizontal ? "absolute inset-y-0 w-full" : "absolute inset-x-0 h-full";
		Object.assign(pulse.style, {
			[horizontal ? "left" : "top"]: horizontal ? "-100%" : "100%",
			transform: horizontal ? "translateX(0)" : "translateY(0)",
			willChange: "transform",
			background: `linear-gradient(${horizontal ? "90deg" : "0deg"}, transparent 0%, ${resolveJiraLinkingGlowPulseColor(color)} 50%, transparent 100%)`,
		});
		backdrop.append(pulse);
		backdropRoot.append(backdrop);
		effects.push({
			animation: pulse.animate([{ transform: horizontal ? "translateX(0)" : "translateY(0)" }, { transform: horizontal ? "translateX(200%)" : "translateY(-200%)" }], {
				duration: JIRA_LINKING_GLOW_PULSE_DURATION_MS, easing: GLOW_SWEEP_EASING, fill: "forwards",
			}),
			restore: () => backdrop.remove(),
		});
	}
	return effects;
}
