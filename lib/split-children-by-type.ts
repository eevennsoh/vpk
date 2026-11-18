import { Children, isValidElement, type ElementType, type ReactNode } from "react";

/**
 * Splits children into the ones whose element type is not in `types` and the
 * ones that are. Pattern wrappers on Trace use it to lift buttons out of a
 * TraceCollapsibleTrigger, since a button cannot sit inside another button.
 */
export function splitChildrenByType(
	children: ReactNode,
	types: readonly ElementType[],
): [rest: ReactNode[], matched: ReactNode[]] {
	const rest: ReactNode[] = [];
	const matched: ReactNode[] = [];

	for (const child of Children.toArray(children)) {
		if (isValidElement(child) && types.includes(child.type as ElementType)) {
			matched.push(child);
		} else {
			rest.push(child);
		}
	}

	return [rest, matched];
}
