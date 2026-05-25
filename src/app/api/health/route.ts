import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { getRedis } from "@/lib/redis";

/**
 * GET /api/health
 * Returns 200 when both the database and Redis are reachable.
 * Used by Docker HEALTHCHECK and load-balancer probes.
 */
export async function GET() {
  const checks: Record<string, "ok" | "error"> = {};

  // Database
  try {
    await db.execute(sql`SELECT 1`);
    checks.database = "ok";
  } catch {
    checks.database = "error";
  }

  // Redis
  try {
    const redis = await getRedis();
    await redis.ping();
    checks.redis = "ok";
  } catch {
    checks.redis = "error";
  }

  const healthy = Object.values(checks).every((v) => v === "ok");

  return NextResponse.json(
    { status: healthy ? "ok" : "degraded", checks, ts: new Date().toISOString() },
    { status: healthy ? 200 : 503 }
  );
}
