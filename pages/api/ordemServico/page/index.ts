import { requireAuth } from "../../../../lib/auth";
import { aplicarCors } from "../../../../lib/cors";
import { NextApiRequest, NextApiResponse } from "next";
import prisma from '../../../../lib/prisma';

// GET /api/ordemServico/page?_page=1&_limit=20&cliente=&descricao=&de=2026-01-01&ate=2026-12-31
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Adiciona os cabeçalhos CORS
  aplicarCors(req, res);
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS, PUT, DELETE"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Responde a requisição OPTIONS imediatamente
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (!requireAuth(req, res)) return;

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const {
      _page = "1",
      _limit = "20",
      cliente,
      descricao,
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
    if (cliente) {
      where.cliente = { contains: String(cliente), mode: "insensitive" };
    }
    if (descricao) {
      where.descricao = { contains: String(descricao), mode: "insensitive" };
    }
    if (de || ate) {
      const data: Record<string, Date> = {};
      if (de) data.gte = new Date(`${de}T00:00:00`);
      if (ate) data.lte = new Date(`${ate}T23:59:59`);
      where.data = data;
    }

    const [ordemServicos, total] = await Promise.all([
      prisma.ordemServico.findMany({
        where,
        skip: (pageNumber - 1) * pageSize,
        take: pageSize,
        orderBy: { data: "desc" },
      }),
      prisma.ordemServico.count({ where }),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return res.status(200).json({
      ordemServicos,
      pagination: {
        currentPage: pageNumber,
        totalPages,
        totalItems: total,
      },
    });
  } catch {
    return res.status(500).json({ error: "Erro ao buscar ordens de serviço" });
  }
}
