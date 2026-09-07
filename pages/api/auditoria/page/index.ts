import { aplicarCors } from "../../../../lib/cors";
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "../../../../lib/prisma";
import { requireAdmin } from "../../../../lib/auth";

// GET /api/auditoria/page?_page=1&_limit=20&entidade=ORDEM_SERVICO&acao=CRIAR&usuario=parte-do-email&de=2026-01-01&ate=2026-12-31
// Rota exclusiva do ADMIN.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  aplicarCors(req, res);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (!requireAdmin(req, res)) return;
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const {
      _page = "1",
      _limit = "20",
      entidade,
      acao,
      usuario,
      de,
      ate,
    } = req.query;

    const pageNumber = parseInt(_page as string, 10);
    const pageSize = Math.min(parseInt(_limit as string, 10), 100);
    if (isNaN(pageNumber) || isNaN(pageSize) || pageNumber < 1 || pageSize < 1) {
      return res
        .status(400)
        .json({ error: "Parâmetros de paginação inválidos" });
    }

    const where: Record<string, unknown> = {};
    if (entidade) where.entidade = String(entidade);
    if (acao) where.acao = String(acao);
    if (usuario)
      where.usuario = { contains: String(usuario), mode: "insensitive" };
    if (de || ate) {
      const data: Record<string, Date> = {};
      if (de) data.gte = new Date(`${de}T00:00:00`);
      if (ate) data.lte = new Date(`${ate}T23:59:59`);
      where.data = data;
    }

    const [registros, total] = await Promise.all([
      prisma.auditoria.findMany({
        where,
        skip: (pageNumber - 1) * pageSize,
        take: pageSize,
        orderBy: { data: "desc" },
      }),
      prisma.auditoria.count({ where }),
    ]);

    return res.status(200).json({
      registros,
      pagination: {
        currentPage: pageNumber,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        totalItems: total,
      },
    });
  } catch (e) {
    console.error("Erro ao buscar auditoria:", e);
    return res.status(500).json({ error: "Erro ao buscar auditoria" });
  }
}
