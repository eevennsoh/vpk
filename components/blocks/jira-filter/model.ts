export type JiraFilterField = {
	id: string;
	label: string;
	options: readonly { value: string; label: string }[];
	multiple?: boolean;
};

export type JiraFilterCondition = {
	field: string;
	operator: "is" | "is not";
	values: readonly string[];
};

export type JiraSavedFilter = {
	id: string;
	name: string;
	group: "team" | "personal" | "default";
	conditions: readonly JiraFilterCondition[];
};

export function serializeJiraFilter(
	conditions: readonly JiraFilterCondition[],
): string {
	return conditions
		.filter((condition) => condition.field && condition.values.length)
		.map(({ field, operator, values }) => {
			const quoted = values.map((value) => JSON.stringify(value));
			const op =
				operator === "is not"
					? values.length === 1
						? "!="
						: "NOT IN"
					: values.length === 1
						? "="
						: "IN";
			return `${field} ${op} ${values.length === 1 ? quoted[0] : `(${quoted.join(", ")})`}`;
		})
		.join(" AND ");
}

export function parseJiraFilter(
	query: string,
	fields: readonly JiraFilterField[],
): { conditions: JiraFilterCondition[]; error: string | null } {
	if (!query.trim()) return { conditions: [], error: null };
	const clausePattern =
		/\s*([A-Za-z][\w]*)\s*(!=|NOT\s+IN|=|IN)\s*(\((?:[^"()]|"(?:\\.|[^"\\])*")*\)|"(?:\\.|[^"\\])*"|[\w.:-]+)\s*/iy;
	const valuePattern = /\s*("(?:\\.|[^"\\])*"|[\w.:-]+)\s*(,|$)/gy;
	const conditions: JiraFilterCondition[] = [];
	let position = 0;
	while (position < query.length) {
		clausePattern.lastIndex = position;
		const match = clausePattern.exec(query);
		if (!match)
			return { conditions: [], error: "Check the JQL syntax and try again." };
		const field = fields.find(
			(item) => item.id.toLowerCase() === match[1].toLowerCase(),
		);
		if (!field)
			return {
				conditions: [],
				error: `“${match[1]}” is not a supported filter field.`,
			};
		if (conditions.some((item) => item.field === field.id))
			return {
				conditions: [],
				error: `Use one ${field.label} clause and list alternatives with IN.`,
			};
		const operator = match[2].toUpperCase().replace(/\s+/g, " ");
		const list = operator.endsWith("IN");
		const raw = match[3];
		if (list !== (raw.startsWith("(") && raw.endsWith(")")))
			return {
				conditions: [],
				error: `Add a valid value to the ${field.label} clause.`,
			};
		const body = list ? raw.slice(1, -1) : raw;
		const values: string[] = [];
		let valuePosition = 0;
		while (valuePosition < body.length) {
			valuePattern.lastIndex = valuePosition;
			const item = valuePattern.exec(body);
			if (!item || (item[2] === "," && valuePattern.lastIndex === body.length))
				return {
					conditions: [],
					error: `Add a valid value to the ${field.label} clause.`,
				};
			let value = item[1];
			if (value.startsWith('"')) {
				try {
					value = JSON.parse(value) as string;
				} catch {
					return {
						conditions: [],
						error: `Add a valid value to the ${field.label} clause.`,
					};
				}
			}
			values.push(value);
			valuePosition = valuePattern.lastIndex;
		}
		if (
			!values.length ||
			(!field.multiple && values.length > 1) ||
			values.some(
				(value) => !field.options.some((option) => option.value === value),
			)
		)
			return {
				conditions: [],
				error: `Choose a supported value for ${field.label}.`,
			};
		conditions.push({
			field: field.id,
			operator: operator === "!=" || operator === "NOT IN" ? "is not" : "is",
			values: [...new Set(values)],
		});
		position = clausePattern.lastIndex;
		if (position < query.length) {
			const separator = query.slice(position).match(/^AND\s+/i);
			if (!separator)
				return { conditions: [], error: "Only AND clauses are supported." };
			position += separator[0].length;
			if (position === query.length)
				return { conditions: [], error: "Add a clause after AND." };
		}
	}
	return { conditions, error: null };
}

export function jiraFiltersEqual(
	a: readonly JiraFilterCondition[],
	b: readonly JiraFilterCondition[],
): boolean {
	const active = (items: readonly JiraFilterCondition[]) =>
		items.filter((item) => item.field && item.values.length);
	const left = active(a),
		right = active(b);
	return (
		left.length === right.length &&
		left.every((item) =>
			right.some(
				(other) =>
					item.field === other.field &&
					item.operator === other.operator &&
					item.values.length === other.values.length &&
					item.values.every((value) => other.values.includes(value)),
			),
		)
	);
}
