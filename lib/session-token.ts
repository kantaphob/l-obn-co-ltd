const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
export const sessionCookie = { name: "jaidee_session", maxAge: SESSION_TTL_SECONDS };

export type SessionTokenPayload = {
  userId: number;
  username: string;
  roleCode: string;
  expiresAt: number;
};

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

export async function createSessionToken(user: Omit<SessionTokenPayload, "expiresAt">) {
  const key = await signingKey();
  if (!key) throw new Error("SESSION_SECRET must be set to at least 32 characters.");
  const nonce = crypto.getRandomValues(new Uint8Array(16));
  const payload = base64UrlEncode(new TextEncoder().encode(JSON.stringify({
    ...user,
    nonce: base64UrlEncode(nonce),
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  })));
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return `${payload}.${base64UrlEncode(new Uint8Array(signature))}`;
}

export async function verifySessionToken(token?: string): Promise<SessionTokenPayload | null> {
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
    const session = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload))) as Partial<SessionTokenPayload>;
    if (
      !Number.isInteger(session.userId) ||
      typeof session.username !== "string" ||
      typeof session.roleCode !== "string" ||
      typeof session.expiresAt !== "number" ||
      session.expiresAt <= Date.now() / 1000
    ) return null;
    return session as SessionTokenPayload;
  } catch {
    return null;
  }
}
