"use client";

import type { ReactElement, ReactNode } from "react";

export function AgentListRowBody({
	children,
	className,
	isSelected,
	onView,
	renderViewTrigger,
}: Readonly<{
	children: ReactNode;
	className: string;
	isSelected: boolean;
	onView?: () => void;
	renderViewTrigger?: (trigger: ReactElement) => ReactNode;
}>) {
	if (onView === undefined) {
		return <div className={className}>{children}</div>;
	}

	const trigger = (
		<button
			aria-pressed={renderViewTrigger === undefined ? isSelected : undefined}
			className={className}
			onClick={renderViewTrigger === undefined ? onView : undefined}
			type="button"
		>
			{children}
		</button>
	);
	return renderViewTrigger === undefined ? trigger : renderViewTrigger(trigger);
}
