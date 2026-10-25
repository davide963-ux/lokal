import bcrypt from "bcryptjs";
import { z } from "zod";

const BCRYPT_COST = 12;
// bcrypt silently truncates input at 72 bytes; reject longer passwords instead of weakening them.
const MAX_BYTES = 72;

export const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .refine((v) => Buffer.byteLength(v, "utf8") <= MAX_BYTES, "Password is too long (max 72 bytes)")
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), "Password must contain at least one letter and one number");

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// Compared against when the account does not exist, so response time doesn't reveal valid emails.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", BCRYPT_COST);
export function burnPasswordCheck(plain: string): Promise<boolean> {
  return bcrypt.compare(plain, DUMMY_HASH);
}
