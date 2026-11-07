"use client";

import { useLayoutEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { JiraIssue } from "@/components/blocks/jira-issue";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

import {
	JIRA_CREATE_BOARD_COLUMNS,
	JIRA_CREATE_COLUMN_TITLE,
	type JiraCreateColumnItem,
} from "../data/jira-creating-board";
import { subscribeCreatedCardBottomReveal } from "../lib/jira-creating-column-scroll";
import { getJiraCreateLayoutTransition } from "../lib/jira-creating-motion";
import { JiraCreateCard } from "./jira-creating-card";

const COLUMN_WIDTH_PX = 276;

export interface JiraCreateBoardProps {
	className?: string;
	revealItemIds?: readonly string[];
	todoItems: readonly JiraCreateColumnItem[];
}

function TodoColumnItem({
	isFirst,
	item,
}: Readonly<{ isFirst: boolean; item: JiraCreateColumnItem }>) {
	const shouldReduceMotion = useReducedMotion();
	const spacerClassName = isFirst ? undefined : "pt-2";

	if (item.kind === "created") {
		return (
			<JiraCreateCard
				card={item.card}
				className={spacerClassName}
				enterDelayS={item.enterDelayS}
				itemId={item.id}
			/>
		);
	}

	return (
		<motion.div
			className={cn("w-full min-w-0 shrink-0", spacerClassName)}
			data-jira-creating-item-id={item.id}
			layout={!shouldReduceMotion}
			transition={getJiraCreateLayoutTransition(shouldReduceMotion)}
		>
			<JiraIssue appearance="default"
				assigneeAvatarLabel={item.card.assigneeAvatarLabel}
				assigneeAvatarSrc={item.card.assigneeAvatarSrc}
				chrome="stroke"
				compact
				draggable={false}
				issueKey={item.card.code}
				priority={item.card.priority}
				showMoreAction={false}
				summary={item.card.title}
				tags={item.card.tags}
			/>
		</motion.div>
	);
}

export function JiraCreateBoard({
	className,
	revealItemIds = [],
	todoItems,
}: Readonly<JiraCreateBoardProps>) {
	const createColumnListRef = useRef<HTMLDivElement>(null);

	useLayoutEffect(() => {
		const cardList = createColumnListRef.current;
		if (cardList === null || revealItemIds.length === 0) {
			return undefined;
		}

		const targets = revealItemIds.flatMap((itemId) => {
			const node = cardList.querySelector<HTMLElement>(
				`[data-jira-creating-item-id="${itemId}"]`,
			);
			return node ? [node] : [];
		});
		if (targets.length === 0) {
			return undefined;
		}

		return subscribeCreatedCardBottomReveal(cardList, targets);
	}, [revealItemIds, todoItems]);

	return (
		<div
			className={cn("flex min-h-0 min-w-0 overflow-x-auto", className)}
			style={{ padding: token("space.150") }}
		>
			<div className="flex min-h-full min-w-0 flex-1 items-stretch gap-2">
				{JIRA_CREATE_BOARD_COLUMNS.map((column) => {
					const isCreateColumn = column.title === JIRA_CREATE_COLUMN_TITLE;
					const items = isCreateColumn ? todoItems : column.cards.map((card) => ({
						card,
						enterDelayS: 0,
						id: card.code,
						kind: "resting" as const,
					}));

					return (
						<section
							aria-label={`${column.title} column`}
							className="flex min-h-0 min-w-0 flex-col"
							key={column.title}
							style={{
								minWidth: `${COLUMN_WIDTH_PX}px`,
								width: `${COLUMN_WIDTH_PX}px`,
							}}
						>
							<div
								className="flex min-w-0 shrink-0 items-center gap-1.5"
								style={{ paddingBottom: token("space.100") }}
							>
								<span className="truncate text-xs font-medium leading-4 text-text-subtle">
									{column.title}
								</span>
								<span className="shrink-0 text-xs font-normal text-text-subtlest">
									{items.length}
								</span>
							</div>
							<div
								className="flex min-h-0 flex-1 flex-col overflow-y-auto"
								data-jira-creating-column-list=""
								ref={isCreateColumn ? createColumnListRef : undefined}
							>
								<AnimatePresence initial={false}>
									{items.map((item, index) => (
										<TodoColumnItem
											isFirst={index === 0}
											item={item}
											key={item.id}
										/>
									))}
								</AnimatePresence>
							</div>
						</section>
					);
				})}
			</div>
		</div>
	);
}
