import { aplicarCors } from "../../../../lib/cors";
import { NextApiRequest, NextApiResponse } from "next";
import prisma from '../../../../lib/prisma';
import { requireAdmin } from '../../../../lib/auth';
import {
  startOfDay,
  startOfWeek,
  startOfMonth,
  startOfYear,
  addDays,
  addWeeks,
  addMonths,
  addYears,
} from "date-fns";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  aplicarCors(req, res);
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS, PUT, DELETE"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Rota exclusiva do ADMIN (caixa). Sem token -> 401, sem permissão -> 403.
  if (!requireAdmin(req, res)) return;

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const { _page = "1", _limit = "20", filtro } = req.query;

    const pageNumber = parseInt(_page as string, 10);
    const pageSize = parseInt(_limit as string, 10);

    if (
      isNaN(pageNumber) ||
      isNaN(pageSize) ||
      pageNumber < 1 ||
      pageSize < 1
    ) {
      return res
        .status(400)
        .json({ error: "Parâmetros de paginação inválidos" });
    }

    let dateFilter: { gte: Date; lt: Date } | undefined;
    const now = new Date();

    if (filtro) {
      switch (filtro) {
        case "hoje":
          dateFilter = {
            gte: startOfDay(now),
            lt: addDays(startOfDay(now), 1),
          };
          break;
        case "semana":
          dateFilter = {
            gte: startOfWeek(now, { weekStartsOn: 1 }),
            lt: addWeeks(startOfWeek(now, { weekStartsOn: 1 }), 1),
          };
          break;
        case "mes":
          dateFilter = {
            gte: startOfMonth(now),
            lt: addMonths(startOfMonth(now), 1),
          };
          break;
        case "ano":
          dateFilter = {
            gte: startOfYear(now),
            lt: addYears(startOfYear(now), 1),
          };
          break;
        default:
          return res.status(400).json({ error: "Filtro inválido" });
      }
    }

    const whereClause: { data?: { gte: Date; lt: Date } } = {};
    if (filtro && dateFilter) {
      whereClause.data = dateFilter;
    }

    const transacoesCaixa = await prisma.transacoesCaixa.findMany({
      where: whereClause,
      skip: (pageNumber - 1) * pageSize,
      take: pageSize,
      orderBy: [{ data: "desc" }, { descricao: "asc" }],
    });

    const total = await prisma.transacoesCaixa.count({
      where: whereClause,
    });

    const totalPages = Math.ceil(total / pageSize);

    return res.status(200).json({
      transacoesCaixa,
      pagination: {
        currentPage: pageNumber,
        totalPages,
        totalItems: total,
      },
    });
  } catch (error) {
    console.error("Erro ao buscar transações de caixa:", error);
    return res
      .status(500)
      .json({ error: "Erro ao buscar transações de caixa" });
  }
}

