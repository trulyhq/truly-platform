# Truly Platform

## Setup and Deployment Workflow

### Prerequisites

- Node.js + npm
- AWS CLI configured for the target account/region
- SST CLI available via `npx sst ...`

---

## 1) First-time setup for a new stage (`da`, `prod`, etc.)

Set stage:

```bash
export SST_STAGE=da
```

### Step 1: Deploy infrastructure first

This creates the VPC, RDS instance, and the RDS-generated secret.

```bash
npm run dev:deploy
```

### Step 2: Set app `DATABASE_URL` from the created RDS secret

```bash
npm run secrets:set-dburl
```

### Step 3: Redeploy so Lambda gets the bound secret

```bash
npm run dev:deploy
```

### Step 4: Apply database schema

```bash
npm run -w @truly/database db:push
```

---

## 2) Normal development deploy (no Prisma schema change)

```bash
SST_STAGE=da npm run dev:deploy
```

---

## 3) When Prisma schema changes

```bash
npm run -w @truly/database prisma:generate
SST_STAGE=da npm run -w @truly/database db:push
SST_STAGE=da npm run dev:deploy
```

---

## 4) Existing stage deploys (`prod`, etc.)

If the stage already exists and `DATABASE_URL` is already set:

```bash
SST_STAGE=prod npm run dev:deploy
```

If DB credentials rotate, reset secret once and redeploy:

```bash
SST_STAGE=prod npm run secrets:set-dburl
SST_STAGE=prod npm run dev:deploy
```

---

## 5) Get deployed web URL from AWS

Use CloudFormation outputs to fetch the current `WebUrl` for a stage stack:

```bash
cd /Users/i/Documents/truly-platform
aws cloudformation describe-stacks \
	--region eu-west-1 \
	--stack-name da-truly-platform-Stack \
	--query "Stacks[0].Outputs[?OutputKey=='WebUrl'].OutputValue | [0]" \
	--output text
```

---

## 6) API URL wiring (web + mobile)

### Web (`apps/web`)

- `NEXT_PUBLIC_API_URL` is injected by SST during web deploy.
- Do not hardcode API URLs in web code.
- To validate the value in a deployed environment, redeploy and read the `WebUrl` output.

Deploy web + backend for a stage:

```bash
SST_STAGE=da npm run sst:deploy
```

### Mobile (`apps/mobile`)

Mobile uses `EXPO_PUBLIC_API_URL`.

- Local/dev against deployed API:

```bash
cd /Users/i/Documents/truly-platform/apps/mobile
EXPO_PUBLIC_API_URL=https://d7xox33u8g.execute-api.eu-west-1.amazonaws.com npm run dev
```

- EAS preview/production builds: set `EXPO_PUBLIC_API_URL` in EAS env per channel.
- Keep stage mapping explicit (`da`/`staging`/`prod`) so builds target the correct backend.

---

## 7) Stage runbook (`da` → `staging` → `prod`)

### Local testing against `da`

```bash
export SST_STAGE=da
npm run dev:deploy
npm run -w @truly/database db:push
cd /Users/i/Documents/truly-platform/apps/mobile
EXPO_PUBLIC_API_URL=https://d7xox33u8g.execute-api.eu-west-1.amazonaws.com npm run dev
```

### Promote to `staging`

```bash
export SST_STAGE=staging
npm run sst:deploy
npm run secrets:set-dburl
npm run sst:deploy
npm run -w @truly/database db:push
```

### Promote to `prod`

```bash
export SST_STAGE=prod
npm run sst:deploy
npm run secrets:set-dburl
npm run sst:deploy
npm run -w @truly/database db:push
```

---

## Notes

- `secrets:set-dburl` requires the RDS secret to already exist, so it must run **after first infra deploy**.
- `secrets:set-dburl` is needed **once per stage** (or after DB credential rotation), not every deploy.
- `prisma:generate` is needed when Prisma schema or Prisma version changes.
- Expo SDK 54 toolchain expects Node `>=20.19.4`; Node `20.18.x` may show `EBADENGINE` warnings.
