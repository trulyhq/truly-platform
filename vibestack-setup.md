# VibeStack: The AI-Native Enterprise Boilerplate

**VibeStack** is a product vision designed to solve the "Vibe Coding" trap. It bridges the gap between AI-generated logic and production-grade engineering. Instead of just generating code, VibeStack provides the **skeleton**—infrastructure, security, and architecture—so that AI tools (Cursor, Claude, Windsurf) can safely fill in the **flesh**.

---

## 1. The Core Value Proposition

- **The Problem**: Founders and "vibe coders" use AI to build apps, resulting in unmaintainable spaghetti code, security vulnerabilities, massive AWS bills, and zero scalability. They skip the "boring" engineering work (Auth, CI/CD, IaC, Type Safety).
- **The Solution**: An opinionated, battle-tested "Engine" delivered via a CLI. It sets up a scalable Monorepo, fully configured Infrastructure as Code, and Type-Safe boundaries.
- **The "AI Container"**: The architecture explicitly separates "Core Infrastructure" (locked) from "Feature Logic" (AI playground). This ensures that even if an AI writes bad logic, it cannot break the build pipeline or expose the database.

---

## 2. The Stack ("The Engine")

This is the exact stack we are building for `truly-platform`, productized for general use.

| Layer        | Technology                 | Role                                                                            |
| :----------- | :------------------------- | :------------------------------------------------------------------------------ |
| **Repo**     | Turborepo + npm Workspaces | The rigid backbone that enforces type safety between apps.                      |
| **Infra**    | SST (Serverless Stack)     | Infrastructure as Code (TypeScript). Manages AWS (Lambda, API Gateway, S3).     |
| **Database** | PostgreSQL (Aurora v2)     | The source of truth. Structured data (Users, Auth) + JSONB (Flexible App Data). |
| **API**      | tRPC                       | End-to-end type safety. No GraphQL schemas, no REST docs. Just functions.       |
| **Auth**     | Manual / Oslo              | Vendor-agnostic authentication. Zero lock-in. Full control over sessions.       |
| **UI**       | NativeWind (Tailwind)      | Universal styling for Web and Mobile.                                           |
| **Clients**  | Next.js + Expo             | One codebase logic serving Web (SSR) and Mobile (Native).                       |

---

## 3. The Delivery Mechanism: "The Magic CLI"

Instead of the traditional "Clone Repo -> Read README -> Struggle with Env Vars" flow, VibeStack is delivered via an interactive CLI.

**Command:**

```bash
npx create-vibe-stack@latest
```

### The User Flow

**1. Identity & Branding**

> "What is your project name?" -> `my-startup`
> "What is your stripped DB prefix?" -> `mst`
> _Action_: Renames all package.json files, creates DB schema prefixes.

**2. Infrastructure Configuration**

> "Where are we deploying?" -> `AWS (us-east-1)`
> "Do you need a staging environment?" -> `Yes`
> _Action_: Generates `sst.config.ts` with multi-stage logic pre-baked.

**3. Feature Toggles (The "Plugins")**

> "Do you need Payments?" -> `Yes (Stripe)`
> _Action_: Uncomments `packages/stripe`, installs SDKs, adds generic `Charge` schema to DB.
> "Do you need Email?" -> `Yes (AWS SES)`
> _Action_: Configures IAM roles for SES, adds `packages/mailer` adapter.
> "Do you need Background Jobs?" -> `Yes`
> _Action_: Provisions SQS/SNS in SST and creates a sample `worker.ts`.

**4. The Secrets Handshake**

> "Enter your Stripe Test Key (or skip):" -> `sk_test_...`
> "Enter your Database URL (or let SST create one):" -> `[Enter]`
> _Action_: Writes to `.env` locally and uploads to AWS SSM Parameter Store automatically.

**5. Liftoff**

> "Deploying your stack..."
> _Action_: Runs `pnpm install`, `prisma generate`, and `sst dev`.
> **Result**: The user is dropped into a running localhost dashboard where Auth, DB, and API are already working.

---

## 4. The "AI Container" Architecture

VibeStack configures the codebase to guide AI Agents (Cursor/Windsurf) to success.

### The Directory Structure

```text
my-startup/
├── .cursorrules           # <-- Crucial: Instructions for the AI
├── apps/
│   └── web/
│       └── features/      # <-- THE PLAYGROUND. AI is told to write code ONLY here.
├── packages/
│   ├── auth/              # <-- LOCKED. AI typically breaks this. We provide it pre-built.
│   ├── db/                # <-- LOCKED. The prisma client.
│   └── trpc/              # <-- LOCKED. The router backbone.
```

### The `.cursorrules` Instruction

The template includes a pre-written prompt file for the AI:

> "You are building on VibeStack.
>
> 1. NEVER modify `packages/auth`. Import `ctx.session` instead.
> 2. To add a database model, edit `schema.prisma` and run `pnpm db:push`.
> 3. To add an API endpoint, create a file in `packages/trpc/routers`.
> 4. Styling must use Tailwind classes."

### Protecting the Rules

To prevent the AI from overwriting its own instructions, VibeStack employs a multi-layered defense:

1.  **Ignore File (`.cursorignore`)**: The CLI generates a file that explicitly tells the AI tool to ignore core files like `.cursorrules`, `packages/auth`, and `sst.config.ts`. The AI cannot edit a file it is instructed to never read.
2.  **File Permissions**: The CLI sets critical files like `.cursorrules` to be read-only (`chmod 444`) at the file-system level, providing a hard lock against accidental writes.
3.  **Git Pre-Commit Hook**: A pre-commit hook is included to verify that core rule files have not been modified, preventing a compromised ruleset from ever being committed to the repository.

---

## 5. Roadmap: From `truly-platform` to VibeStack

1.  **Build Phase**: Execute the `truly-platform` plan (Phases 1-4). This builds the "Engine."
2.  **Pain Audit**: Document every manual step we hated during the Truly build. Automate it in the CLI.
3.  **Extraction**: Clone Truly, delete the "Fintech" domain logic, and replace it with generic "Todo App" examples.
4.  **CLI Wrapper**: Wrap the extracted repo in an interactive Node.js script (`create-vibe-stack`).

---

## 6. The Update Strategy (The "Ejection" Problem)

Since VibeStack provides code ownership (not a black-box library), updates require a "Component Diff" approach (similar to shadcn/ui).

1.  **Dependencies**: Standard libraries (SST, Tailwind, Prisma) are updated via `pnpm update` by the user.
2.  **Structural Updates**:
    - **Command**: `npx vibe update [package]` (e.g., `npx vibe update auth`).
    - **Mechanism**:
      1.  Fetches the latest template for that package.
      2.  Compares it against the user's local files.
      3.  **Interactive Diff**: The CLI prompts the user to overwrite or patch specific files: _"Security fix found in `session.ts`. Apply patch? (y/n)"_.
3.  **Infra Migrations**: For major infrastructure changes (e.g., SST upgrades), the CLI will provide **codemods** to automatically rewrite `sst.config.ts`.

```

```
