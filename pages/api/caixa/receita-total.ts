import type { NextApiRequest, NextApiResponse } from "next";
// pages/api/caixa/receita-total.ts

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
    const [entradasAtuais, saidasAtuais, entradasAnteriores] =
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
      ]);

    // Ajuste: Agora a soma considera apenas as ENTRADAS
    const somaAtual = Number(entradasAtuais._sum.valor || 0);
    const somaAnterior = Number(entradasAnteriores._sum.valor || 0);

    const diferenca = calcularPercentualDiferenca(somaAtual, somaAnterior);

    const resposta = {
      receitaTotal: {
        value: formatarMoeda(somaAtual), // Exibindo apenas a soma das ENTRADAS
        diff: `${diferenca > 0 ? "+" : ""}${diferenca.toFixed(1)}%`,
        positive: diferenca >= 0,
        detalhes: {
          entradas: formatarMoeda(Number(entradasAtuais._sum.valor || 0)),
          saidas: formatarMoeda(Number(saidasAtuais._sum.valor || 0)),
        },
      },
    };

    return res.status(200).json(resposta);
  } catch (error) {
    return res.status(500).json({
      error: "Erro ao calcular receita total",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
