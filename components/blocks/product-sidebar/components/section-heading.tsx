"use client";

import { type ReactNode } from "react";
import { token } from "@/lib/tokens";

interface SectionHeadingProps {
	children: ReactNode;
}

export function SectionHeading({ children }: Readonly<SectionHeadingProps>) {
	return (
		<div
			style={{
				padding: `${token("space.100")} 0 ${token("space.050")} ${token("space.075")}`,
				font: token("font.body.small"),
				fontWeight: token("font.weight.semibold"),
				color: token("color.text.subtlest"),
			}}
		>
			{children}
		</div>
	);
}
