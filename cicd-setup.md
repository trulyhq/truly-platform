# CI/CD & Deployment Setup — TODO

## Overview

This document covers the full CI/CD pipeline setup for the `truly-platform` monorepo.

**Architecture:**

- **Landing** (`mytruly.app`) — Next.js marketing site, deployed via SST (NextjsSite)
- **Web App** (`go.mytruly.app`) — Next.js authenticated app, deployed via SST (NextjsSite)
- **Backend** (`api.mytruly.app`) — Lambda + API Gateway, deployed via SST
- **Mobile** — Expo/React Native, built via EAS, distributed via App Store / Play Store

**AWS Accounts:**

| Account | Environments                       | Purpose                      |
| ------- | ---------------------------------- | ---------------------------- |
| Dev     | `{initials}` (personal dev stacks) | Development                  |
| Staging | `staging`, `release`               | Pre-production testing       |
| Prod    | `prod`, `hotfix`                   | Production + emergency fixes |

**Environments:**

| Environment | Branch           | Landing                      | Web App                         | API                              | Mobile                                 | Account |
| ----------- | ---------------- | ---------------------------- | ------------------------------- | -------------------------------- | -------------------------------------- | ------- |
| Dev         | feature branches | `{initials}.dev.mytruly.app` | `go.{initials}.dev.mytruly.app` | `api.{initials}.dev.mytruly.app` | Expo Go (local)                        | Dev     |
| Staging     | `main`           | `staging.mytruly.app`        | `go.staging.mytruly.app`        | `api.staging.mytruly.app`        | Internal TestFlight / Play internal    | Staging |
| Release     | `release`        | `release.mytruly.app`        | `go.release.mytruly.app`        | `api.release.mytruly.app`        | External TestFlight / Play closed beta | Staging |
| Prod        | `prod`           | `mytruly.app`                | `go.mytruly.app`                | `api.mytruly.app`                | App Store / Play Store                 | Prod    |
| Hotfix      | `hotfix/*`       | —                            | `go.hotfix.mytruly.app`         | `api.hotfix.mytruly.app`         | Internal TestFlight (fast-track)       | Prod    |

**Git flow:**

```
feature → PR → main (staging) → release → prod
                                            ↑
                              hotfix/* ──────┘ (branch off prod, merge back to prod + main)
```

---

## Phase 1: Mobile (EAS) Configuration

### 1.1 Update `apps/mobile/app.json`

Add bundle identifiers, owner, and scheme:

```json
{
  "expo": {
    "name": "Truly",
    "slug": "truly-mobile",
    "owner": "<your-expo-username>",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "scheme": "truly",
    "newArchEnabled": true,
    "userInterfaceStyle": "automatic",
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "assetBundlePatterns": ["**/*"],
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "app.truly.mobile"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "package": "app.truly.mobile"
    },
    "extra": {
      "eas": {
        "projectId": "<your-eas-project-id>"
      }
    },
    "updates": {
      "url": "https://u.expo.dev/<your-eas-project-id>"
    },
    "runtimeVersion": {
      "policy": "appVersion"
    }
  }
}
```

**Action items:**

- [ ] Replace `<your-expo-username>` with your Expo account username
- [ ] Run `eas init` in `apps/mobile/` to get `<your-eas-project-id>`
- [ ] Replace both occurrences of `<your-eas-project-id>`

### 1.2 Create `apps/mobile/eas.json`

```json
{
  "cli": {
    "version": ">= 14.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "base": {
      "node": "20.19.4",
      "env": {}
    },
    "development": {
      "extends": "base",
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": true
      }
    },
    "preview": {
      "extends": "base",
      "distribution": "internal",
      "channel": "staging",
      "env": {
        "APP_ENV": "staging",
        "API_URL": "https://api.staging.mytruly.app"
      }
    },
    "release": {
      "extends": "base",
      "distribution": "internal",
      "channel": "release",
      "autoIncrement": true,
      "env": {
        "APP_ENV": "release",
        "API_URL": "https://api.release.mytruly.app"
      }
    },
    "hotfix": {
      "extends": "base",
      "distribution": "internal",
      "channel": "hotfix",
      "env": {
        "APP_ENV": "hotfix",
        "API_URL": "https://api.hotfix.mytruly.app"
      }
    },
    "production": {
      "extends": "base",
      "distribution": "store",
      "channel": "production",
      "autoIncrement": true,
      "env": {
        "APP_ENV": "production",
        "API_URL": "https://api.mytruly.app"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "<your-apple-id>",
        "ascAppId": "<your-app-store-connect-app-id>",
        "appleTeamId": "<your-apple-team-id>"
      },
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json",
        "track": "production"
      }
    }
  }
}
```

