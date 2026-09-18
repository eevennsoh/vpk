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
  if [ ! -f out/index.html ]; then
    echo "❌ Static export did not produce out/index.html"
    return 1
  fi
  theme_verifier=".agents/skills/vpk-deploy/scripts/verify-initial-theme.mjs"
  if [ ! -f "$theme_verifier" ]; then
    echo "❌ Missing $theme_verifier; sync the deployment helpers from the intended VPK checkout"
    return 1
  fi
  node "$theme_verifier" out/index.html --if-present
}

vpk_build_image() {
  image_service=$1
  image_version=$2
  image_registry=${3:-docker.atl-paas.net}
  npmrc_home=${HOME:-}

  if [ -n "$npmrc_home" ] && [ -f "$npmrc_home/.npmrc" ]; then
    docker buildx build --platform linux/amd64 --no-cache \
      --secret "id=npmrc,src=$npmrc_home/.npmrc" \
      -t "$image_registry/${image_service}:app-${image_version}" \
      -f backend/Dockerfile . --load
  else
    docker buildx build --platform linux/amd64 --no-cache \
      -t "$image_registry/${image_service}:app-${image_version}" \
      -f backend/Dockerfile . --load
  fi
}
