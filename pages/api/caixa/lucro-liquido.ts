import type { NextApiRequest, NextApiResponse } from "next";
// pages/api/caixa/lucro-liquido.ts

import { TipoTransacao } from '@prisma/client';
import prisma from '../../../lib/prisma';
import { requireAdmin } from '../../../lib/auth';
import { getPeriodoComparativo } from '../../../lib/periodoFiltro';

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function calcularPercentualDiferenca(atual: number, anterior: number) {
  if (anterior === 0) return atual > 0 ? 100 : 0;
  return ((atual - anterior) / anterior) * 100;
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
    const [entradasAtuais, saidasAtuais, entradasAnteriores, saidasAnteriores] =
      await Promise.all([
        prisma.transacoesCaixa.aggregate({
          _sum: { valor: true },
          where: {
            tipo: TipoTransacao.ENTRADA,
            data: {
              gte: atual.gte,
              lt: atual.lt,
            },
          },
        }),
        prisma.transacoesCaixa.aggregate({
          _sum: { valor: true },
          where: {
            tipo: TipoTransacao.SAIDA,
            data: {
              gte: atual.gte,
              lt: atual.lt,
            },
          },
        }),
        prisma.transacoesCaixa.aggregate({
          _sum: { valor: true },
          where: {
            tipo: TipoTransacao.ENTRADA,
            data: {
              gte: anterior.gte,
              lt: anterior.lt,
            },
          },
        }),
        prisma.transacoesCaixa.aggregate({
          _sum: { valor: true },
          where: {
            tipo: TipoTransacao.SAIDA,
            data: {
              gte: anterior.gte,
              lt: anterior.lt,
            },
          },
        }),
      ]);

    const totalEntradasAtuais = Number(entradasAtuais._sum.valor || 0);
    const totalSaidasAtuais = Number(saidasAtuais._sum.valor || 0);
    const lucroAtual = totalEntradasAtuais - totalSaidasAtuais;

    const totalEntradasAnteriores = Number(entradasAnteriores._sum.valor || 0);
    const totalSaidasAnteriores = Number(saidasAnteriores._sum.valor || 0);
    const lucroAnterior = totalEntradasAnteriores - totalSaidasAnteriores;

    const diferencaPercentual = calcularPercentualDiferenca(
      lucroAtual,
      lucroAnterior
    );

    const resposta = {
      lucroLiquido: {
        value: formatarMoeda(lucroAtual),
        diff: `${
          diferencaPercentual >= 0 ? "+" : ""
        }${diferencaPercentual.toFixed(1)}%`,
        positive: lucroAtual >= lucroAnterior,
        detalhes: {
          entradas: formatarMoeda(totalEntradasAtuais),
          saidas: formatarMoeda(totalSaidasAtuais),
          liquido: formatarMoeda(lucroAtual),
        },
      },
    };

    return res.status(200).json(resposta);
  } catch (error) {
    return res.status(500).json({
      error: "Erro ao calcular lucro líquido",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
