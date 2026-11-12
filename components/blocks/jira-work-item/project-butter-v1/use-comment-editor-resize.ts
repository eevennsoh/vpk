"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

export function useCommentEditorResize() {
	const editorRef = useRef<HTMLFormElement>(null);
	const start = useRef<{ y: number; height: number } | null>(null);
	const frame = useRef(0);
	const pending = useRef(0);
	const [height, setHeight] = useState<number | undefined>();
	const [resizing, setResizing] = useState(false);
	const [maximumHeight, setMaximumHeight] = useState(480);
	const maximum = () => Math.max(144, Math.min(480, Math.floor(window.innerHeight * 0.6)));
	const bound = (value: number) => Math.min(maximum(), Math.max(144, value));
	useEffect(() => () => { if (frame.current) cancelAnimationFrame(frame.current); }, []);
	useEffect(() => {
		function update() { const limit = maximum(); setMaximumHeight(limit); setHeight((current) => current === undefined ? current : Math.min(current, limit)); }
		update(); window.addEventListener("resize", update); return () => window.removeEventListener("resize", update);
	}, []);
	function finish(event: PointerEvent<HTMLElement>) {
		if (frame.current) { cancelAnimationFrame(frame.current); frame.current = 0; setHeight(bound(pending.current)); }
		start.current = null;
		setResizing(false);
		if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
	}
	return {
		editorRef, height, resizing, maximumHeight,
		resizeProps: {
			onPointerDown(event: PointerEvent<HTMLElement>) {
				if (event.button !== 0 || !editorRef.current) return;
				event.preventDefault();
				start.current = { y: event.clientY, height: editorRef.current.getBoundingClientRect().height };
				pending.current = start.current.height;
				event.currentTarget.setPointerCapture(event.pointerId);
				setResizing(true);
			},
			onPointerMove(event: PointerEvent<HTMLElement>) {
				if (!start.current) return;
				pending.current = start.current.height + start.current.y - event.clientY;
				if (!frame.current) frame.current = requestAnimationFrame(() => { frame.current = 0; setHeight(bound(pending.current)); });
			},
			onPointerUp: finish,
			onPointerCancel: finish,
			onKeyDown(event: KeyboardEvent<HTMLElement>) {
				const current = height ?? Math.max(144, editorRef.current?.getBoundingClientRect().height ?? 144);
				const next = event.key === "ArrowUp" ? current + 24 : event.key === "ArrowDown" ? current - 24 : event.key === "Home" ? 144 : event.key === "End" ? maximum() : null;
				if (next === null) return;
				event.preventDefault(); event.stopPropagation(); setHeight(bound(next));
			},
		},
	};
}
