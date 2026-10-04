"use client";

import { token } from "@/lib/tokens";
import Image from "next/image";

interface ProjectItemProps {
	name: string;
	imageSrc: string;
	isSelected?: boolean;
	onClick?: () => void;
}

export function ProjectItem({
	name,
	imageSrc,
	isSelected = false,
	onClick,
}: Readonly<ProjectItemProps>) {
	return (
		<button
			type="button"
			aria-pressed={isSelected}
			style={{
				display: "flex",
				alignItems: "center",
				padding: token("space.050"),
				borderRadius: token("radius.xsmall"),
				border: 0,
				cursor: "pointer",
				backgroundColor: isSelected
					? token("color.background.selected")
					: "transparent",
				color: "inherit",
				position: "relative",
				gap: token("space.025"),
				minHeight: "32px",
				textAlign: "left",
				width: "100%",
			}}
			onClick={onClick}
		>
			{isSelected ? <span
					aria-hidden
					style={{
						position: "absolute",
						left: 0,
						top: "50%",
						transform: "translateY(-50%)",
						width: "2px",
						height: "12px",
						backgroundColor: token("color.border.selected"),
						borderRadius: token("radius.xsmall"),
					}}
				/> : null}

			<span
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					width: "24px",
					height: "24px",
					marginLeft: token("space.025"),
					borderRadius: token("radius.small"),
					overflow: "hidden",
				}}
			>
				<Image src={imageSrc} alt="" width={24} height={24} />
			</span>

			<span
				style={{
					font: token("font.body"),
					fontWeight: token("font.weight.medium"),
					color: isSelected
						? token("color.text.selected")
						: token("color.text.subtle"),
					flex: 1,
					paddingLeft: token("space.025"),
					overflow: "hidden",
					textOverflow: "ellipsis",
					whiteSpace: "nowrap",
				}}
			>
				{name}
			</span>
		</button>
	);
}
