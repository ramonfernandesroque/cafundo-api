import { requireAuth } from "../../../../lib/auth";
import { aplicarCors } from "../../../../lib/cors";
import { NextApiRequest, NextApiResponse } from "next";
import prisma from '../../../../lib/prisma';

// GET /api/cliente/page?_page=1&_limit=20&nome=&documento=&cidade=
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
    const { _page = "1", _limit = "20", nome, documento, cidade } = req.query;

    const pageNumber = parseInt(_page as string, 10);
    const pageSize = Math.min(parseInt(_limit as string, 10), 100);

    if (isNaN(pageNumber) || isNaN(pageSize) || pageNumber < 1 || pageSize < 1) {
      return res
        .status(400)
        .json({ error: "Parâmetros de paginação inválidos" });
    }

    const where: Record<string, unknown> = {};
    if (nome) {
      where.nome = { contains: String(nome), mode: "insensitive" };
    }
    if (documento) {
      where.documento = {
        contains: String(documento).replace(/\D/g, "") || String(documento),
        mode: "insensitive",
      };
    }
    if (cidade) {
      where.cidade = { contains: String(cidade), mode: "insensitive" };
    }

    const [clientes, total] = await Promise.all([
      prisma.cliente.findMany({
        where,
        skip: (pageNumber - 1) * pageSize,
        take: pageSize,
        orderBy: { nome: "asc" },
      }),
      prisma.cliente.count({ where }),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return res.status(200).json({
      clientes,
      pagination: {
        currentPage: pageNumber,
        totalPages,
        totalItems: total,
      },
    });
  } catch {
    return res.status(500).json({ error: "Erro ao buscar clientes" });
  }
}
