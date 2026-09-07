import { aplicarCors } from "../../../lib/cors";
import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import prisma from "../../../lib/prisma";
import { requireAdmin, emailDoToken } from "../../../lib/auth";
import { registrarAuditoria } from "../../../lib/auditoria";

const cors = (req: NextApiRequest, res: NextApiResponse) => {
  aplicarCors(req, res);
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
};

// Gestão de usuários — exclusiva do ADMIN.
// Travas: não pode excluir a si mesmo nem o último ADMIN;
// não pode rebaixar o último ADMIN.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  cors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();
  const admin = requireAdmin(req, res);
  if (!admin) return;

  const { id } = req.query;

  if (req.method === "GET") {
    const usuario = await prisma.user.findUnique({
      where: { id: String(id) },
      select: { id: true, email: true, role: true, createdAt: true },
    });
    if (!usuario) return res.status(404).json({ error: "Usuário não encontrado" });
    return res.json(usuario);
  }

  if (req.method === "PUT") {
    try {
      const { role, password } = req.body ?? {};
      const atual = await prisma.user.findUnique({
        where: { id: String(id) },
      });
      if (!atual) return res.status(404).json({ error: "Usuário não encontrado" });

      const dados: { role?: "ADMIN" | "OPERADOR"; password?: string } = {};
      if (role === "ADMIN" || role === "OPERADOR") {
        if (
          atual.role === "ADMIN" &&
          role === "OPERADOR" &&
          (await prisma.user.count({ where: { role: "ADMIN" } })) <= 1
        ) {
          return res
            .status(400)
            .json({ error: "Não é possível rebaixar o último ADMIN." });
        }
        dados.role = role;
      }
      if (password) {
        if (String(password).length < 6) {
          return res
            .status(400)
            .json({ error: "A senha deve ter ao menos 6 caracteres." });
        }
        dados.password = await bcrypt.hash(String(password), 10);
      }
      if (Object.keys(dados).length === 0) {
        return res.status(400).json({ error: "Nada para atualizar." });
      }

      const atualizado = await prisma.$transaction(async (tx) => {
        const novo = await tx.user.update({
          where: { id: String(id) },
          data: dados,
          select: { id: true, email: true, role: true, createdAt: true },
        });
        await registrarAuditoria(tx, {
          usuario: emailDoToken(req),
          acao: "ATUALIZAR",
          entidade: "USUARIO",
          entidadeId: String(id),
          descricao: `${novo.email} — ${novo.role}${password ? " (senha redefinida)" : ""}`,
        });
        return novo;
      });
      return res.json(atualizado);
    } catch (e) {
      console.error("Erro ao atualizar usuário:", e);
      return res.status(500).json({ error: "Erro ao atualizar usuário" });
    }
  }

  if (req.method === "DELETE") {
    try {
      const atual = await prisma.user.findUnique({
        where: { id: String(id) },
      });
      if (!atual) return res.status(404).json({ error: "Usuário não encontrado" });
      if (atual.id === admin.userId) {
        return res
          .status(400)
          .json({ error: "Você não pode excluir seu próprio usuário." });
      }
      if (
        atual.role === "ADMIN" &&
        (await prisma.user.count({ where: { role: "ADMIN" } })) <= 1
      ) {
        return res
          .status(400)
          .json({ error: "Não é possível excluir o último ADMIN." });
      }

      await prisma.$transaction(async (tx) => {
        await tx.user.delete({ where: { id: String(id) } });
        await registrarAuditoria(tx, {
          usuario: emailDoToken(req),
          acao: "EXCLUIR",
          entidade: "USUARIO",
          entidadeId: String(id),
          descricao: `${atual.email} — ${atual.role}`,
        });
      });
      return res.json({ deleted: true });
    } catch (e) {
      console.error("Erro ao excluir usuário:", e);
      return res.status(500).json({ error: "Erro ao excluir usuário" });
    }
  }

  return res.status(405).json({ error: "Método não permitido" });
}
