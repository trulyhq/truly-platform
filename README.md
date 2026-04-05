# Truly Platform

## Setup and Deployment Workflow

### Prerequisites

- Node.js v20+ and npm
- AWS CLI v2 with SSO configured (see [AWS SSO Setup](#aws-sso-setup) below)
- SST v2 (installed as a devDependency)

### AWS SSO Setup

We use AWS SSO across three accounts. Profiles are configured in `~/.aws/config`:

| Profile         | Account        | Description |
| --------------- | -------------- | ----------- |
| `truly_dev`     | `475309741762` | Development |
| `truly_staging` | `215310597349` | Staging     |
| `truly_prod`    | `562590526970` | Production  |

**Every terminal session** needs two env vars before running any AWS/SST command:

```bash
export SST_STAGE=da              # your stage name
export AWS_PROFILE=truly_dev     # matching AWS SSO profile
```

Then authenticate:

```bash
npm run aws:login
```

This runs `aws sso login --profile $AWS_PROFILE`. Both `SST_STAGE` and `AWS_PROFILE` must be set or the script will error.

### Custom Domains

Each account has its own Route 53 hosted zone. Domains are assigned automatically based on stage:

| Stage               | API                       | Web App                  | Landing               | Hosted Zone           |
| ------------------- | ------------------------- | ------------------------ | --------------------- | --------------------- |
| `da` (personal dev) | `api.da.dev.mytruly.app`  | `go.da.dev.mytruly.app`  | `da.dev.mytruly.app`  | `dev.mytruly.app`     |
| `staging`           | `api.staging.mytruly.app` | `go.staging.mytruly.app` | `staging.mytruly.app` | `staging.mytruly.app` |
| `release`           | `api.release.mytruly.app` | `go.release.mytruly.app` | `release.mytruly.app` | `release.mytruly.app` |
| `prod`              | `api.mytruly.app`         | `go.mytruly.app`         | `mytruly.app`         | `mytruly.app`         |
| `hotfix`            | `api.hotfix.mytruly.app`  | `go.hotfix.mytruly.app`  | `hotfix.mytruly.app`  | `hotfix.mytruly.app`  |

Any stage name not in `[staging, release, prod, hotfix]` is treated as a personal dev stage under `dev.mytruly.app`.

---

## 1) First-time setup for a new stage

A new stage creates all infrastructure from scratch: VPC, RDS, API Gateway, CloudFront, ACM certificates, and Route 53 records.

### Step 1: Set environment and login

```bash
export SST_STAGE=da
export AWS_PROFILE=truly_dev
npm run aws:login
```

### Step 2: Deploy infrastructure

This creates the VPC, RDS instance, API Gateway, NextjsSite distributions, custom domains, and the RDS-generated secret.

```bash
npm run deploy
```

> First deploy takes 15–30 minutes (VPC, NAT Gateway, RDS, ACM cert validation, CloudFront).

### Step 3: Set `DATABASE_URL` from the created RDS secret

```bash
npm run secrets:set-dburl
```

### Step 4: Redeploy so Lambda gets the bound secret

```bash
npm run deploy
```

> **Note:** `db:push` is **not required**. The backend Lambda auto-creates database tables on first request via `ensureAuthSchema()` in the tRPC context. The RDS instance is in an isolated VPC subnet and cannot be reached from your local machine.

### Step 5: Verify

```bash
curl https://api.${SST_STAGE}.dev.mytruly.app/health
# → {"ok":true}
```

---

## 2) Normal development deploy

```bash
export SST_STAGE=da
export AWS_PROFILE=truly_dev
npm run deploy
```

Or for live dev mode (hot-reloads Lambda on code changes):

```bash
export SST_STAGE=da
export AWS_PROFILE=truly_dev
npm run sst:dev
```

---

## 3) When Prisma schema changes

Since RDS is in an isolated subnet, `db:push` cannot run from your local machine. Schema changes are applied automatically by `ensureAuthSchema()` for the initial tables, but for ongoing schema evolution you have two options:

**Option A:** Update `ensureAuthSchema()` in `packages/trpc/src/context.ts` to include migrations as raw SQL (current approach).

**Option B:** If you add a bastion host or VPN to the VPC:

```bash
npm run -w @truly/database prisma:generate
DATABASE_URL="<connection-string>" npm run db:push
npm run deploy
```

---

## 4) Existing stage deploys

If the stage already exists and `DATABASE_URL` is already set:

```bash
export SST_STAGE=da
export AWS_PROFILE=truly_dev
npm run deploy
```

If DB credentials rotate, reset the secret and redeploy:

```bash
npm run secrets:set-dburl
npm run deploy
```

---

## 5) Get deployed URLs from AWS

```bash
aws cloudformation describe-stacks \
  --region eu-west-1 \
  --stack-name ${SST_STAGE}-truly-platform-Stack \
  --query "Stacks[0].Outputs" \
  --output table
```

Outputs include: `ApiEndpoint`, `WebUrl`, `LandingUrl`, `DatabaseEndpoint`, `DatabaseSecretArn`.

---

## 6) API URL wiring (web + mobile)

### Web (`apps/web`)

- `NEXT_PUBLIC_API_URL` is injected by SST during deploy (uses custom domain URL).
- Do not hardcode API URLs in web code.

### Landing (`apps/landing`)

- `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_API_URL` are injected by SST during deploy.

### Mobile (`apps/mobile`)

Mobile uses `EXPO_PUBLIC_API_URL`.

- Local dev against a deployed API:

```bash
cd apps/mobile
EXPO_PUBLIC_API_URL=https://api.da.dev.mytruly.app npm run dev
```

- EAS preview/production builds: set `EXPO_PUBLIC_API_URL` in EAS env per channel.
- Keep stage mapping explicit (`da`/`staging`/`prod`) so builds target the correct backend.

---

## 7) Stage runbook

### Personal dev (`da`)

```bash
export SST_STAGE=da
export AWS_PROFILE=truly_dev
npm run aws:login
npm run deploy

# Mobile dev:
cd apps/mobile
EXPO_PUBLIC_API_URL=https://api.da.dev.mytruly.app npm run dev
```

### Promote to `staging`

```bash
export SST_STAGE=staging
export AWS_PROFILE=truly_staging
npm run aws:login
npm run deploy
npm run secrets:set-dburl    # first time only
npm run deploy               # redeploy with secret bound
```

### Promote to `release`

```bash
export SST_STAGE=release
export AWS_PROFILE=truly_staging
npm run aws:login
npm run deploy
npm run secrets:set-dburl    # first time only
npm run deploy               # redeploy with secret bound
```

### Promote to `prod`

```bash
export SST_STAGE=prod
export AWS_PROFILE=truly_prod
npm run aws:login
npm run deploy
npm run secrets:set-dburl    # first time only
npm run deploy               # redeploy with secret bound
```

---

## Scripts Reference

| Script                      | Description                                        |
| --------------------------- | -------------------------------------------------- |
| `npm run aws:login`         | SSO login (requires `SST_STAGE` + `AWS_PROFILE`)   |
| `npm run deploy`            | `sst deploy` to the current stage                  |
| `npm run sst:dev`           | SST live dev mode                                  |
| `npm run secrets:set-dburl` | Extract RDS secret → set SST `DATABASE_URL` secret |
| `npm run db:push`           | Prisma db push (needs direct DB access)            |
| `npm run build`             | Turborepo build all packages                       |
| `npm run dev:web`           | Next.js dev server for web app (port 3000)         |
| `npm run dev:landing`       | Next.js dev server for landing page (port 3100)    |
| `npm run dev:mobile`        | Expo dev server for mobile app                     |

---

## Notes

- `secrets:set-dburl` requires the RDS secret to already exist — run **after first deploy**.
- `secrets:set-dburl` is needed **once per stage** (or after DB credential rotation), not every deploy.
- `prisma:generate` is needed when Prisma schema or Prisma version changes.
- RDS is in an **isolated VPC subnet** — no public access. Use `ensureAuthSchema()` or a bastion for direct DB operations.
- The `.env` file at the project root should **not** contain static AWS keys. Use SSO profiles instead.
- Expo SDK 54 toolchain expects Node `>=20.19.4`; Node `20.18.x` may show `EBADENGINE` warnings.
