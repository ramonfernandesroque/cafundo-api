import { requireAuth } from "../../../lib/auth";
import { aplicarCors } from "../../../lib/cors";
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "../../../lib/prisma";

// GET /api/cliente/resumo — agregados para os cards (sem trazer a base).
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  aplicarCors(req, res);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (!requireAuth(req, res)) return;
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const rows = (await prisma.$queryRawUnsafe(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE LENGTH(regexp_replace(documento, '\\D', '', 'g')) = 11)::int AS fisicas,
        COUNT(*) FILTER (WHERE LENGTH(regexp_replace(documento, '\\D', '', 'g')) = 14)::int AS juridicas,
        COUNT(DISTINCT cidade)::int AS cidades
      FROM cliente
    `)) as Array<{ total: number; fisicas: number; juridicas: number; cidades: number }>;

    return res.status(200).json(rows[0] ?? { total: 0, fisicas: 0, juridicas: 0, cidades: 0 });
  } catch {
    return res.status(500).json({ error: "Erro ao buscar resumo de clientes" });
  }
}
