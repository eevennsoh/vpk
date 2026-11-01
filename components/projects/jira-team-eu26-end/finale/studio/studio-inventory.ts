import type { WallSlot } from "../lib/finale-wall-layout";

/*
 * What is on the wall, as the Library lists it: every card is a kit piece's,
 * one of the keynote's own, or a landing the bento's tiles are thrown into.
 * A card that is none of these is `unlisted`, and the Library says so.
 */

export interface WallInventory {
	/** Kit piece id → how many cards on the wall show it. */
	readonly pieces: ReadonlyMap<string, number>;
	/** Keynote card key → how many times it is on the wall (a longer wall deals it again). */
	readonly keynote: ReadonlyMap<string, number>;
	readonly landings: readonly WallSlot[];
	readonly unlisted: readonly WallSlot[];
	readonly total: number;
}

/** A card dealt again in a longer wall's later pass: `poster-1` in the second pass is `poster-1#2`. */
export function repeatKey(key: string, pass: number): string {
	return `${key}#${pass}`;
}

/** A repeat's own card: `poster-1#2` is `poster-1`. */
export function wallRootKey(key: string): string {
	const at = key.indexOf("#");
	return at < 0 ? key : key.slice(0, at);
}

/** A placed slot's own key, without the bucket it was copied into (`"3:print-2"` → `"print-2"`). */
export function slotBaseKey(slot: Pick<WallSlot, "key">): string {
	return slot.key.slice(slot.key.indexOf(":") + 1);
}

const add = (counts: Map<string, number>, key: string) => counts.set(key, (counts.get(key) ?? 0) + 1);

export function wallInventory(slots: readonly WallSlot[], kitIds: ReadonlySet<string>, keynoteKeys: ReadonlySet<string>): WallInventory {
	const pieces = new Map<string, number>();
	const keynote = new Map<string, number>();
	const landings: WallSlot[] = [];
	const unlisted: WallSlot[] = [];
	for (const slot of slots) {
		if (slot.reserved !== undefined) landings.push(slot);
		else if (slot.content.kind === "piece") {
			const ids = slot.content.pieces.map((piece) => piece.id);
			if (ids.length > 0 && ids.every((id) => kitIds.has(id))) for (const id of ids) add(pieces, id);
			else unlisted.push(slot);
		} else if (keynoteKeys.has(wallRootKey(slotBaseKey(slot)))) add(keynote, wallRootKey(slotBaseKey(slot)));
		else unlisted.push(slot);
	}
	return { pieces, keynote, landings, unlisted, total: slots.length };
}
