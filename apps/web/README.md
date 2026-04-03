# @truly/web

Next.js web app for Truly (Phase 4 Step 2).

## Run

```bash
npm run -w @truly/web dev
```

By default it targets the deployed API endpoint in `src/lib/trpc.ts`.
Override with:

```bash
NEXT_PUBLIC_API_URL=https://your-api.execute-api.region.amazonaws.com npm run -w @truly/web dev
```
