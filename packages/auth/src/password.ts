import { sha256 } from "oslo/crypto";
import { encodeBase64 } from "oslo/encoding";

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await sha256(data);
  return encodeBase64(hash);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  const newHash = await hashPassword(password);
  return newHash === hash;
}