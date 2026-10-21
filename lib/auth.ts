const SESSION_COOKIE = "jaidee_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

function base64UrlEncode(value: Uint8Array) {
  return btoa(String.fromCharCode(...value))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - (normalized.length % 4)) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function signingKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) return null;
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export function getAdminCredentials() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  return username && password ? { username, password } : null;
}

export function constantTimeEqual(left: string, right: string) {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return difference === 0;
}

export async function createSessionToken(username: string) {
  const key = await signingKey();
  if (!key) throw new Error("SESSION_SECRET must be set to at least 32 characters.");
  const payload = base64UrlEncode(new TextEncoder().encode(JSON.stringify({
    role: "admin",
    username,
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  })));
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return `${payload}.${base64UrlEncode(new Uint8Array(signature))}`;
}

export async function getSessionFromToken(token?: string) {
  if (!token) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;
  const key = await signingKey();
  if (!key) return null;
  try {
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlDecode(signature),
      new TextEncoder().encode(payload),
    );
    if (!valid) return null;
    const session = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload))) as {
      role?: string;
      username?: string;
      expiresAt?: number;
    };
    if (session.role !== "admin" || typeof session.expiresAt !== "number" || session.expiresAt <= Date.now() / 1000) return null;
    const username = session.username?.trim() || getAdminCredentials()?.username;
    if (!username) return null;
    return {
      username,
      displayName: process.env.ADMIN_DISPLAY_NAME?.trim() || username,
      role: session.role,
      expiresAt: session.expiresAt,
    };
  } catch {
    return null;
  }
}

export async function isValidSessionToken(token?: string) {
  return Boolean(await getSessionFromToken(token));
}

export const sessionCookie = {
  name: SESSION_COOKIE,
  maxAge: SESSION_TTL_SECONDS,
};
