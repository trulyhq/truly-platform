import { execSync } from "child_process";
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
    const statusOutput = execSync("npx prisma migrate status --schema ./prisma/schema.prisma", {
      ...execOpts,
      stdio: "pipe",
    });
    const statusText = statusOutput.toString();
    console.log("📋 Migration status:\n", statusText);

    // If this is a fresh Prisma setup against an existing DB (tables exist but
    // no _prisma_migrations table), we need to baseline the initial migration.
    if (statusText.includes("Database schema is not empty") || statusText.includes("baseline")) {
      console.log("🔧 Baselining initial migration (tables already exist)...");
      try {
        execSync(
          "npx prisma migrate resolve --applied 0001_initial --schema ./prisma/schema.prisma",
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
    const output = execSync("npx prisma migrate deploy --schema ./prisma/schema.prisma", execOpts);

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
