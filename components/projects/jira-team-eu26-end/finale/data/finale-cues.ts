/**
 * Timeline for the closing-keynote finale, in seconds from the moment the
 * finale takes over the screen. Light starts immediately and
 * sweeps up the live Done column (`lib/finale-column-flash.ts`), the grey
 * slide cuts in behind it, and its cards burst out into a 3D field. The
 * camera recoils, reveals and sweeps the field, finds the first card MCB
 * dragged far off and rushes in to it, and that card becomes the first tile of
 * the bento assembling from the field. "Team ’26" lands in its centre and
 * holds to the final frame.
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
	 * built before this cue (`tileRevealStart(5) + reveal`), leaving ~1s of hold.
	 */
	end: FLASH_DURATION + 8.95,
} as const;

/** Final frame used when motion is reduced or the sequence has finished. */
export const FINALE_REST_TIME = CUE.end;
