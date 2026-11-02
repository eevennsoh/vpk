"""Normalize Responses tool additions before LiteLLM hoists historical bundles."""


class ToolConflict(ValueError):
    pass


def merge_tools(tools, prefer_first=False):
    merged = []
    slots = {}
    for tool in tools:
        if not isinstance(tool, dict):
            raise ToolConflict("Invalid tool definition; expected an object")
        kind = tool.get("type")
        function = tool.get("function", {})
        if not isinstance(function, dict):
            raise ToolConflict("Tool function definition must be an object")
        name = tool.get("name") or function.get("name") or kind
        if not isinstance(name, str) or not name:
            raise ToolConflict("Tool definition has no name or type")
        key = name
        if kind == "namespace":
            if not isinstance(tool.get("tools"), list):
                raise ToolConflict("Namespace tool list must be an array")
            tool = {**tool, "tools": merge_tools(tool["tools"], prefer_first)}
        if key not in slots:
            slots[key] = len(merged)
            merged.append(tool)
            continue
        index = slots[key]
        previous = merged[index]
        if previous == tool:
            continue
        if previous.get("type") == kind == "namespace":
            previous_meta = {k: v for k, v in previous.items() if k != "tools"}
            current_meta = {k: v for k, v in tool.items() if k != "tools"}
            if prefer_first or previous_meta == current_meta:
                merged[index] = {**previous, "tools": merge_tools([*previous["tools"], *tool["tools"]], prefer_first)}
                continue
        if prefer_first:
            continue
        raise ToolConflict(f"Conflicting tool definitions for {name[:128]!r}; start a fresh session or repair the schema. No tool was silently replaced.")
    return merged


def normalize_request(data):
    items = data.get("input")
    if not isinstance(items, list):
        items = []
    additions = [item for item in items if isinstance(item, dict) and item.get("type") == "additional_tools"]
    tools = data.get("tools", [])
    if not isinstance(tools, list):
        raise ToolConflict("Top-level tools must be an array")
    current = merge_tools(tools)
    historical = []
    for item in reversed(additions):
        extra = item.get("tools")
        if not isinstance(extra, list):
            raise ToolConflict("Historical additional_tools must contain a tool array")
        historical.extend(extra)
    if not current and not additions:
        return data
    result = {**data, "tools": merge_tools([*current, *historical], prefer_first=True)}
    if additions:
        result["input"] = [item for item in items if not (isinstance(item, dict) and item.get("type") == "additional_tools")]
    return result
