import type { NotificationPanelAnchor } from "./notification-panel-morph";
import type { FloatingRovoButtonPositioning } from "./types";

export type FloatingRovoButtonMorphVariant = "button" | "dot" | "surface";

/** Where a panel morph starts (or ends), measured in viewport coordinates with the launcher it pins in place. */
export type FloatingRovoButtonIndicatorOrigin = Readonly<{
	bounds: DOMRect;
	launcher: DOMRect;
	anchor: NotificationPanelAnchor | null;
	side: "top" | "bottom";
	variant: FloatingRovoButtonMorphVariant;
	/** For a "surface" open (e.g. from Rovo chat): the toolbar action the panel closes back into. */
	returnTo?: FloatingRovoButtonIndicatorOrigin;
}>;

export function getNotificationAnchor(surface: HTMLElement, positioning: FloatingRovoButtonPositioning): NotificationPanelAnchor | null {
	const element = positioning === "container" && surface.offsetParent instanceof HTMLElement ? surface.offsetParent : null;
	if (!element) return null;
	const { x, y } = element.getBoundingClientRect();
	return { element, x, y, scrollLeft: element.scrollLeft, scrollTop: element.scrollTop };
}

/**
 * The origin of a toolbar action (or its notification dot) on a floating Rovo button, ignoring the hover scale the
 * action may be wearing. Null when the action is not on screen.
 */
export function measureToolbarActionOrigin(surface: HTMLElement, actionId: string | undefined, positioning: FloatingRovoButtonPositioning, preferDot: boolean): FloatingRovoButtonIndicatorOrigin | null {
	const action = [...surface.querySelectorAll<HTMLElement>("[data-toolbar-action-id]")].find((element) => element.dataset.toolbarActionId === actionId);
	if (!action) return null;
	const dot = preferDot ? action.querySelector("[data-notification-dot]") : null;
	const rect = (dot ?? action).getBoundingClientRect();
	const bounds = dot ? rect : new DOMRect(rect.x + (rect.width - action.offsetWidth) / 2, rect.y + (rect.height - action.offsetHeight) / 2, action.offsetWidth, action.offsetHeight);
	const launcher = surface.getBoundingClientRect();
	const side = bounds.top + bounds.height / 2 < launcher.top ? "top" : "bottom";
	return { bounds, launcher, anchor: getNotificationAnchor(surface, positioning), side, variant: dot ? "dot" : "button" };
}
