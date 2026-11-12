"use client";

import { useId, type ReactElement, type ReactNode } from "react";

export function AgentListRowBody({
	children,
	className,
	footer,
	isSelected,
	onView,
	renderViewTrigger,
	viewDescription,
}: Readonly<{
	children: ReactNode;
	className: string;
	footer?: ReactNode;
	isSelected: boolean;
	onView?: () => void;
	renderViewTrigger?: (trigger: ReactElement) => ReactNode;
	viewDescription?: string;
}>) {
	const descriptionId = useId();
	if (onView === undefined) {
		return <div className={className}>{children}{footer}</div>;
	}

	const trigger = (
		<button
			aria-describedby={viewDescription ? descriptionId : undefined}
			aria-pressed={renderViewTrigger === undefined ? isSelected : undefined}
			className={footer === undefined ? className : `${className} w-full`}
			onClick={renderViewTrigger === undefined ? onView : undefined}
			type="button"
		>
			{children}
		</button>
	);
	const viewTrigger = renderViewTrigger === undefined ? trigger : renderViewTrigger(trigger);
	return (
		<>
			{footer === undefined ? viewTrigger : (
				<div className="flex min-w-0 flex-1 flex-col items-start justify-center text-left">
					{viewTrigger}
					{footer}
				</div>
			)}
			{viewDescription ? <span className="sr-only" id={descriptionId}>{viewDescription}</span> : null}
		</>
	);
}
