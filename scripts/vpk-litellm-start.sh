#!/usr/bin/env sh
set -eu
dir="$(cd "$(dirname "$0")" && pwd)"
export PYTHONPATH="$dir/bin${PYTHONPATH:+:$PYTHONPATH}"
export LITELLM_LOCAL_MODEL_COST_MAP=True
LITELLM_MASTER_KEY="$(cat "$dir/master_key")" exec "$HOME/.local/bin/litellm" \
	--config "$dir/config.yaml" --host 127.0.0.1 --port 4000 "$@"
