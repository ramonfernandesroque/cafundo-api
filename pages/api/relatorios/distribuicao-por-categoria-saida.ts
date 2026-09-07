import type { NextApiRequest, NextApiResponse } from "next";
import { TipoTransacao } from '@prisma/client';
import prisma from '../../../lib/prisma';
import { requireAdmin } from '../../../lib/auth';
import { parseISO, subDays, format } from "date-fns";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  // Rota exclusiva do ADMIN (relatórios). Sem token -> 401, sem permissão -> 403.
  if (!requireAdmin(req, res)) return;

  const { filtro, startDate, endDate } = req.query;

  let dataInicio, dataFim;

  if (filtro === "periodo" && startDate && endDate) {
    dataInicio = parseISO(String(startDate));
    dataFim = parseISO(String(endDate));
    dataFim.setHours(23, 59, 59, 999); // inclui o dia final inteiro
  } else if (!isNaN(parseInt(String(filtro)))) {
    const dias = parseInt(String(filtro));
    dataFim = new Date();
    dataInicio = subDays(dataFim, dias);
  } else {
    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtual = hoje.getMonth();
    dataInicio = new Date(anoAtual, mesAtual, 1);
    dataFim = new Date(anoAtual, mesAtual + 1, 1);
  }

  try {
    const transacoes = await prisma.transacoesCaixa.groupBy({
      by: ["categorias", "data"],
      where: {
        tipo: TipoTransacao.SAIDA,
        data: {
          gte: dataInicio,
          lte: dataFim,
        },
      },
      _sum: {
        valor: true,
      },
    });

    const totalDespesas = transacoes.reduce(
      (acc, curr) => acc + parseFloat((curr._sum.valor ?? 0).toString()),
      0
    );

    const distribuicaoPorCategoria = transacoes.map((item) => {
      const valor = parseFloat((item._sum.valor ?? 0).toString());
      const percentual = totalDespesas > 0 ? (valor / totalDespesas) * 100 : 0;
      const label = format(new Date(item.data), "dd/MM/yyyy");

      return {
        categoria: item.categorias,
        valor: valor.toFixed(2),
        percentual: percentual.toFixed(2),
        label,
      };
    });

    res.status(200).json({
      distribuicaoPorCategoria,
      totalDespesas,
    });
  } catch (error) {
    res.status(500).json({
      error: "Erro ao calcular distribuição por categoria",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
