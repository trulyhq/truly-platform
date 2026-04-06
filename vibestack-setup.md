# VibeStack: The AI-Native Enterprise Boilerplate

**VibeStack** is a product vision designed to solve the "Vibe Coding" trap. It bridges the gap between AI-generated logic and production-grade engineering. Instead of just generating code, VibeStack provides the **skeleton**—infrastructure, security, and architecture—so that AI tools (Cursor, Claude, Windsurf) can safely fill in the **flesh**.

---

## 1. The Core Value Proposition

- **The Problem**: Founders and "vibe coders" use AI to build apps, resulting in unmaintainable spaghetti code, security vulnerabilities, massive AWS bills, and zero scalability. They skip the "boring" engineering work (Auth, CI/CD, IaC, Type Safety).
- **The Solution**: An opinionated, battle-tested "Engine" delivered via a CLI + local setup UI. It sets up a scalable Monorepo, fully configured Infrastructure as Code, Multi-Account AWS, SSO, DNS, and Type-Safe boundaries.
- **The "AI Container"**: The architecture explicitly separates "Core Infrastructure" (locked) from "Feature Logic" (AI playground). This ensures that even if an AI writes bad logic, it cannot break the build pipeline or expose the database.

---

## 2. The Stack ("The Engine")

This is the exact stack we are building for `truly-platform`, productized for general use.

| Layer        | Technology                 | Role                                                                            |
| :----------- | :------------------------- | :------------------------------------------------------------------------------ |
| **Repo**     | Turborepo + npm Workspaces | The rigid backbone that enforces type safety between apps.                      |
| **Infra**    | SST (Serverless Stack)     | Infrastructure as Code (TypeScript). Manages AWS (Lambda, API Gateway, S3).     |
| **Database** | PostgreSQL (RDS)           | The source of truth. Structured data (Users, Auth) + JSONB (Flexible App Data). |
| **API**      | tRPC                       | End-to-end type safety. No GraphQL schemas, no REST docs. Just functions.       |
| **Auth**     | Manual / Oslo              | Vendor-agnostic authentication. Zero lock-in. Full control over sessions.       |
| **UI**       | NativeWind (Tailwind)      | Universal styling for Web and Mobile.                                           |
| **Clients**  | Next.js + Expo             | One codebase logic serving Web (SSR) and Mobile (Native).                       |
| **Accounts** | AWS Organizations          | Multi-account isolation: Dev, Staging, Prod — created via CLI.                  |
| **Identity** | AWS Identity Center (SSO)  | Zero static keys. SSO login per developer, per account.                         |
| **DNS**      | Route 53 + Custom Domains  | Hosted zones per environment, auto-delegated. Stage-aware subdomains.           |

---

## 3. The Delivery Mechanism: Local Setup UI

Instead of the traditional "Clone Repo → Read README → Struggle with Env Vars" flow, VibeStack is delivered via a **local browser-based setup wizard**.

**Command:**

```bash
npx create-vibe-stack@latest
```

This scaffolds the repo and launches a setup UI at `http://localhost:3456`.

### Why a Local UI Instead of Terminal Prompts?

1. **Multi-step workflows are visual** — AWS account creation, DNS delegation, secret entry are hard to follow in a terminal
2. **Progress tracking** — each stage shows status (✅ done, 🔄 in progress, ⏳ pending)
3. **Validation** — form inputs validate before submission (email format, key prefixes, domain availability)
4. **Resumable** — state saved to `.vibestack/config.json`, pick up where you left off
5. **Copy-paste friendly** — DNS NS records, SSO URLs, etc. displayed with one-click copy

### The Setup Stages

The UI walks through 7 stages. Each stage is independent — skip what you've already done.

---

#### Stage 1: Identity & Branding

| Field          | Example         | What It Does                                         |
| :------------- | :-------------- | :--------------------------------------------------- |
| Project name   | `my-startup`    | Renames all `package.json` names, SST app name       |
| Package prefix | `@mst`          | Scoped npm workspace prefix (`@mst/ui`, `@mst/trpc`) |
| Domain name    | `mystartup.app` | Used for Route 53, custom domains, email             |

