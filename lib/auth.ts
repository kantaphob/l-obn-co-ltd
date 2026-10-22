import { createHash } from "node:crypto";
import { prisma } from "./prisma";
import { sessionCookie, verifySessionToken } from "./session-token";

export { sessionCookie };

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function getSessionFromToken(token?: string) {
  const payload = await verifySessionToken(token);
  if (!payload || !token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: {
      user: {
        include: {
          role: { include: { permissions: { select: { permission: true } } } },
          userProfile: { select: { name: true, surname: true } },
        },
      },
    },
  });
  if (
    !session ||
    session.revokedAt ||
    session.expiresAt.getTime() <= Date.now() ||
    session.userId !== payload.userId ||
    session.user.username !== payload.username ||
    session.user.role.code !== payload.roleCode
  ) return null;

  const profileName = session.user.userProfile;
  const displayName = profileName ? `${profileName.name} ${profileName.surname}`.trim() : session.user.username;
  return {
    userId: session.user.id,
    username: session.user.username,
    displayName,
    role: session.user.role.code,
    permissions: session.user.role.permissions.map(({ permission }) => permission),
    expiresAt: session.expiresAt,
  };
}

export async function revokeSession(token?: string) {
  if (!token) return;
  await prisma.session.updateMany({
    where: { tokenHash: hashSessionToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
