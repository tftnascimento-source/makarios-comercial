export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

// Diagnostic endpoint — shows env var presence WITHOUT revealing values
// Remove this file after debugging is complete
export async function GET() {
  return NextResponse.json({
    node: process.version,
    env: {
      DATABASE_URL:  !!process.env["DATABASE_URL"],
      REDIS_URL:     !!process.env["REDIS_URL"],
      JWT_SECRET:    !!process.env["JWT_SECRET"],
      AUTH_SECRET:   !!process.env["AUTH_SECRET"],
      NODE_ENV:      process.env["NODE_ENV"],
      NEXT_PHASE:    process.env["NEXT_PHASE"] ?? null,
    },
    ts: new Date().toISOString(),
  });
}
