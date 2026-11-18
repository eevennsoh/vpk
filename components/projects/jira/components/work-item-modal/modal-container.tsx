"use client";

import { type CSSProperties, ReactNode, use } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";

import { useWorkItemModal } from "@/app/contexts/context-work-item-modal";
import { token } from "@/lib/tokens";
import { ModalFinalFocusContext } from "./modal-root";

const scrollColumnStyle: CSSProperties = {
	minHeight: 0,
	minWidth: 0,
	overflowY: "auto",
};

const columnStackBaseStyle: CSSProperties = {
	display: "grid",
	gridAutoRows: "max-content",
	alignContent: "start",
	minWidth: 0,
};

interface ModalContainerProps {
	children: ReactNode;
}

export function ModalContainer({ children }: Readonly<ModalContainerProps>) {
	const { meta } = useWorkItemModal();
	const finalFocus = use(ModalFinalFocusContext);

	return (
		<DialogPrimitive.Popup
			aria-label={meta.workItem.title}
			aria-modal="true"
			finalFocus={finalFocus}
			className="[&_a:visited]:text-link"
			style={{
				position: "fixed",
				top: "50%",
				left: "50%",
				transform: "translate(-50%, -50%)",
				width: "calc(100vw - 120px)",
				maxWidth: "1200px",
				height: "calc(100vh - 120px)",
				backgroundColor: token("elevation.surface.overlay"),
				borderRadius: token("radius.xlarge"),
				boxShadow: token("elevation.shadow.overlay"),
				zIndex: 501,
				display: "grid",
				gridTemplateRows: "auto minmax(0, 1fr)",
				overflow: "hidden",
				outline: "none",
			}}
		>
			{children}
		</DialogPrimitive.Popup>
	);
}

interface TwoColumnLayoutProps {
	children: ReactNode;
}

export function TwoColumnLayout({ children }: Readonly<TwoColumnLayoutProps>) {
	return (
		<div
			style={{
				display: "grid",
				gridTemplateColumns: "minmax(0, 1fr) clamp(320px, 34vw, 408px)",
				minHeight: 0,
				minWidth: 0,
				overflow: "hidden",
			}}
		>
			{children}
		</div>
	);
}

interface LeftColumnProps {
	children: ReactNode;
}

export function LeftColumn({ children }: Readonly<LeftColumnProps>) {
	return (
		<div
			style={{
				...scrollColumnStyle,
				paddingBlockEnd: token("space.400"),
				paddingInline: token("space.300"),
			}}
		>
			<div
				style={{
					...columnStackBaseStyle,
					rowGap: token("space.300"),
				}}
			>
				{children}
			</div>
		</div>
	);
}

interface RightColumnProps {
	children: ReactNode;
}

export function RightColumn({ children }: Readonly<RightColumnProps>) {
	return (
		<div
			style={{
				...scrollColumnStyle,
				paddingBlockStart: token("space.050"),
				paddingBlockEnd: token("space.400"),
				paddingInlineStart: token("space.100"),
				paddingInlineEnd: token("space.300"),
			}}
		>
			<div
				style={{
					...columnStackBaseStyle,
					rowGap: token("space.200"),
				}}
			>
				{children}
			</div>
		</div>
	);
}
