"use client";

import { createContext, type ReactNode, use } from "react";

const StaticChartPreviewContext = createContext(false);

/** Disables cartesian reveal clip-path for static docs previews. */
export function StaticChartPreviewProvider({
	children,
}: {
	children: ReactNode;
}) {
	return (
		<StaticChartPreviewContext value={true}>
			{children}
		</StaticChartPreviewContext>
	);
}

export function useStaticChartPreview() {
	return use(StaticChartPreviewContext);
}
