import {
	useCallback,
	useEffect,
	useRef,
	type FocusEvent,
	type RefObject,
} from "react";

interface AgentSessionColumnInteraction {
	focused: boolean;
	pointer: boolean;
}

export function useAgentSessionColumnInteraction(
	onInteractionChange?: (interacting: boolean) => void,
	columnRef?: RefObject<HTMLElement | null>,
	collapsed?: boolean,
) {
	const interactionRef = useRef<AgentSessionColumnInteraction>({
		focused: false,
		pointer: false,
	});
	const reportedInteractionRef = useRef(false);
	const onInteractionChangeRef = useRef(onInteractionChange);
	useEffect(() => {
		onInteractionChangeRef.current = onInteractionChange;
	}, [onInteractionChange]);
	useEffect(() => () => {
		if (reportedInteractionRef.current) {
			onInteractionChangeRef.current?.(false);
		}
	}, []);

	const reportColumnInteraction = useCallback((
		kind: keyof AgentSessionColumnInteraction,
		active: boolean,
	) => {
		const interaction = interactionRef.current;
		if (interaction[kind] === active) {
			return;
		}
		interaction[kind] = active;
		const interacting = interaction.focused || interaction.pointer;
		if (reportedInteractionRef.current === interacting) {
			return;
		}
		reportedInteractionRef.current = interacting;
		onInteractionChange?.(interacting);
	}, [onInteractionChange]);
	useEffect(() => {
		// Removing the focused menu/row during a mode switch does not dispatch
		// blur. Reconcile after menu focus restoration so sync is not left paused.
		const frame = requestAnimationFrame(() => {
			if (columnRef?.current) {
				reportColumnInteraction("focused", columnRef.current.contains(document.activeElement));
			}
		});
		return () => cancelAnimationFrame(frame);
	}, [collapsed, columnRef, reportColumnInteraction]);
	const handleColumnFocusCapture = useCallback(() => {
		reportColumnInteraction("focused", true);
	}, [reportColumnInteraction]);
	const handleColumnBlurCapture = useCallback((event: FocusEvent<HTMLElement>) => {
		if (!(event.relatedTarget instanceof Node)
			|| !event.currentTarget.contains(event.relatedTarget)) {
			reportColumnInteraction("focused", false);
		}
	}, [reportColumnInteraction]);
	const handleColumnPointerEnter = useCallback(() => {
		reportColumnInteraction("pointer", true);
	}, [reportColumnInteraction]);
	const handleColumnPointerLeave = useCallback(() => {
		reportColumnInteraction("pointer", false);
	}, [reportColumnInteraction]);

	return {
		handleColumnBlurCapture,
		handleColumnFocusCapture,
		handleColumnPointerEnter,
		handleColumnPointerLeave,
	};
}
