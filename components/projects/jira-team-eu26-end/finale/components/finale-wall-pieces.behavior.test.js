// Behavioral contract for a product tile's Rovo Stage Kit pieces, rendered for real in
// happy-dom: the kit's frame is stood in for by a track in this document and a
// `<rovo-piece>` that only records what the wall writes to it.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

/**
 * A slot as `WallSlotCard` hosts it: its presence is written by the parent's own
 * frame callback, which runs after the child's (a parent's layout effects run
 * after its children's), visible from `visibleFrom` on.
 */
const HARNESS = `
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { FinaleFrameContext, createFinaleFrameRegistry, useFinaleFrame } from "@/components/projects/jira-team-eu26-end/finale/hooks/use-finale-frame";
import { WallPieceHostContext, WallPieces, WallSlotMirrorContext } from "@/components/projects/jira-team-eu26-end/finale/components/finale-wall-pieces";

function Slot({ visibleFrom, children }) {
	const mirrors = useRef(new Set());
	const mirror = useCallback((target) => {
		target.style.visibility = "hidden";
		mirrors.current.add(target);
		return () => mirrors.current.delete(target);
	}, []);
	useFinaleFrame((time) => {
		for (const target of mirrors.current) {
			target.style.visibility = time >= visibleFrom ? "visible" : "hidden";
			target.style.opacity = time >= visibleFrom ? "1" : "0";
		}
	});
	return <WallSlotMirrorContext value={mirror}>{children}</WallSlotMirrorContext>;
}

export default function Harness({ onRegistry, track, revealStart, visibleFrom }) {
	const registry = useMemo(() => createFinaleFrameRegistry(), []);
	useLayoutEffect(() => onRegistry(registry), [onRegistry, registry]);
	const host = useMemo(() => ({ track, kit: { pieces: [{ id: "codeCard", w: 276, h: 143, holds: 4 }], pieceStyles: {} } }), [track]);
	const slot = useMemo(() => ({ key: "0:0:0", column: 0, band: 0, rect: { x: 100, y: 100, width: 180, height: 140 }, height: "tall", seed: 1, content: { kind: "piece", pieces: ["codeCard"] } }), []);
	const geometry = useMemo(() => ({ originX: 0, typeScale: 0.3, viewport: { width: 1000, height: 800 } }), []);
	return (
		<FinaleFrameContext value={registry}>
			<WallPieceHostContext value={host}>
				<Slot visibleFrom={visibleFrom}>
					<WallPieces slot={slot} geometry={geometry} pieces={slot.content.pieces} revealStart={revealStart} />
				</Slot>
			</WallPieceHostContext>
		</FinaleFrameContext>
	);
}
`;

function defineKitPiece() {
	if (customElements.get("rovo-piece")) return;
	customElements.define("rovo-piece", class extends HTMLElement {
		redraw() {
			this.dataset.redraws = String(Number(this.dataset.redraws ?? 0) + 1);
		}
	});
}

async function renderTile({ revealStart, visibleFrom }) {
	defineKitPiece();
	const track = document.body.appendChild(document.createElement("div"));
	let registry = null;
	await renderComponent({ source: HARNESS, props: { onRegistry: (value) => { registry = value; }, track, revealStart, visibleFrom } });
	const piece = () => track.querySelector("rovo-piece");
	return { emit: (time) => registry.emit(time), piece, holder: () => piece()?.parentElement?.parentElement ?? null };
}

test("a held seek that brings a landed tile up shows its piece at that moment, not its blank first frame", async () => {
	// Lands at 5 s; held at 2 s, then seeked (held) straight to 8 s: one emit, in which its slot comes up.
	const tile = await renderTile({ revealStart: 5, visibleFrom: 5 });
	tile.emit(2);
	assert.equal(tile.piece().getAttribute("time"), "0.000", "before its moment, its first frame");
	tile.emit(8);
	assert.equal(tile.holder().style.visibility, "visible");
	assert.equal(tile.piece().getAttribute("time"), "3.000", "three seconds into its moment");
	assert.equal(tile.piece().dataset.redraws, "1", "the jump is redrawn, crisp where it lands");
});

test("a piece rests on its last moving frame once its moment is done, and is not written again", async () => {
	const tile = await renderTile({ revealStart: 5, visibleFrom: 5 });
	// Both before the wall starts to glide (10.4 s), so the tile is still on screen.
	tile.emit(5);
	tile.emit(9.5);
	assert.equal(tile.piece().getAttribute("time"), "4.250", "held just past its 4 s moment");
	tile.piece().setAttribute("time", "untouched");
	tile.emit(10);
	assert.equal(tile.piece().getAttribute("time"), "untouched");
});

test("the kit draws the piece at the scale that fits its tile, light, with the stage file's styles", async () => {
	const tile = await renderTile({ revealStart: 5, visibleFrom: 5 });
	tile.emit(6);
	const piece = tile.piece();
	assert.equal(piece.getAttribute("piece"), "codeCard");
	assert.equal(piece.getAttribute("appearance"), "light");
	assert.ok(Number(piece.getAttribute("scale")) > 0);
	assert.deepEqual(piece.pieceStyles, {});
});
