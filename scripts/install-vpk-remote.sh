#!/usr/bin/env bash
set -euo pipefail
source_dir="$(cd "$(dirname "$0")" && pwd)"
target="$HOME/.config/litellm-proximity/bin"
config="$HOME/.config/litellm-proximity/config.yaml"
[[ -f "$config" ]] || { printf 'Missing LiteLLM config: %s\n' "$config" >&2; exit 1; }
IFS= read -r shebang < "$HOME/.local/bin/litellm"
python_bin="${shebang#\#!}"
[[ -x "$python_bin" ]] || { printf 'Cannot find the LiteLLM Python interpreter\n' >&2; exit 1; }
mkdir -p "$target"
for name in ai-api vpk-remote-preflight.js vpk_remote_callback.py vpk_remote_tools.py; do
	if [[ -f "$target/$name" && ! -e "$target/$name.before-remote-hardening" ]]; then
		cp -p "$target/$name" "$target/$name.before-remote-hardening"
	fi
done
install -m 755 "$source_dir/vpk-ai-api.sh" "$target/ai-api"
install -m 644 "$source_dir/vpk-remote-preflight.js" "$target/vpk-remote-preflight.js"
install -m 644 "$source_dir/vpk_remote_tools.py" "$target/vpk_remote_tools.py"
install -m 644 "$source_dir/vpk_remote_callback.py" "$target/vpk_remote_callback.py"
"$python_bin" - "$config" <<'PY'
import os
from pathlib import Path
import shutil
import sys
import tempfile
import yaml

config = Path(sys.argv[1])
data = yaml.safe_load(config.read_text())
settings = data.setdefault("litellm_settings", {})
callbacks = settings.setdefault("callbacks", [])
if not isinstance(callbacks, list):
    raise SystemExit("litellm_settings.callbacks must be an array; existing configuration was not changed")
callback = "vpk_remote_callback.tool_guard"
if callback not in callbacks:
    backup = config.with_name(config.name + ".before-remote-hardening")
    if not backup.exists():
        shutil.copy2(config, backup)
    callbacks.append(callback)
    fd, name = tempfile.mkstemp(dir=config.parent, prefix=".remote-config-")
    try:
        with os.fdopen(fd, "w") as handle:
            yaml.safe_dump(data, handle, sort_keys=False)
        os.replace(name, config)
    finally:
        if os.path.exists(name):
            os.unlink(name)
PY
startup="$HOME/.config/litellm-proximity/start.sh"
if [[ -f "$startup" && ! -e "$startup.before-remote-hardening" ]]; then cp -p "$startup" "$startup.before-remote-hardening"; fi
install -m 755 "$source_dir/vpk-litellm-start.sh" "$startup"
printf 'Installed launcher, preflight, and tool guard in %s\n' "$target"
printf 'Restart the local LiteLLM translator to load the guard; no gateway or model settings were changed.\n'