**Action items:**

- [ ] Replace Apple-related placeholders after creating the app in App Store Connect
- [ ] Create a Google Play service account and download the JSON key
- [ ] Add `google-service-account.json` to `.gitignore` (CI will inject it as a secret)

### 1.3 Update `apps/mobile/src/lib/trpc.ts` to use environment-aware API URL

The mobile app needs to read the API URL from the environment variable set in `eas.json`:

```typescript
import Constants from "expo-constants";

const API_URL =
  Constants.expoConfig?.extra?.API_URL ??
  process.env.EXPO_PUBLIC_API_URL ??
  "http://localhost:3001"; // fallback for local dev

// Use API_URL when creating the tRPC client
```

**Note:** For `eas.json` env vars to be accessible at runtime, they need to be prefixed with `EXPO_PUBLIC_` OR read via `expo-constants` in `app.config.js`. We'll use the `app.config.js` approach — see section 1.4.

### 1.4 Create `apps/mobile/app.config.js` (dynamic config)

This wraps `app.json` and injects build-time env vars into `extra`:

```javascript
export default ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    API_URL: process.env.API_URL ?? "http://localhost:3001",
    APP_ENV: process.env.APP_ENV ?? "development",
  },
});
```

This makes `Constants.expoConfig.extra.API_URL` available at runtime.

---

## Phase 2: GitHub Actions Workflows

### 2.1 `ci.yml` — PR Checks

Runs on every PR. Lint, typecheck, and (future) tests.

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
    branches: [main, release, prod]

concurrency:
  group: ci-${{ github.head_ref }}
  cancel-in-progress: true

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - run: npm ci

      - run: npx turbo run build --filter="@truly/database"
        # Prisma generate must run before typecheck

      - run: npx turbo run typecheck lint
```

### 2.2 `deploy-backend-web-staging.yml`

```yaml
# .github/workflows/deploy-backend-web-staging.yml
name: Deploy Backend + Web + Landing (Staging)

on:
  push:
    branches: [main]
    paths:
      - "apps/backend/**"
      - "apps/web/**"
      - "apps/landing/**"
      - "packages/**"
      - "sst.config.ts"
      - "package.json"

concurrency:
  group: deploy-staging
  cancel-in-progress: false

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - run: npm ci

      - run: npx turbo run build

      - name: Run database migrations
        run: |
          npx prisma migrate deploy --schema packages/database/prisma/schema.prisma
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL_STAGING }}

      - name: Deploy to staging
        run: npx sst deploy --stage staging
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

### 2.3 `deploy-backend-web-release.yml`

```yaml
# .github/workflows/deploy-backend-web-release.yml
name: Deploy Backend + Web + Landing (Release)

on:
  push:
    branches: [release]
    paths:
      - "apps/backend/**"
      - "apps/web/**"
      - "apps/landing/**"
      - "packages/**"
      - "sst.config.ts"
      - "package.json"

concurrency:
  group: deploy-release
  cancel-in-progress: false

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: release
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - run: npm ci

      - run: npx turbo run build

      - name: Deploy to release
        run: npx sst deploy --stage release
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}

      - name: Run database migrations
        run: |
          npx prisma migrate deploy --schema packages/database/prisma/schema.prisma
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL_RELEASE }}
```

### 2.4 `deploy-backend-web-prod.yml`

