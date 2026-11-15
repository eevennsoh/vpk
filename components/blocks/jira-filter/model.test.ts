import assert from "node:assert/strict";
import test from "node:test";
import {
	jiraFiltersEqual,
	parseJiraFilter,
	serializeJiraFilter,
	type JiraFilterCondition,
	type JiraFilterField,
} from "./model.ts";

const fields: JiraFilterField[] = [
	{
		id: "status",
		label: "Status",
		multiple: true,
		options: [
			{ value: "in progress", label: "In progress" },
			{ value: "review, blocked", label: "Review, blocked" },
			{ value: 'say "hello"', label: "Quoted" },
		],
	},
	{
		id: "assignee",
		label: "Assignee",
		options: [{ value: "imani", label: "Imani" }],
	},
];

test("JQL round trips multi-value exclusions and escaped values", () => {
	const conditions: JiraFilterCondition[] = [
		{
			field: "status",
			operator: "is not",
			values: ["review, blocked", 'say "hello"'],
		},
		{ field: "assignee", operator: "is", values: ["imani"] },
	];
	const result = parseJiraFilter(serializeJiraFilter(conditions), fields);
	assert.equal(result.error, null);
	assert.deepEqual(result.conditions, conditions);
	assert.equal(jiraFiltersEqual(conditions, [...conditions].reverse()), true);
});

test("invalid and unsupported JQL never yields a partial selection", () => {
	for (const query of [
		'status = "in progress" AND unknown = x',
		'status IN ("in progress",)',
		"assignee IN (imani, imani)",
		'status = "in progress" OR assignee = imani',
		'status = "in progress" AND',
	]) {
		const result = parseJiraFilter(query, fields);
		assert.ok(result.error, query);
		assert.deepEqual(result.conditions, []);
	}
	assert.deepEqual(parseJiraFilter("  ", fields), {
		conditions: [],
		error: null,
	});
});
