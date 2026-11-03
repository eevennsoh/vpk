import { motionDuration, motionEase } from "@/lib/motion";

/** Blank sheets that peek out behind the top card. Further pending cards wait exactly behind the last one. */
export const REAR_SHEETS = 2;

/** Kanban issue cards are ~260px wide; this card is ~340px, so the same corner reveal needs a gentler tilt. */
export const WIDE_CARD_TILT = 0.8;
/**
 * Hovering or focusing the stack fans the sheets this much further out, hinting that it unpacks: mostly a drop, with a
 * little more tilt. useSheetRoom then caps each sheet's tilt to STACK_ROOM, so no fanned corner nears the popover's
 * edge or runs behind the discs.
 */
export const FAN_SPREAD = { x: 1, y: 11, rotate: 1.15 } as const;

/** The discs under the stack, and the one gap between them whether two or three are showing. */
export const DISC_SIZE = 40;
export const DISC_GAP = 20;
/** The least clearance a tilted sheet keeps from the popover's edge and from the discs. */
export const SHEET_INSET = 8;
/**
 * The room around the top card: the stack's side gutter (px-5), the space above the discs (pt-11 on their row), and how
 * far the discs reach either side of centre with Undo showing (three discs and two gaps).
 */
export const STACK_ROOM = { side: 20, below: 44, discReach: (DISC_SIZE * 3 + DISC_GAP * 2) / 2 } as const;
/**
 * How far ✕ and ✓ each slide toward the centre while there is nothing to undo: half a disc plus half a gap. The
 * resting pair sits exactly DISC_GAP apart, and glides apart by the same amount as Undo grows into the centre.
 */
export const UNDO_ROOM = (DISC_SIZE + DISC_GAP) / 2;

/** Release past this distance (in unscaled px) commits the swipe. */
export const COMMIT_DISTANCE = 96;
/** A quick flick commits from a shorter distance. */
export const FLICK_VELOCITY = 0.55;
export const FLICK_MIN_DISTANCE = 24;
/** A press that travels less than this is a tap: it unpacks the stack instead of starting a swipe. */
export const TAP_SLOP = 4;
/** How far a decided card travels as it leaves; it fades out along the way. */
export const FLY_DISTANCE = 360;
/** The card starts fading once it is clearly on its way out. */
export const FADE_START = 140;
/** A re-run's find drops onto the stack from just above it. */
export const ARRIVAL_DROP = 16;

/**
 * List depth, after components/visual/scrolling (zone 160px, lift 56px, min scale 0.88), scaled to this
 * shorter viewport so the tail reads the same proportionally. The fades follow its 72px mask the same way.
 */
export const DEPTH_ZONE = 120;
export const DEPTH_MIN_SCALE = 0.9;
export const DEPTH_LIFT = 28;
export const FADE_BOTTOM = 56;
export const FADE_TOP = 20;
/** Header and footer heights, so the list can take the rest of the popover's height inside the frame. */
export const FOOTER_HEIGHT = 56;
export const CHROME_HEIGHT = 44 + FOOTER_HEIGHT;
/** Space between list cards. */
export const LIST_GAP = 10;

/** Hover intent for the why card: long enough to skim past, short enough to feel immediate. */
export const WHY_OPEN_DELAY = motionDuration.slow * 1000;
export const WHY_CLOSE_DELAY = motionDuration.fast * 1000;

/** How long a decision's receipt replaces the progress line in the footer: four of the slowest beats. */
export const RECEIPT_MS = motionDuration.slowest * 4 * 1000;
/** How long a Details row stays tinted after it is filled: two of the slowest beats plus a medium one to settle. */
export const HIGHLIGHT_MS = (motionDuration.slowest * 2 + motionDuration.medium) * 1000;

/** The stack ⇄ list morph, and every sheet that moves within the stack. */
export const MORPH = { type: "spring", visualDuration: motionDuration.slower, bounce: 0.12 } as const;
/** Between consecutive cards in the morph: enough to read as a sequence, short enough to stay one gesture. */
export const MORPH_STAGGER = 0.03;
/** The body's height during the morph: the cards' timing without their overshoot, so the footer never bounces. */
export const MORPH_HEIGHT = { type: "spring", visualDuration: motionDuration.slower, bounce: 0 } as const;
/**
 * Unpacking, the body follows the cards rather than leading them: it waits out the stagger of the rows that land near
 * its lower edge, so the footer rides just below the flying cards instead of opening an empty gap under the stack.
 */
export const MORPH_HEIGHT_UNPACK = { ...MORPH_HEIGHT, delay: MORPH_STAGGER * 4 } as const;
/** Gathering, the body shrinks a beat slower than the cards travel, so its edge never clips a card still on its way up. */
export const MORPH_HEIGHT_GATHER = { type: "spring", visualDuration: motionDuration.slowest, bounce: 0 } as const;
/** Controls under the stack wait until the gathered cards have nearly landed. */
export const CONTROLS_IN = { duration: motionDuration.normal, ease: motionEase.outPractical, delay: motionDuration.slower } as const;
/** The list's depth tail ramps in alongside the unpack's flight (a beat in, landing with the cards), never after it. */
export const DEPTH_IN = { type: "spring", visualDuration: motionDuration.slower, bounce: 0, delay: motionDuration.fast } as const;
/**
 * A card parked out of sight behind the last sheet fades there, and back in as it starts to unpack. During a gather it
 * first waits out its own stagger plus PARK_LANDING (the morph spring's settle, with a beat of margin), so its rect is
 * inside the last sheet's before it dissolves however far it travelled.
 */
export const PARK = { duration: motionDuration.fast, ease: motionEase.in } as const;
export const PARK_LANDING = motionDuration.slower + motionDuration.normal;
export const UNPARK = { duration: motionDuration.fast, ease: motionEase.outPractical } as const;
export const FAN = { type: "spring", visualDuration: motionDuration.slow, bounce: 0.18 } as const;
export const SETTLE = { duration: motionDuration.slow, ease: motionEase.inOut };
export const LEAVE = { duration: motionDuration.medium, ease: motionEase.in };
export const SPRING_BACK = { type: "spring", visualDuration: motionDuration.slow, bounce: 0.2 } as const;
export const FADE = { duration: motionDuration.normal, ease: motionEase.outPractical };
export const FADE_OUT = { duration: motionDuration.fast, ease: motionEase.in };
/** Gathering, a row keeps its content until it is on its way under the top card, so it slides underneath rather than blanking in place. */
export const GATHER_CONTENT_OUT = { ...FADE_OUT, delay: motionDuration.normal } as const;
/** Dragging the top card, the next card's face reads through from this share of the commit distance to the full one. */
export const PEEK_FROM = 0.3;
export const CONTENT_IN = { duration: motionDuration.medium, ease: motionEase.outPractical, delay: motionDuration.fast };
/** The top card's Why line, once a gather has landed it in the top slot. */
export const WHY_IN = { duration: motionDuration.normal, ease: motionEase.outPractical, delay: motionDuration.slower } as const;
export const INSTANT = { duration: 0 } as const;
