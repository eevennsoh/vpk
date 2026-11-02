import copy
import unittest

from vpk_remote_tools import ToolConflict, normalize_request


def function(name, **extra):
    return {"type": "function", "name": name, "parameters": {"type": "object", "properties": {}}, **extra}


def namespace(name, *tools):
    return {"type": "namespace", "name": name, "tools": list(tools)}


class ToolNormalizationTests(unittest.TestCase):
    def test_forked_history_does_not_duplicate_collaboration_or_browser_tools(self):
        collaboration = namespace("collaboration", function("send_message"), function("wait_agent"))
        browser = namespace("mcp__cua_repl", function("js"), function("js_reset"))
        request = {"tools": [collaboration, browser], "input": [
            {"role": "user", "content": "continue"},
            {"type": "additional_tools", "tools": [collaboration, browser]},
        ]}
        before = copy.deepcopy(request)
        result = normalize_request(request)
        self.assertEqual(result["tools"], [collaboration, browser])
        self.assertEqual(result["input"], [{"role": "user", "content": "continue"}])
        self.assertEqual(request, before)

    def test_new_tools_in_historical_bundles_are_kept_and_namespaces_merge(self):
        result = normalize_request({"tools": [namespace("browser", function("open"))], "input": [
            {"type": "additional_tools", "tools": [namespace("browser", function("open"), function("click"))]},
        ]})
        self.assertEqual(result["tools"], [namespace("browser", function("open"), function("click"))])
        self.assertEqual(normalize_request(result), result)

    def test_distinct_namespaces_may_share_member_names(self):
        tools = [namespace("one", function("read")), namespace("two", function("read"))]
        self.assertEqual(normalize_request({"tools": tools})["tools"], tools)

    def test_current_runtime_schema_supersedes_old_forked_schema(self):
        current = namespace("collaboration", function("spawn_agent", parameters={"type": "object", "properties": {"model": {"type": "string"}}}))
        old = namespace("collaboration", function("spawn_agent"))
        result = normalize_request({"tools": [current], "input": [{"type": "additional_tools", "tools": [old]}]})
        self.assertEqual(result["tools"], [current])

    def test_latest_historical_schema_wins_when_no_current_tool_is_defined(self):
        old = function("read")
        newer = function("read", description="newer")
        result = normalize_request({"input": [
            {"type": "additional_tools", "tools": [old]},
            {"type": "additional_tools", "tools": [newer]},
        ]})
        self.assertEqual(result["tools"], [newer])

    def test_conflicting_schemas_fail_instead_of_silently_replacing_a_tool(self):
        for tools in [
            [function("read"), function("read", parameters={"type": "string"})],
            [namespace("one", function("read")), namespace("one", function("read", description="different"))],
            [function("one"), namespace("one", function("read"))],
        ]:
            with self.subTest(tools=tools), self.assertRaises(ToolConflict):
                normalize_request({"tools": tools})

    def test_repeated_custom_and_hosted_tools_are_only_deduplicated_if_identical(self):
        custom = {"type": "custom", "name": "exec", "format": {"type": "text"}}
        hosted = {"type": "web_search"}
        result = normalize_request({"tools": [custom, custom, hosted, hosted], "input": "hello"})
        self.assertEqual(result, {"tools": [custom, hosted], "input": "hello"})
        with self.assertRaises(ToolConflict):
            normalize_request({"tools": [hosted, {**hosted, "search_context_size": "low"}]})

    def test_tool_results_and_ordinary_history_are_untouched(self):
        history = [{"type": "function_call_output", "call_id": "abc", "output": "content"}]
        self.assertEqual(normalize_request({"input": history}), {"input": history})

    def test_malformed_additions_are_rejected(self):
        for tools in [None, "not-tools", {}]:
            with self.subTest(tools=tools), self.assertRaises(ToolConflict):
                normalize_request({"input": [{"type": "additional_tools", "tools": tools}]})
        for function in [None, [], "invalid"]:
            with self.subTest(function=function), self.assertRaises(ToolConflict):
                normalize_request({"tools": [{"type": "function", "function": function}]})


if __name__ == "__main__":
    unittest.main()
