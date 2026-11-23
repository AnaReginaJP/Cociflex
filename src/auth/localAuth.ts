// Local accounts stored in MariaDB: email + password (scrypt) and cookie sessions.
import { randomBytes, randomUUID, scrypt, createHash, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { and, eq, gt, lt } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { users, sessions } from '../db/schema.ts';

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number
) => Promise<Buffer>;

export const SESSION_COOKIE = 'cociflex_session';
export const SESSION_DAYS = 30;
const KEY_LENGTH = 64;

export interface SessionUser {
  id: number;
  uid: string;
  email: string;
  name: string;
}

export class AuthError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

// ---------- Passwords ----------

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  const [scheme, saltB64, hashB64] = (stored || '').split('$');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = await scryptAsync(password, Buffer.from(saltB64, 'base64'), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// A fixed hash used when the email does not exist, so both cases take the same time.
const DUMMY_HASH_PROMISE = hashPassword(randomUUID());

// ---------- Validation ----------

export function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateCredentials(email: string, password: unknown): string | null {
  if (!EMAIL_RE.test(email) || email.length > 255) return 'Escribe un correo válido.';
  if (typeof password !== 'string' || password.length < 8) {
    return 'La contraseña debe tener al menos 8 caracteres.';
  }
  if (password.length > 200) return 'La contraseña es demasiado larga.';
  return null;
}

// ---------- Accounts ----------

const toSessionUser = (row: { id: number; uid: string; email: string; displayName: string }): SessionUser => ({
  id: row.id,
  uid: row.uid,
  email: row.email,
  name: row.displayName,
});

export async function registerUser(
  emailInput: unknown,
  password: unknown,
  displayNameInput: unknown
): Promise<SessionUser> {
  const email = normalizeEmail(emailInput);
  const problem = validateCredentials(email, password);
  if (problem) throw new AuthError(400, problem);

  const displayName =
    (typeof displayNameInput === 'string' ? displayNameInput.trim().slice(0, 80) : '') ||
    email.split('@')[0];

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) throw new AuthError(409, 'Ya existe una cuenta con ese correo.');

  const uid = randomUUID();
  try {
    await db.insert(users).values({
      uid,
      email,
      displayName,
      passwordHash: await hashPassword(password as string),
    });
  } catch (error: any) {
    if (error?.cause?.code === 'ER_DUP_ENTRY' || error?.code === 'ER_DUP_ENTRY') {
      throw new AuthError(409, 'Ya existe una cuenta con ese correo.');
    }
    throw error;
  }
  const [row] = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
  return toSessionUser(row);
}

export async function authenticateUser(emailInput: unknown, password: unknown): Promise<SessionUser> {
  const email = normalizeEmail(emailInput);
  const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const ok = await verifyPassword(
    typeof password === 'string' ? password : '',
    row?.passwordHash ?? (await DUMMY_HASH_PROMISE)
  );
  if (!row || !row.passwordHash || !ok) {
    throw new AuthError(401, 'Correo o contraseña incorrectos.');
  }
  return toSessionUser(row);
}

// ---------- Sessions ----------

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export async function createSession(userId: number): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt });
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
  // Housekeeping: drop expired sessions now and then.
  if (Math.random() < 0.1) {
    db.delete(sessions).where(lt(sessions.expiresAt, new Date())).catch(() => {});
  }
  return { token, expiresAt };
}

export async function findSessionUser(token: string | undefined): Promise<SessionUser | null> {
  if (!token || token.length > 200) return null;
  const rows = await db
    .select({ id: users.id, uid: users.uid, email: users.email, displayName: users.displayName })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return rows[0] ? toSessionUser(rows[0]) : null;
}

export async function deleteSession(token: string | undefined): Promise<void> {
  if (!token) return;
  await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
}

// ---------- Cookies ----------

export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    if (part.slice(0, index).trim() === name) {
      try {
        return decodeURIComponent(part.slice(index + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

export function sessionCookie(token: string, expiresAt: Date, secure: boolean): string {
  return [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Expires=${expiresAt.toUTCString()}`,
    ...(secure ? ['Secure'] : []),
  ].join('; ');
}

export function clearedSessionCookie(secure: boolean): string {
  return [
    `${SESSION_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    ...(secure ? ['Secure'] : []),
  ].join('; ');
}
