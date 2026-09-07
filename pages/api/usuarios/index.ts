import { aplicarCors } from "../../../lib/cors";
import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import prisma from "../../../lib/prisma";
import { requireAdmin, emailDoToken } from "../../../lib/auth";
import { registrarAuditoria } from "../../../lib/auditoria";

const cors = (req: NextApiRequest, res: NextApiResponse) => {
  aplicarCors(req, res);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
};

const semSenha = (u: { id: string; email: string; role: string; createdAt: Date }) => u;

// Gestão de usuários — exclusiva do ADMIN.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  cors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!requireAdmin(req, res)) return;

  if (req.method === "GET") {
    const usuarios = await prisma.user.findMany({
      select: { id: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    return res.status(200).json(usuarios.map(semSenha));
  }

  if (req.method === "POST") {
    try {
      const { email, password, role } = req.body ?? {};

      if (!email || !password) {
        return res
          .status(400)
          .json({ error: "E-mail e senha são obrigatórios." });
      }
      if (String(password).length < 6) {
        return res
          .status(400)
          .json({ error: "A senha deve ter ao menos 6 caracteres." });
      }
      const papel = role === "ADMIN" ? "ADMIN" : "OPERADOR";

      const existente = await prisma.user.findUnique({
        where: { email: String(email) },
      });
      if (existente) {
        return res.status(409).json({ error: "E-mail já cadastrado." });
      }

      const hash = await bcrypt.hash(String(password), 10);
      const criado = await prisma.$transaction(async (tx) => {
        const novo = await tx.user.create({
          data: { email: String(email), password: hash, role: papel },
          select: { id: true, email: true, role: true, createdAt: true },
        });
        await registrarAuditoria(tx, {
          usuario: emailDoToken(req),
          acao: "CRIAR",
          entidade: "USUARIO",
          entidadeId: novo.id,
          descricao: `${novo.email} — ${novo.role}`,
        });
        return novo;
      });

      return res.status(201).json(criado);
    } catch (e) {
      console.error("Erro ao criar usuário:", e);
      return res.status(500).json({
        error: "Erro ao criar usuário",
        details:
          process.env.NODE_ENV !== "production"
            ? String((e as Error)?.message ?? e)
            : undefined,
      });
    }
  }

  return res.status(405).json({ error: "Método não permitido" });
}
