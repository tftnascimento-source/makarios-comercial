import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";
import { revokeSession } from "@/lib/auth/session";

export async function POST() {
  const session = await getSession();
  if (session?.jti) {
    await revokeSession(session.sub, session.jti);
  }
  const cookieStore = await cookies();
  cookieStore.delete("mkrs_session");
  return NextResponse.json({ ok: true });
}
