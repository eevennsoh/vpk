const AVATAR_OVERLAY_NAMES = new Set([
	"AvatarBadge",
	"AvatarCompanyBadge",
	"AvatarProjectBadge",
	"AvatarPresenceIndicator",
	"AvatarStatusIndicator",
]);

/** Fast Refresh can retain elements whose function identity predates the module. */
export function isAvatarOverlayType(type: unknown): boolean {
	if (typeof type !== "function") return false;
	const component = type as { displayName?: string; name?: string };
	return AVATAR_OVERLAY_NAMES.has(component.displayName ?? component.name ?? "");
}
