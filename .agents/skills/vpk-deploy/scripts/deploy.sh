#!/bin/bash
set -euo pipefail

# Deploy script for non-technical users

DEPLOY_LIB=".agents/skills/vpk-deploy/scripts/deploy-lib.sh"
DEPLOY_GUIDE=".agents/skills/vpk-deploy/references/guide-deployment.md"
if [ ! -f "$DEPLOY_LIB" ]; then
  echo "❌ Missing deployment helper: $DEPLOY_LIB"
  exit 1
fi
# shellcheck disable=SC1090
source "$DEPLOY_LIB"

echo "🚀 Prototype Deployment Helper"
echo ""

# Check if service name provided.
# Using ${1:-} (not $1) so `set -u` doesn't abort before we can print the
# usage help when the user runs the script with no arguments.
if [ -z "${1:-}" ]; then
  echo "❌ Service name is required"
  echo "Usage: $0 <service-name> <version> [env] [--mode=cutover|hot-swap] [--receipt path] [--push-via=docker|crane]"
  echo "Example: $0 my-prototype 1.0.1 pdev-west2"
  echo ""
  echo "⚠️  Service name must be ≤26 characters"
  exit 1
fi

if [ -z "${2:-}" ]; then
  echo "❌ Deployment version is required"
  echo "Usage: $0 <service-name> <version> [env] [--mode=cutover|hot-swap] [--receipt path] [--push-via=docker|crane]"
  exit 1
fi

SERVICE_NAME=$1
VERSION=$2
REQUESTED_SERVICE_NAME=$SERVICE_NAME
REQUESTED_VERSION=$VERSION
shift 2
REQUESTED_MODE=""
REQUESTED_PUSH_VIA=""
RECEIPT_FILE=""
REQUESTED_ENV=""
while [ "$#" -gt 0 ]; do
  deploy_arg=$1
  shift
  case "$deploy_arg" in
    --push-via=*)
      if [ -n "$REQUESTED_PUSH_VIA" ]; then echo "❌ Duplicate upload transport"; exit 2; fi
      REQUESTED_PUSH_VIA=${deploy_arg#--push-via=}
      vpk_validate_push_via "$REQUESTED_PUSH_VIA" ;;
    --hot-swap|--mode=*)
      if [ -n "$REQUESTED_MODE" ]; then echo "❌ Duplicate or conflicting deployment modes"; exit 2; fi
      if [ "$deploy_arg" = "--hot-swap" ]; then REQUESTED_MODE=hot-swap; else REQUESTED_MODE=${deploy_arg#--mode=}; fi
      vpk_validate_deploy_mode "$REQUESTED_MODE" ;;
    --receipt)
      if [ -n "$RECEIPT_FILE" ] || [ -z "${1:-}" ] || [[ "$1" == --* ]]; then echo "❌ A single receipt path is required"; exit 2; fi
      RECEIPT_FILE=$1
      shift ;;
    --*) echo "❌ Unexpected argument: $deploy_arg"; exit 2 ;;
    *)
      if [ -n "$REQUESTED_ENV" ]; then echo "❌ Only one environment is supported"; exit 2; fi
      REQUESTED_ENV=$deploy_arg ;;
  esac
done

# ENV: explicit argument, local configuration, then pdev-west2.
# Load mode configuration even when ENV is supplied explicitly.
if [ -f ".deploy.local" ]; then
  source .deploy.local
  SERVICE_NAME=$REQUESTED_SERVICE_NAME
  VERSION=$REQUESTED_VERSION
  ENV=${ENV:-pdev-west2}
else
  ENV=pdev-west2
fi
if [ -n "$REQUESTED_ENV" ]; then ENV=$REQUESTED_ENV; fi

# Validate environment is one of the two pdev envs
case "$ENV" in
  pdev-west2|pdev-apse2) ;;
  *)
    echo "❌ Unsupported Micros environment: $ENV"
    echo "   Supported environments: pdev-west2, pdev-apse2"
    exit 1
    ;;
esac

vpk_validate_service_name "$SERVICE_NAME"
vpk_validate_version "$VERSION"
DEPLOY_MODE=${REQUESTED_MODE:-${VPK_DEPLOY_MODE:-cutover}}
vpk_validate_deploy_mode "$DEPLOY_MODE"
PUSH_VIA=${REQUESTED_PUSH_VIA:-${VPK_PUSH_VIA:-docker}}
vpk_require_push_tool "$PUSH_VIA"
if [ -n "$RECEIPT_FILE" ]; then vpk_verify_receipt "$RECEIPT_FILE"; fi
echo "Deployment mode: $DEPLOY_MODE"

echo "Service: $SERVICE_NAME"
echo "Version: $VERSION"
echo "Environment: $ENV"
echo ""

bash .agents/skills/vpk-deploy/scripts/deploy-check.sh

# Validate every local and remote identity before Docker build, push, or Micros
# deployment. `service show` success is sufficient: a newly created service can
# legitimately have no stack until this first deployment.
vpk_validate_descriptor_identity "$SERVICE_NAME" service-descriptor.yml
if ! vpk_require_service_and_stashes "$SERVICE_NAME" "$ENV"; then
  echo "   See $DEPLOY_GUIDE"
  exit 1
fi

# Build the static export consumed by backend/Dockerfile.
echo ""
echo "🏗️  Building static export..."
if [ -z "$RECEIPT_FILE" ]; then corepack pnpm run build:export; fi
vpk_verify_export "$RECEIPT_FILE"

# Build Docker image
echo ""
echo "📦 Building Docker image..."
if ! vpk_build_image "$SERVICE_NAME" "$VERSION"; then
  echo "❌ Build failed. Contact repo maintainer."
  exit 1
fi

# Push image
echo ""
echo "📤 Pushing Docker image..."
if ! vpk_push_image "$SERVICE_NAME" "$VERSION" docker.atl-paas.net "$PUSH_VIA"; then
  echo "❌ Image upload failed; diagnose the registry boundary before retrying."
  echo "   See .agents/skills/vpk-deploy/references/troubleshooting.md"
  exit 1
fi

# Deploy
echo ""
echo "🚀 Deploying..."
export VERSION=$VERSION
set -- "--mode=$DEPLOY_MODE"
"$VPK_ATLAS_BIN" micros service deploy \
  --service=$SERVICE_NAME \
  --env=$ENV \
  --file=service-descriptor.yml "$@"

echo ""
echo "✅ Deployment initiated!"
echo ""
# Region hint based on $ENV. Both pdev envs follow the same DNS pattern:
#   https://<service>.<aws-region>.platdev.atl-paas.net
case "$ENV" in
  pdev-west2)  REGION="us-west-2" ;;
  pdev-apse2)  REGION="ap-southeast-2" ;;
esac
echo "Your service URL will be (internal — needs Atlassian VPN):"
echo "  https://$SERVICE_NAME.$REGION.platdev.atl-paas.net"
echo ""
echo "Note: Micros API may show CREATE_IN_PROGRESS for 1–3 min after CFN finishes."
echo "Follow the returned deployment ID to a final state, then verify the exact route:"
echo "  $VPK_ATLAS_BIN micros events -s $SERVICE_NAME -e $ENV -d <deployment-id>"
echo "  $VPK_ATLAS_BIN micros service show -s $SERVICE_NAME -e $ENV"
echo "For hot swap, confirm the expected version and UPDATE_COMPLETE; events may show the original creation."
echo "  node .agents/skills/vpk-deploy/scripts/verify-runtime.mjs https://$SERVICE_NAME.$REGION.platdev.atl-paas.net /"