_Action_: Renames all package.json files, updates `sst.config.ts` app name, writes `.vibestack/config.json`.

---

#### Stage 2: AWS Organization & Accounts

This is the **killer feature**. Everything is done via AWS SDK — no console clicking.

| Step | CLI/SDK Call                                       | What Happens                                            |
| :--- | :------------------------------------------------- | :------------------------------------------------------ |
| 1    | `organizations.createOrganization()`               | Current AWS account becomes the management/prod account |
| 2    | `organizations.createAccount({ name: "Dev" })`     | Creates a new Dev account (async, ~60s)                 |
| 3    | `organizations.createAccount({ name: "Staging" })` | Creates a new Staging account                           |
| 4    | Poll `describeCreateAccountStatus()`               | Wait for accounts to be ready                           |

**User inputs:**

- Email for dev account (e.g. `dev@mystartup.app`)
- Email for staging account (e.g. `staging@mystartup.app`)
- AWS region (default: `eu-west-1`)

**UI shows:** Real-time status of account creation with account IDs populated as they're created.

**Proven:** We created 3 accounts (Dev `475309741762`, Staging `215310597349`, Prod `562590526970`) for Truly using this exact pattern.

---

#### Stage 3: AWS Identity Center (SSO)

All via `sso-admin` and `identitystore` SDK calls:

| Step | SDK Call                                | What Happens                              |
| :--- | :-------------------------------------- | :---------------------------------------- |
| 1    | `sso-admin.createInstance()`            | Enable Identity Center on the org         |
| 2    | `identitystore.createUser()`            | Create each team member                   |
| 3    | `identitystore.createGroup()`           | Create groups (Admins, Developers)        |
| 4    | `identitystore.createGroupMembership()` | Add users to groups                       |
| 5    | `sso-admin.createPermissionSet()`       | Create AdministratorAccess permission set |
| 6    | `sso-admin.createAccountAssignment()`   | Assign group + permission to each account |

**User inputs:**

- Team members (name + email for each)
- Which group each belongs to

**Auto-generated outputs:**

- `~/.aws/config` SSO profiles (one per account)
- SSO start URL (e.g. `https://mystartup.awsapps.com/start/`)
- Login script (`scripts/aws-login.sh`) with dual-guard for `SST_STAGE` + `AWS_PROFILE`

**Proven:** We set up SSO for Truly with 3 profiles (`truly_dev`, `truly_staging`, `truly_prod`), each mapping to an account. Zero static IAM keys. `aws sso login --profile truly_dev` just works.

---

#### Stage 4: Environments & DNS

**User inputs:**

- How many environments? (default: 3 — dev, staging, prod)
- Custom environment names? (e.g. add `release`, `hotfix`)
- Support personal dev stages? (default: yes — any unknown stage name becomes a personal dev stage)

**Actions (all via Route 53 SDK):**

| Step | SDK Call                                                      | What Happens                                                         |
| :--- | :------------------------------------------------------------ | :------------------------------------------------------------------- |
| 1    | `route53.createHostedZone({ name: "mystartup.app" })`         | Root zone in prod account                                            |
| 2    | `route53.createHostedZone({ name: "dev.mystartup.app" })`     | Dev zone in dev account                                              |
| 3    | `route53.createHostedZone({ name: "staging.mystartup.app" })` | Staging zone in staging account                                      |
| 4    | Auto-create NS delegation records in root zone                | Point `dev.` → dev account's NS servers                              |
| 5    | Display registrar NS records                                  | "Set these nameservers at your registrar (Namecheap, GoDaddy, etc.)" |

**Custom domain pattern per stage:**

