/**
 * The finale's title, "Team ’26" over "Europe", as the Founder Keynote Figma
 * "Bento" sets it (node 10774:6030): Atlassian Sans 400 at 90 stage px, each
 * line 0.8em with 0.16em between them, tracked −0.02em, a little above the
 * centre of its box. The bento's DOM title, its GL card and the wall's title
 * tiles all set it from here, so it never jumps as one hands it to the next.
 */
export const FINALE_TITLE = {
	lines: ["Team ’26", "Europe"],
	fontSize: 90,
	line: 0.8,
	gap: 0.16,
	tracking: -0.02,
	/** Stage px the lockup sits above its box's centre. */
	lift: 6.5,
} as const;

/** The lockup's height in em: two lines and the gap between them. */
export const FINALE_TITLE_BLOCK = FINALE_TITLE.line * 2 + FINALE_TITLE.gap;
