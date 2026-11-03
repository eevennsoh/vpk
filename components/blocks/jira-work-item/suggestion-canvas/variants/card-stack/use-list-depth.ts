"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { animate, useMotionValue, useReducedMotion, useScroll } from "motion/react";

import { depthLift, depthProgress, depthScale } from "@/components/visual/scrolling/stack-layout";

import { DEPTH_IN, DEPTH_LIFT, DEPTH_MIN_SCALE, DEPTH_ZONE, FADE_BOTTOM, FADE_TOP, INSTANT } from "./constants";
import { styleOf } from "./dom-style";

interface Slot {
	top: number;
	height: number;
}

const maskFor = (top: number, bottom: number) => `linear-gradient(to bottom, transparent, #000 ${top}px, #000 calc(100% - ${bottom}px), transparent)`;

/**
 * The list's depth tail, after components/visual/scrolling: cards nearing the bottom of the scrollport shrink and
 * tuck, and grow to full size as they rise; only an edge with more beyond it fades. Offsets are read only when
 * something resizes (ResizeObserver on the scrollport, the content and every card) and cached; a scroll frame only
 * does arithmetic on the cache and writes each slot's transform.
 *
 * It runs while `active` (list mode). Switching on ramps the tail in alongside the unpack's flight, laid out against
 * the height the scrollport is heading for (`viewport`), so each card flies straight into its scaled list pose in one
 * gesture instead of landing full size and then shrinking. Switching off clears every slot in a layout effect, after
 * the stack ⇄ list snapshot was taken (so cards leave from where they visibly are) but before Motion measures where
 * they are going. Reduced motion keeps every card full size.
 */
export function useListDepth(scroller: RefObject<HTMLElement | null>, content: RefObject<HTMLElement | null>, active: boolean, viewport: () => number) {
	const slots = useRef(new Map<HTMLElement, Slot>());
	const geometry = useRef({ viewport: 0, scrollHeight: 0, offset: 0 });
	const observer = useRef<ResizeObserver | null>(null);
	const reduced = useReducedMotion() ?? false;
	const strength = useMotionValue(0);
	const { scrollY } = useScroll({ container: scroller });

	const paint = useCallback(() => {
		const element = scroller.current;
		if (!element) return;
		const amount = strength.get();
		if (amount === 0) {
			styleOf(element).maskImage = "";
			for (const slot of slots.current.keys()) styleOf(slot).transform = "";
			return;
		}
		const { viewport, scrollHeight, offset } = geometry.current;
		const scrolled = Math.max(0, scrollY.get());
		const remaining = Math.max(0, scrollHeight - viewport - scrolled);
		styleOf(element).maskImage = maskFor(Math.min(scrolled, FADE_TOP) * amount, Math.min(remaining, FADE_BOTTOM) * amount);
		// As the list runs out of scroll the tail eases off, so the last card lands full size.
		const runway = Math.min(1, remaining / DEPTH_ZONE) * amount;
		for (const [slot, { top, height }] of slots.current) {
			const tail = reduced ? 0 : depthProgress(offset + top + height / 2 - scrolled, viewport, DEPTH_ZONE, "bottom") * runway;
			styleOf(slot).transform = tail > 0 ? `translateY(${depthLift(tail, DEPTH_LIFT)}px) scale(${depthScale(tail, DEPTH_MIN_SCALE)})` : "";
		}
	}, [reduced, scroller, scrollY, strength]);

	const measure = useCallback(() => {
		const element = scroller.current;
		if (!element) return;
		const height = viewport() || element.clientHeight;
		// While the body eases, its scrollHeight is at least its own height; the content's is what the list will scroll.
		const offset = content.current?.offsetTop ?? 0;
		geometry.current = { viewport: height, scrollHeight: Math.max(height, offset + (content.current?.offsetHeight ?? 0)), offset };
		for (const slot of slots.current.keys()) slots.current.set(slot, { top: slot.offsetTop, height: slot.offsetHeight });
		paint();
	}, [content, paint, scroller, viewport]);

	useLayoutEffect(() => {
		const resize = new ResizeObserver(measure);
		observer.current = resize;
		if (scroller.current) resize.observe(scroller.current);
		if (content.current) resize.observe(content.current);
		for (const slot of slots.current.keys()) resize.observe(slot);
		return () => {
			resize.disconnect();
			observer.current = null;
		};
	}, [content, measure, scroller]);

	useEffect(() => scrollY.on("change", paint), [paint, scrollY]);
	useEffect(() => strength.on("change", paint), [paint, strength]);

	useLayoutEffect(() => {
		if (!active) {
			strength.jump(0);
			paint();
			return;
		}
		measure();
		const controls = animate(strength, 1, reduced ? INSTANT : DEPTH_IN);
		return () => controls.stop();
	}, [active, measure, paint, reduced, strength]);

	const register = useCallback((slot: HTMLElement) => {
		slots.current.set(slot, { top: slot.offsetTop, height: slot.offsetHeight });
		observer.current?.observe(slot);
		return () => {
			slots.current.delete(slot);
			styleOf(slot).transform = "";
			observer.current?.unobserve(slot);
		};
	}, []);

	return register;
}
