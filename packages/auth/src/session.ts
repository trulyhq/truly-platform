import type { PrismaClient } from "@truly/database";
import { generateRefreshToken, getRefreshTokenExpiresAt } from "./tokens";
import { sha256 } from "oslo/crypto";
import { encodeBase64 } from "oslo/encoding";

export async function createRefreshSession(
  prisma: PrismaClient,
  userId: string
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateRefreshToken();
  const hashedToken = await hashToken(token);
  const expiresAt = getRefreshTokenExpiresAt();

  await prisma.refreshSession.create({
    data: { userId, token: hashedToken, expiresAt },
  });

  return { token, expiresAt };
}

export async function validateRefreshToken(
  prisma: PrismaClient,
  token: string
): Promise<{ userId: string } | null> {
  const hashedToken = await hashToken(token);

  const session = await prisma.refreshSession.findUnique({
    where: { token: hashedToken },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) return null;
  return { userId: session.userId };
}

export async function revokeRefreshToken(prisma: PrismaClient, token: string): Promise<void> {
  const hashedToken = await hashToken(token);
  await prisma.refreshSession.deleteMany({ where: { token: hashedToken } });
}

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hash = await sha256(data);
  return encodeBase64(hash);
}
