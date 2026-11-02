"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { animate, useMotionValue, useReducedMotion } from "motion/react";
import { motionDuration, motionEase } from "@/lib/motion";

export function useAttachmentPilePointer() {
	const reducedMotion = useReducedMotion();
	const [hovered, setHovered] = useState(false);
	const x = useMotionValue(0);
	const y = useMotionValue(0);
	const rotate = useMotionValue(0);
	const frame = useRef<number | null>(null);
	const pointer = useRef<{ node: Element; x: number; y: number } | null>(null);
	useEffect(() => () => {
		if (frame.current !== null) cancelAnimationFrame(frame.current);
		x.stop(); y.stop(); rotate.stop();
	}, [rotate, x, y]);
	function enter() {
		if (!reducedMotion) setHovered(true);
	}
	function move(event: PointerEvent<HTMLElement>) {
		if (reducedMotion || event.pointerType === "touch") return;
		const node = event.currentTarget.closest("[data-attachment-stack]");
		if (!node) return;
		pointer.current = { node, x: event.clientX, y: event.clientY };
		if (frame.current !== null) return;
		frame.current = requestAnimationFrame(() => {
			frame.current = null;
			const sample = pointer.current;
			if (!sample) return;
			const box = sample.node.getBoundingClientRect();
			const nx = Math.max(-1, Math.min(1, (sample.x - box.left - box.width / 2) / (box.width / 2 || 1)));
			const ny = Math.max(-1, Math.min(1, (sample.y - box.top - box.height / 2) / (box.height / 2 || 1)));
			x.stop(); y.stop(); rotate.stop();
			x.set(nx * 4); y.set(ny * 2); rotate.set(nx * 3);
		});
	}
	function reset() {
		setHovered(false);
		pointer.current = null;
		if (frame.current !== null) cancelAnimationFrame(frame.current);
		frame.current = null;
		for (const value of [x, y, rotate]) {
			value.stop();
			if (reducedMotion) value.set(0);
			else animate(value, 0, { duration: motionDuration.normal, ease: motionEase.outPractical });
		}
	}
	return { hovered, x, y, rotate, enter, move, reset };
}

export type AttachmentPilePointer = ReturnType<typeof useAttachmentPilePointer>;
