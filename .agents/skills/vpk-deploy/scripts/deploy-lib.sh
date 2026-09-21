#!/bin/bash

# Shared, Bash 3-compatible deployment safety helpers.

VPK_DEPLOY_REQUIRED_STASHES="AI_GATEWAY_URL AI_GATEWAY_USE_CASE_ID AI_GATEWAY_CLOUD_ID AI_GATEWAY_USER_ID ASAP_KID ASAP_ISSUER ASAP_PRIVATE_KEY OPENAI_REALTIME_MODEL OPENAI_REALTIME_WS_URL OPENAI_REALTIME_VOICE ALLOWED_ORIGINS VPK_RUNTIME_ADMIN_TOKEN"
VPK_DEPLOY_GUIDE=".agents/skills/vpk-deploy/references/guide-deployment.md"
VPK_DEPLOY_MANUAL_GUIDE=".agents/skills/vpk-deploy/references/guide-manual-deployment.md"

# An explicit override is authoritative; do not silently switch identities.
vpk_resolve_atlas() {
  if [ -n "${VPK_ATLAS_BIN:-}" ]; then
    atlas_candidates=$VPK_ATLAS_BIN
  else
    atlas_candidates="$(command -v atlas 2>/dev/null || true)
/opt/atlassian/bin/atlas"
  fi
  while IFS= read -r atlas_candidate; do
    [ -n "$atlas_candidate" ] || continue
    if atlas_help=$("$atlas_candidate" micros --help 2>&1) \
        && printf '%s\n' "$atlas_help" | grep -qw service \
        && printf '%s\n' "$atlas_help" | grep -qw stash \
        && printf '%s\n' "$atlas_help" | grep -qw events; then
      VPK_ATLAS_BIN=$atlas_candidate
      export VPK_ATLAS_BIN
      return 0
    fi
  done <<EOF
$atlas_candidates
EOF
  echo "❌ Atlassian CLI with Micros service/stash/events support not found. Set VPK_ATLAS_BIN to the correct executable."
  return 1
}

# Additional SSM-backed variables are required only when declared in the descriptor.
vpk_base_required_stashes() {
  printf '%s\n' "$VPK_DEPLOY_REQUIRED_STASHES" | tr ' ' '\n'
}

vpk_required_stashes() {
  vpk_base_required_stashes
  grep -Eo '\(\(ssm:/[a-z0-9-]+/[A-Z][A-Z0-9_]*\)\)' "${1:-service-descriptor.yml}" \
    | sed -e 's#.*\/##' -e 's#))$##' || true
}

vpk_validate_service_name() {
  service_name=$1

  if [ -z "$service_name" ] || [ ${#service_name} -gt 26 ]; then
    echo "❌ Invalid service name '$service_name': use 1-26 lowercase letters, numbers, or hyphens"
    return 1
  fi

  case "$service_name" in
    *[!a-z0-9-]*|-*|*-)
      echo "❌ Invalid service name '$service_name': use lowercase letters, numbers, or interior hyphens"
      return 1
      ;;
  esac
}

vpk_validate_version() {
  deploy_version=$1

  if [ -z "$deploy_version" ] || [ ${#deploy_version} -gt 124 ]; then
    echo "❌ Invalid deployment version: use 1-124 Docker tag characters"
    return 1
  fi

  case "$deploy_version" in
    [A-Za-z0-9_]*) ;;
    *)
      echo "❌ Invalid deployment version '$deploy_version': it must start with a letter, number, or underscore"
      return 1
      ;;
  esac

  case "$deploy_version" in
    *[!A-Za-z0-9_.-]*)
      echo "❌ Invalid deployment version '$deploy_version': allowed characters are letters, numbers, underscore, period, and hyphen"
      return 1
      ;;
  esac
}

vpk_auto_version() {
  version_timestamp=$(date -u +%Y%m%d%H%M%S)
  printf '0.1.%s-p%s\n' "$version_timestamp" "$$"
}

