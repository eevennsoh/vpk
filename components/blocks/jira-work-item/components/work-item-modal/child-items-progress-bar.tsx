"use client";

// oxlint-disable react-doctor/prefer-tag-over-role -- Segmented child-item progress cannot use a native progress element without losing the done / in-progress / to-do colors.

import { token } from "@/lib/tokens";
import type { WorkItemChildItem } from "@/app/contexts/context-work-item-modal";

interface ChildItemsProgressBarProps {
	items: readonly WorkItemChildItem[];
}

export function ChildItemsProgressBar({ items }: Readonly<ChildItemsProgressBarProps>) {
	const total = items.length;
	const doneCount = items.filter((item) => item.status === "done").length;
	const inProgressCount = items.filter((item) => item.status === "inprogress").length;
	const todoCount = Math.max(0, total - doneCount - inProgressCount);
	const donePercent = total > 0 ? Math.round((doneCount / total) * 100) : 0;

	if (total === 0) return null;

	return (
		<div
			aria-label={`${donePercent}% complete; ${inProgressCount} of ${total} subitems in progress`}
			aria-valuemax={100}
			aria-valuemin={0}
			aria-valuenow={donePercent}
			role="progressbar"
			style={{
				display: "flex",
				alignItems: "center",
				gap: token("space.200"),
				marginBottom: token("space.100"),
			}}
		>
			<div
				style={{
					flex: 1,
					display: "flex",
					height: "6px",
					borderRadius: token("radius.small"),
					overflow: "hidden",
				}}
			>
				<div
					style={{
						flex: Math.max(doneCount, 0),
						backgroundColor: token("color.background.success.bold"),
						borderRadius: `${token("radius.small")} 0 0 ${token("radius.small")}`,
					}}
					title={`${doneCount} of ${total} Done`}
				/>
				<div
					style={{ flex: Math.max(inProgressCount, 0), backgroundColor: token("color.background.information.bold") }}
					title={`${inProgressCount} of ${total} In progress`}
				/>
				<div
					style={{
						flex: Math.max(todoCount, 0),
						backgroundColor: token("color.border"),
						borderRadius: `0 ${token("radius.small")} ${token("radius.small")} 0`,
					}}
					title={`${todoCount} of ${total} To do`}
				/>
			</div>
			<span className="text-sm">{donePercent}% Done</span>
		</div>
	);
}
