/**
 * Timeline for the closing-keynote finale, in seconds from the moment the
 * finale takes over the screen. Light starts immediately and
 * sweeps up the live Done column (`lib/finale-column-flash.ts`), the grey
 * slide cuts in behind it, and its cards burst out into a 3D field. The
 * camera recoils, reveals and sweeps the field, finds the first card MCB
 * dragged far off and rushes in to it, and that card becomes the first tile of
 * the bento assembling from the field. "Team ’26" lands in its centre and
 * holds to the bento's final frame; then Act III (`WALL_CUE`) tosses the
 * bento's tiles into an endless mega bento that glides on until Esc.
 *
 * Sound is off for now, so these beats are paced by the choreography. The
 * parked score (`scripts/compose-team-eu26-finale-score.py`) was written to an
 * earlier cut and needs re-timing before it is switched back on.
 */

export const FINALE_STAGE = { width: 1920, height: 1080 } as const;

/** Sound stays off until the score is re-cut to this timeline. */
export const FINALE_SOUND_ENABLED = false;
export const FINALE_AUDIO_SRC = "/sound/brand/team-eu26-finale.mp3";

/**
 * All following choreography is offset by the full-column sweep's duration.
 * The cards toss the moment the bright ring has cleared the column's top
 * (~0.53s): its dark wake dissolves where it is rather than trailing off the
 * top, which left ~0.34s of dead air before the burst.
 */
const FLASH_DURATION = 0.62;

export const CUE = {
	/** The slide is up; the Done column and its cards sit exactly where they were. */
	hit: 0,
	/**
	 * The column "completes", over the live board, after reference clip 5
	 * flipped to run bottom → top (see `lib/finale-column-flash.ts`): without an
	 * opening hold, a bright disc floods out from the foot of the Done column,
	 * thins into a bright ring over a dark refracted lens, and decelerates up
	 * the column as its energy falls, flaring the highlights it crosses. It is
	 * exactly dark on frame 0 and fully spent by `flash + flashDuration`, which
	 * must not pass `burst`.
	 */
	flash: 0,
	flashDuration: FLASH_DURATION,
	/**
	 * The Done column's cards are tossed out like a thrown deck: all at once
	 * (within `burstSpread`), each tumbling on its own flight into the field.
	 * The board exits under the slide from here (`lib/finale-board-exit.ts`).
	 * Later cues retain their spacing relative to the toss when the flash is retimed.
	 */
	burst: FLASH_DURATION,
	burstSpread: 0.12,
	burstDuration: 1.25,
	/** Camera shots over the field (see `finale-camera.ts`): recoil, wide reveal, close sweep. */
	recoil: FLASH_DURATION + 0.9,
	wide: FLASH_DURATION + 1.7,
	sweep: FLASH_DURATION + 2.4,
	/**
	 * The rush: having found the first card MCB dragged far off in the field, the
	 * camera time-warps in to it from afar and arrives face-on.
	 */
	zoom: FLASH_DURATION + 2.95,
	zoomEnd: FLASH_DURATION + 3.65,
	/** The camera is back on the slide and the hero lands as the first bento tile. */
	heroLand: FLASH_DURATION + 4.3,
	/** The other tiles swoop back in from the field, one by one. */
	tiles: FLASH_DURATION + 4.3,
	tileStagger: 0.22,
	tileFall: 0.65,
	/** A landed tile hands over to its crisp DOM face once the wave has settled. */
	handoff: 0.6,
	/** Logo and heading build on each tile (slow enough to see the gradient pass). */
	reveal: 1.4,
	/** "Team ’26" arrives only once the bento is nearly assembled. */
	title: FLASH_DURATION + 5.65,
	/** The year counts 19 → 26. */
	yearStart: FLASH_DURATION + 6.1,
	yearLand: FLASH_DURATION + 6.95,
	/**
	 * Final frame: "Team ’26" holds at full size. The last tile's heading has
	 * built before this cue (`tileRevealStart(5) + reveal`), leaving just over
	 * half a second of hold before the title turns into its black card.
	 */
	end: FLASH_DURATION + 8.45,
} as const;

/** The bento's final frame: what reduced motion shows, and where the wall takes over. */
export const FINALE_REST_TIME = CUE.end;

/** Act III's title flip, and the throw it flows into (see `WALL_CUE`). */
const TITLE_FLIP_AT = 0.22;
const TOSS_AT = TITLE_FLIP_AT + 0.12;

/**
 * Act III, the mega bento (see `lib/finale-wall-motion.ts`), in seconds after
 * the bento's final frame. "Team ’26" flips over into a black card and, as it
 * comes over, the bento's six tiles, faces and all, are thrown like the
 * Done column's deck: tumbling away from the lens and down as paper falls,
 * into gaps across the mega bento far below, which appears around them from
 * the middle out. MCB's cursor takes the black card as its flip lands and
 * drags it into its own gap (`lib/finale-title-drag.ts`), as he dragged the
 * keynote's cards into Done. Each card lands as it landed on the slide, the
 * wall already gliding under it, and the wall glides on forever; new cards
 * wait in the air at its leading edge, tilted, and come down one by one.
 */
export const WALL_CUE = {
	start: CUE.end,
	/** "Team ’26" gains a white card under its type at once… */
	titleCardAt: 0.02,
	/** …which flips end over end, as the field's cards do, to its black back… */
	titleFlipAt: TITLE_FLIP_AT,
	/**
	 * …and the bento's six tiles are thrown at once, like the Done column's
	 * deck, as it whips past edge-on (`titleFlipPose`'s spring).
	 */
	tossAt: TOSS_AT,
	/** The deck's hair of spread, at the throw's quicker pace. */
	tossSpread: 0.07,
	/** …and come down into their gaps one after another, as they landed on the slide, all down within two seconds. */
	landAt: TOSS_AT + 1.2,
	landStagger: 0.12,
	/** Each flight ends in a bento tile's swoop onto the slide, quickened to the throw's pace. */
	fallS: 0.4,
	/** The mega bento appears around the thrown cards, from the middle out, as quickly. */
	revealAt: TOSS_AT,
	revealS: 1,
	revealFadeS: 0.4,
	/**
	 * The wall starts to glide this far through the throw, from `tossAt` to the
	 * first touchdown (`landAt`), while the cards are still coming down, so
	 * every one lands in a gap already on the move. It eases up to its pace
	 * over `driftRamp`, reached soon after the last card is down.
	 */
	driftShare: 0.3,
	driftRamp: 2.6,
	/**
	 * MCB's cursor reaches in as the black face comes up, takes the card as
	 * its flip lands, so it never comes to rest in its box, and drags it into
	 * its gap, setting it down a beat after the last tile (`landAt` plus five
	 * `landStagger`s), the act's last placement before the teammates join in.
	 */
	carryReachAt: TITLE_FLIP_AT + 0.16,
	carryGrabAt: TITLE_FLIP_AT + 0.46,
	carryDownAt: TOSS_AT + 2,
	/** A waiting card's descent from the air into its slot at the leading edge. */
	descendS: 0.95,
} as const;
