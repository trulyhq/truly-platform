#!/usr/bin/env bash
set -euo pipefail

# ─── Require both SST_STAGE and AWS_PROFILE ───────────────────────────────────
MISSING=()
[[ -z "${SST_STAGE:-}" ]] && MISSING+=("SST_STAGE")
[[ -z "${AWS_PROFILE:-}" ]] && MISSING+=("AWS_PROFILE")

if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo "❌ Missing required env vars: ${MISSING[*]}" >&2
  echo "" >&2
  echo "Set both before running:" >&2
  echo "" >&2
  echo "  export SST_STAGE=da                # your stage name" >&2
  echo "  export AWS_PROFILE=truly_dev       # AWS SSO profile" >&2
  echo "" >&2
  echo "Profiles:" >&2
  echo "  truly_dev      → Dev account (475309741762)" >&2
  echo "  truly_staging  → Staging account (215310597349)" >&2
  echo "  truly_prod     → Prod account (562590526970)" >&2
  echo "" >&2
  echo "Then run: npm run aws:login" >&2
  exit 1
fi

echo "🔐 Stage:   $SST_STAGE"
echo "☁️  Profile: $AWS_PROFILE"
echo ""

# ─── SSO Login ────────────────────────────────────────────────────────────────
aws sso login --profile "$AWS_PROFILE"

echo ""
echo "✅ Logged in. Your shell is now configured:"
echo ""
echo "  export SST_STAGE=$SST_STAGE"
echo "  export AWS_PROFILE=$AWS_PROFILE"
echo ""
echo "Run deploys with:"
echo "  npx sst deploy --stage \$SST_STAGE"
echo "  # or: npm run dev:deploy"
