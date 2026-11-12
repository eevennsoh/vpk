"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { MotionValue } from "motion/react";
import { JiraActivityEntryGlyph, jiraActivitySegmentsToPlainText, type JiraActivityEntry } from "@/components/blocks/jira-activity";
import { ScrubberRail } from "@/components/blocks/scrubber/components/scrubber-rail";
import type { ScrubberEntry } from "@/components/blocks/scrubber/lib/scrubber-entries";
import { activityDateLabel } from "@/components/blocks/jira-work-item/project-butter/activity-data";
import { activityStopOffset } from "@/components/blocks/jira-work-item/project-butter/use-activity-navigation";
import { cn } from "@/lib/utils";

/** How far the hover label may overhang the rail ends: the 20px hover circle's radius plus the label's `px-1`. */
const LABEL_END_OVERHANG = 14;

function rowLabel(entry: JiraActivityEntry): string {
	if (entry.kind === "comment") return jiraActivitySegmentsToPlainText(entry.body);
	if (entry.kind === "event") return jiraActivitySegmentsToPlainText(entry.segments);
	return entry.summary;
}

/** Comments lead with their author; events lead with the same glyph their row shows. No enter motion while scrubbing. */
function RowGlyph({ entry }: Readonly<{ entry: JiraActivityEntry }>) {
	return <JiraActivityEntryGlyph actor={entry.actor} animate={false} icon={entry.kind === "event" ? entry.icon : undefined} />;
}

/**
 * Header dot scrubber with one evenly spaced stop per rendered row, so an
 * "N updates" group is one stop. Hover or focus previews the row's glyph and
 * exact time above its dot; click or drag scrolls the feed there.
 */
export function ProjectButterActivityTimeline({ rows, visibleId, progress, onSelect, onSeek }: Readonly<{
	rows: readonly JiraActivityEntry[];
	visibleId: string | null;
	progress: MotionValue<number>;
	onSelect: (id: string) => void;
	onSeek: (progress: number) => void;
}>) {
	const [hoverId, setHoverId] = useState<string | null>(null);
	const activeIndex = Math.max(0, rows.findIndex((entry) => entry.id === visibleId));
	const entries: ScrubberEntry[] = rows.map((entry, index) => ({
		id: entry.id,
		kind: "minor",
		// The first and last stops sit exactly on the rail's ends.
		offset: activityStopOffset(index, rows.length),
		heading: activityDateLabel(entry),
		label: `Go to step ${index + 1}: ${entry.kind === "comment" ? entry.headerLabel ?? entry.actor.name : entry.actor.name}: ${rowLabel(entry)}`,
	}));
	const previewIndex = entries.findIndex((entry) => entry.id === hoverId);
	const labelRefs = useRef(new Map<string, HTMLSpanElement>());
	const previewId = previewIndex < 0 ? null : entries[previewIndex]!.id;
	const previewOffset = previewIndex < 0 ? undefined : entries[previewIndex]!.offset;
	// Center the label over its dot; near an end, clamp its content flush with the end dot's hover circle
	// (10px radius + the label's 4px padding), so the glyph sits over the first dot and the text ends at the last.
	// Measured before paint, so the label never flashes at its unclamped spot.
	useLayoutEffect(() => {
		const label = previewId ? labelRefs.current.get(previewId) : undefined;
		const track = label?.parentElement;
		if (!label || !track || previewOffset === undefined) return;
		const width = label.offsetWidth;
		const center = previewOffset * track.clientWidth;
		label.style.left = `${Math.min(Math.max(center - width / 2, -LABEL_END_OVERHANG), track.clientWidth + LABEL_END_OVERHANG - width)}px`;
	}, [previewId, previewOffset]);
	if (rows.length === 0) return null;
	return (
		<div className="relative min-w-0 flex-1" data-project-butter-activity-timeline>
			{/* Every row's label stays mounted (invisible) so its avatar image is already loaded;
			    scrubbing only flips visibility, so the reveal is instant. The marks carry the spoken names. */}
			{entries.map((entry, index) => (
				<span
					aria-hidden
					className={cn("pointer-events-none absolute bottom-full left-0 z-10 mb-1.5 flex items-center gap-1 whitespace-nowrap rounded-sm bg-surface px-1 text-xs leading-4 text-text-subtle", entry.id === previewId ? "visible" : "invisible")}
					data-project-butter-timeline-preview={entry.id === previewId ? "" : undefined}
					key={entry.id}
					ref={(node) => { if (node) labelRefs.current.set(entry.id, node); else labelRefs.current.delete(entry.id); }}
				>
					<RowGlyph entry={rows[index]!} />
					{entry.heading}
				</span>
			))}
			<ScrubberRail
				activeIndex={activeIndex}
				activeOffset={progress}
				appearance="dots"
				ariaLabel="Navigate activity"
				className="text-icon-subtle"
				entries={entries}
				onFocusChange={setHoverId}
				onHoverChange={setHoverId}
				onSelect={onSelect}
				onSeek={onSeek}
				selectionMode="drag"
				showPill={false}
			/>
		</div>
	);
}
