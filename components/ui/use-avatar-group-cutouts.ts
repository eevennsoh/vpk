"use client";

import { useLayoutEffect, type RefObject } from "react";

import { avatarHexagonPoints } from "@/components/ui/avatar-hexagon";

const AVATAR = "[data-avatar-group-item]";
const ARTWORK = '[data-slot="avatar-group-visual"], [data-slot="avatar-hexagon-artwork"]';
const GAP = 1.5;

function cutoutMask(front: HTMLElement, back: HTMLElement, frontBox: DOMRect, backBox: DOMRect): string {
	const width = back.offsetWidth;
	const height = back.offsetHeight;
	if (!width || !height || !backBox.width || !backBox.height || frontBox.right <= backBox.left || frontBox.bottom <= backBox.top || frontBox.top >= backBox.bottom) return "";
	const scaleX = backBox.width / width;
	const scaleY = backBox.height / height;
	const x = (frontBox.left - backBox.left) / scaleX;
	const y = (frontBox.top - backBox.top) / scaleY;
	const w = frontBox.width / scaleX;
	const h = frontBox.height / scaleY;
	if (front.dataset.shape === "circle") {
		return `radial-gradient(ellipse ${w / 2 + GAP}px ${h / 2 + GAP}px at ${x + w / 2}px ${y + h / 2}px, transparent 99%, black 100%)`;
	}
	const points = front.dataset.shape === "hexagon"
		? avatarHexagonPoints(0, GAP).map(({ xPercent, yPercent, xPixels, yPixels }) => `${x - GAP + xPercent * (w + GAP * 2) / 100 + xPixels},${y - GAP + yPercent * (h + GAP * 2) / 100 + yPixels}`).join(" L ")
		: `${x - GAP},${y - GAP} L ${x + w + GAP},${y - GAP} L ${x + w + GAP},${y + h + GAP} L ${x - GAP},${y + h + GAP}`;
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><path fill="white" fill-rule="evenodd" d="M0,0 H${width} V${height} H0 Z M ${points} Z"/></svg>`;
	return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export function useAvatarGroupCutouts(ref: RefObject<HTMLElement | null>, host: "div" | "span", enabled: boolean) {
	useLayoutEffect(() => {
		const element = ref.current;
		if (!enabled || !element) return undefined;
		const group = element;
		const masked = new Set<HTMLElement>();
		let frame: number | undefined;
		const schedule = () => {
			frame ??= requestAnimationFrame(paint);
		};

		function paint() {
			frame = undefined;
			const avatars = Array.from(group.children, (child) => child.matches(AVATAR) ? child : child.querySelector(AVATAR))
				.filter((child): child is HTMLElement => child instanceof HTMLElement && child.closest('[data-slot="avatar-group"]') === group);
			const boxes = avatars.map((avatar) => avatar.getBoundingClientRect());
			const updates = new Map<HTMLElement, string>();
			for (const [index, back] of avatars.entries()) {
				const front = avatars[index - 1];
				const artwork = back.querySelector<HTMLElement>(ARTWORK);
				if (front && artwork) updates.set(artwork, cutoutMask(front, back, boxes[index - 1], boxes[index]));
			}
			for (const artwork of masked) {
				if (updates.has(artwork)) continue;
				artwork.style.removeProperty("mask-image");
				masked.delete(artwork);
			}
			for (const [artwork, mask] of updates) {
				if (artwork.style.maskImage !== mask) artwork.style.maskImage = mask;
				masked.add(artwork);
			}
			if (group.getAnimations?.({ subtree: true }).some(({ playState, effect }) =>
				playState === "running" && effect instanceof KeyframeEffect && Number.isFinite(effect.getComputedTiming().endTime)
				&& effect.getKeyframes().some(({ transform }) => transform),
			)) schedule();
		}

		const resize = new ResizeObserver(schedule);
		const mutation = new MutationObserver(schedule);
		resize.observe(group);
		mutation.observe(group, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-shape"] });
		group.addEventListener("pointerover", schedule);
		group.addEventListener("pointerout", schedule);
		schedule();
		return () => {
			if (frame !== undefined) cancelAnimationFrame(frame);
			resize.disconnect();
			mutation.disconnect();
			group.removeEventListener("pointerover", schedule);
			group.removeEventListener("pointerout", schedule);
			for (const artwork of masked) artwork.style.removeProperty("mask-image");
		};
	}, [ref, host, enabled]);
}
