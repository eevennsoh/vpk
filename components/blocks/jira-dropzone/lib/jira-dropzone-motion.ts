import type {
	FlightProfile,
	FlightTravel,
	JiraDropzoneArcOptions,
	ViewportPoint,
} from "./jira-dropzone-types";

/** Resolved `--duration-*` values the catalog duration control may emit. */
export const JIRA_DROPZONE_DURATION_TOKEN_MS = {
	"duration-fast": 100,
	"duration-normal": 150,
	"duration-medium": 200,
	"duration-slow": 250,
	"duration-slower": 400,
	"duration-slowest": 600,
} as const;

export type JiraDropzoneDurationToken = keyof typeof JIRA_DROPZONE_DURATION_TOKEN_MS;

export const JIRA_DROPZONE_HOVER_AREA_PX = 120;
/** Standard h-16 expanded target when a host has no spare space. */
export const JIRA_DROPZONE_OPEN_HEIGHT_PX = 64;

/** Compact bottom-target entrance: duration-normal + ease-out-practical. */
export const JIRA_DROPZONE_WELL_ENTER = {
	duration: 0.15,
	ease: [0.4, 1, 0.6, 1],
} as const; // duration-normal + ease-out-practical
export const JIRA_DROPZONE_WELL_ENTER_REDUCED = { duration: 0 } as const;
/** Faster matching dismissal: duration-fast + ease-in. */
export const JIRA_DROPZONE_WELL_EXIT = {
	duration: 0.1,
	ease: [0.6, 0, 0.8, 0.6],
} as const;
export const JIRA_DROPZONE_WELL_VISIBLE = { opacity: 1, transform: "translateY(0px)" } as const;
export const JIRA_DROPZONE_WELL_HIDDEN = { opacity: 0, transform: "translateY(8px)" } as const; // space.100

/**
 * Shared flight recipe for create-well and card-link drops.
 *
 * Default travel is a straight tween — the Team EU26 board drop. `durationMs`
 * is duration-slower so a button-launched catalog drop can still be tracked;
 * on the board the pointer is already on the well, so the same budget is a
 * short slide to centre. Arc path, peak, rotate, and strength stay on the
 * profile so a catalog or host override can opt back into Motion `arc()`
 * without re-seeding the rest of the recipe. `staggerMs` is duration-normal
 * so each chip is visibly queued before the next leaves. `launchSpreadPx` is
 * space.600 so ~80px mention chips fan into a pack instead of overlapping at
 * 14px.
 */
export const JIRA_DROPZONE_FULL_MOTION_PROFILE: FlightProfile = {
	arcDirection: "automatic",
	arcPeak: 0.5,
	arcRotate: 0,
	arcStrength: 0.42,
	durationMs: JIRA_DROPZONE_DURATION_TOKEN_MS["duration-slower"],
	ease: [0.4, 1, 0.6, 1],
	impact: {
		damping: 12,
		impulseXPx: 6,
		impulseYPx: 10,
		stiffness: 500,
	},
	launchSpreadPx: 48,
	settleHoldMs: 250,
	staggerMs: 150,
	travel: "linear",
};

export const JIRA_DROPZONE_REDUCED_MOTION_PROFILE: FlightProfile = {
	arcDirection: "automatic",
	arcPeak: 0.5,
	arcRotate: 0,
	arcStrength: 0,
	durationMs: 0,
	ease: [0, 0, 1, 1],
	impact: null,
	launchSpreadPx: 0,
	settleHoldMs: 100,
	staggerMs: 0,
	travel: "none",
};

export function resolveFlightProfile(
	shouldReduceMotion: boolean | null,
	override?: Partial<FlightProfile>,
): FlightProfile {
	const base = shouldReduceMotion
		? JIRA_DROPZONE_REDUCED_MOTION_PROFILE
		: JIRA_DROPZONE_FULL_MOTION_PROFILE;
	if (shouldReduceMotion || !override) {
		return base;
	}
	return { ...base, ...override };
}

/**
 * Motion `arc()` options for a flight profile. `"automatic"` and a zero
 * rotate are omitted so the default path matches `arc({ peak, strength })`.
 */
export function resolveJiraDropzoneArcOptions(
	profile: Readonly<FlightProfile>,
): JiraDropzoneArcOptions {
	const options: JiraDropzoneArcOptions = profile.arcRotate === 0
		? { peak: profile.arcPeak, strength: profile.arcStrength }
		: {
			peak: profile.arcPeak,
			rotate: profile.arcRotate,
			strength: profile.arcStrength,
		};
	switch (profile.arcDirection) {
		case "automatic":
			return options;
		case "ccw":
		case "cw":
			return { ...options, direction: profile.arcDirection };
		default: {
			const exhaustive: never = profile.arcDirection;
			return exhaustive;
		}
	}
}

export function resolveFlightTravelTransition<TPath>(
	travel: FlightTravel,
	base: {
		readonly delay: number;
		readonly duration: number;
		readonly ease: FlightProfile["ease"];
	},
	path: TPath,
): typeof base | (typeof base & { readonly path: TPath }) {
	switch (travel) {
		case "arc":
			return { ...base, path };
		case "linear":
		case "none":
			return base;
		default: {
			const exhaustive: never = travel;
			return exhaustive;
		}
	}
}

export function resolveJiraDropzoneLandingPoint(
	rect: Pick<DOMRectReadOnly, "height" | "left" | "top" | "width">,
): ViewportPoint {
	return {
		x: rect.left + rect.width / 2,
		y: rect.top + rect.height / 2,
	};
}
