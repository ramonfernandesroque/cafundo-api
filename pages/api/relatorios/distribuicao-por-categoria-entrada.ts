import type { NextApiRequest, NextApiResponse } from "next";
import { TipoTransacao } from '@prisma/client';
import prisma from '../../../lib/prisma';
import { requireAdmin } from '../../../lib/auth';
import { format } from "date-fns";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  // Rota exclusiva do ADMIN (relatórios). Sem token -> 401, sem permissão -> 403.
  if (!requireAdmin(req, res)) return;

  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth(); // 0 = Janeiro

  const inicioMes = new Date(anoAtual, mesAtual, 1);
  const fimMes = new Date(anoAtual, mesAtual + 1, 1); // primeiro dia do mês seguinte

  try {
    // Obtendo transações agrupadas por categoria e data
    const transacoes = await prisma.transacoesCaixa.groupBy({
      by: ["categorias", "data"], // Agrupando por categoria e data
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

    // Calculando o total das receitas
    const totalReceita = transacoes.reduce(
      (acc, curr) => acc + parseFloat((curr._sum.valor ?? 0).toString()),
      0
    );

    // Mapeando as transações para incluir o valor, percentual e a data formatada
    const distribuicaoPorCategoria = transacoes.map((item) => {
      const valor = parseFloat((item._sum.valor ?? 0).toString());
      const percentual = totalReceita > 0 ? (valor / totalReceita) * 100 : 0;
      const label = format(new Date(item.data), "dd/MM/yyyy"); // Formata a data para "dd/MM/yyyy"

      return {
        categoria: item.categorias,
        valor: valor.toFixed(2),
        percentual: percentual.toFixed(2),
        label: label, // Adiciona a data completa formatada
      };
    });

    // Retorna a resposta com a distribuição por categoria e o total de receitas
    res.status(200).json({
      distribuicaoPorCategoria,
      totalReceita,
    });
  } catch (error) {
    // Em caso de erro, retorna um erro 500
    res.status(500).json({
      error: "Erro ao calcular distribuição por categoria",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