| Stage           | API                         | Web App                    | Landing                 |
| :-------------- | :-------------------------- | :------------------------- | :---------------------- |
| `da` (personal) | `api.da.dev.mystartup.app`  | `go.da.dev.mystartup.app`  | `da.dev.mystartup.app`  |
| `staging`       | `api.staging.mystartup.app` | `go.staging.mystartup.app` | `staging.mystartup.app` |
| `prod`          | `api.mystartup.app`         | `go.mystartup.app`         | `mystartup.app`         |

**Proven:** We created 5 hosted zones across 3 accounts for Truly, set NS delegation records, pointed Namecheap nameservers to Route 53, and verified resolution — all via `aws route53` CLI.

---

#### Stage 5: Feature Toggles (Plugins)

| Feature            | Provider Options            | What It Provisions                                                 |
| :----------------- | :-------------------------- | :----------------------------------------------------------------- |
| Payments           | Stripe / Paystack           | `packages/payments` adapter, webhook handler, SST secret per stage |
| Email              | AWS SES / Resend / SendGrid | `packages/mailer` adapter, IAM roles if SES                        |
| SMS                | Twilio / AWS SNS            | `packages/sms` adapter                                             |
| Storage            | AWS S3                      | S3 bucket in SST config, presigned URL helpers                     |
| Background Jobs    | SQS + Lambda                | Queue + worker in SST, sample `worker.ts`                          |
| Push Notifications | Expo Push / FCM             | `packages/push` adapter                                            |

Each toggle adds the package to the monorepo, wires it into `sst.config.ts`, and queues secret collection for Stage 6.

---

#### Stage 6: Secrets & API Keys

The UI presents a form for all secrets needed based on selected features:

| Secret                | Example       | Per-Stage?                                |
| :-------------------- | :------------ | :---------------------------------------- |
| Stripe Secret Key     | `sk_test_...` | Yes (test key for dev, live key for prod) |
| Stripe Webhook Secret | `whsec_...`   | Yes                                       |
| Resend API Key        | `re_...`      | No (same key all stages)                  |
| Twilio Auth Token     | `...`         | Yes                                       |
| Custom secrets        | User-defined  | User chooses                              |

**How secrets are stored:**

- NOT in `.env` files (no static credentials in the repo)
- Set via `npx sst secrets set KEY value --stage <stage>` — encrypted in AWS SSM Parameter Store
- Auto-extracted secrets (like DATABASE_URL from RDS) are handled by `scripts/set-dburl.sh` — zero manual entry

**Proven:** We built `set-dburl.sh` that auto-extracts RDS credentials from AWS Secrets Manager and sets them as SST secrets. The Lambda reads them at runtime. No `.env` files, no static keys.

---

#### Stage 7: Deploy & Verify

The UI triggers deploys in sequence and shows real-time progress:

```
┌─────────────────────────────────────────────┐
│  🚀 Deploying: dev stage                    │
│                                             │
│  ✅ VPC + Subnets            (45s)          │
│  ✅ RDS PostgreSQL           (8m 12s)       │
│  ✅ API Gateway + Lambda     (32s)          │
│  ✅ ACM Certificate          (2m 5s)        │
│  ✅ CloudFront (web)         (4m 30s)       │
│  ✅ CloudFront (landing)     (4m 28s)       │
│  ✅ Route 53 records         (12s)          │
│  ✅ Set DATABASE_URL secret  (3s)           │
│  🔄 Redeploy with secrets   (in progress)  │
│                                             │
│  Endpoints:                                 │
│  API:     https://api.dev.mystartup.app     │
│  Web:     https://go.dev.mystartup.app      │
│  Landing: https://dev.mystartup.app         │
│                                             │
│  Health:  ✅ {"ok": true}                   │
│  Signup:  ✅ User created + tokens returned │
└─────────────────────────────────────────────┘
```

**The deploy flow per stage:**

1. `npm run deploy` — creates all infra + deploys code
2. `npm run secrets:set-dburl` — auto-extracts RDS secret, sets DATABASE_URL
3. `npm run deploy` — redeploy so Lambda picks up the secret
4. Health check — `curl https://api.<stage>.<domain>/health`
5. Smoke test — signup mutation to verify DB connectivity + auth

