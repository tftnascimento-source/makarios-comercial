import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { usuarios } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { comparePassword, hashPassword } from "@/lib/utils/password";
import { z } from "zod";

const Schema = z.object({
  senhaAtual: z.string().min(1, "Senha atual obrigatória"),
  novaSenha:  z.string().min(8, "Nova senha deve ter pelo menos 8 caracteres"),
});

export async function PATCH(req: NextRequest) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = (await req.json()) as unknown;
  const parsed = Schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 }
    );

  const { senhaAtual, novaSenha } = parsed.data;

  // Fetch the current user's hash
  const usuario = await db.query.usuarios.findFirst({
    where: eq(usuarios.id, session.sub),
  });
  if (!usuario)
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });

  const ok = await comparePassword(senhaAtual, usuario.senhaHash);
  if (!ok)
    return NextResponse.json({ error: "Senha atual incorreta" }, { status: 400 });

  if (senhaAtual === novaSenha)
    return NextResponse.json(
      { error: "A nova senha deve ser diferente da senha atual" },
      { status: 400 }
    );

  const novoHash = await hashPassword(novaSenha);
  await db
    .update(usuarios)
    .set({ senhaHash: novoHash, atualizadoEm: new Date() })
    .where(eq(usuarios.id, session.sub));

  return NextResponse.json({ data: { ok: true } });
}
