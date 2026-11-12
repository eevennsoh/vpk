// Board reflow when a card leaves its column: input for the vpk-html eval scenario
// "story-explainer-modes-and-chrome". Extracted from the opening act of the EU26 motion model
// (artifacts/vpk-html/eu26-animation-explained/_figures/eu26-motion-model.mjs) and trimmed to the reflow.

const clamp = x => Math.max(0, Math.min(1, x));
const ease = x => { const u = clamp(x); return u * u * (3 - 2 * u); };

// A card is { column, row, home: [x, y, z], w, d }. Column 2 is the column the leaving card starts in.
export function reflowCard(card, pitch, time) {
	// Close the gap: as the first card leaves its column, the cards below it slide up one row and the next hidden
	// card scrolls into view, as a real board reflows.
	const reflow = card.column === 2 && card.row > 1 ? ease((time - 0.7) / 0.7) : 0;
	const at = [card.home[0] + card.w / 2, card.home[1] + card.d / 2 - pitch * reflow, card.home[2]];
	// Rows 0 to 2 are always shown; row 3 of the leaving column fades in as it scrolls into view.
	const alpha = card.row < 3 ? 1 : card.column === 2 && card.row === 3 ? reflow : 0;
	return { at, alpha };
}

// The leaving card lifts out of row 1 and arcs across to Done over 2 s.
export function leavingCard(card, done, time) {
	const s = ease(time / 2);
	const at = card.home.map((value, axis) => value + (done[axis] - value) * s);
	at[2] += Math.sin(s * Math.PI) * 95;
	return { at, rot: [0, Math.sin(s * Math.PI) * 0.2, Math.sin(s * Math.PI) * -0.18] };
}

// Three columns of four rows; the card at column 2, row 1 is the one that leaves.
export function sampleBoard() {
	const cards = [];
	for (let column = 0; column < 3; column += 1) {
		for (let row = 0; row < 4; row += 1) cards.push({ column, row, home: [column * 120, row * 72, 0], w: 108, d: 64 });
	}
	return { cards, pitch: 72, leaving: cards.find(card => card.column === 2 && card.row === 1), done: [360, 0, 4] };
}