**Proven:** We deployed `da` and `da2` personal dev stages to `475309741762`. Both times: deploy → set-dburl → redeploy → health ✅ → signup ✅. Total time ~15 minutes per stage (first deploy), ~3 minutes for redeployments.

---

## 4. The "AI Container" Architecture

VibeStack configures the codebase to guide AI Agents (Cursor/Windsurf) to success.

### The Directory Structure

```text
my-startup/
├── .cursorrules           # <-- Crucial: Instructions for the AI
├── .vibestack/
│   └── config.json        # <-- Setup wizard state (accounts, domains, features)
├── scripts/
│   ├── aws-login.sh       # <-- SSO login with SST_STAGE + AWS_PROFILE guards
│   └── set-dburl.sh       # <-- Auto-extract RDS secret → SST secret
├── apps/
│   ├── web/               # <-- Next.js web app (go.*.domain)
│   │   └── app/
│   │       └── features/  # <-- THE PLAYGROUND. AI writes code here.
│   ├── landing/           # <-- Next.js marketing site (*.domain)
│   └── mobile/            # <-- Expo React Native app
├── packages/
│   ├── auth/              # <-- LOCKED. Pre-built session management.
│   ├── database/          # <-- LOCKED. Prisma client + schema.
│   ├── trpc/              # <-- LOCKED. The router backbone + context.
│   ├── validators/        # <-- LOCKED. Zod schemas shared across apps.
│   ├── ui/                # <-- LOCKED. Shared UI components (NativeWind).
│   └── payments/          # <-- Plugin. Added if Stripe/Paystack selected.
└── sst.config.ts          # <-- LOCKED. Stage-aware infra config.
```

### The `.cursorrules` Instruction

The template includes a pre-written prompt file for the AI:

> "You are building on VibeStack.
>
> 1. NEVER modify `packages/auth`. Import `ctx.session` instead.
> 2. To add a database model, edit `schema.prisma` and run `npm run db:push`.
> 3. To add an API endpoint, create a file in `packages/trpc/routers`.
> 4. Styling must use Tailwind classes.
> 5. NEVER modify `sst.config.ts`, `scripts/`, or `.vibestack/`.
> 6. NEVER create `.env` files with secrets. Use `npm run secrets:set-dburl`."

### Protecting the Rules

To prevent the AI from overwriting its own instructions, VibeStack employs a multi-layered defense:

1.  **Ignore File (`.cursorignore`)**: The CLI generates a file that explicitly tells the AI tool to ignore core files like `.cursorrules`, `packages/auth`, `scripts/`, and `sst.config.ts`. The AI cannot edit a file it is instructed to never read.
2.  **File Permissions**: The CLI sets critical files like `.cursorrules` to be read-only (`chmod 444`) at the file-system level, providing a hard lock against accidental writes.
3.  **Git Pre-Commit Hook**: A pre-commit hook is included to verify that core rule files have not been modified, preventing a compromised ruleset from ever being committed to the repository.

---

## 5. What We Proved Building Truly

Every claim in this doc is backed by working code in `truly-platform`:

| Capability                       | Proof                                                         | Files                           |
| :------------------------------- | :------------------------------------------------------------ | :------------------------------ |
| Multi-account AWS via CLI        | 3 accounts created, SSO configured                            | `scripts/aws-login.sh`          |
| Route 53 hosted zones via CLI    | 5 zones across 3 accounts, NS delegation working              | `sst.config.ts` (domain logic)  |
| Stage-aware custom domains       | `api.da.dev.mytruly.app`, `go.da.dev.mytruly.app` all resolve | `sst.config.ts`                 |
| Auto DATABASE_URL extraction     | Script finds RDS secret, constructs URL, sets SST secret      | `scripts/set-dburl.sh`          |
| Schema bootstrap without bastion | `ensureAuthSchema()` creates tables on first Lambda call      | `packages/trpc/src/context.ts`  |
| Personal dev stages              | Any dev can `SST_STAGE=<name>` and get isolated infra         | `sst.config.ts` (isPersonalDev) |
| Zero static AWS keys             | SSO-only auth, `.env` with IAM keys removed                   | `~/.aws/config` profiles        |
| Full deploy → verify in one flow | deploy → set-dburl → redeploy → health ✅ → signup ✅         | `README.md`                     |

