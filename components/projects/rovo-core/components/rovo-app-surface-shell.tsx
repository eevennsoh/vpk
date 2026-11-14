"use client";

import type { ComponentType, ReactNode } from "react";
import { startTransition } from "react";
import { useRouter } from "next/navigation";

import TopNavigation, {
	type ShellSidebarSlotState,
} from "@/components/blocks/top-navigation/page";
import type { UseRovoAppThreadListResult } from "@/components/projects/rovo-core/hooks/use-rovo-app-thread-list";
import { useSidebarHoverReveal } from "@/components/projects/rovo-core/hooks/use-sidebar-hover-reveal";
import type { RovoAppThread } from "@/lib/rovo-app-types";

export interface RovoAppSurfaceShellSidebarProps {
	activeThreadId: string | null;
	hoverOpen?: boolean;
	headerOffsetPx?: number;
	isResizing?: boolean;
	onCancelThreadRun: (threadId: string) => Promise<void>;
	onDeleteThread: (threadId: string) => Promise<void>;
	onNewChat: () => void;
	onSelectThread: (threadId: string) => Promise<void>;
	onSidebarMouseEnter?: () => void;
	onSidebarMouseLeave?: () => void;
	resizeHandle?: ReactNode;
	threads: ReadonlyArray<RovoAppThread>;
	threadsLoaded?: boolean;
	topOffset?: boolean;
}

interface RovoAppSurfaceShellCoreProps {
	buildThreadPath: (threadId: string) => string;
	children: ReactNode;
	product: "rovo" | "studio";
	rootPath: string;
	SidebarComponent: ComponentType<RovoAppSurfaceShellSidebarProps>;
	useThreadList: () => UseRovoAppThreadListResult;
}

export type RovoAppSurfaceShellFactoryOptions = Omit<RovoAppSurfaceShellCoreProps, "children">;

export function RovoAppSurfaceShellCore({
	buildThreadPath,
	children,
	product,
	rootPath,
	SidebarComponent,
	useThreadList,
}: Readonly<RovoAppSurfaceShellCoreProps>) {
	const router = useRouter();
	const { deleteThread, threads, threadsLoaded } = useThreadList();

	const { handleSidebarContentMouseEnter, handleSidebarContentMouseLeave, hoverRevealActive } = useSidebarHoverReveal();

	return (
		<TopNavigation
			variant="shell"
			product={product}
			sidebar={(slot: ShellSidebarSlotState) => (
				<SidebarComponent
					activeThreadId={null}
					headerOffsetPx={slot.headerOffsetPx}
					hoverOpen={hoverRevealActive}
					isResizing={slot.isResizing}
					onCancelThreadRun={() => Promise.resolve()}
					onDeleteThread={async (threadId) => {
						startTransition(() => {
							void deleteThread(threadId);
						});
					}}
					onNewChat={() => {
						router.push(rootPath);
					}}
					onSelectThread={async (threadId) => {
						router.push(buildThreadPath(threadId));
					}}
					onSidebarMouseEnter={handleSidebarContentMouseEnter}
					onSidebarMouseLeave={handleSidebarContentMouseLeave}
					resizeHandle={slot.resizeHandle}
					threads={threads}
					threadsLoaded={threadsLoaded}
					topOffset
				/>
			)}
		>
			{children}
		</TopNavigation>
	);
}
