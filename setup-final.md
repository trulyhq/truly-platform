# Truly Platform: Architecture & Implementation Plan

This document serves as the single source of truth for the architectural decisions, technology stack, and implementation plan for the `truly-platform` project. It is intended to provide context for all team members and AI assistants involved in the project.

---

## 1. Core Architectural Decisions

The following decisions were made after evaluating various tradeoffs for building a secure, scalable, and maintainable fintech platform from scratch.

| Category           | Decision                | Tools                                         | Rationale & Tradeoffs                                                                                                                                                                                                                                                                                                                                           |
| :----------------- | :---------------------- | :-------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Repository**     | Monorepo                | Turborepo, npm Workspaces                     | **Why**: Ensures absolute type-safety between backend, web, and mobile by sharing `types`, `validators`, and `trpc` definitions. This is a critical correctness requirement for a financial application. **Tradeoff**: A single large repository requires disciplined folder structure, but this is preferable to the risk of type drift across multiple repos. |
| **API Layer**      | tRPC over REST          | API Gateway, AWS Lambda                       | **Why**: Provides end-to-end, compile-time type safety from backend to frontend without a codegen step. It is simpler and more efficient than GraphQL/AppSync for our use case, where data access patterns are well-defined.                                                                                                                                    |
| **Database**       | Relational DB           | PostgreSQL (Aurora Serverless v2), Prisma ORM | **Why**: The core ledger functionality demands ACID transactions, foreign key constraints, and strong consistency, which are native to PostgreSQL. Flexible data (e.g., product metadata) will be stored in `JSONB` columns. **Tradeoff**: Less schema flexibility than MongoDB, but this is a necessary constraint for financial data integrity.               |
| **Infrastructure** | Serverless, IaC         | SST (Serverless Stack)                        | **Why**: SST provides a superior developer experience for TypeScript monorepos. Its "Live Lambda Development" feature allows testing against real AWS resources locally, eliminating the "works on my machine" problem. It uses TypeScript for defining infrastructure, which aligns with our stack.                                                            |
| **Authentication** | Custom token-based auth | `@oslojs` primitives, Prisma                  | **Why**: Avoids vendor lock-in while keeping full ownership of user data and auth logic. We use short-lived access tokens (Bearer) with in-memory client storage and rotating refresh tokens in HttpOnly cookies. **Tradeoff**: More implementation complexity than managed auth services, but stronger control and a safer default for web security.           |
| **UI & Styling**   | Utility-First CSS       | Tailwind CSS, NativeWind                      | **Why**: Leverages team proficiency and allows for rapid prototyping. A shared `packages/ui` will contain universal components styled with Tailwind/NativeWind to work across both web (Next.js) and mobile (React Native).                                                                                                                                     |

---

## 2. Technical Implementation Details

### Backend & Infrastructure (SST)

- **Compute**: The backend tRPC router will be deployed as an **AWS Lambda** function.
- **API**: An **AWS API Gateway (HTTP API)** will serve as the public endpoint and route all requests to the Lambda function.
- **Database**: We will use **AWS Aurora Serverless v2 (Postgres compatible)** to benefit from scale-to-zero cost savings. An **RDS Proxy** will sit in front of it to manage connection pooling and mitigate cold starts from Lambda.
- **Async Processing**: For asynchronous tasks like fan-out notifications, we will use **AWS SQS (Queues)** and **SNS (Topics)**, defined and configured directly within SST.
- **Environments**: SST's "Stages" feature will be used to manage `dev`, `staging`, and `production` environments. Each developer will also have their own personal `dev` stage for isolated testing.
- **Secrets**: Secrets like API keys will be managed using the `sst secret` command, which stores them securely in **AWS SSM Parameter Store**.
- **Session Model**: Authentication uses a dual-token pattern. Access tokens are short-lived and sent as Bearer tokens in the `Authorization` header. Refresh tokens are long-lived, rotated, and stored in HttpOnly cookies. On web app reload, the client calls `auth.refresh` (`credentials: include`) to rehydrate an in-memory access token.

### Frontend & Deployment

- **Web (`apps/web`)**:
  - **Framework**: Next.js (App Router).
  - **Deployment**: The Next.js application will be deployed via **SST's `Nextjs` construct**. This automatically provisions a CloudFront distribution, an S3 bucket for static assets, and a Lambda@Edge/Lambda function for server-side rendering, mirroring the architecture of Vercel and Amplify but managed within our IaC.
  - **Wiring**: SST will automatically inject the backend API URL into the Next.js app's build process, eliminating manual environment variable configuration.
