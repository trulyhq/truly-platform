1. API Gateway REST vs AppSync GraphQL
   My recommendation: REST with API Gateway + tRPC
   Here's why GraphQL is overkill for Truly right now:
   GraphQL shines when you have complex, deeply nested data with many consumers fetching different shapes of the same data. Think Facebook or GitHub's API where thousands of developers query in wildly different ways.
   Truly's data model is actually quite predictable. A transaction has a known shape. A dispute has a known shape. The number of distinct query patterns is limited. You don't need the flexibility GraphQL provides because your data access patterns are well defined.
   The real problem you're solving is type safety declared once and enforced everywhere. GraphQL was your mechanism for that at Turing, but it's not the only mechanism.
   tRPC solves this more elegantly for your stack:

You define a procedure on the backend:

const getTransaction = publicProcedure
.input(z.object({ id: z.string() }))
.query(async ({ input }) => {
return await db.transaction.findById(input.id)
})

The frontend gets full type safety automatically:

const { data } = trpc.getTransaction.useQuery({
id: 'txn_123'
})
// data is fully typed — no codegen step needed
// no GraphQL schema to maintain
// no resolver complexity

tRPC gives you:

End to end type safety from one definition
Auto-generated React Query hooks with full types
No schema files, no codegen commands to run
Works perfectly in a monorepo
Simpler than AppSync to deploy on Lambda
REST-like mental model, TypeScript-native

The only caveat: tRPC works best when frontend and backend are TypeScript. Since you're using React Native and Next.js — both TypeScript — this is a perfect fit.

2. Monorepo vs Polyrepo
   My recommendation: Monorepo with Turborepo, but with strict package boundaries
   The type sharing benefit is real and significant for Truly. You have three consumers of the same types — backend Lambda, Next.js web, and React Native mobile. Without a monorepo you're either duplicating types or publishing an internal package, both of which create maintenance overhead and drift risk.
   For a fintech product where a type mismatch between frontend and backend could mean displaying the wrong transaction amount, shared types aren't a nice-to-have. They're a correctness requirement.
   Structure it like this:

truly-platform/
├── apps/
│ ├── backend/ # Lambda functions (serverless)
│ ├── frontend-web/ # Next.js
│ └── frontend-mobile/ # React Native (Expo)
├── packages/
│ ├── types/ # Shared TypeScript types
│ ├── validators/ # Zod schemas (shared validation)
│ ├── trpc/ # tRPC router definitions
│ └── ui/ # Shared design tokens (optional)
├── turbo.json
└── package.json

Addressing your concerns:
CI/CD complexity: Turborepo handles this well. It only rebuilds and deploys what changed. If you only touched the mobile app, it won't trigger a backend deployment. Pipeline complexity is manageable and well documented.
Large repo navigation: This is a real concern but solvable with good folder structure and VS Code workspace settings. The alternative — type drift between three codebases — is a worse problem in a financial product.
Cloning: Only an issue for new team members. One clone, one install, everything works. That's actually simpler than managing three repos with three different setup procedures.

3. MongoDB vs PostgreSQL
   My recommendation: PostgreSQL. Firmly.
   This is the clearest of the three decisions.
   Here's the honest breakdown:
   The fintech requirements dominate.
   Truly is fundamentally a financial product. Every core operation — escrow funding, fund release, ledger entries, dispute resolution payouts — requires:

ACID transactions (atomicity is non-negotiable)
Row-level locking (preventing race conditions on fund operations)
Immutable append-only ledger (enforced at DB level)
Foreign key constraints (no orphaned transactions)
Consistent reads (you cannot have eventual consistency when displaying someone's escrow balance)

MongoDB can do ACID transactions now but it's bolt-on, not native. It requires careful session management and is significantly more complex to get right. One missed session and you have a non-atomic fund operation. That's a real money bug.
On the migration concern:
Prisma migrations are not the burden they used to be. The workflow is:

# Change your schema

# Run one command

npx prisma migrate dev --name add_listing_quantity

# Migration file generated automatically

# Applied to dev DB

# Types regenerated

For a product like Truly where the data model is actually quite stable at the core (transactions, disputes, wallets, ledger) — you won't be migrating core financial tables frequently. The e-commerce layer (listings, storefronts) is more flexible but still fits a relational model cleanly.

On unstructured e-commerce data:
This is the strongest argument for MongoDB but PostgreSQL handles it cleanly with JSONB columns. Listing descriptions, custom attributes, AI-generated metadata — all of this can live in a JSONB column while the structured financial data lives in typed columns with constraints.

CREATE TABLE listings (
id UUID PRIMARY KEY,
storefront_id UUID REFERENCES storefronts(id),
price BIGINT NOT NULL, -- structured, typed
quantity INTEGER NOT NULL, -- structured, typed
status VARCHAR(20) NOT NULL, -- structured, typed
metadata JSONB -- flexible, unstructured
);

```

You get relational integrity where it matters and document flexibility where you need it. Best of both.

**MongoDB's real home** is content-heavy applications — blogs, product catalogues, social feeds — where flexibility outweighs consistency. Truly's core is a ledger. A ledger needs Postgres.

---

## Summary

| Decision | Recommendation | Confidence |
|---|---|---|
| API style | REST + tRPC over API Gateway | High |
| Repo structure | Monorepo with Turborepo | High |
| Database | PostgreSQL with JSONB for flexible fields | Very high |

---

## One Additional Suggestion

Since you're going serverless, consider **Aurora Serverless v2** (PostgreSQL-compatible) instead of a standard RDS instance. It scales to zero when idle, scales up automatically under load, and is fully Postgres-compatible so Prisma works without changes. For a product in early validation stage this means you're not paying for idle DB capacity during nights and weekends, which matters when you're watching burn rate pre-revenue.

The only gotcha: Aurora Serverless v2 has cold start latency on the first connection after idle periods. Mitigate this with RDS Proxy sitting in front of it, which also handles connection pooling — important for Lambda since each Lambda invocation opens a new DB connection.
```

Lambda → RDS Proxy → Aurora Serverless v2 (PostgreSQL)

This is production-grade infrastructure that scales from zero to significant load without you touching anything.
