#!/usr/bin/env bash
set -euo pipefail

# ─── Require SST_STAGE; AWS_PROFILE is optional in CI (OIDC provides creds) ──
if [[ -z "${SST_STAGE:-}" ]]; then
  echo "❌ Missing required env var: SST_STAGE" >&2
  echo "" >&2
  echo "Usage:" >&2
  echo "  export SST_STAGE=da                # your stage name" >&2
  echo "  export AWS_PROFILE=truly_dev       # AWS SSO profile (local only)" >&2
  echo "" >&2
  echo "Profiles (local dev):" >&2
  echo "  truly_dev      → Dev account (475309741762)" >&2
  echo "  truly_staging  → Staging account (215310597349)" >&2
  echo "  truly_prod     → Prod account (562590526970)" >&2
  exit 1
fi

STAGE="$SST_STAGE"
REGION="${AWS_REGION:-eu-west-1}"
# CloudFormation truncates logical IDs, so the secret name prefix varies.
# Use a broader pattern: <stage>trulyplatformStackdb
PREFIX="${STAGE}trulyplatformStackdb"

echo "🔐 Stage:   $STAGE"
echo "☁️  Profile: ${AWS_PROFILE:-<CI/OIDC>}"
echo "🌍 Region:  $REGION"
echo ""

LIST_JSON="$(aws secretsmanager list-secrets --region "$REGION" --output json)"

SECRET_ID="$(
  node -e '
    const d = JSON.parse(process.argv[1]);
    const prefix = process.argv[2];
    const matches = (d.SecretList || [])
      .filter(s => s?.Name && s.Name.startsWith(prefix))
      .sort((a, b) => new Date(a.CreatedDate) - new Date(b.CreatedDate));
    if (!matches.length) process.exit(2);
    process.stdout.write(matches[matches.length - 1].Name);
  ' "$LIST_JSON" "$PREFIX"
)" || {
  echo "No DB secret found for stage: $STAGE (prefix: $PREFIX)" >&2
  exit 1
}

RDS_JSON="$(aws secretsmanager get-secret-value \
  --secret-id "$SECRET_ID" \
  --region "$REGION" \
  --query SecretString \
  --output text)"

DB_URL="$(
  node -e '
    const s = JSON.parse(process.argv[1]);
    const user = encodeURIComponent(s.username);
    const pass = encodeURIComponent(s.password);
    process.stdout.write(`postgresql://${user}:${pass}@${s.host}:${s.port}/${s.dbname}`);
  ' "$RDS_JSON"
)"

echo "Setting DATABASE_URL for stage=$STAGE region=$REGION using secret=$SECRET_ID"
npx sst secrets set DATABASE_URL "$DB_URL" --stage "$STAGE"
echo "Done."
