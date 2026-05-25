import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { usuarios } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { LoginSchema } from "@/lib/validations/auth";
import { createSession } from "@/lib/auth/session";
import { comparePassword } from "@/lib/utils/password";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  const body = await request.json() as unknown;
  const parsed = LoginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", code: "VALIDATION_ERROR" },
      { status: 400 }
    );
  }

  const { email, senha } = parsed.data;

  const usuario = await db.query.usuarios.findFirst({
    where: eq(usuarios.email, email),
  });

  if (!usuario || !usuario.ativo) {
    return NextResponse.json(
      { error: "Credenciais inválidas", code: "INVALID_CREDENTIALS" },
      { status: 401 }
    );
  }

  const passwordMatch = await comparePassword(senha, usuario.senhaHash);
  if (!passwordMatch) {
    return NextResponse.json(
      { error: "Credenciais inválidas", code: "INVALID_CREDENTIALS" },
      { status: 401 }
    );
  }

  await db
    .update(usuarios)
    .set({ ultimoAcesso: new Date() })
    .where(eq(usuarios.id, usuario.id));

  const token = await createSession({
    sub: usuario.id,
    email: usuario.email,
    nome: usuario.nome,
    role: usuario.role,
    grupoId: usuario.grupoId,
  });

  const cookieStore = await cookies();
  cookieStore.set("mkrs_session", token, {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "lax",
    maxAge: 8 * 60 * 60,
    path: "/",
  });

  return NextResponse.json({
    data: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      role: usuario.role,
      grupoId: usuario.grupoId,
    },
  });
}
