"use client";

// oxlint-disable react-doctor/jsx-no-constructed-context-values -- Context values in this file intentionally combine live state and setters; extracting them would not reduce meaningful consumer churn.

import type { ToolUIPart } from "ai";
import type { ComponentProps, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
	Item,
	ItemActions,
	ItemContent,
	ItemTitle,
} from "@/components/ui/item";
import { createContext, use } from "react";

type ToolUIPartApproval =
	| {
			id: string;
			approved?: never;
			reason?: never;
	  }
	| {
			id: string;
			approved: true;
			reason?: string;
	  }
	| {
			id: string;
			approved: false;
			reason?: string;
	  }
	| undefined;

interface ConfirmationContextValue {
	approval: ToolUIPartApproval;
	state: ToolUIPart["state"];
}

const ConfirmationContext = createContext<ConfirmationContextValue | null>(
	null,
);

function useConfirmation() {
	const context = use(ConfirmationContext);

	if (!context) {
		throw new Error("Confirmation components must be used within Confirmation");
	}

	return context;
}

export type ConfirmationProps = ComponentProps<typeof Item> & {
	approval?: ToolUIPartApproval;
	state: ToolUIPart["state"];
};

export function Confirmation({
	approval,
	state,
	variant = "outline",
	size = "sm",
	...props
}: Readonly<ConfirmationProps>) {
	if (!approval || state === "input-streaming" || state === "input-available") {
		return null;
	}

	return (
		<ConfirmationContext value={{ approval, state }}>
			<Item size={size} variant={variant} {...props} />
		</ConfirmationContext>
	);
}

export type ConfirmationTitleProps = ComponentProps<typeof ItemTitle>;

export function ConfirmationTitle(props: Readonly<ConfirmationTitleProps>) {
	return (
		<ItemContent>
			<ItemTitle {...props} />
		</ItemContent>
	);
}

export interface ConfirmationRequestProps {
	children?: ReactNode;
}

export function ConfirmationRequest({
	children,
}: Readonly<ConfirmationRequestProps>) {
	const { state } = useConfirmation();

	if (state !== "approval-requested") {
		return null;
	}

	return <>{children}</>;
}

export interface ConfirmationAcceptedProps {
	children?: ReactNode;
}

export function ConfirmationAccepted({
	children,
}: Readonly<ConfirmationAcceptedProps>) {
	const { approval, state } = useConfirmation();

	if (
		!approval?.approved ||
		(state !== "approval-responded" &&
			state !== "output-denied" &&
			state !== "output-available")
	) {
		return null;
	}

	return <>{children}</>;
}

export interface ConfirmationRejectedProps {
	children?: ReactNode;
}

export function ConfirmationRejected({
	children,
}: Readonly<ConfirmationRejectedProps>) {
	const { approval, state } = useConfirmation();

	if (
		approval?.approved !== false ||
		(state !== "approval-responded" &&
			state !== "output-denied" &&
			state !== "output-available")
	) {
		return null;
	}

	return <>{children}</>;
}

export type ConfirmationActionsProps = ComponentProps<typeof ItemActions>;

export function ConfirmationActions(props: Readonly<ConfirmationActionsProps>) {
	const { state } = useConfirmation();

	if (state !== "approval-requested") {
		return null;
	}

	return <ItemActions {...props} />;
}

export type ConfirmationActionProps = ComponentProps<typeof Button>;

// VPK's `default` button size (h-8) is shadcn's `sm`.
export function ConfirmationAction(props: Readonly<ConfirmationActionProps>) {
	return <Button size="default" type="button" {...props} />;
}
