import { PrismaClient } from "@truly/database";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";

export type Context = {
  prisma?: PrismaClient;
  authToken?: string;
};

let prisma: PrismaClient | undefined;
let cachedDatabaseUrl: string | undefined;
let loadingDatabaseUrl: Promise<string | undefined> | undefined;
const ssm = new SSMClient({});

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
  return prisma;
}

export async function createContext(req?: {
  headers?: Record<string, string | undefined>;
}): Promise<Context> {
  const authToken = req?.headers?.["authorization"];
  return { prisma: await getPrisma(), authToken };
}
