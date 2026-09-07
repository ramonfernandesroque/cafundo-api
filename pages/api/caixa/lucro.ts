import type { NextApiRequest, NextApiResponse } from "next";
import { TipoTransacao } from '@prisma/client';
import prisma from '../../../lib/prisma';
import { requireAdmin } from '../../../lib/auth';
import { getPeriodoComparativo } from '../../../lib/periodoFiltro';

function calcularPercentualDiferenca(atual: number, anterior: number) {
  if (anterior === 0) return atual > 0 ? 100 : 0;
  return ((atual - anterior) / Math.abs(anterior)) * 100;
}

function calcularMargemLucro(entrada: number, saida: number) {
  if (entrada === 0) return 0;
  return ((entrada - saida) / entrada) * 100;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  // Rota exclusiva do ADMIN (caixa). Sem token -> 401, sem permissão -> 403.
  if (!requireAdmin(req, res)) return;

  // Período atual x anterior conforme ?filtro= (hoje|semana|mes|ano; padrão: mes)
  const { atual, anterior } = getPeriodoComparativo(req.query.filtro);

  try {
    const [entradaAtual, saidaAtual, entradaAnterior, saidaAnterior] =
      await Promise.all([
        prisma.transacoesCaixa.aggregate({
          _sum: { valor: true },
          where: {
            tipo: TipoTransacao.ENTRADA,
            data: { gte: atual.gte, lt: atual.lt },
          },
        }),
        prisma.transacoesCaixa.aggregate({
          _sum: { valor: true },
          where: {
            tipo: TipoTransacao.SAIDA,
            data: { gte: atual.gte, lt: atual.lt },
          },
        }),
        prisma.transacoesCaixa.aggregate({
          _sum: { valor: true },
          where: {
            tipo: TipoTransacao.ENTRADA,
            data: { gte: anterior.gte, lt: anterior.lt },
          },
        }),
        prisma.transacoesCaixa.aggregate({
          _sum: { valor: true },
          where: {
            tipo: TipoTransacao.SAIDA,
            data: { gte: anterior.gte, lt: anterior.lt },
          },
        }),
      ]);

    const totalEntradaAtual = Number(entradaAtual._sum.valor || 0);
    const totalSaidaAtual = Number(saidaAtual._sum.valor || 0);
    const totalEntradaAnterior = Number(entradaAnterior._sum.valor || 0);
    const totalSaidaAnterior = Number(saidaAnterior._sum.valor || 0);

    const margemAtual = calcularMargemLucro(totalEntradaAtual, totalSaidaAtual);
    const margemAnterior = calcularMargemLucro(
      totalEntradaAnterior,
      totalSaidaAnterior
    );
    const diffMargem = calcularPercentualDiferenca(margemAtual, margemAnterior);

    const resposta = {
      margemLucro: {
        value: `${margemAtual.toFixed(1)}%`,
        diff: `${diffMargem > 0 ? "+" : ""}${diffMargem.toFixed(1)}%`,
        positive: diffMargem >= 0,
      },
    };

    return res.status(200).json(resposta);
  } catch (error) {
    return res.status(500).json({
      error: "Erro ao calcular margem de lucro",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
