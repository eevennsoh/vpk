"use client";

import { ScrollMask } from "@/components/visual/scroll-mask";
import { token } from "@/lib/tokens";

const ROWS = Array.from({ length: 13 }, (_, index) => `Row ${index + 1}`);
const ROW_HEIGHT = `calc(${token("space.500")} + ${token("space.050")})`;

function ScrollMaskHeader() {
	return (
		<div className="flex items-center" style={{ minHeight: ROW_HEIGHT }}>
			<div className="truncate text-sm font-semibold text-text">Sticky header</div>
		</div>
	);
}

function ScrollMaskFooter() {
	return (
		<div className="flex items-center" style={{ minHeight: ROW_HEIGHT }}>
			<div className="truncate text-sm font-semibold text-text">Sticky footer</div>
		</div>
	);
}

export default function ScrollMaskDemo() {
	return (
		<div
			className="flex w-full flex-col items-center"
			style={{
				gap: token("space.300"),
				maxWidth: `calc(${token("space.600")} * 9)`,
			}}
		>
			<p className="w-full text-sm leading-relaxed text-text-subtle">
				<strong className="font-medium text-text">Always make the top fade shorter.</strong>{" "}
				Items disappear more abruptly, making the transition feel crisper and more natural.
			</p>
			<ScrollMask
				aria-label="Workspace menu"
				className="w-full"
				edgeBlur
				header={<ScrollMaskHeader />}
				footer={<ScrollMaskFooter />}
			>
				<div className="px-2">
					{ROWS.map((row) => (
						<button
							key={row}
							type="button"
							className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm font-medium text-text transition-colors hover:bg-bg-neutral-hovered focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focused"
							style={{ minHeight: ROW_HEIGHT }}
						>
							{row}
						</button>
					))}
				</div>
			</ScrollMask>
		</div>
	);
}