```yaml
# .github/workflows/deploy-backend-web-prod.yml
name: Deploy Backend + Web + Landing (Production)

on:
  push:
    branches: [prod]
    paths:
      - "apps/backend/**"
      - "apps/web/**"
      - "apps/landing/**"
      - "packages/**"
      - "sst.config.ts"
      - "package.json"

concurrency:
  group: deploy-prod
  cancel-in-progress: false

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - run: npm ci

      - run: npx turbo run build

      - name: Run database migrations
        run: |
          npx prisma migrate deploy --schema packages/database/prisma/schema.prisma
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL_PROD }}

      - name: Deploy to production
        run: npx sst deploy --stage prod
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

### 2.5 `deploy-backend-web-hotfix.yml`

```yaml
# .github/workflows/deploy-backend-web-hotfix.yml
name: Deploy Backend + Web + Landing (Hotfix)

on:
  push:
    branches: ["hotfix/**"]
    paths:
      - "apps/backend/**"
      - "apps/web/**"
      - "apps/landing/**"
      - "packages/**"
      - "sst.config.ts"
      - "package.json"

concurrency:
  group: deploy-hotfix
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: hotfix
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - run: npm ci

      - run: npx turbo run build

      - name: Run database migrations
        run: |
          npx prisma migrate deploy --schema packages/database/prisma/schema.prisma
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL_HOTFIX }}

      - name: Deploy to hotfix
        run: npx sst deploy --stage hotfix
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

### 2.6 `deploy-mobile-staging.yml`

```yaml
# .github/workflows/deploy-mobile-staging.yml
name: Deploy Mobile (Staging)

on:
  push:
    branches: [main]
    paths:
      - "apps/mobile/**"
      - "packages/ui/**"
      - "packages/trpc/**"
      - "packages/validators/**"

concurrency:
  group: deploy-mobile-staging
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}

      - run: npm ci

      - name: Build for staging
        working-directory: apps/mobile
        run: eas build --profile preview --platform all --non-interactive
```

### 2.7 `deploy-mobile-release.yml`

```yaml
# .github/workflows/deploy-mobile-release.yml
name: Deploy Mobile (Release)

on:
  push:
    branches: [release]
    paths:
      - "apps/mobile/**"
      - "packages/ui/**"
      - "packages/trpc/**"
      - "packages/validators/**"

concurrency:
  group: deploy-mobile-release
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    environment: release
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}

      - run: npm ci

      - name: Build for release
        working-directory: apps/mobile
        run: eas build --profile release --platform all --non-interactive
```

### 2.8 `deploy-mobile-prod.yml`

```yaml
# .github/workflows/deploy-mobile-prod.yml
name: Deploy Mobile (Production)

on:
  push:
    branches: [prod]
    paths:
      - "apps/mobile/**"
      - "packages/ui/**"
      - "packages/trpc/**"
      - "packages/validators/**"

concurrency:
  group: deploy-mobile-prod
  cancel-in-progress: false

jobs:
  build-and-submit:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}

      - run: npm ci

      - name: Build for production
        working-directory: apps/mobile
        run: eas build --profile production --platform all --non-interactive --auto-submit
```

### 2.9 `deploy-mobile-hotfix.yml`

```yaml
# .github/workflows/deploy-mobile-hotfix.yml
name: Deploy Mobile (Hotfix)

on:
  push:
    branches: ["hotfix/**"]
    paths:
      - "apps/mobile/**"
      - "packages/ui/**"
      - "packages/trpc/**"
      - "packages/validators/**"

concurrency:
  group: deploy-mobile-hotfix
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    environment: hotfix
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}

      - run: npm ci

      - name: Build hotfix
        working-directory: apps/mobile
        run: eas build --profile hotfix --platform all --non-interactive
```

---

### 2.10 `deploy-landing-prod.yml`

The landing page only needs staging (covered by the backend+web+landing staging workflow via SST) and a direct-to-prod deploy. No release/hotfix environments needed for marketing content.

