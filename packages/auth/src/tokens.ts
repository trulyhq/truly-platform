import { generateRandomString } from "./utils";

export interface AccessTokenPayload {
  userId: string;
  issuedAt: number;
  expiresAt: number;
}

export interface RefreshTokenPayload {
  sessionId: string;
  issuedAt: number;
}

const ACCESS_TOKEN_LIFETIME_SECONDS = 15 * 60; // 15 minutes
const REFRESH_TOKEN_LIFETIME_DAYS = 30;

export function generateAccessToken(userId: string): string {
  const payload: AccessTokenPayload = {
    userId,
    issuedAt: Math.floor(Date.now() / 1000),
    expiresAt: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_LIFETIME_SECONDS,
  };
  const json = JSON.stringify(payload);
  return Buffer.from(json, "utf8").toString("base64");
}

export function parseAccessToken(token: string): AccessTokenPayload | null {
  try {
    const json = Buffer.from(token, "base64").toString("utf8");
    const payload = JSON.parse(json) as AccessTokenPayload;
    if (payload.expiresAt < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function generateRefreshToken(): string {
  return generateRandomString(32);
}

export function getRefreshTokenExpiresAt(): Date {
  const date = new Date();
  date.setDate(date.getDate() + REFRESH_TOKEN_LIFETIME_DAYS);
  return date;
}