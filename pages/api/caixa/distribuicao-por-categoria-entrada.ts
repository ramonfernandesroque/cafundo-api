import type { NextApiRequest, NextApiResponse } from "next";
import { TipoTransacao } from '@prisma/client';
import prisma from '../../../lib/prisma';
import { requireAdmin } from '../../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  // Rota exclusiva do ADMIN (caixa). Sem token -> 401, sem permissão -> 403.
  if (!requireAdmin(req, res)) return;

  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth(); // 0 = Janeiro

  const inicioMes = new Date(anoAtual, mesAtual, 1);
  const fimMes = new Date(anoAtual, mesAtual + 1, 1); // primeiro dia do mês seguinte

  try {
    const transacoes = await prisma.transacoesCaixa.groupBy({
      by: ["categorias"],
      where: {
        tipo: TipoTransacao.ENTRADA,
        data: {
          gte: inicioMes,
          lt: fimMes,
        },
      },
      _sum: {
        valor: true,
      },
    });

    const totalReceita = transacoes.reduce(
      (acc, curr) => acc + parseFloat((curr._sum.valor ?? 0).toString()),
      0
    );

    const distribuicaoPorCategoria = transacoes.map((item) => {
      const valor = parseFloat((item._sum.valor ?? 0).toString());
      const percentual = totalReceita > 0 ? (valor / totalReceita) * 100 : 0;
      return {
        categoria: item.categorias,
        valor: valor.toFixed(2),
        percentual: percentual.toFixed(2),
      };
    });

    res.status(200).json({
      distribuicaoPorCategoria,
      totalReceita,
    });
  } catch (error) {
    res.status(500).json({
      error: "Erro ao calcular distribuição por categoria",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
