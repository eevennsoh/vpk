"use client";

import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { animate, useReducedMotion } from "motion/react";
import type { ProjectButterAttachment } from "@/components/blocks/jira-work-item/project-butter/attachment-data";
import { attachmentFromFile, mergeAttachments } from "@/components/blocks/jira-work-item/project-butter/attachment-model";
import type { ProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";
import { motionDuration, motionEase } from "@/lib/motion";

/** Only file drags engage the zone (reference AttachmentImageDrop: URI drops are not accepted). */
const hasFiles = (event: DragEvent) => [...(event.dataTransfer?.types ?? [])].includes("Files");
/** Rich-text editors keep their own drop handling. */
const inEditable = (target: EventTarget | null) => target instanceof Element && Boolean(target.closest('[contenteditable="true"], [contenteditable=""]'));

export interface AttachmentDropGhost {
	src: string;
	from: { x: number; y: number };
	to: { x: number; y: number };
	scale: number;
}

export function attachmentDropMessage(added: number) {
	return added === 0 ? "No attachments were added" : `Added ${added} ${added === 1 ? "attachment" : "attachments"}`;
}

const GHOST_SIZE = 120;

/** The part of `element` the user can see: its rect clipped by every non-visible-overflow ancestor and the viewport. */
export function visibleDropRect(element: Element) {
	const box = element.getBoundingClientRect();
	let top = Math.max(box.top, 0);
	let left = Math.max(box.left, 0);
	let bottom = Math.min(box.bottom, window.innerHeight);
	let right = Math.min(box.right, window.innerWidth);
	for (let node = element.parentElement; node; node = node.parentElement) {
		const style = getComputedStyle(node);
		if (style.overflowX === "visible" && style.overflowY === "visible") continue;
		const clip = node.getBoundingClientRect();
		top = Math.max(top, clip.top);
		left = Math.max(left, clip.left);
		bottom = Math.min(bottom, clip.bottom);
		right = Math.min(right, clip.right);
	}
	return { top, left, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

/**
 * Whole-left-column file drop for Project Butter (the scrolling column, gutters included). Files become attachments (images get object-URL
 * previews), duplicates are dropped, and the result is announced. After a drop the Attachments group
 * opens; in list view the new rows fade in and an image flies to its row thumbnail. Grid view relies on
 * the card arrival instead. Reduced motion skips the flight and fade.
 */
export function useAttachmentDrop(zoneRef: RefObject<HTMLElement | null>, content: ProjectButterContent) {
	const reducedMotion = useReducedMotion();
	const [over, setOver] = useState(false);
	const [ghost, setGhost] = useState<AttachmentDropGhost | null>(null);
	const [announcement, setAnnouncement] = useState("");
	const pointer = useRef({ x: 0, y: 0 });
	const hintRef = useRef<HTMLSpanElement>(null);
	const washRef = useRef<HTMLDivElement>(null);
	const frame = useRef(0);
	/** Re-measured each coalesced dragover: the wash covers what is visible of the zone, so its cards sit at 42% of the view. */
	const placeHint = useEffectEvent(() => {
		frame.current = 0;
		const zone = zoneRef.current;
		if (!zone) return;
		const wash = washRef.current;
		if (wash) {
			const rect = visibleDropRect(zone);
			Object.assign(wash.style, { top: `${rect.top}px`, left: `${rect.left}px`, width: `${rect.width}px`, height: `${rect.height}px` });
		}
		const hint = hintRef.current;
		if (!hint) return;
		hint.style.left = `${pointer.current.x}px`;
		hint.style.top = `${pointer.current.y}px`;
	});
	useLayoutEffect(() => {
		if (over) placeHint();
	}, [over]);
	const land = useEffectEvent((added: readonly ProjectButterAttachment[], drop: { x: number; y: number }) => {
		const zone = zoneRef.current;
		if (reducedMotion || !zone || content.attachmentEditor.viewMode !== "list") return;
		const preview = added.find((item) => item.kind === "image" && item.previewSrc)?.previewSrc;
		const place = () => {
			const rows = [...zone.querySelectorAll<HTMLElement>("#section-attachments [data-attachment-row]")].slice(0, added.length);
			if (rows.length === 0) return false;
			for (const row of rows) animate(row, { opacity: [0, 1] }, { duration: motionDuration.slower, ease: motionEase.outPractical });
			const anchor = rows[0]?.querySelector<HTMLElement>("[data-attachment-thumb]");
			if (!preview || !anchor) return true;
			anchor.scrollIntoView?.({ block: "nearest" });
			const box = anchor.getBoundingClientRect();
			setGhost({ src: preview, from: { x: drop.x - GHOST_SIZE / 2, y: drop.y - GHOST_SIZE / 2 }, to: { x: box.left, y: box.top }, scale: Math.max(box.width, 24) / GHOST_SIZE });
			return true;
		};
		requestAnimationFrame(() => {
			if (place()) return;
			requestAnimationFrame(() => { if (!place()) window.setTimeout(place, 50); });
		});
	});
	const handleDrop = useEffectEvent((event: DragEvent) => {
		const files = [...(event.dataTransfer?.files ?? [])];
		const now = new Date().toISOString();
		const dropped = files.map((file) => attachmentFromFile(file, { id: `attachment-${crypto.randomUUID()}`, now }, file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined));
		const { added } = mergeAttachments(content.attachments, dropped);
		for (const item of dropped) if (!added.includes(item) && item.previewSrc) URL.revokeObjectURL(item.previewSrc);
		setAnnouncement(attachmentDropMessage(added.length));
		if (added.length === 0) return;
		content.setAttachments((items) => mergeAttachments(items, added).items);
		content.setRelatedSectionOpen(true);
		content.setAttachmentEditor((editor) => ({ ...editor, revealSignal: editor.revealSignal + 1, ...(editor.filter === "All" ? {} : { filter: "All" }) }));
		land(added, { x: event.clientX, y: event.clientY });
	});
	useEffect(() => {
		const zone = zoneRef.current;
		if (!zone) return undefined;
		const leftZone = (related: EventTarget | null) => !(related instanceof Node && zone.contains(related));
		const onEnter = (event: DragEvent) => {
			if (!hasFiles(event) || !leftZone(event.relatedTarget)) return;
			event.preventDefault();
			pointer.current = { x: event.clientX, y: event.clientY };
			setOver(true);
		};
		const onOver = (event: DragEvent) => {
			if (!hasFiles(event)) return;
			if (inEditable(event.target)) return setOver(false);
			event.preventDefault();
			if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
			pointer.current = { x: event.clientX, y: event.clientY };
			setOver(true);
			if (!frame.current) frame.current = requestAnimationFrame(() => placeHint());
		};
		const onLeave = (event: DragEvent) => {
			if (leftZone(event.relatedTarget)) setOver(false);
		};
		const onDrop = (event: DragEvent) => {
			if (!hasFiles(event) || inEditable(event.target)) return;
			event.preventDefault();
			setOver(false);
			handleDrop(event);
		};
		const reset = () => setOver(false);
		zone.addEventListener("dragenter", onEnter);
		zone.addEventListener("dragover", onOver);
		zone.addEventListener("dragleave", onLeave);
		zone.addEventListener("drop", onDrop);
		window.addEventListener("dragend", reset);
		window.addEventListener("drop", reset);
		return () => {
			cancelAnimationFrame(frame.current);
			frame.current = 0;
			zone.removeEventListener("dragenter", onEnter);
			zone.removeEventListener("dragover", onOver);
			zone.removeEventListener("dragleave", onLeave);
			zone.removeEventListener("drop", onDrop);
			window.removeEventListener("dragend", reset);
			window.removeEventListener("drop", reset);
		};
	}, [zoneRef]);
	return { over, ghost, announcement, hintRef, washRef, clearGhost: () => setGhost(null) };
}