vpk_validate_descriptor_identity() {
  descriptor_service=$1
  descriptor_path=${2:-service-descriptor.yml}

  if [ ! -f "$descriptor_path" ]; then
    echo "❌ Deployment descriptor is missing: $descriptor_path"
    return 1
  fi

  expected_image="docker.atl-paas.net/$descriptor_service"
  actual_image=$(awk '$1 == "image:" { print $2; exit }' "$descriptor_path")
  if [ "$actual_image" != "$expected_image" ]; then
    echo "❌ Deployment descriptor identity does not match '$descriptor_service': image is '${actual_image:-missing}', expected '$expected_image'"
    echo "   Repair $descriptor_path using $VPK_DEPLOY_GUIDE"
    return 1
  fi

  actual_tag=$(awk '$1 == "tag:" { print $2; exit }' "$descriptor_path")
	if [ "$actual_tag" != 'app-${VERSION}' ]; then
    echo "❌ Deployment descriptor identity does not match '$descriptor_service': tag must be app-\${VERSION}"
		return 1
	fi

	descriptor_ssm_services=$(grep -Eo '\(\(ssm:/[a-z0-9-]+/' "$descriptor_path" 2>/dev/null \
		| sed -e 's#((ssm:/##' -e 's#/$##' \
		| sort -u || true)
	while IFS= read -r mapped_service; do
		[ -n "$mapped_service" ] || continue
		if [ "$mapped_service" != "$descriptor_service" ]; then
			echo "❌ Deployment descriptor contains foreign SSM service prefix '$mapped_service'; expected only '$descriptor_service'"
			echo "   Repair $descriptor_path using $VPK_DEPLOY_GUIDE"
			return 1
		fi
	done <<EOF
$descriptor_ssm_services
EOF

	descriptor_missing=""
  while IFS= read -r stash_name; do
    [ -n "$stash_name" ] || continue
    expected_stash="((ssm:/$descriptor_service/$stash_name))"
    actual_stash=$(awk -v key="$stash_name:" '$1 == key { print $2; exit }' "$descriptor_path")
    if [ "$actual_stash" != "$expected_stash" ]; then
      descriptor_missing="$descriptor_missing $stash_name"
    fi
  done <<EOF
$(vpk_base_required_stashes)
EOF

  for origin_name in VPK_ORIGIN; do
    origin_mapping=$(awk -v key="$origin_name:" '$1 == key { print $2; exit }' "$descriptor_path")
    if [ -n "$origin_mapping" ] && [ "$origin_mapping" != "((ssm:/$descriptor_service/$origin_name))" ]; then
      descriptor_missing="$descriptor_missing $origin_name"
    fi
  done

  if [ -n "$descriptor_missing" ]; then
    echo "❌ Deployment descriptor identity does not match '$descriptor_service': incorrect or missing SSM mappings:$descriptor_missing"
    echo "   Every required mapping must use ((ssm:/$descriptor_service/<NAME>))."
    echo "   Repair $descriptor_path using $VPK_DEPLOY_GUIDE"
    return 1
  fi
}

vpk_stash_list_contains() {
  stash_output=$1
  stash_name=$2
  printf '%s\n' "$stash_output" | grep -Eq "(^|[[:space:]|])${stash_name}([[:space:]|]|$)"
}

vpk_require_service_and_stashes() {
  remote_service=$1
  remote_env=$2

  vpk_resolve_atlas || return 1
  if ! "$VPK_ATLAS_BIN" micros service show --service="$remote_service" --env="$remote_env" -o json >/dev/null 2>&1; then
    echo "❌ Micros service '$remote_service' does not exist or is not accessible in $remote_env"
    echo "   Inspect or create it using $VPK_DEPLOY_GUIDE before deploying."
    return 1
  fi

  if ! stashed_names=$("$VPK_ATLAS_BIN" micros stash list -s "$remote_service" -e "$remote_env" 2>/dev/null); then
    echo "❌ Could not list stashes for '$remote_service' in $remote_env"
    return 1
  fi

  missing_stashes=""
  while IFS= read -r stash_name; do
    [ -n "$stash_name" ] || continue
    if ! vpk_stash_list_contains "$stashed_names" "$stash_name"; then
      missing_stashes="$missing_stashes $stash_name"
    fi
  done <<EOF
$(vpk_required_stashes)
EOF

  if [ -n "$missing_stashes" ]; then
    echo "❌ Missing required stashes in $remote_env:$missing_stashes"
    echo "   Stashes are environment-specific. Provision them using $VPK_DEPLOY_GUIDE."
    return 1
  fi

  echo "✅ Service exists and all required stashes are present in $remote_env"
}

vpk_verify_export() {
  if [ -n "${1:-}" ]; then
    vpk_verify_receipt "$1" || return 1
    node .agents/skills/vpk-deploy/scripts/verify-initial-theme.mjs out/index.html --if-present
    return $?
  fi
  if [ ! -f out/index.html ]; then
    echo "❌ Static export did not produce out/index.html"
    return 1
  fi
  theme_verifier=".agents/skills/vpk-deploy/scripts/verify-initial-theme.mjs"
  if [ ! -f "$theme_verifier" ]; then
    echo "❌ Missing $theme_verifier; sync the deployment helpers from the intended VPK checkout"
    return 1
  fi
  node "$theme_verifier" out/index.html --if-present || return 1
  if [ ! -f scripts/prepare-static-export.mjs ]; then
    echo "❌ Missing scripts/prepare-static-export.mjs; refresh the extraction harness before packaging"
    return 1
  fi
  node scripts/prepare-static-export.mjs out --compress --report output/export-inventory.json
}

vpk_build_image() {
  image_service=$1
  image_version=$2
  image_registry=${3:-docker.atl-paas.net}
  npmrc_home=${HOME:-}
  local build_options=(--platform linux/amd64)
  if [ "${VPK_DOCKER_NO_CACHE:-0}" = "1" ]; then
    build_options+=(--pull --no-cache)
  fi

  if [ -n "$npmrc_home" ] && [ -f "$npmrc_home/.npmrc" ]; then
    docker buildx build "${build_options[@]}" \
      --secret "id=npmrc,src=$npmrc_home/.npmrc" \
      -t "$image_registry/${image_service}:app-${image_version}" \
      -f backend/Dockerfile . --load
  else
    docker buildx build "${build_options[@]}" \
      -t "$image_registry/${image_service}:app-${image_version}" \
      -f backend/Dockerfile . --load
  fi
}

