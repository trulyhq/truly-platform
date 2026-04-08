import { execSync } from "child_process";
import path from "path";
import fs from "fs";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

/**
 * Lambda handler that runs `prisma migrate deploy` after SST deploy.
 *
 * It resolves the DATABASE_URL from either:
 *   1. SST Config.Secret (via SSM parameter)
 *   2. The RDS-generated secret in Secrets Manager (fallback)
 *
 * This runs inside the VPC (private subnet with egress) so it has
 * direct access to the RDS instance — no bastion needed.
 */
export async function handler() {
  const databaseUrl = await resolveDatabaseUrl();

  if (!databaseUrl) {
    console.error("❌ Could not resolve DATABASE_URL. Skipping migration.");
    console.error("   Set the DATABASE_URL SST secret first: npm run secrets:set-dburl");
    return { status: "skipped", reason: "no DATABASE_URL" };
  }

  console.log("🔄 Running prisma migrate deploy...");

  // Resolve the prisma CLI entry point. We invoke it with `node` directly
  // instead of `npx` because npx resolves through node_modules/.bin/ symlinks
  // which causes __dirname to point to .bin/ instead of prisma/build/.
  // This breaks the WASM file (prisma_schema_build_bg.wasm) resolution at runtime.
  const prismaCliPath = resolvePrismaCli();
  console.log(`📍 Using prisma CLI at: ${prismaCliPath}`);

  const execOpts = {
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
    cwd: process.cwd(),
    stdio: "pipe" as const,
    timeout: 240_000,
  };

  try {
    // Check current migration status first
    const statusOutput = execSync(
      `node "${prismaCliPath}" migrate status --schema ./prisma/schema.prisma`,
      { ...execOpts, stdio: "pipe" }
    );
    const statusText = statusOutput.toString();
    console.log("📋 Migration status:\n", statusText);

    // If this is a fresh Prisma setup against an existing DB (tables exist but
    // no _prisma_migrations table), we need to baseline the initial migration.
    if (statusText.includes("Database schema is not empty") || statusText.includes("baseline")) {
      console.log("🔧 Baselining initial migration (tables already exist)...");
      try {
        execSync(
          `node "${prismaCliPath}" migrate resolve --applied 0001_initial --schema ./prisma/schema.prisma`,
          execOpts
        );
        console.log("✅ Baseline applied for 0001_initial");
      } catch (baselineErr: unknown) {
        const be = baselineErr as { stderr?: Buffer };
        const msg = be.stderr?.toString() ?? "";
        // If the migration is already applied, that's fine
        if (!msg.includes("already been applied")) {
          console.warn("⚠️ Baseline resolve warning:", msg);
        }
      }
    }
  } catch {
    // migrate status can fail if _prisma_migrations table doesn't exist yet.
    // That's OK — migrate deploy will create it.
    console.log("ℹ️ No migration history found (first deploy). Proceeding...");
  }

  try {
    const output = execSync(
      `node "${prismaCliPath}" migrate deploy --schema ./prisma/schema.prisma`,
      execOpts
    );

    const stdout = output.toString();
    console.log(stdout);

    return { status: "success", output: stdout };
  } catch (err: unknown) {
    const error = err as { stdout?: Buffer; stderr?: Buffer; message?: string };
    const stderr = error.stderr?.toString() ?? error.message ?? "Unknown error";
    const stdout = error.stdout?.toString() ?? "";

    console.error("❌ prisma migrate deploy failed:");
    console.error(stderr);
    if (stdout) console.log(stdout);

    throw new Error(`Migration failed: ${stderr}`);
  }
}

/**
 * Resolve the prisma CLI entry point (build/index.js inside the prisma package).
 *
 * We try multiple candidate paths because SST may place node_modules in different
 * locations depending on the bundling configuration. This is more robust than
 * hardcoding a single path.
 */
function resolvePrismaCli(): string {
  const cwd = process.cwd();

  const candidates = [
    // SST installs packages in the Lambda output dir's node_modules
    path.join(cwd, "node_modules", "prisma", "build", "index.js"),
    // Fallback: try relative to this file's location
    path.join(__dirname, "..", "node_modules", "prisma", "build", "index.js"),
    path.join(__dirname, "node_modules", "prisma", "build", "index.js"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  // Last resort: log diagnostics and throw
  console.error("❌ Could not find prisma CLI. Diagnostics:");
  console.error(`   cwd: ${cwd}`);
  console.error(`   __dirname: ${__dirname}`);
  try {
    console.error(`   cwd contents: ${fs.readdirSync(cwd).join(", ")}`);
    const nm = path.join(cwd, "node_modules");
    if (fs.existsSync(nm)) {
      console.error(`   node_modules contents: ${fs.readdirSync(nm).join(", ")}`);
      const prismaDir = path.join(nm, "prisma");
      if (fs.existsSync(prismaDir)) {
        console.error(`   prisma/ contents: ${fs.readdirSync(prismaDir).join(", ")}`);
        const buildDir = path.join(prismaDir, "build");
        if (fs.existsSync(buildDir)) {
          console.error(`   prisma/build/ contents: ${fs.readdirSync(buildDir).join(", ")}`);
        }
      }
    }
  } catch (e) {
    console.error(`   Error listing dirs: ${e}`);
  }

  throw new Error(`prisma CLI not found. Searched: ${candidates.join(", ")}`);
}

// ─── DATABASE_URL resolution ─────────────────────────────────────────────────

async function resolveDatabaseUrl(): Promise<string | undefined> {
  // 1. Direct env var (local dev)
  if (process.env["DATABASE_URL"]) {
    return process.env["DATABASE_URL"];
  }

  // 2. SST injects the secret value via SSM
  const fromSst = process.env["SST_Secret_value_DATABASE_URL"];
  if (fromSst && fromSst !== "__FETCH_FROM_SSM__") {
    return fromSst;
  }

  // 3. Fetch from SSM (SST Config.Secret path)
  const ssmValue = await fetchFromSsm();
  if (ssmValue) return ssmValue;

  // 4. Fallback: build URL from the RDS-generated Secrets Manager secret
  return await fetchFromRdsSecret();
}

async function fetchFromSsm(): Promise<string | undefined> {
  const prefix = process.env["SST_SSM_PREFIX"];
  if (!prefix) return undefined;

  try {
    const ssm = new SSMClient({});
    const res = await ssm.send(
      new GetParameterCommand({
        Name: `${prefix}Secret/DATABASE_URL/value`,
        WithDecryption: true,
      })
    );
    return res.Parameter?.Value;
  } catch {
    return undefined;
  }
}

async function fetchFromRdsSecret(): Promise<string | undefined> {
  const secretArn = process.env["DB_SECRET_ARN"];
  if (!secretArn) return undefined;

  try {
    const sm = new SecretsManagerClient({});
    const res = await sm.send(new GetSecretValueCommand({ SecretId: secretArn }));
    if (!res.SecretString) return undefined;

    const s = JSON.parse(res.SecretString);
    const user = encodeURIComponent(s.username);
    const pass = encodeURIComponent(s.password);
    return `postgresql://${user}:${pass}@${s.host}:${s.port}/${s.dbname}`;
  } catch {
    return undefined;
  }
}