- **Mobile (`apps/mobile`)**:
  - **Framework**: React Native (via Expo).
  - **Deployment**: We will use **EAS (Expo Application Services)** to build and deploy the mobile app.
  - **Environments**:
    - **Staging**: Builds will be distributed to internal testers via **TestFlight (iOS)** and **Google Play Internal Testing (Android)**.
    - **Production**: Builds will be submitted to the public App Store and Google Play Store.
  - **Updates**: **EAS OTA (Over-the-Air) Updates** will be used to push small JavaScript/UI changes directly to users without requiring a new app store submission. This will be managed via `preview` and `production` channels.

### Security

- **DDoS Protection**: We will rely on the default **AWS Shield Standard** provided for CloudFront and API Gateway.
- **Brute Force Protection**: The manual authentication logic will include application-level rate limiting. We will track failed login attempts per user in our Postgres database and temporarily lock accounts after too many failed attempts.
- **IP-Based Rate Limiting**: For production, we will add an **AWS WAF** rule via SST to block IP addresses that make an excessive number of requests in a short period, blocking them before they hit our Lambda.
- **Token Security**:
  - Access tokens are stored in memory on web clients (not persisted in local/session storage).
  - Refresh tokens use `HttpOnly`, `Secure`, `SameSite=Lax`, and `Path=/` cookie attributes.
  - Refresh and logout endpoints include CSRF defenses (SameSite policy plus anti-CSRF token strategy).

### Git Strategy

- A single Git repository will be initialized at the root of the `truly-platform` directory.
- Any `.git` subdirectories created by scaffolding tools (e.g., `create-next-app`) within the `apps/` folder will be removed to avoid Git submodule conflicts.

---

## 3. Phased Implementation Plan

The project will be executed in the following phases:

#### Phase 1: Monorepo Scaffolding 🏗️

1.  **Initialize Workspace**: Set up the root `package.json` with `npm` workspaces and install `turbo`.
2.  **Shared Configs**: Create `packages/tsconfig` and `packages/eslint-config` to enforce consistent, strict coding standards across the entire monorepo.
3.  **Directory Structure**: Create the `apps/` and `packages/` directory structure.

#### Phase 2: The Core Logic (Packages) 🧠

1.  **Database (`packages/database`)**: Initialize Prisma with the Postgres provider. Define the initial schema, including `User` and `RefreshSession` tables for authentication.
2.  **Authentication (`packages/auth`)**: Implement custom token-based authentication using `@oslojs` for password hashing (Argon2id), access token issuance/verification, and refresh token creation, rotation, revocation, and secure cookie handling.
3.  **Validators (`packages/validators`)**: Create initial Zod schemas for user input and API validation.

#### Phase 3: The Serverless Backend (SST + tRPC) ⚡

1.  **Infrastructure (`sst.config.ts`)**: Define the core AWS resources (API Gateway, Lambda, Aurora DB) using SST constructs.
2.  **tRPC Server (`packages/trpc`)**: Create the tRPC `appRouter`, define the `Context` to include the user session, and implement `publicProcedure` and `protectedProcedure` helpers.
3.  **Implement Auth Endpoints**: Build the `auth.signup` and `auth.login` tRPC procedures using the logic from `packages/auth`.

#### Phase 4: The Universal Frontend 📱

1.  **UI System (`packages/ui`)**: Configure NativeWind and create a few basic, universal components (e.g., `Button`, `Input`).
2.  **Web App (`apps/web`)**: Initialize the Next.js app, set up the tRPC client, and build a functional login page that communicates with the backend.
3.  **Mobile App (`apps/mobile`)**: Initialize the Expo app, configure its Metro bundler to work with the monorepo, set up the tRPC client, and reuse the login page components.

#### Post-Setup TODOs 📝

1.  ✅ **Environment Wiring Pass (Completed)**

- Web uses SST-injected `NEXT_PUBLIC_API_URL` per stage at deploy time.
- Mobile uses `EXPO_PUBLIC_API_URL` for local dev and EAS environments.

2.  ✅ **Runbook (Completed)**

- Stage-based deploy/testing/promotion runbook is documented in `README.md`.
