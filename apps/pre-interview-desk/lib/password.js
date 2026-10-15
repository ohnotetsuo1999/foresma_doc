import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
const scryptAsync = promisify(scrypt);

export async function hashPassword(pw) {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scryptAsync(pw, salt, 64)).toString("hex");
  return `scrypt$${salt}$${hash}`;
}
export async function verifyPassword(pw, stored) {
  if (!stored) return false; // Google ログイン専用のメンバー
  const [alg, salt, hash] = String(stored).split("$");
  if (alg !== "scrypt" || !salt || !hash) return false;
  const got = await scryptAsync(pw, salt, 64);
  const want = Buffer.from(hash, "hex");
  return want.length === got.length && timingSafeEqual(want, got);
}
