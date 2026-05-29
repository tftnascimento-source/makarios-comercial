import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { getRedis } from "@/lib/redis";
import { env } from "@/lib/env";
import { randomUUID } from "crypto";

const SESSION_TTL_SECONDS = 8 * 60 * 60; // 8 hours
const SECRET = new TextEncoder().encode(env.JWT_SECRET);

export interface SessionPayload extends JWTPayload {
  sub: string; // userId
  email: string;
  nome: string;
  role: "admin_grupo" | "gestor" | "visualizador";
  grupoId: string;
  jti: string;
}

export async function createSession(
  payload: Omit<SessionPayload, "jti" | "iat" | "exp">
): Promise<string> {
  const jti = randomUUID();
  const redis = await getRedis();

  const token = await new SignJWT({ ...payload, jti })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(SECRET);

  await redis.set(
    `session:${payload.sub}:${jti}`,
    JSON.stringify({ ...payload, jti }),
    { ex: SESSION_TTL_SECONDS }
  );

  return token;
}

export async function verifySession(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify<SessionPayload>(token, SECRET);
    const redis = await getRedis();
    const stored = await redis.get(`session:${payload.sub}:${payload.jti}`);
    if (!stored) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function revokeSession(
  userId: string,
  jti: string
): Promise<void> {
  const redis = await getRedis();
  await redis.del(`session:${userId}:${jti}`);
}
