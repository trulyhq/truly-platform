import { PrismaClient } from "@truly/database";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";

export type Context = {
  prisma?: PrismaClient;
  authToken?: string;
};

let prisma: PrismaClient | undefined;
let cachedDatabaseUrl: string | undefined;
let loadingDatabaseUrl: Promise<string | undefined> | undefined;
let schemaReadyPromise: Promise<void> | undefined;
const ssm = new SSMClient({});

async function ensureAuthSchema(prismaClient: PrismaClient): Promise<void> {
  if (schemaReadyPromise) return schemaReadyPromise;

  schemaReadyPromise = (async () => {
    await prismaClient.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" TEXT PRIMARY KEY,
        "email" TEXT NOT NULL UNIQUE,
        "username" TEXT NOT NULL UNIQUE,
        "password" TEXT NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await prismaClient.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "refresh_sessions" (
        "id" TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "token" TEXT NOT NULL UNIQUE,
        "expiresAt" TIMESTAMPTZ NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "refresh_sessions_userId_fkey"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      );
    `);

    await prismaClient.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "refresh_sessions_userId_idx"
      ON "refresh_sessions" ("userId");
    `);
  })();

  await schemaReadyPromise;
}

async function getDatabaseUrl(): Promise<string | undefined> {
  if (cachedDatabaseUrl) return cachedDatabaseUrl;

  const direct = process.env["DATABASE_URL"];
  if (direct) {
    cachedDatabaseUrl = direct;
    return direct;
  }

  const secretFromEnv = process.env["SST_Secret_value_DATABASE_URL"];
  if (secretFromEnv && secretFromEnv !== "__FETCH_FROM_SSM__") {
    cachedDatabaseUrl = secretFromEnv;
    process.env["DATABASE_URL"] = secretFromEnv;
    return secretFromEnv;
  }

  if (loadingDatabaseUrl) return loadingDatabaseUrl;

  loadingDatabaseUrl = (async () => {
    const prefix = process.env["SST_SSM_PREFIX"];
    if (!prefix) return undefined;

    const parameterName = `${prefix}Secret/DATABASE_URL/value`;
    const res = await ssm.send(
      new GetParameterCommand({ Name: parameterName, WithDecryption: true })
    );

    const value = res.Parameter?.Value;
    if (!value) return undefined;

    cachedDatabaseUrl = value;
    process.env["DATABASE_URL"] = value;
    return value;
  })();

  try {
    return await loadingDatabaseUrl;
  } finally {
    loadingDatabaseUrl = undefined;
  }

  return undefined;
}

async function getPrisma() {
  const url = await getDatabaseUrl();
  if (!url) return undefined;

  if (!prisma) prisma = new PrismaClient();
  await ensureAuthSchema(prisma);
  return prisma;
}

export async function createContext(
  req?: { headers?: Record<string, string | undefined> }
): Promise<Context> {
  const authToken = req?.headers?.["authorization"];
  return { prisma: await getPrisma(), authToken };
}