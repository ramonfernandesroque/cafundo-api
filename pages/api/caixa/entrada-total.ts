import type { NextApiRequest, NextApiResponse } from "next";
import { TipoTransacao } from '@prisma/client';
import prisma from '../../../lib/prisma';
import { requireAdmin } from '../../../lib/auth';

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

  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth();

  const inicioMesAtual = new Date(anoAtual, mesAtual, 1);
  const inicioMesAnterior = new Date(anoAtual, mesAtual - 1, 1);

  try {
    const [totalAtual, totalAnterior] = await Promise.all([
      prisma.transacoesCaixa.aggregate({
        _sum: {
          valor: true,
        },
        where: {
          tipo: TipoTransacao.ENTRADA,
          data: {
            gte: inicioMesAtual,
            lt: new Date(anoAtual, mesAtual + 1, 1),
          },
        },
      }),
      prisma.transacoesCaixa.aggregate({
        _sum: {
          valor: true,
        },
        where: {
          tipo: TipoTransacao.ENTRADA,
          data: {
            gte: inicioMesAnterior,
            lt: inicioMesAtual,
          },
        },
      }),
    ]);

    const somaAtual = Number(totalAtual._sum.valor || 0);
    const somaAnterior = Number(totalAnterior._sum.valor || 0);

    const diferenca = calcularPercentualDiferenca(somaAtual, somaAnterior);

    const resposta = {
      entradaTotal: {
        value: formatarMoeda(somaAtual),
        diff: `${diferenca > 0 ? "+" : ""}${diferenca.toFixed(1)}%`,
        positive: diferenca >= 0, // Se o valor do mês atual é menor ou igual ao anterior, é positivo
      },
    };

    return res.status(200).json(resposta);
  } catch (error) {
    return res.status(500).json({
      error: "Erro ao calcular entrada totais",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
