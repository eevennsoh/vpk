/**
 * Timeline for the closing-keynote finale, in seconds from the moment the
 * finale takes over the screen. The board first finishes its own drop
 * animation (see `FINALE_START_DELAY_MS` in the controller); light then
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

export const CUE = {
	/** The slide is up; the Done column and its cards sit exactly where they were. */
	hit: 0,
	/**
	 * The column "completes", over the live board, after reference clips 4 and 5
	 * flipped to run bottom → top (see `lib/finale-column-flash.ts`): heat haze
	 * gathers at the foot of the Done column (0.22s), a blinding disc floods out,
	 * thins into a bright ring over a dark refracted lens, and decelerates up
	 * the column as its energy falls, flaring the highlights it crosses. It is
	 * exactly dark on frame 0 and fully spent by `flash + flashDuration`, which
	 * must not pass `burst`.
	 */
	flash: 0.05,
	flashDuration: 1.3,
	/**
	 * The Done column's cards are tossed out like a thrown deck: all at once
	 * (within `burstSpread`), each tumbling on its own flight into the field.
	 * The board exits under the slide from here (`lib/finale-board-exit.ts`).
	 * Every cue from here on sits 1.3s later than it did before the flash, so
	 * the choreography after the toss is unchanged.
	 */
	burst: 1.35,
	burstSpread: 0.12,
	burstDuration: 1.25,
	/** Camera shots over the field (see `finale-camera.ts`): recoil, wide reveal, close sweep. */
	recoil: 2.25,
	wide: 3.05,
	sweep: 3.75,
	/**
	 * The rush: having found the first card MCB dragged far off in the field, the
	 * camera time-warps in to it from afar and arrives face-on.
	 */
	zoom: 4.3,
	zoomEnd: 5,
	/** The camera is back on the slide and the hero lands as the first bento tile. */
	heroLand: 5.65,
	/** The other tiles swoop back in from the field, one by one. */
	tiles: 5.65,
	tileStagger: 0.22,
	tileFall: 0.65,
	/** A landed tile hands over to its crisp DOM face once the wave has settled. */
	handoff: 0.6,
	/** Logo and heading build on each tile (slow enough to see the gradient pass). */
	reveal: 1.4,
	/** "Team ’26" arrives only once the bento is nearly assembled. */
	title: 7,
	/** The year counts 19 → 26. */
	yearStart: 7.45,
	yearLand: 8.3,
	/**
	 * Final frame: "Team ’26" holds at full size. The last tile's heading has
	 * built by 9.23s (`tileRevealStart(5) + reveal`), so this leaves ~1s of hold.
	 */
	end: 10.3,
} as const;

/** Final frame used when motion is reduced or the sequence has finished. */
export const FINALE_REST_TIME = CUE.end;
