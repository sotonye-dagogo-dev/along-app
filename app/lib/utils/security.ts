import bcrypt from "bcryptjs";

// 10 is ~ 60ms vs 12 ~250ms ; reduces risk of FUNCTION_INVOCATION_TIMEOUT on Vercel 10s limit
// bcryptjs is pure JS and doesn't require native bindings, more reliable on serverless
const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Synchronous variants for edge cases where async would block too long
export function hashPasswordSync(password: string): string {
  return bcrypt.hashSync(password, SALT_ROUNDS);
}

export function verifyPasswordSync(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}
