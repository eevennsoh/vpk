from fastapi import HTTPException
from litellm.integrations.custom_logger import CustomLogger

from vpk_remote_tools import ToolConflict, normalize_request


class ToolGuard(CustomLogger):
    async def async_pre_call_hook(self, user_api_key_dict, cache, data, call_type):
        if call_type not in ("responses", "aresponses"):
            return data
        try:
            return normalize_request(data)
        except ToolConflict as error:
            raise HTTPException(status_code=400, detail=str(error)) from error


tool_guard = ToolGuard()
