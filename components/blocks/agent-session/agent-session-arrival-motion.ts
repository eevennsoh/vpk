/** Shared arrival timing for every Agent Session footprint. */
export const AGENT_SESSION_ARRIVAL_TRANSITION = {
	duration: 0.25,
	ease: [0, 0.4, 0, 1] as [number, number, number, number],
};

/** Vertical travel for Large and Medium arrivals; sessions enter from sync above. */
export const AGENT_SESSION_ARRIVAL_OFFSET_PX = -8;

/** Top entries and the rows making room share duration-slowest + ease-in-out. */
export const AGENT_SESSION_TOP_ARRIVAL_TRANSITION = {
	duration: 0.6,
	ease: [0.4, 0, 0, 1] as [number, number, number, number],
};

/** Enter a full row from above so its lower edge follows the opening space. */
export const AGENT_SESSION_TOP_ARRIVAL_TRANSFORM = "translateY(-100%)";

/**
 * Circle-rail arrival: the face pops in on the avatar recipe, holds, then
 * morphs down onto the 4px rest disc it will become. The rest disc is already
 * painted underneath by then — hidden behind an opaque 12px face — so the
 * morph lands on a solid dot instead of dissolving to bare plane and letting a
 * separate dot fade up after it. Enter matches the hover CSS (`duration-normal`
 * + `ease-out-practical`). The hold is `2 × duration-slower` so a 12px face can
 * register before the shape changes.
 */
export const AGENT_SESSION_USER_NOTCH_ARRIVAL = {
	enterMs: 150, // duration-normal
	exitMs: 150, // duration-normal — the morph onto the rest disc
	lingerMs: 800, // 2 × duration-slower
} as const;

/**
 * The morph itself, as a CSS transition list.
 *
 * Two properties on two curves, which no single Tailwind `ease-*` can express.
 * Sharing one curve is what made the earlier attempt read as two layers: with
 * matched easing the face is always `12 − 8p` px at `1 − p` opacity, so halfway
 * through it is an 8px ghost hanging at 50% over a 4px dot, whatever curve `p`
 * follows. Splitting them decouples size from opacity — `ease-out` front-loads
 * the collapse so the face is dot-sized within the first third, while `ease-in`
 * holds it opaque until it is. What crossfades is then a 4px photo over a 4px
 * disc: a colour change at matched geometry, which is what "morph" should mean.
 *
 * `scale`, not `transform`: Tailwind v4 `scale-*` utilities set the standalone
 * `scale` property, and a `transform` entry here would animate nothing.
 */
export const AGENT_SESSION_USER_NOTCH_MORPH_TRANSITION =
	"scale var(--duration-normal) var(--ease-out), opacity var(--duration-normal) var(--ease-in)";

export const AGENT_SESSION_USER_NOTCH_ARRIVAL_HIDE_MS =
	AGENT_SESSION_USER_NOTCH_ARRIVAL.enterMs + AGENT_SESSION_USER_NOTCH_ARRIVAL.lingerMs;

export const AGENT_SESSION_USER_NOTCH_ARRIVAL_COMPLETE_MS =
	AGENT_SESSION_USER_NOTCH_ARRIVAL_HIDE_MS + AGENT_SESSION_USER_NOTCH_ARRIVAL.exitMs;