# Select a transport deliberately; an EOF alone is not a reason to retry.
vpk_validate_push_via() {
  case "$1" in
    docker|crane) ;;
    *) echo "❌ Unsupported upload transport: use --push-via=docker or --push-via=crane"; return 2 ;;
  esac
}

vpk_require_push_tool() {
  vpk_validate_push_via "$1" || return $?
  if [ "$1" = docker ]; then return 0; fi
  VPK_CRANE_BIN=$(command -v "${VPK_CRANE_BIN:-crane}" 2>/dev/null) || {
    echo "❌ Host uploader crane not found; set VPK_CRANE_BIN to a trusted executable."
    echo "   See .agents/skills/vpk-deploy/references/troubleshooting.md#docker-daemon-network-failure-with-a-working-host-proxy"
    return 1
  }
  [ -x "$VPK_CRANE_BIN" ] || return 1
  export VPK_CRANE_BIN
}

# A subshell keeps archive cleanup from replacing the caller's traps.
vpk_push_image() (
  upload_service=$1
  upload_version=$2
  upload_registry=${3:-docker.atl-paas.net}
  upload_via=${4:-docker}
  vpk_validate_service_name "$upload_service" || exit $?
  vpk_validate_version "$upload_version" || exit $?
  vpk_require_push_tool "$upload_via" || exit $?
  upload_image="$upload_registry/$upload_service:app-$upload_version"
  if [ "$upload_via" = docker ]; then
    docker push --quiet "$upload_image"
    exit $?
  fi

  upload_dir=$(mktemp -d "${TMPDIR:-/tmp}/vpk-image-upload.XXXXXX") || exit 1
  trap 'rm -rf -- "$upload_dir"' EXIT
  trap 'exit 1' HUP INT TERM
  upload_archive="$upload_dir/image.tar"
  docker image save --platform linux/amd64 --output "$upload_archive" "$upload_image" || exit 1
  "$VPK_CRANE_BIN" push "$upload_archive" "$upload_image" || exit 1
  node - "$upload_archive" "$upload_image" "$VPK_CRANE_BIN" "$upload_version" <<'NODE'
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const [archive, reference, crane, version] = process.argv.slice(2);
const run = (binary, args) => execFileSync(binary, args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
try {
	const saved = JSON.parse(run("tar", ["-xOf", archive, "manifest.json"]));
	if (saved.length !== 1) throw new Error();
	const configPath = saved[0].Config;
	if (typeof configPath !== "string" || configPath.startsWith("/") || configPath.includes("\\") || configPath.split("/").some(part => !part || part === "..")) throw new Error();
	const configBytes = run("tar", ["-xOf", archive, configPath]);
	const config = JSON.parse(configBytes);
	const configDigest = `sha256:${createHash("sha256").update(configBytes).digest("hex")}`;
	const digest = run(crane, ["digest", reference]).trim();
	if (!/^sha256:[a-f0-9]{64}$/u.test(digest)) throw new Error();
	const immutableReference = `${reference.slice(0, reference.lastIndexOf(":"))}@${digest}`;
	const remote = JSON.parse(run(crane, ["manifest", immutableReference]));
	if (config.os !== "linux" || config.architecture !== "amd64" || remote.config?.digest !== configDigest || !Array.isArray(remote.layers) || remote.layers.length !== config.rootfs?.diff_ids?.length || run(crane, ["digest", reference]).trim() !== digest) throw new Error();
	const report = { reference, immutableReference, digest, configDigest, platform: "linux/amd64", transport: "crane" };
	fs.mkdirSync("output", { recursive: true });
	fs.writeFileSync(`output/image-upload-${version}.json`, JSON.stringify(report, null, 2) + "\n");
	console.log(JSON.stringify(report));
} catch {
	// Metadata or credential-helper output must never enter diagnostics.
	console.error("❌ Host upload verification failed: could not confirm saved linux/amd64 configuration and registry digest. Stop before Micros deployment.");
	process.exitCode = 1;
}
NODE
)

# Always pass a mode: Micros may otherwise inherit a previous hot-swap mode.
vpk_validate_deploy_mode() {
  case "$1" in
    cutover|hot-swap) ;;
    *) echo "❌ Unsupported deployment mode: use cutover or hot-swap"; return 2 ;;
  esac
}

vpk_verify_receipt() {
  node .agents/skills/vpk-deploy/scripts/release-receipt.mjs verify --target "$PWD" --receipt "$1"
}

# Sanitize remote status; never print descriptor environment/credential values.
vpk_deployment_status() {
  status_service=$1
  status_env=$2
  shift 2
  "$VPK_ATLAS_BIN" micros service show -s "$status_service" -e "$status_env" -o json \
    | node .agents/skills/vpk-deploy/scripts/deployment-status.mjs --env "$status_env" "$@"
}
