#!/usr/bin/env bash
set -euo pipefail

STAGE="${SST_STAGE:?SST_STAGE is required (example: export SST_STAGE=da)}"
REGION="${AWS_REGION:-eu-west-1}"
PREFIX="${STAGE}trulyplatformStackdbSecre-"

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
