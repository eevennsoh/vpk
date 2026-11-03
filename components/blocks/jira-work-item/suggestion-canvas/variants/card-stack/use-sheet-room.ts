"use client";

import { useLayoutEffect, useState, type RefObject } from "react";

import { SHEET_INSET } from "./constants";

interface Pose {
	x: number;
	y: number;
	rotate: number;
}

/** The free space around the top card: its side gutter, the gap down to the discs, and how far they reach from centre. */
export interface SheetRoom {
	side: number;
	below: number;
	discReach: number;
}

const degrees = (radians: number) => (radians * 180) / Math.PI;
const tiltWithin = (room: number, halfSpan: number) => degrees(Math.asin(Math.min(1, Math.max(0, room) / halfSpan)));

/**
 * Keeps every tilted sheet inside its room, fanned or not. A sheet's rotated corners reach sideways by its offset plus
 * half its height times sin(tilt), and its lower edge drops under the discs by its offset plus their reach times
 * sin(tilt). So a tall top card (the description) gets a gentler tilt than a one-line one, and no sheet comes closer
 * than SHEET_INSET to the popover's edge or to ✕ and ✓. The height is read only when the stack resizes
 * (ResizeObserver), never per frame.
 */
export function useSheetRoom(deckRef: RefObject<HTMLElement | null>, room: SheetRoom, active: boolean) {
	const [height, setHeight] = useState(0);
	useLayoutEffect(() => {
		const element = deckRef.current;
		if (!element || !active) return undefined;
		const observer = new ResizeObserver(() => setHeight(element.offsetHeight));
		observer.observe(element);
		return () => observer.disconnect();
	}, [active, deckRef]);

	return (pose: Pose): Pose => {
		if (height === 0) return pose;
		const limit = Math.min(
			tiltWithin(room.side - SHEET_INSET - Math.abs(pose.x), height / 2),
			tiltWithin(room.below - SHEET_INSET - Math.max(0, pose.y), room.discReach),
		);
		return Math.abs(pose.rotate) <= limit ? pose : { ...pose, rotate: Math.sign(pose.rotate) * limit };
	};
}