---

## 6. Roadmap: From `truly-platform` to VibeStack

1.  **Build Phase** (current): Execute the `truly-platform` plan. This builds the "Engine."
2.  **Pain Audit**: Document every manual step we hated during the Truly build. Automate it in the setup UI.
    - ✅ AWS account creation → SDK
    - ✅ SSO setup → SDK
    - ✅ DNS hosted zones → SDK
    - ✅ NS delegation → SDK
    - ✅ Secret extraction → `set-dburl.sh`
    - ⬜ Registrar nameserver update (depends on registrar API — Namecheap, GoDaddy, Cloudflare)
    - ⬜ CI/CD pipeline setup (GitHub Actions per environment)
3.  **Extraction**: Clone Truly, delete the "Fintech" domain logic, replace with generic "Todo App" examples.
4.  **Setup UI**: Build the localhost Next.js wizard app (`packages/vibestack-setup/`).
    - Small Next.js app, runs on `localhost:3456`
    - Uses AWS SDK v3 directly (no CLI dependency)
    - State persisted in `.vibestack/config.json`
    - Each stage is a React component with form + progress indicator
5.  **CLI Wrapper**: `npx create-vibe-stack@latest` scaffolds repo + opens setup UI.

---

## 7. The Update Strategy (The "Ejection" Problem)

Since VibeStack provides code ownership (not a black-box library), updates require a "Component Diff" approach (similar to shadcn/ui).

1.  **Dependencies**: Standard libraries (SST, Tailwind, Prisma) are updated via `npm update` by the user.
2.  **Structural Updates**:
    - **Command**: `npx vibe update [package]` (e.g., `npx vibe update auth`).
    - **Mechanism**:
      1.  Fetches the latest template for that package.
      2.  Compares it against the user's local files.
      3.  **Interactive Diff**: The CLI prompts the user to overwrite or patch specific files: _"Security fix found in `session.ts`. Apply patch? (y/n)"_.
3.  **Infra Migrations**: For major infrastructure changes (e.g., SST upgrades), the CLI will provide **codemods** to automatically rewrite `sst.config.ts`.

---

## 8. Technical Reference: AWS SDK Calls

For the setup UI implementation, here are the exact SDK calls needed:

### Organizations

```typescript
import {
  OrganizationsClient,
  CreateOrganizationCommand,
  CreateAccountCommand,
  DescribeCreateAccountStatusCommand,
} from "@aws-sdk/client-organizations";
```

### Identity Center (SSO)

```typescript
import {
  SSOAdminClient,
  CreateInstanceCommand,
  CreatePermissionSetCommand,
  CreateAccountAssignmentCommand,
} from "@aws-sdk/client-sso-admin";
import {
  IdentitystoreClient,
  CreateUserCommand,
  CreateGroupCommand,
  CreateGroupMembershipCommand,
} from "@aws-sdk/client-identitystore";
```

### Route 53

```typescript
import {
  Route53Client,
  CreateHostedZoneCommand,
  ChangeResourceRecordSetsCommand,
  ListHostedZonesByNameCommand,
} from "@aws-sdk/client-route-53";
```

### Secrets Manager (for auto-extracting RDS credentials)

```typescript
import {
  SecretsManagerClient,
  ListSecretsCommand,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
```

### SST Secrets (via child process)

```typescript
import { execSync } from "child_process";
execSync(`npx sst secrets set DATABASE_URL "${url}" --stage ${stage}`);
```
