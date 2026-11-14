"use client";

import type { ComponentType, ReactNode } from "react";
import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import TopNavigation, {
	type ShellSidebarSlotState,
} from "@/components/blocks/top-navigation/page";
import type { UseRovoAppThreadListResult } from "@/components/projects/rovo-core/hooks/use-rovo-app-thread-list";
import { getCssDurationTokenMs } from "@/components/projects/rovo-core/lib/css-duration";
import type { RovoAppThread } from "@/lib/rovo-app-types";

const SIDEBAR_MOTION_DURATION_CSS_VARIABLE = "--duration-medium";
const SIDEBAR_MOTION_FALLBACK_MS = 200;

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

	const [hoverRevealActive, setHoverRevealActive] = useState(false);
	const hoverLeaveTimerRef = useRef<number | null>(null);

	const clearHoverTimer = useCallback(() => {
		if (hoverLeaveTimerRef.current) {
			window.clearTimeout(hoverLeaveTimerRef.current);
			hoverLeaveTimerRef.current = null;
		}
	}, []);

	const scheduleSidebarHoverClose = useCallback(() => {
		clearHoverTimer();
		hoverLeaveTimerRef.current = window.setTimeout(() => {
			setHoverRevealActive(false);
		}, getCssDurationTokenMs(SIDEBAR_MOTION_DURATION_CSS_VARIABLE, SIDEBAR_MOTION_FALLBACK_MS));
	}, [clearHoverTimer]);

	const handleSidebarContentMouseEnter = useCallback(() => {
		clearHoverTimer();
	}, [clearHoverTimer]);

	const handleSidebarContentMouseLeave = useCallback(() => {
		scheduleSidebarHoverClose();
	}, [scheduleSidebarHoverClose]);

	useEffect(() => {
		return () => clearHoverTimer();
	}, [clearHoverTimer]);

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
