import type { ReactNode } from "react";

export function ChainOfThoughtDemoFrame({ children }: Readonly<{ children: ReactNode }>) {
	return (
		<div
			className="flex min-h-[400px] w-full items-center justify-center p-4 sm:p-6"
			data-chain-of-thought-demo-frame="true"
		>
			{children}
		</div>
	);
}
