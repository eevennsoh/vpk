"use client";

import { motion, type MotionValue, useMotionValueEvent, useTransform } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Response overlay — dark panel near cursor showing full AI response text.
// Matches reference Clicky's CompanionResponseOverlay.
// Smart repositioning: flips left/above if would clip off-screen.
// ---------------------------------------------------------------------------

const OFFSET_X = 22;
const OFFSET_Y = -6;
const MAX_WIDTH = 340;
const EDGE_PADDING = 20;
const TYPEWRITER_INTERVAL_MS = 24;
const TYPEWRITER_CHARS_PER_TICK = 2;

interface ClickyResponseOverlayProps {
	cursorX: MotionValue<number>;
	cursorY: MotionValue<number>;
	label?: string | null;
	opacity?: number;
	text: string;
}

function useTypewriterText(text: string) {
	const [displayedText, setDisplayedText] = useState("");
	const displayedTextRef = useRef("");

	useEffect(() => {
		if (!text) {
			displayedTextRef.current = "";
			setDisplayedText("");
			return;
		}

		let index = text.startsWith(displayedTextRef.current)
			? displayedTextRef.current.length
			: 0;

		if (index >= text.length) {
			displayedTextRef.current = text;
			setDisplayedText(text);
			return;
		}

		if (index > 0 && text.length - index <= TYPEWRITER_CHARS_PER_TICK * 2) {
			displayedTextRef.current = text;
			setDisplayedText(text);
			return;
		}

		if (index === 0) {
			displayedTextRef.current = "";
			setDisplayedText("");
		}

		const interval = window.setInterval(() => {
			index = Math.min(text.length, index + TYPEWRITER_CHARS_PER_TICK);
			const nextText = text.slice(0, index);
			displayedTextRef.current = nextText;
			setDisplayedText(nextText);

			if (index >= text.length) {
				window.clearInterval(interval);
			}
		}, TYPEWRITER_INTERVAL_MS);

		return () => window.clearInterval(interval);
	}, [text]);

	return displayedText;
}

export function ClickyResponseOverlay({
	text,
	cursorX,
	cursorY,
	label,
	opacity = 1,
}: Readonly<ClickyResponseOverlayProps>) {
	const panelRef = useRef<HTMLDivElement>(null);
	const [flipX, setFlipX] = useState(false);
	const [flipY, setFlipY] = useState(false);
	const displayedText = useTypewriterText(text);
	const trimmedLabel = label?.trim();

	// Compute position with edge avoidance
	const panelX = useTransform(cursorX, (cx) => {
		if (flipX) return cx - OFFSET_X - MAX_WIDTH;
		return cx + OFFSET_X;
	});

	const panelY = useTransform(cursorY, (cy) => {
		if (flipY) return cy - OFFSET_Y - (panelRef.current?.offsetHeight ?? 100);
		return cy + OFFSET_Y;
	});

	// Check if panel would clip off-screen and flip if needed
	const checkPosition = useCallback(() => {
			const cx = cursorX.get();
			const cy = cursorY.get();
			const panelHeight = panelRef.current?.offsetHeight ?? 100;

			setFlipX(cx + OFFSET_X + MAX_WIDTH + EDGE_PADDING > window.innerWidth);
			setFlipY(cy + OFFSET_Y + panelHeight + EDGE_PADDING > window.innerHeight);
	}, [cursorX, cursorY]);
	useEffect(() => {
		checkPosition();
	}, [checkPosition]);
	useMotionValueEvent(cursorX, "change", checkPosition);
	useMotionValueEvent(cursorY, "change", checkPosition);

	if (!text) return null;

	return (
		<motion.div
			ref={panelRef}
			className="fixed"
			data-clicky-response-overlay
			style={{
				x: panelX,
				y: panelY,
				maxWidth: MAX_WIDTH,
				opacity,
				zIndex: 9999,
				willChange: "transform, opacity",
			}}
			initial={{ opacity: 0, scale: 0.95 }}
			animate={{ opacity, scale: 1 }}
			exit={{ opacity: 0, scale: 0.95 }}
			transition={{ duration: 0.2, ease: "easeOut" }}
		>
			<div
				className="rounded-lg border border-border/50 px-3.5 py-2.5 text-[13px] leading-relaxed text-text"
				style={{
					backgroundColor: "rgba(23, 25, 24, 0.95)",
					boxShadow: "0 8px 16px rgba(0, 0, 0, 0.35)",
					color: "#ECEEED",
					lineHeight: "1.5",
				}}
			>
				{trimmedLabel ? (
					<div
						className="mb-2 border-b border-white/10 pb-1.5 text-[12px] font-semibold leading-snug"
						data-clicky-response-overlay-label
						style={{ color: "rgba(236, 238, 237, 0.76)" }}
					>
						{trimmedLabel}
					</div>
				) : null}
				{displayedText}
			</div>
		</motion.div>
	);
}