```yaml
# .github/workflows/deploy-landing-prod.yml
name: Deploy Landing Page (Production)

on:
  push:
    branches: [prod]
    paths:
      - "apps/landing/**"

concurrency:
  group: deploy-landing-prod
  cancel-in-progress: false

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - run: npm ci

      - run: npx turbo run build --filter="@truly/landing"

      - name: Deploy landing to production
        run: npx sst deploy --stage prod
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

> **Note:** In practice, if only `apps/landing/**` changed, the backend+web+landing prod workflow won't trigger (paths don't match). This dedicated workflow ensures the landing page still deploys to prod independently.

---

## Phase 3: OTA Updates (Optional — JS-only hotfixes)

For JS-only changes that don't require a new native binary, add an OTA update workflow:

### 3.1 `ota-update.yml`

```yaml
# .github/workflows/ota-update.yml
name: OTA Update

on:
  workflow_dispatch:
    inputs:
      branch:
        description: "EAS Update branch (staging/release/production/hotfix)"
        required: true
        type: choice
        options:
          - staging
          - release
          - production
          - hotfix
      message:
        description: "Update message"
        required: true

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}

      - run: npm ci

      - name: Publish OTA update
        working-directory: apps/mobile
        run: |
          eas update \
            --branch ${{ inputs.branch }} \
            --message "${{ inputs.message }}" \
            --non-interactive
```

This is manually triggered via GitHub Actions UI — useful for pushing JS-only hotfixes to production without going through the full store review cycle.

---

## Phase 4: GitHub Configuration

### 4.1 GitHub Environments

Create these environments in GitHub repo settings → Environments:

| Environment  | Protection Rules                                    |
| ------------ | --------------------------------------------------- |
| `staging`    | None (auto-deploy on merge to main)                 |
| `release`    | None (auto-deploy on merge to release)              |
| `production` | Required reviewers (optional, you said auto-deploy) |
| `hotfix`     | None (fast-track)                                   |

### 4.2 GitHub Secrets

**Per-environment secrets** (set in each GitHub Environment — note different AWS credentials per account):

| Secret                  | Staging              | Release              | Prod              | Hotfix            |
| ----------------------- | -------------------- | -------------------- | ----------------- | ----------------- |
| `AWS_ACCESS_KEY_ID`     | ✅ (staging account) | ✅ (staging account) | ✅ (prod account) | ✅ (prod account) |
| `AWS_SECRET_ACCESS_KEY` | ✅ (staging account) | ✅ (staging account) | ✅ (prod account) | ✅ (prod account) |
| `DATABASE_URL_STAGING`  | ✅                   | —                    | —                 | —                 |
| `DATABASE_URL_RELEASE`  | —                    | ✅                   | —                 | —                 |
| `DATABASE_URL_PROD`     | —                    | —                    | ✅                | —                 |
| `DATABASE_URL_HOTFIX`   | —                    | —                    | —                 | ✅                |

> **Important:** Staging and release share the same AWS account but have different `DATABASE_URL` secrets (pointing to different RDS instances/databases). Prod and hotfix share the same AWS account but hotfix uses a separate database.

**Repository-level secrets** (shared across all environments):

| Secret                       | Purpose                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------- |
| `EXPO_TOKEN`                 | EAS Build authentication (generate at expo.dev/accounts/settings/access-tokens) |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Google Play submission (base64-encoded JSON)                                    |

### 4.3 Branch Protection Rules

| Branch    | Rules                                                      |
| --------- | ---------------------------------------------------------- |
| `main`    | Require PR, require CI checks to pass, no direct push      |
| `release` | Require PR from `main` only, require CI checks             |
| `prod`    | Require PR from `release` or `hotfix/*`, require CI checks |

---

## Phase 5: SST Custom Domains (Multi-Account)

Update `sst.config.ts` to use custom domains per stage, with the correct hosted zone per account:

```typescript
// In sst.config.ts, inside the stack function:

const stage = app.stage; // "staging", "release", "prod", "hotfix", or dev initials (e.g. "da")

const knownStages = ["staging", "release", "prod", "hotfix"];
const isPersonalDev = !knownStages.includes(stage);

// Each AWS account has its own Route 53 hosted zone.
// SST only needs to know which hosted zone is in the CURRENT account.
const hostedZone = isPersonalDev
  ? "dev.mytruly.app" // Dev account
  : stage === "staging"
    ? "staging.mytruly.app" // Staging account
    : stage === "release"
      ? "release.mytruly.app" // Staging account
      : stage === "hotfix"
        ? "hotfix.mytruly.app" // Prod account
        : "mytruly.app"; // Prod account (prod stage)

// Domain names
const apiDomain = isPersonalDev
  ? `api.${stage}.dev.mytruly.app`
  : stage === "prod"
    ? "api.mytruly.app"
    : `api.${stage}.mytruly.app`;

const webDomain = isPersonalDev
  ? `go.${stage}.dev.mytruly.app`
  : stage === "prod"
    ? "go.mytruly.app"
    : `go.${stage}.mytruly.app`;

const landingDomain = isPersonalDev
  ? `${stage}.dev.mytruly.app`
  : stage === "prod"
    ? "mytruly.app"
    : `${stage}.mytruly.app`; // staging.mytruly.app, release.mytruly.app

// API
const api = new Api(stack, "api", {
  customDomain: {
    domainName: apiDomain,
    hostedZone: hostedZone,
  },
  // ... rest of api config
});

// Web App (authenticated)
const web = new NextjsSite(stack, "web", {
  path: "apps/web",
  customDomain: {
    domainName: webDomain,
    hostedZone: hostedZone,
  },
  environment: {
    NEXT_PUBLIC_API_URL: api.customDomainUrl ?? api.url,
  },
});

// Landing Page (marketing)
const landing = new NextjsSite(stack, "landing", {
  path: "apps/landing",
  customDomain: {
    domainName: landingDomain,
    hostedZone: hostedZone,
  },
  environment: {
    NEXT_PUBLIC_APP_URL: web.customDomainUrl ?? web.url,
    NEXT_PUBLIC_API_URL: api.customDomainUrl ?? api.url,
  },
});
```

---

## Phase 6: DNS Setup (Multi-Account Delegation)

Domain is registered on **Namecheap**. We delegate the entire domain to Route 53 in the prod account, then delegate environment subdomains to each account's hosted zone.

### 6.1 Architecture

```
Namecheap (domain registrar)
  └── NS records → Route 53 (Prod account)
        mytruly.app hosted zone
        ├── mytruly.app           → landing (prod)
        ├── go.mytruly.app        → web app (prod)
        ├── api.mytruly.app       → API (prod)
        ├── go.hotfix.mytruly.app → web app (prod account)
        ├── api.hotfix.mytruly.app→ API (prod account)
        ├── MX records            → Google Workspace (or current email)
        ├── TXT records           → domain verification
        ├── NS: dev.mytruly.app       → Dev account hosted zone
        ├── NS: staging.mytruly.app   → Staging account hosted zone
        └── NS: release.mytruly.app   → Staging account hosted zone

Dev account (Route 53)
  └── dev.mytruly.app hosted zone
        ├── da.dev.mytruly.app        → landing (dev)
        ├── go.da.dev.mytruly.app     → web app (dev)
        └── api.da.dev.mytruly.app    → API (dev)
        (SST creates these automatically per developer stage)

Staging account (Route 53)
  ├── staging.mytruly.app hosted zone
  │     ├── staging.mytruly.app       → landing (staging)
  │     ├── go.staging.mytruly.app    → web app (staging)
  │     └── api.staging.mytruly.app   → API (staging)
  └── release.mytruly.app hosted zone
        ├── release.mytruly.app       → landing (release)
        ├── go.release.mytruly.app    → web app (release)
        └── api.release.mytruly.app   → API (release)
```

### 6.2 One-Time Setup Steps

**Step 1: Prod account — Create root hosted zone**

- [ ] AWS Console (Prod) → Route 53 → Create hosted zone → `mytruly.app`
- [ ] Note the 4 NS records Route 53 gives you

**Step 2: Namecheap — Point nameservers to Route 53**

- [ ] Namecheap → Domain → Nameservers → Custom DNS
- [ ] Paste the 4 NS records from Step 1
- [ ] Wait for propagation (~1 hour, up to 48)

**Step 3: Prod account — Add email records**

- [ ] If keeping Namecheap email: copy existing MX records into Route 53
- [ ] If moving to Google Workspace: add Google MX records:

| Priority | Mail server               |
| -------- | ------------------------- |
| 1        | `ASPMX.L.GOOGLE.COM`      |
| 5        | `ALT1.ASPMX.L.GOOGLE.COM` |
| 5        | `ALT2.ASPMX.L.GOOGLE.COM` |
| 10       | `ALT3.ASPMX.L.GOOGLE.COM` |
| 10       | `ALT4.ASPMX.L.GOOGLE.COM` |

- [ ] Add TXT record for Google domain verification (Google provides this during Workspace setup)

**Step 4: Dev account — Create dev hosted zone**

- [ ] AWS Console (Dev) → Route 53 → Create hosted zone → `dev.mytruly.app`
- [ ] Note the 4 NS records

**Step 5: Prod account — Delegate dev subdomain**

- [ ] In the `mytruly.app` hosted zone, create an NS record:
  - Name: `dev.mytruly.app`
  - Type: NS
  - Value: (the 4 nameservers from Step 4)

**Step 6: Staging account — Create staging + release hosted zones**

- [ ] AWS Console (Staging) → Route 53 → Create hosted zone → `staging.mytruly.app`
- [ ] Note the 4 NS records
- [ ] AWS Console (Staging) → Route 53 → Create hosted zone → `release.mytruly.app`
- [ ] Note the 4 NS records

**Step 7: Prod account — Delegate staging + release subdomains**

- [ ] In the `mytruly.app` hosted zone, create NS records:
  - `staging.mytruly.app` → (nameservers from staging hosted zone)
  - `release.mytruly.app` → (nameservers from release hosted zone)

**Step 8: Hotfix (optional — can use root zone)**

- [ ] Since hotfix runs in the prod account, SST can use the `mytruly.app` hosted zone directly
- [ ] OR create a separate `hotfix.mytruly.app` hosted zone in the prod account for cleanliness

### 6.3 Hosted Zone Summary

| Hosted Zone           | Account | Created By        | Delegated From                             |
| --------------------- | ------- | ----------------- | ------------------------------------------ |
| `mytruly.app`         | Prod    | Manual (one-time) | Namecheap NS records                       |
| `dev.mytruly.app`     | Dev     | Manual (one-time) | NS record in `mytruly.app` zone            |
| `staging.mytruly.app` | Staging | Manual (one-time) | NS record in `mytruly.app` zone            |
| `release.mytruly.app` | Staging | Manual (one-time) | NS record in `mytruly.app` zone            |
| `hotfix.mytruly.app`  | Prod    | Manual (one-time) | NS record in `mytruly.app` zone (optional) |

Total: **4–5 hosted zones**, created once. After this, SST manages all DNS records automatically.

---

## Implementation Order

### Phase A: DNS & Multi-Account Setup (do first)

- [ ] 1. Create hosted zone `mytruly.app` in Route 53 (Prod account)
- [ ] 2. Switch Namecheap nameservers to Route 53 (see Phase 6, Step 2)
- [ ] 3. Add MX/TXT records for email in Route 53 (see Phase 6, Step 3)
- [ ] 4. Wait for DNS propagation (~1–48 hours)
- [ ] 5. Create hosted zone `dev.mytruly.app` in Route 53 (Dev account)
- [ ] 6. Create hosted zones `staging.mytruly.app` + `release.mytruly.app` in Route 53 (Staging account)
- [ ] 7. Add NS delegation records in prod account's `mytruly.app` zone for `dev`, `staging`, `release`
- [ ] 8. Verify delegation: `dig NS dev.mytruly.app`, `dig NS staging.mytruly.app`

### Phase B: Landing Page App

- [ ] 9. Create `apps/landing` — new Next.js app (marketing site)
- [ ] 10. Update `sst.config.ts` with multi-account domain logic (see Phase 5)
- [ ] 11. Test dev deploy: `SST_STAGE=da npm run dev:deploy` → verify `da.dev.mytruly.app`, `go.da.dev.mytruly.app`, `api.da.dev.mytruly.app`

### Phase C: Mobile (EAS) Configuration

- [ ] 12. Create Expo account access token at https://expo.dev/accounts/settings/access-tokens
- [ ] 13. Run `cd apps/mobile && npx eas init` to link the project
- [ ] 14. Update `apps/mobile/app.json` with bundle identifiers and EAS project ID
- [ ] 15. Create `apps/mobile/eas.json`
- [ ] 16. Create `apps/mobile/app.config.js`
- [ ] 17. Update `apps/mobile/src/lib/trpc.ts` to use `Constants.expoConfig.extra.API_URL`

### Phase D: CI/CD Workflows

- [ ] 18. Create GitHub Environments (staging, release, production, hotfix)
- [ ] 19. Add GitHub Secrets per environment (AWS keys per account, EXPO_TOKEN, DATABASE_URLs)
- [ ] 20. Create all `.github/workflows/*.yml` files (12 files total)
- [ ] 21. Create `release` and `prod` branches

### Phase E: Staging Deployment Verification

- [ ] 22. Push to `main` → verify staging deploys automatically
- [ ] 23. Verify `staging.mytruly.app` (landing), `go.staging.mytruly.app` (web), `api.staging.mytruly.app` (API)
- [ ] 24. Verify mobile staging build triggers on EAS

### Phase F: Mobile Store Setup

- [ ] 25. Create app in Apple App Store Connect
- [ ] 26. Create app in Google Play Console
- [ ] 27. First EAS build: `cd apps/mobile && eas build --profile preview --platform all`
- [ ] 28. Test on device via TestFlight / internal track
- [ ] 29. First production build + submit

---

## File Checklist

Files to create/modify:

| File                                               | Action                                                             |
| -------------------------------------------------- | ------------------------------------------------------------------ |
| **Landing page**                                   |                                                                    |
| `apps/landing/`                                    | **Create** — new Next.js app (marketing site)                      |
| **Mobile**                                         |                                                                    |
| `apps/mobile/app.json`                             | **Modify** — add bundleIdentifier, package, owner, scheme, updates |
| `apps/mobile/eas.json`                             | **Create** — EAS Build profiles                                    |
| `apps/mobile/app.config.js`                        | **Create** — dynamic config for env vars                           |
| `apps/mobile/src/lib/trpc.ts`                      | **Modify** — use Constants.expoConfig.extra.API_URL                |
| `apps/mobile/.gitignore`                           | **Modify** — add `google-service-account.json`                     |
| **SST**                                            |                                                                    |
| `sst.config.ts`                                    | **Modify** — multi-account domain logic (see Phase 5)              |
| **CI/CD Workflows**                                |                                                                    |
| `.github/workflows/ci.yml`                         | **Create** — PR checks (lint, typecheck)                           |
| `.github/workflows/deploy-backend-web-staging.yml` | **Create**                                                         |
| `.github/workflows/deploy-backend-web-release.yml` | **Create**                                                         |
| `.github/workflows/deploy-backend-web-prod.yml`    | **Create**                                                         |
| `.github/workflows/deploy-backend-web-hotfix.yml`  | **Create**                                                         |
| `.github/workflows/deploy-landing-prod.yml`        | **Create** — landing page: main → prod only                        |
| `.github/workflows/deploy-mobile-staging.yml`      | **Create**                                                         |
| `.github/workflows/deploy-mobile-release.yml`      | **Create**                                                         |
| `.github/workflows/deploy-mobile-prod.yml`         | **Create**                                                         |
| `.github/workflows/deploy-mobile-hotfix.yml`       | **Create**                                                         |
| `.github/workflows/ota-update.yml`                 | **Create** (optional)                                              |

**Note:** The landing page only needs one deploy workflow (`main → prod`) since marketing content doesn't need release/hotfix environments. Staging is included in the backend+web workflows since they share the same SST deploy.
